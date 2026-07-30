/**
 * Turning an API payload into something the chart primitives accept.
 *
 * The primitives in `@cloudsforge/ui/charts` take `{ label, value }` and geometry; they do not
 * take a service's response shape, and they should not — the day two products disagree about
 * their payloads is the day a shared chart would have to know about both. That mapping is this
 * file, and it is pure so it can be tested without a browser.
 */
import { areaPath, foldBars, linePath, plotPoints, type ChartDatum, type PlotBox } from '@cloudsforge/ui/charts'

/** A time series point as the API returns it. */
export interface SeriesPoint {
  /** ISO-8601, always UTC from the service. */
  at: string
  value: number
}

/**
 * Label a point for an axis or a tooltip.
 *
 * Fixed locale and an explicit UTC time zone: the same series must produce the same labels on a
 * developer's machine, in CI and in a screenshot attached to a bug report. A label rendered in
 * the viewer's zone makes two people reading the same chart disagree about when something
 * happened, which is the one thing a time axis exists to settle.
 */
export function labelFor(iso: string, granularity: 'hour' | 'day' = 'hour'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return granularity === 'day'
    ? d.toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short' })
    : d.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })
}

/** An API time series as chart data, oldest first — the direction an axis reads. */
export function toChartData(points: readonly SeriesPoint[], granularity: 'hour' | 'day' = 'hour'): ChartDatum[] {
  return [...points]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((p) => ({ label: labelFor(p.at, granularity), value: p.value }))
}

/**
 * The pricing timestamp, as a chart stamp.
 *
 * Rendered next to any chart of prices or balances. The oracle can be stale by up to
 * PAY_ORACLE_MAX_AGE_SECONDS, and a balance chart that hides WHEN it was priced is a chart that
 * lies by omission — the number is right, but not necessarily now.
 */
export function pricedStamp(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return `Priced ${d.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false })} UTC`
}

/**
 * An allocation, sorted largest first and folded past eight rows.
 *
 * Sorted because an allocation chart is read by comparing lengths, and unsorted bars make the
 * reader do the sorting; folded at eight because a ninth categorical colour does not exist and
 * inventing one is how a palette stops being a palette. Zero and negative rows are dropped — a
 * bar of length zero is a row in a table, not a mark on a chart.
 */
export function toAllocation(rows: readonly ChartDatum[], maxBars = 8): ChartDatum[] {
  return foldBars(
    rows.filter((r) => Number.isFinite(r.value) && r.value > 0),
    maxBars,
  )
}

/** The two paths an area chart draws, from values and a box. Thin, and exactly what is tested. */
export function areaPathsFor(
  values: readonly number[],
  box: PlotBox,
): { line: string; area: string; baselineY: number } {
  const points = plotPoints(values, box)
  const baselineY = box.height - box.padY
  return { line: linePath(points), area: areaPath(points, baselineY), baselineY }
}

/** Total of a series, for the stat tile above the chart of it. */
export function sum(values: readonly number[]): number {
  return values.reduce((a, b) => (Number.isFinite(b) ? a + b : a), 0)
}

/**
 * Percentage change between the first and last reading.
 *
 * Returns 0 rather than Infinity when the series starts at zero: a tile that reads "▲ ∞%" is a
 * tile nobody can act on, and the honest statement about growth from nothing is that a percentage
 * does not describe it.
 */
export function changePercent(values: readonly number[]): number {
  const first = values[0]
  const last = values[values.length - 1]
  if (first === undefined || last === undefined || first === 0) return 0
  return ((last - first) / Math.abs(first)) * 100
}
