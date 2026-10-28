'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

async function acceptInvitedMembership(token, user) {
  // The existing server RPC validates the invitation. Never grant access from
  // URL parameters, profile account_type, or user-controlled metadata.
  const { data: childId, error: inviteError } = await supabase.rpc('accept_invite', {
    _token: token.trim()
  })
  if (inviteError) throw inviteError
  if (!childId) throw new Error('The invitation could not be accepted.')

  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('role')
    .eq('child_id', childId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError || !membership) {
    throw new Error('We could not verify your student team membership. Please contact the person who invited you.')
  }

  // Profile completion is convenience, not authorization: roles and
  // permissions remain derived from the verified memberships table.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name, account_type')
    .eq('id', user.id)
    .maybeSingle()

  if (!profileError && profile) {
    const patch = {}
    if (!profile.display_name?.trim()) {
      const suggestedName = String(user.user_metadata?.full_name || user.user_metadata?.name || 'Team member').trim()
      patch.display_name = suggestedName.slice(0, 80)
    }
    if (!profile.account_type) patch.account_type = membership.role
    if (Object.keys(patch).length) {
      // If updating an existing profile is denied, the normal profile setup
      // page remains available; the invitation has still been accepted.
      await supabase.from('profiles').update(patch).eq('id', user.id)
    }
  }
  return childId
}

export default function InviteAutoJoin({ session, token, onJoined, onSkip }) {
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const pending = useRef(null)

  useEffect(() => {
    let active = true
    if (!pending.current || pending.current.token !== token || pending.current.retry !== retry) {
      pending.current = {
        token, retry,
        promise: acceptInvitedMembership(token, session.user)
      }
    }
    pending.current.promise.then(childId => {
      if (active) onJoined(childId)
    }).catch(problem => {
      if (active) setError(problem.message || 'We could not accept this invitation.')
    })
    return () => { active = false }
  }, [token, retry, session.user.id, onJoined])

  return (
    <main>
      <div className="card step-invite-state">
        <img src="/icon-512.png" alt="StepTrack" width="78" height="78" />
        <h2>{error ? 'Unable to join this team' : 'Connecting you to your student team…'}</h2>
        {error ? (
          <>
            <p className="err" role="alert">{error}</p>
            <p className="sm">Make sure you are signed in using the exact address that received the invitation. The invitation may also have expired or already been used.</p>
            <button className="btn" onClick={() => { setError(''); setRetry(value => value + 1) }}>Try again</button>
            <button className="btn g" onClick={onSkip}>Go to my account</button>
            <button className="btn g" onClick={() => supabase.auth.signOut()}>Sign in with a different email</button>
          </>
        ) : <p className="sm">Checking your invitation and confirming access. You should not need to create another profile.</p>}
      </div>
    </main>
  )
}
