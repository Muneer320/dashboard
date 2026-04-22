import React, { useState } from 'react'
import { useData } from '../../context/DataContext'
import './ManageRegistrations.css'

const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwcvY-1YOFoimzkhpqis3qL8UQtxQ8nI-EcavcgypXJa9l9MjA_ktNcURNpgg6Wm1_R/exec'

// Simple CSV parser (handles quoted fields)
function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    // Basic split — handles simple CSVs
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']))
  }).filter(row => row.Name || row.Username)
}

// Send credentials email via Google Apps Script.
// Google Apps Script doesn't respond to CORS preflight, so we must use
// mode:'no-cors' and omit Content-Type:application/json (which triggers preflight).
// The response will be opaque — if fetch doesn't throw, the request went through.
async function sendCredentialEmails(payload) {
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify(payload),
    })
    return 'sent'
  } catch {
    return 'failed'
  }
}

export default function ManageRegistrations() {
  const { events } = useData()
  const [selectedEvent, setSelectedEvent] = useState('')
  const [file, setFile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])           // parsed credential rows (new + existing)
  const [uploadErrors, setUploadErrors] = useState([]) // errors_detail from backend
  const [emailProgress, setEmailProgress] = useState({}) // { email: 'pending'|'sending'|'sent'|'failed' }
  const [isSending, setIsSending] = useState(false)
  const [showPassword, setShowPassword] = useState({})
  const fileInputRef = React.useRef(null)

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) setFile(e.target.files[0])
  }

  const handleUpload = async () => {
    if (!file)          { alert('Please select a file.'); return }
    if (!selectedEvent) { alert('Please select an event.'); return }

    setIsLoading(true)
    setStats(null)
    setUsers([])
    setUploadErrors([])
    setEmailProgress({})

    try {
      const formData = new FormData()
      formData.append('event_id', selectedEvent)
      formData.append('file', file)

      const token = localStorage.getItem('ascent_admin_token')
      const BASE  = (import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/$/, '')

      const res = await fetch(`${BASE}/admin-panel/registrations/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(errData?.detail || `HTTP ${res.status}`)
      }

      // Pull stats from headers BEFORE consuming body
      const created    = res.headers.get('x-stats-created')    ?? '0'
      const altered    = res.headers.get('x-stats-added')      ?? '0'
      const duplicates = res.headers.get('x-stats-duplicates') ?? '0'
      const errors     = res.headers.get('x-stats-errors')     ?? '0'
      setStats({ created, altered, duplicates, errors })

      // Read body as text, parse CSV, then also trigger download
      // Parse errors detail from header
      try {
        const errorsJson = res.headers.get('x-errors-detail')
        if (errorsJson) setUploadErrors(JSON.parse(errorsJson))
      } catch {}

      const csvText = await res.text()
      const parsed  = parseCSV(csvText)
      setUsers(parsed)

      // Only new users (with a password) get email sending
      const initProgress = {}
      parsed.filter(u => u.Type === 'new' && u.Password).forEach(u => {
        initProgress[u.Username] = 'pending'
      })
      setEmailProgress(initProgress)

      // Trigger CSV download
      const blob = new Blob([csvText], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      const disp = res.headers.get('content-disposition') || ''
      a.download = disp.includes('filename=')
        ? disp.split('filename=')[1].replace(/['"]/g, '')
        : 'credentials.csv'
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      a.remove()

      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

    } catch (e) {
      console.error(e)
      alert(e.message || 'Upload error.')
    } finally {
      setIsLoading(false)
    }
  }

  // Only send emails to newly created users (those with a password)
  const newUsers = users.filter(u => u.Type === 'new' && u.Password)

  const handleSendEmails = async () => {
    if (!newUsers.length) return
    setIsSending(true)

    // Mark all as sending
    const progress = {}
    newUsers.forEach(u => { progress[u.Username] = 'sending' })
    setEmailProgress(progress)

    const payload = newUsers.map(u => ({
      name: u.Name,
      email: u.Username,
      password: u.Password
    }))

    const result = await sendCredentialEmails(payload)

    // Update all progress to result ('sent' or 'failed')
    setEmailProgress(prev => {
      const next = { ...prev }
      newUsers.forEach(u => { next[u.Username] = result })
      return next
    })

    setIsSending(false)
  }

  const togglePassword = (email) =>
    setShowPassword(prev => ({ ...prev, [email]: !prev[email] }))

  const sentCount   = Object.values(emailProgress).filter(v => v === 'sent').length
  const failedCount = Object.values(emailProgress).filter(v => v === 'failed').length

  return (
    <div className="manage-registrations-page fade-in">
      <div className="section-header">
        <span className="section-title">Manage Registrations</span>
      </div>

      {/* ── Upload card ─────────────────────────────────────── */}
      <div className="card" style={{ maxWidth: 860, marginBottom: 28 }}>
        <h3 style={{ marginBottom: 10 }}>Upload Attendees List</h3>
        <p style={{ marginBottom: 22, color: 'var(--text-secondary)', fontSize: 13 }}>
          Upload a CSV or Excel file (Unstop format). New users are created, credentials CSV is downloaded,
          and emails can be sent automatically.
        </p>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={labelStyle}>1. Select Event</label>
            <select
              className="input-field"
              value={selectedEvent}
              onChange={e => setSelectedEvent(e.target.value)}
              disabled={isLoading}
            >
              <option value="">— Choose an Event —</option>
              {events.map(ev => (
                <option key={ev.eventId || ev.id} value={ev.eventId || ev.id}>
                  {ev.name || ev.eventName}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={labelStyle}>2. Choose File (CSV / Excel)</label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="input-field"
              style={{ paddingTop: 8, paddingBottom: 8 }}
              disabled={isLoading}
              ref={fileInputRef}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!file || !selectedEvent || isLoading}
            style={{ height: 42, minWidth: 160, position: 'relative', overflow: 'hidden' }}
          >
            {isLoading ? (
              <>
                <span style={{ position: 'relative', zIndex: 2 }}>Processing…</span>
                <div style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0, width: '100%',
                  background: 'rgba(255,255,255,0.18)',
                  animation: 'progress-indeterminate 1.5s infinite linear',
                }} />
              </>
            ) : 'Upload Registrations'}
          </button>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes progress-indeterminate {
            0%    { transform: scaleX(0); transform-origin: left;  opacity: 1; }
            50%   { transform: scaleX(1); transform-origin: left;  opacity: 1; }
            50.1% { transform: scaleX(1); transform-origin: right; opacity: 1; }
            100%  { transform: scaleX(0); transform-origin: right; opacity: 0; }
          }
        ` }} />

        {/* Stats */}
        {stats && (
          <div style={{ marginTop: 24, padding: 18, background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
            <h4 style={{ margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>🎉 Upload Successful</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
              {[
                { label: 'New Entries',       value: stats.created,    color: '#10b981' },
                { label: 'Rows Altered',       value: stats.altered,    color: '#3b82f6' },
                { label: 'Duplicates Evaded',  value: stats.duplicates, color: '#f59e0b' },
                { label: 'Errors Skipped',     value: stats.errors,     color: '#ef4444' },
              ].map(s => (
                <div key={s.label} style={{ padding: 14, background: 'var(--bg-card)', borderRadius: 8, borderLeft: `3px solid ${s.color}` }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Credentials table ──────────────────────────────── */}
      {users.length > 0 && (
        <div className="card" style={{ maxWidth: 860 }}>
          {/* Errors panel */}
        {uploadErrors.length > 0 && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#f87171', marginBottom: 8 }}>⚠️ {uploadErrors.length} error{uploadErrors.length !== 1 ? 's' : ''} during processing:</div>
            {uploadErrors.map((e, i) => (
              <div key={i} style={{ fontSize: 12, color: '#fca5a5', fontFamily: 'monospace', marginTop: 4 }}>
                {e.email} — {e.reason}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Processed Users</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                {newUsers.length} new · {users.filter(u => u.Type === 'existing').length} already registered
                {sentCount > 0 && ` · ${sentCount} emails sent`}
                {failedCount > 0 && ` · ${failedCount} failed`}
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleSendEmails}
              disabled={isSending || !newUsers.length}
              style={{ minWidth: 160, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {isSending ? (
                <>
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Sending…
                </>
              ) : '📧 Send Credential Emails'}
            </button>
          </div>

          <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  {['#', 'Name', 'Email', 'Password', 'Event', 'Account', 'Email Status'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const isNew   = u.Type === 'new'
                  const status  = emailProgress[u.Username]
                  return (
                    <tr key={u.Username + i} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{u.Name}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{u.Username}</td>
                      <td style={tdStyle}>
                        {isNew ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: showPassword[u.Username] ? 0 : '0.12em' }}>
                              {showPassword[u.Username] ? u.Password : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePassword(u.Username)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, fontSize: 13 }}
                              title={showPassword[u.Username] ? 'Hide' : 'Show'}
                            >
                              {showPassword[u.Username] ? '🙈' : '👁️'}
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>existing account</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-secondary)' }}>{u.Event}</td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
                          background: isNew ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                          color: isNew ? '#10b981' : '#60a5fa',
                          border: isNew ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(59,130,246,0.3)',
                        }}>
                          {isNew ? '✦ New' : '↺ Added to event'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {isNew
                          ? <EmailStatusBadge status={status} />
                          : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function EmailStatusBadge({ status }) {
  const map = {
    pending:  { label: 'Pending',  bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)',  border: 'var(--border-color)' },
    sending:  { label: 'Sending…', bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa',            border: 'rgba(59,130,246,0.3)' },
    sent:     { label: '✓ Sent',   bg: 'rgba(16,185,129,0.12)',  color: '#10b981',            border: 'rgba(16,185,129,0.3)' },
    failed:   { label: '✗ Failed', bg: 'rgba(239,68,68,0.12)',   color: '#f87171',            border: 'rgba(239,68,68,0.3)' },
  }
  const s = map[status] || map.pending
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

const labelStyle = {
  display: 'block', marginBottom: 7,
  fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500,
}

const tdStyle = {
  padding: '11px 12px',
  color: 'var(--text-primary)',
  verticalAlign: 'middle',
}
