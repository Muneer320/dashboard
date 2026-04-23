import React, { useState, useEffect, useCallback } from 'react'
import { adminPanel as adminApi } from '../../../lib/api'
import Pagination from '../Pagination'
import './RequestedMembers.css'

// Status filter options shown in the top pill bar. `all` is a client-side no-op
// that drops the query param so we fetch everything.
const STATUS_FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

const STATUS_BADGE_CLASS = {
  pending:  'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-danger',
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function RequestedMembers() {
  const [rows, setRows]                 = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [toast, setToast]               = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [search, setSearch]             = useState('')
  const [acting, setActing]             = useState(null) // id currently being updated
  const [expanded, setExpanded]         = useState(null) // id with description expanded

  // Pagination — admin inbox can grow quickly, so cap per page.
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 15

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminApi.requestedMembers(
        statusFilter === 'all' ? null : statusFilter
      )
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message || 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  // Switching filter or searching resets pagination so the user isn't stranded
  // on a page that no longer exists.
  useEffect(() => { setCurrentPage(1) }, [statusFilter, search])

  async function updateStatus(id, newStatus) {
    setActing(id)
    setError('')
    setToast('')
    try {
      await adminApi.setRequestedMemberStatus(id, newStatus)
      setToast(`Request ${newStatus}.`)
      // If the current filter would hide this row, remove it from the list;
      // otherwise update in place so the row re-renders with the new pill.
      setRows(prev => {
        if (statusFilter !== 'all' && newStatus !== statusFilter) {
          return prev.filter(r => r.id !== id)
        }
        return prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
      })
      // Auto-dismiss the toast so it doesn't linger.
      setTimeout(() => setToast(''), 2500)
    } catch (e) {
      setError(e.message || 'Failed to update status')
    } finally {
      setActing(null)
    }
  }

  function handleDownloadCSV() {
    const csvRows = [
      ['Name', 'Email', 'Password', 'Status']
    ];

    filtered.forEach(row => {
      const match = (row.description || '').match(/\[System\] Generated Password: (.*)/);
      const password = match ? match[1] : '';
      csvRows.push([
        `"${(row.name || '').replace(/"/g, '""')}"`,
        `"${(row.email || '').replace(/"/g, '""')}"`,
        `"${password.replace(/"/g, '""')}"`,
        `"${(row.status || '').replace(/"/g, '""')}"`
      ]);
    });

    const csvString = csvRows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "approved_members.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? rows.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.college || '').toLowerCase().includes(q) ||
        (r.ticket_id || '').toLowerCase().includes(q) ||
        (r.phone || '').includes(q)
      )
    : rows

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Counts for the filter pills — always based on the currently-loaded set.
  // When `statusFilter === 'all'` the server gave us every row, so the pill
  // counts are accurate. Otherwise the scoped filter returned only that bucket,
  // so we show `rows.length` for the active pill and leave the others blank.
  const countsAccurate = statusFilter === 'all'

  return (
    <div className="requested-members-page fade-in">
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 20 }}>
        <span className="section-title">Requested Members</span>
        <span className="badge badge-accent">Admin Only</span>
      </div>

      <p className="rm-subtitle">
        Credential requests submitted through the <code>/credentials</code> page.
        Review each request and mark it as approved or rejected.
      </p>

      {/* Filters + search */}
      <div className="rm-toolbar">
        <div className="rm-filter-pills">
          {STATUS_FILTERS.map(f => {
            const active = statusFilter === f.key
            const count = !countsAccurate
              ? (active ? rows.length : null)
              : f.key === 'all' ? rows.length : rows.filter(r => r.status === f.key).length
            return (
              <button
                key={f.key}
                className={`rm-filter-pill${active ? ' active' : ''}`}
                onClick={() => setStatusFilter(f.key)}
              >
                {f.label}
                {count !== null && count !== undefined && (
                  <span className="rm-filter-count">{count}</span>
                )}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {statusFilter === 'approved' && (
            <button className="rm-btn rm-btn-approve" onClick={handleDownloadCSV} style={{ margin: 0 }}>
              Download CSV
            </button>
          )}
          <div className="search-wrap">
            <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="input-field"
              style={{ paddingLeft: 34, width: 240, fontSize: '0.85rem' }}
              type="text"
              placeholder="Search name, email, ticket…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <div className="rm-alert rm-alert-error">{error}</div>}
      {toast && <div className="rm-alert rm-alert-success">{toast}</div>}

      {/* Table */}
      {loading ? (
        <div className="rm-empty">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rm-empty">
          {statusFilter === 'pending'
            ? 'Nothing in the queue right now. Credential requests will appear here.'
            : 'No requests match this view.'}
        </div>
      ) : (
        <>
          <div className="rm-table-wrapper">
            <table className="rm-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>College</th>
                  <th>Interests</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(row => {
                  const isPending  = row.status === 'pending'
                  const isApproved = row.status === 'approved'
                  const isRejected = row.status === 'rejected'
                  const busy       = acting === row.id
                  const isOpen     = expanded === row.id

                  return (
                    <React.Fragment key={row.id}>
                      <tr className={isOpen ? 'rm-row expanded' : 'rm-row'}>
                        <td className="rm-ticket">{row.ticket_id || '—'}</td>
                        <td>
                          <div className="rm-name">{row.name || '—'}</div>
                          {row.description && (
                            <button
                              type="button"
                              className="rm-note-toggle"
                              onClick={() => setExpanded(isOpen ? null : row.id)}
                            >
                              {isOpen ? 'Hide note' : 'View note'}
                            </button>
                          )}
                        </td>
                        <td>
                          <div className="rm-email">
                            <a href={`mailto:${row.email}`}>{row.email || '—'}</a>
                          </div>
                          <div className="rm-phone">
                            {row.phone ? <a href={`tel:${row.phone}`}>{row.phone}</a> : '—'}
                          </div>
                        </td>
                        <td>{row.college || '—'}</td>
                        <td>
                          <div className="rm-chips">
                            {(row.areas_of_interest || []).length === 0 ? (
                              <span className="rm-muted">—</span>
                            ) : (
                              (row.areas_of_interest || []).slice(0, 3).map(tag => (
                                <span key={tag} className="rm-chip">{tag}</span>
                              ))
                            )}
                            {(row.areas_of_interest || []).length > 3 && (
                              <span className="rm-chip rm-chip-more">
                                +{row.areas_of_interest.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="rm-muted">{formatDate(row.created_at)}</td>
                        <td>
                          <span className={`badge ${STATUS_BADGE_CLASS[row.status] || ''}`}>
                            {row.status || 'pending'}
                          </span>
                        </td>
                        <td>
                          <div className="rm-actions">
                            {isPending && (
                              <>
                                <button
                                  className="rm-btn rm-btn-approve"
                                  disabled={busy}
                                  onClick={() => updateStatus(row.id, 'approved')}
                                >
                                  {busy ? '…' : 'Approve'}
                                </button>
                                <button
                                  className="rm-btn rm-btn-reject"
                                  disabled={busy}
                                  onClick={() => updateStatus(row.id, 'rejected')}
                                >
                                  {busy ? '…' : 'Reject'}
                                </button>
                              </>
                            )}
                            {isApproved && (
                              <button
                                className="rm-btn rm-btn-ghost"
                                disabled={busy}
                                onClick={() => updateStatus(row.id, 'pending')}
                              >
                                Revert to pending
                              </button>
                            )}
                            {isRejected && (
                              <button
                                className="rm-btn rm-btn-ghost"
                                disabled={busy}
                                onClick={() => updateStatus(row.id, 'pending')}
                              >
                                Reopen
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isOpen && row.description && (
                        <tr className="rm-note-row">
                          <td colSpan={8}>
                            <div className="rm-note">
                              <span className="rm-note-label">Note from applicant:</span>
                              <p>{row.description}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
        </>
      )}
    </div>
  )
}
