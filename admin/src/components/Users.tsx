import { useEffect, useState } from 'react'
import { fetchUsers } from '../api'
import type { UserRow, UsersResponse } from '../types'

function fmtDate(ms: number | null) {
  if (ms == null) return '—'
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
function fmtAgo(ms: number | null) {
  if (ms == null) return '—'
  const days = Math.floor((Date.now() - ms) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return fmtDate(ms)
}
function subClass(row: UserRow) {
  if (row.disabled) return 'off'
  const s = row.subscription.toLowerCase()
  if (s === 'free') return 'free'
  if (s.includes('trial')) return 'trial'
  return 'paid'
}

export function Users() {
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      setData(await fetchUsers(500))
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="page">
      <div className="page-head">
        <h1>Users {data ? <span className="muted" style={{ fontWeight: 600, fontSize: '1rem' }}>· {data.count}</span> : null}</h1>
        <div className="controls">
          <button className="btn" onClick={load} disabled={loading}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {err ? (
        <div className="center">
          <div className="errbox">
            <h2>Couldn't load users</h2>
            <p className="muted">
              <code>{err}</code>
            </p>
          </div>
        </div>
      ) : !data ? (
        <div className="center">
          <div>
            <div className="spinner" />
            <div className="muted">Loading users…</div>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Signed up</th>
                <th>Last active</th>
                <th>Subscription</th>
                <th style={{ textAlign: 'right' }}>MRR</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.uid}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.displayName || r.email || r.uid.slice(0, 8)}</div>
                    {r.email && r.displayName ? <div className="muted" style={{ fontSize: '0.78rem' }}>{r.email}</div> : null}
                  </td>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td>{fmtAgo(r.lastActive)}</td>
                  <td>
                    <span className={`pill ${subClass(r)}`}>{r.disabled ? 'Disabled' : r.subscription}</span>
                  </td>
                  <td className="num">{r.mrr ? '$' + r.mrr.toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
