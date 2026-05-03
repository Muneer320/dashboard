import React from 'react'
import { useData } from '../../context/DataContext'
import './Overview.css'

function StatCard({ icon, label, value, sub, colorClass }) {
  return (
    <div className={`stat-card ${colorClass}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="overview-page fade-in">
      <div className="section-header">
        <div className="sk-line sk-h-6 sk-w-1-4" />
        <div className="sk-line sk-h-5 sk-w-1-4" />
      </div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="sk-card" style={{ minHeight: 100 }}>
            <div className="sk-row">
              <div className="sk-block sk-h-10" style={{ width: 40, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="sk-line sk-h-8 sk-w-3-4" />
                <div className="sk-line sk-h-4 sk-w-1-2" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        <div className="sk-line sk-h-6 sk-w-1-4" style={{ marginBottom: 16 }} />
        <div className="sk-block sk-h-24 sk-w-full" />
      </div>
    </div>
  )
}

export default function Overview() {
  const { stats, events, loading } = useData()

  if (loading) return <OverviewSkeleton />

  return (
    <div className="overview-page fade-in">
      <div className="section-header">
        <span className="section-title">At a Glance</span>
        <span className="badge badge-accent">Ascent Techfest 2026</span>
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        <StatCard
          colorClass="stat-violet"
          label="Total Registered"
          value={stats.totalRegistered}
          sub={`across ${events.length} events`}
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />
        <StatCard
          colorClass="stat-green"
          label="Attended"
          value={stats.attending}
          sub={`${Math.round((stats.attending / stats.totalRegistered) * 100)}% attendance rate`}
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
        />
        <StatCard
          colorClass="stat-blue"
          label="Submissions"
          value={`${stats.submitted} / ${stats.totalTeams}`}
          sub={`teams submitted out of ${stats.totalTeams} registered`}
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
        />
        <StatCard
          colorClass="stat-amber"
          label="Food Claimed"
          value={stats.foodClaimed}
          sub="meal vouchers used"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>}
        />
        <StatCard
          colorClass="stat-red"
          label="Restricted"
          value={stats.restricted}
          sub="access revoked"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>}
        />
        <StatCard
          colorClass="stat-cyan"
          label="Entry Scanned"
          value={stats.entryScanned}
          sub="checked in via QR"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 7 23 1 17 1"/><line x1="16" y1="8" x2="23" y2="1"/><polyline points="1 7 1 1 7 1"/><line x1="8" y1="8" x2="1" y2="1"/><polyline points="23 17 23 23 17 23"/><line x1="16" y1="16" x2="23" y2="23"/><polyline points="1 17 1 23 7 23"/><line x1="8" y1="16" x2="1" y2="23"/></svg>}
        />
      </div>

      {/* Per-event breakdown */}
      <div className="section-header" style={{ marginTop: 32 }}>
        <span className="section-title">Event Breakdown</span>
      </div>
      <div className="card no-scrollbar" style={{ padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="data-table" style={{ minWidth: 600 }}>
          <thead>
            <tr>
              <th>Event</th>
              <th>Category</th>
              <th>Date</th>
              <th>Registered</th>
              <th>Teams</th>
              <th>Attended</th>
              <th>Submitted</th>
              <th>Restricted</th>
            </tr>
          </thead>
          <tbody>
            {events.map(ev => (
              <tr key={ev.id}>
                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ev.name}</td>
                <td><span className="badge badge-accent">{ev.category}</span></td>
                <td>{ev.date ? new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                <td>{ev.registered}</td>
                <td style={{ color: ev.teams > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {ev.teams > 0 ? ev.teams : '—'}
                </td>
                <td>
                  <span style={{ color: ev.attended > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                    {ev.attended}
                  </span>
                </td>
                <td>
                  {ev.teams > 0 ? (
                    <span style={{ color: ev.submitted > 0 ? 'var(--info)' : 'var(--text-muted)' }}>
                      {ev.submitted}/{ev.teams}
                    </span>
                  ) : (
                    <span style={{ color: ev.submitted > 0 ? 'var(--info)' : 'var(--text-muted)' }}>
                      {ev.submitted}
                    </span>
                  )}
                </td>
                <td>
                  <span style={{ color: ev.restricted > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {ev.restricted}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
