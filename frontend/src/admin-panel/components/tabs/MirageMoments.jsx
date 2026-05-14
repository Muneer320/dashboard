import React from 'react'
import { adminPanel } from '../../../lib/api'

const ghostBtnStyle = {
  padding: '6px 11px',
  borderRadius: 9,
  border: '1px solid rgba(255,255,255,0.16)',
  background: 'rgba(255,255,255,0.05)',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 12,
}

const primaryBtnStyle = {
  padding: '8px 16px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(120deg, rgb(132 108 246), rgb(95 218 227))',
  color: '#0b1026',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
}

function sortSlides(images) {
  const list = Array.isArray(images) ? images.slice() : []
  list.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
  return list
}

export default function MirageMoments() {
  const [moments, setMoments] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [detail, setDetail] = React.useState(null)
  const [draft, setDraft] = React.useState({ title: '', subtitle: '', dayLabel: '' })
  const [lookup, setLookup] = React.useState({})
  const [participantQueryByImage, setParticipantQueryByImage] = React.useState({})

  const loadMoments = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const items = await adminPanel.mirageMomentsList()
      setMoments(Array.isArray(items) ? items : [])
    } catch (e) {
      setError(e.message || 'Could not load moments.')
      setMoments([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadMoments()
  }, [loadMoments])

  const openMoment = React.useCallback(async (momentId) => {
    setError('')
    try {
      const m = await adminPanel.mirageMomentGet(momentId)
      setDetail(m)
      setDraft({
        title: m.title || '',
        subtitle: m.subtitle ?? '',
        dayLabel: m.dayLabel || '',
      })
      setParticipantQueryByImage({})
      setLookup({})
    } catch (e) {
      setError(e.message || 'Could not open moment.')
      setDetail(null)
    }
  }, [])

  const saveMeta = React.useCallback(async () => {
    if (!detail) return
    setError('')
    try {
      const body = {
        title: draft.title.trim(),
        dayLabel: draft.dayLabel.trim() || undefined,
        subtitle:
          draft.subtitle === ''
            ? null
            : draft.subtitle?.trim?.() ?? null,
      }
      const m = await adminPanel.mirageMomentPatch(detail.momentId, body)
      setDetail(m)
      await loadMoments()
    } catch (e) {
      setError(e.message || 'Save failed.')
    }
  }, [detail, draft, loadMoments])

  const publish = React.useCallback(async () => {
    if (!detail) return
    if (!window.confirm('Publish this moment? Any other published moment becomes unpublished.')) return
    setError('')
    try {
      const m = await adminPanel.mirageMomentPublish(detail.momentId)
      setDetail(m)
      await loadMoments()
    } catch (e) {
      setError(e.message || 'Publish failed.')
    }
  }, [detail, loadMoments])

  const unpublish = React.useCallback(async () => {
    if (!detail) return
    if (!window.confirm('Unpublish this moment? The public Mirage page will hide the hero.')) return
    setError('')
    try {
      const m = await adminPanel.mirageMomentUnpublish(detail.momentId)
      setDetail(m)
      await loadMoments()
    } catch (e) {
      setError(e.message || 'Unpublish failed.')
    }
  }, [detail, loadMoments])

  const removeMoment = React.useCallback(async () => {
    if (!detail) return
    if (!window.confirm('Delete this unpublished moment permanently?')) return
    setError('')
    try {
      await adminPanel.mirageMomentDelete(detail.momentId)
      setDetail(null)
      await loadMoments()
    } catch (e) {
      setError(e.message || 'Delete failed. Unpublish first if still live.')
    }
  }, [detail, loadMoments])

  const createDraft = React.useCallback(async () => {
    const title = window.prompt('Moment title?', 'New Moment')
    if (!title?.trim()) return
    setError('')
    try {
      const m = await adminPanel.mirageMomentCreate({
        title: title.trim(),
        dayLabel: 'Moment',
      })
      await loadMoments()
      await openMoment(m.momentId)
    } catch (e) {
      setError(e.message || 'Create failed.')
    }
  }, [loadMoments, openMoment])

  const handleUploadImages = React.useCallback(
    async (event) => {
      if (!detail) return
      const files = Array.from(event.target.files || []).filter(Boolean)
      event.target.value = ''
      if (!files.length) return
      setError('')
      try {
        const m = await adminPanel.mirageMomentUploadImages(detail.momentId, files)
        setDetail(m)
        await loadMoments()
      } catch (e) {
        setError(e.message || 'Upload failed.')
      }
    },
    [detail, loadMoments],
  )

  const patchImageOrder = React.useCallback(
    async (imageId, delta) => {
      if (!detail) return
      const slides = sortSlides(detail.images)
      const idx = slides.findIndex((img) => img.imageId === imageId)
      if (idx < 0) return
      const clampedIdx = idx + delta
      if (clampedIdx < 0 || clampedIdx >= slides.length) return
      const newOrderIdx = clampedIdx + 1
      setError('')
      try {
        const m = await adminPanel.mirageMomentImagePatch(imageId, { displayOrder: newOrderIdx })
        setDetail(m)
      } catch (e) {
        setError(e.message || 'Reorder failed.')
      }
    },
    [detail],
  )

  const setCover = React.useCallback(
    async (imageId) => {
      if (!detail) return
      setError('')
      try {
        const m = await adminPanel.mirageMomentImagePatch(imageId, { isCover: true })
        setDetail(m)
      } catch (e) {
        setError(e.message || 'Could not set cover.')
      }
    },
    [detail],
  )

  const removeImage = React.useCallback(
    async (imageId) => {
      if (!detail) return
      if (!window.confirm('Remove this slide and its uploads?')) return
      setError('')
      try {
        await adminPanel.mirageMomentImageDelete(imageId)
        await openMoment(detail.momentId)
        await loadMoments()
      } catch (e) {
        setError(e.message || 'Delete slide failed.')
      }
    },
    [detail, openMoment, loadMoments],
  )

  const runLookup = React.useCallback(async (imageId, qRaw) => {
    const q = (qRaw || '').trim()
    if (q.length < 2) {
      setLookup((prev) => ({ ...prev, [imageId]: [] }))
      return
    }
    try {
      const rows = await adminPanel.lookup({ q })
      const list = Array.isArray(rows) ? rows.slice(0, 8) : []
      setLookup((prev) => ({ ...prev, [imageId]: list }))
    } catch {
      setLookup((prev) => ({ ...prev, [imageId]: [] }))
    }
  }, [])

  const saveParticipants = React.useCallback(
    async (imageId, participantUserIds) => {
      if (!detail) return
      setError('')
      try {
        const m = await adminPanel.mirageMomentImageParticipants(imageId, participantUserIds)
        setDetail(m)
      } catch (e) {
        setError(e.message || 'Participants update failed.')
      }
    },
    [detail],
  )

  const addParticipantChip = React.useCallback(
    (imageId, userId, existingIds) => {
      if (!userId || existingIds.includes(userId)) return
      saveParticipants(imageId, [...existingIds, userId])
      setParticipantQueryByImage((prev) => ({ ...prev, [imageId]: '' }))
      setLookup((prev) => ({ ...prev, [imageId]: [] }))
    },
    [saveParticipants],
  )

  const removeParticipantChip = React.useCallback(
    (imageId, userId, existingIds) => {
      saveParticipants(
        imageId,
        existingIds.filter((uid) => uid !== userId),
      )
    },
    [saveParticipants],
  )

  return (
    <div className="fade-in admin-mirage-moments" style={{ padding: '0 0 120px', maxWidth: 1280 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Mirage Editorial</div>
          <h1 style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.03em', fontSize: 28 }}>
            Mirage Moments
          </h1>
          <p style={{ margin: '8px 0 0', color: 'rgba(226,229,246,0.6)', fontSize: 13, maxWidth: 560 }}>
            One live Moment of the Day for the public hero. Publish unpublishes anything else automatically.
          </p>
        </div>
        <button type="button" style={primaryBtnStyle} onClick={createDraft}>
          New draft moment
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'rgba(239,106,136,0.12)', border: '1px solid rgba(239,106,136,0.35)', fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)', gap: 22 }}>
        <div className="glass" style={{ padding: 16, borderRadius: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.55 }}>Moments ({moments.length})</div>
          {loading ? <div style={{ marginTop: 12, fontSize: 13 }}>Loading…</div> : null}
          {!loading && !moments.length ? (
            <div style={{ marginTop: 12, fontSize: 13 }}>No moments yet.</div>
          ) : null}
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {moments.map((m) => {
              const images = Array.isArray(m.images) ? m.images : []
              const isLive = m.status === 'published'
              return (
                <button
                  key={m.momentId}
                  type="button"
                  onClick={() => openMoment(m.momentId)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    textAlign: 'left',
                    borderRadius: 12,
                    cursor: 'pointer',
                    border: `1px solid ${isLive ? 'rgba(120,216,214,0.45)' : 'rgba(255,255,255,0.1)'}`,
                    background: detail?.momentId === m.momentId ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                    color: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{m.title}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.25)' }}>
                      {m.status}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, opacity: 0.55 }}>
                    {images.length} slides · Day {m.dayLabel}
                  </div>
                  {isLive ? (
                    <div style={{ marginTop: 6, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.12em', fontSize: 9, opacity: 0.9, color: 'rgb(120 216 214)' }}>
                      LIVE NOW
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        {!detail ? (
          <div className="glass" style={{ padding: 24, borderRadius: 16, textAlign: 'center', opacity: 0.6 }}>
            Select a moment to edit.
          </div>
        ) : (
          <div className="glass" style={{ padding: 22, borderRadius: 18 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, opacity: 0.55 }}>Title</label>
              <input
                style={{ marginTop: 6, width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.2)', color: 'inherit' }}
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, opacity: 0.55 }}>Subtitle (optional)</label>
              <input
                style={{ marginTop: 6, width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.2)', color: 'inherit' }}
                value={draft.subtitle}
                onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, opacity: 0.55 }}>Day label</label>
              <input
                style={{ marginTop: 6, width: '100%', maxWidth: 360, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.2)', color: 'inherit' }}
                value={draft.dayLabel}
                onChange={(e) => setDraft((d) => ({ ...d, dayLabel: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 11, opacity: 0.55 }}>Add slides</label>
              <input type="file" accept="image/*" multiple style={{ marginTop: 8 }} onChange={handleUploadImages} />
            </div>

            <div style={{ fontWeight: 600, marginBottom: 10 }}>Slides</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sortSlides(detail.images).map((img) => (
                <div
                  key={img.imageId}
                  style={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 14,
                    padding: 12,
                    display: 'grid',
                    gridTemplateColumns: '120px minmax(0,1fr)',
                    gap: 12,
                  }}
                >
                  <div style={{ aspectRatio: '4/5', borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.25)' }}>
                    <img alt="" src={img.thumbnailUrl || img.imageUrl || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>
                      {img.filename}{' '}{img.isCover ? ' · cover' : ''}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" style={ghostBtnStyle} onClick={() => patchImageOrder(img.imageId, -1)}>
                        ↑
                      </button>
                      <button type="button" style={ghostBtnStyle} onClick={() => patchImageOrder(img.imageId, 1)}>
                        ↓
                      </button>
                      <button type="button" style={ghostBtnStyle} onClick={() => setCover(img.imageId)}>
                        Make cover
                      </button>
                      <button type="button" style={ghostBtnStyle} onClick={() => removeImage(img.imageId)}>
                        Remove
                      </button>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <label style={{ display: 'block', fontSize: 11, opacity: 0.55 }}>Tag Ascent participants</label>
                      <input
                        style={{ marginTop: 6, width: '100%', padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.2)', color: 'inherit', fontSize: 13 }}
                        placeholder="Search name or username"
                        value={participantQueryByImage[img.imageId] || ''}
                        onChange={(e) => {
                          const v = e.target.value
                          setParticipantQueryByImage((prev) => ({ ...prev, [img.imageId]: v }))
                          runLookup(img.imageId, v)
                        }}
                      />
                      {Array.isArray(lookup[img.imageId]) && lookup[img.imageId].length > 0 ? (
                        <div style={{ marginTop: 6, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
                          {lookup[img.imageId].map((row) => (
                            <button
                              key={`${img.imageId}-${row.id}`}
                              type="button"
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 10px',
                                border: 'none',
                                background: 'rgba(255,255,255,0.04)',
                                color: 'inherit',
                                cursor: 'pointer',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                              }}
                              onClick={() =>
                                addParticipantChip(img.imageId, row.id, (img.participants || []).map((p) => p.userId))
                              }
                            >
                              <div style={{ fontWeight: 600 }}>{row.name}</div>
                              <div style={{ fontSize: 11, opacity: 0.55 }}>{row.username}</div>
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(img.participants || []).map((p) => (
                          <button
                            type="button"
                            key={`${img.imageId}-p-${p.userId}`}
                            onClick={() =>
                              removeParticipantChip(img.imageId, p.userId, (img.participants || []).map((x) => x.userId))
                            }
                            style={{
                              borderRadius: 999,
                              padding: '3px 8px',
                              border: '1px solid rgba(255,255,255,0.15)',
                              background: 'rgba(255,255,255,0.06)',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            {p.name || p.username} ✕
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!detail.images?.length ? <div style={{ marginTop: 12, opacity: 0.6, fontSize: 13 }}>No slides yet.</div> : null}
          </div>
        )}
      </div>

      {detail ? (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 20px calc(14px + env(safe-area-inset-bottom))',
            background: 'linear-gradient(0deg,rgba(5,10,22,0.96),transparent)',
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            zIndex: 50,
          }}
        >
          <button type="button" style={{ ...ghostBtnStyle, opacity: detail.status === 'published' ? 0.45 : 1 }} disabled={detail.status === 'published'} onClick={removeMoment}>
            Delete moment
          </button>
          <button type="button" style={{ ...ghostBtnStyle, opacity: detail.status !== 'published' ? 0.45 : 1 }} onClick={() => unpublish()} disabled={detail.status !== 'published'}>
            Unpublish
          </button>
          <button type="button" style={{ ...ghostBtnStyle, opacity: !detail.images?.length ? 0.45 : 1 }} onClick={() => publish()} disabled={!detail.images?.length}>
            Publish
          </button>
          <button type="button" style={primaryBtnStyle} onClick={() => saveMeta()}>
            Save details
          </button>
        </div>
      ) : null}
    </div>
  )
}
