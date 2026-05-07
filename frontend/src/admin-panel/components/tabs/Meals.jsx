import React, { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import './Meals.css'

function MealsSkeleton() {
  return (
    <div className="meals-page fade-in">
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div className="sk-line sk-h-6 sk-w-1-4" />
        <div className="sk-line sk-h-8" style={{ width: 90, borderRadius: 8 }} />
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
    maxMealsCount,
    userMeals,
    loading,
    updateEventMealsCount,
    addMealEntry,
    removeMealEntry,
    loadMeals,
  } = useData()

  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (loading) return <MealsSkeleton />

  const totalEventsAllowance = useMemo(
    () => eventsMealsCount.reduce((sum, e) => sum + (e.meals_count || 0), 0),
    [eventsMealsCount],
  )

  // Columns for the per-user matrix. Size to the largest user allowance we've
  // actually seen (fall back to the cap returned by the server so the header
  // still renders something useful when no one has registered yet).
  const tableMealCount = useMemo(() => {
    const maxFromUsers = userMeals.reduce(
      (m, u) => Math.max(m, u.allowance || 0),
      0,
    )
    return Math.max(maxFromUsers, maxMealsCount || 0)
  }, [userMeals, maxMealsCount])

  const mealIds = useMemo(
    () => Array.from({ length: tableMealCount }, (_, i) => `meal${i + 1}`),
    [tableMealCount],
  )

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return userMeals
    return userMeals.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    )
  }, [userMeals, search])

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

  async function handleToggle(userId, mealId, currentlyClaimed, allowance, index) {
    // Only allow ticking slots inside the user's allowance.
    if (!currentlyClaimed && index > allowance) {
      setErr(`Slot out of this user's allowance (${allowance}).`)
      return
    }
    try {
      setErr('')
      if (currentlyClaimed) await removeMealEntry(userId, mealId)
      else                  await addMealEntry(userId, mealId)
    } catch (e) {
      setErr(e?.message || 'Failed to update meal entry.')
    }
  }

  // Claim totals per meal column (header stats)
  const totals = useMemo(() => {
    const counts = Object.fromEntries(mealIds.map(m => [m, 0]))
    for (const u of userMeals) {
      for (const c of u.claims) {
        if (c.claimed && counts[c.meal_id] !== undefined) counts[c.meal_id] += 1
      }
    }
    return counts
  }, [userMeals, mealIds])

  return (
    <div className="meals-page fade-in">
      <div className="section-header">
        <span className="section-title">Meals Management</span>
        <button
          id="meals-refresh"
          className="btn btn-ghost"
          onClick={loadMeals}
          disabled={busy}
        >
          Refresh
        </button>
      </div>

      {/* Per-event meals_count list */}
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

      {/* Per-user matrix */}
      <div className="section-header" style={{ marginTop: 24 }}>
        <span className="section-title">Per-user claim matrix</span>
        <div className="search-wrap">
          <input
            id="meals-user-search"
            className="input-field"
            style={{ width: 220, fontSize: '0.85rem' }}
            type="text"
            placeholder="Search name or username…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="meals-table-wrap">
        <table className="meals-table">
          <thead>
            <tr>
              <th className="meals-user-col">Participant</th>
              <th className="meals-allowance-col">Claimed / Allowed</th>
              {mealIds.map(mid => (
                <th key={mid} className="meals-meal-col">
                  <div className="meals-col-label">{mid}</div>
                  <div className="meals-col-count">{totals[mid] ?? 0} claimed</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={mealIds.length + 2} className="meals-empty">
                  No participants match "{search}".
                </td>
              </tr>
            ) : filteredUsers.map(u => {
              const claimMap = Object.fromEntries(u.claims.map(c => [c.meal_id, c.claimed]))
              return (
                <tr key={u.user_id}>
                  <td className="meals-user-cell">
                    <div className="meals-user-name">{u.name}</div>
                    <div className="meals-user-handle">@{u.username}</div>
                  </td>
                  <td className="meals-allowance-cell">
                    <span className={`meals-allowance-pill${u.claimed >= u.allowance && u.allowance > 0 ? ' full' : ''}`}>
                      {u.claimed}/{u.allowance}
                    </span>
                  </td>
                  {mealIds.map((mid, i) => {
                    const index = i + 1
                    const outOfScope = index > (u.allowance || 0)
                    const claimed = !!claimMap[mid]
                    return (
                      <td key={mid} className="meals-cell">
                        <button
                          id={`meal-toggle-${u.user_id}-${mid}`}
                          className={`meal-chip${claimed ? ' claimed' : ''}${outOfScope ? ' out-of-scope' : ''}`}
                          onClick={() => handleToggle(u.user_id, mid, claimed, u.allowance || 0, index)}
                          disabled={outOfScope && !claimed}
                          title={
                            outOfScope
                              ? `Outside this user's allowance (${u.allowance})`
                              : claimed ? 'Click to remove entry' : 'Click to add entry'
                          }
                        >
                          {outOfScope && !claimed ? '—' : claimed ? '✓' : '+'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
