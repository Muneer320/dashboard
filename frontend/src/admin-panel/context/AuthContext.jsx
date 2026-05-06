import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { adminAuth as adminAuthApi, token } from '../../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null)   // { uid, username, name, role, events }
  const [ready, setReady] = useState(false)  // true once we've checked stored token
  const [error, setError] = useState('')

  // On mount: hydrate session from stored admin token
  useEffect(() => {
    const stored = token.getAdmin()
    if (!stored) { setReady(true); return }
    adminAuthApi.me()
      .then(setUser)
      .catch(() => token.clearAdmin())  // invalid / expired
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (username, password) => {
    setError('')
    try {
      const res = await adminAuthApi.login({ username, password })
      token.setAdmin(res.access_token)
      const me = await adminAuthApi.me()
      setUser(me)
      return true
    } catch (e) {
      setError(e.message || 'Invalid credentials')
      return false
    }
  }, [])

  const logout = useCallback(() => {
    token.clearAdmin()
    setUser(null)
  }, [])

  // ── Role helpers (unchanged — role strings from backend match) ──────────────
  const isAdmin   = user?.role === 'admin'
  const isScanner = user?.role === 'Scanner'
  const isEM      = user?.role === 'eventManager'

  function canAccess(feature) {
    if (!user) return false
    const matrix = {
      overview:    ['admin', 'eventManager'],
      participants:['admin'],                         // EM accesses via event detail page
      scanner:     ['admin', 'Scanner', 'eventManager'],
      myEvents:    ['admin', 'eventManager'],
      contactInfo: ['admin'],
      adminUsers:  ['admin'],
      meals:          ['admin'],                      // EM accesses via event detail page
      scanEntry:      ['admin', 'Scanner'],
      scanAttendance: ['admin', 'eventManager'],
      scanFood:       ['admin', 'Scanner'],
      manageRegistrations: ['admin'],
      announcements:       ['admin'],
      requestedMembers:    ['admin'],

      // Sidequest features
      ugcQueue:     ['admin', 'prm_volunteer', 'prm_lead', 'ops_lead'],
      snapshot:     ['admin', 'prm_lead', 'ops_lead'],
      surpriseDrop: ['admin', 'prm_lead', 'ops_lead'],
      boothMonitor: ['admin', 'prm_volunteer', 'prm_lead', 'ops_lead'],
      engagement:   ['admin', 'prm_lead', 'ops_lead'],
      disputes:     ['admin', 'prm_volunteer', 'prm_lead', 'ops_lead'],
      inventory:    ['admin', 'prm_volunteer', 'prm_lead', 'ops_lead'],
      auditLog:      ['admin', 'ops_lead'],
      coinsOverview: ['admin', 'prm_lead', 'ops_lead'],
    }
    return (matrix[feature] || []).includes(user.role)
  }

  if (!ready) return null  // wait for token check — prevents flash of login page

  return (
    <AuthContext.Provider value={{ user, error, setError, login, logout, isAdmin, isScanner, isEM, canAccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
