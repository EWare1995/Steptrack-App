'use client'
import { useState } from 'react'
import { getStoTrialProgress } from '../lib/stoTrialProgress'

const SUPPORTS = ['Independent', 'Gesture', 'Verbal', 'Physical', 'Visual', 'Redirection']
const localDate = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }

export default function StoTrialEntryPanel({ sto, entries = [], onSave, canLog = true }) {
  const [mode, setMode] = useState('live')
  const [responses, setResponses] = useState([])
  const [successes, setSuccesses] = useState('')
  const [opportunities, setOpportunities] = useState('')
  const [loggedOn, setLoggedOn] = useState('')
  const [supports, setSupports] = useState(['Independent'])
  const [setting, setSetting] = useState('School')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const progress = getStoTrialProgress(sto, entries)
  const good = mode === 'live' ? responses.filter(x => x).length : Number(successes)
  const total = mode === 'live' ? responses.length : Number(opportunities)
  const toggle = support => setSupports(old => support === 'Independent'
    ? ['Independent'] : old.includes(support) ? old.filter(x => x !== support) : [...old.filter(x => x !== 'Independent'), support])

  async function save() {
    if (!canLog || saving) return
    if (!loggedOn || !/^\d{4}-\d{2}-\d{2}$/.test(loggedOn)) return setMessage('Choose a valid entry date.')
    if (!Number.isInteger(good) || !Number.isInteger(total) || total < 1 || good < 0 || good > total)
      return setMessage('Record valid whole-number successes and opportunities.')
    if (supports.length === 0) return setMessage('Select at least one support.')
    setSaving(true); setMessage('')
    try {
      const result = await onSave({ sto_id: sto.id, logged_on: loggedOn,
        value: good, trial_total: total, supports, setting, note: note.trim() })
      if (result !== true) { setMessage('Unable to save. Check your permissions; your entries are still here.'); return }
      setResponses([]); setSuccesses(''); setOpportunities(''); setNote('')
      setMessage('Saved for this STO.')
    } catch {
      setMessage('Save failed; your entries are still here.')
    } finally { setSaving(false) }
  }

  return <section aria-label={'Trial entries for ' + sto.title} style={{ borderTop: '1px solid var(--bd)', marginTop: 12, paddingTop: 12 }}>
    <div className="sm"><b>STO-specific trial progress</b></div>
    {progress.configured ? <p className="sm">{progress.qualifyingDays}/{progress.requiredDays} qualifying days · {progress.complete ? 'Criteria met' : 'In progress'}</p>
      : <p className="sm">Set this STO's target and qualifying days to calculate mastery.</p>}
    {progress.dates.length > 0 && <details><summary className="sm">View qualifying dates</summary>
      {progress.dates.map(day => <div className="sm" key={day.date}>{day.date}: {day.successes}/{day.opportunities} · {day.qualifies ? 'Qualifies' : 'Not yet'}</div>)}
    </details>}
    {!canLog ? null : <>
      <p className="sm">Entries here apply only to this STO, not automatically to the parent goal or other objectives.</p>
      <div className="row">
        <button type="button" className="btn g" aria-pressed={mode === 'live'} onClick={() => setMode('live')}>Live X/O</button>
        <button type="button" className="btn g" aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>Manual entry</button>
      </div>
      {mode === 'live' ? <>
        <div className="row">
          <button type="button" className="btn g" onClick={() => setResponses(old => [...old, true])}>X · Correct</button>
          <button type="button" className="btn g" onClick={() => setResponses(old => [...old, false])}>O · Incorrect</button>
          <button type="button" className="btn g" disabled={!responses.length} onClick={() => setResponses(old => old.slice(0, -1))}>Undo</button>
        </div>
        <p className="sm">{responses.map(x => x ? 'X' : 'O').join(' ')} · {good}/{total} trials</p>
      </> : <div className="row">
        <label>Successful trials<input type="number" min="0" step="1" inputMode="numeric" value={successes} onChange={e => setSuccesses(e.target.value)} /></label>
        <label>Total opportunities<input type="number" min="1" step="1" inputMode="numeric" value={opportunities} onChange={e => setOpportunities(e.target.value)} /></label>
      </div>}
      <div className="row"><label>Trial date<input type="date" value={loggedOn} onChange={e => setLoggedOn(e.target.value)} max={localDate()} /></label>
        <label>Where<select value={setting} onChange={e => setSetting(e.target.value)}><option>School</option><option>Home</option><option>Community</option><option>Therapy</option></select></label></div>
      <div className="sm"><b>Supports used</b></div>
      <div className="row" style={{ flexWrap: 'wrap' }}>{SUPPORTS.map(s => <label key={s} className="sm" style={{ whiteSpace: 'nowrap' }}>
        <input type="checkbox" checked={supports.includes(s)} onChange={() => toggle(s)} /> {s}</label>)}</div>
      <label>Notes (optional)<textarea value={note} onChange={e => setNote(e.target.value)} /></label>
      {message && <div className="sm" role="status">{message}</div>}
      <button className="btn" type="button" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save STO trials'}</button>
    </>}
  </section>
}
