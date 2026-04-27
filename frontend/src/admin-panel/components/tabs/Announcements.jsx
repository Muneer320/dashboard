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

/** Renders announcement text with clickable links */
function AnnouncementText({ text, compact = false }) {
  if (!text) return null
  // Split by URLs
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g
  const parts = text.split(urlRegex)
  const rendered = parts.map((part, i) => {
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--accent-light)', textDecoration: 'underline', wordBreak: 'break-all' }}
        >
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })

  return (
    <p style={{
      margin: 0,
      fontSize: compact ? 13 : 14,
      color: 'var(--text-primary)',
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {rendered}
    </p>
  )
}

const EMPTY_FORM = {
  date: new Date().toISOString().split('T')[0],
  title: '',
  announcement: '',
  audienceType: 'broadcast',
  broadcastCat: 'general',
  eventCat: '',
  is_pinned: false,
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([])
  const [events, setEvents]               = useState([])
  const [loading, setLoading]             = useState(true)
  const [posting, setPosting]             = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState('')

  // editingId: null = new post mode, string = edit mode (announcement id being edited)
  const [editingId, setEditingId]   = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const [form, setForm] = useState({ ...EMPTY_FORM })

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

  // Effective category from form
  const effectiveCategory = form.is_pinned
    ? 'pinned'
    : form.audienceType === 'event'
    ? form.eventCat
    : form.broadcastCat

  function startEdit(ann) {
    // Determine audienceType from category
    const cat = ann.category || 'general'
    const isBroadcast = BROADCAST_CATS.includes(cat)
    setEditingId(ann.id)
    setForm({
      title: ann.title || '',
      announcement: ann.announcement || '',
      audienceType: isBroadcast ? 'broadcast' : 'event',
      broadcastCat: isBroadcast ? cat : 'general',
      eventCat: !isBroadcast ? cat : '',
      is_pinned: ann.category === 'pinned' || !!ann.is_pinned,
    })
    // scroll to form
    setTimeout(() => document.getElementById('ann-compose-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setError('')
    setSuccess('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.announcement.trim()) return
    if (form.audienceType === 'event' && !form.eventCat) return
    setPosting(true)
    setError('')
    setSuccess('')

    const cat = effectiveCategory

    try {
      if (editingId) {
        // UPDATE existing
        await adminFetch(`/announcements/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: form.title.trim(),
            announcement: form.announcement.trim(),
            category: cat,
            is_pinned: form.is_pinned,
          }),
        })
        setSuccess('Announcement updated!')
        cancelEdit()
      } else {
        // POST new
        const now = new Date().toISOString()
        await adminFetch('/announcements', {
          method: 'POST',
          body: JSON.stringify({
            title: form.title.trim(),
            announcement: form.announcement.trim(),
            time: now,
            category: cat,
            is_pinned: form.is_pinned,
          }),
        })
        setSuccess('Announcement posted!')
        setForm({ ...EMPTY_FORM })
      }
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this announcement?')) return
    setDeletingId(id)
    try {
      await adminFetch(`/announcements/${id}`, { method: 'DELETE' })
      setSuccess('Announcement deleted')
      if (editingId === id) cancelEdit()
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const categoryLabel = (cat) => {
    if (BROADCAST_CATS.includes(cat)) return cat.toUpperCase()
    return cat
  }

  const totalPages = Math.ceil(announcements.length / itemsPerPage)
  const paginatedAnns = announcements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const isEditing = editingId !== null

  return (
    <div className="fade-in" style={{ padding: '0 0 48px' }}>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 28 }}>
        <span className="section-title">Announcements</span>
        <span className="badge badge-accent">Admin Only</span>
      </div>

      {/* ── Compose / Edit form ─────────────────────────────────── */}
      <div
        id="ann-compose-form"
        className="card"
        style={{
          marginBottom: 32,
          padding: '24px 28px',
          borderColor: isEditing ? 'rgba(127,119,221,0.5)' : undefined,
          boxShadow: isEditing ? '0 0 0 1px rgba(127,119,221,0.3)' : undefined,
          transition: 'border-color .2s, box-shadow .2s',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            {isEditing ? (
              <>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', boxShadow: '0 0 8px var(--accent)' }} />
                Edit Announcement
              </>
            ) : 'Post New Announcement'}
          </h3>
          {isEditing && (
            <button
              onClick={cancelEdit}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 14px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
            >
              ✕ Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Title (optional) */}
          <div>
            <label style={labelStyle}>Title <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional heading)</span></label>
            <input
              type="text"
              placeholder="e.g. Important Update, Round 1 Results…"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              style={inputStyle}
            />
          </div>

          {/* Announcement text */}
          <div>
            <label style={labelStyle}>Message *</label>
            <textarea
              rows={4}
              required
              placeholder="Type your announcement… URLs will auto-link for users."
              value={form.announcement}
              onChange={e => setForm(f => ({ ...f, announcement: e.target.value }))}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 90 }}
            />
          </div>

          <div className="announcements-grid">
            {/* Date — only for new posts */}
            <div style={{ opacity: isEditing ? 0.5 : 1 }}>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => !isEditing && setForm(f => ({ ...f, date: e.target.value }))}
                disabled={isEditing}
                style={inputStyle}
              />
              {isEditing && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Date is fixed after posting</span>}
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

          {/* Category selectors */}
          <div className="announcements-grid">
            <div style={{ opacity: form.audienceType === 'broadcast' ? 1 : 0.35, transition: 'opacity .2s', pointerEvents: form.audienceType === 'broadcast' ? 'auto' : 'none' }}>
              <label style={labelStyle}>Broadcast Category</label>
              <select
                value={form.broadcastCat}
                onChange={e => setForm(f => ({ ...f, broadcastCat: e.target.value }))}
                disabled={form.audienceType !== 'broadcast'}
                style={{ ...inputStyle, colorScheme: 'dark' }}
              >
                {BROADCAST_CATS.filter(c => c !== 'pinned').map(c => (
                  <option key={c} value={c} style={optStyle}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Shown to all registered users</span>
            </div>

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
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Only visible to participants of that event</span>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            {isEditing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="btn-secondary"
                style={{ minWidth: 100 }}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={posting || !form.announcement.trim() || (form.audienceType === 'event' && !form.eventCat)}
              className="btn-primary"
              style={{ minWidth: 170 }}
            >
              {posting
                ? (isEditing ? 'Updating…' : 'Posting…')
                : (isEditing ? '✓ Update Announcement' : 'Post Announcement')}
            </button>
          </div>
        </form>
      </div>

      {/* ── Existing announcements ────────────────────────── */}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>All Announcements</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{announcements.length} total</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Loading…</div>
      ) : announcements.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No announcements yet.</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {paginatedAnns.map((a) => {
              const isPinned = a.category === 'pinned' || a.is_pinned
              const isEvent  = !BROADCAST_CATS.includes((a.category || '').toLowerCase())
              const isBeingEdited = editingId === a.id
              return (
                <div
                  key={a.id}
                  className="card"
                  style={{
                    padding: '14px 18px',
                    borderLeft: isPinned
                      ? '3px solid var(--accent)'
                      : isEvent
                      ? '3px solid #5eaad7'
                      : '3px solid var(--border)',
                    background: isBeingEdited ? 'rgba(127,119,221,0.07)' : undefined,
                    outline: isBeingEdited ? '1px solid rgba(127,119,221,0.35)' : undefined,
                    transition: 'background .2s, outline .2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Badges */}
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
                        {isBeingEdited && (
                          <span className="badge badge-accent" style={{ fontSize: 10, background: 'rgba(127,119,221,0.18)', color: 'var(--accent-light)', border: '1px solid rgba(127,119,221,0.4)' }}>
                            ✏ EDITING
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      {a.title && (
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '-0.01em' }}>
                          {a.title}
                        </div>
                      )}

                      {/* Announcement text with link rendering */}
                      <AnnouncementText text={a.announcement} compact />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {relTime(a.time)}<br />
                        <span style={{ fontSize: 10 }}>{a.date}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => isBeingEdited ? cancelEdit() : startEdit(a)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: isBeingEdited ? 'var(--text-muted)' : 'var(--accent-light)',
                            fontSize: 12, padding: 0,
                            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em'
                          }}
                        >
                          {isBeingEdited ? 'Cancel' : 'Edit'}
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
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
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </>
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
