import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { adminPanel, events as eventsApi, qr } from '../../lib/api'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { user } = useAuth()

  const [events, setEvents]               = useState([])
  const [eventManagers, setEventManagers] = useState([])
  const [participants, setParticipants]   = useState([])
  const [stats, setStats]                 = useState({
    totalRegistered: 0,
    attending: 0,
    restricted: 0,
    foodClaimed: 0,
    entryScanned: 0,
    submitted: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  // ── Fetch helpers ───────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const data = await adminPanel.stats()
      setStats({
        totalRegistered: data.total_registered ?? 0,
        attending:       data.total_attending ?? 0,
        restricted:      data.total_restricted ?? 0,
        foodClaimed:     data.total_food_claimed ?? 0,
        entryScanned:    data.total_entry_scanned ?? data.total_attending ?? 0,
        submitted:       data.total_submitted ?? 0,
      })
    } catch (e) {
      console.error('Stats fetch failed:', e.message)
    }
  }, [])

  const loadParticipants = useCallback(async (eventId = null) => {
    try {
      const data = await adminPanel.participants(eventId)
      setParticipants(data ?? [])
    } catch (e) {
      console.error('Participants fetch failed:', e.message)
    }
  }, [])

  const loadEvents = useCallback(async () => {
    try {
      // Event managers see only their events; admins see all
      if (user?.role === 'admin') {
        const data = await eventsApi.list()
        setEvents(data ?? [])
      } else {
        // eventManager: /admin-panel/my-events returns MyEventItem[]
        const data = await adminPanel.myEvents()
        // Normalize shape to match the events[] used in the UI (name, id, date)
        setEvents((data ?? []).map(e => ({
          id:       e.event_id,
          name:     e.event_name,
          date:     e.start_date ?? '',
          category: e.category ?? '',
        })))
      }
    } catch (e) {
      console.error('Events fetch failed:', e.message)
    }
  }, [user?.role])

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    await Promise.all([loadStats(), loadParticipants(), loadEvents()])
    setLoading(false)
  }, [user, loadStats, loadParticipants, loadEvents])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Mutations ───────────────────────────────────────────────────────────────

  const updateParticipantStatus = useCallback(async (id, newStatus) => {
    try {
      await adminPanel.updateStatus(id, newStatus)
      setParticipants(prev =>
        prev.map(p => p.id === id ? { ...p, status: newStatus } : p)
      )
    } catch (e) {
      console.error('Status update failed:', e.message)
    }
  }, [])

  // QR scan actions — all go through POST /qr/scan
  const _scan = useCallback(async (participantId, scanType, eventId = null) => {
    try {
      const res = await qr.scan({ user_id: participantId, scan_type: scanType, event_id: eventId })
      return res
    } catch (e) {
      console.error(`Scan (${scanType}) failed:`, e.message)
      return null
    }
  }, [])

  const markEntryScanned = useCallback((id, eventId) =>
    _scan(id, 'entry', eventId).then(() =>
      setParticipants(prev => prev.map(p => p.id === id ? { ...p, entryScanned: true } : p))
    ), [_scan])

  const markAttended = useCallback((id, eventId) =>
    _scan(id, 'attendance', eventId).then(() =>
      setParticipants(prev => prev.map(p => p.id === id ? { ...p, isAttending: true } : p))
    ), [_scan])

  const markFoodClaimed = useCallback((id) =>
    _scan(id, 'food').then(() =>
      setParticipants(prev => prev.map(p => p.id === id ? { ...p, foodClaimed: true } : p))
    ), [_scan])

  return (
    <DataContext.Provider value={{
      events, eventManagers, participants, stats,
      loading, error,
      reload: loadAll,
      loadParticipants,
      updateParticipantStatus,
      markAttended, markFoodClaimed, markEntryScanned,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
