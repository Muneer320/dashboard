import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import QrScanner from '../QrScanner'
import './Scanner.css'

const SUB_TABS = [
  { key: 'entry',      label: 'Entry',      access: ['admin', 'scanner'] },
  { key: 'attendance', label: 'Attendance', access: ['admin', 'event_manager'] },
  { key: 'food',       label: 'Food',       access: ['admin', 'scanner'] },
]

export default function Scanner() {
  const { user, canAccess } = useAuth()
  const { participants, events, markAttended, markFoodClaimed, markEntryScanned } = useData()

  // Determine default tab based on access
  const firstAccessible = SUB_TABS.find(t => canAccess(`scan${t.key.charAt(0).toUpperCase() + t.key.slice(1)}`))
  const [activeTab, setActiveTab] = useState(firstAccessible?.key || 'attendance')

  // For attendance: event manager selects their event first
  const [selectedEvent, setSelectedEvent] = useState(null)

  const visibleTabs = SUB_TABS.filter(t =>
    canAccess(`scan${t.key.charAt(0).toUpperCase() + t.key.slice(1)}`)
  )

  // Participants in scope for the current tab
  function getScopeParticipants() {
    if (activeTab === 'attendance' && user?.role === 'event_manager') {
      if (!selectedEvent) return []
      return participants.filter(p => p.event === selectedEvent)
    }
    return participants
  }

  function handleScan(participant) {
    if (activeTab === 'entry')      markEntryScanned(participant.id)
    if (activeTab === 'attendance') markAttended(participant.id)
    if (activeTab === 'food')       markFoodClaimed(participant.id)
  }

  function getAlreadyField() {
    if (activeTab === 'entry')      return 'entryScanned'
    if (activeTab === 'attendance') return 'attended'
    if (activeTab === 'food')       return 'foodClaimed'
  }

  const emEvents = events.filter(ev => user?.events?.includes(ev.name))
  const isEM = user?.role === 'event_manager'

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
        {/* Attendance event selector for event managers */}
        {activeTab === 'attendance' && isEM && (
          <div className="attendance-event-select fade-in">
            <p className="select-label">Select your event to mark attendance:</p>
            <div className="em-event-list">
              {emEvents.map(ev => (
                <button
                  key={ev.id}
                  id={`em-event-${ev.id}`}
                  className={`em-event-btn${selectedEvent === ev.name ? ' active' : ''}`}
                  onClick={() => setSelectedEvent(ev.name)}
                >
                  <span className="em-event-name">{ev.name}</span>
                  <span className="em-event-date">{new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  <span className="em-event-count">
                    {participants.filter(p => p.event === ev.name && p.attended).length}
                    /{participants.filter(p => p.event === ev.name).length} attended
                  </span>
                </button>
              ))}
            </div>
            {selectedEvent && (
              <div className="selected-badge fade-in">
                Scanning attendance for: <strong>{selectedEvent}</strong>
                <button className="change-event-btn" onClick={() => setSelectedEvent(null)}>Change</button>
              </div>
            )}
          </div>
        )}

        {/* Show scanner only if ready */}
        {(activeTab !== 'attendance' || !isEM || selectedEvent) && (
          <div className="scanner-wrapper fade-in">
            <div className="scanner-header">
              <div className="scanner-title-block">
                <h3 className="scanner-mode-title">
                  {activeTab === 'entry' && 'Entry Check-in'}
                  {activeTab === 'attendance' && `Attendance${selectedEvent ? ` — ${selectedEvent}` : ''}`}
                  {activeTab === 'food' && 'Food Voucher'}
                </h3>
                <p className="scanner-mode-sub">
                  {activeTab === 'entry'      && 'Scan participant QR to grant event entry'}
                  {activeTab === 'attendance' && 'Mark participant as attended'}
                  {activeTab === 'food'       && 'Validate food voucher for participant'}
                </p>
              </div>
              <div className={`scanner-status-dot ${activeTab}`} />
            </div>

            <QrScanner
              participants={getScopeParticipants()}
              onScan={handleScan}
              alreadyField={getAlreadyField()}
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
  const field = activeTab === 'entry' ? 'entryScanned' : activeTab === 'attendance' ? 'attended' : 'foodClaimed'
  const scanned = participants.filter(p => p[field])

  if (scanned.length === 0) return null

  return (
    <div className="recent-scans">
      <p className="recent-label">Already processed ({scanned.length})</p>
      <div className="recent-list">
        {scanned.slice(-6).reverse().map(p => (
          <div key={p.id} className="recent-item">
            <div className="recent-avatar">{p.name.charAt(0)}</div>
            <div>
              <p className="recent-name">{p.name}</p>
              <p className="recent-event">{p.event}</p>
            </div>
            <span className="badge badge-success" style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>✓</span>
          </div>
        ))}
      </div>
    </div>
  )
}
