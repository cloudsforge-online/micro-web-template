/**
 * The bundled sample, which is the only screen a freshly generated application has.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY A FIXTURE GETS A TEST AT ALL.
 *
 * `src/lib/overview.ts` is example data behind a banner that says so, and the obvious view is that
 * nothing in it can be wrong enough to test. It shipped two defects anyway, and both were copied
 * into every frontend cut from this template:
 *
 *   1. A bar labelled `'Shards'`. SHARD is RETIRED — `RETIRED_ASSETS` in
 *      `contracts/packages/chain/src/index.ts` — so every generated app opened on a screen naming
 *      an asset the estate no longer issues. micro-org #227.
 *   2. Worse, and not in the issue: `pages/overview.tsx` formats every allocation value as
 *      `formatValue(n) + payload.totalUnit`, and `totalUnit` is `' EMBER'`. The Shards bar
 *      therefore rendered "3,480 EMBER", and the "Total held" tile above it added Shards to EMBER
 *      and called the sum EMBER. A scaffold that demonstrates summing two denominations into one
 *      teaches that, thirteen times, to thirteen frontends.
 *
 * Neither is visible in a diff of the fixture and neither breaks anything, which is exactly why
 * they lasted. So both are held here.
 *
 * ── WHY THIS FILE SPELLS 'shard' OUT INSTEAD OF IMPORTING THE CONSTANT ────────────────────────
 *
 * Every service in the estate asserts against `RETIRED_ASSETS` itself. This repository cannot:
 * it declares exactly one `@cloudsforge` dependency, `@cloudsforge/ui`, and `web-ci.yml` checks
 * out exactly one sibling to resolve it. Adding `@cloudsforge/contracts-chain` would make every
 * application generated from this template depend on the chain contracts in order to render a
 * fixture, and would need a third checkout in CI for the same reason.
 *
 * The trade is deliberate and it is the honest one: a literal in a TEST is a guard that fails
 * loudly when it is wrong, whereas the literal this replaces was in COPY, where being wrong is
 * silent. If SHARD is ever un-retired, this assertion becomes a false alarm somebody must come and
 * delete — which is a far better failure than the one that shipped.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { __resetAuth } from '../src/lib/api.ts'
import { __resetObs } from '../src/lib/obs.ts'
import { loadOverview } from '../src/lib/overview.ts'
import {
  installFetch,
  installStorage,
  installWindow,
  json,
  removeStorage,
  removeWindow,
  type FetchStub,
} from './browser-stubs.ts'

let stub: FetchStub | null = null

beforeEach(() => {
  installWindow('http://localhost:5180/overview')
  installStorage()
  __resetAuth()
})

afterEach(() => {
  stub?.restore()
  stub = null
  __resetObs()
  removeStorage()
  removeWindow()
})

/** The sample as a generated application actually receives it: through the 404 fallback. */
async function sample() {
  stub = installFetch(() => json(404, { error: { code: 'not_found', message: 'no such route' } }))
  const result = await loadOverview(new AbortController().signal)
  assert.equal(result.sample, true, 'a 404 must fall back to the bundled sample')
  return result.payload
}

describe('the bundled sample', () => {
  it('names no retired asset anywhere in the payload', async () => {
    // The whole payload, not only the labels: a retired asset code is just as wrong in a unit, a
    // series label or a future field somebody adds without reading this file.
    const payload = await sample()
    assert.equal(
      /shard/i.test(JSON.stringify(payload)),
      false,
      'SHARD is retired (RETIRED_ASSETS, contracts/packages/chain/src/index.ts) and must not ' +
        'appear in the data every generated application opens on',
    )
  })

  it('is denominated in one thing, so its total is a real sum', async () => {
    // Every allocation row is a PLACE the payload's own asset sits — free, staked, escrowed,
    // settling, floated, reserved — never a second asset. The check is the arithmetic rather than
    // the vocabulary: rows in a second denomination cannot add up to the total in the first, so
    // this fails on the defect itself instead of on a list of forbidden words.
    const payload = await sample()
    const total = payload.series[payload.series.length - 1]?.value
    const allocated = payload.allocation.reduce((sum, row) => sum + row.value, 0)
    assert.equal(
      allocated,
      total,
      'the allocation must add up to the last series reading, which is the "Total held" tile — ' +
        'a sample that contradicts itself teaches every app cut from this template that the two ' +
        'panels on this page are unrelated',
    )
  })

  it('is deterministic, which is the property it exists for', async () => {
    // A screenshot taken today and one taken next month must be the same image, or a visual change
    // to the chart primitives is not reviewable. Anything derived from the clock breaks that.
    const first = await sample()
    stub?.restore()
    const second = await sample()
    assert.deepEqual(second, first)
    assert.equal(first.pricedAt, '2026-03-14T09:15:00.000Z')
  })
})

describe('the fallback that serves it', () => {
  it('falls back when the bundle is served with no API at all', async () => {
    // `ApiError(0)` — the request never reached a service. That is the state of a template opened
    // from a static server before its backend exists, and it is the other case the fixture is for.
    stub = installFetch(() => {
      throw new TypeError('fetch failed')
    })
    const result = await loadOverview(new AbortController().signal)
    assert.equal(result.sample, true)
  })

  it('does NOT fall back on a real failure, because invented numbers are worse than an error', async () => {
    // The rule `loadOverview` is written around: 404 and 0 mean "there is no service yet", and
    // nothing else does. A 500 is a service that answered badly, and papering over it with the
    // fixture would show a signed-in user a page of numbers that are not theirs.
    stub = installFetch(() =>
      json(500, { error: { code: 'internal', message: 'The ledger did not answer.' } }),
    )
    await assert.rejects(() => loadOverview(new AbortController().signal), /ledger did not answer/)
  })
})
