'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Auth from '../components/Auth'
import Main from '../components/Main'

export default function Page() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <main><p className="sm">Loading…</p></main>
  return <main>{session ? <Main session={session} /> : <Auth />}</main>
}
