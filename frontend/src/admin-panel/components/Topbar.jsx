import React from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Topbar.css'

const PAGE_TITLES = {
  '/dashboard/overview':     { title: 'Overview',      sub: 'Dashboard summary' },
  '/dashboard/participants': { title: 'Participants',   sub: 'Manage event participants' },
  '/dashboard/scanner':      { title: 'Scanner',        sub: 'QR-based check-in & tracking' },
  '/dashboard/events':       { title: 'My Events',      sub: 'Events & submissions' },
  '/dashboard/contact':      { title: 'Contact Info',   sub: 'Event manager contacts' },
}

export default function Topbar({ toggleSidebar }) {
  const { user } = useAuth()
  const { pathname } = useLocation()

  const base = '/' + pathname.split('/').slice(1, 3).join('/')
  const meta = PAGE_TITLES[base] || { title: 'Dashboard', sub: '' }

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="hamburger-btn" onClick={toggleSidebar}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div className="topbar-titles">
          <h2 className="topbar-title">{meta.title}</h2>
          <span className="topbar-sub">{meta.sub}</span>
        </div>
      </div>
      <div className="topbar-right">
        <span className="topbar-date">{dateStr}</span>
        <div className="topbar-user">
          <div className="topbar-avatar">{user?.username?.charAt(0).toUpperCase()}</div>
        </div>
      </div>
    </header>
  )
}
