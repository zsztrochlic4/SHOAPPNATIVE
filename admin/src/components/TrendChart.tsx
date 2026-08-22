import {
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { DayPoint, SubMrrPoint } from '../types'
import { InfoTip } from './InfoTip'

const AXIS = { stroke: '#6d7565', fontSize: 11 }
const GRID = '#262a22'
const tooltipStyle = {
  background: '#050604',
  border: '1px solid #343a2e',
  borderRadius: 8,
  fontSize: 12,
  color: '#f1f3ec',
}

function shortDate(d: string) {
  return d.slice(5) // MM-DD
}

export function LineTrend({
  title,
  info,
  data,
  color,
}: {
  title: string
  info: string
  data: DayPoint[]
  color: string
}) {
  return (
    <div className="card chart-card">
      <h3>
        {title} <InfoTip text={info} />
      </h3>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={40} />
            <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={40} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#939a89' }} />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function SubMrrTrend({ title, info, data }: { title: string; info: string; data: SubMrrPoint[] }) {
  return (
    <div className="card chart-card">
      <h3>
        {title} <InfoTip text={info} />
      </h3>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={40} />
            <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={40} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#939a89' }} />
            <Bar dataKey="subscribers" fill="#2f5f2a" radius={[3, 3, 0, 0]} maxBarSize={26} />
            <Line type="monotone" dataKey="mrr" stroke="#a5e88a" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
