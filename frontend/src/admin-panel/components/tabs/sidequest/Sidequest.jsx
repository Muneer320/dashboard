// Sidequest admin tabs — eight pages bundled into one file to share
// helpers and avoid CSS duplication. Uses the existing admin-theme
// utility classes (.card, .btn, .badge, .data-table, .input-field,
// .section-header, .section-title, .empty-state) from index.css.

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { adminCoins } from '../../../../lib/api'

// ─────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────
const SOURCE_LABEL = {
  RSVP_POST: 'RSVP LinkedIn',
  ROUND1_PROJECT: 'Round 1 Project',
  AR_FILTER: 'AR Filter Snap',
  SCAVENGER_HUNT: 'Scavenger Hunt',
  RAZORPAY_PITCH: 'Razorpay Pitch',
  FUTURE_VISION: 'Future Vision',
  CREATOR_COLLAB: 'Creator Collab',
  MVP_MUSEUM: 'MVP Museum',
  JOBS_WALL: 'Jobs Wall',
  ECO_EXCHANGE: 'Eco Exchange',
  ECO_DESIGN_WIN: 'Eco Design Win',
  EVENT_WIN: 'Event Win',
  ENGAGEMENT: 'Engagement',
  POWER_HOUR_BONUS: 'Power Hour Bonus',
  SURPRISE_DROP: 'Surprise Drop',
  REVERSAL: 'Reversal',
  RESTORE: 'Restore',
  MANUAL_ADJUSTMENT: 'Manual Adjustment',
}

const REJECT_TEMPLATES = [
  'Hashtag #ASCENT26 not found',
  'Post belongs to a different account',
  'Post date outside campaign window',
  'Post content not relevant to ASCENT’26',
  'Duplicate submission',
]

function fmtTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-IN', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short',
    })
  } catch { return iso }
}
function relTime(iso) {
  if (!iso) return ''
  const d = (Date.now() - new Date(iso)) / 1000
  if (d < 60) return `${Math.floor(d)}s ago`
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

function Spinner() {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
      Loading…
    </div>
  )
}

function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 'var(--radius-md)',
      background: 'var(--danger-dim)', border: '1px solid rgba(239,68,68,0.3)',
      color: 'var(--danger)', fontSize: 13, marginBottom: 12,
    }}>{message}</div>
  )
}

function PageHeader({ title, sub, action }) {
  return (
    <div className="section-header" style={{ alignItems: 'flex-start' }}>
      <div>
        <span className="section-title" style={{ fontSize: '1.25rem' }}>{title}</span>
        {sub && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>
        )}
      </div>
      {action}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 1. UGC Verification Queue
// ─────────────────────────────────────────────────────────────
export function UGCQueue() {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState({ source_type: '', auto_check_passed: '' })
  const [rejectFor, setRejectFor] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [working, setWorking] = useState(false)

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    setError('')
    try {
      const params = {}
      if (filter.source_type) params.source_type = filter.source_type
      if (filter.auto_check_passed !== '') params.auto_check_passed = filter.auto_check_passed
      const data = await adminCoins.ugcQueue(params)
      setQueue(data || [])
    } catch (e) { setError(e.message) }
    finally { if (showSpinner) setLoading(false) }
  }, [filter])
  useEffect(() => { load(true) }, [load])
  // Live refresh — poll every 15s without showing the loading spinner.
  useEffect(() => {
    const id = setInterval(() => load(false), 15000)
    return () => clearInterval(id)
  }, [load])

  const approve = async (id) => {
    setWorking(true); setError('')
    try { await adminCoins.approveUGC(id); await load() }
    catch (e) { setError(e.message) }
    finally { setWorking(false) }
  }
  const reject = async () => {
    if (!rejectReason.trim()) return
    setWorking(true); setError('')
    try {
      await adminCoins.rejectUGC(rejectFor, rejectReason)
      setRejectFor(null); setRejectReason('')
      await load()
    } catch (e) { setError(e.message) }
    finally { setWorking(false) }
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="Verification Queue"
        sub="Approve or reject UGC submissions awaiting review."
        action={<button className="btn btn-ghost" onClick={load}>Refresh</button>}
      />

      <ErrorBanner message={error} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select className="input-field" value={filter.source_type}
          onChange={(e) => setFilter({ ...filter, source_type: e.target.value })}
          style={{ width: 180 }}>
          <option value="">All sources</option>
          {Object.keys(SOURCE_LABEL).map(s => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
        </select>
        <select className="input-field" value={filter.auto_check_passed}
          onChange={(e) => setFilter({ ...filter, auto_check_passed: e.target.value })}
          style={{ width: 180 }}>
          <option value="">Any auto-check</option>
          <option value="true">Auto-check passed</option>
          <option value="false">Auto-check failed</option>
        </select>
      </div>

      <div className="card no-scrollbar" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? <Spinner /> : queue.length === 0 ? (
          <div className="empty-state">
            <p>Queue is empty — every submission has been processed.</p>
          </div>
        ) : (
          <table className="data-table" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th>Source</th>
                <th>Student</th>
                <th>URL</th>
                <th>Auto-check</th>
                <th>Coins</th>
                <th>Submitted</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((s) => (
                <tr key={s.id}
                  style={{ borderLeft: s.is_stale ? '3px solid var(--danger)' : '3px solid transparent' }}>
                  <td>
                    {SOURCE_LABEL[s.source_type] || s.source_type}
                    {s.power_hour_eligible && (
                      <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: 9 }}>2×</span>
                    )}
                  </td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{s.student_id?.slice(0, 8)}…</span></td>
                  <td>
                    <a href={s.url} target="_blank" rel="noreferrer"
                      style={{ color: 'var(--accent-light)', textDecoration: 'none', fontSize: 12 }}>
                      {s.url?.length > 40 ? `${s.url.slice(0, 40)}…` : s.url}
                    </a>
                  </td>
                  <td>
                    {s.auto_check_passed === true && <span className="badge badge-success">PASSED</span>}
                    {s.auto_check_passed === false && <span className="badge badge-danger">FAILED</span>}
                    {s.auto_check_passed == null && <span className="badge badge-info">MANUAL</span>}
                  </td>
                  <td>+{s.coins_if_approved}</td>
                  <td>
                    <div>{relTime(s.submitted_at)}</div>
                    {s.is_stale && (
                      <div style={{ color: 'var(--danger)', fontSize: 10, marginTop: 2 }}>STALE — SLA BREACHED</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-success" disabled={working}
                      onClick={() => { if (window.confirm('Approve this submission?')) approve(s.id) }}
                      style={{ padding: '6px 10px', fontSize: 12, marginRight: 6 }}>
                      Approve
                    </button>
                    <button className="btn btn-danger" disabled={working}
                      onClick={() => setRejectFor(s.id)}
                      style={{ padding: '6px 10px', fontSize: 12 }}>
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rejectFor && (
        <Modal onClose={() => setRejectFor(null)}>
          <h3>Reject submission</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
            Reason is mandatory and shown to the student.
          </p>
          <select className="input-field" value="" onChange={(e) => setRejectReason(e.target.value)}
            style={{ marginTop: 12 }}>
            <option value="">— Select template —</option>
            {REJECT_TEMPLATES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <textarea className="input-field" value={rejectReason} rows={3}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Or write your own reason…"
            style={{ marginTop: 8, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setRejectFor(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={reject} disabled={!rejectReason.trim() || working}>
              {working ? '…' : 'Reject'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 2. Snapshot Tool
// ─────────────────────────────────────────────────────────────
export function SnapshotTool() {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [pending, setPending] = useState(null) // { type, force, reason }

  useEffect(() => {
    adminCoins.leaderboard()
      .then(setLeaderboard).catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const SECTIONS = [
    { type: 'DAY1_MIDNIGHT', tier: 'MUG',         cutoff: 30, threshold: 1500 },
    { type: 'DAY2_T3H',      tier: 'TSHIRT',      cutoff: 50, threshold: 2500 },
    { type: 'FINAL_CLOSE',   tier: 'PREMIUM_KIT', cutoff: 10, threshold: 4000 },
  ]

  const take = async () => {
    if (!pending) return
    if (!window.confirm('This will permanently lock the leaderboard. Continue?')) return
    setWorking(true); setError('')
    try {
      await adminCoins.snapshotTake(pending.type, pending.force, pending.reason || null)
      setPending(null)
      alert('Snapshot taken.')
    } catch (e) { setError(e.message) }
    finally { setWorking(false) }
  }

  if (loading) return <Spinner />

  return (
    <div className="fade-in">
      <PageHeader title="Snapshot Tool" sub="Lock the leaderboard at a specific moment. Action cannot be undone." />
      <ErrorBanner message={error} />

      <div style={{ display: 'grid', gap: 16 }}>
        {SECTIONS.map(s => {
          const inBoth = leaderboard
            .slice(0, s.cutoff)
            .filter(r => r.coins >= s.threshold)
          const tied = leaderboard.filter(r => r.coins === leaderboard[s.cutoff - 1]?.coins)
          return (
            <div key={s.type} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3>{s.type.replace('_', ' ')} → {s.tier}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Top {s.cutoff} with ≥{s.threshold.toLocaleString()} coins.
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => setPending({ type: s.type })}>
                  Take Snapshot
                </button>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                <Stat label="ELIGIBLE" value={inBoth.length} />
                <Stat label="CUTOFF SCORE" value={leaderboard[s.cutoff - 1]?.coins ?? '—'} />
                <Stat label="TIED AT CUTOFF" value={tied.length > 1 ? tied.length : 0} />
              </div>
              {tied.length > 1 && (
                <div style={{ marginTop: 12, padding: 10, borderRadius: 'var(--radius-md)',
                  background: 'var(--warning-dim)', color: 'var(--warning)', fontSize: 12 }}>
                  ⚠ {tied.length} students tied at the cutoff — tiebreaker (distinct sources, then earliest entry) will decide.
                </div>
              )}
            </div>
          )
        })}
      </div>

      {pending && (
        <Modal onClose={() => setPending(null)}>
          <h3>Confirm snapshot</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            <strong>{pending.type.replace('_', ' ')}</strong> — this is irreversible.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13 }}>
            <input type="checkbox" checked={!!pending.force}
              onChange={(e) => setPending({ ...pending, force: e.target.checked })} />
            Force (override stale-queue SLA gate)
          </label>
          {pending.force && (
            <input className="input-field" placeholder="Reason for force…"
              value={pending.reason || ''}
              onChange={(e) => setPending({ ...pending, reason: e.target.value })}
              style={{ marginTop: 10 }} />
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setPending(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={take} disabled={working}>
              {working ? '…' : 'Lock Snapshot'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 3. Surprise Drop
// ─────────────────────────────────────────────────────────────
export function SurpriseDrop() {
  const [form, setForm] = useState({
    criteria: '', reward_tier: 'STICKER', max_winners: 5,
    window_minutes: 15, coin_reward: '',
  })
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const trigger = async () => {
    if (!form.criteria.trim()) return setError('Criteria required')
    setWorking(true); setError(''); setResult(null)
    try {
      const body = { ...form }
      body.coin_reward = body.coin_reward ? Number(body.coin_reward) : null
      body.max_winners = Number(body.max_winners)
      body.window_minutes = Number(body.window_minutes)
      const r = await adminCoins.triggerDrop(body)
      setResult(r)
    } catch (e) { setError(e.message) }
    finally { setWorking(false) }
  }

  const cancel = async () => {
    if (!result?.id) return
    setWorking(true); setError('')
    try { await adminCoins.cancelDrop(result.id); setResult(null) }
    catch (e) { setError(e.message) }
    finally { setWorking(false) }
  }

  return (
    <div className="fade-in">
      <PageHeader title="Surprise Drop"
        sub="Broadcast a flash reward to all attending students." />
      <ErrorBanner message={error} />

      <div className="card" style={{ padding: 22, maxWidth: 640 }}>
        <FormField label="Criteria">
          <textarea className="input-field" rows={3}
            placeholder="e.g. First 5 students to scan booth Y win a Mug"
            value={form.criteria}
            onChange={(e) => setForm({ ...form, criteria: e.target.value })} />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <FormField label="Reward Tier">
            <select className="input-field" value={form.reward_tier}
              onChange={(e) => setForm({ ...form, reward_tier: e.target.value })}>
              <option value="STICKER">Sticker</option>
              <option value="MUG">Mug</option>
              <option value="TSHIRT">T-shirt</option>
              <option value="PREMIUM_KIT">Premium Kit</option>
              <option value="COINS">Coins</option>
            </select>
          </FormField>
          <FormField label="Max Winners">
            <input type="number" min={1} className="input-field" value={form.max_winners}
              onChange={(e) => setForm({ ...form, max_winners: e.target.value })} />
          </FormField>
          <FormField label="Window (minutes)">
            <input type="number" min={1} className="input-field" value={form.window_minutes}
              onChange={(e) => setForm({ ...form, window_minutes: e.target.value })} />
          </FormField>
          <FormField label="Coin Reward (optional)">
            <input type="number" className="input-field" value={form.coin_reward}
              onChange={(e) => setForm({ ...form, coin_reward: e.target.value })}
              placeholder="If awarding coins instead of merch" />
          </FormField>
        </div>

        <button className="btn btn-primary" onClick={trigger} disabled={working}
          style={{ marginTop: 16 }}>
          {working ? '…' : 'Trigger Drop'}
        </button>
      </div>

      {result && (
        <div className="card" style={{ padding: 18, marginTop: 16, maxWidth: 640 }}>
          <h3 style={{ marginBottom: 6 }}>Drop active</h3>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {result.criteria} · {result.max_winners} winners · ends {fmtTime(result.window_end)}
          </div>
          <button className="btn btn-danger" onClick={cancel} disabled={working}
            style={{ marginTop: 12 }}>
            Cancel Drop
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 4. Booth Monitor
// ─────────────────────────────────────────────────────────────
export function BoothMonitor() {
  const [data, setData] = useState({ feed: [], anomaly_volunteer_ids: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ minutes: 60, volunteer_id: '', booth_id: '' })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = { minutes: filters.minutes }
      if (filters.volunteer_id) params.volunteer_id = filters.volunteer_id
      if (filters.booth_id) params.booth_id = filters.booth_id
      const d = await adminCoins.boothActivity(params)
      setData(d || { feed: [], anomaly_volunteer_ids: [] })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [filters])
  useEffect(() => { load() }, [load])
  useEffect(() => { const id = setInterval(load, 30000); return () => clearInterval(id) }, [load])

  return (
    <div className="fade-in">
      <PageHeader title="Booth Activity Monitor"
        sub="Live feed of booth awards. Anomaly: > 10 awards from one volunteer in 5 min." />
      <ErrorBanner message={error} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="input-field" placeholder="Booth ID" value={filters.booth_id}
          onChange={(e) => setFilters({ ...filters, booth_id: e.target.value })} style={{ width: 160 }} />
        <input className="input-field" placeholder="Volunteer UID" value={filters.volunteer_id}
          onChange={(e) => setFilters({ ...filters, volunteer_id: e.target.value })} style={{ width: 160 }} />
        <select className="input-field" value={filters.minutes}
          onChange={(e) => setFilters({ ...filters, minutes: Number(e.target.value) })} style={{ width: 140 }}>
          <option value={15}>Last 15 min</option>
          <option value={60}>Last 1 hour</option>
          <option value={240}>Last 4 hours</option>
          <option value={1440}>Last 24 hours</option>
        </select>
      </div>

      {data.anomaly_volunteer_ids?.length > 0 && (
        <div className="card" style={{
          padding: 14, marginBottom: 14, borderColor: 'rgba(245,158,11,0.4)',
          background: 'var(--warning-dim)',
        }}>
          <strong style={{ color: 'var(--warning)' }}>⚠ Anomaly</strong>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 4 }}>
            Volunteers with abnormal award rate: {data.anomaly_volunteer_ids.join(', ')}
          </div>
        </div>
      )}

      <div className="card no-scrollbar" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? <Spinner /> : (data.feed || []).length === 0 ? (
          <div className="empty-state"><p>No activity in this window.</p></div>
        ) : (
          <table className="data-table" style={{ minWidth: 700 }}>
            <thead>
              <tr><th>Time</th><th>Booth</th><th>Volunteer</th><th>Student</th><th>Source</th><th>Coins</th></tr>
            </thead>
            <tbody>
              {data.feed.map((r) => (
                <tr key={r.id}>
                  <td>{relTime(r.created_at)}</td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{(r.metadata || {}).booth_id || '—'}</span></td>
                  <td>{r.verified_by || '—'}</td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.student_id?.slice(0, 8)}…</span></td>
                  <td>{SOURCE_LABEL[r.source_type] || r.source_type}</td>
                  <td>+{r.coins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 5. Engagement Workbench (two-person sign-off)
// ─────────────────────────────────────────────────────────────
export function Engagement() {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(null) // { student_id, likes, comments, reposts, second_admin_id }
  const [working, setWorking] = useState(false)

  useEffect(() => {
    adminCoins.leaderboard().then(d => setLeaderboard((d || []).slice(0, 50)))
      .catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  const calcCoins = (d) => (d.likes || 0) * 2 + (d.comments || 0) * 5 + (d.reposts || 0) * 5
  const submit = async () => {
    if (!draft) return
    if (!draft.second_admin_id) return setError('Second admin UID required')
    setWorking(true); setError('')
    try {
      await adminCoins.engagementSubmit({
        student_id: draft.student_id,
        likes: Number(draft.likes || 0),
        comments: Number(draft.comments || 0),
        reposts: Number(draft.reposts || 0),
        second_admin_id: Number(draft.second_admin_id),
      })
      setDraft(null)
      alert('Engagement credited.')
    } catch (e) { setError(e.message) }
    finally { setWorking(false) }
  }

  if (loading) return <Spinner />

  return (
    <div className="fade-in">
      <PageHeader title="Engagement Workbench"
        sub="Top 50 only. Two-person sign-off required. Hard cap of 1,000 coins per student." />
      <ErrorBanner message={error} />

      <div className="card no-scrollbar" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 700 }}>
          <thead>
            <tr><th>Rank</th><th>Student</th><th>Coins</th><th style={{ textAlign: 'right' }}></th></tr>
          </thead>
          <tbody>
            {leaderboard.map((row, idx) => (
              <tr key={row.student_id}>
                <td>{idx + 1}</td>
                <td><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{row.student_id?.slice(0, 14)}…</span></td>
                <td>{row.coins?.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-primary" onClick={() => setDraft({
                    student_id: row.student_id, likes: 0, comments: 0, reposts: 0, second_admin_id: '',
                  })} style={{ padding: '6px 10px', fontSize: 12 }}>Add Engagement</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <Modal onClose={() => setDraft(null)}>
          <h3>Engagement counts</h3>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Student: <span style={{ fontFamily: 'monospace' }}>{draft.student_id.slice(0, 14)}…</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}>
            <FormField label="Likes (×2)">
              <input type="number" min={0} className="input-field" value={draft.likes}
                onChange={(e) => setDraft({ ...draft, likes: e.target.value })} />
            </FormField>
            <FormField label="Comments (×5)">
              <input type="number" min={0} className="input-field" value={draft.comments}
                onChange={(e) => setDraft({ ...draft, comments: e.target.value })} />
            </FormField>
            <FormField label="Reposts (×5)">
              <input type="number" min={0} className="input-field" value={draft.reposts}
                onChange={(e) => setDraft({ ...draft, reposts: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Second Admin UID">
            <input type="number" className="input-field" value={draft.second_admin_id}
              onChange={(e) => setDraft({ ...draft, second_admin_id: e.target.value })}
              placeholder="UID of the co-signing admin" />
          </FormField>
          <div style={{ marginTop: 12, padding: 10, borderRadius: 'var(--radius-md)',
            background: calcCoins(draft) > 1000 ? 'var(--danger-dim)' : 'var(--accent-dim)',
            color: calcCoins(draft) > 1000 ? 'var(--danger)' : 'var(--accent-light)', fontSize: 13 }}>
            Calculated: {calcCoins(draft)} coins
            {calcCoins(draft) > 1000 && ' — will be capped at 1,000'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={working || !draft.second_admin_id}>
              {working ? '…' : 'Submit & Credit'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 6. Disputes
// ─────────────────────────────────────────────────────────────
export function Disputes() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [resolveFor, setResolveFor] = useState(null)
  const [resolveDraft, setResolveDraft] = useState({ note: '', action: 'approve_reversal' })
  const [working, setWorking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const t = await adminCoins.disputes(statusFilter)
      setTickets(t || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [statusFilter])
  useEffect(() => { load() }, [load])

  const resolve = async () => {
    if (!resolveFor || !resolveDraft.note.trim()) return
    setWorking(true); setError('')
    try {
      await adminCoins.resolveDispute(resolveFor, resolveDraft.note, resolveDraft.action)
      setResolveFor(null); setResolveDraft({ note: '', action: 'approve_reversal' })
      await load()
    } catch (e) { setError(e.message) }
    finally { setWorking(false) }
  }

  return (
    <div className="fade-in">
      <PageHeader title="Disputes" sub="Student-raised tickets against ledger entries." />
      <ErrorBanner message={error} />

      <div style={{ marginBottom: 14 }}>
        <select className="input-field" value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 180 }}>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="card no-scrollbar" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? <Spinner /> : tickets.length === 0 ? (
          <div className="empty-state"><p>No tickets in this state.</p></div>
        ) : (
          <table className="data-table" style={{ minWidth: 700 }}>
            <thead>
              <tr><th>Created</th><th>Student</th><th>Description</th><th>Ledger Entry</th><th></th></tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>{relTime(t.created_at)}</td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{t.student_id?.slice(0, 8)}…</span></td>
                  <td style={{ maxWidth: 320 }}>{t.description}</td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{t.ledger_entry_id?.slice(0, 8)}…</span></td>
                  <td style={{ textAlign: 'right' }}>
                    {t.status === 'open' && (
                      <button className="btn btn-primary" onClick={() => setResolveFor(t.id)}
                        style={{ padding: '6px 10px', fontSize: 12 }}>Resolve</button>
                    )}
                    {t.status !== 'open' && (
                      <span className={`badge badge-${t.status === 'resolved' ? 'success' : 'danger'}`}>
                        {t.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {resolveFor && (
        <Modal onClose={() => setResolveFor(null)}>
          <h3>Resolve dispute</h3>
          <FormField label="Action">
            <select className="input-field" value={resolveDraft.action}
              onChange={(e) => setResolveDraft({ ...resolveDraft, action: e.target.value })}>
              <option value="approve_reversal">Approve reversal (refund coins)</option>
              <option value="reject_dispute">Reject dispute (no change)</option>
            </select>
          </FormField>
          <FormField label="Resolution note">
            <textarea className="input-field" rows={3} value={resolveDraft.note}
              onChange={(e) => setResolveDraft({ ...resolveDraft, note: e.target.value })}
              placeholder="Why this resolution?" />
          </FormField>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setResolveFor(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={resolve} disabled={working || !resolveDraft.note.trim()}>
              {working ? '…' : 'Resolve'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 7. Inventory
// ─────────────────────────────────────────────────────────────
export function Inventory() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    adminCoins.inventory().then(setData)
      .catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="fade-in">
      <PageHeader title="Rewards" sub="Live stock levels per reward tier." />
      <ErrorBanner message={error} />

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {data.map(t => (
          <div key={t.tier} className="card" style={{ padding: 18 }}>
            <h3>{t.tier}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <Stat label="TOTAL" value={t.total_stock} />
              <Stat label="ALLOCATED" value={t.allocated} />
              <Stat label="RESERVE" value={t.surprise_drop_reserve} />
              <Stat label="REMAINING" value={t.remaining} highlight={t.remaining < 5} />
            </div>
            <div style={{
              marginTop: 12, height: 6, borderRadius: 999,
              background: 'rgba(255,255,255,0.04)', overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.min(100, Math.round((t.allocated / t.total_stock) * 100))}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--success), var(--accent))',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 8. Audit Log
// ─────────────────────────────────────────────────────────────
export function AuditLog() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ action: '', actor_id: '', minutes: 1440 })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = { minutes: filters.minutes }
      if (filters.action) params.action = filters.action
      if (filters.actor_id) params.actor_id = filters.actor_id
      const r = await adminCoins.auditLog(params)
      setRows(r || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [filters])
  useEffect(() => { load() }, [load])

  return (
    <div className="fade-in">
      <PageHeader title="Audit Log" sub="Immutable record of every admin action." />
      <ErrorBanner message={error} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="input-field" placeholder="Action (e.g. APPROVE_UGC)"
          value={filters.action}
          onChange={(e) => setFilters({ ...filters, action: e.target.value.toUpperCase() })}
          style={{ width: 220 }} />
        <input className="input-field" placeholder="Actor ID"
          value={filters.actor_id}
          onChange={(e) => setFilters({ ...filters, actor_id: e.target.value })}
          style={{ width: 200 }} />
        <select className="input-field" value={filters.minutes}
          onChange={(e) => setFilters({ ...filters, minutes: Number(e.target.value) })}
          style={{ width: 160 }}>
          <option value={60}>Last 1 hour</option>
          <option value={1440}>Last 24 hours</option>
          <option value={10080}>Last week</option>
          <option value={43200}>Last month</option>
        </select>
      </div>

      <div className="card no-scrollbar" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? <Spinner /> : rows.length === 0 ? (
          <div className="empty-state"><p>No log entries match these filters.</p></div>
        ) : (
          <table className="data-table" style={{ minWidth: 800 }}>
            <thead>
              <tr><th>Time</th><th>Actor</th><th>Role</th><th>Action</th><th>Entity</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{relTime(r.timestamp)}<br /><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtTime(r.timestamp)}</span></td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.actor_id?.toString().slice(0, 12)}</span></td>
                  <td><span className="badge">{r.actor_role}</span></td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.action}</span></td>
                  <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.entity_type}{r.entity_id ? `:${r.entity_id.slice(0, 6)}…` : ''}</span></td>
                  <td style={{ maxWidth: 260, fontSize: 12, color: 'var(--text-muted)' }}>{r.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Shared mini-components
// ─────────────────────────────────────────────────────────────
function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      backdropFilter: 'blur(4px)',
    }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{
        padding: 22, maxWidth: 480, width: '100%',
      }}>
        {children}
      </div>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <div style={{ marginTop: 10 }}>
      <label style={{
        display: 'block', fontSize: 11, color: 'var(--text-muted)',
        marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>{label}</label>
      {children}
    </div>
  )
}

function Stat({ label, value, highlight }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 700, marginTop: 4,
        color: highlight ? 'var(--warning)' : 'var(--text-primary)',
      }}>{value}</div>
    </div>
  )
}
