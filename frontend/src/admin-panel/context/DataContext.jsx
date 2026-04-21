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
  const [mealsCount, setMealsCountState] = useState(3)        // festival-wide
  const [userMeals, setUserMeals]         = useState([])      // UserMealsRow[]
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

  const loadMeals = useCallback(async () => {
    // Admin-only endpoints. Scanner/EM just need the count for their picker,
    // but meals_count leaks through the /meals config route — we gate to admin
    // here and let the Scanner fall back to the last-known value or the default.
    if (user?.role !== 'admin') return
    try {
      const [config, perUser] = await Promise.all([
        adminPanel.mealsConfig(),
        adminPanel.userMeals(),
      ])
      setMealsCountState(config?.meals_count ?? 3)
      setUserMeals(perUser?.users ?? [])
    } catch (e) {
      console.error('Meals fetch failed:', e.message)
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
      loadMeals(),
    ])
    setLoading(false)
  }, [user, loadStats, loadParticipants, loadEvents, loadEventManagers, loadMeals])

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
  const _scan = useCallback(async (participantId, scanType, { event_id = null, meal = null } = {}) => {
    try {
      return await qr.scan({ user_id: participantId, scan_type: scanType, event_id, meal })
    } catch (e) {
      console.error(`Scan (${scanType}) failed:`, e.message)
      return null
    }
  }, [])

  const markEntryScanned = useCallback(async (id) => {
    // Main-gate / college entry — no event context required.
    const res = await _scan(id, 'entry')
    if (res) setParticipants(prev => prev.map(p => p.id === id ? { ...p, entryScanned: true } : p))
  }, [_scan])

  const markAttended = useCallback(async (id, eventId) => {
    const res = await _scan(id, 'attendance', { event_id: eventId })
    if (res) {
      // Event-entry also flips top-level is_attending on the server, so mirror it here.
      setParticipants(prev => prev.map(p =>
        p.id === id ? { ...p, isAttending: true, entryScanned: true } : p
      ))
    }
  }, [_scan])

  const markFoodClaimed = useCallback(async (id, mealId) => {
    if (!mealId) {
      console.error('markFoodClaimed: meal is required (e.g. "meal1")')
      return
    }
    const res = await _scan(id, 'food', { meal: mealId })
    if (res) setParticipants(prev => prev.map(p => p.id === id ? { ...p, foodClaimed: true } : p))
  }, [_scan])

  // ── Meals admin mutations ───────────────────────────────────────────────────

  const updateMealsCount = useCallback(async (count) => {
    const res = await adminPanel.setMealsCount(count)
    setMealsCountState(res?.meals_count ?? count)
    await loadMeals()  // re-pull user matrix so column count is in sync
  }, [loadMeals])

  const addMealEntry = useCallback(async (userId, mealId) => {
    await adminPanel.addUserMeal(userId, mealId)
    setUserMeals(prev => prev.map(row =>
      row.user_id === userId
        ? { ...row, claims: row.claims.map(c => c.meal_id === mealId ? { ...c, claimed: true } : c) }
        : row
    ))
  }, [])

  const removeMealEntry = useCallback(async (userId, mealId) => {
    await adminPanel.removeUserMeal(userId, mealId)
    setUserMeals(prev => prev.map(row =>
      row.user_id === userId
        ? { ...row, claims: row.claims.map(c => c.meal_id === mealId ? { ...c, claimed: false } : c) }
        : row
    ))
  }, [])

  return (
    <DataContext.Provider value={{
      events, eventManagers, participants, stats,
      mealsCount, userMeals,
      loading, error,
      reload:               loadAll,
      loadParticipants,
      loadMeals,
      updateParticipantStatus,
      markAttended, markFoodClaimed, markEntryScanned,
      updateMealsCount, addMealEntry, removeMealEntry,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
