/**
 * The mapping from a payload to a chart, which is the part of a chart that can be wrong without
 * looking wrong. A mis-sorted allocation and a chart drawn from unsorted timestamps both render
 * perfectly happily.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PlotBox } from '@cloudsforge/ui/charts'
import {
  areaPathsFor,
  changePercent,
  labelFor,
  pricedStamp,
  sum,
  toAllocation,
  toChartData,
} from '../src/lib/series.ts'

const box: PlotBox = { width: 100, height: 50, padX: 0, padY: 0 }

describe('areaPathsFor()', () => {
  it('projects values into the box: index across x, value up y', () => {
    const { line, area, baselineY } = areaPathsFor([0, 10], box)
    assert.equal(line, 'M0 50 L100 0')
    // The area is the same polyline, closed down to the baseline and back.
    assert.equal(area, 'M0 50 L100 0 L100 50 L0 50 Z')
    assert.equal(baselineY, 50)
  })

  it('draws a flat series down the middle, not along the floor', () => {
    // Pinned to the floor, a chart of a stable balance is indistinguishable from a chart of a
    // balance that hit zero.
    assert.equal(areaPathsFor([5, 5, 5], box).line, 'M0 25 L50 25 L100 25')
  })

  it('centres a single point rather than pinning it to the left edge', () => {
    assert.equal(areaPathsFor([7], box).line, 'M50 25')
  })

  it('yields empty strings for an empty series, never a path full of NaN', () => {
    const { line, area } = areaPathsFor([], box)
    assert.equal(line, '')
    assert.equal(area, '')
  })

  it('respects padding, so a 2px stroke cannot clip at the edge', () => {
    const padded = areaPathsFor([0, 10], { width: 100, height: 50, padX: 4, padY: 8 })
    assert.equal(padded.line, 'M4 42 L96 8')
  })
})

describe('toChartData()', () => {
  it('sorts oldest first, which is the direction a time axis reads', () => {
    const data = toChartData([
      { at: '2026-03-14T02:00:00.000Z', value: 3 },
      { at: '2026-03-14T00:00:00.000Z', value: 1 },
      { at: '2026-03-14T01:00:00.000Z', value: 2 },
    ])
    assert.deepEqual(
      data.map((d) => d.value),
      [1, 2, 3],
    )
  })

  it('labels in UTC, so two people reading one chart agree about when', () => {
    assert.equal(labelFor('2026-03-14T09:05:00.000Z'), '09:05')
    assert.equal(labelFor('2026-03-14T09:05:00.000Z', 'day'), '14 Mar')
    // ── SEPTEMBER, WHICH `month: 'short'` SPELLS `Sept` IN en-GB ────────────────────────────
    //
    // Four characters where the other eleven are three. On a day axis the labels are laid out
    // assuming one width, so a series crossing 1 September stopped lining up with its bars — and
    // every bundle scaffolded from this template inherited it. One fixed date per month, because
    // a single sample has an eleven-in-twelve chance of missing the one that is wrong.
    const labels = [
      '15 Jan', '15 Feb', '15 Mar', '15 Apr', '15 May', '15 Jun',
      '15 Jul', '15 Aug', '15 Sep', '15 Oct', '15 Nov', '15 Dec',
    ]
    labels.forEach((expected, month) => {
      const iso = `2026-${(month + 1).toString().padStart(2, '0')}-15T09:05:00.000Z`
      assert.equal(labelFor(iso, 'day'), expected)
    })
    assert.equal(new Set(labels.map((l) => l.length)).size, 1, 'a day axis must not change width')
  })

  it('does not throw on an unparseable timestamp', () => {
    assert.equal(labelFor('not a date'), '—')
  })
})

describe('pricedStamp()', () => {
  it('renders the moment the values were priced', () => {
    assert.equal(pricedStamp('2026-03-14T09:15:00.000Z'), 'Priced 09:15:00 UTC')
  })

  it('is undefined when nothing was priced, so no stamp is drawn', () => {
    // Counted values have no oracle behind them, and a stamp on them would claim a staleness
    // guarantee that does not exist.
    assert.equal(pricedStamp(null), undefined)
    assert.equal(pricedStamp('nonsense'), undefined)
  })
})

describe('toAllocation()', () => {
  it('sorts descending, because bars are read by comparing lengths', () => {
    const rows = toAllocation([
      { label: 'b', value: 2 },
      { label: 'c', value: 30 },
      { label: 'a', value: 11 },
    ])
    assert.deepEqual(
      rows.map((r) => r.label),
      ['c', 'a', 'b'],
    )
  })

  it('drops zero and negative rows', () => {
    const rows = toAllocation([
      { label: 'held', value: 5 },
      { label: 'closed', value: 0 },
      { label: 'broken', value: Number.NaN },
    ])
    assert.deepEqual(rows, [{ label: 'held', value: 5 }])
  })

  it('folds past the eighth row into Other, preserving the total', () => {
    // A ninth categorical colour does not exist. Generating one is how a palette stops being one.
    const rows = toAllocation(
      Array.from({ length: 12 }, (_, i) => ({ label: `k${i}`, value: i + 1 })),
    )
    assert.equal(rows.length, 8)
    assert.equal(rows[7]?.label, 'Other')
    assert.equal(
      sum(rows.map((r) => r.value)),
      sum(Array.from({ length: 12 }, (_, i) => i + 1)),
    )
  })
})

describe('changePercent()', () => {
  it('is the change from the first reading to the last', () => {
    assert.equal(changePercent([100, 110]), 10)
    assert.equal(changePercent([100, 50]), -50)
  })

  it('is zero from a zero start rather than infinite', () => {
    // "▲ ∞%" is not something a reader can act on.
    assert.equal(changePercent([0, 25]), 0)
    assert.equal(changePercent([]), 0)
  })
})
