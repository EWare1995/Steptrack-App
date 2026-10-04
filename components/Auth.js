'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState(''), [pw, setPw] = useState('')
  const [mode, setMode] = useState('in'), [msg, setMsg] = useState('')
  async function go(e) {
    e.preventDefault(); setMsg('')
    const r = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password: pw })
      : await supabase.auth.signUp({ email, password: pw })
    if (r.error) setMsg(r.error.message)
    else if (mode === 'up' && !r.data.session) setMsg('Check your email to confirm your account, then sign in.')
  }
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
  <img
    src="/icon-512.png"
    alt="StepTrack logo"
    style={{
      width: '130px',
      height: '130px',
      objectFit: 'contain',
      borderRadius: '20px'
    }}
  />
</div>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
  <h1 style={{ marginBottom: '8px' }}>StepTrack</h1>
  <p className="sm" style={{ margin: 0 }}>
    Track therapy goals and behavior, and share progress with school and therapists.
  </p>
</div>
      <form className="card" onSubmit={go}>
        <h2>{mode === 'in' ? 'Sign in' : 'Create account'}</h2>
        <label>Email</label>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        <label>Password (8+ characters)</label>
        <input type="password" required minLength={8} value={pw} onChange={e => setPw(e.target.value)} />
        <button className="btn" type="submit">{mode === 'in' ? 'Sign in' : 'Sign up'}</button>{' '}
        <button className="btn g" type="button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Need an account?' : 'Have an account?'}
        </button>
        {msg && <p className="sm">{msg}</p>}
      </form>
      <p className="sm">Use first names or initials only. Not a medical record.</p>
    </div>
  )
}
