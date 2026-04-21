import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Sidebar.css'

const NAV_ITEMS = [
  {
    key: 'overview',
    label: 'Overview',
    path: '/admin/dashboard/overview',
    access: ['admin', 'event_manager'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    )
  },
  {
    key: 'participants',
    label: 'Participants',
    path: '/admin/dashboard/participants',
    access: ['admin', 'event_manager'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    )
  },
  {
    key: 'scanner',
    label: 'Scanner',
    path: '/admin/dashboard/scanner',
    access: ['admin', 'scanner', 'event_manager'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 7 23 1 17 1"/><line x1="16" y1="8" x2="23" y2="1"/>
        <polyline points="1 7 1 1 7 1"/><line x1="8" y1="8" x2="1" y2="1"/>
        <polyline points="23 17 23 23 17 23"/><line x1="16" y1="16" x2="23" y2="23"/>
        <polyline points="1 17 1 23 7 23"/><line x1="8" y1="16" x2="1" y2="23"/>
      </svg>
    )
  },
  {
    key: 'myEvents',
    label: 'My Events',
    path: '/admin/dashboard/events',
    access: ['admin', 'event_manager'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    )
  },
  {
    key: 'contactInfo',
    label: 'Contact Info',
    path: '/admin/dashboard/contact',
    access: ['admin'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    )
  },
  {
    key: 'meals',
    label: 'Meals',
    path: '/admin/dashboard/meals',
    access: ['admin'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {/* plate + fork + knife */}
        <circle cx="12" cy="12" r="9"/>
        <path d="M8 7v5a2 2 0 0 0 2 2v3"/>
        <path d="M15 7c-1 2-1 4 0 6v4"/>
      </svg>
    )
  }
]

export default function Sidebar() {
  const { user, logout, isAdmin, isScanner, isEM } = useAuth()
  const navigate = useNavigate()

  const visibleItems = NAV_ITEMS.filter(item => item.access.includes(user?.role))

  const roleLabel = { admin: 'Administrator', event_manager: 'Event Manager', scanner: 'Scanner' }
  const roleBadge = { admin: 'badge-accent', event_manager: 'badge-info', scanner: 'badge-warning' }

  function handleLogout() {
    logout()
    navigate('/admin/login')
  }

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <span className="brand-name">Ascent</span>
        <span className="brand-tag">Admin</span>
      </div>

      {/* User card */}
      <div className="sidebar-user">
        <div className="user-avatar">
          {user?.username?.charAt(0).toUpperCase()}
        </div>
        <div className="user-info">
          <span className="user-name">{user?.username}</span>
          <span className={`badge ${roleBadge[user?.role]}`}>{roleLabel[user?.role]}</span>
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* Nav */}
      <nav className="sidebar-nav">
        <p className="nav-section-label">Navigation</p>
        {visibleItems.map(item => (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-divider" />
        <button id="logout-btn" className="logout-btn" onClick={handleLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </div>
    </aside>
  )
}
