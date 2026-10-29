/**
 * Pure, database-independent calculations for an individual short-term objective.
 * The caller must supply only authorized entries; this function is not an access-control boundary.
 */
export function getStoTrialProgress(sto, entries = []) {
  const requiredSuccesses = Number(sto?.target)
  const requiredOpportunities = Number(sto?.target_total_trials)
  const requiredDays = Number(sto?.qualifying_days)
  const configured = Number.isInteger(requiredSuccesses) &&
    Number.isInteger(requiredOpportunities) && requiredOpportunities > 0 &&
    requiredSuccesses >= 0 && requiredSuccesses <= requiredOpportunities &&
    Number.isInteger(requiredDays) && requiredDays > 0
  if (!configured) return { configured: false, qualifyingDays: 0, requiredDays: null, complete: false, dates: [] }

  const byDate = new Map()
  for (const entry of entries) {
    // Explicit STO association prevents one objective's trials advancing another.
    if (String(entry?.sto_id || '') !== String(sto.id || '')) continue
    const date = entry.logged_on
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const correct = Number(entry.value)
    const opportunities = Number(entry.trial_total)
    if (!Number.isInteger(correct) || !Number.isInteger(opportunities) ||
        opportunities <= 0 || correct < 0 || correct > opportunities) continue
    const current = byDate.get(date) || { date, successes: 0, opportunities: 0 }
    current.successes += correct
    current.opportunities += opportunities
    byDate.set(date, current)
  }

  const dates = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map(day => {
    const ratio = day.successes / day.opportunities
    const threshold = requiredSuccesses / requiredOpportunities
    const qualifies = day.opportunities >= requiredOpportunities &&
      (sto.direction === 'down' ? ratio <= threshold : ratio >= threshold)
    return { ...day, qualifies }
  })
  const qualifyingDays = dates.filter(day => day.qualifies).length
  return { configured: true, qualifyingDays, requiredDays,
    complete: qualifyingDays >= requiredDays, dates }
}

export function validateStoTrialCriteria({ title, target, targetTotalTrials, qualifyingDays }) {
  const successes = Number(target)
  const opportunities = Number(targetTotalTrials)
  const days = Number(qualifyingDays)
  if (!Number.isInteger(successes) || !Number.isInteger(opportunities) ||
      successes < 0 || opportunities < 1 || successes > opportunities)
    return 'Enter a valid whole-number target ratio.'
  if (!Number.isInteger(days) || days < 1)
    return 'Enter at least one qualifying trial day.'
  const ratio = String(title || '').match(/\b(\d+)\s*(?:\/|out of)\s*(\d+)\b/i)
  if (ratio && (Number(ratio[1]) !== successes || Number(ratio[2]) !== opportunities))
    return 'The written trial ratio must match the structured target.'
  const writtenDays = String(title || '').match(/\b(?:across|over|for|on)\s+(\d+)\s+(?:separate\s+|distinct\s+|different\s+|trial\s+)*days?\b/i)
  if (writtenDays && Number(writtenDays[1]) !== days)
    return 'The written number of days must match the structured qualifying days.'
  return null
}
