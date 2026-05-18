import React, { useEffect, useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import './Meals.css'

function MealsSkeleton() {
  return (
    <div className="meals-page fade-in">
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div className="sk-line sk-h-6 sk-w-1-4" />
        <div className="sk-line sk-h-8" style={{ width: 90, borderRadius: 8 }} />
      </div>
      {/* Stats skeleton */}
      <div className="sk-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginBottom: 24 }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="sk-card" style={{ padding: 16 }}>
            <div className="sk-line sk-h-4 sk-w-3-4" style={{ marginBottom: 8 }} />
            <div className="sk-line sk-h-8 sk-w-1-2" />
          </div>
        ))}
      </div>
      <div className="sk-card" style={{ marginBottom: 24 }}>
        <div className="sk-line sk-h-5 sk-w-3-4" style={{ marginBottom: 8 }} />
        <div className="sk-line sk-h-4 sk-w-full" />
        <div className="sk-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', marginTop: 12 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="sk-card" style={{ padding: 14 }}>
              <div className="sk-line sk-h-5 sk-w-3-4" />
              <div className="sk-line sk-h-8 sk-w-1-2" style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      </div>
      <div className="sk-card" style={{ gap: 0, padding: 0, overflow: 'hidden' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="sk-row" style={{
            padding: '12px 20px', borderBottom: '1px solid var(--border)', gap: 16
          }}>
            <div className="sk-line sk-h-5" style={{ flex: 2 }} />
            <div className="sk-line sk-h-5 sk-w-1-4" />
            <div className="sk-line sk-h-5 sk-w-1-4" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Meals() {
  const {
    eventsMealsCount,
    foodStats,
    loading,
    mealsLoading,
    updateEventMealsCount,
    loadMeals,
  } = useData()

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    loadMeals()
  }, [loadMeals])

  if (loading || mealsLoading) return <MealsSkeleton />

  const totalEventsAllowance = useMemo(
    () => eventsMealsCount.reduce((sum, e) => sum + (e.meals_count || 0), 0),
    [eventsMealsCount],
  )

  async function handleEventCountSave(eventId, nextRaw) {
    const next = Number(nextRaw)
    if (!Number.isInteger(next) || next < 0 || next > 20) {
      setErr('Event meals count must be a whole number between 0 and 20.')
      return
    }
    setBusy(true); setErr('')
    try {
      await updateEventMealsCount(eventId, next)
    } catch (e) {
      setErr(e?.message || 'Failed to update event meals count.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="meals-page fade-in">
      <div className="section-header">
        <span className="section-title">Meals Management</span>
        <button
          id="meals-refresh"
          className="btn btn-ghost"
          onClick={() => loadMeals({ force: true })}
          disabled={busy}
        >
          Refresh
        </button>
      </div>

      {/* ── Food Stats Summary Cards ── */}
      {foodStats && (
        <div className="meals-stats-grid">
          <div className="meals-stat-card">
            <span className="meals-stat-icon">🍽️</span>
            <div className="meals-stat-body">
              <div className="meals-stat-value">{foodStats.total_claims}</div>
              <div className="meals-stat-label">Total Claims</div>
            </div>
          </div>
          <div className="meals-stat-card">
            <span className="meals-stat-icon">👥</span>
            <div className="meals-stat-body">
              <div className="meals-stat-value">{foodStats.total_people_claimed}</div>
              <div className="meals-stat-label">People Claimed</div>
            </div>
          </div>
          <div className="meals-stat-card">
            <span className="meals-stat-icon">🎟️</span>
            <div className="meals-stat-body">
              <div className="meals-stat-value">{totalEventsAllowance}</div>
              <div className="meals-stat-label">Total Slots (allowance)</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Per-event food breakdown table ── */}
      {foodStats && foodStats.per_event && foodStats.per_event.length > 0 && (
        <div className="meals-breakdown-section">
          <h3 className="meals-section-heading">Food Claims by Event</h3>
          <div className="meals-breakdown-table-wrap">
            <table className="meals-breakdown-table">
              <thead>
                <tr>
                  <th className="meals-bd-name-col">Event</th>
                  <th className="meals-bd-num-col">Limit / Person</th>
                  <th className="meals-bd-num-col">Total Claims</th>
                  <th className="meals-bd-num-col">People Claimed</th>
                  <th className="meals-bd-bar-col">Fill Rate</th>
                </tr>
              </thead>
              <tbody>
                {foodStats.per_event.map(ev => {
                  // Max possible = limit × (number registered for that event)
                  // We don't have registered count here, so just show claims vs 0-baseline
                  const fillPct = ev.meals_limit > 0 && ev.people_claimed > 0
                    ? Math.min(100, Math.round((ev.total_claims / (ev.meals_limit * Math.max(ev.people_claimed, 1))) * 100))
                    : 0
                  return (
                    <tr key={ev.event_id}>
                      <td className="meals-bd-name-cell">{ev.event_name}</td>
                      <td className="meals-bd-num-cell">
                        <span className="meals-bd-badge">{ev.meals_limit}</span>
                      </td>
                      <td className="meals-bd-num-cell">
                        <span className={`meals-bd-badge ${ev.total_claims > 0 ? 'active' : ''}`}>
                          {ev.total_claims}
                        </span>
                      </td>
                      <td className="meals-bd-num-cell">
                        <span className={`meals-bd-badge ${ev.people_claimed > 0 ? 'active' : ''}`}>
                          {ev.people_claimed}
                        </span>
                      </td>
                      <td className="meals-bd-bar-cell">
                        <div className="meals-bd-bar-track">
                          <div
                            className="meals-bd-bar-fill"
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                        <span className="meals-bd-bar-pct">{fillPct}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Per-event meals_count allowance config ── */}
      <div className="meals-config-card">
        <div className="meals-config-info">
          <h3 className="meals-config-title">Per-event meal allowance</h3>
          <p className="meals-config-sub">
            Each event contributes this many meal slots to a registered user's
            total allowance. A user's overall allowance is the sum across every
            event they're registered for. Current total across all events:{' '}
            <strong>{totalEventsAllowance}</strong>.
          </p>
        </div>
      </div>

      <div className="meals-events-list">
        {eventsMealsCount.length === 0 ? (
          <div className="meals-empty" style={{ padding: 12 }}>
            No events yet.
          </div>
        ) : eventsMealsCount.map(ev => (
          <EventMealRow
            key={ev.id}
            event={ev}
            busy={busy}
            onSave={(val) => handleEventCountSave(ev.id, val)}
          />
        ))}
      </div>

      {err && <div className="meals-error">{err}</div>}
    </div>
  )
}

function EventMealRow({ event, busy, onSave }) {
  const [draft, setDraft] = useState(event.meals_count)

  // Keep the draft in sync when the parent data updates externally.
  React.useEffect(() => { setDraft(event.meals_count) }, [event.meals_count])

  const changed = Number(draft) !== event.meals_count

  return (
    <div className="meals-event-row">
      <div className="meals-event-name">
        <span>{event.name}</span>
        <span className="meals-event-sub">{event.meals_count} meal slot{event.meals_count === 1 ? '' : 's'}</span>
      </div>
      <div className="meals-event-edit">
        <input
          className="input-field meals-count-input"
          type="number"
          min="0"
          max="20"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          disabled={busy}
        />
        <button
          className="btn btn-primary"
          onClick={() => onSave(draft)}
          disabled={busy || !changed}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
