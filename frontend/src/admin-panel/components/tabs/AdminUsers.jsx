import React, { useState } from 'react'
import { useData } from '../../context/DataContext'
import { adminPanel } from '../../../lib/api'
import ConfirmModal from '../ConfirmModal'
import Pagination from '../Pagination'
import './AdminUsers.css'

import { useAuth } from '../../context/AuthContext'

// Mirrors backend BOOTH_SOURCE_MAP in routes/booth.py — keep in sync.
// AR_FILTER removed: now student self-submitted screenshot, not booth-verified.
const BOOTH_OPTIONS = [
  { id: 'SCAVENGER',      label: 'Scavenger Hunt' },
  { id: 'RAZORPAY',       label: 'Razorpay Pitch' },
  { id: 'ECO_EXCHANGE',   label: 'Eco Exchange' },
  { id: 'EVENT_WIN',      label: 'Event Win Desk' },
  { id: 'ECO_DESIGN_WIN', label: 'Eco Design Win Desk' },
]

export default function AdminUsers() {
  const { user } = useAuth()
  const { adminUsers, events, loadAdminUsers } = useData()

  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState(null)
  
  // Form State
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('admin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedEvents, setSelectedEvents] = useState([])
  const [boothId, setBoothId] = useState('')
  
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [activeTab, setActiveTab] = useState('active')

  // Split by active / inactive, then filter by search
  const activeAdmins   = adminUsers.filter(u => !u.deleted_at)
  const inactiveAdmins = adminUsers.filter(u => !!u.deleted_at)
  const tabData = activeTab === 'active' ? activeAdmins : inactiveAdmins

  const filtered = tabData.filter(u => {
    const q = searchQuery.toLowerCase()
    return u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || (u.mail || '').toLowerCase().includes(q)
  })

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const roleLabel = {
    admin: 'Super Admin', eventManager: 'Event Manager', Scanner: 'Scanner',
    booth_volunteer: 'Booth Volunteer', prm_volunteer: 'PRM Volunteer',
    prm_lead: 'PRM Lead', ops_lead: 'Ops Lead', redemption_volunteer: 'Redemption Volunteer',
  }
  const roleBadge = {
    admin: 'badge-accent', eventManager: 'badge-info', Scanner: 'badge-warning',
    booth_volunteer: 'badge-warning', prm_volunteer: 'badge-info',
    prm_lead: 'badge-accent', ops_lead: 'badge-accent', redemption_volunteer: 'badge-success',
  }

  // Handlers
  function openAdd() {
    setEditingAdmin(null)
    setUsername('')
    setName('')
    setRole('admin')
    setEmail('')
    setPassword('')
    setPhone('')
    setSelectedEvents([])
    setBoothId('')
    setFormError('')
    setIsFormOpen(true)
  }

  function openEdit(admin) {
    setEditingAdmin(admin)
    setUsername(admin.username)
    setName(admin.name)
    setRole(admin.role)
    setEmail(admin.mail || '')
    setPassword('') // leave blank to not change
    setPhone(admin.phone || '')
    setSelectedEvents(admin.events || [])
    setBoothId(admin.booth_id || '')
    setFormError('')
    setIsFormOpen(true)
  }

  function handleEventToggle(eventId) {
    if (selectedEvents.includes(eventId)) {
      setSelectedEvents(selectedEvents.filter(id => id !== eventId))
    } else {
      setSelectedEvents([...selectedEvents, eventId])
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setFormError('')
    setIsSubmitting(true)
    
    try {
      // Booth assignment is meaningful only for booth_volunteer; cleared otherwise.
      const resolvedBoothId = role === 'booth_volunteer' ? (boothId || null) : null

      if (editingAdmin) {
        await adminPanel.updateAdminUser(editingAdmin.uid, {
          name,
          role,
          password: password || undefined,
          mail: email || null,
          phone: phone || null,
          events: role === 'eventManager' ? selectedEvents : [],
          booth_id: resolvedBoothId,
        })
      } else {
        await adminPanel.addAdminUser({
          username,
          name,
          role,
          password,
          mail: email || null,
          phone: phone || null,
          events: role === 'eventManager' ? selectedEvents : [],
          booth_id: resolvedBoothId,
        })
      }
      setIsFormOpen(false)
      loadAdminUsers()
    } catch (err) {
      setFormError(err.message || 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function confirmDelete() {
    if (deleteConfirm) {
      try {
        await adminPanel.deleteAdminUser(deleteConfirm.uid)
        setDeleteConfirm(null)
        loadAdminUsers()
      } catch (err) {
        alert(err.message || 'Failed to deactivate admin')
      }
    }
  }

  async function handleRestore(u) {
    try {
      await adminPanel.restoreAdminUser(u.uid)
      loadAdminUsers()
    } catch (err) {
      alert(err.message || 'Failed to restore admin')
    }
  }

  return (
    <div className="admin-users-page fade-in">
      <div className="section-header">
        <span className="section-title">Admin Management</span>
        <button className="btn btn-primary" onClick={openAdd}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Admin
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn btn-sm ${activeTab === 'active' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => { setActiveTab('active'); setCurrentPage(1); setSearchQuery('') }}
        >
          Active
          <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 9999, padding: '1px 7px', fontSize: '0.7rem' }}>
            {activeAdmins.length}
          </span>
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'inactive' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => { setActiveTab('inactive'); setCurrentPage(1); setSearchQuery('') }}
        >
          Inactive
          <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 9999, padding: '1px 7px', fontSize: '0.7rem' }}>
            {inactiveAdmins.length}
          </span>
        </button>
      </div>

      <div className="filters-row" style={{ marginBottom: 16 }}>
        <div className="search-wrap" style={{ maxWidth: 400 }}>
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="input-field search-input"
            type="text"
            placeholder="Search admins..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>No admins found.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Contact</th>
                    <th>Assigned Events</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(u => (
                    <tr key={u.uid} style={activeTab === 'inactive' ? { opacity: 0.5 } : {}}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{u.name}</td>
                      <td>@{u.username}</td>
                      <td>
                        <span className={`badge ${roleBadge[u.role] || 'badge-accent'}`}>
                          {roleLabel[u.role] || u.role}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8rem' }}>{u.mail}</div>
                        {u.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.phone}</div>}
                      </td>
                      <td>
                        {u.role === 'eventManager' ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {u.events.map(eid => {
                              const ev = events.find(e => e.id === eid)
                              return <span key={eid} className="badge badge-info" style={{ fontSize: '0.65rem' }}>{ev?.name || eid.substring(0, 8)}</span>
                            })}
                            {u.events.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>}
                          </div>
                        ) : u.role === 'booth_volunteer' ? (
                          u.booth_id ? (
                            <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>
                              {BOOTH_OPTIONS.find(b => b.id === u.booth_id)?.label || u.booth_id}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>No booth assigned</span>
                          )
                        ) : u.role === 'redemption_volunteer' ? (
                          <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Redemption Volunteer</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>All Events</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {activeTab === 'inactive' ? (
                          <button className="btn btn-sm btn-ghost" onClick={() => handleRestore(u)}>Restore</button>
                        ) : (
                          <>
                            <button className="btn btn-sm btn-ghost" style={{ marginRight: 8 }} onClick={() => openEdit(u)}>Edit</button>
                            {u.uid !== user?.uid && (
                              <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(u)}>Deactivate</button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}

                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </>
        )}
      </div>

      {isFormOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in admin-form-modal">
            <h3 className="modal-title">{editingAdmin ? 'Edit Admin' : 'Add Admin'}</h3>
            {formError && <div className="form-error" style={{ color: 'var(--danger)', marginBottom: 16, fontSize: '0.9rem' }}>{formError}</div>}
            
            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Name</label>
                  <input className="input-field" required value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input className="input-field" required disabled={!!editingAdmin} value={username} onChange={e => setUsername(e.target.value)} />
                </div>
                
                <div className="form-group">
                  <label>Email (optional)</label>
                  <input className="input-field" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Phone (optional)</label>
                  <input className="input-field" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                
                <div className="form-group">
                  <label>Role</label>
                  <select className="input-field" value={role} onChange={e => setRole(e.target.value)}>
                    <optgroup label="Core">
                      <option value="admin">Super Admin</option>
                      <option value="eventManager">Event Manager</option>
                      <option value="Scanner">Scanner</option>
                    </optgroup>
                    <optgroup label="Sidequest">
                      <option value="booth_volunteer">Booth Volunteer</option>
                      <option value="redemption_volunteer">Redemption Volunteer</option>
                      <option value="prm_volunteer">PRM Volunteer</option>
                      <option value="prm_lead">PRM Lead</option>
                      <option value="ops_lead">Ops Lead</option>
                    </optgroup>
                  </select>
                </div>
                <div className="form-group">
                  <label>Password {editingAdmin && '(leave blank to keep current)'}</label>
                  <input className="input-field" type="password" required={!editingAdmin} value={password} onChange={e => setPassword(e.target.value)} />
                </div>
              </div>

              {role === 'eventManager' && (
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>Assigned Events</label>
                  <div className="events-multiselect">
                    {events.map(ev => (
                      <label key={ev.id} className="event-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(ev.id)}
                          onChange={() => handleEventToggle(ev.id)}
                        />
                        {ev.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {role === 'booth_volunteer' && (
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>Assigned Booth</label>
                  <select
                    className="input-field"
                    required
                    value={boothId}
                    onChange={e => setBoothId(e.target.value)}
                  >
                    <option value="">— select booth —</option>
                    {BOOTH_OPTIONS.map(b => (
                      <option key={b.id} value={b.id}>{b.label}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                    The volunteer's login token will carry this booth_id; awards from
                    them are recorded against this booth only.
                  </div>
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsFormOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Deactivate Admin"
          message={`Deactivate ${deleteConfirm.name} (@${deleteConfirm.username})? They won't be able to log in, but their activity history is preserved. You can restore them later.`}
          confirmLabel="Deactivate"
          isDanger={true}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}
