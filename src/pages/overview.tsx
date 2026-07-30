/**
 * The example page. Delete it, keep its shape.
 *
 * It exists to show the chart primitives used CORRECTLY, because the estate's three hand-rolled
 * chart implementations each got a different part of this wrong:
 *
 *   - a stat-tile row, where each tile is one number and its change, never a chart with a caption
 *   - an area chart that DISPLAYS ITS PRICING TIMESTAMP, so the reader knows how old the numbers
 *     are rather than assuming they are now
 *   - an allocation as sorted horizontal bars, not a pie: a pie asks a reader to compare angles,
 *     which they cannot do, in exchange for a shape
 *   - a table view, which is the accessible, copyable and printable form of every chart here
 *
 * There is no dual axis anywhere. Two scales are two panels.
 */
import { useCallback, useState } from 'react'
import { AreaChart, BarChart, Sparkline, StatTile, formatValue } from '@cloudsforge/ui/charts'
import { Empty, Failed, Forbidden, Loading } from '../components/states.tsx'
import { loadOverview, type OverviewResult } from '../lib/overview.ts'
import { useResource } from '../lib/resource.ts'
import { changePercent, pricedStamp, toAllocation, toChartData } from '../lib/series.ts'

const countRows = (r: OverviewResult): number => r.payload.series.length + r.payload.allocation.length

export function OverviewPage() {
  const [tableView, setTableView] = useState(false)
  const load = useCallback((signal: AbortSignal) => loadOverview(signal), [])
  const { state, data, error, reload } = useResource(load, countRows, 'Could not load your overview.')

  if (state === 'loading') return <Loading label="Loading your overview" />
  if (state === 'forbidden') return <Forbidden notice={error ?? undefined} />
  if (state === 'failed' && error) return <Failed notice={error} onRetry={reload} />
  if (state === 'empty' || !data) {
    return (
      <Empty
        title="Nothing has been recorded on this account yet"
        hint="Balances and allocations appear here once the first transfer settles."
      />
    )
  }

  const { payload, sample } = data
  const values = payload.series.map((p) => p.value)
  const latest = values[values.length - 1] ?? 0
  const change = changePercent(values)
  const stamp = pricedStamp(payload.pricedAt)
  const allocation = toAllocation(payload.allocation)
  const fmt = (n: number) => `${formatValue(n)}${payload.totalUnit}`

  return (
    <>
      <header className="wt-page__head">
        <h1 className="wt-page__title">Overview</h1>
        {/*
          The table view is a toggle rather than a separate route: the reader who needs it needs
          it for the chart in front of them, and sending them to another page loses their place.
        */}
        <button
          type="button"
          className="cf-btn"
          aria-pressed={tableView}
          onClick={() => setTableView((v) => !v)}
        >
          {tableView ? 'Show charts' : 'Show tables'}
        </button>
      </header>

      {sample && (
        <p className="wt-banner" role="status">
          Sample data. <code>/v1/overview</code> answered 404, so this page is showing the bundled
          example payload. Delete <code>src/lib/overview.ts</code> once the real endpoint exists.
        </p>
      )}

      {/* One row of tiles: a number, its change, and a sparkline of where it came from. */}
      <div className="wt-tiles">
        <StatTile
          label="Total held"
          value={fmt(latest)}
          delta={change}
          {...(stamp ? { pricedAt: stamp } : {})}
        >
          <Sparkline values={values} label="Total held, last ten hours" tableView={tableView} />
        </StatTile>
        <StatTile label="Positions" value={String(allocation.length)} />
        <StatTile
          label="Largest holding"
          value={allocation[0] ? fmt(allocation[0].value) : null}
          emptyLabel="Nothing held yet"
        />
        <StatTile label="Readings" value={String(values.length)} />
      </div>

      <section className="wt-panel">
        <AreaChart
          title="Total held"
          data={toChartData(payload.series)}
          {...(stamp ? { pricedAt: stamp } : {})}
          tableView={tableView}
          formatValue={fmt}
          emptyLabel="No readings in this window"
          errorLabel="Could not load this chart"
        />
      </section>

      <section className="wt-panel">
        <BarChart
          title="Allocation"
          data={allocation}
          {...(stamp ? { pricedAt: stamp } : {})}
          tableView={tableView}
          formatValue={fmt}
          emptyLabel="Nothing held in this account"
          errorLabel="Could not load these balances"
        />
      </section>
    </>
  )
}
