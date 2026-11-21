import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { homeFor } from '../auth/roles'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { session, profile, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session && profile) return <Navigate to={homeFor(profile.role)} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (err) setError('Email or password is not correct.')
  }

  return (
    <div className="login">
      <div className="login-intro">
        <h1>Hotel review coding</h1>
        <p className="demo" aria-label="Example: the room is old | but clean">
          <mark className="m1">The room is old</mark> <mark className="m2">but clean.</mark>
        </p>
        <p>Mark each phrase in the review. Every word belongs to exactly one phrase.</p>
      </div>
      <form className="login-form" onSubmit={submit}>
        <label>
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {session && !profile && !loading && (
          <p className="hint">You are signed in, but your account has no role yet. Ask the lead researcher.</p>
        )}
      </form>
    </div>
  )
}
