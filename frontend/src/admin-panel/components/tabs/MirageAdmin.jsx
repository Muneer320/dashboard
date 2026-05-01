import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { adminPanel as adminApi } from '../../../lib/api'
import { useData } from '../../context/DataContext'
import './MirageAdmin.css'

const EMPTY_FORM = {
  dayLabel: '',
  sectionTitle: '',
  eventId: '',
  driveFolderUrl: '',
  recursive: false,
  sortOrder: 0,
  isPublished: true,
}

export default function MirageAdmin() {
  const { events } = useData()
  const [sections, setSections] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const sortedEvents = useMemo(
    () => [...(events || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [events],
  )

  const loadSections = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminApi.mirageSections()
      setSections(data || [])
    } catch (e) {
      setError(e.message || 'Could not load Mirage sections.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSections()
  }, [loadSections])

  function updateField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  function startEdit(section) {
    setEditingId(section.id)
    setError('')
    setSuccess('')
    setForm({
      dayLabel: section.dayLabel || '',
      sectionTitle: section.sectionTitle || '',
      eventId: section.eventId || '',
      driveFolderUrl: section.driveFolderUrl || '',
      recursive: !!section.recursive,
      sortOrder: section.sortOrder ?? 0,
      isPublished: section.isPublished !== false,
    })
    setTimeout(() => {
      document.getElementById('mirage-admin-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const payload = {
      dayLabel: form.dayLabel.trim(),
      sectionTitle: form.sectionTitle.trim(),
      driveFolderUrl: form.driveFolderUrl.trim(),
      eventId: form.eventId || null,
      eventName: sortedEvents.find(event => event.id === form.eventId)?.name || null,
      recursive: !!form.recursive,
      sortOrder: Number(form.sortOrder || 0),
      isPublished: !!form.isPublished,
    }

    try {
      if (editingId) {
        await adminApi.updateMirageSection(editingId, payload)
        setSuccess('Mirage section updated.')
      } else {
        await adminApi.addMirageSection(payload)
        setSuccess('Mirage section saved.')
      }
      resetForm()
      await loadSections()
    } catch (e) {
      setError(e.message || 'Could not save Mirage section.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(sectionId) {
    if (!window.confirm('Delete this Mirage folder mapping?')) return
    setDeletingId(sectionId)
    setError('')
    setSuccess('')
    try {
      await adminApi.deleteMirageSection(sectionId)
      if (editingId === sectionId) resetForm()
      setSuccess('Mirage section deleted.')
      await loadSections()
    } catch (e) {
      setError(e.message || 'Could not delete Mirage section.')
    } finally {
      setDeletingId(null)
    }
  }

  const groupedByDay = useMemo(() => {
    return sections.reduce((acc, section) => {
      const key = section.dayLabel || 'Unlabeled'
      acc[key] = acc[key] || []
      acc[key].push(section)
      return acc
    }, {})
  }, [sections])

  return (
    <div className="fade-in mirage-admin-page">
      <div className="section-header">
        <span className="section-title">Mirage</span>
        <span className="badge badge-accent">Admin Only</span>
      </div>

      <div className="card mirage-admin-card" id="mirage-admin-form">
        <div className="mirage-admin-head">
          <div>
            <h3>{editingId ? 'Edit Mirage Section' : 'Add Mirage Section'}</h3>
            <p>
              Save a Google Drive folder against a day and section so the Mirage page can render
              real images later. User-to-image matching will plug into this structure separately.
            </p>
          </div>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mirage-admin-form">
          <div className="mirage-admin-grid">
            <label>
              <span>Day Label</span>
              <input
                type="text"
                placeholder="Day 1"
                value={form.dayLabel}
                onChange={e => updateField('dayLabel', e.target.value)}
                required
              />
            </label>

            <label>
              <span>Section Title</span>
              <input
                type="text"
                placeholder="Override Finals"
                value={form.sectionTitle}
                onChange={e => updateField('sectionTitle', e.target.value)}
                required
              />
            </label>

            <label>
              <span>Linked Event</span>
              <select
                value={form.eventId}
                onChange={e => updateField('eventId', e.target.value)}
              >
                <option value="">None</option>
                {sortedEvents.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Sort Order</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.sortOrder}
                onChange={e => updateField('sortOrder', e.target.value)}
              />
            </label>
          </div>

          <label>
            <span>Google Drive Folder Link</span>
            <input
              type="url"
              placeholder="https://drive.google.com/drive/folders/..."
              value={form.driveFolderUrl}
              onChange={e => updateField('driveFolderUrl', e.target.value)}
              required
            />
          </label>

          <div className="mirage-admin-toggles">
            <label className="mirage-toggle">
              <input
                type="checkbox"
                checked={form.recursive}
                onChange={e => updateField('recursive', e.target.checked)}
              />
              <div>
                <strong>Recursive Folder Scan</strong>
                <span>Use this if the Drive folder contains nested child folders for images.</span>
              </div>
            </label>

            <label className="mirage-toggle">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={e => updateField('isPublished', e.target.checked)}
              />
              <div>
                <strong>Published</strong>
                <span>Unpublished sections stay saved in Supabase but do not appear on the user-facing Mirage page.</span>
              </div>
            </label>
          </div>

          {error && <div className="mirage-status mirage-status-error">{error}</div>}
          {success && <div className="mirage-status mirage-status-success">{success}</div>}

          <div className="mirage-admin-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update Section' : 'Save Section'}
            </button>
          </div>
        </form>
      </div>

      <div className="mirage-admin-list-head">
        <span>Saved Sections</span>
        <span>{sections.length} total</span>
      </div>

      {loading ? (
        <div className="empty-state">Loading Mirage folders…</div>
      ) : sections.length === 0 ? (
        <div className="empty-state">No Mirage sections saved yet.</div>
      ) : (
        <div className="mirage-day-stack">
          {Object.entries(groupedByDay).map(([dayLabel, daySections]) => (
            <div className="card mirage-day-card" key={dayLabel}>
              <div className="mirage-day-card-head">
                <h4>{dayLabel}</h4>
                <span>{daySections.length} section{daySections.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="mirage-section-stack">
                {daySections.map(section => (
                  <div className="mirage-section-card" key={section.id}>
                    <div className="mirage-section-main">
                      <div className="mirage-section-title-row">
                        <h5>{section.sectionTitle}</h5>
                        {!section.isPublished && <span className="badge badge-warning">Draft</span>}
                      </div>

                      <div className="mirage-section-meta">
                        <span>{section.eventName || 'No linked event'}</span>
                        <span>{section.imageCount} image{section.imageCount !== 1 ? 's' : ''}</span>
                        <span>{section.recursive ? 'Recursive' : 'Flat folder'}</span>
                        <span>Order {section.sortOrder}</span>
                      </div>

                      <div className="mirage-section-link">
                        <a href={section.driveFolderUrl} target="_blank" rel="noreferrer">
                          Open Drive Folder
                        </a>
                        <code>{section.driveFolderId}</code>
                      </div>

                      {section.sampleImages?.length > 0 && (
                        <div className="mirage-samples">
                          {section.sampleImages.map(name => (
                            <span key={name} className="mirage-sample-pill">{name}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mirage-section-actions">
                      <button type="button" onClick={() => startEdit(section)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDelete(section.id)}
                        disabled={deletingId === section.id}
                      >
                        {deletingId === section.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
