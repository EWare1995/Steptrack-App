'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ProfileSetup({ session, onComplete }) {
  const [displayName, setDisplayName] = useState('')
  const [accountType, setAccountType] = useState('')
  const [organization, setOrganization] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function saveProfile(e) {
    e.preventDefault()
    setMsg('')

    if (!displayName.trim()) {
      setMsg('Please enter your name.')
      return
    }

    if (!accountType) {
      setMsg('Please choose an account type.')
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        account_type: accountType,
        organization: organization.trim() || null
      })
      .eq('id', session.user.id)

    setSaving(false)

    if (error) {
      setMsg(error.message)
      return
    }

    onComplete()
  }

  return (
    <main className="wrap">
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img
            src="/icon-512.png"
            alt="StepTrack logo"
            style={{
              width: '110px',
              height: '110px',
              objectFit: 'contain',
              borderRadius: '20px'
            }}
          />

          <h2 style={{ marginBottom: '6px' }}>Create your profile</h2>

          <div style={{ color: '#6b7280' }}>
            Tell StepTrack a little about you.
          </div>
        </div>

        <form onSubmit={saveProfile}>
          <label>Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />

          <label style={{ marginTop: '14px' }}>Account type</label>
          <select
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
          >
            <option value="">Choose one</option>
            <option value="parent">Parent</option>
            <option value="teacher">Teacher</option>
            <option value="therapist">Therapist</option>
            <option value="aide">Aide</option>
            <option value="other">Other</option>
          </select>

          <label style={{ marginTop: '14px' }}>
            School / Organization
          </label>
          <input
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="Optional"
          />

          {msg && (
            <div style={{ marginTop: '12px' }}>
              {msg}
            </div>
          )}

          <button
            type="submit"
            className="btn"
            disabled={saving}
            style={{ marginTop: '18px', width: '100%' }}
          >
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    </main>
  )
}