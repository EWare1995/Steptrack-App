'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const INVITE_ROLES = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'therapist', label: 'Therapist' },
  { value: 'aide', label: 'Aide' },
  { value: 'parent', label: 'Additional parent' }
]

export default function TeamDashboard({ team, names, uid, parent, cid, kid, onRevoke, onName, onDeleteChild, onJoin }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('teacher')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviting, setInviting] = useState(false)
  const [createdLinks, setCreatedLinks] = useState([])
  const [displayName, setDisplayName] = useState(names[uid] || '')
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinMessage, setJoinMessage] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    setCreatedLinks([])
    setInviteLink('')
    setInviteCode('')
    setInviteMessage('')
    setConfirmRemove(null)
    setConfirmDelete(false)
  }, [cid])

  const visibleTeam = parent ? team : team.filter(member => member.user_id === uid)

  async function createInvite(event) {
    event.preventDefault()
    if (!parent || inviting || !email.trim()) return
    setInviting(true)
    setInviteMessage('')
    setInviteCode('')
    setInviteLink('')
    try {
      const result = await supabase.rpc('create_invite', {
        _child: cid,
        _email: email.trim(),
        _role: role
      })
      if (result.error) throw result.error
      const link = new URL('/', window.location.origin)
      link.searchParams.set('invite', result.data)
      const created = { email: email.trim(), role, link: link.toString() }
      setInviteCode(result.data)
      setInviteLink(created.link)
      setCreatedLinks(previous => [created, ...previous])
      setEmail('')
      setInviteMessage('Invitation link created. Copy it and send it privately to the invited person.')
    } catch (error) {
      setInviteMessage(error.message || 'Unable to create invitation.')
    } finally {
      setInviting(false)
    }
  }

  async function copyLink(link) {
    try {
      await navigator.clipboard.writeText(link)
      setInviteMessage('Invitation link copied. Share it privately with the invited person.')
    } catch {
      setInviteMessage('Select the link above to copy it manually.')
    }
  }

  async function joinWithCode(event) {
    event.preventDefault()
    if (!joinCode.trim() || joining) return
    setJoining(true)
    setJoinMessage('')
    try {
      const result = await supabase.rpc('accept_invite', { _token: joinCode.trim() })
      if (result.error) throw result.error
      setJoinCode('')
      await onJoin(result.data)
    } catch (error) {
      setJoinMessage(error.message || 'Unable to join this student team.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="team-dashboard">
      <div className="card team-header">
        <div>
          <p className="team-eyebrow">TEAM ACCESS</p>
          <h2>{kid.name}'s support team</h2>
          <p className="sm">See who can access this student's information and manage collaboration.</p>
        </div>
        <div className="team-count"><strong>{visibleTeam.length}</strong><span>{parent ? 'Active members' : 'Your membership'}</span></div>
      </div>

      <div className="team-layout">
        <section className="card team-panel">
          <div className="team-panel-heading">
            <div><h3>Team members</h3><p className="sm">Access is assigned through verified invitations.</p></div>
            <span className="team-status">{visibleTeam.length} active</span>
          </div>
          <div className="team-member-list">
            {visibleTeam.map(member => {
              const isSelf = member.user_id === uid
              const name = names[member.user_id] || (isSelf ? 'You' : 'Team member')
              const canRemove = parent && !isSelf && member.role !== 'parent'
              return (
                <div className="team-member" key={member.id}>
                  <div className="team-avatar" aria-hidden="true">{String(name).trim().slice(0, 1).toUpperCase()}</div>
                  <div className="team-member-info">
                    <div className="team-member-name">{name}{isSelf && <span className="team-you">You</span>}</div>
                    <div className="team-member-role">{member.role === 'parent' ? 'Parent' : member.role.charAt(0).toUpperCase() + member.role.slice(1)}</div>
                    <div className="team-member-rights">{member.can_log ? 'Can log progress' : 'View only'}{member.can_edit_goals ? ' · Can edit goals' : ''}</div>
                  </div>
                  {canRemove && (
                    <div className="team-member-actions">
                      {confirmRemove === member.id ? (
                        <>
                          <button className="team-danger-button" type="button" onClick={() => { setConfirmRemove(null); onRevoke(member.id) }}>Confirm removal</button>
                          <button type="button" onClick={() => setConfirmRemove(null)}>Cancel</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setConfirmRemove(member.id)} aria-label={'Remove access for ' + name}>Remove</button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {!parent && <p className="sm team-note">Only parents can manage invitations and other team members.</p>}
        </section>

        {parent && (
          <section className="card team-panel">
            <div className="team-panel-heading">
              <div><h3>Invite a collaborator</h3><p className="sm">Invite someone using the exact email address they will sign in with.</p></div>
            </div>
            <form onSubmit={createInvite} className="team-invite-form">
              <label htmlFor="team-invite-email">Email address</label>
              <input id="team-invite-email" type="email" required placeholder="name@school.org" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
              <label htmlFor="team-invite-role">Assign a role</label>
              <select id="team-invite-role" value={role} onChange={event => setRole(event.target.value)}>
                {INVITE_ROLES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <button className="btn" disabled={inviting} type="submit">{inviting ? 'Creating invitation…' : 'Create invitation link'}</button>
              <p className="sm">Each invitation is valid for 7 days. The recipient must verify the invited email address before access is granted.</p>
            </form>
            {inviteMessage && <p className="sm" role="status">{inviteMessage}</p>}
            {inviteLink && (
              <div className="team-share">
                <label htmlFor="team-share-link">Private invitation link</label>
                <input id="team-share-link" value={inviteLink} readOnly onFocus={event => event.target.select()} />
                <button type="button" className="btn g" onClick={() => copyLink(inviteLink)}>Copy invite link</button>
                <details>
                  <summary>Backup invite code</summary>
                  <input aria-label="Backup invite code" value={inviteCode} readOnly onFocus={event => event.target.select()} />
                </details>
              </div>
            )}
          </section>
        )}

        {parent && (
          <section className="card team-panel">
            <h3>Invitations created this session</h3>
            <p className="sm">For now, only links created on this screen are shown. Delivery, acceptance status, and server-side revocation require a separate reviewed backend update.</p>
            {createdLinks.length === 0 ? (
              <p className="team-empty">New invitation links will appear here until you leave or refresh this page.</p>
            ) : createdLinks.map((entry, index) => (
              <div className="team-recent-invite" key={entry.link + index}>
                <div><strong>{entry.email}</strong><div className="sm">{entry.role} · Link created, not yet confirmed as delivered</div></div>
                <button type="button" className="btn g" onClick={() => copyLink(entry.link)}>Copy link</button>
              </div>
            ))}
          </section>
        )}

        <section className="card team-panel">
          <h3>Your profile</h3>
          <label htmlFor="team-display-name">Display name</label>
          <input id="team-display-name" placeholder="e.g. Ms. Lee" value={displayName} onChange={event => setDisplayName(event.target.value)} />
          <button type="button" className="btn g" onClick={() => onName(displayName.trim())} disabled={!displayName.trim()}>Save display name</button>
          <details className="team-advanced">
            <summary>Have an invitation code instead?</summary>
            <p className="sm">Use this option if an invitation link cannot be opened.</p>
            <form onSubmit={joinWithCode}>
              <label htmlFor="team-manual-code">Invitation code</label>
              <input id="team-manual-code" value={joinCode} onChange={event => setJoinCode(event.target.value)} />
              <button className="btn g" type="submit" disabled={joining || !joinCode.trim()}>{joining ? 'Joining…' : 'Join student team'}</button>
              {joinMessage && <p className="err" role="alert">{joinMessage}</p>}
            </form>
          </details>
        </section>
      </div>

      {parent && (
        <details className="card team-danger-zone">
          <summary>Advanced student settings</summary>
          <p className="sm">Deleting a student also deletes their associated records. This cannot be undone.</p>
          <button type="button" className="team-danger-button" onClick={() => {
            if (confirmDelete) onDeleteChild()
            else setConfirmDelete(true)
          }}>{confirmDelete ? 'Confirm permanent deletion' : 'Delete this student'}</button>
          {confirmDelete && <button type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>}
        </details>
      )}
    </div>
  )
}
