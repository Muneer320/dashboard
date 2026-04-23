import React, { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Overview from './tabs/Overview'
import Participants from './tabs/Participants'
import Scanner from './tabs/Scanner'
import MyEvents from './tabs/MyEvents'
import EventDetail from './tabs/EventDetail'
import ContactInfo from './tabs/ContactInfo'
import Meals from './tabs/Meals'
import ManageRegistrations from './tabs/ManageRegistrations'
import Announcements from './tabs/Announcements'
import RequestedMembers from './tabs/RequestedMembers'
import AdminUsers from './tabs/AdminUsers'
import './Dashboard.css'

export default function Dashboard() {
  const { canAccess, user } = useAuth()
  const defaultTab = user?.role === 'Scanner' ? '/admin/dashboard/scanner' : '/admin/dashboard/overview'

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)

  return (
    <div className="app-shell">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {/* Mobile overlay for sidebar */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      <div className={`main-content ${isSidebarOpen ? 'shifted' : ''}`}>
        <Topbar toggleSidebar={toggleSidebar} />
        <main className="page-area">
          <Routes>
            <Route path="/" element={<Navigate to={defaultTab} replace />} />
            <Route path="*" element={<Navigate to={defaultTab} replace />} />
            <Route path="overview"     element={canAccess('overview')     ? <Overview />     : <Forbidden />} />
            <Route path="participants" element={canAccess('participants') ? <Participants />  : <Forbidden />} />
            <Route path="scanner/*"    element={canAccess('scanner')     ? <Scanner />      : <Forbidden />} />
            <Route path="events"           element={canAccess('myEvents')    ? <MyEvents />     : <Forbidden />} />
            <Route path="events/:eventId"   element={canAccess('myEvents')    ? <EventDetail />  : <Forbidden />} />
            <Route path="contact"      element={canAccess('contactInfo') ? <ContactInfo />  : <Forbidden />} />
            <Route path="admins"       element={canAccess('adminUsers')  ? <AdminUsers />   : <Forbidden />} />
            <Route path="meals"        element={canAccess('meals')       ? <Meals />        : <Forbidden />} />
            <Route path="manage-registrations" element={canAccess('manageRegistrations') ? <ManageRegistrations /> : <Forbidden />} />
            <Route path="announcements"        element={canAccess('announcements')       ? <Announcements />        : <Forbidden />} />
            <Route path="requested-members"    element={canAccess('requestedMembers')    ? <RequestedMembers />     : <Forbidden />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function Forbidden() {
  return (
    <div className="forbidden fade-in">
      <div className="forbidden-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
      </div>
      <h2>Access Denied</h2>
      <p>You don't have permission to view this page.</p>
    </div>
  )
}
