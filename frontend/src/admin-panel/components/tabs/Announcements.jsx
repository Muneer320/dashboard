import React, { useState, useEffect, useCallback } from 'react'
import { adminPanel as adminApi } from '../../../lib/api'
import Pagination from '../Pagination'
import './Announcements.css'

const BASE = (import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/$/, '')

function adminFetch(path, options = {}) {
  const tok = localStorage.getItem('ascent_admin_token')
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      ...(options.headers || {}),
    },
  }).then(async r => {
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data?.detail || `HTTP ${r.status}`)
    return data
  })
}

const BROADCAST_CATS = ['general', 'pinned', 'alert', 'schedule', 'meal', 'info']

function relTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function ExpandableText({ text, maxLength = 150 }) {
  const [expanded, setExpanded] = useState(false)
  
  if (!text || text.length <= maxLength) {
    return <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text}</p>
  }

  return (
    <div>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {expanded ? text : `${text.slice(0, maxLength)}...`}
      </p>
      <button 
        onClick={() => setExpanded(!expanded)} 
        style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', padding: 0, fontSize: 12, marginTop: 6, fontWeight: 600 }}
      >
        {expanded ? 'View Less' : 'View More'}
      </button>
    </div>
  )
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([])
  const [events, setEvents]               = useState([])
  const [loading, setLoading]             = useState(true)
  const [posting, setPosting]             = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState('')
  const [editingAnn, setEditingAnn]       = useState(null) // { id, announcement, category, date, time }
  const [deletingId, setDeletingId]       = useState(null)

  // form state
  const today = new Date().toISOString().split('T')[0]
  // audienceType: 'broadcast' | 'event'
  const [form, setForm] = useState({
    date: today,
    announcement: '',
    audienceType: 'broadcast',   // which dropdown is active
    broadcastCat: 'general',     // value when audienceType === 'broadcast'
    eventCat: '',                // value when audienceType === 'event'
    is_pinned: false,
  })

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [anns, evs] = await Promise.all([
        adminFetch('/admin-panel/announcements?limit=100'),
        adminFetch('/admin-panel/events/stats'),
      ])
      setAnnouncements(anns)
      setEvents(evs)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Derive the final category string to send to the API
  const effectiveCategory = form.is_pinned
    ? 'pinned'
    : form.audienceType === 'event'
    ? form.eventCat
    : form.broadcastCat

  async function handlePost(e) {
    e.preventDefault()
    if (!form.announcement.trim()) return
    if (form.audienceType === 'event' && !form.eventCat) return
    setPosting(true)
    setError('')
    setSuccess('')
    try {
      const now = new Date()
      const time = now.toISOString()
      const cat = effectiveCategory
      await adminFetch('/announcements', {
        method: 'POST',
        body: JSON.stringify({
          date: form.date,
          announcement: form.announcement.trim(),
          time,
          category: cat,
        }),
      })
      setSuccess('Announcement posted!')
      setForm(f => ({ ...f, announcement: '', is_pinned: false, eventCat: '' }))
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setPosting(false)
    }
  }

  async function handleUpdate(e) {
    e.preventDefault()
    if (!editingAnn.announcement.trim()) return
    setPosting(true)
    setError('')
    setSuccess('')
    try {
      await adminFetch(`/announcements/${editingAnn.date}/${editingAnn.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          announcement: editingAnn.announcement.trim(),
          category: editingAnn.category,
          is_pinned: editingAnn.category === 'pinned',
        }),
      })
      setSuccess('Announcement updated!')
      setEditingAnn(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete(date, id) {
    if (!window.confirm('Delete this announcement?')) return
    setDeletingId(id)
    try {
      await adminFetch(`/announcements/${date}/${id}`, { method: 'DELETE' })
      setSuccess('Announcement deleted')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const categoryLabel = (cat) => {
    if (BROADCAST_CATS.includes(cat)) return cat.toUpperCase()
    return cat  // event name
  }

  const totalPages = Math.ceil(announcements.length / itemsPerPage)
  const paginatedAnns = announcements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="fade-in" style={{ padding: '0 0 48px' }}>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 28 }}>
        <span className="section-title">Announcements</span>
        <span className="badge badge-accent">Admin Only</span>
      </div>

      {/* ── Compose form ─────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 32, padding: '24px 28px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          Post New Announcement
        </h3>
        <form onSubmit={handlePost} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Announcement text */}
          <div>
            <label style={labelStyle}>Message</label>
            <textarea
              rows={3}
              required
              placeholder="Type your announcement…"
              value={form.announcement}
              onChange={e => setForm(f => ({ ...f, announcement: e.target.value }))}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
            />
          </div>

          <div className="announcements-grid">
            {/* Date */}
            <div>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {/* Audience type toggle */}
            <div>
              <label style={labelStyle}>Send To</label>
              <div style={{ display: 'flex', gap: 6, padding: 3, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                {[['broadcast', '📢 Everyone'], ['event', '🎯 Event Only']].map(([val, lbl]) => (
                  <div
                    key={val}
                    onClick={() => setForm(f => ({ ...f, audienceType: val }))}
                    style={{
                      flex: 1, textAlign: 'center', padding: '7px 10px',
                      borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                      transition: 'all .15s',
                      background: form.audienceType === val ? 'var(--accent)' : 'transparent',
                      color: form.audienceType === val ? '#fff' : 'var(--text-muted)',
                    }}
                  >{lbl}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Two dropdowns — one active, one dimmed */}
          <div className="announcements-grid">
            {/* Broadcast category */}
            <div style={{ opacity: form.audienceType === 'broadcast' ? 1 : 0.35, transition: 'opacity .2s', pointerEvents: form.audienceType === 'broadcast' ? 'auto' : 'none' }}>
              <label style={labelStyle}>Broadcast Category</label>
              <select
                value={form.broadcastCat}
                onChange={e => setForm(f => ({ ...f, broadcastCat: e.target.value }))}
                disabled={form.audienceType !== 'broadcast'}
                style={{ ...inputStyle, colorScheme: 'dark' }}
              >
                {BROADCAST_CATS.filter(c => c !== 'pinned').map(c => (
                  <option key={c} value={c} style={optStyle}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Shown to all registered users
              </span>
            </div>

            {/* Event-specific */}
            <div style={{ opacity: form.audienceType === 'event' ? 1 : 0.35, transition: 'opacity .2s', pointerEvents: form.audienceType === 'event' ? 'auto' : 'none' }}>
              <label style={labelStyle}>Target Event</label>
              <select
                value={form.eventCat}
                onChange={e => setForm(f => ({ ...f, eventCat: e.target.value }))}
                disabled={form.audienceType !== 'event'}
                style={{ ...inputStyle, colorScheme: 'dark' }}
              >
                <option value="" style={optStyle}>— Select an event —</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.name} style={optStyle}>{ev.name}</option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Only visible to participants of that event
              </span>
            </div>
          </div>

          {/* Pin toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
            <div
              onClick={() => setForm(f => ({ ...f, is_pinned: !f.is_pinned }))}
              style={{
                width: 40, height: 22, borderRadius: 999,
                background: form.is_pinned ? 'var(--accent)' : 'var(--border)',
                position: 'relative', transition: 'background .2s', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: form.is_pinned ? 20 : 3,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff', transition: 'left .2s',
              }} />
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              📌 Pin this announcement <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(overrides category → shown to everyone)</span>
            </span>
          </label>

          {error   && <div style={errorStyle}>{error}</div>}
          {success && <div style={successStyle}>{success}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={posting || !form.announcement.trim()}
              className="btn-primary"
              style={{ minWidth: 140 }}
            >
              {posting ? 'Posting…' : 'Post Announcement'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Existing announcements ────────────────────────── */}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
          All Announcements
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {announcements.length} total
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Loading…</div>
      ) : announcements.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No announcements yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {paginatedAnns.map((a, i) => {
            const isPinned = a.category === 'pinned'
            const isEvent  = !BROADCAST_CATS.includes((a.category || '').toLowerCase())
            return (
              <div key={i} className="card" style={{
                padding: '14px 18px',
                borderLeft: isPinned
                  ? '3px solid var(--accent)'
                  : isEvent
                  ? '3px solid #5eaad7'
                  : '3px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                      {isPinned && (
                        <span className="badge badge-accent" style={{ fontSize: 10 }}>📌 PINNED</span>
                      )}
                      <span className="badge" style={{
                        fontSize: 10,
                        background: isEvent ? 'rgba(94,170,215,0.15)' : 'rgba(255,255,255,0.06)',
                        color: isEvent ? '#5eaad7' : 'var(--text-muted)',
                        border: isEvent ? '1px solid rgba(94,170,215,0.3)' : '1px solid var(--border)',
                      }}>
                        {categoryLabel(a.category || 'general')}
                      </span>
                    </div>
                    <ExpandableText text={a.announcement} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {relTime(a.time)}
                      <br />
                      <span style={{ fontSize: 10 }}>{a.date}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setEditingAnn({ ...a })}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--accent-light)', fontSize: 12, padding: 0,
                          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(a.date, a.id)}
                        disabled={deletingId === a.id}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#E07070', fontSize: 12, padding: 0,
                          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                          opacity: deletingId === a.id ? 0.5 : 1
                        }}
                      >
                        {deletingId === a.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          
      {/* ── Edit Modal ──────────────────────────────────── */}
      {editingAnn && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, padding: 28 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>Edit Announcement</h3>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Message</label>
                <textarea
                  rows={4}
                  required
                  value={editingAnn.announcement}
                  onChange={e => setEditingAnn(prev => ({ ...prev, announcement: e.target.value }))}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div className="announcements-grid">
                <div>
                  <label style={labelStyle}>Category</label>
                  <select
                    value={editingAnn.category}
                    onChange={e => setEditingAnn(prev => ({ ...prev, category: e.target.value }))}
                    style={{ ...inputStyle, colorScheme: 'dark' }}
                  >
                    <optgroup label="Broadcast" style={optGroupStyle}>
                      {BROADCAST_CATS.map(c => (
                        <option key={c} value={c} style={optStyle}>{c.toUpperCase()}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Events" style={optGroupStyle}>
                      {events.map(ev => (
                        <option key={ev.id} value={ev.name} style={optStyle}>{ev.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Date (Reference)</label>
                  <input type="text" disabled value={editingAnn.date} style={{ ...inputStyle, opacity: 0.6 }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditingAnn(null)}
                  className="btn-secondary"
                  style={{ minWidth: 100 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={posting}
                  className="btn-primary"
                  style={{ minWidth: 120 }}
                >
                  {posting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Pagination 
        currentPage={currentPage} 
        totalPages={totalPages} 
        onPageChange={setCurrentPage} 
      />
    </div>
      )}
    </div>
  )
}

const labelStyle = {
  display: 'block', marginBottom: 6,
  fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text-primary)', fontSize: 13,
  outline: 'none',
}

const optGroupStyle = {
  background: '#1a1a2e',
  color: '#8888aa',
  fontWeight: 600,
  fontSize: 11,
}

const optStyle = {
  background: '#1a1a2e',
  color: '#e8e6f0',
  padding: '6px 12px',
}

const errorStyle = {
  padding: '10px 14px', borderRadius: 8,
  background: 'rgba(220,80,80,0.1)', border: '1px solid rgba(220,80,80,0.3)',
  color: '#E07070', fontSize: 13,
}

const successStyle = {
  padding: '10px 14px', borderRadius: 8,
  background: 'rgba(72,199,142,0.1)', border: '1px solid rgba(72,199,142,0.3)',
  color: '#48C78E', fontSize: 13,
}
