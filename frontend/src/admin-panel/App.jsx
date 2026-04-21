import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import './index.css'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/admin/login" replace />
}

function GuestRoute({ children }) {
  const { user } = useAuth()
  return !user ? children : <Navigate to="/admin/dashboard" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="dashboard/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  )
}

export default function AdminApp() {
  return (
    <div className="admin-theme">
      <div className="admin-theme-root">
        <AuthProvider>
          <DataProvider>
            <AppRoutes />
          </DataProvider>
        </AuthProvider>
      </div>
    </div>
  )
}
