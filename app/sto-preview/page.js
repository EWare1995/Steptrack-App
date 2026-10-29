'use client'
import { useEffect, useMemo, useState } from 'react'
import styles from './sto-preview.module.css'

const SUPPORTS = ['Independent', 'Gesture', 'Verbal', 'Physical', 'Visual', 'Redirection']
const LOCATIONS = ['School', 'Home', 'Therapy', 'Respite']
const today = () => { const date = new Date(); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
const emptyObjective = { title: '', targetSuccess: '3', targetTotal: '5', requiredDays: '8', baselineSuccess: '', baselineTotal: '', direction: 'up', targetDate: '', supports: ['Verbal'] }
const starterObjectives = [
  { id: 'sto-a', title: 'Complete 2/5 opportunities across 3 separate trial days', targetSuccess: 2, targetTotal: 5, requiredDays: 3, baselineSuccess: 1, baselineTotal: 5, direction: 'up', targetDate: '2026-11-15', supports: ['Verbal'] },
  { id: 'sto-b', title: 'Complete 3/5 opportunities across 8 separate trial days', targetSuccess: 3, targetTotal: 5, requiredDays: 8, baselineSuccess: 2, baselineTotal: 5, direction: 'up', targetDate: '2026-12-15', supports: ['Visual', 'Redirection'] },
  { id: 'sto-c', title: 'Complete 4/5 opportunities across 8 separate trial days', targetSuccess: 4, targetTotal: 5, requiredDays: 8, baselineSuccess: 3, baselineTotal: 5, direction: 'up', targetDate: '2027-01-15', supports: ['Gesture'] }
]
const starterLogs = [
  { id: 'a1', stoId: 'sto-a', date: '2026-10-20', correct: 1, total: 3, supports: ['Verbal'], where: 'School', mode: 'live' },
  { id: 'a2', stoId: 'sto-a', date: '2026-10-20', correct: 1, total: 2, supports: ['Verbal'], where: 'School', mode: 'manual' },
  { id: 'a3', stoId: 'sto-a', date: '2026-10-22', correct: 3, total: 5, supports: ['Visual'], where: 'School', mode: 'live' },
  { id: 'a4', stoId: 'sto-a', date: '2026-10-24', correct: 1, total: 5, supports: ['Redirection'], where: 'Therapy', mode: 'manual' },
  { id: 'b1', stoId: 'sto-b', date: '2026-10-22', correct: 3, total: 5, supports: ['Visual'], where: 'School', mode: 'manual' }
]
const int = value => Number.isInteger(Number(value)) && String(value).trim() !== ''
const writtenRatio = title => {
  const match = String(title).match(/\b(\d+)\s*(?:\/|out of)\s*(\d+)\b/i)
  return match ? [Number(match[1]), Number(match[2])] : null
}
const writtenDays = title => {
  const match = String(title).match(/\b(?:across|over|on|for)\s+(\d+)\s+(?:separate|distinct|qualifying|different)?\s*(?:trial\s*)?days?\b/i)
  return match ? Number(match[1]) : null
}
function summarize(objective, logs) {
  const dates = new Map()
  for (const log of logs) {
    if (log.stoId !== objective.id) continue
    const row = dates.get(log.date) || { date: log.date, correct: 0, total: 0 }
    row.correct += Number(log.correct)
    row.total += Number(log.total)
    dates.set(log.date, row)
  }
  const days = [...dates.values()].map(row => ({
    ...row,
    qualifies: row.total >= objective.targetTotal && (
      objective.direction === 'down'
        ? row.correct / row.total <= objective.targetSuccess / objective.targetTotal
        : row.correct / row.total >= objective.targetSuccess / objective.targetTotal
    )
  })).sort((a, b) => b.date.localeCompare(a.date))
  const qualified = days.filter(day => day.qualifies).length
  return { days, qualified, mastered: qualified >= objective.requiredDays }
}
const newId = prefix => prefix + '-' + Math.random().toString(36).slice(2, 10)
const inputNumber = (value, setter, placeholder, min = 0, id) => (
  <input id={id} type="number" inputMode="numeric" step="1" min={min} placeholder={placeholder} value={value} onChange={event => setter(event.target.value)} />
)

export default function StoPreview() {
  const [objectives, setObjectives] = useState(starterObjectives)
  const [logs, setLogs] = useState(starterLogs)
  const [selectedId, setSelectedId] = useState('sto-b')
  const [draft, setDraft] = useState({ ...emptyObjective })
  const [editingId, setEditingId] = useState(null)
  const [formMessage, setFormMessage] = useState('')
  const [mode, setMode] = useState('live')
  const [responses, setResponses] = useState([])
  const [manualCorrect, setManualCorrect] = useState('')
  const [manualTotal, setManualTotal] = useState('')
  const [logDate, setLogDate] = useState('')
  useEffect(() => { setLogDate(today()) }, [])
  const [logWhere, setLogWhere] = useState('School')
  const [logSupports, setLogSupports] = useState(['Independent'])
  const [logMessage, setLogMessage] = useState('')

  const selected = objectives.find(item => item.id === selectedId) || objectives[0]
  const summaries = useMemo(() => Object.fromEntries(objectives.map(item => [item.id, summarize(item, logs)])), [objectives, logs])
  const selectedSummary = selected ? summaries[selected.id] : null
  const setField = field => event => setDraft(current => ({ ...current, [field]: event.target.value }))
  const toggleDraftSupport = support => setDraft(current => ({
    ...current,
    supports: current.supports.includes(support)
      ? current.supports.filter(item => item !== support)
      : support === 'Independent' ? ['Independent'] : [...current.supports.filter(item => item !== 'Independent'), support]
  }))
  const toggleLogSupport = support => setLogSupports(current => (
    current.includes(support)
      ? current.filter(item => item !== support)
      : support === 'Independent' ? ['Independent'] : [...current.filter(item => item !== 'Independent'), support]
  ))
  function startEdit(item) {
    setEditingId(item.id)
    setDraft({ ...item, targetSuccess: String(item.targetSuccess), targetTotal: String(item.targetTotal), requiredDays: String(item.requiredDays), baselineSuccess: item.baselineSuccess == null ? '' : String(item.baselineSuccess), baselineTotal: item.baselineTotal == null ? '' : String(item.baselineTotal) })
    setFormMessage('')
  }
  function saveObjective(event) {
    event.preventDefault()
    const success = Number(draft.targetSuccess), total = Number(draft.targetTotal), days = Number(draft.requiredDays)
    const hasBaseline = draft.baselineSuccess !== '' || draft.baselineTotal !== ''
    if (!draft.title.trim()) return setFormMessage('Enter an observable STO objective.')
    if (![draft.targetSuccess, draft.targetTotal, draft.requiredDays].every(int) || success < 0 || total < 1 || success > total || days < 1) return setFormMessage('Enter valid whole-number successful trials, opportunities, and qualifying days.')
    if (hasBaseline && (!int(draft.baselineSuccess) || !int(draft.baselineTotal) || Number(draft.baselineSuccess) < 0 || Number(draft.baselineTotal) < 1 || Number(draft.baselineSuccess) > Number(draft.baselineTotal))) return setFormMessage('Baseline must include valid successes and total opportunities, or both fields must be blank.')
    const ratio = writtenRatio(draft.title)
    if (ratio && (ratio[0] !== success || ratio[1] !== total)) return setFormMessage('The written ' + ratio.join('/') + ' objective must match the structured ' + success + '/' + total + ' target.')
    const titleDays = writtenDays(draft.title)
    if (titleDays != null && titleDays !== days) return setFormMessage('The written requirement of ' + titleDays + ' days must match the structured ' + days + ' days.')
    const next = { ...draft, id: editingId || newId('sto'), title: draft.title.trim(), targetSuccess: success, targetTotal: total, requiredDays: days, baselineSuccess: draft.baselineSuccess === '' ? null : Number(draft.baselineSuccess), baselineTotal: draft.baselineTotal === '' ? null : Number(draft.baselineTotal) }
    setObjectives(current => editingId ? current.map(item => item.id === editingId ? next : item) : [...current, next])
    setSelectedId(next.id)
    setEditingId(null)
    setDraft({ ...emptyObjective })
    setFormMessage('Saved in this preview only. No database records changed.')
  }
  function chooseObjective(id) {
    setSelectedId(id)
    setResponses([])
    setManualCorrect('')
    setManualTotal('')
    setLogMessage('')
  }
  function saveLog(event) {
    event.preventDefault()
    if (!selected) return
    const correct = mode === 'live' ? responses.filter(value => value === 'X').length : Number(manualCorrect)
    const total = mode === 'live' ? responses.length : Number(manualTotal)
    if (mode === 'manual' && (!int(manualCorrect) || !int(manualTotal))) return setLogMessage('Enter whole-number successes and opportunities.')
    if (!Number.isInteger(correct) || !Number.isInteger(total) || total < 1 || correct < 0 || correct > total) return setLogMessage('Successful trials must be between 0 and total opportunities.')
    if (!logDate) return setLogMessage('Choose a trial date.')
    setLogs(current => [...current, { id: newId('log'), stoId: selected.id, date: logDate, correct, total, supports: logSupports, where: logWhere, mode }])
    setResponses([])
    setManualCorrect('')
    setManualTotal('')
    setLogMessage('Trial entry added to ' + selected.id + ' in this preview only.')
  }
  function resetPreview() {
    setObjectives(starterObjectives)
    setLogs(starterLogs)
    setSelectedId('sto-b')
    setDraft({ ...emptyObjective })
    setEditingId(null)
    setResponses([])
    setManualCorrect('')
    setManualTotal('')
    setFormMessage('Demo restored.')
    setLogMessage('')
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <a className={styles.back} href="/">← StepTrack</a>
          <div className={styles.eyebrow}>STO MASTERY · DESIGN PREVIEW</div>
          <h1>Independent STO trial tracking</h1>
          <p>Review how separate short-term objectives can have their own targets, qualifying days, and progress entries.</p>
        </div>
        <button type="button" className="btn g" onClick={resetPreview}>Reset demo</button>
      </header>
      <div className={styles.notice} role="note">
        <strong>Synthetic preview only.</strong> These objectives and entries are local examples and reset when you refresh. Nothing is saved to Supabase, no student data is loaded, and no database or permission changes have been applied.
      </div>
      <section className={styles.grid}>
        <section className="card">
          <div className={styles.sectionHeading}><h2>Short-term objectives</h2><span>{objectives.length} STOs</span></div>
          <p className="sm">Each objective has a separate target and qualifying-day count.</p>
          <div className={styles.objectiveList}>
            {objectives.map((objective, index) => {
              const result = summaries[objective.id]
              const active = selected?.id === objective.id
              return (
                <button type="button" key={objective.id} onClick={() => chooseObjective(objective.id)} className={active ? styles.objectiveActive : styles.objective}>
                  <div className={styles.objectiveTop}><strong>STO {index + 1}</strong><span className={result.mastered ? styles.met : styles.pending}>{result.mastered ? 'Mastered' : result.qualified + ' / ' + objective.requiredDays + ' days'}</span></div>
                  <div className={styles.objectiveTitle}>{objective.title}</div>
                  <div className={styles.objectiveDetails}>Target {objective.targetSuccess}/{objective.targetTotal} · {objective.requiredDays} qualifying dates</div>
                  <div className={styles.progress}><div style={{ width: Math.min(100, (result.qualified / objective.requiredDays) * 100) + '%' }} /></div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="card">
          {selected ? (
            <>
              <div className={styles.sectionHeading}><h2>STO progress</h2><span className={selectedSummary.mastered ? styles.met : styles.pending}>{selectedSummary.mastered ? 'Mastered' : 'In progress'}</span></div>
              <h3 className={styles.currentTitle}>{selected.title}</h3>
              <div className={styles.stats}>
                <div><strong>{selected.targetSuccess}/{selected.targetTotal}</strong><span>Target trials</span></div>
                <div><strong>{selectedSummary.qualified}/{selected.requiredDays}</strong><span>Qualifying days</span></div>
                <div><strong>{selectedSummary.days.length}</strong><span>Dates recorded</span></div>
              </div>
              <div className={styles.progressLarge} role="progressbar" aria-label="STO qualifying days" aria-valuemin={0} aria-valuemax={selected.requiredDays} aria-valuenow={Math.min(selected.requiredDays, selectedSummary.qualified)}>
                <div style={{ width: Math.min(100, (selectedSummary.qualified / selected.requiredDays) * 100) + '%' }} />
              </div>
              <p className="sm">A qualifying day meets the STO's own {selected.targetSuccess}/{selected.targetTotal} target, with at least {selected.targetTotal} total opportunities. Each calendar date counts once, even if multiple entries were recorded.</p>
              <div className={styles.sectionHeading}><h3>Recorded dates</h3><button type="button" className="btn g" onClick={() => startEdit(selected)}>Edit STO</button></div>
              {selectedSummary.days.length ? selectedSummary.days.map(day => (
                <div className={styles.dateRow} key={day.date}>
                  <span>{day.date}</span><span>{day.correct}/{day.total} opportunities</span><strong className={day.qualifies ? styles.good : styles.muted}>{day.qualifies ? 'Qualifies' : 'Below target'}</strong>
                </div>
              )) : <p className="sm">No entries for this STO yet.</p>}
            </>
          ) : <p>No objective selected.</p>}
        </section>
      </section>

      <section className={styles.grid}>
        <section className="card">
          <div className={styles.sectionHeading}><h2>{editingId ? 'Edit STO criteria' : 'Add an STO'}</h2>{editingId && <button type="button" className="btn g" onClick={() => { setEditingId(null); setDraft({ ...emptyObjective }); setFormMessage('') }}>New STO</button>}</div>
          <p className="sm">The layout matches the Add Goal trials/opportunities form, including independent qualifying days for each STO.</p>
          <form onSubmit={saveObjective} className={styles.form}>
            <label htmlFor="sto-demo-title">Objective (specific and observable)</label>
            <input id="sto-demo-title" value={draft.title} onChange={setField('title')} placeholder="e.g. Completes 3/5 opportunities across 8 separate trial days" required />
            <div className={styles.two}>
              <div><label htmlFor="sto-demo-direction">Direction</label><select id="sto-demo-direction" value={draft.direction} onChange={setField('direction')}><option value="up">Increase to target</option><option value="down">Reduce to target</option></select></div>
              <div><label htmlFor="sto-demo-date">Target date</label><input id="sto-demo-date" type="date" value={draft.targetDate} onChange={setField('targetDate')} /></div>
            </div>
            <h3>Target performance</h3>
            <div className={styles.two}>
              <div><label htmlFor="sto-demo-success">Successful trials</label>{inputNumber(draft.targetSuccess, value => setDraft(current => ({ ...current, targetSuccess: value })), 'e.g. 3', 0, 'sto-demo-success')}</div>
              <div><label htmlFor="sto-demo-total">Total opportunities</label>{inputNumber(draft.targetTotal, value => setDraft(current => ({ ...current, targetTotal: value })), 'e.g. 5', 1, 'sto-demo-total')}</div>
            </div>
            {int(draft.targetSuccess) && int(draft.targetTotal) && Number(draft.targetTotal) > 0 && Number(draft.targetSuccess) <= Number(draft.targetTotal) && <p className={styles.helper}>Target: {draft.targetSuccess} of {draft.targetTotal} opportunities ({Math.round(Number(draft.targetSuccess) / Number(draft.targetTotal) * 100)}% accuracy)</p>}
            <div className={styles.two}>
              <div><label htmlFor="sto-demo-days">Qualifying trial days</label>{inputNumber(draft.requiredDays, value => setDraft(current => ({ ...current, requiredDays: value })), 'e.g. 8', 1, 'sto-demo-days')}</div>
              <p className={styles.helper}>Count distinct calendar dates meeting this STO's target. They do not need to be consecutive.</p>
            </div>
            <h3>Starting baseline <span className="sm">(optional)</span></h3>
            <div className={styles.two}>
              <div><label>Successful trials</label>{inputNumber(draft.baselineSuccess, value => setDraft(current => ({ ...current, baselineSuccess: value })), 'e.g. 1')}</div>
              <div><label>Total opportunities</label>{inputNumber(draft.baselineTotal, value => setDraft(current => ({ ...current, baselineTotal: value })), 'e.g. 5', 1)}</div>
            </div>
            <label>Supports that help</label>
            <div className={styles.supports}>
              {SUPPORTS.map(item => <label key={item} className={draft.supports.includes(item) ? styles.supportActive : styles.support}><input type="checkbox" checked={draft.supports.includes(item)} onChange={() => toggleDraftSupport(item)} />{item}</label>)}
            </div>
            {formMessage && <p className={styles.helper} role="status">{formMessage}</p>}
            <button type="submit" className="btn">{editingId ? 'Save STO preview' : 'Add STO preview'}</button>
          </form>
        </section>

        <section className="card">
          <div className={styles.sectionHeading}><h2>Record STO trials</h2><span className={styles.pending}>Local demo</span></div>
          <p className="sm">Choose exactly which STO receives the entry. Other objectives are not credited automatically.</p>
          <form onSubmit={saveLog} className={styles.form}>
            <label htmlFor="sto-demo-select">Record against</label>
            <select id="sto-demo-select" value={selectedId} onChange={event => chooseObjective(event.target.value)}>
              {objectives.map((objective, index) => <option key={objective.id} value={objective.id}>STO {index + 1}: {objective.targetSuccess}/{objective.targetTotal} across {objective.requiredDays} days</option>)}
            </select>
            <div className={styles.segmented} role="group" aria-label="Trial entry mode">
              <button type="button" className={mode === 'live' ? styles.segmentActive : ''} onClick={() => setMode('live')}>Live trial entry</button>
              <button type="button" className={mode === 'manual' ? styles.segmentActive : ''} onClick={() => setMode('manual')}>Manual entry</button>
            </div>
            {mode === 'live' ? (
              <>
                <p className="sm">Record each opportunity as correct (X) or incorrect (−).</p>
                <div className={styles.liveButtons}>
                  <button type="button" onClick={() => setResponses(current => [...current, 'X'])}>+ Correct (X)</button>
                  <button type="button" onClick={() => setResponses(current => [...current, '-'])}>+ Incorrect (−)</button>
                  <button type="button" className={styles.undo} disabled={!responses.length} onClick={() => setResponses(current => current.slice(0, -1))}>Undo</button>
                </div>
                <div className={styles.trialTally}><strong>{responses.filter(item => item === 'X').length}/{responses.length}</strong><span>Successes / opportunities</span></div>
                <p className="sm">{responses.map(item => item === 'X' ? '✓' : '–').join(' ') || 'No opportunities recorded.'}</p>
              </>
            ) : (
              <div className={styles.two}>
                <div><label>Successful trials</label>{inputNumber(manualCorrect, setManualCorrect, 'e.g. 3')}</div>
                <div><label>Total opportunities</label>{inputNumber(manualTotal, setManualTotal, 'e.g. 5', 1)}</div>
              </div>
            )}
            <div className={styles.two}>
              <div><label>Trial date</label><input type="date" value={logDate} onChange={event => setLogDate(event.target.value)} required /></div>
              <div><label>Where</label><select value={logWhere} onChange={event => setLogWhere(event.target.value)}>{LOCATIONS.map(location => <option key={location}>{location}</option>)}</select></div>
            </div>
            <label>Supports used</label>
            <div className={styles.supports}>{SUPPORTS.map(item => <label key={item} className={logSupports.includes(item) ? styles.supportActive : styles.support}><input type="checkbox" checked={logSupports.includes(item)} onChange={() => toggleLogSupport(item)} />{item}</label>)}</div>
            {logMessage && <p className={styles.helper} role="status">{logMessage}</p>}
            <button type="submit" className="btn">Add trial entry to selected STO</button>
          </form>
        </section>
      </section>
      <footer className={styles.footer}>
        This is a front-end design and calculation preview—not a deployed database feature. Persistence, RLS, membership permission checks, and any schema changes require a separate reviewed implementation before a production release.
      </footer>
    </main>
  )
}
