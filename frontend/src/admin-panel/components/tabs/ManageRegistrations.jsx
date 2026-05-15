import React, { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext'
import { adminPanel as adminApi, adminPanel } from '../../../lib/api'
import Pagination from '../Pagination'
import './ManageRegistrations.css'

const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwcvY-1YOFoimzkhpqis3qL8UQtxQ8nI-EcavcgypXJa9l9MjA_ktNcURNpgg6Wm1_R/exec'

// How many roster rows per backend upload. Each batch has to fit inside the
// edge proxy's response timeout (Cloudflare/Vercel/nginx default = 30–60s).
// At cost-factor-12 bcrypt + sequential per-existing-user updates, the backend
// processes ~25 rows/sec. 350 rows ≈ 14s — safely inside even the strictest
// proxy timeout, with headroom for slow links.
const BATCH_SIZE = 350

// ─── RFC-4180-ish CSV parsing/serialisation ──────────────────────────────────
//
// The previous parser split on `,` and didn't honour quoted fields, so any cell
// with a comma or newline corrupted every following column. We need both
// directions (parse on the way in, serialise per-batch on the way out) so the
// round-trip survives names like  "Doe, John"  and addresses with line breaks.

/** Parse CSV text into { header: string[], rows: string[][] }. */
function parseCSVRows(text) {
  // Strip BOM that Excel loves to inject
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  const rows = []
  let row = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++ }
        else                      { inQuotes = false }
      } else {
        cur += ch
      }
    } else {
      if (ch === '"')                           inQuotes = true
      else if (ch === ',')                      { row.push(cur); cur = '' }
      else if (ch === '\n' || ch === '\r') {
        row.push(cur); cur = ''
        // skip \r\n pair
        if (ch === '\r' && text[i + 1] === '\n') i++
        // drop fully-empty trailing rows (common at file end)
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row)
        row = []
      } else {
        cur += ch
      }
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur)
    if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row)
  }

  if (rows.length === 0) return { header: [], rows: [] }
  const [header, ...body] = rows
  return { header, rows: body }
}

/** Serialise a single CSV cell, quoting only when needed. */
function csvCell(v) {
  const s = (v ?? '').toString()
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Build a CSV string from a header row + body rows. */
function buildCSV(header, rows) {
  const all = [header, ...rows]
  return all.map(r => r.map(csvCell).join(',')).join('\r\n')
}

/** Parse the credentials CSV the backend returns into row dicts (legacy shape). */
function parseCSV(text) {
  const { header, rows } = parseCSVRows(text)
  if (!header.length) return []
  return rows.map(cols => Object.fromEntries(header.map((h, i) => [h, cols[i] ?? ''])))
            .filter(row => row.Name || row.Username)
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
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const fileInputRef = React.useRef(null)
  // { current, total, status }  — surfaces "Batch 2 of 4 · uploading…" in the UI
  const [batchProgress, setBatchProgress] = useState(null)

  // ── "Find users missing from your CSV" workflow state ───────────────────
  const [coveredFile, setCoveredFile]         = useState(null)
  const coveredFileRef                        = React.useRef(null)
  const [findingUncovered, setFindingUncovered] = useState(false)
  // [{ id, name, email }] — DB users not present in the uploaded CSV
  const [uncovered, setUncovered]             = useState([])
  // After regeneration: [{ name, email, password, status }]
  const [regenCreds, setRegenCreds]           = useState([])
  const [regenProgress, setRegenProgress]    = useState(null)
  const [regenSending, setRegenSending]       = useState(false)
  // 'idle' | 'preview' | 'regenerated' — controls which buttons appear
  const [uncoveredPhase, setUncoveredPhase]   = useState('idle')

  // Tabs: 'bulk' | 'manual' | 'phase' | 'teams'
  const [activeTab, setActiveTab] = useState('bulk')

  useEffect(() => {
    setCurrentPage(1)
  }, [users])

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) setFile(e.target.files[0])
  }

  // Send one batch (or the whole file for small uploads / xlsx). Returns the
  // parsed credentials, accumulated stats, and any error rows the backend
  // surfaced via its X-* headers. Throws on HTTP error so the caller can decide
  // whether to abort the queue or skip ahead.
  async function uploadOneBatch(batchFile, eventId) {
    const formData = new FormData()
    formData.append('event_id', eventId)
    formData.append('file', batchFile)

    const token = localStorage.getItem('ascent_admin_token')
    const BASE  = (import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/$/, '')

    const res = await fetch(`${BASE}/admin-panel/registrations/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: 'Upload failed' }))
      const err = new Error(errData?.detail || `HTTP ${res.status}`)
      err.status = res.status
      throw err
    }

    const stats = {
      created:    parseInt(res.headers.get('x-stats-created')    ?? '0', 10) || 0,
      altered:    parseInt(res.headers.get('x-stats-added')      ?? '0', 10) || 0,
      duplicates: parseInt(res.headers.get('x-stats-duplicates') ?? '0', 10) || 0,
      errors:     parseInt(res.headers.get('x-stats-errors')     ?? '0', 10) || 0,
    }

    let errorsDetail = []
    try {
      const errorsJson = res.headers.get('x-errors-detail')
      if (errorsJson) errorsDetail = JSON.parse(errorsJson)
    } catch {}

    const csvText = await res.text()
    const parsed  = parseCSV(csvText)
    return { stats, errorsDetail, csvText, parsed }
  }

  const handleUpload = async () => {
    if (!file)          { alert('Please select a file.'); return }
    if (!selectedEvent) { alert('Please select an event.'); return }

    setIsLoading(true)
    setStats(null)
    setUsers([])
    setUploadErrors([])
    setEmailProgress({})
    setBatchProgress(null)

    try {
      const isCSV = /\.csv$/i.test(file.name)

      // Batch only for CSV. XLSX would need a client-side parser (SheetJS) we
      // don't ship; if someone uploads a giant XLSX we still send it whole and
      // they're back to the timeout risk — keep XLSX uploads small for now.
      let batches = []  // [{ file: File, range: [startRow, endRow] }]
      let totalDataRows = 0

      if (isCSV) {
        const text = await file.text()
        const { header, rows } = parseCSVRows(text)
        if (!header.length || !rows.length) {
          throw new Error('CSV is empty or has no header row.')
        }
        totalDataRows = rows.length

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const slice = rows.slice(i, i + BATCH_SIZE)
          const csv   = buildCSV(header, slice)
          const blob  = new Blob([csv], { type: 'text/csv' })
          const partFile = new File(
            [blob],
            file.name.replace(/\.csv$/i, `__batch${(i / BATCH_SIZE) + 1}.csv`),
            { type: 'text/csv' },
          )
          batches.push({ file: partFile, range: [i + 1, Math.min(i + BATCH_SIZE, rows.length)] })
        }
      } else {
        // XLSX / XLS — single shot. Subject to proxy timeout for huge files.
        batches = [{ file, range: null }]
      }

      // Aggregators across batches
      const totalStats   = { created: 0, altered: 0, duplicates: 0, errors: 0 }
      const allErrors    = []
      const allParsed    = []   // user rows for the on-screen table
      const csvParts     = []   // per-batch credential CSV bodies for the merged download
      const failedBatches = []

      for (let b = 0; b < batches.length; b++) {
        const { file: batchFile, range } = batches[b]
        setBatchProgress({
          current: b + 1,
          total:   batches.length,
          status:  range
            ? `Uploading batch ${b + 1} of ${batches.length} · rows ${range[0]}–${range[1]}…`
            : `Uploading…`,
        })

        try {
          const { stats: bStats, errorsDetail, csvText, parsed } = await uploadOneBatch(batchFile, selectedEvent)
          totalStats.created    += bStats.created
          totalStats.altered    += bStats.altered
          totalStats.duplicates += bStats.duplicates
          totalStats.errors     += bStats.errors
          allErrors.push(...errorsDetail)
          allParsed.push(...parsed)
          csvParts.push({ csvText, isFirst: b === 0 })
        } catch (err) {
          // Don't abort — record the failure and move on so the rest of the
          // file still lands. The admin can re-upload the failed slice.
          failedBatches.push({
            range,
            message: err.message || 'Upload failed',
          })
          allErrors.push({
            email: range ? `rows ${range[0]}–${range[1]}` : 'batch',
            reason: `Batch upload failed: ${err.message || err.status || 'unknown'}`,
          })
        }
      }

      setBatchProgress({ current: batches.length, total: batches.length, status: 'Done.' })

      // ── Surface aggregated state ─────────────────────────────────────────
      setStats({
        created:    String(totalStats.created),
        altered:    String(totalStats.altered),
        duplicates: String(totalStats.duplicates),
        errors:     String(totalStats.errors),
      })
      setUploadErrors(allErrors)
      setUsers(allParsed)

      // Prime per-row email-send tracking
      const initProgress = {}
      allParsed.filter(u => u.Type === 'new' && u.Password).forEach(u => {
        initProgress[u.Username] = 'pending'
      })
      setEmailProgress(initProgress)

      // ── Build a single merged credentials CSV download ───────────────────
      if (csvParts.length > 0) {
        // Strip the header from non-first parts so the file isn't a Frankenstein
        const merged = csvParts.map((p, idx) => {
          if (idx === 0) return p.csvText.replace(/[\r\n]+$/, '')
          // skip first newline after header
          const firstNl = p.csvText.search(/\r?\n/)
          return firstNl >= 0 ? p.csvText.slice(firstNl + 1).replace(/[\r\n]+$/, '') : ''
        }).filter(Boolean).join('\r\n') + '\r\n'

        const blob = new Blob([merged], { type: 'text/csv' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `Ascent_Credentials_${new Date().toISOString().slice(0,10)}.csv`
        document.body.appendChild(a)
        a.click()
        URL.revokeObjectURL(url)
        a.remove()
      }

      if (failedBatches.length > 0) {
        const ranges = failedBatches
          .map(b => b.range ? `rows ${b.range[0]}–${b.range[1]}` : 'one batch')
          .join(', ')
        alert(
          `Upload partially completed.\n\n` +
          `${batches.length - failedBatches.length} of ${batches.length} batches succeeded.\n` +
          `Failed: ${ranges}\n\n` +
          `You can re-upload just those rows (split your CSV manually if needed).`
        )
      }

      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

    } catch (e) {
      console.error(e)
      alert(e.message || 'Upload error.')
    } finally {
      setIsLoading(false)
      // Hide the per-batch label after a short delay so the user sees "Done."
      setTimeout(() => setBatchProgress(null), 1500)
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

  // ─── "Find users missing from your CSV" workflow ───────────────────────
  //
  // Step 1 — admin uploads a CSV (Name, Email, Password) of users who already
  //          got their credentials. We extract the email column client-side
  //          and ask the backend for DB users NOT in that list.
  //
  // Step 2 — admin reviews the gap and clicks "Generate passwords & email".
  //          We chunk the user IDs (350/batch) so each backend request fits
  //          inside the proxy timeout, then hand the resulting plaintext
  //          credentials to the same Apps-Script mailer the upload flow uses.

  const handleCoveredFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setCoveredFile(f)
    setUncovered([])
    setRegenCreds([])
    setUncoveredPhase('idle')
  }

  const handleFindUncovered = async () => {
    if (!coveredFile) {
      alert('Pick a CSV with Name, Email, Password columns first.')
      return
    }
    setFindingUncovered(true)
    setUncovered([])
    setRegenCreds([])
    setUncoveredPhase('idle')

    try {
      const text = await coveredFile.text()
      const { header, rows } = parseCSVRows(text)
      if (!header.length || !rows.length) {
        throw new Error('CSV looks empty.')
      }
      const lower = header.map(h => h.trim().toLowerCase())
      const emailIdx = lower.findIndex(h => h === 'email' || h === 'mail' || h === 'username')
      if (emailIdx < 0) {
        throw new Error('CSV is missing an "email" (or "username") column.')
      }
      const emails = rows
        .map(r => (r[emailIdx] || '').trim().toLowerCase())
        .filter(e => e && e.includes('@'))

      const result = await adminApi.findUncoveredUsers(emails)
      setUncovered(Array.isArray(result) ? result : [])
      setUncoveredPhase('preview')
    } catch (e) {
      console.error(e)
      alert(e.message || 'Could not run the diff.')
    } finally {
      setFindingUncovered(false)
    }
  }

  const handleRegenerateAndEmail = async () => {
    if (!uncovered.length) return
    if (!confirm(
      `This will OVERWRITE the password for ${uncovered.length} user(s) and ` +
      `then email them their new credentials.\n\nAny existing password those ` +
      `users may have had will stop working. Continue?`
    )) return

    setRegenSending(true)
    setRegenCreds([])
    setRegenProgress({ current: 0, total: 0, status: 'Starting…' })

    const ids = uncovered.map(u => u.id)
    const REGEN_BATCH = 350
    const totalBatches = Math.ceil(ids.length / REGEN_BATCH)
    const allCreds = []

    try {
      for (let b = 0; b < totalBatches; b++) {
        setRegenProgress({
          current: b + 1,
          total:   totalBatches,
          status:  `Generating passwords · batch ${b + 1} of ${totalBatches}…`,
        })
        const slice = ids.slice(b * REGEN_BATCH, (b + 1) * REGEN_BATCH)
        const creds = await adminApi.regenerateUncovered(slice)
        if (Array.isArray(creds)) allCreds.push(...creds)
      }

      // Tag everything as 'pending' until the mailer responds
      const initial = allCreds.map(c => ({ ...c, status: 'pending' }))
      setRegenCreds(initial)
      setUncoveredPhase('regenerated')

      // Use the same Apps-Script mailer as the bulk-upload path. We do this
      // in chunks so the script doesn't choke on a giant payload.
      setRegenProgress({ current: 0, total: 0, status: 'Sending emails…' })
      const MAIL_BATCH = 100
      for (let i = 0; i < allCreds.length; i += MAIL_BATCH) {
        const slice = allCreds.slice(i, i + MAIL_BATCH)
        const result = await sendCredentialEmails(slice.map(c => ({
          name: c.name, email: c.email, password: c.password,
        })))
        // Mark this slice with the mailer result
        setRegenCreds(prev => prev.map(p =>
          slice.find(s => s.email === p.email) ? { ...p, status: result } : p
        ))
      }

      setRegenProgress(null)
    } catch (e) {
      console.error(e)
      alert(`Regenerate / send failed: ${e.message || e}`)
      setRegenProgress(null)
    } finally {
      setRegenSending(false)
    }
  }

  const togglePassword = (email) =>
    setShowPassword(prev => ({ ...prev, [email]: !prev[email] }))

  const sentCount   = Object.values(emailProgress).filter(v => v === 'sent').length
  const failedCount = Object.values(emailProgress).filter(v => v === 'failed').length

  const totalPages = Math.ceil(users.length / itemsPerPage)
  const paginatedUsers = users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="manage-registrations-page fade-in">
      <div className="section-header">
        <span className="section-title">Manage Registrations</span>
      </div>

      <div className="tabs-container" style={{ marginBottom: 24, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { id: 'bulk', icon: '📤', label: 'Bulk Upload & Diff' },
          { id: 'manual', icon: '➕', label: 'Manual Entry & Reset' },
          { id: 'phase', icon: '🎯', label: 'Phase Selection' },
          { id: 'teams', icon: '👥', label: 'Team Manager' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === tab.id ? 'var(--accent-color)' : 'var(--bg-secondary)',
              color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 600 : 500,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Bulk Upload Tab ─────────────────────────────────────── */}
      {activeTab === 'bulk' && (
        <>
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
                style={{ height: 42, minWidth: 200, position: 'relative', overflow: 'hidden' }}
              >
                {isLoading ? (
                  <>
                    <span style={{ position: 'relative', zIndex: 2 }}>
                      {batchProgress
                        ? `Batch ${batchProgress.current} of ${batchProgress.total}…`
                        : 'Processing…'}
                    </span>
                    <div style={{
                      position: 'absolute', top: 0, left: 0, bottom: 0,
                      width: batchProgress
                        ? `${(batchProgress.current / batchProgress.total) * 100}%`
                        : '100%',
                      background: 'rgba(255,255,255,0.18)',
                      transition: batchProgress ? 'width 0.3s' : 'none',
                      animation: batchProgress ? 'none' : 'progress-indeterminate 1.5s infinite linear',
                    }} />
                  </>
                ) : 'Upload Registrations'}
              </button>
            </div>

            {/* Batch status line — shown while a multi-batch upload is in flight */}
            {isLoading && batchProgress && (
              <div style={{
                marginTop: 14, padding: '10px 14px', borderRadius: 8,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                fontSize: 12, color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: '#3b82f6',
                  boxShadow: '0 0 0 0 rgba(59,130,246,0.6)',
                  animation: 'pulse-dot 1.2s infinite',
                  flexShrink: 0,
                }} />
                <span>{batchProgress.status}</span>
                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes pulse-dot {
                    0%   { box-shadow: 0 0 0 0    rgba(59,130,246,0.55); }
                    70%  { box-shadow: 0 0 0 10px rgba(59,130,246,0);    }
                    100% { box-shadow: 0 0 0 0    rgba(59,130,246,0);    }
                  }
                ` }} />
              </div>
            )}

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

              <div className="table-responsive">
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
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
                    {paginatedUsers.map((u, idx) => {
                      const actualIndex = (currentPage - 1) * itemsPerPage + idx
                      const isNew   = u.Type === 'new'
                      const status  = emailProgress[u.Username]
                      return (
                        <tr key={u.Username + actualIndex} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background .15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={tdStyle}>{actualIndex + 1}</td>
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
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}

          {/* ── Find users missing from your credentials CSV ────────────────── */}
          <div className="card" style={{ maxWidth: 860, marginTop: 28 }}>
            <h3 style={{ marginBottom: 6 }}>Find Users Missing From Your CSV</h3>
            <p style={{ marginBottom: 18, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55 }}>
              Upload a CSV with <strong>Name, Email, Password</strong> columns of users who already received their credentials.
              We'll diff it against the <code>users</code> table and surface anyone present in the database but missing from your file.
              You can then regenerate fresh passwords for those users and send them credential emails — using the same mailer the upload flow uses.
              <br />
              <span style={{ color: '#f59e0b', fontSize: 12 }}>
                ⚠️ Regenerating overwrites <code>password_hash</code>. Any password those users may have had will stop working.
              </span>
            </p>

            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label style={labelStyle}>Already-sent CSV (Name, Email, Password)</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCoveredFileChange}
                  className="input-field"
                  style={{ paddingTop: 8, paddingBottom: 8 }}
                  disabled={findingUncovered || regenSending}
                  ref={coveredFileRef}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={handleFindUncovered}
                disabled={!coveredFile || findingUncovered || regenSending}
                style={{ height: 42, minWidth: 180 }}
              >
                {findingUncovered ? 'Diffing…' : 'Find Missing Users'}
              </button>
            </div>

            {/* Result list */}
            {uncoveredPhase !== 'idle' && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14 }}>
                      {uncoveredPhase === 'regenerated' ? 'Regenerated & emailed' : 'Missing users'}
                      <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                        {uncoveredPhase === 'regenerated' ? regenCreds.length : uncovered.length}
                      </span>
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {uncoveredPhase === 'regenerated'
                        ? 'New passwords were generated and credential emails dispatched via the Apps-Script mailer.'
                        : 'These users are in the database but not in your CSV.'}
                    </p>
                  </div>

                  {uncoveredPhase === 'preview' && uncovered.length > 0 && (
                    <button
                      className="btn btn-primary"
                      onClick={handleRegenerateAndEmail}
                      disabled={regenSending}
                      style={{ minWidth: 220, display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      {regenSending ? (
                        <>
                          <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                          {regenProgress?.status || 'Working…'}
                        </>
                      ) : '🔑 Generate Passwords & Email'}
                    </button>
                  )}
                </div>

                {regenProgress && regenSending && (
                  <div style={{
                    marginBottom: 14, padding: '10px 14px', borderRadius: 8,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    fontSize: 12, color: 'var(--text-secondary)',
                  }}>
                    {regenProgress.status}
                  </div>
                )}

                {/* Empty state */}
                {uncoveredPhase === 'preview' && uncovered.length === 0 && (
                  <div style={{
                    padding: '14px 16px', borderRadius: 10,
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#10b981', fontSize: 13,
                  }}>
                    ✓ No gaps found — every user in the database appears in your CSV.
                  </div>
                )}

                {/* Preview table — before regeneration */}
                {uncoveredPhase === 'preview' && uncovered.length > 0 && (
                  <div className="table-responsive">
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                          {['#', 'Name', 'Email'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {uncovered.slice(0, 200).map((u, i) => (
                          <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={tdStyle}>{i + 1}</td>
                            <td style={{ ...tdStyle, fontWeight: 500 }}>{u.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                            <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{u.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {uncovered.length > 200 && (
                      <div style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                        Showing first 200 of {uncovered.length}. The Generate &amp; Email step will process all of them.
                      </div>
                    )}
                  </div>
                )}

                {/* Result table — after regeneration */}
                {uncoveredPhase === 'regenerated' && regenCreds.length > 0 && (
                  <div className="table-responsive">
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                          {['#', 'Name', 'Email', 'New Password', 'Email Status'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {regenCreds.slice(0, 200).map((c, i) => (
                          <tr key={c.email + i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={tdStyle}>{i + 1}</td>
                            <td style={{ ...tdStyle, fontWeight: 500 }}>{c.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                            <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{c.email}</td>
                            <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{c.password}</td>
                            <td style={tdStyle}><EmailStatusBadge status={c.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {regenCreds.length > 200 && (
                      <div style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                        Showing first 200 of {regenCreds.length}.
                      </div>
                    )}
                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                      ✓ Sent: {regenCreds.filter(c => c.status === 'sent').length}
                      {' · '}
                      ✗ Failed: {regenCreds.filter(c => c.status === 'failed').length}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Manual Entry Tab ─────────────────────────── */}
      {activeTab === 'manual' && (
        <>
          <ManualEntryCard events={events} onCredentialEmailed={sendCredentialEmails} />
          <ResetPasswordCard />
        </>
      )}

      {/* ── Phase Selection Tab ────────────────────── */}
      {activeTab === 'phase' && (
        <SelectPhaseCard events={events} />
      )}

      {/* ── Manage Team Members Tab ──────────────────────────────── */}
      {activeTab === 'teams' && (
        <TeamManagerCard events={events} />
      )}
    </div>
  )
}

// ─── SelectPhaseCard ──────────────────────────────────────────────────────────

function SelectPhaseCard({ events }) {
  const [selectedEvent, setSelectedEvent] = useState('')
  const [file,          setFile]          = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [result,        setResult]        = useState(null) // { updated, edge_cases }
  const fileRef = React.useRef(null)

  async function handleSubmit() {
    if (!selectedEvent) { alert('Please select an event.'); return }
    if (!file)          { alert('Please choose a CSV file.'); return }

    setLoading(true)
    setResult(null)

    try {
      const text = await file.text()
      const { header, rows } = parseCSVRows(text)

      if (!header.length || !rows.length)
        throw new Error('CSV is empty or missing a header row.')

      const lower    = header.map(h => h.trim().toLowerCase())
      const emailIdx = lower.findIndex(h => h === 'email' || h === 'mail' || h === 'username')
      if (emailIdx < 0)
        throw new Error('CSV is missing an "email" column.')

      const emails = rows
        .map(r => (r[emailIdx] || '').trim().toLowerCase())
        .filter(e => e && e.includes('@'))

      if (!emails.length)
        throw new Error('No valid email addresses found in the CSV.')

      const data = await adminPanel.selectPhase(selectedEvent, emails)
      setResult(data)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      console.error(e)
      alert(e.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  function downloadEdgeCases() {
    if (!result?.edge_cases?.length) return
    const csv = 'email,reason\r\n' +
      result.edge_cases.map(ec => `${csvCell(ec.email)},${csvCell(ec.reason)}`).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'select_phase_edge_cases.csv'
    document.body.appendChild(a)
    a.click()
    URL.revokeObjectURL(url)
    a.remove()
  }

  return (
    <div className="card" style={{ maxWidth: 860, marginTop: 28 }}>
      <h3 style={{ marginBottom: 6 }}>Select Participants (Phase 1)</h3>
      <p style={{ marginBottom: 20, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55 }}>
        Upload a CSV with a single <strong>email</strong> column. All matched participants
        registered for the selected event will have their <code>phase</code> set to{' '}
        <strong>1</strong> (selected / cleared Round 1). Unrecognised emails or users not
        registered for the event are collected as edge cases.
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={labelStyle}>1. Select Event</label>
          <select
            className="input-field"
            value={selectedEvent}
            onChange={e => setSelectedEvent(e.target.value)}
            disabled={loading}
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
          <label style={labelStyle}>2. Upload CSV (email column)</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="input-field"
            style={{ paddingTop: 8, paddingBottom: 8 }}
            onChange={e => setFile(e.target.files?.[0] || null)}
            disabled={loading}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={loading || !selectedEvent || !file}
          style={{ height: 42, minWidth: 180 }}
        >
          {loading ? 'Processing…' : 'Mark as Selected'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div style={{ marginTop: 24 }}>
          {/* Summary strip */}
          <div style={{
            display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16,
          }}>
            {[
              { label: 'Phase set to 1', value: result.updated,            color: '#10b981' },
              { label: 'Edge Cases',     value: result.edge_cases?.length ?? 0, color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, minWidth: 120, padding: '12px 16px',
                background: 'var(--bg-card)', borderRadius: 8,
                borderLeft: `3px solid ${s.color}`,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Edge cases table */}
          {result.edge_cases?.length > 0 && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#fbbf24' }}>
                  ⚠️ {result.edge_cases.length} edge case{result.edge_cases.length !== 1 ? 's' : ''}
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={downloadEdgeCases}
                  style={{ fontSize: 12, padding: '4px 12px', height: 30 }}
                >
                  ↓ Download CSV
                </button>
              </div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {result.edge_cases.map((ec, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 12, padding: '6px 0',
                    borderBottom: i < result.edge_cases.length - 1 ? '1px solid rgba(245,158,11,0.15)' : 'none',
                    fontSize: 12, fontFamily: 'monospace',
                  }}>
                    <span style={{ color: '#fde68a', minWidth: 220, wordBreak: 'break-all' }}>{ec.email}</span>
                    <span style={{ color: '#fca5a5' }}>— {ec.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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

// ─── Manual Entry Card ───────────────────────────────────────────────────────

const TEAM_MODES = [
  { value: 'none',     label: '👤 No Team',       desc: 'Solo participant' },
  { value: 'existing', label: '🔗 Existing Team',  desc: 'Add to an existing team' },
  { value: 'new',      label: '✦ New Team',        desc: 'Create a new team' },
]

const EMPTY_FORM = {
  name: '', email: '', password: '',
  event_id: '', team_mode: 'none',
  existing_team_name: '', existing_member_name: '', new_team_name: '',
}

function ManualEntryCard({ events, onCredentialEmailed }) {
  const [form, setForm]           = useState(EMPTY_FORM)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [result, setResult]       = useState(null)   // ManualEnrollResponse from backend
  const [showPw, setShowPw]       = useState(false)
  const [copied, setCopied]       = useState(false)
  const [emailStatus, setEmailStatus] = useState(null) // null | 'sending' | 'sent' | 'failed'

  // Team lookup state
  const [teammateMail, setTeammateMail] = useState('')
  const [teamLookup, setTeamLookup]     = useState(null)   // null | 'loading' | { found, ... }
  const [lookupErr,  setLookupErr]      = useState(null)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  // Reset team lookup whenever teammate email or event changes
  const handleTeammateMailChange = (v) => {
    setTeammateMail(v)
    setTeamLookup(null)
    setLookupErr(null)
  }
  const handleEventChange = (v) => {
    set('event_id', v)
    setTeamLookup(null)
    setLookupErr(null)
  }

  const handleTeamCheck = async () => {
    if (!teammateMail.trim()) { setLookupErr('Enter a teammate email first.'); return }
    if (!form.event_id)       { setLookupErr('Select an event first.'); return }
    setTeamLookup('loading')
    setLookupErr(null)
    try {
      const res = await adminPanel.teamLookup(teammateMail.trim(), form.event_id)
      setTeamLookup(res)
      if (!res.found) setLookupErr(res.reason || 'Team not found.')
    } catch (e) {
      setTeamLookup(null)
      setLookupErr(e.message || 'Lookup failed.')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim())     { setError('Name is required.'); return }
    if (!form.email.trim())    { setError('Email is required.'); return }
    if (!form.password.trim()) { setError('Password is required.'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (!form.event_id)        { setError('Please select an event.'); return }
    if (form.team_mode === 'existing') {
      if (!teamLookup || teamLookup === 'loading' || !teamLookup.found) {
        setError('Please check a teammate email and confirm the team before submitting.'); return
      }
    }
    if (form.team_mode === 'new' && !form.new_team_name.trim()) {
      setError('Please enter the new team name.'); return
    }

    setLoading(true); setError(null); setResult(null); setEmailStatus(null)
    try {
      const res = await adminPanel.manualEnroll({
        name:                 form.name.trim(),
        email:                form.email.trim().toLowerCase(),
        password:             form.password,
        event_id:             form.event_id,
        team_mode:            form.team_mode,
        existing_team_id:     (form.team_mode === 'existing' && teamLookup?.found) ? teamLookup.team_id : null,
        new_team_name:        form.new_team_name.trim() || null,
      })
      setResult(res)
      setForm(EMPTY_FORM)
      setTeammateMail('')
      setTeamLookup(null)
      setLookupErr(null)
      setShowPw(false)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!result) return
    const text = [
      `Name:     ${result.name}`,
      `Email:    ${result.email}`,
      result.password ? `Password: ${result.password}` : null,
      `Event:    ${result.event_name}`,
      result.team_name ? `Team:     ${result.team_name}` : null,
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleSendEmail = async () => {
    if (!result) return
    setEmailStatus('sending')
    const status = await onCredentialEmailed([{
      name: result.name, email: result.email, password: result.password || '(existing account)',
    }])
    setEmailStatus(status)
  }

  // ── Pill selector for team mode ────────────────────────────────────────────
  const TeamModePill = ({ mode }) => {
    const active = form.team_mode === mode.value
    return (
      <button
        type="button"
        onClick={() => set('team_mode', mode.value)}
        style={{
          flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
          border: active ? '1.5px solid #6366f1' : '1.5px solid var(--border-color)',
          background: active ? 'rgba(99,102,241,0.12)' : 'var(--bg-secondary)',
          color: active ? '#a5b4fc' : 'var(--text-secondary)',
          transition: 'all .18s', textAlign: 'center',
          fontSize: 13, fontWeight: active ? 600 : 400,
        }}
      >
        <div style={{ fontSize: 15, marginBottom: 2 }}>{mode.label.split(' ')[0]}</div>
        <div>{mode.label.split(' ').slice(1).join(' ')}</div>
        <div style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>{mode.desc}</div>
      </button>
    )
  }

  return (
    <div className="card" style={{ maxWidth: 860, marginTop: 28 }}>
      <h3 style={{ marginBottom: 6 }}>Add Participant Manually</h3>
      <p style={{ marginBottom: 22, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55 }}>
        Create a single participant account and enrol them in an event. If the email already
        exists, the event is added to their existing account (no duplicate if already enrolled).
      </p>

      <form onSubmit={handleSubmit} autoComplete="off">
        {/* ── Row 1: Name + Email ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Full Name <span style={{ color: '#f87171' }}>*</span></label>
            <input
              className="input-field"
              type="text"
              placeholder="e.g. Arjun Sharma"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              disabled={loading}
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Email <span style={{ color: '#f87171' }}>*</span></label>
            <input
              className="input-field"
              type="email"
              placeholder="e.g. arjun@example.com"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              disabled={loading}
              autoComplete="off"
            />
          </div>
        </div>

        {/* ── Row 2: Password + Event ─────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Password <span style={{ color: '#f87171' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                className="input-field"
                type={showPw ? 'text' : 'password'}
                placeholder="Min 6 characters"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 14, lineHeight: 1,
                }}
                tabIndex={-1}
              >
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Event <span style={{ color: '#f87171' }}>*</span></label>
            <select
              className="input-field"
              value={form.event_id}
              onChange={e => handleEventChange(e.target.value)}
              disabled={loading}
            >
              <option value="">— Select an Event —</option>
              {events.map(ev => (
                <option key={ev.eventId || ev.id} value={ev.eventId || ev.id}>
                  {ev.name || ev.eventName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Team mode picker ────────────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Team Assignment</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {TEAM_MODES.map(m => <TeamModePill key={m.value} mode={m} />)}
          </div>
        </div>

        {/* ── Conditional team fields ─────────────────────────────────────── */}
        {form.team_mode === 'existing' && (
          <div style={{
            marginBottom: 16, padding: '14px 16px', borderRadius: 10,
            background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)',
          }}>
            {/* Email + Check row */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={labelStyle}>Teammate Email <span style={{ color: '#f87171' }}>*</span></label>
                <input
                  className="input-field"
                  type="email"
                  placeholder="e.g. priya@example.com"
                  value={teammateMail}
                  onChange={e => handleTeammateMailChange(e.target.value)}
                  disabled={loading || teamLookup === 'loading'}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                  Enter any existing member's email to look up their team.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleTeamCheck}
                disabled={loading || teamLookup === 'loading' || !teammateMail.trim() || !form.event_id}
                style={{ height: 40, minWidth: 100, marginBottom: 22 }}
              >
                {teamLookup === 'loading' ? 'Checking…' : '🔍 Check'}
              </button>
            </div>

            {/* Lookup error */}
            {lookupErr && teamLookup !== 'loading' && (
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 7, fontSize: 13,
                background: 'rgba(239,68,68,0.1)', color: '#f87171',
                border: '1px solid rgba(239,68,68,0.25)',
              }}>
                ⚠️ {lookupErr}
              </div>
            )}

            {/* Team confirmation card */}
            {teamLookup && teamLookup !== 'loading' && teamLookup.found && (
              <div style={{
                marginTop: 12, padding: '12px 14px', borderRadius: 9,
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#34d399' }}>
                    ✅ {teamLookup.team_name}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {teamLookup.member_count} member{teamLookup.member_count !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(teamLookup.members || []).map(m => (
                    <span key={m.id} style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 12,
                      background: 'rgba(16,185,129,0.12)', color: '#6ee7b7',
                      border: '1px solid rgba(16,185,129,0.2)',
                    }}>
                      {m.name}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  Team ID: <code style={{ fontSize: 10 }}>{teamLookup.team_id}</code>
                </div>
              </div>
            )}
          </div>
        )}

        {form.team_mode === 'new' && (
          <div style={{
            marginBottom: 16, padding: '14px 16px', borderRadius: 10,
            background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <label style={labelStyle}>New Team Name <span style={{ color: '#f87171' }}>*</span></label>
            <input
              className="input-field"
              type="text"
              placeholder="e.g. Team Phoenix"
              value={form.new_team_name}
              onChange={e => set('new_team_name', e.target.value)}
              disabled={loading}
              style={{ maxWidth: 380 }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
              A new team will be created with this participant as the leader.
            </div>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && (
          <div style={{
            marginBottom: 14, padding: '10px 14px', borderRadius: 8,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', fontSize: 13,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Submit ──────────────────────────────────────────────────────── */}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ minWidth: 200, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {loading ? (
            <>
              <span style={{
                width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite', display: 'inline-block',
              }} />
              Adding Participant…
            </>
          ) : '➕ Add Participant'}
        </button>
      </form>

      {/* ── Success banner ──────────────────────────────────────────────── */}
      {result && (
        <div style={{
          marginTop: 22, padding: '18px 20px', borderRadius: 12,
          background: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#10b981', marginBottom: 4 }}>
                {result.is_new_user ? '🎉 New participant created & enrolled!' : '✓ Existing user enrolled in event!'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{result.message}</div>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                background: copied ? 'rgba(16,185,129,0.15)' : 'var(--bg-secondary)',
                border: copied ? '1px solid rgba(16,185,129,0.4)' : '1px solid var(--border-color)',
                color: copied ? '#10b981' : 'var(--text-secondary)',
                transition: 'all .2s', whiteSpace: 'nowrap',
              }}
            >
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>

          {/* Credential grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10, marginTop: 16,
          }}>
            {[
              { label: 'Name',  value: result.name },
              { label: 'Email', value: result.email, mono: true },
              result.password
                ? { label: 'Password', value: result.password, mono: true, secret: true }
                : { label: 'Password', value: '(existing account — unchanged)', dim: true },
              { label: 'Event', value: result.event_name },
              result.team_name ? { label: 'Team', value: result.team_name } : null,
            ].filter(Boolean).map(item => (
              <div key={item.label} style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>
                  {item.label}
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  fontFamily: item.mono ? 'monospace' : 'inherit',
                  color: item.dim ? 'var(--text-muted)' : 'var(--text-primary)',
                  wordBreak: 'break-all',
                }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Email send button — only meaningful if a password was returned (new user) */}
          {result.password && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSendEmail}
                disabled={emailStatus === 'sending' || emailStatus === 'sent'}
                style={{ minWidth: 200, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {emailStatus === 'sending' ? (
                  <>
                    <span style={{
                      width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff', borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite', display: 'inline-block',
                    }} />
                    Sending…
                  </>
                ) : emailStatus === 'sent' ? '✓ Credential Email Sent'
                  : emailStatus === 'failed' ? '✗ Email Failed — Retry?'
                  : '📧 Send Credential Email'}
              </button>
              {emailStatus && (
                <EmailStatusBadge status={emailStatus} />
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setResult(null)}
            style={{
              marginTop: 14, background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 12, padding: 0,
            }}
          >
            ✕ Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

// ─── TeamManagerCard ──────────────────────────────────────────────────────────

function TeamManagerCard({ events }) {
  const [eventId,   setEventId]   = React.useState('')
  const [email,     setEmail]     = React.useState('')
  const [loading,   setLoading]   = React.useState(false)
  const [team,      setTeam]      = React.useState(null)
  const [lookupErr, setLookupErr] = React.useState(null)
  const [removing,  setRemoving]  = React.useState({})
  const [removeMsg, setRemoveMsg] = React.useState({})

  const reset = () => { setTeam(null); setLookupErr(null); setRemoving({}); setRemoveMsg({}) }

  const handleFetch = async () => {
    if (!email.trim()) { setLookupErr('Enter a member email.'); return }
    if (!eventId)      { setLookupErr('Select an event.'); return }
    setLoading(true); reset()
    try {
      const res = await adminPanel.teamLookup(email.trim(), eventId)
      setTeam(res)
      if (!res.found) setLookupErr(res.reason || 'Team not found.')
    } catch (e) {
      setLookupErr(e.message || 'Lookup failed.')
    } finally {
      setLoading(false)
    }
  }

  const askRemove    = (uid) => setRemoving(r => ({ ...r, [uid]: 'confirm' }))
  const cancelRemove = (uid) => setRemoving(r => { const n = { ...r }; delete n[uid]; return n })

  const confirmRemove = async (uid) => {
    setRemoving(r => ({ ...r, [uid]: 'loading' }))
    try {
      await adminPanel.removeTeamMember(team.team_id, uid, eventId)
      setTeam(t => ({ ...t, members: t.members.filter(m => m.id !== uid), member_count: t.member_count - 1 }))
      setRemoveMsg(m => ({ ...m, [uid]: 'Removed ✓' }))
    } catch (e) {
      setRemoveMsg(m => ({ ...m, [uid]: 'Failed: ' + e.message }))
    } finally {
      setRemoving(r => { const n = { ...r }; delete n[uid]; return n })
    }
  }

  return (
    <div className="card" style={{ maxWidth: 860, marginTop: 28 }}>
      <h3 style={{ marginBottom: 6 }}>Manage Team Members</h3>
      <p style={{ marginBottom: 20, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55 }}>
        Enter any team member's email to look up their team. Remove individual members
        — they stay registered for the event as solo participants.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={labelStyle}>Event</label>
          <select className="input-field" value={eventId}
            onChange={e => { setEventId(e.target.value); reset() }} disabled={loading}>
            <option value="">— Choose Event —</option>
            {events.map(ev => (
              <option key={ev.eventId || ev.id} value={ev.eventId || ev.id}>{ev.name || ev.eventName}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={labelStyle}>Any Member's Email</label>
          <input className="input-field" type="email" placeholder="e.g. member@example.com"
            value={email} onChange={e => { setEmail(e.target.value); reset() }}
            disabled={loading} onKeyDown={e => e.key === 'Enter' && handleFetch()} />
        </div>
        <button className="btn btn-primary" onClick={handleFetch}
          disabled={loading || !email.trim() || !eventId} style={{ height: 42, minWidth: 140 }}>
          {loading ? 'Fetching…' : '🔍 Fetch Team'}
        </button>
      </div>

      {lookupErr && (
        <div style={{
          padding: '9px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171',
        }}>⚠️ {lookupErr}</div>
      )}

      {team && team.found && (
        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', borderRadius: '10px 10px 0 0',
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
            borderBottom: 'none',
          }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>🏷️ {team.team_name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {team.members.length} / {team.member_count} member{team.member_count !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ border: '1px solid rgba(99,102,241,0.25)', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
            {team.members.length === 0 ? (
              <div style={{ padding: '18px 14px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                No members remaining.
              </div>
            ) : team.members.map((m, i) => {
              const state  = removing[m.id]
              const msg    = removeMsg[m.id]
              const isLast = i === team.members.length - 1
              return (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                  background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)',
                  borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 22, textAlign: 'right' }}>{i + 1}</span>
                  <span style={{ flex: 1, fontWeight: 500, fontSize: 13 }}>{m.name}</span>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{m.email}</span>
                  {msg ? (
                    <span style={{ fontSize: 12, color: '#10b981', minWidth: 80 }}>{msg}</span>
                  ) : state === 'confirm' ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#f59e0b' }}>Remove?</span>
                      <button onClick={() => confirmRemove(m.id)} style={{
                        padding: '3px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171',
                      }}>Yes</button>
                      <button onClick={() => cancelRemove(m.id)} style={{
                        padding: '3px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)',
                      }}>No</button>
                    </div>
                  ) : state === 'loading' ? (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Removing…</span>
                  ) : (
                    <button onClick={() => askRemove(m.id)} style={{
                      padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171',
                    }}>Remove</button>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            Team ID: <code style={{ fontSize: 10 }}>{team.team_id}</code>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ResetPasswordCard ────────────────────────────────────────────────────────

function ResetPasswordCard() {
  const [email,    setEmail]    = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPw,   setShowPw]   = React.useState(false)
  const [loading,  setLoading]  = React.useState(false)
  const [result,   setResult]   = React.useState(null)
  const [error,    setError]    = React.useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim())       { setError('Email is required.'); return }
    if (!password.trim())    { setError('New password is required.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await adminPanel.resetPassword(email.trim().toLowerCase(), password)
      setResult(res)
      setEmail(''); setPassword('')
    } catch (e) {
      setError(e.message || 'Reset failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 860, marginTop: 28 }}>
      <h3 style={{ marginBottom: 6 }}>Reset Participant Password</h3>
      <p style={{ marginBottom: 20, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55 }}>
        Set a new password for any participant. The old password stops working immediately.{' '}
        <span style={{ color: '#f59e0b', fontSize: 12 }}>
          ⚠️ Overwrites <code>password_hash</code> — irreversible.
        </span>
      </p>

      <form onSubmit={handleSubmit} autoComplete="off">
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Participant Email <span style={{ color: '#f87171' }}>*</span></label>
            <input className="input-field" type="email" placeholder="e.g. arjun@example.com"
              value={email} onChange={e => { setEmail(e.target.value); setResult(null); setError(null) }}
              disabled={loading} autoComplete="off" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>New Password <span style={{ color: '#f87171' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <input className="input-field" type={showPw ? 'text' : 'password'}
                placeholder="Min 6 characters" value={password}
                onChange={e => { setPassword(e.target.value); setResult(null); setError(null) }}
                disabled={loading} autoComplete="new-password" style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14,
              }}>{showPw ? '🙈' : '👁️'}</button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary"
            disabled={loading || !email.trim() || !password.trim()} style={{ height: 42, minWidth: 160 }}>
            {loading ? 'Resetting…' : '🔑 Reset Password'}
          </button>
        </div>

        {error && (
          <div style={{
            marginTop: 14, padding: '9px 14px', borderRadius: 8, fontSize: 13,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171',
          }}>⚠️ {error}</div>
        )}

        {result && (
          <div style={{
            marginTop: 14, padding: '10px 16px', borderRadius: 8, fontSize: 13,
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
            color: '#34d399', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <div>
              <div style={{ fontWeight: 600 }}>Password reset for {result.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{result.email}</div>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
