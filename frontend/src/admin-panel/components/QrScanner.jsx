import React, { useState, useRef } from 'react'
import './QrScanner.css'

/**
 * Simulated QR Scanner UI.
 *
 * Props:
 *   participants   — list to match against
 *   onScan(p)      — called when a matching participant is found. May return
 *                    a Promise resolving to `{ status, message }` from the
 *                    backend. The overlay shown on the QR frame reflects this
 *                    server result (green for accepted, red for rejected /
 *                    error).
 *   alreadyField   — optional client-side flag to short-circuit with a warn
 *                    state before calling onScan (e.g. 'entryScanned').
 *   actionLabel    — human label for the action (e.g. 'Food', 'Entry').
 *   trustServer    — if true, skip the local alreadyField check and rely on
 *                    the server response (recommended for food scans where
 *                    the backend auto-assigns the next slot).
 */
export default function QrScanner({
  participants,
  onScan,
  alreadyField,
  actionLabel = 'Scan',
  trustServer = false,
}) {
  const [input,       setInput]       = useState('')
  const [result,      setResult]      = useState(null) // { type: 'success'|'warn'|'error', msg, participant }
  const [scanning,    setScanning]    = useState(false)
  const [animate,     setAnimate]     = useState(false)
  const inputRef = useRef()

  async function simulateScan() {
    if (!input.trim()) return
    setScanning(true)
    setResult(null)

    // Small delay for the scan animation — keeps the UX feeling like the real thing.
    await new Promise(r => setTimeout(r, 600))

    const q = input.trim().toLowerCase()
    const p = participants.find(
      pt =>
        pt.id.toLowerCase() === q ||
        pt.name.toLowerCase() === q ||
        pt.username?.toLowerCase() === q
    )

    if (!p) {
      setResult({ type: 'error', msg: `No participant found for "${input.trim()}"` })
    } else if (p.status === 'restricted') {
      setResult({ type: 'error', msg: `${p.name} is restricted and cannot be processed.`, participant: p })
    } else if (!trustServer && alreadyField && p[alreadyField]) {
      setResult({
        type: 'warn',
        msg: `${p.name} has already been scanned for ${actionLabel}.`,
        participant: p,
      })
    } else {
      // Fire the scan — wait for the server so the overlay reflects reality.
      let server = null
      try {
        server = await onScan(p)
      } catch (e) {
        server = { status: 'error', message: e?.message || 'Scan failed' }
      }
      const status = server?.status || 'accepted'
      const serverMsg = server?.message
      if (status === 'accepted') {
        setResult({
          type: 'success',
          msg: serverMsg || `${p.name} — ${actionLabel} recorded successfully!`,
          participant: p,
        })
      } else if (status === 'rejected') {
        setResult({
          type: 'warn',
          msg: serverMsg || `${p.name} — already processed.`,
          participant: p,
        })
      } else {
        setResult({
          type: 'error',
          msg: serverMsg || `${p.name} — scan failed.`,
          participant: p,
        })
      }
    }

    setScanning(false)
    setInput('')
    inputRef.current?.focus()
    triggerAnimate()
  }

  function triggerAnimate() {
    setAnimate(true)
    setTimeout(() => setAnimate(false), 1000)
  }

  function handleKey(e) {
    if (e.key === 'Enter') simulateScan()
  }

  // Outcome drives the big overlay on top of the QR frame.
  const overlay = result && (result.type === 'success'
    ? { tone: 'success', label: 'Accepted' }
    : result.type === 'warn'
      ? { tone: 'warn',  label: 'Rejected' }
      : { tone: 'error', label: 'Rejected' })

  return (
    <div className="qr-scanner">
      {/* Camera frame simulation */}
      <div className={`qr-frame ${animate ? 'animate' : ''} ${result?.type || ''}`}>
        <div className="qr-corners">
          <span className="corner tl" /><span className="corner tr" />
          <span className="corner bl" /><span className="corner br" />
        </div>
        <div className="scan-line" />
        <div className="qr-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.25">
            <polyline points="23 7 23 1 17 1"/><line x1="16" y1="8" x2="23" y2="1"/>
            <polyline points="1 7 1 1 7 1"/><line x1="8" y1="8" x2="1" y2="1"/>
            <polyline points="23 17 23 23 17 23"/><line x1="16" y1="16" x2="23" y2="23"/>
            <polyline points="1 17 1 23 7 23"/><line x1="8" y1="16" x2="1" y2="23"/>
          </svg>
          <p>Point camera at QR code</p>
        </div>

        {/* Big success/fail overlay on the QR frame */}
        {overlay && (
          <div
            key={result.msg /* forces re-mount so the pop animation fires every scan */}
            className={`qr-outcome qr-outcome-${overlay.tone} fade-in`}
            role="status"
            aria-live="polite"
          >
            {overlay.tone === 'success' ? (
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="12" cy="12" r="10" />
                <polyline points="8 12 11 15 16 9" />
              </svg>
            ) : (
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            <p className="qr-outcome-label">{overlay.label}</p>
          </div>
        )}
      </div>

      {/* Manual input fallback */}
      <div className="qr-input-section">
        <p className="qr-label">Or enter Participant ID / Name / Email manually</p>
        <div className="qr-input-row">
          <input
            ref={inputRef}
            id="scanner-manual-input"
            className="input-field"
            type="text"
            placeholder="e.g. p1 or archived-008018836c@example.invalid or Ravi Kumar"
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
            {scanning ? <span className="spinner" /> : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="23 7 23 1 17 1"/><line x1="16" y1="8" x2="23" y2="1"/>
                  <polyline points="1 7 1 1 7 1"/><line x1="8" y1="8" x2="1" y2="1"/>
                  <polyline points="23 17 23 23 17 23"/><line x1="16" y1="16" x2="23" y2="23"/>
                  <polyline points="1 17 1 23 7 23"/><line x1="8" y1="16" x2="1" y2="23"/>
                </svg>
                Scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`qr-result qr-result-${result.type} fade-in`}>
          <div className="result-icon">
            {result.type === 'success' && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
            {result.type === 'warn' && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            )}
            {result.type === 'error' && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            )}
          </div>
          <div>
            <p className="result-msg">{result.msg}</p>
            {result.participant && (
              <p className="result-sub">{result.participant.eventName} · {result.participant.teamId || 'No team'}</p>
            )}
          </div>
        </div>
      )}

      {/* Quick reference */}
      <div className="qr-tip">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Enter participant ID or name to scan manually
      </div>
    </div>
  )
}
