import React, { useState } from 'react'
import { useData } from '../../context/DataContext'
import { adminPanel } from '../../../lib/api'
import ConfirmModal from '../ConfirmModal'
import Pagination from '../Pagination'
import './AdminUsers.css'

import { useAuth } from '../../context/AuthContext'

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
  
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Filtering
  const filtered = adminUsers.filter(u => {
    const q = searchQuery.toLowerCase()
    return u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.mail.toLowerCase().includes(q)
  })

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const roleLabel = { admin: 'Super Admin', eventManager: 'Event Manager', Scanner: 'Scanner' }
  const roleBadge = { admin: 'badge-accent', eventManager: 'badge-info', Scanner: 'badge-warning' }

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
      if (editingAdmin) {
        await adminPanel.updateAdminUser(editingAdmin.uid, {
          name,
          role,
          password: password || undefined,
          mail: email || null,
          phone: phone || null,
          events: role === 'eventManager' ? selectedEvents : []
        })
      } else {
        await adminPanel.addAdminUser({
          username,
          name,
          role,
          password,
          mail: email || null,
          phone: phone || null,
          events: role === 'eventManager' ? selectedEvents : []
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
        alert(err.message || 'Failed to delete admin')
      }
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
                    <tr key={u.uid}>
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
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>All Events</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-sm btn-ghost" style={{ marginRight: 8 }} onClick={() => openEdit(u)}>Edit</button>
                        {u.uid !== user?.uid && (
                          <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(u)}>Delete</button>
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
                    <option value="admin">Super Admin</option>
                    <option value="eventManager">Event Manager</option>
                    <option value="Scanner">Scanner</option>
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
          title="Delete Admin"
          message={`Are you sure you want to delete ${deleteConfirm.name} (@${deleteConfirm.username})?`}
          confirmLabel="Delete"
          isDanger={true}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}
