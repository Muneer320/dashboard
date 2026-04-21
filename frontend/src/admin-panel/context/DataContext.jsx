import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { adminPanel, events as eventsApi, qr } from '../../lib/api'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { user } = useAuth()

  const [events, setEvents]               = useState([])   // EventStatsItem[] shape
  const [eventManagers, setEventManagers] = useState([])   // EventManagerItem[]
  const [participants, setParticipants]   = useState([])   // ParticipantItem[]
  const [stats, setStats]                 = useState({
    totalRegistered: 0,
    attending:       0,
    restricted:      0,
    foodClaimed:     0,
    entryScanned:    0,
    submitted:       0,
    eventCount:      0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  // ── Fetch helpers ───────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const data = await adminPanel.stats()
      // Backend returns camelCase directly (StatsResponse schema uses camelCase)
      setStats({
        totalRegistered: data.totalRegistered  ?? 0,
        attending:       data.attending        ?? 0,
        restricted:      data.restricted       ?? 0,
        foodClaimed:     data.foodClaimed      ?? 0,
        entryScanned:    data.entryScanned     ?? 0,
        submitted:       data.submitted        ?? 0,
        eventCount:      data.eventCount       ?? 0,
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
      // Use /admin-panel/events/stats — returns per-event breakdown with accurate counts
      // Works for both admin (all events) and eventManager (assigned events)
      const data = await adminPanel.eventsStats()
      setEvents(data ?? [])
    } catch (e) {
      console.error('Events (stats) fetch failed:', e.message)
    }
  }, [])

  const loadEventManagers = useCallback(async () => {
    // Only admin can see all event managers — EM and Scanner get empty list
    if (user?.role !== 'admin') return
    try {
      const data = await adminPanel.eventManagers()
      setEventManagers(data ?? [])
    } catch (e) {
      console.error('Event managers fetch failed:', e.message)
    }
  }, [user?.role])

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    await Promise.all([
      loadStats(),
      loadParticipants(),
      loadEvents(),
      loadEventManagers(),
    ])
    setLoading(false)
  }, [user, loadStats, loadParticipants, loadEvents, loadEventManagers])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Mutations ───────────────────────────────────────────────────────────────

  const updateParticipantStatus = useCallback(async (userId, newStatus, eventId) => {
    // Backend: PATCH /admin-panel/participants/{user_id}/restrict
    // Body:    { event_id: str, restricted: bool }
    const restricted = newStatus === 'restricted'
    try {
      await adminPanel.restrictParticipant(userId, eventId, restricted)
      setParticipants(prev =>
        prev.map(p => p.id === userId ? { ...p, status: restricted ? 'restricted' : 'active' } : p)
      )
    } catch (e) {
      console.error('Status update failed:', e.message)
    }
  }, [])

  // QR scan actions — POST /qr/scan
  const _scan = useCallback(async (participantId, scanType, eventId = null) => {
    try {
      return await qr.scan({ user_id: participantId, scan_type: scanType, event_id: eventId })
    } catch (e) {
      console.error(`Scan (${scanType}) failed:`, e.message)
      return null
    }
  }, [])

  const markEntryScanned = useCallback(async (id, eventId) => {
    const res = await _scan(id, 'entry', eventId)
    if (res) setParticipants(prev => prev.map(p => p.id === id ? { ...p, entryScanned: true } : p))
  }, [_scan])

  const markAttended = useCallback(async (id, eventId) => {
    const res = await _scan(id, 'attendance', eventId)
    if (res) setParticipants(prev => prev.map(p => p.id === id ? { ...p, isAttending: true } : p))
  }, [_scan])

  const markFoodClaimed = useCallback(async (id) => {
    const res = await _scan(id, 'food')
    if (res) setParticipants(prev => prev.map(p => p.id === id ? { ...p, foodClaimed: true } : p))
  }, [_scan])

  return (
    <DataContext.Provider value={{
      events, eventManagers, participants, stats,
      loading, error,
      reload:               loadAll,
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
