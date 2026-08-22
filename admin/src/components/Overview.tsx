import { useEffect, useState } from 'react'
import { fetchAnalytics } from '../api'
import type { AnalyticsResponse, RangeDays } from '../types'
import { KpiCard } from './KpiCard'
import { LineTrend, SubMrrTrend } from './TrendChart'

const RANGES: RangeDays[] = [7, 28, 90]

export function Overview() {
  const [range, setRange] = useState<RangeDays>(28)
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  async function load(r: RangeDays) {
    setLoading(true)
    setErr(null)
    try {
      setData(await fetchAnalytics(r))
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  const money = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  const pct = (n: number) => `${Math.round(n)}%`

  return (
    <div className="page">
      <div className="page-head">
        <h1>Overview</h1>
        <div className="controls">
          <button className="btn" onClick={() => load(range)} disabled={loading}>
            ↻ Refresh data
          </button>
          <div className="seg">
            {RANGES.map((r) => (
              <button key={r} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>
                {r}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {err ? (
        <ErrorState message={err} />
      ) : !data ? (
        <div className="center">
          <div>
            <div className="spinner" />
            <div className="muted">Loading analytics…</div>
          </div>
        </div>
      ) : (
        <>
          <div className="kpi-grid">
            <KpiCard name="Total users" kpi={data.kpis.totalUsers} info="Cumulative registered accounts on StrengthHub to date." />
            <KpiCard name="New users" kpi={data.kpis.newUsers} info="Accounts created within the selected window." />
            <KpiCard name="Active users" kpi={data.kpis.activeUsers} info="Distinct accounts active (signed in / refreshed) during the window." />
            <KpiCard name="Avg adherence" kpi={data.kpis.avgAdherence} info="Average nutrition-adherence score across active users, as a percentage." format={pct} />
            <KpiCard name="DAU" kpi={data.kpis.dau} info="Daily active users — accounts active in the last 24 hours." />
            <KpiCard name="WAU" kpi={data.kpis.wau} info="Weekly active users — accounts active in the last 7 days." />
            <KpiCard name="MAU" kpi={data.kpis.mau} info="Monthly active users — accounts active in the last 28 days." />
            <KpiCard name="MRR" kpi={data.kpis.mrr} info="Monthly recurring revenue from active paid subscriptions (AUD)." format={money} />
          </div>

          <div className="chart-grid">
            <LineTrend title="Active users (daily)" info="Accounts active each day across the window." data={data.series.activeUsersDaily} color="#a5e88a" />
            <LineTrend title="New signups (daily)" info="New accounts created each day." data={data.series.newSignupsDaily} color="#6ab0ff" />
            <SubMrrTrend title="Subscribers & MRR" info="Paying/trialing subscribers (bars) and monthly recurring revenue (line) over time." data={data.series.subscribersMrr} />
            <LineTrend title="App opens (daily)" info="Daily app-open sessions (proxied from per-day last-active until an events log is wired in)." data={data.series.appOpensDaily} color="#939a89" />
          </div>
        </>
      )}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  const denied = /permission-denied|restricted to the app owner/i.test(message)
  return (
    <div className="center">
      <div className="errbox">
        <h2>{denied ? 'Owner access required' : "Couldn't load analytics"}</h2>
        {denied ? (
          <p className="muted">
            Your account is signed in but doesn't have the <code>owner</code> claim. Grant it once with{' '}
            <code>node scripts/set-owner-claim.mjs &lt;your-uid&gt;</code> from the app repo, then sign out and back in.
          </p>
        ) : (
          <p className="muted">
            <code>{message}</code>
          </p>
        )}
      </div>
    </div>
  )
}
