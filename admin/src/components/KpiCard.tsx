import type { Kpi } from '../types'
import { InfoTip } from './InfoTip'

type Fmt = (n: number) => string

export function KpiCard({
  name,
  kpi,
  info,
  format = (n) => n.toLocaleString(),
}: {
  name: string
  kpi: Kpi
  info: string
  format?: Fmt
}) {
  return (
    <div className="card kpi">
      <div className="k-top">
        <span className="k-name">{name}</span>
        <InfoTip text={info} />
      </div>
      <div className="k-val">{format(kpi.value)}</div>
      <Delta kpi={kpi} />
    </div>
  )
}

function Delta({ kpi }: { kpi: Kpi }) {
  if (kpi.prev == null || kpi.prev === 0) return <div className="k-delta flat">no prior period</div>
  const pct = ((kpi.value - kpi.prev) / kpi.prev) * 100
  const up = pct >= 0
  return (
    <div className={`k-delta ${up ? 'pos' : 'neg'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}% vs prev
    </div>
  )
}
