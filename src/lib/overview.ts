/**
 * The example domain. Delete it when this template becomes a product.
 *
 * It is one endpoint, `/v1/overview`, shaped the way the estate's services answer: a payload with
 * a series, an allocation and the moment the values were priced.
 */
import { ApiError, api } from './api.ts'
import type { SeriesPoint } from './series.ts'

export interface OverviewPayload {
  /** Value over time, oldest first. */
  series: SeriesPoint[]
  /** Composition of the total, in no particular order — the chart sorts it. */
  allocation: Array<{ label: string; value: number }>
  /** When the oracle priced these values. Null when the numbers are counted, not priced. */
  pricedAt: string | null
  totalUnit: string
}

/** True when the payload is the bundled sample rather than a service's answer. */
export interface OverviewResult {
  payload: OverviewPayload
  sample: boolean
}

/**
 * Load the overview.
 *
 * Until the service behind this template exists, `/v1/overview` answers 404 (or nothing at all,
 * when the bundle is served on its own), and a template whose only screen is an error state
 * demonstrates nothing about the charts it exists to demonstrate. So those two statuses — and
 * ONLY those two — fall back to the bundled sample, and the page says so on screen. Every other
 * failure propagates and renders the failed state, because a 500 from a real service must never
 * be papered over with invented numbers.
 */
export async function loadOverview(signal: AbortSignal): Promise<OverviewResult> {
  try {
    const payload = await api<OverviewPayload>('/v1/overview', { signal, auth: true })
    return { payload, sample: false }
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 0)) {
      return { payload: SAMPLE, sample: true }
    }
    throw err
  }
}

/**
 * A deterministic sample. Fixed timestamps and fixed values: a screenshot of this page taken
 * today and one taken next month are the same image, which is what makes a visual change to the
 * chart primitives reviewable.
 */
const SAMPLE: OverviewPayload = {
  pricedAt: '2026-03-14T09:15:00.000Z',
  totalUnit: ' EMBER',
  series: [
    { at: '2026-03-14T00:00:00.000Z', value: 12480 },
    { at: '2026-03-14T01:00:00.000Z', value: 12610 },
    { at: '2026-03-14T02:00:00.000Z', value: 12395 },
    { at: '2026-03-14T03:00:00.000Z', value: 12720 },
    { at: '2026-03-14T04:00:00.000Z', value: 13040 },
    { at: '2026-03-14T05:00:00.000Z', value: 12960 },
    { at: '2026-03-14T06:00:00.000Z', value: 13310 },
    { at: '2026-03-14T07:00:00.000Z', value: 13585 },
    { at: '2026-03-14T08:00:00.000Z', value: 13470 },
    { at: '2026-03-14T09:00:00.000Z', value: 13890 },
  ],
  allocation: [
    { label: 'EMBER', value: 6120 },
    { label: 'Shards', value: 3480 },
    { label: 'Staked EMBER', value: 2410 },
    { label: 'Market escrow', value: 980 },
    { label: 'Pending settlement', value: 640 },
    { label: 'Faucet float', value: 260 },
  ],
}
