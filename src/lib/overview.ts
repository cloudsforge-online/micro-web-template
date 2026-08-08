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
 *
 * ── THE FIGURES ARE TYPED IN, DELIBERATELY, AND THAT IS NOT THE ESTATE'S NUMBERS RULE BENDING ──
 *
 * Everywhere else in the estate a number a user reads is derived at run time or bound by a test to
 * the constant it describes, because a typed-in figure is a claim about the system that nothing
 * keeps true. These are not claims about the system. They are the FIXTURE, they are labelled as
 * one on screen — `pages/overview.tsx` renders "Sample data. /v1/overview answered 404…" above
 * them — and deriving them would destroy the single property the fixture exists for, which is that
 * it is byte-identical between two runs a month apart. A generated app that showed live numbers
 * here would not be demonstrating the charts; it would be inventing balances, which is the failure
 * `loadOverview` above narrows to 404 and 0 precisely to avoid.
 *
 * The rule that DOES apply, and that this sample broke, is the other one: never write an asset
 * code or a unit into copy. See the allocation below.
 *
 * ── AND THE FIGURES ARE NOT FREE, EITHER: THE ALLOCATION SUMS TO THE LAST SERIES READING ───────
 *
 * 6120 + 3480 + 2410 + 980 + 640 + 260 = 13890, which is the final `series` value and therefore
 * the "Total held" tile. A sample whose parts did not add up to its own total would teach every
 * app cut from this template that the two panels on this page are unrelated, and would make any
 * real payload that IS consistent look wrong by comparison. `test/overview.test.ts` holds the
 * identity, so a value edited here without its counterpart fails the build rather than quietly
 * producing a page that contradicts itself.
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
  /*
   * EVERY ROW IS A PLACE EMBER SITS, NOT A SECOND ASSET — WHICH IS WHY 'Shards' IS GONE.
   *
   * The second row read `{ label: 'Shards', value: 3480 }`, so every application generated from
   * this template shipped a bar naming SHARD. SHARD is retired: `RETIRED_ASSETS` in
   * `contracts/packages/chain/src/index.ts`. micro-org #227, and the cheapest of its rows to fix
   * because this one prevents recurrence — a template is copied thirteen times and reviewed once.
   *
   * It was also a UNIT ERROR, which the issue does not mention and which is the worse half.
   * `pages/overview.tsx` formats every allocation value as `formatValue(n) + payload.totalUnit`,
   * and `totalUnit` is ' EMBER'. So the bar labelled "Shards" rendered "3,480 EMBER", and the
   * total above it added Shards to EMBER and called the answer EMBER. Two denominations summed
   * into one is exactly what a new frontend must not copy from its scaffold, and a reader who
   * trusted the label would have been reading a number in the other asset.
   *
   * So the replacement is not another asset code. Every row is now a LOCATION of the one asset
   * the payload is denominated in — free balance, staked, escrowed, settling, floated, reserved —
   * which makes the sum honest, keeps the bar chart's shape, and demonstrates the thing a real
   * `/v1/overview` would actually answer. 'Withdrawal reserve' is the estate's own vocabulary for
   * the sixth: the ledger models available/reserved as two accounts, and a queued withdrawal is a
   * posting between them (`ledger/src/accounts.ts`, `wallet/src/withdrawals.ts`).
   *
   * 3480 is unchanged on purpose. It is load-bearing arithmetic, not decoration — see the note
   * above the fixture, and `test/overview.test.ts`, which fails if the rows stop adding up.
   */
  allocation: [
    { label: 'EMBER', value: 6120 },
    { label: 'Withdrawal reserve', value: 3480 },
    { label: 'Staked EMBER', value: 2410 },
    { label: 'Market escrow', value: 980 },
    { label: 'Pending settlement', value: 640 },
    { label: 'Faucet float', value: 260 },
  ],
}
