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
// ---- STO (short-term objective) config: one place to extend measurement types or statuses ----
const SUPPORT_LEVELS = { 1: 'Physical', 2: 'Verbal', 3: 'Gesture', 4: 'Independent' } // higher = more independent
const MT = {
  count: { label: 'Count / repetitions', unit: 'times' },
  percentage: { label: 'Percentage / accuracy', unit: '%', fixed: true },
  duration: { label: 'Duration', units: ['seconds', 'minutes', 'hours'] },
  frequency: { label: 'Frequency', units: ['times per hour', 'times per day', 'times per week'] },
  independence: { label: 'Independence / support level', unit: 'support level', fixed: true },
}
const STATUS = { not_started: 'Not started', in_progress: 'In progress', met: 'Met', discontinued: 'Discontinued' }
const stLabel = x => STATUS[x] ?? String(x)
const stoSort = (a, b) => (Number(a.sort_order ?? 1e9) - Number(b.sort_order ?? 1e9)) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
const stoFmt = (mt, v, unit) => {
  if (v == null || v === '') return '-'
  if (mt === 'independence') return SUPPORT_LEVELS[v] ?? String(v)
  if (mt === 'percentage') return v + '%'
  return v + (unit ? ' ' + unit : '')
}
const blankSto = { title: '', mt: 'count', baseline: '', target: '', unit: 'times', date: '', status: 'not_started', supports: '' }
const stoToForm = o => ({
  title: o.title ?? '', mt: o.measurement_type ?? 'count',
  baseline: o.baseline == null ? '' : String(o.baseline), target: o.target == null ? '' : String(o.target),
  unit: o.unit ?? '', date: o.target_date ? String(o.target_date).slice(0, 10) : '',
  status: o.status ?? 'not_started', supports: o.supports ?? '',
})

function StoForm({ init, submitLabel, onSave, onCancel }) {
  const [f, setF] = useState(init), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const cfg = MT[f.mt] || {}, lvl = f.mt === 'independence'
  const types = Object.keys(MT).concat(MT[f.mt] ? [] : [f.mt])
  const stats = Object.keys(STATUS).concat(STATUS[f.status] ? [] : [f.status])
  const units = cfg.units ? (cfg.units.includes(f.unit) || !f.unit ? cfg.units : [f.unit, ...cfg.units]) : []
  const changeType = e => {
    const mt = e.target.value, c = MT[mt] || {}, flip = (f.mt === 'independence') !== (mt === 'independence')
    setF({ ...f, mt, unit: c.fixed ? c.unit : c.units ? c.units[0] : (c.unit ?? f.unit), baseline: flip ? '' : f.baseline, target: flip ? '' : f.target })
  }
  const val = k => lvl
    ? <select value={f[k]} onChange={set(k)}><option value="">Select level</option>{Object.entries(SUPPORT_LEVELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    : <input type="number" step="any" value={f[k]} onChange={set(k)} />
  async function save() {
    const num = v => (v === '' ? null : Number(v))
    if (!f.title.trim()) return setMsg('Add a title.')
    if (f.target === '') return setMsg('Add a target.')
    if (f.mt === 'percentage' && [f.baseline, f.target].some(v => v !== '' && (+v < 0 || +v > 100))) return setMsg('Percentages must be between 0 and 100.')
    setMsg(''); setBusy(true)
    await onSave({ title: f.title.trim(), measurement_type: f.mt, baseline: num(f.baseline), target: num(f.target), unit: (f.unit || '').trim(), target_date: f.date || null, status: f.status, supports: f.supports.trim() })
    setBusy(false)
  }
  return (
    <div style={{ border: '1px solid var(--bd)', borderRadius: 8, padding: 10, marginTop: 8 }}>
      <label>Objective title</label>
      <input value={f.title} onChange={set('title')} placeholder="Stacks 4 blocks with a verbal prompt" />
      <div className="row">
        <div><label>Measurement type</label><select value={f.mt} onChange={changeType}>{types.map(t => <option key={t} value={t}>{MT[t] ? MT[t].label : t}</option>)}</select></div>
        <div><label>Target date</label><input type="date" value={f.date} onChange={set('date')} /></div>
      </div>
      <div className="row">
        <div><label>Baseline (optional)</label>{val('baseline')}</div>
        <div><label>Target</label>{val('target')}</div>
        {!cfg.fixed && (
          <div><label>Unit</label>
            {cfg.units ? <select value={f.unit} onChange={set('unit')}>{units.map(u => <option key={u}>{u}</option>)}</select>
              : <input value={f.unit} onChange={set('unit')} placeholder="blocks, steps, words" />}
          </div>
        )}
      </div>
      <label>Status</label>
      <select value={f.status} onChange={set('status')}>{stats.map(k => <option key={k} value={k}>{stLabel(k)}</option>)}</select>
      <label>Supports</label>
      <input value={f.supports} onChange={set('supports')} placeholder="Visual cue, hand-over-hand at first" />
      {msg && <div className="err">{msg}</div>}
      <button className="btn" disabled={busy} onClick={save}>{submitLabel}</button>{' '}
      <button className="btn g" onClick={onCancel}>Cancel</button>
    </div>
  )
}

function StoSection({ stos, canEdit, onAdd, onEdit, onDel }) {
  const [adding, setAdding] = useState(false), [editId, setEditId] = useState(null), [delId, setDelId] = useState(null)
  if (!stos.length && !canEdit) return null
  const sel = { width: 'auto', margin: 0, padding: '4px 8px', fontSize: 13 }
  return (
    <div style={{ marginTop: 10 }}>
      <div className="sm"><b>Short-term objectives</b></div>
      {stos.map(o => editId === o.id ? (
        <StoForm key={o.id} init={stoToForm(o)} submitLabel="Save changes" onCancel={() => setEditId(null)}
          onSave={async row => { if (await onEdit(o.id, row)) setEditId(null) }} />
      ) : (
        <div key={o.id} style={{ border: '1px solid var(--bd)', borderRadius: 8, padding: 10, marginTop: 8 }}>
          <div><b>{o.title}</b> <span className="tag">{MT[o.measurement_type] ? MT[o.measurement_type].label : (o.measurement_type || 'Unspecified')}</span></div>
          <div className="sm">Baseline {stoFmt(o.measurement_type, o.baseline, o.unit)} to target {stoFmt(o.measurement_type, o.target, o.unit)}{o.target_date ? ' by ' + String(o.target_date).slice(0, 10) : ''}</div>
          {o.supports && <div className="sm"><b>Supports:</b> {o.supports}</div>}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
            {canEdit ? (
              <select value={o.status ?? ''} onChange={e => onEdit(o.id, { status: e.target.value })} style={sel}>
                {!o.status && <option value="">Status not set</option>}
                {Object.keys(STATUS).concat(o.status && !STATUS[o.status] ? [o.status] : []).map(k => <option key={k} value={k}>{stLabel(k)}</option>)}
              </select>
            ) : (o.status ? <span className="tag">{stLabel(o.status)}</span> : null)}
            {canEdit && <button className="x" onClick={() => setEditId(o.id)}>edit</button>}
            {canEdit && <button className="x" onClick={async () => { if (delId === o.id) { await onDel(o.id); setDelId(null) } else setDelId(o.id) }}>{delId === o.id ? 'Tap again to delete' : 'delete'}</button>}
          </div>
        </div>
      ))}
      {canEdit && (adding
        ? <StoForm init={blankSto} submitLabel="Add objective" onCancel={() => setAdding(false)} onSave={async row => { if (await onAdd(row)) setAdding(false) }} />
        : <div style={{ marginTop: 8 }}><button className="btn g" onClick={() => setAdding(true)}>Add objective</button></div>)}
    </div>
  )
}

function GoalCard({ g, logs, stos = [], names, uid, parent, canEdit, onEdit, onAddSto, onEditSto, onDelSto, onLog, onDelLog, onDelGoal }) {
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
      <StoSection stos={stos} canEdit={canEdit} onAdd={onAddSto} onEdit={onEditSto} onDel={onDelSto} />
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
  const [f, setF] = useState({
  a: '',
  b: [],
  i: 'Mild',
  m: '',
  w: 'School',
  c: '',
  otherBehavior: '',
  otherAntecedent: '',
  otherDuration: '',
  otherWhere: '',
  otherConsequence: ''
})
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const n7 = beh.filter(e => e.logged_on >= ago(7)).length
  return (
    <>
      <div className="card">
        <h2>Behavior log</h2><div className="sm">{n7} logged in the last 7 days</div>
        <label>What happened before?</label>

<select value={f.a} onChange={set('a')}>
  <option value="">Select a trigger or setting...</option>

  <optgroup label="Activities & Transitions">
    <option value="Transition">Transition</option>
    <option value="Preferred activity ended">Preferred activity ended</option>
    <option value="Change in routine">Change in routine</option>
    <option value="Unstructured time">Unstructured time</option>
    <option value="Waiting">Waiting</option>
  </optgroup>

  <optgroup label="Tasks & Demands">
    <option value="Task demand">Task demand</option>
    <option value="Difficult task">Difficult task</option>
    <option value="Non-preferred task">Non-preferred task</option>
    <option value="Correction or redirection">Correction or redirection</option>
  </optgroup>

  <optgroup label="Social">
    <option value="Peer interaction">Peer interaction</option>
    <option value="Adult interaction">Adult interaction</option>
    <option value="Attention removed">Attention removed</option>
    <option value="Denied access">Denied access</option>
  </optgroup>

  <optgroup label="Environment">
    <option value="Loud environment">Loud environment</option>
    <option value="Crowded environment">Crowded environment</option>
    <option value="Unexpected event">Unexpected event</option>
  </optgroup>

  <option value="No clear trigger">No clear trigger / unknown</option>
  <option value="Other">Other / not listed</option>
</select>

{f.a === 'Other' && (
  <input
    value={f.otherAntecedent}
    onChange={e =>
      setF({ ...f, otherAntecedent: e.target.value })
    }
    placeholder="Describe what happened before"
  />
)}
        <label>Behavior</label>
<select
  multiple
  value={f.b}
  onChange={e =>
    setF({
      ...f,
      b: Array.from(e.target.selectedOptions, option => option.value)
    })
  }
>

  <optgroup label="Aggression">
    <option value="Hitting">Hitting</option>
    <option value="Kicking">Kicking</option>
    <option value="Biting">Biting</option>
    <option value="Pushing">Pushing</option>
    <option value="Scratching">Scratching</option>
    <option value="Throwing objects">Throwing objects</option>
    <option value="Physical aggression">Other physical aggression</option>
    <option value="Verbal aggression">Verbal aggression</option>
  </optgroup>

  <optgroup label="Self-Injurious Behavior">
    <option value="Head banging">Head banging</option>
    <option value="Self-hitting">Self-hitting</option>
    <option value="Self-biting">Self-biting</option>
    <option value="Skin picking">Skin picking</option>
    <option value="Hair pulling">Hair pulling</option>
  </optgroup>

  <optgroup label="Task / Instruction">
    <option value="Task refusal">Task refusal</option>
    <option value="Noncompliance">Noncompliance</option>
    <option value="Avoidance">Avoidance / escape</option>
    <option value="Work avoidance">Work avoidance</option>
    <option value="Leaving seat">Leaving seat</option>
    <option value="Off-task behavior">Off-task behavior</option>
  </optgroup>

  <optgroup label="Emotional / Regulation">
    <option value="Crying">Crying</option>
    <option value="Yelling">Yelling / screaming</option>
    <option value="Tantrum">Tantrum</option>
    <option value="Meltdown">Meltdown</option>
    <option value="Frustration">Frustration</option>
    <option value="Withdrawal">Withdrawal / shutdown</option>
  </optgroup>

  <optgroup label="Safety / Movement">
    <option value="Elopement">Elopement / running away</option>
    <option value="Climbing">Unsafe climbing</option>
    <option value="Dropping to floor">Dropping to floor</option>
    <option value="Property destruction">Property destruction</option>
  </optgroup>

  <optgroup label="Social / Classroom">
    <option value="Interrupting">Interrupting</option>
    <option value="Inappropriate language">Inappropriate language</option>
    <option value="Peer conflict">Peer conflict</option>
    <option value="Difficulty with transitions">Difficulty with transitions</option>
    <option value="Inappropriate touching">Inappropriate touching</option>
  </optgroup>

  <optgroup label="Repetitive / Sensory">
    <option value="Repetitive behavior">Repetitive behavior</option>
    <option value="Vocal stereotypy">Repetitive vocalization</option>
    <option value="Sensory seeking">Sensory-seeking behavior</option>
  </optgroup>

  <option value="Other">Other / not listed</option>
</select>

{f.b === 'Other' && (
  <input
    value={f.otherBehavior || ''}
    onChange={e => setF({ ...f, otherBehavior: e.target.value })}
    placeholder="Describe behavior"
  />
)}
        <div className="row">
          <div><label>Intensity</label><select value={f.i} onChange={set('i')}><Opts a={['Mild', 'Moderate', 'Severe']} /></select></div>
          <div><label>Minutes</label><input type="number" value={f.m} onChange={set('m')} /></div>
          <div><label>Where</label>
<select value={f.w} onChange={set('w')}>
  <option value="">Select a location...</option>

  <optgroup label="School">
    <option value="Classroom">Classroom</option>
    <option value="Playground / Recess">Playground / Recess</option>
    <option value="Cafeteria">Cafeteria</option>
    <option value="Bathroom">Bathroom</option>
    <option value="Hallway">Hallway</option>
  </optgroup>

  <optgroup label="Other Settings">
    <option value="Home">Home</option>
    <option value="Therapy / Clinic">Therapy / Clinic</option>
    <option value="Community">Community</option>
    <option value="Transportation">Transportation</option>
  </optgroup>

  <option value="Other">Other / not listed</option>
</select>

{f.w === 'Other' && (
  <input
    value={f.otherWhere || ''}
    onChange={e => setF({ ...f, otherWhere: e.target.value })}
    placeholder="Describe location"
  />
)}
</div>
        </div>
        <label>After / what helped</label>
<select value={f.c} onChange={set('c')}>
  <option value="">Select what helped...</option>

  <optgroup label="Breaks & Regulation">
    <option value="Break">Break</option>
    <option value="Sensory break">Sensory break</option>
    <option value="Movement break">Movement break</option>
    <option value="Quiet area">Quiet area</option>
    <option value="Headphones">Headphones</option>
    <option value="Calming strategy">Calming strategy</option>
  </optgroup>

  <optgroup label="Prompts & Supports">
    <option value="Verbal prompt">Verbal prompt</option>
    <option value="Visual support">Visual support</option>
    <option value="Redirection">Redirection</option>
    <option value="First / Then support">First / Then support</option>
    <option value="Choice offered">Choice offered</option>
    <option value="Adult support">Adult support</option>
    <option value="Peer support">Peer support</option>
  </optgroup>

  <optgroup label="Task / Environment">
    <option value="Task modified">Task modified</option>
    <option value="Demand reduced">Demand reduced</option>
    <option value="Demand removed">Demand removed</option>
    <option value="Changed environment">Changed environment</option>
  </optgroup>

  <optgroup label="Reinforcement">
    <option value="Preferred item / activity">Preferred item / activity</option>
    <option value="Token / reward system">Token / reward system</option>
    <option value="Praise / positive reinforcement">Praise / positive reinforcement</option>
  </optgroup>

  <optgroup label="Other Responses">
    <option value="Planned ignoring">Planned ignoring</option>
    <option value="No intervention needed">No intervention needed</option>
  </optgroup>

  <option value="Other">Other / not listed</option>
</select>

{f.c === 'Other' && (
  <input
    value={f.otherConsequence || ''}
    onChange={e => setF({ ...f, otherConsequence: e.target.value })}
    placeholder="Describe what helped"
  />
)}
        <button className="btn" onClick={async () => {
          const behaviors = f.b.includes('Other')
  ? [...f.b.filter(b => b !== 'Other'), f.otherBehavior.trim()].filter(Boolean)
  : f.b;

const where = f.w === 'Other' ? (f.otherWhere || '').trim() : f.w;
const consequence = f.c === 'Other' ? (f.otherConsequence || '').trim() : f.c;

if (behaviors.length === 0) return;

await onAdd({
  antecedent: f.a.trim(),
  behavior: behaviors.join(', '),
  consequence,
  intensity: f.i,
  minutes: f.m,
  setting: where
});

setF({
  ...f,
  a: '',
  b: [],
  m: '',
  c: '',
  otherBehavior: '',
  otherAntecedent: '',
  otherDuration: '',
  otherWhere: '',
  otherConsequence: ''
});
}}>Save entry</button>
        
      </div>
      {beh.slice().reverse().slice(0, 20).map(e => {
  const behaviorList = (e.behavior || '')
    .split(',')
    .map(b => b.trim())
    .filter(Boolean);

  return (
    <div
      className="card"
      key={e.id}
      style={{
        padding: '18px',
        marginBottom: '14px',
        borderRadius: '16px'
      }}
    >
      {/* Date + Remove */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '6px'
        }}
      >
        <div style={{ fontSize: '13px', color: '#6b7280' }}>
          {e.logged_on}
        </div>

        {(e.logged_by === uid || parent) && (
  <button
    onClick={() => onDel(e.id)}
    title="Remove entry"
    aria-label="Remove entry"
    style={{
      background: 'transparent',
      border: 'none',
      padding: '6px',
      cursor: 'pointer',
      fontSize: '20px',
      lineHeight: 1,
      flexShrink: 0
    }}
  >
    🗑️
  </button>
)}
      </div>

      {/* Person who logged it */}
      <div
        style={{
          fontSize: '13px',
          color: '#6b7280',
          marginBottom: '12px'
        }}
      >
        Logged by: {names[e.logged_by] || 'Unknown'}
      </div>

      {/* Behaviors */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '7px',
          marginBottom: '14px'
        }}
      >
        {behaviorList.map((behavior, index) => (
          <span
            key={`${behavior}-${index}`}
            style={{
              background: '#e8f2ff',
              color: '#1769aa',
              padding: '6px 10px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            {behavior}
          </span>
        ))}
      </div>

      {/* Incident details */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '16px'
        }}
      >
        <span className="pill">⚡ {e.intensity || 'No intensity'}</span>

{e.minutes && (
  <span className="pill">⏱ {e.minutes} min</span>
)}

{e.setting && (
  <span className="pill">📍 {e.setting}</span>
)}
      </div>

      {/* Before */}
      <div style={{ marginBottom: '12px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: '700',
            color: '#6b7280',
            letterSpacing: '.06em',
            marginBottom: '3px'
          }}
        >
          BEFORE
        </div>

        <div>{e.antecedent || 'Not recorded'}</div>
      </div>

      {/* What helped */}
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: '700',
            color: '#6b7280',
            letterSpacing: '.06em',
            marginBottom: '3px'
          }}
        >
          WHAT HELPED
        </div>

        <div>{e.consequence || 'Not recorded'}</div>
      </div>
    </div>
  );
})}
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
      <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
  {R.map(r => (
    <div
      key={r.g.id}
      style={{
        border: '1px solid #dbe7f5',
        borderRadius: '16px',
        padding: '16px',
        background: '#f8fbff'
      }}
    >
      <div style={{
        fontSize: '17px',
        fontWeight: '700',
        color: '#17233f'
      }}>
        {r.g.title}
      </div>

      <div style={{
        fontSize: '13px',
        color: '#6b7280',
        marginTop: '4px',
        marginBottom: '16px'
      }}>
        {r.g.area} · {r.n} {r.n === 1 ? 'entry' : 'entries'}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px 12px'
      }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280' }}>
            TARGET
          </div>
          <div style={{ marginTop: '4px' }}>
            {r.g.direction === 'down' ? '≤' : '≥'}{r.g.target} {r.g.unit}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280' }}>
            LATEST
          </div>
          <div style={{ marginTop: '4px' }}>
            {r.l}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280' }}>
            AVG. LAST 5
          </div>
          <div style={{ marginTop: '4px' }}>
            {r.a}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280' }}>
            INDEPENDENCE
          </div>
          <div style={{ marginTop: '4px' }}>
            {r.ind}
          </div>
        </div>
      </div>

      <div style={{
        borderTop: '1px solid #e5edf7',
        marginTop: '16px',
        paddingTop: '12px'
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: '700',
          color: '#6b7280'
        }}>
          STATUS
        </span>

        <div style={{
          fontSize: '15px',
          fontWeight: '600',
          color: '#17233f',
          marginTop: '4px'
        }}>
          {r.st}
        </div>
      </div>
    </div>
  ))}
</div>
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
function AdminDashboard({ onBack }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [adminErr, setAdminErr] = useState('')

  const loadStats = useCallback(async () => {
    setLoading(true)
    setAdminErr('')

    const r = await supabase.rpc('admin_dashboard_stats')

    if (r.error) {
      setAdminErr(r.error.message)
      setStats(null)
    } else {
      setStats(r.data)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const cards = stats ? [
    ['Users', stats.total_users],
    ['Children', stats.total_children],
    ['Goals', stats.total_goals],
    ['STOs', stats.total_stos],
    ['Progress logs', stats.total_progress_logs],
    ['Behavior entries', stats.total_behavior_entries],
    ['Team memberships', stats.total_memberships],
    ['Invites', stats.total_invites]
  ] : []

  return (
    <>
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '18px'
          }}
        >
          <div>
            <h2 style={{ marginBottom: '4px' }}>StepTrack Admin</h2>
            <div className="sm">Owner analytics · platform overview</div>
          </div>

          <button
            className="btn g"
            style={{ flex: '0 0 auto', marginBottom: 0 }}
            onClick={onBack}
          >
            Back
          </button>
        </div>

        {loading && <p className="sm">Loading analytics...</p>}

        {adminErr && <div className="err">{adminErr}</div>}

        {!loading && stats && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '12px'
              }}
            >
              {cards.map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    border: '1px solid #dbe7f5',
                    borderRadius: '16px',
                    padding: '16px',
                    background: '#f8fbff'
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      fontWeight: '600'
                    }}
                  >
                    {label}
                  </div>

                  <div
                    style={{
                      fontSize: '30px',
                      fontWeight: '800',
                      color: '#17233f',
                      marginTop: '6px'
                    }}
                  >
                    {value ?? 0}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                borderTop: '1px solid #dbe7f5',
                marginTop: '20px',
                paddingTop: '20px'
              }}
            >
              <h3 style={{ marginBottom: '12px' }}>Last 7 days</h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '12px'
                }}
              >
                <div className="pill">
                  Progress logs: {stats.progress_last_7_days ?? 0}
                </div>

                <div className="pill">
                  Behavior entries: {stats.behavior_last_7_days ?? 0}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
export default function Main({ session }) {
  const uid = session.user.id
  const [isAdmin, setIsAdmin] = useState(false)

useEffect(() => {
  async function checkAdmin() {
    const r = await supabase.rpc('is_app_admin')
    setIsAdmin(!r.error && r.data === true)
  }

  checkAdmin()
}, [])
  const [kids, setKids] = useState([]), [cid, setCid] = useState(null), [tab, setTab] = useState('goals'), [err, setErr] = useState('')
  const [d, setD] = useState({ goals: [], logs: [], stos: [], beh: [], team: [], names: {} }), [nk, setNk] = useState('')
  const chk = r => { if (r.error) { setErr(r.error.message); return [] } return r.data || [] }

  const loadKids = useCallback(async () => {
    const k = chk(await supabase.from('children').select('*').order('created_at'))
    setKids(k); setCid(c => (k.find(x => x.id === c) ? c : k[0]?.id || null))
  }, [])
  useEffect(() => { loadKids() }, [loadKids])

  const load = useCallback(async () => {
    if (!cid) { setD({ goals: [], logs: [], stos: [], beh: [], team: [], names: {} }); return }
    const [g, l, b, t, p] = await Promise.all([
      supabase.from('goals').select('*').eq('child_id', cid).eq('archived', false).order('created_at'),
      supabase.from('logs').select('*').eq('child_id', cid),
      supabase.from('behavior_entries').select('*').eq('child_id', cid).order('logged_on'),
      supabase.from('memberships').select('*').eq('child_id', cid),
      supabase.from('profiles').select('id,display_name')])
    const goalRows = chk(g)
    const goalIds = goalRows.map(x => x.id)
    const stoRows = goalIds.length ? chk(await supabase.from('sto_objectives').select('*').in('goal_id', goalIds)) : []
    setD({ goals: goalRows, logs: chk(l), stos: stoRows.slice().sort(stoSort), beh: chk(b), team: chk(t), names: Object.fromEntries(chk(p).map(x => [x.id, x.display_name])) })
  }, [cid])
  useEffect(() => { load() }, [load])

  const run = async (p, after = load) => { const r = await p; if (r.error) { setErr(r.error.message); return } setErr(''); await after() }
  const kid = kids.find(k => k.id === cid), me = d.team.find(m => m.user_id === uid), parent = me?.role === 'parent'
  const canGoals = !!me?.can_edit_goals
  const joined = async id => { await loadKids(); setCid(id) }

  // STO writes. RLS decides who may write; an update or delete that matches no row was blocked or not found.
  const stoRun = async (p, needRows = true) => {
    const r = await p
    if (r.error) { setErr(r.error.message); return false }
    if (needRows && (!r.data || !r.data.length)) { setErr('Nothing was changed. You may not have permission for that.'); return false }
    setErr(''); await load(); return true
  }
  const stoAdd = (goalId, row) => {
    const next = d.stos.filter(o => o.goal_id === goalId).reduce((m, o) => Math.max(m, Number(o.sort_order) || 0), 0) + 1
    return stoRun(supabase.from('sto_objectives').insert({ ...row, goal_id: goalId, created_by: uid, sort_order: next }), false)
  }
  const stoEdit = (id, patch) => stoRun(supabase.from('sto_objectives').update(patch).eq('id', id).select())
  const stoDel = id => stoRun(supabase.from('sto_objectives').delete().eq('id', id).select())

  async function addKid() {
    if (!nk.trim()) return
    const r = await supabase.from('children').insert({ name: nk.trim() }).select().single()
    if (r.error) return setErr(r.error.message)
    setNk(''); setErr(''); await loadKids(); setCid(r.data.id); setTab('goals')
  }

 return (
  <div>
    <div className="row" style={{ alignItems: 'center' }}>
      <div className="brand">
        <div className="brand-text">
          <h1>StepTrack</h1>
          <span>Progress, one step at a time.</span>
        </div>
      </div>

      <button
        className="x"
        style={{ flex: '0 0 auto' }}
        onClick={() => supabase.auth.signOut()}
      >
        Sign out
      </button>
    </div>

    {err && <div className="err">{err}</div>}

    {!kid ? (
      <>
        <div className="card">
          <h2>Add your first child</h2>
          <label>First name or initials only</label>
          <input value={nk} onChange={e => setNk(e.target.value)} />
          <button className="btn" onClick={addKid}>
            Add child
          </button>
        </div>

        <Join onDone={joined} />
      </>
    ) : (
      <>
        <div className="row">
          <div>
            <label>Child</label>
            <select
              value={cid}
              onChange={e => setCid(e.target.value)}
            >
              {kids.map(k => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Add another child</label>
            <div className="row">
              <input
                value={nk}
                onChange={e => setNk(e.target.value)}
                placeholder="Name"
              />
              <button
                className="btn g"
                style={{ flex: '0 0 auto', marginBottom: 8 }}
                onClick={addKid}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <nav>
          {[
            ['goals', 'Goals'],
            ['beh', 'Behavior'],
            ['rep', 'Report'],
            ['team', 'Team'],
            ...(isAdmin ? [['admin', 'Admin']] : [])
          ].map(([k, l]) => (
            <button
              key={k}
              className={tab === k ? 'on' : ''}
              onClick={() => setTab(k)}
            >
              {l}
            </button>
          ))}
        </nav>

        {tab === 'goals' && (
          <>
            {d.goals.map(g => (
              <GoalCard
                key={g.id}
                g={g}
                logs={d.logs}
                stos={d.stos.filter(o => o.goal_id === g.id)}
                names={d.names}
                uid={uid}
                parent={parent}
                canEdit={canGoals}
                onAddSto={row => stoAdd(g.id, row)}
                onEditSto={stoEdit}
                onDelSto={stoDel}
                onEdit={(id, patch) =>
                  run(supabase.from('goals').update(patch).eq('id', id))
                }
                onLog={row =>
                  run(
                    supabase.from('logs').insert({
                      ...row,
                      child_id: cid
                    })
                  )
                }
                onDelLog={id =>
                  run(supabase.from('logs').delete().eq('id', id))
                }
                onDelGoal={id =>
                  run(supabase.from('goals').delete().eq('id', id))
                }
              />
            ))}

            {canGoals ? (
              <AddGoal
                onAdd={row =>
                  run(
                    supabase.from('goals').insert({
                      ...row,
                      child_id: cid
                    })
                  )
                }
              />
            ) : (
              <p className="sm">
                Your role can log results but not create goals. Ask a parent or
                therapist to add goals.
              </p>
            )}
          </>
        )}

        {tab === 'beh' && (
          <Behavior
            beh={d.beh}
            names={d.names}
            uid={uid}
            parent={parent}
            onAdd={row =>
              run(
                supabase.from('behavior_entries').insert({
                  ...row,
                  child_id: cid
                })
              )
            }
            onDel={id =>
              run(
                supabase
                  .from('behavior_entries')
                  .delete()
                  .eq('id', id)
              )
            }
          />
        )}

        {tab === 'rep' && (
          <Report
            kid={kid}
            goals={d.goals}
            logs={d.logs}
            beh={d.beh}
          />
        )}

        {tab === 'team' && (
          <Team
            team={d.team}
            names={d.names}
            uid={uid}
            parent={parent}
            cid={cid}
            kid={kid}
            onJoin={joined}
            onRevoke={id =>
              run(
                supabase
                  .from('memberships')
                  .delete()
                  .eq('id', id)
              )
            }
            onName={n =>
              run(
                supabase
                  .from('profiles')
                  .update({ display_name: n })
                  .eq('id', uid)
              )
            }
            onDeleteChild={() =>
              run(
                supabase
                  .from('children')
                  .delete()
                  .eq('id', cid),
                loadKids
              )
            }
          />
        )}

        {tab === 'admin' && isAdmin && (
          <AdminDashboard onBack={() => setTab('goals')} />
        )}
      </>
    )}

    <p className="sm np">
      Use first names or initials only. Not a medical record.
    </p>
  </div>
)
}