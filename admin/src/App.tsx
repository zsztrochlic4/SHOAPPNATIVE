import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { auth, googleProvider } from './firebase'
import { Overview } from './components/Overview'
import { Users } from './components/Users'

type Tab = 'overview' | 'users'

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setReady(true)
    })
  }, [])

  if (!ready) {
    return (
      <div className="center">
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <SignIn />

  return (
    <>
      <header className="topbar">
        <span className="brand">
          Strength<span className="accent">Hub</span>
          <span className="dot">·</span>
          <span className="light">Analytics</span>
        </span>
        <nav className="nav">
          <button className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>
            Overview
          </button>
          <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>
            Users
          </button>
        </nav>
        <span className="spacer" />
        <span className="who">
          {user.email}
          <button onClick={() => void signOut(auth)}>Sign out</button>
        </span>
      </header>
      {tab === 'overview' ? <Overview /> : <Users />}
    </>
  )
}

function SignIn() {
  const [err, setErr] = useState<string | null>(null)
  async function go() {
    setErr(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }
  return (
    <div className="signin">
      <div className="box">
        <h1>
          Strength<span style={{ color: 'var(--accent-strong)' }}>Hub</span> · Analytics
        </h1>
        <p>Owner-only admin dashboard. Sign in with the app-owner Google account.</p>
        <button className="google-btn" onClick={go}>
          Sign in with Google
        </button>
        {err ? <p style={{ color: 'var(--neg)', marginTop: '1rem', fontSize: '0.85rem' }}>{err}</p> : null}
      </div>
    </div>
  )
}
