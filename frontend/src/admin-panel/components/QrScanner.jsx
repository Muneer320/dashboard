import React, { useState, useRef, useEffect } from 'react'
import QrScannerLib from 'qr-scanner'
import './QrScanner.css'

/**
 * QR Scanner — uses `qr-scanner` for camera scanning + manual text input fallback.
 *
 * Props:
 *   participants  — all participants (for local lookup / display)
 *   onScan(p)     — called with matched participant (or { id: uuid } if not in local list).
 *                   Should return Promise<{ status, message }> from the backend.
 *   alreadyField  — optional client-side flag to short-circuit (e.g. 'entryScanned').
 *   actionLabel   — human label for the action (e.g. 'Food', 'Entry').
 *   trustServer   — if true, skip alreadyField check and rely solely on server response.
 */
export default function QrScanner({
  participants,
  onScan,
  alreadyField,
  actionLabel = 'Scan',
  trustServer = false,
}) {
  const [input,         setInput]         = useState('')
  const [result,        setResult]        = useState(null)
  const [scanning,      setScanning]      = useState(false)
  const [cameraActive,  setCameraActive]  = useState(false)
  const [cameraError,   setCameraError]   = useState(null)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [toast,         setToast]         = useState(null)  // { name, action }
  const toastTimerRef = useRef(null)

  // Refs
  const participantsRef = useRef(participants)
  const onScanRef       = useRef(onScan)
  const alreadyFieldRef = useRef(alreadyField)
  const trustServerRef  = useRef(trustServer)
  const actionLabelRef  = useRef(actionLabel)
  const inputRef        = useRef()
  const videoRef        = useRef()
  const scannerRef      = useRef(null)  // qr-scanner instance
  const processingRef   = useRef(false)
  const lastScanRef     = useRef(0)
  const toastRef        = useRef(null)
  const resultRef       = useRef(null)

  // Keep refs in sync with props and state
  useEffect(() => { participantsRef.current = participants }, [participants])
  useEffect(() => { onScanRef.current = onScan }, [onScan])
  useEffect(() => { alreadyFieldRef.current = alreadyField }, [alreadyField])
  useEffect(() => { trustServerRef.current = trustServer }, [trustServer])
  useEffect(() => { actionLabelRef.current = actionLabel }, [actionLabel])
  useEffect(() => { toastRef.current = toast }, [toast])
  useEffect(() => { resultRef.current = result }, [result])

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [])

  // ─── Dismiss Helpers ──────────────────────────────────────────────────────

  function dismissToast() {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(null)
    lastScanRef.current = Date.now() // Enforce gap after dismiss
  }

  function dismissResult() {
    setResult(null)
    lastScanRef.current = Date.now() // Enforce gap after dismiss
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────


  function normalisePayload(raw) {
    const cleaned = String(raw || '').trim()
    if (!cleaned) return ''
    const upper = cleaned.toUpperCase()
    if (upper.startsWith('ASCENT:')) return cleaned.slice(7).trim()
    if (upper.startsWith('ASCENT-')) return cleaned.slice(7).trim()
    return cleaned
  }

  function findParticipant(query) {
    const q = query.trim().toLowerCase()
    return (participantsRef.current || []).find(pt => {
      const id       = String(pt.id       || '').toLowerCase()
      const name     = String(pt.name     || '').toLowerCase()
      const username = String(pt.username || '').toLowerCase()
      return id === q || name === q || username === q
    })
  }

  // ─── Camera ───────────────────────────────────────────────────────────────

  async function startCamera() {
    setCameraError(null)
    setCameraLoading(true)
    setResult(null)

    try {
      // qr-scanner needs the <video> element to exist first
      if (!videoRef.current) throw new Error('Video element not ready')

      const scanner = new QrScannerLib(
        videoRef.current,
        (result) => {
          // ── DEBUG ── raw QR content printed on every successful decode
          console.log('%c[QR SCAN] Raw decoded:', 'color:#a78bfa;font-weight:bold', result.data)
          handleCameraDecode(result.data)
        },
        {
          preferredCamera: 'environment',
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
          returnDetailedScanResult: true,
        }
      )

      scannerRef.current = scanner
      await scanner.start()

      setCameraActive(true)
      console.log('[QR SCAN] Camera started successfully')
    } catch (err) {
      console.error('[QR SCAN] Camera start failed:', err)
      const msg = String(err?.message || err || '')
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('notallowed')) {
        setCameraError('Camera permission denied — allow access in your browser settings and try again.')
      } else if (!navigator.mediaDevices) {
        setCameraError('Camera API unavailable — use localhost or HTTPS. Manual input works anywhere.')
      } else {
        setCameraError(msg || 'Could not start camera.')
      }
    } finally {
      setCameraLoading(false)
    }
  }

  function stopCamera() {
    const scanner = scannerRef.current
    if (!scanner) return
    try {
      scanner.stop()
      scanner.destroy()
    } catch (_) {}
    scannerRef.current = null
    setCameraActive(false)
  }

  function toggleCamera() {
    cameraActive ? stopCamera() : startCamera()
  }

  // ─── Scan flow ────────────────────────────────────────────────────────────

  function handleCameraDecode(rawValue) {
    if (toastRef.current || resultRef.current) return // Block while showing!
    
    // 1s debounce so a single QR doesn't fire multiple backend calls
    const now = Date.now()
    if (now - lastScanRef.current < 1000) return
    if (processingRef.current) return
    lastScanRef.current = now
    processScanValue(rawValue)
  }

  async function processScanValue(rawValue) {
    const raw = String(rawValue || '').trim()
    if (!raw || processingRef.current) return

    processingRef.current = true
    setScanning(true)
    setResult(null)

    try {
      await new Promise(r => setTimeout(r, 200))

      const normalized = normalisePayload(raw)
      const lookup     = normalized || raw

      console.log('%c[QR SCAN] Processing:', 'color:#34d399;font-weight:bold',
        { raw, normalized, lookup })

      const p = findParticipant(lookup)
      console.log('[QR SCAN] Local match:', p ? p.name : '(none — sending UUID to backend)')

      if (!p) {
        // Not in local list — pass UUID straight to backend
        const server = await safeScan({ id: lookup })
        showServerResult(server, lookup)
        return
      }

      if (p.status === 'restricted') {
        setResult({ type: 'error', msg: `${p.name} is restricted.`, participant: p })
        return
      }

      // Food/Attendance gate: participant must have completed main-gate entry first
      if ((actionLabelRef.current === 'Food' || actionLabelRef.current === 'Attendance') && !p.entryScanned) {
        setResult({
          type: 'error',
          msg: `${p.name} has not completed main gate entry. Entry scan required before ${actionLabelRef.current.toLowerCase()} can be marked.`,
          participant: p,
        })
        return
      }

      if (actionLabelRef.current === 'Food' && (p.phase ?? 0) === 0) {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setToast({ label: 'Not Qualified', name: `${p.name} — not selected for Round 2`, isError: true })
        toastTimerRef.current = setTimeout(dismissToast, 3000)
        return
      }

      if (actionLabelRef.current === 'Attendance' && (p.phase ?? 0) === 0) {
        // Use the toast popup so it's unmistakable
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        setToast({ label: 'Not Qualified', name: `${p.name} — not selected for Round 2`, isError: true })
        toastTimerRef.current = setTimeout(dismissToast, 3000)
        return
      }

      if (!trustServerRef.current && alreadyFieldRef.current && p[alreadyFieldRef.current]) {
        setResult({
          type: 'warn',
          msg: `${p.name} has already been scanned for ${actionLabelRef.current}.`,
          participant: p,
        })
        return
      }

      const server = await safeScan(p)
      showServerResult(server, null, p)
    } finally {
      setScanning(false)
      processingRef.current = false
    }
  }

  async function safeScan(arg) {
    try {
      return await onScanRef.current?.(arg)
    } catch (e) {
      return { status: 'error', message: e?.message || 'Scan failed' }
    }
  }

  function showServerResult(server, lookupId, participant) {
    const status = server?.status || 'accepted'
    const msg    = server?.message
    const shortId = lookupId ? `${lookupId.slice(0, 8)}…` : null

    if (status === 'accepted') {
      const displayName = participant?.name || `ID ${shortId}`
      const action = actionLabelRef.current
      
      let toastLabel =
        action === 'Food'       ? 'Food Entry Marked' :
        action === 'Attendance' ? 'Attendance Marked'  :
        action === 'Entry'      ? 'Entry Marked'       :
        `${action} Recorded`
        
      let isWarn = false

      // If Entry and phase == 0, make it an orange "Visitor" toast
      const isVisitorMsg = msg && msg.toLowerCase().includes('visitor')
      const isVisitorLocal = participant && (participant.phase ?? 0) === 0
      
      if (action === 'Entry' && (isVisitorMsg || isVisitorLocal)) {
        toastLabel = 'Visitor, Entry Marked'
        isWarn = true
      }

      // Show ONLY the toast for success — no inline strip
      setResult(null)

      // ── Success popup toast ──
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setToast({ label: toastLabel, name: displayName, isWarn })
      toastTimerRef.current = setTimeout(dismissToast, 2500)
    } else if (status === 'rejected') {
      setResult({
        type: 'warn',
        msg: msg || (participant ? `${participant.name} — already processed.` : 'Already processed.'),
        participant,
      })
    } else {
      setResult({
        type: 'error',
        msg: msg || (participant ? `${participant.name} — scan failed.` : `Participant not found (${shortId})`),
        participant,
      })
    }
  }

  async function simulateScan() {
    if (!input.trim()) return
    await processScanValue(input.trim())
    setInput('')
    inputRef.current?.focus()
  }

  function handleKey(e) {
    if (e.key === 'Enter') simulateScan()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="qr-scanner">

      {/* ── Success toast popup ───────────────────────────────────────────── */}
      {toast && (
        <div className="qr-toast-overlay" onClick={dismissToast} role="dialog" aria-live="assertive">
          <div className={`qr-toast${toast.isError ? ' error' : toast.isWarn ? ' warn' : ''}`}>
            <div className={`qr-toast-icon${toast.isError ? ' error' : toast.isWarn ? ' warn' : ''}`}>
              {toast.isError ? (
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              ) : toast.isWarn ? (
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="13" /><circle cx="12" cy="17" r="0.5" fill="currentColor" />
                </svg>
              ) : (
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="9 12 11.5 14.5 15.5 10" />
                </svg>
              )}
            </div>
            <p className={`qr-toast-label${toast.isError ? ' error' : toast.isWarn ? ' warn' : ''}`}>{toast.label}</p>
            {toast.name && <p className="qr-toast-name">{toast.name}</p>}
            <p className="qr-toast-dismiss">Tap to dismiss</p>
          </div>
        </div>
      )}

      {/* Camera */}
      <div className="qr-camera-section">
        <div className={`qr-video-wrapper${cameraActive ? ' active' : ''}`}>
          {/* qr-scanner controls this <video> element directly */}
          <video ref={videoRef} className="qr-video" />

          {!cameraActive && (
            <div className="qr-camera-placeholder">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {cameraError
                ? <p className="qr-camera-error">{cameraError}</p>
                : <p className="qr-camera-hint">Click Start Camera to scan QR codes</p>
              }
            </div>
          )}
        </div>

        <button
          id="scanner-camera-toggle"
          className={`btn ${cameraActive ? 'btn-secondary' : 'btn-primary'} qr-camera-toggle`}
          onClick={toggleCamera}
          disabled={cameraLoading || scanning}
        >
          {cameraLoading ? (
            <><span className="spinner" /> Starting…</>
          ) : cameraActive ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
              </svg>
              Stop Camera
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Start Camera
            </>
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="qr-divider"><span>or enter manually</span></div>

      {/* Manual input */}
      <div className="qr-input-section">
        <div className="qr-input-row">
          <input
            ref={inputRef}
            id="scanner-manual-input"
            className="input-field"
            type="text"
            placeholder="UUID, email, or name…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="off"
          />
          <button
            id="scanner-submit-btn"
            className="btn btn-primary"
            onClick={simulateScan}
            disabled={scanning || !input.trim()}
          >
            {scanning ? <span className="spinner" /> : 'Scan'}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`qr-result qr-result-${result.type}`} onClick={dismissResult} style={{ cursor: 'pointer' }} title="Tap to dismiss">
          <div className="result-icon">
            {result.type === 'success' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
            {result.type === 'warn' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            )}
            {result.type === 'error' && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            )}
          </div>
          <div>
            <p className="result-msg">{result.msg}</p>
            {result.participant && (
              <p className="result-sub">
                {result.participant.eventName} · {result.participant.teamId || 'No team'}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="qr-tip">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Camera requires HTTPS or localhost · Manual input works everywhere
      </div>
    </div>
  )
}
