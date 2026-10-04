'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Auth from '../components/Auth'
import Main from '../components/Main'
import ProfileSetup from '../components/ProfileSetup'

export default function Page() {
  const [session, setSession] = useState(undefined)
  const [profileComplete, setProfileComplete] = useState(undefined)
  const [profileError, setProfileError] = useState('')

  async function checkProfile(currentSession) {
    if (!currentSession) {
      setProfileComplete(undefined)
      return
    }

    setProfileComplete(undefined)
    setProfileError('')

    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, account_type')
      .eq('id', currentSession.user.id)
      .single()

    if (error) {
      setProfileError(error.message)
      return
    }

    const complete =
      Boolean(data?.display_name?.trim()) &&
      Boolean(data?.account_type)

    setProfileComplete(complete)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const currentSession = data.session
      setSession(currentSession)

      if (currentSession) {
        checkProfile(currentSession)
      }
    })

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)

      if (newSession) {
        checkProfile(newSession)
      } else {
        setProfileComplete(undefined)
      }
    })

    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <main>
        <p className="sm">Loading...</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main>
        <Auth />
      </main>
    )
  }

  if (profileError) {
    return (
      <main>
        <p className="sm">Unable to load profile: {profileError}</p>
      </main>
    )
  }

  if (profileComplete === undefined) {
    return (
      <main>
        <p className="sm">Loading profile...</p>
      </main>
    )
  }

  if (!profileComplete) {
    return (
      <ProfileSetup
        session={session}
        onComplete={() => setProfileComplete(true)}
      />
    )
  }

  return (
    <main>
      <Main session={session} />
    </main>
  )
}