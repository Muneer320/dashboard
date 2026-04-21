import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import './MyEvents.css'

export default function MyEvents() {
  const { user, isAdmin } = useAuth()
  const { events, participants } = useData()

  const visibleEvents = isAdmin
    ? events
    : events.filter(ev => user?.events?.includes(ev.name))

  return (
    <div className="myevents-page fade-in">
      <div className="section-header">
        <span className="section-title">
          {isAdmin ? 'All Events' : 'My Events'}
        </span>
        <span className="badge badge-accent">{visibleEvents.length} events</span>
      </div>

      {visibleEvents.length === 0 ? (
        <div className="empty-state">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <p>No events assigned.</p>
        </div>
      ) : (
        <div className="events-list">
          {visibleEvents.map(ev => (
            <EventBlock key={ev.id} event={ev} participants={participants} />
          ))}
        </div>
      )}
    </div>
  )
}

function EventBlock({ event, participants }) {
  const evParticipants = participants.filter(p => p.event === event.name)
  const [expandedId, setExpandedId] = useState(null)

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <div className="event-block">
      {/* Event heading */}
      <div className="event-block-header">
        <div className="event-meta">
          <h3 className="event-block-title">{event.name}</h3>
          <div className="event-chips">
            <span className="badge badge-accent">{event.category}</span>
            <span className="badge badge-info">{new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{event.venue}</span>
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
            <span className="mini-val" style={{ color: 'var(--success)' }}>{evParticipants.filter(p => p.attended).length}</span>
            <span className="mini-label">Attended</span>
          </div>
        </div>
      </div>

      {/* Participants table */}
      {evParticipants.length === 0 ? (
        <p style={{ padding: '14px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No participants registered yet.</p>
      ) : (
        <table className="data-table submissions-table">
          <thead>
            <tr>
              <th style={{ width: 32 }} />
              <th>Participant</th>
              <th>Team</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Attended</th>
            </tr>
          </thead>
          <tbody>
            {evParticipants.map(p => (
              <React.Fragment key={p.id}>
                <tr
                  className={`submission-row${expandedId === p.id ? ' expanded' : ''}${p.submitted ? ' clickable' : ''}`}
                  onClick={() => p.submitted && toggleExpand(p.id)}
                >
                  <td>
                    {p.submitted && (
                      <span className={`expand-arrow${expandedId === p.id ? ' open' : ''}`}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ fontSize: '0.82rem' }}>{p.teamName || '—'}</td>
                  <td>
                    <span className={`badge ${p.status === 'participating' ? 'badge-success' : 'badge-danger'}`}>
                      {p.status === 'participating' ? 'Active' : 'Restricted'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${p.submitted ? 'badge-info' : 'badge-warning'}`}>
                      {p.submitted ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${p.attended ? 'badge-success' : 'badge-warning'}`}>
                      {p.attended ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>

                {/* Expanded submission links */}
                {expandedId === p.id && p.submission && (
                  <tr className="submission-detail-row fade-in">
                    <td />
                    <td colSpan={5}>
                      <div className="submission-links">
                        <a
                          href={p.submission.deployed || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`submission-link${!p.submission.deployed ? ' disabled-link' : ''}`}
                          id={`deployed-link-${p.id}`}
                          onClick={e => !p.submission.deployed && e.preventDefault()}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                          </svg>
                          Deployment Link
                          {!p.submission.deployed && <span style={{ fontSize: '0.7rem', opacity: 0.5 }}> (not provided)</span>}
                        </a>
                        <a
                          href={p.submission.repo || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`submission-link${!p.submission.repo ? ' disabled-link' : ''}`}
                          id={`repo-link-${p.id}`}
                          onClick={e => !p.submission.repo && e.preventDefault()}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                          </svg>
                          Repository Link
                          {!p.submission.repo && <span style={{ fontSize: '0.7rem', opacity: 0.5 }}> (not provided)</span>}
                        </a>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
