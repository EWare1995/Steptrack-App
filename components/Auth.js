'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth({ inviteToken }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState(inviteToken ? 'magic' : 'in')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'magic') {
        // Preserve the exact invitation token across the email round-trip.
        const redirect = new URL('/', window.location.origin)
        if (inviteToken) redirect.searchParams.set('invite', inviteToken)
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            shouldCreateUser: true,
            emailRedirectTo: redirect.toString()
          }
        })
        if (error) throw error
        setSent(true)
        setMessage('Check your inbox for a StepTrack sign-in link. Opening it verifies your email and continues your invitation.')
      } else {
        const result = mode === 'in'
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({ email: email.trim(), password })
        if (result.error) throw result.error
        if (mode === 'up' && !result.data.session) {
          setMessage('Check your email to confirm your account, then return to sign in.')
        }
      }
    } catch (error) {
      setMessage(error.message || 'Unable to sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="step-auth">
      <div className="step-auth-brand">
        <img src="/icon-512.png" alt="StepTrack logo" width="116" height="116" />
        <h1>StepTrack</h1>
        <p className="sm">Progress, one step at a time.</p>
      </div>
      <form className="card step-auth-card" onSubmit={submit}>
        <h2>{mode === 'magic' ? (inviteToken ? 'Join your student team' : 'Email sign in') : mode === 'in' ? 'Sign in' : 'Create account'}</h2>
        {inviteToken && <p className="sm">You have a private invitation. Verify the email address your parent or guardian invited to continue directly to the student portal.</p>}
        <label htmlFor="step-auth-email">Email address</label>
        <input id="step-auth-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy || (mode === 'magic' && sent)} />
        {mode !== 'magic' && (
          <>
            <label htmlFor="step-auth-password">Password (8+ characters)</label>
            <input id="step-auth-password" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required minLength={8} value={password} onChange={event => setPassword(event.target.value)} />
          </>
        )}
        {!(mode === 'magic' && sent) && <button className="btn" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'magic' ? 'Email me a sign-in link' : mode === 'in' ? 'Sign in' : 'Sign up'}</button>}
        {message && <p className="sm" role="status">{message}</p>}
        {mode === 'magic' && sent && <button className="btn g" type="button" onClick={() => { setSent(false); setMessage('') }}>Send another link</button>}
        <div className="step-auth-switch">
          {mode !== 'magic' && <button type="button" className="btn g" onClick={() => { setMode('magic'); setMessage(''); setSent(false) }}>Use email sign-in link</button>}
          {mode !== 'in' && <button type="button" className="btn g" onClick={() => { setMode('in'); setMessage(''); setSent(false) }}>Use my password</button>}
          {mode === 'in' && <button type="button" className="btn g" onClick={() => { setMode('up'); setMessage('') }}>Create an account</button>}
        </div>
      </form>
      <p className="sm">Use first names or initials only. Not a medical record.</p>
    </div>
  )
}
