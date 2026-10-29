'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import StoTrialEntryPanel from '../../components/StoTrialEntryPanel'

const url = process.env.NEXT_PUBLIC_STO_TEST_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_STO_TEST_SUPABASE_KEY

export default function StoIntegrationTest() {
  const client = useMemo(() => url && key ? createClient(url, key, {
    auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
  }) : null, [])
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [children, setChildren] = useState([])
  const [childId, setChildId] = useState('')
  const [stos, setStos] = useState([])
  const [entries, setEntries] = useState([])

  useEffect(() => {
    if (!client) return
    client.auth.getUser().then(({ data, error }) => {
      if (error && error.name !== 'AuthSessionMissingError') setNotice(error.message)
      setUser(data?.user || null)
    })
    const { data } = client.auth.onAuthStateChange((_event, session) => setUser(session?.user || null))
    return () => data.subscription.unsubscribe()
  }, [client])

  async function reload() {
    if (!client || !user) return
    const { data: kids, error: kidError } = await client.from('children').select('id,name').order('name')
    if (kidError) { setNotice(kidError.message); return }
    setChildren(kids || [])
    const chosen = kids?.find(k => k.id === childId)?.id || kids?.[0]?.id || ''
    setChildId(chosen)
    if (!chosen) { setStos([]); setEntries([]); return }
    const { data: goals, error: goalError } = await client.from('goals').select('id').eq('child_id', chosen)
    if (goalError) { setNotice(goalError.message); return }
    const ids = goals?.map(g => g.id) || []
    const objectives = ids.length ? await client.from('sto_objectives').select('*').in('goal_id', ids) : { data: [] }
    const logs = await client.from('sto_trial_entries').select('*').eq('child_id', chosen).order('logged_on')
    if (objectives.error || logs.error) { setNotice(objectives.error?.message || logs.error?.message); return }
    setStos(objectives.data || [])
    setEntries(logs.data || [])
    setNotice('Loaded saved entries from the isolated database.')
  }
  useEffect(() => { if (user) reload(); else { setChildren([]); setStos([]); setEntries([]) } }, [user])

  async function signIn() {
    if (!email.trim() || !client) return
    setBusy(true); setNotice('')
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + '/sto-integration-test' }
    })
    setNotice(error ? error.message : 'Check your email for a StepTrack test-project sign-in link. This is not the production login.')
    setBusy(false)
  }

  async function makeSyntheticStudent() {
    setBusy(true); setNotice('')
    const id = crypto.randomUUID()
    const goalId = crypto.randomUUID()
    const name = 'Synthetic STO Test ' + id.slice(0, 6)
    try {
      const steps = [
        ['child', () => client.from('children').insert({ id, name, owner_id: user.id })],
        ['initial parent membership', () => client.from('memberships').insert({ child_id: id, user_id: user.id, role: 'parent', can_edit_goals: true, can_log: true })],
        ['annual goal', () => client.from('goals').insert({ id: goalId, child_id: id, title: 'Synthetic parent goal' })],
        ['STO', () => client.from('sto_objectives').insert({
          goal_id: goalId, title: '3/5 opportunities across 8 separate trial days',
          measurement_type: 'trials', target: 3, target_total_trials: 5, qualifying_days: 8
        })]
      ]
      for (const [label, action] of steps) {
        const result = await action()
        if (result.error) throw new Error(label + ': ' + result.error.message)
      }
      setChildId(id)
      await reload()
      setNotice('Created a synthetic student and STO. No production data was used.')
    } catch (error) { setNotice(error.message) }
    setBusy(false)
  }

  async function saveEntry(row, goalId) {
    const { error } = await client.from('sto_trial_entries').insert({
      ...row, child_id: childId, goal_id: goalId, logged_by: user.id
    })
    if (error) { setNotice(error.message); return false }
    await reload()
    return true
  }

  return <main style={{ maxWidth: 760, margin: '24px auto', padding: '0 16px', fontFamily: 'system-ui,sans-serif' }}>
    <header style={{ borderBottom: '1px solid #ddd', paddingBottom: 12, marginBottom: 16 }}>
      <h1>StepTrack · isolated STO persistence test</h1>
      <p>This screen uses only the separate synthetic Supabase test project. It does not access the production StepTrack database.</p>
    </header>
    {!client ? <p role="alert">Test environment variables are missing; testing is unavailable.</p>
      : !user ? <section>
        <h2>Sign in to the testing environment</h2>
        <label>Email address<input style={{ display: 'block', width: '100%', padding: 10, margin: '8px 0' }} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <button disabled={busy} onClick={signIn}>Email test sign-in link</button>
        <p>No existing StepTrack account is needed for this isolated project.</p>
      </section> : <>
        <p>Signed in as {user.email} <button onClick={() => client.auth.signOut()}>Sign out</button></p>
        <button disabled={busy} onClick={makeSyntheticStudent}>Create synthetic student + 3/5 STO</button>{' '}
        <button onClick={reload}>Reload saved data</button>
        {children.length > 0 && <div style={{ margin: '14px 0' }}><label>Test student <select value={childId} onChange={e => setChildId(e.target.value)}>
          {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>}
        {stos.filter(s => children.some(c => c.id === childId)).map(sto =>
          <section key={sto.id} style={{ border: '1px solid #d6e0ed', borderRadius: 12, padding: 16, margin: '16px 0' }}>
            <h2>{sto.title}</h2>
            <StoTrialEntryPanel sto={sto} entries={entries.filter(e => e.sto_id === sto.id)}
              onSave={row => saveEntry(row, sto.goal_id)} />
          </section>
        )}
      </>}
    {notice && <p role="status" style={{ color: '#154c77', background: '#edf5ff', padding: 12, borderRadius: 8 }}>{notice}</p>}
    <footer style={{ marginTop: 30, fontSize: 12, color: '#666' }}>Development test only. Do not enter real student information.</footer>
  </main>
}
