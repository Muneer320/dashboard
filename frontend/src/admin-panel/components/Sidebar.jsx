import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Sidebar.css'

const NAV_ITEMS = [
  {
    key: 'overview',
    label: 'Overview',
    path: '/admin/dashboard/overview',
    access: ['admin', 'eventManager'],
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
    access: ['admin'],
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
    access: ['admin', 'Scanner', 'eventManager'],
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
    label: 'Events',
    path: '/admin/dashboard/events',
    access: ['admin', 'eventManager'],
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
    key: 'admins',
    label: 'Admins',
    path: '/admin/dashboard/admins',
    access: ['admin'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
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
        <circle cx="12" cy="12" r="9"/>
        <path d="M8 7v5a2 2 0 0 0 2 2v3"/>
        <path d="M15 7c-1 2-1 4 0 6v4"/>
      </svg>
    )
  },
  {
    key: 'manageRegistrations',
    label: 'Manage Registrations',
    path: '/admin/dashboard/manage-registrations',
    access: ['admin'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="8.5" cy="7" r="4"/>
        <line x1="20" y1="8" x2="20" y2="14"/>
        <line x1="23" y1="11" x2="17" y2="11"/>
      </svg>
    )
  },
  {
    key: 'announcements',
    label: 'Announcements',
    path: '/admin/dashboard/announcements',
    access: ['admin'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    )
  },
  {
    key: 'mirageMoments',
    label: 'Mirage Moments',
    path: '/admin/dashboard/mirage-moments',
    access: ['admin'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    )
  },
  {
    key: 'requestedMembers',
    label: 'Requested Members',
    path: '/admin/dashboard/requested-members',
    access: ['admin'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
        <line x1="19" y1="3" x2="19" y2="9"/>
        <line x1="22" y1="6" x2="16" y2="6"/>
      </svg>
    )
  },

  // ── Sidequest section ──────────────────────────────────────────────
  {
    section: 'Sidequest',
    key: 'ugcQueue', label: 'UGC Verification Queue',
    path: '/admin/dashboard/ugc-queue',
    access: ['admin', 'prm_volunteer', 'prm_lead', 'ops_lead'],
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  },
  {
    key: 'boothMonitor', label: 'Booth Monitor',
    path: '/admin/dashboard/booth-monitor',
    access: ['admin', 'prm_volunteer', 'prm_lead', 'ops_lead'],
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  },
  {
    key: 'engagement', label: 'Engagement',
    path: '/admin/dashboard/engagement',
    access: ['admin', 'prm_lead', 'ops_lead'],
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  },
  {
    key: 'disputes', label: 'Disputes',
    path: '/admin/dashboard/disputes',
    access: ['admin', 'prm_volunteer', 'prm_lead', 'ops_lead'],
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  },
  {
    key: 'inventory', label: 'Rewards',
    path: '/admin/dashboard/inventory',
    access: ['admin', 'prm_volunteer', 'prm_lead', 'ops_lead'],
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg>,
  },
  {
    key: 'auditLog', label: 'Audit Log',
    path: '/admin/dashboard/audit-log',
    access: ['admin', 'ops_lead'],
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
  {
    key: 'coinsOverview', label: 'Coins Overview',
    path: '/admin/dashboard/coins-overview',
    access: ['admin', 'prm_lead', 'ops_lead'],
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M9 9.5C9 8.1 10.3 7 12 7s3 1.1 3 2.5c0 1.8-2 2.5-3 3.5m0 2.5v.5"/></svg>,
  },
]

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout, isAdmin, isScanner, isEM } = useAuth()
  const navigate = useNavigate()

  const visibleItems = NAV_ITEMS.filter(item => item.access.includes(user?.role))

  const roleLabel = {
    admin: 'Administrator', eventManager: 'Event Manager', Scanner: 'Scanner',
    prm_volunteer: 'PRM Volunteer', prm_lead: 'PRM Lead', ops_lead: 'Ops Lead',
    booth_volunteer: 'Booth Volunteer', redemption_volunteer: 'Redemption Volunteer',
  }
  const roleBadge = {
    admin: 'badge-accent', eventManager: 'badge-info', Scanner: 'badge-warning',
    prm_volunteer: 'badge-info', prm_lead: 'badge-accent', ops_lead: 'badge-accent',
    booth_volunteer: 'badge-warning', redemption_volunteer: 'badge-success',
  }

  function handleLogout() {
    logout()
    navigate('/admin/login')
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <img src="https://res.cloudinary.com/dglvt0iom/image/upload/v1777041823/ascent_logo_uvllh8.svg" alt="Ascent Logo" style={{ height: 24, display: 'block', marginRight: 4 }} />
        <span className="brand-tag">Admin</span>
        
        <button className="sidebar-close-btn" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
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
        {visibleItems.length > 0 && <p className="nav-section-label">Navigation</p>}
        {visibleItems.map(item => (
          <React.Fragment key={item.key}>
            {item.section && (
              <p className="nav-section-label" style={{ marginTop: 14 }}>{item.section}</p>
            )}
            <NavLink
              to={item.path}
              onClick={onClose}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          </React.Fragment>
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
