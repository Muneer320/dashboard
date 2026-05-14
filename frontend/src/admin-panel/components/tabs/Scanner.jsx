import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import QrScanner from '../QrScanner'
import './Scanner.css'

const SUB_TABS = [
  { key: 'entry',      label: 'Entry',      access: ['admin', 'Scanner'] },
  { key: 'attendance', label: 'Attendance', access: ['admin', 'eventManager'] },
  { key: 'food',       label: 'Food',       access: ['admin', 'Scanner'] },
]

export default function Scanner() {
  const { user, canAccess } = useAuth()
  const { participants, events, markAttended, markFoodClaimed, markEntryScanned } = useData()

  // Determine default tab based on access
  const firstAccessible = SUB_TABS.find(t => canAccess(`scan${t.key.charAt(0).toUpperCase() + t.key.slice(1)}`))
  const [activeTab, setActiveTab] = useState(firstAccessible?.key || 'attendance')

  // For attendance & food: operator selects the event first. Stores the event ID so
  // we can filter participants unambiguously (names collide).
  const [selectedEventId, setSelectedEventId] = useState(null)
  const selectedEvent = events.find(ev => ev.id === selectedEventId) || null

  // Events the operator can pick for attendance & food. Admins see all; EMs only theirs.
  const selectableEvents = user?.role === 'admin'
    ? events
    : events.filter(ev => (user?.events || []).includes(ev.id))
  const needsEventPick = activeTab === 'attendance' || activeTab === 'food'

  // Participants in scope for the current tab
  function getScopeParticipants() {
    if (activeTab === 'attendance' || activeTab === 'food') {
      if (!selectedEventId) return []
      return participants.filter(p => p.eventId === selectedEventId)
    }
    return participants
  }

  // onScan must return the server `{ status, message }` so the QR overlay
  // can turn green or red based on the real outcome.
  async function handleScan(participant) {
    if (activeTab === 'entry')      return markEntryScanned(participant.id)
    if (activeTab === 'attendance') return markAttended(participant.id, selectedEventId || participant.eventId)
    if (activeTab === 'food')       return markFoodClaimed(participant.id, selectedEventId || participant.eventId)
  }

  function getAlreadyField() {
    if (activeTab === 'entry')      return 'entryScanned'
    // Attendance & food: trust server validation, not stale client flags
    // (DB can change independently; backend knows the real state)
    return null
  }

  return (
    <div className="scanner-page fade-in">
      {/* Sub-tab bar */}
      <div className="scanner-tabs">
        {SUB_TABS.map(tab => {
          const accessible = canAccess(`scan${tab.key.charAt(0).toUpperCase() + tab.key.slice(1)}`)
          return (
            <button
              key={tab.key}
              id={`scanner-tab-${tab.key}`}
              className={`scanner-tab${activeTab === tab.key ? ' active' : ''}${!accessible ? ' disabled' : ''}`}
              onClick={() => accessible && setActiveTab(tab.key)}
              disabled={!accessible}
              title={!accessible ? 'Access restricted for your role' : ''}
            >
              {tab.label}
              {!accessible && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 4 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="scanner-content">
        {/* Event selector for attendance & food */}
        {needsEventPick && (
          <div className="attendance-event-select fade-in">
            <p className="select-label">
              {activeTab === 'attendance' ? 'Select the event to mark attendance:' : 'Select the event for food distribution:'}
            </p>
            {selectableEvents.length === 0 ? (
              <div className="em-event-empty">
                No events assigned to you. Ask an admin to assign events to your account.
              </div>
            ) : (
              <div className="em-event-list">
                {selectableEvents.map(ev => {
                   const evParticipants = participants.filter(p => p.eventId === ev.id)
                   const attended = evParticipants.filter(p => p.isAttending).length
                   return (
                     <button
                       key={ev.id}
                       id={`em-event-${ev.id}`}
                       className={`em-event-btn${selectedEventId === ev.id ? ' active' : ''}`}
                       onClick={() => setSelectedEventId(ev.id)}
                     >
                       <span className="em-event-name">{ev.name}</span>
                       <span className="em-event-count">
                         {activeTab === 'attendance' 
                           ? `${attended}/${evParticipants.length} attended`
                           : `${ev.meals_count || 0} meals`
                         }
                       </span>
                     </button>
                   )
                 })}
              </div>
            )}
            {selectedEvent && (
              <div className="selected-badge fade-in">
                {activeTab === 'attendance' 
                  ? `Scanning attendance for: ${selectedEvent.name}`
                  : `Distributing meals for: ${selectedEvent.name}`
                }
                <button className="change-event-btn" onClick={() => setSelectedEventId(null)}>Change</button>
              </div>
            )}
          </div>
        )}

        {/* Show scanner only if ready */}
        {((activeTab !== 'attendance' && activeTab !== 'food') || selectedEventId) && (
          <div className="scanner-wrapper fade-in">
            <div className="scanner-header">
              <div className="scanner-title-block">
                <h3 className="scanner-mode-title">
                  {activeTab === 'entry' && 'Entry Check-in'}
                  {activeTab === 'attendance' && `Attendance${selectedEvent ? ` — ${selectedEvent.name}` : ''}`}
                  {activeTab === 'food' && `Food${selectedEvent ? ` — ${selectedEvent.name}` : ''}`}
                </h3>
                <p className="scanner-mode-sub">
                  {activeTab === 'entry'      && 'Scan participant QR to grant main-gate entry'}
                  {activeTab === 'attendance' && 'Mark participant as attended for this event'}
                  {activeTab === 'food'       && 'Increment meal count for this event (user must be registered)'}
                </p>
              </div>
              <div className={`scanner-status-dot ${activeTab}`} />
            </div>

            <QrScanner
              participants={activeTab === 'attendance' || activeTab === 'food' ? getScopeParticipants() : participants}
              onScan={handleScan}
              alreadyField={getAlreadyField()}
              trustServer={activeTab === 'food'}
              actionLabel={
                activeTab === 'entry'      ? 'Entry' :
                activeTab === 'attendance' ? 'Attendance' : 'Food'
              }
            />

            {/* Live log for this session */}
            <RecentScans activeTab={activeTab} participants={participants} />
          </div>
        )}
      </div>
    </div>
  )
}

function RecentScans({ activeTab, participants }) {
  const field = activeTab === 'entry' ? 'entryScanned' : activeTab === 'attendance' ? 'isAttending' : 'foodClaimed'
  const scanned = participants.filter(p => p[field])

  if (scanned.length === 0) return null

  return (
    <div className="recent-scans">
      <p className="recent-label">Already processed ({scanned.length})</p>
      <div className="recent-list">
        {scanned.slice(-6).reverse().map(p => (
          <div key={`${p.id}-${p.eventId}`} className="recent-item">
            <div className="recent-avatar">{p.name.charAt(0)}</div>
            <div>
              <p className="recent-name">{p.name}</p>
              <p className="recent-event">{p.eventName}</p>
            </div>
            <span className="badge badge-success" style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>✓</span>
          </div>
        ))}
      </div>
    </div>
  )
}
