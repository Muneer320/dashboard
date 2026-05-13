import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { adminPanel, events as eventsApi, qr } from '../../lib/api'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { user } = useAuth()

  const [events, setEvents]               = useState([])   // EventStatsItem[] shape
  const [adminUsers, setAdminUsers]       = useState([])   // AdminUserItem[]
  const [participants, setParticipants]   = useState([])   // ParticipantItem[]
  const [stats, setStats]                 = useState({
    totalRegistered: 0,
    totalTeams:      0,
    attending:       0,
    restricted:      0,
    foodClaimed:     0,
    entryScanned:    0,
    submitted:       0,
    submittedTeams:  0,
    eventCount:      0,
  })
  const [eventsMealsCount, setEventsMealsCount] = useState([])  // [{ id, name, meals_count }]
  const [maxMealsCount, setMaxMealsCount]       = useState(0)   // cap = sum of all events' meals_count
  const [userMeals, setUserMeals]               = useState([])  // UserMealsRow[]
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  // ── Fetch helpers ───────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const data = await adminPanel.stats()
      // Backend returns camelCase directly (StatsResponse schema uses camelCase)
      setStats({
        totalRegistered: data.totalRegistered  ?? 0,
        totalTeams:      data.totalTeams       ?? 0,
        attending:       data.attending        ?? 0,
        restricted:      data.restricted       ?? 0,
        foodClaimed:     data.foodClaimed      ?? 0,
        entryScanned:    data.entryScanned     ?? 0,
        submitted:       data.submitted        ?? 0,
        submittedTeams:  data.submittedTeams   ?? 0,
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

  const loadAdminUsers = useCallback(async () => {
    // Only admin can see all admin users — EM and Scanner get empty list
    if (user?.role !== 'admin') return
    try {
      const data = await adminPanel.adminUsers()
      setAdminUsers(data ?? [])
    } catch (e) {
      console.error('Admin users fetch failed:', e.message)
    }
  }, [user?.role])

  const loadMeals = useCallback(async () => {
    // Admin-only endpoints. The scanner auto-assigns slots server-side and
    // doesn't need these reads.
    if (user?.role !== 'admin') return
    try {
      const [perEvent, perUser] = await Promise.all([
        adminPanel.eventsMealsCount(),
        adminPanel.userMeals(),
      ])
      setEventsMealsCount(perEvent ?? [])
      setMaxMealsCount(perUser?.max_meals_count ?? 0)
      setUserMeals(perUser?.users ?? [])
    } catch (e) {
      if (e?.status !== 403) {
        console.error('Meals fetch failed:', e.message)
      }
    }
  }, [user?.role])

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    await Promise.all([
      loadStats(),
      loadParticipants(),
      loadEvents(),
      loadAdminUsers(),
      loadMeals(),
    ])
    setLoading(false)
  }, [user, loadStats, loadParticipants, loadEvents, loadAdminUsers, loadMeals])

  useEffect(() => { loadAll() }, [loadAll])

  // Merge meals_count into events for easier access in components
  const eventsWithMeals = events.map(ev => {
    const mealData = eventsMealsCount.find(m => m.id === ev.id)
    return { ...ev, meals_count: mealData?.meals_count || 0 }
  })

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

  // QR scan actions — POST /qr/scan. Returns `{ status, message }` so the
  // caller (Scanner UI) can show a green/red alert. `status` is:
  //   'accepted' — scan applied successfully
  //   'rejected' — server accepted the request but the scan was a no-op
  //                 (already claimed, not registered, etc.)
  //   'error'    — request failed (bad input / 4xx / network)
  const _scan = useCallback(async (participantId, scanType, { event_id = null } = {}) => {
    try {
      const res = await qr.scan({ user_id: participantId, scan_type: scanType, event_id })
      return { ...(res || {}), status: res?.status || 'accepted' }
    } catch (e) {
      console.error(`Scan (${scanType}) failed:`, e.message)
      return { status: 'error', message: e?.message || 'Scan failed' }
    }
  }, [])

  const markEntryScanned = useCallback(async (id) => {
    // Main-gate / college entry — no event context required.
    const res = await _scan(id, 'entry')
    if (res.status === 'accepted') {
      setParticipants(prev => prev.map(p => p.id === id ? { ...p, entryScanned: true } : p))
    }
    return res
  }, [_scan])

  const markAttended = useCallback(async (id, eventId) => {
    const res = await _scan(id, 'attendance', { event_id: eventId })
    if (res.status === 'accepted') {
      // Event-entry also flips top-level is_attending on the server, so mirror it here.
      setParticipants(prev => prev.map(p =>
        p.id === id ? { ...p, isAttending: true, entryScanned: true } : p
      ))
    }
    return res
  }, [_scan])

  const markFoodClaimed = useCallback(async (id, eventId) => {
    // Backend increments meal_count for this specific event
    const res = await _scan(id, 'food', { event_id: eventId })
    if (res.status === 'accepted') {
      setParticipants(prev => prev.map(p => p.id === id ? { ...p, foodClaimed: true } : p))
    }
    return res
  }, [_scan])

  // ── Meals admin mutations ───────────────────────────────────────────────────

  const updateEventMealsCount = useCallback(async (eventId, count) => {
    const res = await adminPanel.setEventMealsCount(eventId, count)
    setEventsMealsCount(prev => prev.map(e =>
      e.id === eventId ? { ...e, meals_count: res?.meals_count ?? count } : e
    ))
    // Re-pull the user matrix so everyone's allowance/columns stay in sync.
    await loadMeals()
  }, [loadMeals])

  const _toggleUserMealLocal = (userId, mealId, claimed) =>
    setUserMeals(prev => prev.map(row => {
      if (row.user_id !== userId) return row
      const claims = row.claims.map(c =>
        c.meal_id === mealId ? { ...c, claimed } : c,
      )
      const delta = claimed ? 1 : -1
      // Clamp to [0, allowance] so stale data doesn't make the count go negative.
      const nextClaimed = Math.max(0, Math.min((row.allowance ?? 0), (row.claimed ?? 0) + delta))
      return { ...row, claims, claimed: nextClaimed }
    }))

  const addMealEntry = useCallback(async (userId, mealId) => {
    await adminPanel.addUserMeal(userId, mealId)
    _toggleUserMealLocal(userId, mealId, true)
  }, [])

  const removeMealEntry = useCallback(async (userId, mealId) => {
    await adminPanel.removeUserMeal(userId, mealId)
    _toggleUserMealLocal(userId, mealId, false)
  }, [])

  return (
    <DataContext.Provider value={{
      events: eventsWithMeals, adminUsers, participants, stats,
      eventsMealsCount, maxMealsCount, userMeals,
      loading, error,
      reload:               loadAll,
      loadParticipants,
      loadAdminUsers,
      loadMeals,
      updateParticipantStatus,
      markAttended, markFoodClaimed, markEntryScanned,
      updateEventMealsCount, addMealEntry, removeMealEntry,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
