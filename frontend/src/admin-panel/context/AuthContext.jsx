import React, { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

const RAW_USERS = JSON.parse(import.meta.env.VITE_USERS || '[]')

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = sessionStorage.getItem('ascent_user')
    return stored ? JSON.parse(stored) : null
  })
  const [error, setError] = useState('')

  function login(username, password) {
    setError('')
    const found = RAW_USERS.find(
      u => u.username === username.trim() && u.password === password
    )
    if (!found) {
      setError('Invalid username or password.')
      return false
    }
    const userData = { ...found }
    delete userData.password
    setUser(userData)
    sessionStorage.setItem('ascent_user', JSON.stringify(userData))
    return true
  }

  function logout() {
    setUser(null)
    sessionStorage.removeItem('ascent_user')
  }

  // Role helpers
  const isAdmin   = user?.role === 'admin'
  const isScanner = user?.role === 'scanner'
  const isEM      = user?.role === 'event_manager'

  function canAccess(feature) {
    if (!user) return false
    const matrix = {
      overview:    ['admin', 'event_manager'],
      participants:['admin', 'event_manager'],
      scanner:     ['admin', 'scanner', 'event_manager'],
      myEvents:    ['admin', 'event_manager'],
      contactInfo: ['admin'],
      // scanner sub-tabs
      scanEntry:      ['admin', 'scanner'],
      scanAttendance: ['admin', 'event_manager'],
      scanFood:       ['admin', 'scanner'],
    }
    return (matrix[feature] || []).includes(user.role)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, error, setError, isAdmin, isScanner, isEM, canAccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
