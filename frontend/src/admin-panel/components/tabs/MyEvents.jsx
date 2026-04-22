import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import './MyEvents.css'

// ── Submission Modal (rendered via portal onto document.body) ──────────────────
// Using createPortal bypasses ALL parent stacking contexts (overflow, transform,
// filter, will-change) that would otherwise clip a position:fixed overlay.

function SubmissionModal({ participant, onClose }) {
  const { name, username, eventName, submissionData } = participant

  // Collect submitted phases only
  const phases = Object.entries(submissionData || {})
    .filter(([, phaseData]) => typeof phaseData === 'object' && phaseData !== null && phaseData?.submitted)
    .sort(([a], [b]) => a.localeCompare(b))

  function fmtDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function fmtLabel(qid) {
    return (qid || '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  function renderAnswer(answer) {
    if (answer === null || answer === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>
    if (Array.isArray(answer)) {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {answer.map((v, i) => (
            <span key={i} style={chipStyle}>{String(v)}</span>
          ))}
        </div>
      )
    }
    const str = String(answer)
    if (/^https?:\/\//i.test(str)) {
      return (
        <a href={str} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          {str.length > 60 ? str.slice(0, 60) + '…' : str}
        </a>
      )
    }
    return <span style={{ color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{str}</span>
  }

  const modal = (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={avatarStyle}>{(name || '?').charAt(0).toUpperCase()}</div>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f0f0f8' }}>{name}</h2>
                <p style={{ margin: 0, fontSize: 12, color: '#60607a' }}>{username}</p>
              </div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={infoBadgeStyle}>{eventName}</span>
              <span style={successBadgeStyle}>✓ {phases.length} phase{phases.length !== 1 ? 's' : ''} submitted</span>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Phase sections */}
        {phases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#60607a' }}>
            No submitted phases found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', maxHeight: 'calc(80vh - 160px)', paddingRight: 4 }}>
            {phases.map(([phaseKey, phaseData]) => {
              const phaseNum = phaseKey.replace('phase', '')
              const answers = Array.isArray(phaseData.answers) ? phaseData.answers : []
              return (
                <div key={phaseKey} style={phaseCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={phaseNumStyle}>P{phaseNum}</div>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#f0f0f8' }}>Phase {phaseNum}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#60607a', textAlign: 'right' }}>
                      <div>Submitted</div>
                      <div style={{ color: '#a0a0b8', marginTop: 2 }}>{fmtDate(phaseData.submitted_at)}</div>
                    </div>
                  </div>

                  {answers.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: '#60607a' }}>No answers recorded.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {answers.map((a, i) => (
                        <div key={i} style={qaRowStyle}>
                          <div style={qLabelStyle}>{fmtLabel(a.question_id)}</div>
                          <div style={{ fontSize: 13 }}>{renderAnswer(a.answer)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  // Portal onto document.body — completely escapes any parent stacking context
  return createPortal(modal, document.body)
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MyEvents() {
  const { user, isAdmin } = useAuth()
  const { events, participants } = useData()

  const [modalParticipant, setModalParticipant] = useState(null)
  const [activeEventId, setActiveEventId]       = useState(null)

  const visibleEvents = isAdmin
    ? events
    : events.filter(ev => user?.events?.includes(ev.id))

  // Auto-select first event if nothing is selected yet
  const selectedId    = activeEventId ?? visibleEvents[0]?.id
  const selectedEvent = visibleEvents.find(ev => ev.id === selectedId)

  return (
    <div className="myevents-page fade-in">
      <div className="section-header">
        <span className="section-title">{isAdmin ? 'All Events' : 'My Events'}</span>
        <span className="badge badge-accent">{visibleEvents.length} events</span>
      </div>

      {visibleEvents.length === 0 ? (
        <div className="empty-state">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p>No events assigned.</p>
        </div>
      ) : (
        <>
          {/* ── Event tab bar ──────────────────────────────────────────────── */}
          <div className="event-tab-bar">
            {visibleEvents.map(ev => {
              const evParticipants = participants.filter(p => p.eventId === ev.id)
              const submittedCount = evParticipants.filter(p => p.submitted).length
              return (
                <button
                  key={ev.id}
                  className={`event-tab-btn ${ev.id === selectedId ? 'active' : ''}`}
                  onClick={() => setActiveEventId(ev.id)}
                >
                  <span className="etb-name">{ev.name}</span>
                  <span className="etb-chips">
                    <span className="etb-chip">{evParticipants.length} reg</span>
                    {submittedCount > 0 && (
                      <span className="etb-chip etb-chip-submitted">{submittedCount} sub</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {/* ── Selected event block ───────────────────────────────────────── */}
          {selectedEvent && (
            <EventBlock
              event={selectedEvent}
              participants={participants}
              onViewSubmission={setModalParticipant}
            />
          )}
        </>
      )}

      {/* Modal via portal — renders on document.body, no stacking context issues */}
      {modalParticipant && (
        <SubmissionModal
          participant={modalParticipant}
          onClose={() => setModalParticipant(null)}
        />
      )}
    </div>
  )
}

// ── Event block ────────────────────────────────────────────────────────────────

function EventBlock({ event, participants, onViewSubmission }) {
  const evParticipants = participants.filter(p => p.eventId === event.id)

  return (
    <div className="event-block">
      {/* Event heading */}
      <div className="event-block-header">
        <div className="event-meta">
          <h3 className="event-block-title">{event.name}</h3>
          <div className="event-chips">
            {event.category && <span className="badge badge-accent">{event.category}</span>}
            <span className="badge badge-info">
              {event.date ? new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {Array.isArray(event.venue) ? event.venue.join(', ') : event.venue}
            </span>
          </div>
        </div>
        <div className="event-mini-stats">
          <div className="mini-stat">
            <span className="mini-val">{evParticipants.length}</span>
            <span className="mini-label">Registered</span>
          </div>
          <div className="mini-stat">
            <span className="mini-val">{evParticipants.filter(p => p.submitted).length}</span>
            <span className="mini-label">Submitted</span>
          </div>
          <div className="mini-stat">
            <span className="mini-val" style={{ color: 'var(--success)' }}>
              {evParticipants.filter(p => p.isAttending).length}
            </span>
            <span className="mini-label">Attended</span>
          </div>
        </div>
      </div>

      {/* Participants table */}
      {evParticipants.length === 0 ? (
        <p style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          No participants registered yet.
        </p>
      ) : (
        <table className="data-table submissions-table">
          <thead>
            <tr>
              <th>Participant</th>
              <th>Team</th>
              <th>Status</th>
              <th>Attended</th>
              <th>Submission</th>
            </tr>
          </thead>
          <tbody>
            {evParticipants.map(p => (
              <tr key={p.id} className="submission-row">
                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  <div>{p.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{p.username}</div>
                </td>
                <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {p.teamId ? p.teamId.slice(0, 8) + '…' : '—'}
                </td>
                <td>
                  <span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                    {p.status === 'active' ? 'Active' : 'Restricted'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${p.isAttending ? 'badge-success' : 'badge-warning'}`}>
                    {p.isAttending ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>
                  {p.submitted ? (
                    <button
                      onClick={() => onViewSubmission({ ...p, eventName: event.name })}
                      style={viewBtnStyle}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                      </svg>
                      View Submission
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Not submitted</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Inline styles (use hardcoded hex values so they work outside .admin-theme) ──

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 99999,
  background: 'rgba(0, 0, 0, 0.75)',
  backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20,
  fontFamily: '"Inter", system-ui, sans-serif',
}

const modalStyle = {
  background: '#1c1c28',
  border: '1px solid rgba(124, 58, 237, 0.3)',
  borderRadius: 16,
  width: '100%',
  maxWidth: 700,
  maxHeight: '88vh',
  padding: '28px 30px',
  position: 'relative',
  boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)',
  overflowY: 'auto',
  color: '#f0f0f8',
}

const avatarStyle = {
  width: 38, height: 38, borderRadius: '50%',
  background: '#7c3aed',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0,
}

const closeBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#60607a', padding: 6, borderRadius: 8,
  display: 'flex', alignItems: 'center',
  transition: 'color .15s, background .15s',
}

const infoBadgeStyle = {
  display: 'inline-flex', alignItems: 'center',
  padding: '3px 10px', borderRadius: 999,
  background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
  color: '#93c5fd', fontSize: 11, fontWeight: 600,
}

const successBadgeStyle = {
  display: 'inline-flex', alignItems: 'center',
  padding: '3px 10px', borderRadius: 999,
  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
  color: '#6ee7b7', fontSize: 11, fontWeight: 600,
}

const phaseCardStyle = {
  background: '#16161f',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12,
  padding: '18px 20px',
}

const phaseNumStyle = {
  width: 28, height: 28, borderRadius: '50%',
  background: '#7c3aed',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 11, fontWeight: 700, color: '#fff',
}

const qaRowStyle = {
  paddingBottom: 12,
  borderBottom: '1px solid rgba(255,255,255,0.07)',
}

const qLabelStyle = {
  fontSize: 11, fontWeight: 600,
  color: '#60607a',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 5,
}

const chipStyle = {
  fontSize: 12, padding: '3px 10px', borderRadius: 999,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.07)',
  color: '#a0a0b8',
}

const linkStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  fontSize: 13, color: '#9d5af0',
  textDecoration: 'none', wordBreak: 'break-all',
}

const viewBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '5px 12px', borderRadius: 8,
  background: 'rgba(124, 58, 237, 0.12)',
  border: '1px solid rgba(124, 58, 237, 0.3)',
  color: '#9d5af0',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  transition: 'background .15s, border-color .15s',
}
