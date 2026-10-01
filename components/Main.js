'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AREAS = ['Fine motor', 'Gross motor', 'Speech', 'Self-care', 'Social', 'Behavior']
const PL = ['Independent', 'Gesture', 'Verbal', 'Physical']
const WH = ['Home', 'School', 'Therapy', 'Respite']
const loc = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
const today = () => loc(new Date())
const ago = n => loc(new Date(Date.now() - n * 864e5))
const cl = x => Math.max(0, Math.min(100, Math.round(x * 100)))
const met = (g, v) => (g.direction === 'down' ? v <= g.target : v >= g.target)
const gv = (g, logs) => logs.filter(l => l.goal_id === g.id)
  .sort((a, b) => a.logged_on.localeCompare(b.logged_on) || a.created_at.localeCompare(b.created_at))
function status(g, v) {
  if (!v.length) return 'No data'
  const l = v.slice(-g.mastery_count)
  if (l.length >= g.mastery_count && l.every(x => met(g, x.value))) return 'Mastered'
  return met(g, v[v.length - 1].value) ? 'At target' : 'In progress'
}
function pct(g, v) {
  if (!v.length) return 0
  const l = v[v.length - 1].value
  if (g.direction === 'down') {
    const b = g.baseline ?? Math.max(v[0].value, g.target * 2)
    return cl((b - l) / ((b - g.target) || 1))
  }
  const b = g.baseline ?? 0
  return cl((l - b) / ((g.target - b) || 1))
}
function Spark({ g, v }) {
  const n = v.slice(-14).map(l => l.value)
  if (n.length < 2) return <div className="sm">Log 2+ entries to see a trend.</div>
  const mx = Math.max(g.target, ...n) || 1, y = k => 54 - (k / mx) * 48, x = i => 4 + i * (292 / (n.length - 1))
  return (
    <svg viewBox="0 0 300 60" role="img" aria-label="trend">
      <line x1="0" x2="300" y1={y(g.target)} y2={y(g.target)} stroke="var(--mu)" strokeDasharray="4 4" />
      <polyline fill="none" stroke="var(--ac)" strokeWidth="2.5" points={n.map((k, i) => `${x(i)},${y(k)}`).join(' ')} />
    </svg>
  )
}
const Opts = ({ a }) => a.map(x => <option key={x}>{x}</option>)

function GoalCard({ g, logs, names, uid, parent, canEdit, onEdit, onLog, onDelLog, onDelGoal }) {
  const v = gv(g, logs), r = v.slice(-5), last = v[v.length - 1]
  const ind = r.filter(x => x.prompt_level === 'Independent').length
  const [f, setF] = useState({ value: '', date: today(), p: 'Independent', w: 'Home', n: '' }), [c, setC] = useState(false), [ed, setEd] = useState(null)
  const se = k => e => setEd({ ...ed, [k]: e.target.value })
  const set = k => e => setF({ ...f, [k]: e.target.value })
  return (
    <div className="card">
      <div className="row"><h2 style={{ flex: 3 }}>{g.title}</h2><span className="tag" style={{ flex: '0 0 auto' }}>{g.area}</span></div>
      <span className="tag">{status(g, v)}</span>{' '}
      <span className="sm">{last ? `Latest ${last.value} · target ${g.direction === 'down' ? '≤' : '≥'}${g.target} ${g.unit}` : 'No data yet'}</span>
      <div className="bar"><i style={{ width: pct(g, v) + '%' }} /></div>
      <Spark g={g} v={v} />
      {g.supports && <div className="sm"><b>Supports that help:</b> {g.supports}</div>}
      {r.length > 0 && <div className="sm">Independent in {ind} of last {r.length} entries</div>}
      <div style={{ marginTop: 10 }}>
        <div className="row">
          <div><label>Result</label><input type="number" value={f.value} onChange={set('value')} style={{ marginBottom: 0 }} /></div>
          <div><label>Date</label><input type="date" value={f.date} onChange={set('date')} style={{ marginBottom: 0 }} /></div>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <div><label>Support level</label><select value={f.p} onChange={set('p')} style={{ marginBottom: 0 }}><Opts a={PL} /></select></div>
          <div><label>Where</label><select value={f.w} onChange={set('w')} style={{ marginBottom: 0 }}><Opts a={WH} /></select></div>
        </div>
        <input placeholder="Note: what helped?" value={f.n} onChange={set('n')} style={{ marginTop: 8 }} />
        <button className="btn" onClick={async () => {
          if (f.value === '') return
          await onLog({ goal_id: g.id, value: +f.value, logged_on: f.date || today(), prompt_level: f.p, setting: f.w, note: f.n.trim() })
          setF({ ...f, value: '', n: '' })
        }}>Log</button>
      </div>
      {v.slice(-3).reverse().map(x => (
        <div className="sm" key={x.id}>
          {x.logged_on} · {x.value} · {x.prompt_level} · {x.setting} · {names[x.logged_by] || 'Member'}{x.note ? ' · ' + x.note : ''}{' '}
          {(x.logged_by === uid || parent) && <button className="x" onClick={() => onDelLog(x.id)}>remove</button>}
        </div>
      ))}
      {canEdit && !ed && <div style={{ marginTop: 8 }}>
        <button className="btn g" onClick={() => setEd({ title: g.title, target: g.target, baseline: g.baseline ?? '', unit: g.unit, mastery: g.mastery_count, supports: g.supports })}>Edit goal</button>
      </div>}
      {ed && <div style={{ marginTop: 8 }}>
        <label>Goal</label><input value={ed.title} onChange={se('title')} />
        <div className="row">
          <div><label>Target</label><input type="number" value={ed.target} onChange={se('target')} /></div>
          <div><label>Baseline</label><input type="number" value={ed.baseline} onChange={se('baseline')} /></div>
        </div>
        <div className="row">
          <div><label>Measured in</label><input value={ed.unit} onChange={se('unit')} /></div>
          <div><label>Mastered after N in a row</label><input type="number" min="1" value={ed.mastery} onChange={se('mastery')} /></div>
        </div>
        <label>Supports that help</label><input value={ed.supports} onChange={se('supports')} />
        <button className="btn" onClick={async () => {
          if (!ed.title.trim() || ed.target === '') return
          await onEdit(g.id, { title: ed.title.trim(), target: +ed.target, baseline: ed.baseline === '' ? null : +ed.baseline, unit: ed.unit.trim() || 'reps', mastery_count: Math.max(1, +ed.mastery || 3), supports: ed.supports.trim() })
          setEd(null)
        }}>Save changes</button>{' '}
        <button className="btn g" onClick={() => setEd(null)}>Cancel</button>
      </div>}
      {parent && <div style={{ marginTop: 8 }}>
        <button className="btn g" onClick={() => { if (c) onDelGoal(g.id); else setC(true) }}>{c ? 'Tap again to delete goal' : 'Delete goal'}</button>
      </div>}
    </div>
  )
}

function AddGoal({ onAdd }) {
  const [f, setF] = useState({ title: '', area: AREAS[0], direction: 'up', target: '', baseline: '', unit: '', mastery: 3, supports: '' })
  const set = k => e => setF({ ...f, [k]: e.target.value })
  return (
    <div className="card">
      <h2>Add a goal</h2>
      <label>Goal (specific and observable)</label>
      <input value={f.title} onChange={set('title')} placeholder="Stacks 6 blocks without help" />
      <div className="row">
        <div><label>Area</label><select value={f.area} onChange={set('area')}><Opts a={AREAS} /></select></div>
        <div><label>Direction</label><select value={f.direction} onChange={set('direction')}><option value="up">Increase to target</option><option value="down">Reduce to target</option></select></div>
      </div>
      <div className="row">
        <div><label>Target</label><input type="number" value={f.target} onChange={set('target')} /></div>
        <div><label>Baseline (optional)</label><input type="number" value={f.baseline} onChange={set('baseline')} /></div>
      </div>
      <div className="row">
        <div><label>Measured in</label><input value={f.unit} onChange={set('unit')} placeholder="blocks, minutes, incidents" /></div>
        <div><label>Mastered after N in a row</label><input type="number" min="1" value={f.mastery} onChange={set('mastery')} /></div>
      </div>
      <label>Supports that help (shared with school and therapists)</label>
      <input value={f.supports} onChange={set('supports')} placeholder="Visual schedule, hand-over-hand at first" />
      <button className="btn" onClick={async () => {
        if (!f.title.trim() || !f.target) return
        await onAdd({ title: f.title.trim(), area: f.area, direction: f.direction, target: +f.target, baseline: f.baseline === '' ? null : +f.baseline, unit: f.unit.trim() || 'reps', mastery_count: Math.max(1, +f.mastery || 3), supports: f.supports.trim() })
        setF({ ...f, title: '', target: '', baseline: '', supports: '' })
      }}>Add goal</button>
    </div>
  )
}

function Behavior({ beh, names, uid, parent, onAdd, onDel }) {
  const [f, setF] = useState({ a: '', b: '', i: 'Mild', m: '', w: 'Home', c: '' })
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const n7 = beh.filter(e => e.logged_on >= ago(7)).length
  return (
    <>
      <div className="card">
        <h2>Behavior log</h2><div className="sm">{n7} logged in the last 7 days</div>
        <label>Before (trigger or setting)</label><input value={f.a} onChange={set('a')} placeholder="Transition, loud noise" />
        <label>Behavior</label><input value={f.b} onChange={set('b')} placeholder="Meltdown, hitting, refusal" />
        <div className="row">
          <div><label>Intensity</label><select value={f.i} onChange={set('i')}><Opts a={['Mild', 'Moderate', 'Severe']} /></select></div>
          <div><label>Minutes</label><input type="number" value={f.m} onChange={set('m')} /></div>
          <div><label>Where</label><select value={f.w} onChange={set('w')}><Opts a={WH} /></select></div>
        </div>
        <label>After / what helped</label><input value={f.c} onChange={set('c')} placeholder="Headphones and quiet corner" />
        <button className="btn" onClick={async () => {
          if (!f.b.trim()) return
          await onAdd({ antecedent: f.a.trim(), behavior: f.b.trim(), consequence: f.c.trim(), intensity: f.i, minutes: f.m === '' ? null : +f.m, setting: f.w })
          setF({ ...f, a: '', b: '', c: '', m: '' })
        }}>Save entry</button>
      </div>
      {beh.slice().reverse().slice(0, 20).map(e => (
        <div className="card" key={e.id}>
          <div className="sm">{e.logged_on} · {e.intensity}{e.minutes ? ` · ${e.minutes} min` : ''} · {e.setting} · {names[e.logged_by] || 'Member'}{' '}
            {(e.logged_by === uid || parent) && <button className="x" onClick={() => onDel(e.id)}>remove</button>}</div>
          <b>Before:</b> {e.antecedent}<br /><b>Behavior:</b> {e.behavior}<br /><b>After / helped:</b> {e.consequence}
        </div>
      ))}
    </>
  )
}

function Report({ kid, goals, logs, beh }) {
  const R = goals.map(g => {
    const v = gv(g, logs), r = v.slice(-5)
    const a = r.length ? (r.reduce((s, x) => s + x.value, 0) / r.length).toFixed(1) : '-'
    const ind = r.length ? Math.round(r.filter(x => x.prompt_level === 'Independent').length / r.length * 100) + '%' : '-'
    return { g, l: v.length ? v[v.length - 1].value : '-', a, ind, st: status(g, v), n: v.length }
  })
  const b30 = beh.filter(e => e.logged_on >= ago(30)), b5 = beh.slice(-5)
  const txt = `Progress report: ${kid.name} (${today()})\n\n` +
    (R.map(r => `${r.g.title} [${r.g.area}] target ${r.g.direction === 'down' ? '<=' : '>='}${r.g.target} ${r.g.unit}; latest ${r.l}; avg last 5 ${r.a}; independent ${r.ind}; ${r.st}${r.g.supports ? '; supports: ' + r.g.supports : ''}`).join('\n') || 'No goals') +
    `\n\nBehavior: ${b30.length} logged in 30 days\n` + b5.map(e => `${e.logged_on} ${e.intensity}: ${e.antecedent} -> ${e.behavior} -> ${e.consequence}`).join('\n')
  return (
    <div className="card">
      <h2>Progress report: {kid.name}</h2><div className="sm">{today()} · for IEP meetings and therapy sessions</div>
      <div className="w"><table><thead><tr><th>Goal</th><th>Target</th><th>Latest</th><th>Avg 5</th><th>Indep.</th><th>Status</th></tr></thead><tbody>
        {R.map(r => <tr key={r.g.id}><td>{r.g.title}<div className="sm">{r.g.area} · {r.n} {r.n === 1 ? 'entry' : 'entries'}</div></td><td>{r.g.direction === 'down' ? '≤' : '≥'}{r.g.target} {r.g.unit}</td><td>{r.l}</td><td>{r.a}</td><td>{r.ind}</td><td>{r.st}</td></tr>)}
      </tbody></table></div>
      <p><b>Behavior:</b> {b30.length} logged in the last 30 days.</p>
      {b5.map(e => <div className="sm" key={e.id}>{e.logged_on} · {e.intensity}: {e.antecedent} → {e.behavior} → {e.consequence}</div>)}
      <div className="np" style={{ marginTop: 10 }}>
        <button className="btn" onClick={() => navigator.clipboard?.writeText(txt)}>Copy as text</button>{' '}
        <button className="btn g" onClick={() => window.print()}>Print</button>
      </div>
    </div>
  )
}

function Join({ onDone }) {
  const [t, setT] = useState(''), [m, setM] = useState('')
  return (
    <div className="card">
      <h2>Join with an invite code</h2>
      <div className="sm">Sign in with the same email address the invite was sent to.</div>
      <input value={t} onChange={e => setT(e.target.value)} placeholder="Paste invite code" />
      <button className="btn" onClick={async () => {
        const r = await supabase.rpc('accept_invite', { _token: t.trim() })
        if (r.error) setM(r.error.message); else { setT(''); setM(''); onDone(r.data) }
      }}>Join</button>
      {m && <div className="err">{m}</div>}
    </div>
  )
}

function Team({ team, names, uid, parent, cid, kid, onRevoke, onName, onDeleteChild, onJoin }) {
  const [em, setEm] = useState(''), [role, setRole] = useState('teacher'), [code, setCode] = useState(''), [msg, setMsg] = useState('')
  const [nm, setNm] = useState(names[uid] || ''), [c, setC] = useState(false)
  return (
    <>
      <div className="card">
        <h2>Your display name</h2>
        <input value={nm} onChange={e => setNm(e.target.value)} placeholder="e.g. Ms. Lee (teacher)" />
        <button className="btn g" onClick={() => onName(nm.trim())}>Save name</button>
      </div>
      <div className="card">
        <h2>Who can see {kid.name}'s data</h2>
        {team.map(m => (
          <div className="row" key={m.id} style={{ alignItems: 'center', marginBottom: 6 }}>
            <div>{names[m.user_id] || 'Member'} <span className="tag">{m.role}</span>{m.user_id === uid ? ' (you)' : ''}</div>
            {parent && m.user_id !== uid && <button className="x" style={{ flex: '0 0 auto' }} onClick={() => onRevoke(m.id)}>remove access</button>}
          </div>
        ))}
        {!parent && <div className="sm">Only parents can see the full list and manage access.</div>}
      </div>
      {parent && (
        <div className="card">
          <h2>Invite someone</h2>
          <div className="sm">They must sign in with this exact email to accept. Codes expire in 7 days.</div>
          <label>Email</label><input type="email" value={em} onChange={e => setEm(e.target.value)} />
          <label>Role</label><select value={role} onChange={e => setRole(e.target.value)}><Opts a={['teacher', 'therapist', 'aide', 'parent']} /></select>
          <button className="btn" onClick={async () => {
            setMsg(''); setCode('')
            const r = await supabase.rpc('create_invite', { _child: cid, _email: em.trim(), _role: role })
            if (r.error) setMsg(r.error.message); else { setCode(r.data); setEm('') }
          }}>Create invite code</button>
          {code && <><p className="sm">Send this code to them privately. It is shown only once:</p><input readOnly value={code} onFocus={e => e.target.select()} /></>}
          {msg && <div className="err">{msg}</div>}
        </div>
      )}
      <Join onDone={onJoin} />
      {parent && <button className="btn g" onClick={() => { if (c) onDeleteChild(); else setC(true) }}>{c ? `Tap again to delete ${kid.name} and all data` : 'Delete this child'}</button>}
    </>
  )
}

export default function Main({ session }) {
  const uid = session.user.id
  const [kids, setKids] = useState([]), [cid, setCid] = useState(null), [tab, setTab] = useState('goals'), [err, setErr] = useState('')
  const [d, setD] = useState({ goals: [], logs: [], beh: [], team: [], names: {} }), [nk, setNk] = useState('')
  const chk = r => { if (r.error) { setErr(r.error.message); return [] } return r.data || [] }

  const loadKids = useCallback(async () => {
    const k = chk(await supabase.from('children').select('*').order('created_at'))
    setKids(k); setCid(c => (k.find(x => x.id === c) ? c : k[0]?.id || null))
  }, [])
  useEffect(() => { loadKids() }, [loadKids])

  const load = useCallback(async () => {
    if (!cid) { setD({ goals: [], logs: [], beh: [], team: [], names: {} }); return }
    const [g, l, b, t, p] = await Promise.all([
      supabase.from('goals').select('*').eq('child_id', cid).eq('archived', false).order('created_at'),
      supabase.from('logs').select('*').eq('child_id', cid),
      supabase.from('behavior_entries').select('*').eq('child_id', cid).order('logged_on'),
      supabase.from('memberships').select('*').eq('child_id', cid),
      supabase.from('profiles').select('id,display_name')])
    setD({ goals: chk(g), logs: chk(l), beh: chk(b), team: chk(t), names: Object.fromEntries(chk(p).map(x => [x.id, x.display_name])) })
  }, [cid])
  useEffect(() => { load() }, [load])

  const run = async (p, after = load) => { const r = await p; if (r.error) { setErr(r.error.message); return } setErr(''); await after() }
  const kid = kids.find(k => k.id === cid), me = d.team.find(m => m.user_id === uid), parent = me?.role === 'parent'
  const canGoals = !!me?.can_edit_goals
  const joined = async id => { await loadKids(); setCid(id) }

  async function addKid() {
    if (!nk.trim()) return
    const r = await supabase.from('children').insert({ name: nk.trim() }).select().single()
    if (r.error) return setErr(r.error.message)
    setNk(''); setErr(''); await loadKids(); setCid(r.data.id); setTab('goals')
  }

  return (
    <div>
      <div className="row" style={{ alignItems: 'center' }}>
        <h1>StepTrack</h1>
        <button className="x" style={{ flex: '0 0 auto' }} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
      {err && <div className="err">{err}</div>}
      {!kid ? (
        <>
          <div className="card">
            <h2>Add your first child</h2>
            <label>First name or initials only</label>
            <input value={nk} onChange={e => setNk(e.target.value)} />
            <button className="btn" onClick={addKid}>Add child</button>
          </div>
          <Join onDone={joined} />
        </>
      ) : (
        <>
          <div className="row">
            <div><label>Child</label>
              <select value={cid} onChange={e => setCid(e.target.value)}>{kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</select>
            </div>
            <div><label>Add another child</label>
              <div className="row"><input value={nk} onChange={e => setNk(e.target.value)} placeholder="Name" /><button className="btn g" style={{ flex: '0 0 auto', marginBottom: 8 }} onClick={addKid}>Add</button></div>
            </div>
          </div>
          <nav>{[['goals', 'Goals'], ['beh', 'Behavior'], ['rep', 'Report'], ['team', 'Team']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</nav>
          {tab === 'goals' && <>
            {d.goals.map(g => <GoalCard key={g.id} g={g} logs={d.logs} names={d.names} uid={uid} parent={parent} canEdit={canGoals}
              onEdit={(id, patch) => run(supabase.from('goals').update(patch).eq('id', id))}
              onLog={row => run(supabase.from('logs').insert({ ...row, child_id: cid }))}
              onDelLog={id => run(supabase.from('logs').delete().eq('id', id))}
              onDelGoal={id => run(supabase.from('goals').delete().eq('id', id))} />)}
            {canGoals ? <AddGoal onAdd={row => run(supabase.from('goals').insert({ ...row, child_id: cid }))} />
              : <p className="sm">Your role can log results but not create goals. Ask a parent or therapist to add goals.</p>}
          </>}
          {tab === 'beh' && <Behavior beh={d.beh} names={d.names} uid={uid} parent={parent}
            onAdd={row => run(supabase.from('behavior_entries').insert({ ...row, child_id: cid }))}
            onDel={id => run(supabase.from('behavior_entries').delete().eq('id', id))} />}
          {tab === 'rep' && <Report kid={kid} goals={d.goals} logs={d.logs} beh={d.beh} />}
          {tab === 'team' && <Team team={d.team} names={d.names} uid={uid} parent={parent} cid={cid} kid={kid} onJoin={joined}
            onRevoke={id => run(supabase.from('memberships').delete().eq('id', id))}
            onName={n => run(supabase.from('profiles').update({ display_name: n }).eq('id', uid))}
            onDeleteChild={() => run(supabase.from('children').delete().eq('id', cid), loadKids)} />}
        </>
      )}
      <p className="sm np">Use first names or initials only. Not a medical record.</p>
    </div>
  )
}
