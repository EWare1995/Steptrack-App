'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Auth from '../components/Auth'
import Main from '../components/Main'
import ProfileSetup from '../components/ProfileSetup'
import InviteAutoJoin from '../components/InviteAutoJoin'

export default function Page() {
  const [session, setSession] = useState(undefined)
  const [profileComplete, setProfileComplete] = useState(undefined)
  const [profileError, setProfileError] = useState('')
  const [inviteToken, setInviteToken] = useState(undefined)
  const [invitedChildId, setInvitedChildId] = useState(null)

  const checkProfile = useCallback(async currentSession => {
    if (!currentSession) {
      setProfileComplete(undefined)
      return
    }
    setProfileError('')
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, account_type')
      .eq('id', currentSession.user.id)
      .maybeSingle()
    if (error) {
      setProfileError(error.message)
      setProfileComplete(undefined)
      return
    }
    setProfileComplete(Boolean(data?.display_name?.trim()) && Boolean(data?.account_type))
  }, [])

  useEffect(() => {
    setInviteToken(new URLSearchParams(window.location.search).get('invite'))
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) checkProfile(data.session)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession) checkProfile(nextSession)
      else {
        setProfileComplete(undefined)
        setInvitedChildId(null)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [checkProfile])

  const finishInvite = useCallback(async childId => {
    // Remove bearer token from browser history after successful redemption.
    window.history.replaceState({}, '', window.location.pathname)
    setInvitedChildId(childId)
    setInviteToken(null)
    const { data } = await supabase.auth.getSession()
    if (data.session) checkProfile(data.session)
  }, [checkProfile])

  const skipInvite = useCallback(() => {
    window.history.replaceState({}, '', window.location.pathname)
    setInviteToken(null)
  }, [])

  if (session === undefined || inviteToken === undefined) return <main><p className="sm">Loading...</p></main>
  if (!session) return <main><Auth inviteToken={inviteToken} /></main>

  // Invited accounts can accept their verified membership before a profile has
  // been completed, eliminating the separate join/profile steps.
  if (inviteToken) {
    return <InviteAutoJoin session={session} token={inviteToken} onJoined={finishInvite} onSkip={skipInvite} />
  }

  if (profileError) return <main><p className="sm">Unable to load profile: {profileError}</p></main>
  if (profileComplete === undefined) return <main><p className="sm">Loading profile...</p></main>
  if (!profileComplete) {
    return <ProfileSetup session={session} onComplete={() => setProfileComplete(true)} />
  }

  return <main><Main session={session} initialChildId={invitedChildId} /></main>
}
