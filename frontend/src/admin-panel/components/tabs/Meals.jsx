import React, { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import './Meals.css'

export default function Meals() {
  const {
    mealsCount,
    userMeals,
    updateMealsCount,
    addMealEntry,
    removeMealEntry,
    loadMeals,
  } = useData()

  const [search, setSearch] = useState('')
  const [pendingCount, setPendingCount] = useState(mealsCount)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Keep the draft count in sync when the source number updates externally.
  React.useEffect(() => { setPendingCount(mealsCount) }, [mealsCount])

  const mealIds = useMemo(
    () => Array.from({ length: mealsCount }, (_, i) => `meal${i + 1}`),
    [mealsCount],
  )

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return userMeals
    return userMeals.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    )
  }, [userMeals, search])

  async function handleSaveCount() {
    const next = Number(pendingCount)
    if (!Number.isInteger(next) || next < 1 || next > 20) {
      setErr('Meals count must be a whole number between 1 and 20.')
      return
    }
    setBusy(true); setErr('')
    try {
      await updateMealsCount(next)
    } catch (e) {
      setErr(e?.message || 'Failed to update meals count.')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggle(userId, mealId, currentlyClaimed) {
    try {
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

      {/* Config card — total meals */}
      <div className="meals-config-card">
        <div className="meals-config-info">
          <h3 className="meals-config-title">Total meals served</h3>
          <p className="meals-config-sub">
            Set how many meals the festival is serving in total. Each user's claim
            status is tracked per meal slot (meal1…meal{mealsCount}).
          </p>
        </div>
        <div className="meals-config-edit">
          <input
            id="meals-count-input"
            className="input-field meals-count-input"
            type="number"
            min="1"
            max="20"
            value={pendingCount}
            onChange={e => setPendingCount(e.target.value)}
            disabled={busy}
          />
          <button
            id="meals-count-save"
            className="btn btn-primary"
            onClick={handleSaveCount}
            disabled={busy || Number(pendingCount) === mealsCount}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
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
                <td colSpan={mealIds.length + 1} className="meals-empty">
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
                  {mealIds.map(mid => {
                    const claimed = !!claimMap[mid]
                    return (
                      <td key={mid} className="meals-cell">
                        <button
                          id={`meal-toggle-${u.user_id}-${mid}`}
                          className={`meal-chip${claimed ? ' claimed' : ''}`}
                          onClick={() => handleToggle(u.user_id, mid, claimed)}
                          title={claimed ? 'Click to remove entry' : 'Click to add entry'}
                        >
                          {claimed ? '✓' : '+'}
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
