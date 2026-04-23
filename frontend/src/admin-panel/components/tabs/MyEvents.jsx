import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import './MyEvents.css'

export default function MyEvents() {
  const { user, isAdmin } = useAuth()
  const { events, participants } = useData()
  const navigate = useNavigate()

  const visibleEvents = isAdmin
    ? events
    : events.filter(ev => user?.events?.includes(ev.id))

  function handleCardClick(eventId) {
    navigate(`/admin/dashboard/events/${eventId}`)
  }

  function fmtDate(iso) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  return (
    <div className="myevents-page fade-in">
      <div className="section-header">
        <span className="section-title">{isAdmin ? 'All Events' : 'My Events'}</span>
        <span className="badge badge-accent">{visibleEvents.length} event{visibleEvents.length !== 1 ? 's' : ''}</span>
      </div>

      {visibleEvents.length === 0 ? (
        <div className="empty-state">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p>No events assigned.</p>
        </div>
      ) : (
        <div className="events-card-grid">
          {visibleEvents.map(ev => {
            const evParticipants = participants.filter(p => p.eventId === ev.id)
            const registeredCount = ev.registered ?? evParticipants.length
            const submittedCount  = ev.submitted  ?? evParticipants.filter(p => p.submitted).length
            const attendedCount   = ev.attended   ?? evParticipants.filter(p => p.isAttending).length

            return (
              <button
                key={ev.id}
                className="event-card"
                onClick={() => handleCardClick(ev.id)}
                aria-label={`Open event: ${ev.name}`}
              >
                {/* Card header */}
                <div className="ec-header">
                  <div className="ec-title-row">
                    <h3 className="ec-title">{ev.name}</h3>
                    <svg className="ec-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </div>
                  <div className="ec-meta">
                    {ev.category && (
                      <span className="badge badge-accent ec-badge">{ev.category}</span>
                    )}
                    {fmtDate(ev.date) && (
                      <span className="badge badge-info ec-badge">{fmtDate(ev.date)}</span>
                    )}
                  </div>
                  {(Array.isArray(ev.venue) ? ev.venue.length > 0 : !!ev.venue) && (
                    <div className="ec-venue">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      {Array.isArray(ev.venue) ? ev.venue.join(', ') : ev.venue}
                    </div>
                  )}
                </div>

                {/* Stats row */}
                <div className="ec-stats">
                  <div className="ec-stat">
                    <span className="ec-stat-val">{registeredCount}</span>
                    <span className="ec-stat-label">Registered</span>
                  </div>
                  <div className="ec-stat-divider"/>
                  <div className="ec-stat">
                    <span className="ec-stat-val ec-stat-attended">{attendedCount}</span>
                    <span className="ec-stat-label">Attended</span>
                  </div>
                  <div className="ec-stat-divider"/>
                  <div className="ec-stat">
                    <span className="ec-stat-val ec-stat-submitted">{submittedCount}</span>
                    <span className="ec-stat-label">Submitted</span>
                  </div>
                </div>

                {/* Footer hint */}
                <div className="ec-footer">
                  <span>View details</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
