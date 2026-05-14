import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import ConfirmModal from '../ConfirmModal'
import Pagination from '../Pagination'
import './Participants.css'

function ParticipantsSkeleton() {
  return (
    <div className="participants-page fade-in">
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div className="sk-line sk-h-6 sk-w-1-4" />
      </div>
      <div className="sk-row" style={{ marginBottom: 16, gap: 12 }}>
        <div className="sk-line sk-h-10" style={{ flex: 1 }} />
        <div className="sk-line sk-h-10" style={{ width: 180 }} />
      </div>
      <div className="sk-card" style={{ gap: 0, padding: 0, overflow: 'hidden' }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="sk-row" style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            gap: 16,
          }}>
            <div className="sk-line sk-h-5" style={{ width: 28 }} />
            <div className="sk-line sk-h-5" style={{ flex: 2 }} />
            <div className="sk-line sk-h-5" style={{ flex: 2 }} />
            <div className="sk-line sk-h-5 sk-w-1-4" />
            <div className="sk-line sk-h-5 sk-w-1-4" />
            <div className="sk-line sk-h-8" style={{ width: 80, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Participants() {
  const { user, isAdmin } = useAuth()
  const { events, participants, loading, participantsLoading, loadParticipants, updateParticipantStatus } = useData()

  const [selectedEvent, setSelectedEvent] = useState('all')
  const [searchQuery, setSearchQuery]     = useState('')
  const [confirmState, setConfirmState]   = useState(null) // { participantId, newStatus, name }
  const [currentPage, setCurrentPage]     = useState(1)
  const itemsPerPage = 10

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedEvent, searchQuery])

  useEffect(() => {
    loadParticipants()
  }, [loadParticipants])

  if (loading || participantsLoading) return <ParticipantsSkeleton />

  // For event manager: only show their events
  const visibleEvents = isAdmin
    ? events
    : events.filter(ev => user?.events?.includes(ev.id))

  const allOption = isAdmin ? 'all' : null

  // Participants filtered by event access + selected event + search
  const filtered = participants.filter(p => {
    const accessOk = isAdmin
      ? true
      : user?.events?.includes(p.eventId)

    const eventOk = selectedEvent === 'all'
      ? true
      : p.eventId === selectedEvent

    const searchOk = searchQuery.trim() === ''
      ? true
      : p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.username.toLowerCase().includes(searchQuery.toLowerCase())

    return accessOk && eventOk && searchOk
  })

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  function handleStatusToggle(p) {
    const newStatus = p.status === 'active' ? 'restricted' : 'active'
    setConfirmState({ participantId: p.id, eventId: p.eventId, newStatus, name: p.name })
  }

  function confirmChange() {
    if (confirmState) {
      updateParticipantStatus(confirmState.participantId, confirmState.newStatus, confirmState.eventId)
      setConfirmState(null)
    }
  }

  return (
    <div className="participants-page fade-in">
      {/* Filters */}
      <div className="filters-row">
        <div className="search-wrap">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="input-field search-input"
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            id="participants-search"
          />
        </div>

        <div className="event-tabs">
          {allOption && (
            <button
              className={`event-tab${selectedEvent === 'all' ? ' active' : ''}`}
              onClick={() => setSelectedEvent('all')}
            >
              All Events
            </button>
          )}
          {visibleEvents.map(ev => (
            <button
              key={ev.id}
              className={`event-tab${selectedEvent === ev.id ? ' active' : ''}`}
              onClick={() => setSelectedEvent(ev.id)}
            >
              {ev.name}
              <span className="tab-count">
                {participants.filter(p => p.eventId === ev.id && (isAdmin || user?.events?.includes(p.eventId))).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <p>No participants found.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Event</th>
                    <th>Team</th>
                    <th>Attended</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((p, idx) => (
                    <tr key={p.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</td>
                      <td style={{ fontSize: '0.8rem' }}>{p.username}</td>
                      <td><span className="badge badge-accent">{p.eventName}</span></td>
                      <td style={{ fontSize: '0.82rem' }}>{p.teamId || '—'}</td>
                      <td>
                        <span className={`badge ${p.isAttending ? 'badge-success' : 'badge-warning'}`}>
                          {p.isAttending ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                          {p.status === 'active' ? 'Participating' : 'Restricted'}
                        </span>
                      </td>
                      <td>
                        <button
                          id={`status-toggle-${p.id}`}
                          className={`btn btn-sm ${p.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => handleStatusToggle(p)}
                        >
                          {p.status === 'active' ? 'Restrict' : 'Restore'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={setCurrentPage} 
            />
          </>
        )}
      </div>

      {/* Confirm modal */}
      {confirmState && (
        <ConfirmModal
          title="Change Participant Status"
          message={
            confirmState.newStatus === 'restricted'
              ? `Are you sure you want to restrict ${confirmState.name}? They will lose access to the event.`
              : `Restore ${confirmState.name} back to participating status?`
          }
          confirmLabel={confirmState.newStatus === 'restricted' ? 'Restrict' : 'Restore'}
          isDanger={confirmState.newStatus === 'restricted'}
          onConfirm={confirmChange}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  )
}
