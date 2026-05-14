import React, { useEffect, useState } from 'react'
import { useData } from '../../context/DataContext'
import './ContactInfo.css'

export default function ContactInfo() {
  const { events, adminUsers, loadAdminUsers } = useData()
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadAdminUsers()
  }, [loadAdminUsers])

  const eventManagers = adminUsers.filter(u => u.role === 'eventManager')

  // Group managers by event — em.events[] stores event IDs
  const eventManagerMap = events.map(ev => ({
    event: ev,
    managers: eventManagers.filter(em => em.events.includes(ev.id))
  }))

  const filtered = eventManagerMap.filter(({ event, managers }) => {
    const q = search.toLowerCase()
    return (
      event.name.toLowerCase().includes(q) ||
      managers.some(m =>
        m.name.toLowerCase().includes(q) ||
        m.mail.toLowerCase().includes(q) ||
        m.phone?.includes(q)
      )
    )
  })

  return (
    <div className="contact-page fade-in">
      <div className="section-header">
        <span className="section-title">Contact Information</span>
        <div className="search-wrap">
          <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            id="contact-search"
            className="input-field"
            style={{ paddingLeft: '34px', width: '200px', fontSize: '0.85rem' }}
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="contact-grid">
        {filtered.map(({ event, managers }) => (
          <div key={event.id} className="contact-card">
            <div className="contact-card-header">
              <div className="contact-event-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <h3 className="contact-event-name">{event.name}</h3>
                <div className="contact-event-meta">
                  <span className="badge badge-accent">{event.category}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {event.venue}
                  </span>
                </div>
              </div>
              <span className="manager-count">{managers.length} manager{managers.length !== 1 ? 's' : ''}</span>
            </div>

            {managers.length === 0 ? (
              <p className="no-managers">No event managers assigned</p>
            ) : (
              <div className="managers-list">
                {managers.map(m => (
                  <div key={m.username} className="manager-row">
                    <div className="manager-avatar">{m.name.charAt(0)}</div>
                    <div className="manager-info">
                      <span className="manager-name">{m.name}</span>
                      <span className="manager-handle">@{m.username}</span>
                    </div>
                    <div className="manager-contacts">
                      <a href={`tel:${m.phone}`} className="contact-link" id={`phone-${m.username}`}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        {m.phone || '—'}
                      </a>
                      <a href={`mailto:${m.mail}`} className="contact-link" id={`email-${m.username}`}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                          <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        {m.mail}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
