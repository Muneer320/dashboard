import React, { useState, useEffect, useCallback } from 'react'

function toLocalDatetimeInput(iso) {
  if (!iso) return ''
  // Supabase returns ISO with tz — convert to local YYYY-MM-DDTHH:MM for input[type=datetime-local]
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toLocalDateInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

// ── Sub-tab: Event Details ────────────────────────────────────────────────────

function buildInitialForm(event) {
  return {
    name:                  event.name || '',
    title:                 event.title || '',
    description:           event.description || '',
    category:              event.category || '',
    date:                  toLocalDateInput(event.date),
    end_date:              toLocalDatetimeInput(event.end_date),
    registration_deadline: toLocalDatetimeInput(event.registration_deadline),
    venue:                 Array.isArray(event.venue) ? event.venue.join(', ') : (event.venue || ''),
    maxParticipants:       event.maxParticipants ?? '',
    communityLink:         event.communityLink || '',
    rules:                 event.rules || '',
    judges:                Array.isArray(event.judges) ? event.judges.join(', ') : (event.judges || ''),
  }
}

function buildInitialPhases(rounds, questions) {
  return Object.entries(rounds || {}).map(([key, data]) => ({
    key,
    title:           data.title || '',
    venue:           Array.isArray(data.venue) ? data.venue.join(', ') : (data.venue || ''),
    start_time:      toLocalDatetimeInput(data.start_time),
    end_time:        toLocalDatetimeInput(data.end_time),
    description:     data.description || '',
    problemStatement:data.problemStatement || '',
    is_active:       !!data.is_active,
    is_locked:       !!data.is_locked,
    questions:       (questions || {})[key] || [],
  }))
}

const QUESTION_TYPES = ['text', 'text-long', 'url', 'file', 'number']

function PhaseQuestionsEditor({ questions, onChange, canEdit }) {
  function addQuestion() {
    onChange([...questions, { question_id: `q${Date.now()}`, question_text: '', question_type: 'text', required: true }])
  }
  
  function update(idx, field, val) {
    const updated = [...questions]
    updated[idx] = { ...updated[idx], [field]: val }
    onChange(updated)
  }

  function remove(idx) {
    onChange(questions.filter((_, i) => i !== idx))
  }

  return (
    <div className="ed-questions" style={{marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)'}}>
      <div className="ed-questions-header" style={{display: 'flex', justifyContent: 'space-between', marginBottom: 12}}>
        <label className="ed-label">Submission Questions</label>
        {canEdit && <button className="btn btn-ghost ed-add-q-btn" onClick={addQuestion} style={{padding: '4px 8px', fontSize: '0.75rem'}}>+ Add Question</button>}
      </div>
      {questions.length === 0 ? (
        <div className="ed-hint" style={{fontSize: '0.8rem'}}>No questions defined for this phase.</div>
      ) : (
        <div className="ed-q-list" style={{display: 'flex', flexDirection: 'column', gap: 12}}>
          {questions.map((q, i) => (
            <div key={i} className="ed-q-card" style={{background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border)'}}>
              <div className="ed-q-row" style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                <input className="input-field" placeholder="ID (e.g. q1)" value={q.question_id||''} onChange={e=>update(i,'question_id',e.target.value)} disabled={!canEdit} style={{width: 90, fontSize: '0.8rem'}} />
                <input className="input-field" placeholder="Question Text" value={q.question_text||''} onChange={e=>update(i,'question_text',e.target.value)} disabled={!canEdit} style={{flex: 1, fontSize: '0.8rem'}} />
                <select className="input-field" value={q.question_type||'text'} onChange={e=>update(i,'question_type',e.target.value)} disabled={!canEdit} style={{width: 100, fontSize: '0.8rem', padding: '6px 8px'}}>
                  {QUESTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <label className="ed-toggle-label" style={{fontSize: '0.75rem'}}><input type="checkbox" checked={!!q.required} onChange={e=>update(i,'required',e.target.checked)} disabled={!canEdit} /> Req</label>
                {canEdit && <button className="ed-phase-remove" onClick={()=>remove(i)}>✕</button>}
              </div>
              <div className="ed-q-row" style={{display: 'flex', gap: 8, marginTop: 8}}>
                <input className="input-field" placeholder="Placeholder text..." value={q.placeholder||''} onChange={e=>update(i,'placeholder',e.target.value)} disabled={!canEdit} style={{flex: 1, fontSize: '0.8rem'}} />
                <input className="input-field" type="number" placeholder="Word Limit" value={q.word_limit||''} onChange={e=>update(i,'word_limit',e.target.value!==''?Number(e.target.value):undefined)} disabled={!canEdit} style={{width: 100, fontSize: '0.8rem'}} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PhaseEditor({ phase, idx, onChange, onRemove, canEdit }) {
  function set(field, value) { onChange(idx, { ...phase, [field]: value }) }

  return (
    <div className="ed-phase-card">
      <div className="ed-phase-header">
        <div className="ed-phase-badge">{phase.key}</div>
        <span className="ed-phase-title-preview">{phase.title || 'Untitled Phase'}</span>
        <div className="ed-phase-toggles">
          <label className="ed-toggle-label">
            <input type="checkbox" checked={phase.is_active} onChange={e => set('is_active', e.target.checked)} disabled={!canEdit} />
            Active
          </label>
          <label className="ed-toggle-label">
            <input type="checkbox" checked={phase.is_locked} onChange={e => set('is_locked', e.target.checked)} disabled={!canEdit} />
            Locked
          </label>
        </div>
        {canEdit && (
          <button className="ed-phase-remove" onClick={() => onRemove(idx)} title="Remove phase">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      <div className="ed-form-grid" style={{marginTop: 14}}>
        <div className="ed-field">
          <label className="ed-label">Title</label>
          <input className="input-field" value={phase.title} onChange={e => set('title', e.target.value)} disabled={!canEdit} placeholder="e.g. Qualifier Round" />
        </div>
        <div className="ed-field">
          <label className="ed-label">Venue <span className="ed-hint">(comma-sep)</span></label>
          <input className="input-field" value={phase.venue} onChange={e => set('venue', e.target.value)} disabled={!canEdit} placeholder="e.g. Online, Hall A" />
        </div>
        <div className="ed-field">
          <label className="ed-label">Start Time</label>
          <input className="input-field" type="datetime-local" value={phase.start_time} onChange={e => set('start_time', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="ed-field">
          <label className="ed-label">End Time</label>
          <input className="input-field" type="datetime-local" value={phase.end_time} onChange={e => set('end_time', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="ed-field ed-field-full">
          <label className="ed-label">Description</label>
          <textarea className="input-field ed-textarea" rows={3} value={phase.description} onChange={e => set('description', e.target.value)} disabled={!canEdit} placeholder="Phase description…" />
        </div>
        <div className="ed-field ed-field-full">
          <label className="ed-label">Problem Statement</label>
          <textarea className="input-field ed-textarea" rows={3} value={phase.problemStatement} onChange={e => set('problemStatement', e.target.value)} disabled={!canEdit} placeholder="Problem statement for this phase…" />
        </div>
      </div>

      <PhaseQuestionsEditor questions={phase.questions || []} onChange={qs => set('questions', qs)} canEdit={canEdit} />
    </div>
  )
}

function EventDetailsTab({ event, canEdit, onSaved }) {
  const [form,   setFormState] = useState(() => buildInitialForm(event))
  const [phases, setPhases]    = useState(() => buildInitialPhases(event.rounds, event.questions))
  const [saving, setSaving]    = useState(false)
  const [err,    setErr]       = useState('')
  const [success,setSuccess]   = useState('')

  // Sync when navigating between events
  useEffect(() => {
    setFormState(buildInitialForm(event))
    setPhases(buildInitialPhases(event.rounds, event.questions))
    setErr(''); setSuccess('')
  }, [event.id])

  function setField(field, value) {
    setFormState(f => ({ ...f, [field]: value }))
    setErr(''); setSuccess('')
  }

  function handlePhaseChange(idx, updated) {
    setPhases(prev => prev.map((p, i) => i === idx ? updated : p))
    setErr(''); setSuccess('')
  }

  function handleAddPhase() {
    const nextNum = phases.length + 1
    setPhases(prev => [...prev, {
      key: `phase${nextNum}`,
      title: '', venue: '', start_time: '', end_time: '',
      description: '', problemStatement: '',
      is_active: false, is_locked: false,
      questions: [],
    }])
  }

  function handleRemovePhase(idx) {
    setPhases(prev => prev.filter((_, i) => i !== idx))
  }

  function getPayloadData(phaseList) {
    const roundsOut = {}
    const questionsOut = {}
    phaseList.forEach(p => {
      roundsOut[p.key] = {
        title:            p.title,
        venue:            p.venue.split(',').map(v => v.trim()).filter(Boolean),
        start_time:       p.start_time ? new Date(p.start_time).toISOString() : null,
        end_time:         p.end_time   ? new Date(p.end_time).toISOString()   : null,
        description:      p.description,
        problemStatement: p.problemStatement,
        is_active:        p.is_active,
        is_locked:        p.is_locked,
      }
      if (p.questions && p.questions.length > 0) {
        questionsOut[p.key] = p.questions
      }
    })
    return { rounds: roundsOut, questions: questionsOut }
  }

  async function handleSave() {
    if (!form.name.trim()) { setErr('Event name is required.'); return }
    setSaving(true); setErr(''); setSuccess('')
    try {
      const venueArr  = form.venue.split(',').map(v => v.trim()).filter(Boolean)
      const judgesArr = form.judges.split(',').map(j => j.trim()).filter(Boolean)

      const payloadData = getPayloadData(phases)

      const body = {
        name:                  form.name.trim(),
        title:                 form.title.trim() || undefined,
        description:           form.description.trim() || undefined,
        category:              form.category.trim()    || undefined,
        date:                  form.date               || undefined,
        end_date:              form.end_date           || undefined,
        registration_deadline: form.registration_deadline || undefined,
        venue:                 venueArr.length ? venueArr : undefined,
        maxParticipants:       form.maxParticipants !== '' ? Number(form.maxParticipants) : undefined,
        communityLink:         form.communityLink.trim() || undefined,
        rules:                 form.rules.trim()       || undefined,
        judges:                judgesArr.length ? judgesArr : undefined,
        rounds:                payloadData.rounds,
        questions:             payloadData.questions,
      }
      Object.keys(body).forEach(k => body[k] === undefined && delete body[k])
      const updated = await adminPanel.updateEvent(event.id, body)
      setSuccess('Event updated successfully.')
      onSaved(updated)
    } catch (e) {
      setErr(e?.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ed-details-tab">
      {/* ── Core fields ── */}
      <div className="ed-section-label">Core Details</div>
      <div className="ed-form-grid">
        <div className="ed-field">
          <label className="ed-label">Event Name * <span className="ed-hint">(Internal ID)</span></label>
          <input className="input-field" value={form.name} onChange={e => setField('name', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="ed-field">
          <label className="ed-label">Display Title <span className="ed-hint">(User Facing)</span></label>
          <input className="input-field" value={form.title} onChange={e => setField('title', e.target.value)} disabled={!canEdit} placeholder="e.g. The Grand Coding Challenge" />
        </div>
        <div className="ed-field">
          <label className="ed-label">Category</label>
          <input className="input-field" value={form.category} onChange={e => setField('category', e.target.value)} disabled={!canEdit} placeholder="e.g. Technical" />
        </div>
        <div className="ed-field">
          <label className="ed-label">Start Date</label>
          <input className="input-field" type="date" value={form.date} onChange={e => setField('date', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="ed-field">
          <label className="ed-label">End Date / Time</label>
          <input className="input-field" type="datetime-local" value={form.end_date} onChange={e => setField('end_date', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="ed-field">
          <label className="ed-label">Registration Deadline</label>
          <input className="input-field" type="datetime-local" value={form.registration_deadline} onChange={e => setField('registration_deadline', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="ed-field">
          <label className="ed-label">Max Participants</label>
          <input className="input-field" type="number" min="1" value={form.maxParticipants} onChange={e => setField('maxParticipants', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="ed-field ed-field-full">
          <label className="ed-label">Venue <span className="ed-hint">(comma-separated)</span></label>
          <input className="input-field" value={form.venue} onChange={e => setField('venue', e.target.value)} disabled={!canEdit} placeholder="e.g. Hall A, Room 101" />
        </div>
        <div className="ed-field ed-field-full">
          <label className="ed-label">Judges <span className="ed-hint">(comma-separated names)</span></label>
          <input className="input-field" value={form.judges} onChange={e => setField('judges', e.target.value)} disabled={!canEdit} placeholder="e.g. Dr. Smith, Prof. Rao" />
        </div>
        <div className="ed-field ed-field-full">
          <label className="ed-label">Community Link</label>
          <input className="input-field" value={form.communityLink} onChange={e => setField('communityLink', e.target.value)} disabled={!canEdit} placeholder="https://..." />
        </div>
        <div className="ed-field ed-field-full">
          <label className="ed-label">Rules</label>
          <textarea className="input-field ed-textarea" value={form.rules} onChange={e => setField('rules', e.target.value)} disabled={!canEdit} rows={4} placeholder="Event rules and guidelines…" />
        </div>
        <div className="ed-field ed-field-full">
          <label className="ed-label">Description</label>
          <textarea className="input-field ed-textarea" value={form.description} onChange={e => setField('description', e.target.value)} disabled={!canEdit} rows={4} placeholder="Event description…" />
        </div>
      </div>

      {/* ── Phases editor ── */}
      <div className="ed-section-label" style={{marginTop: 28}}>
        Phases / Rounds
        {canEdit && (
          <button className="btn btn-ghost ed-add-phase-btn" onClick={handleAddPhase}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Phase
          </button>
        )}
      </div>

      {phases.length === 0 ? (
        <div className="ed-phases-empty">No phases defined yet.{canEdit ? ' Click "Add Phase" to create one.' : ''}</div>
      ) : (
        <div className="ed-phases-list">
          {phases.map((ph, idx) => (
            <PhaseEditor key={ph.key + idx} phase={ph} idx={idx} onChange={handlePhaseChange} onRemove={handleRemovePhase} canEdit={canEdit} />
          ))}
        </div>
      )}

      {err     && <div className="ed-alert ed-alert-err">{err}</div>}
      {success && <div className="ed-alert ed-alert-ok">{success}</div>}

      {canEdit && (
        <div className="ed-form-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save All Changes'}
          </button>
        </div>
      )}
      {!canEdit && (
        <div className="ed-readonly-notice">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          You have read-only access to this event's details.
        </div>
      )}
    </div>
  )
}

import { useParams, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { adminPanel } from '../../../lib/api'
import Pagination from '../Pagination'
import ConfirmModal from '../ConfirmModal'
import './EventDetail.css'

// ── Submission Modal ──────────────────────────────────────────────────────────

function SubmissionModal({ participant, eventName, onClose }) {
  const { name, username, submissionData } = participant
  const phases = Object.entries(submissionData || {})
    .filter(([, d]) => typeof d === 'object' && d?.submitted)
    .sort(([a], [b]) => a.localeCompare(b))

  function fmtDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const modal = (
    <div style={oStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={mStyle}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:'#f0f0f8' }}>{name}</h2>
            <p style={{ margin:'4px 0 8px', fontSize:12, color:'#60607a' }}>{username} · {eventName}</p>
            <span style={sBadge}>✓ {phases.length} phase{phases.length!==1?'s':''} submitted</span>
          </div>
          <button onClick={onClose} style={cBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {phases.length === 0 ? <p style={{ color:'#60607a' }}>No submitted phases.</p> : (
          <div style={{ display:'flex', flexDirection:'column', gap:16, overflowY:'auto', maxHeight:'calc(80vh - 160px)' }}>
            {phases.map(([key, data]) => {
              const answers = Array.isArray(data.answers) ? data.answers : []
              return (
                <div key={key} style={{ background:'#16161f', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'16px 18px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                    <span style={{ fontWeight:700, fontSize:13, color:'#f0f0f8' }}>Phase {key.replace('phase','')}</span>
                    <span style={{ fontSize:11, color:'#60607a' }}>{fmtDate(data.submitted_at)}</span>
                  </div>
                  {answers.map((a,i) => (
                    <div key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:10, marginBottom:10 }}>
                      <div style={{ fontSize:10, color:'#60607a', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{a.question_id}</div>
                      <div style={{ fontSize:13, color:'#f0f0f8' }}>{String(a.answer ?? '—')}</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
  return createPortal(modal, document.body)
}

const oStyle = { position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:'"Inter",system-ui,sans-serif' }
const mStyle = { background:'#1c1c28', border:'1px solid rgba(124,58,237,0.3)', borderRadius:16, width:'100%', maxWidth:680, maxHeight:'88vh', padding:'24px 28px', overflowY:'auto', color:'#f0f0f8', boxShadow:'0 24px 80px rgba(0,0,0,0.8)' }
const sBadge = { display:'inline-flex', padding:'3px 10px', borderRadius:999, background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)', color:'#6ee7b7', fontSize:11, fontWeight:600 }
const cBtnStyle = { background:'none', border:'none', cursor:'pointer', color:'#60607a', padding:4, display:'flex', alignItems:'center' }

// ── Sub-tab: Participants ─────────────────────────────────────────────────────

function ParticipantsTab({ eventId, eventName }) {
  const { participants, updateParticipantStatus } = useData()
  const [search, setSearch] = useState('')
  const [confirmState, setConfirmState] = useState(null)
  const [modalP, setModalP] = useState(null)
  const [page, setPage] = useState(1)
  const PER_PAGE = 10

  const evParts = participants.filter(p => p.eventId === eventId)
  const filtered = evParts.filter(p => {
    const q = search.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)
  })
  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paged = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE)

  function confirmToggle(p) {
    const ns = p.status === 'active' ? 'restricted' : 'active'
    setConfirmState({ participantId: p.id, eventId: p.eventId, newStatus: ns, name: p.name })
  }

  return (
    <div className="ed-participants-tab">
      <div className="ed-tab-toolbar">
        <div className="search-wrap">
          <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="input-field search-input" placeholder="Search participants…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} />
        </div>
        <span className="badge badge-info">{evParts.length} registered</span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><p>{search ? 'No participants match your search.' : 'No participants registered yet.'}</p></div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr>
                <th>#</th><th>Name</th><th>Team</th><th>Attended</th><th>Status</th><th>Submission</th><th>Action</th>
              </tr></thead>
              <tbody>
                {paged.map((p, idx) => (
                  <tr key={p.id}>
                    <td style={{color:'var(--text-muted)',fontSize:'0.78rem'}}>{(page-1)*PER_PAGE+idx+1}</td>
                    <td>
                      <div style={{color:'var(--text-primary)',fontWeight:500}}>{p.name}</div>
                      <div style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{p.username}</div>
                    </td>
                    <td style={{fontSize:'0.82rem',color:'var(--text-muted)'}}>{p.teamId ? p.teamId.slice(0,8)+'…' : '—'}</td>
                    <td><span className={`badge ${p.isAttending?'badge-success':'badge-warning'}`}>{p.isAttending?'Yes':'No'}</span></td>
                    <td><span className={`badge ${p.status==='active'?'badge-success':'badge-danger'}`}>{p.status==='active'?'Active':'Restricted'}</span></td>
                    <td>
                      {p.submitted ? (
                        <button style={viewBtnSt} onClick={()=>setModalP(p)}>View</button>
                      ) : <span style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>None</span>}
                    </td>
                    <td>
                      <button className={`btn btn-sm ${p.status==='active'?'btn-danger':'btn-success'}`} onClick={()=>confirmToggle(p)}>
                        {p.status==='active'?'Restrict':'Restore'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {confirmState && (
        <ConfirmModal
          title="Change Status"
          message={confirmState.newStatus==='restricted' ? `Restrict ${confirmState.name}?` : `Restore ${confirmState.name}?`}
          confirmLabel={confirmState.newStatus==='restricted'?'Restrict':'Restore'}
          isDanger={confirmState.newStatus==='restricted'}
          onConfirm={()=>{ updateParticipantStatus(confirmState.participantId, confirmState.newStatus, confirmState.eventId); setConfirmState(null) }}
          onCancel={()=>setConfirmState(null)}
        />
      )}
      {modalP && <SubmissionModal participant={modalP} eventName={eventName} onClose={()=>setModalP(null)} />}
    </div>
  )
}

const viewBtnSt = { display:'inline-flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:6, background:'rgba(124,58,237,0.12)', border:'1px solid rgba(124,58,237,0.3)', color:'#9d5af0', fontSize:12, fontWeight:600, cursor:'pointer' }

// ── Sub-tab: Meals ────────────────────────────────────────────────────────────

function MealsTab({ event }) {
  const { eventsMealsCount, userMeals, participants, updateEventMealsCount, addMealEntry, removeMealEntry, loadMeals } = useData()
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState('')
  const [search, setSearch] = useState('')

  const evMeals = eventsMealsCount.find(e => e.id === event.id)
  const [draft, setDraft] = useState(evMeals?.meals_count ?? 0)
  useEffect(() => { setDraft(evMeals?.meals_count ?? 0) }, [evMeals?.meals_count])

  // Only show users registered for this event
  const evUserIds = new Set(
    (participants || []).filter(p => p.eventId === event.id).map(p => p.id)
  )
  const filteredUsers = userMeals.filter(u => evUserIds.has(u.user_id) && (!search || u.name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase())))

  const mealIds = Array.from({ length: Math.max(...(filteredUsers.map(u=>u.allowance)), evMeals?.meals_count || 0, 0) }, (_, i) => `meal${i+1}`)

  async function handleSaveCount() {
    const n = Number(draft)
    if (!Number.isInteger(n) || n < 0 || n > 20) { setErr('Must be 0-20'); return }
    setBusy(true); setErr('')
    try { await updateEventMealsCount(event.id, n) } catch(e) { setErr(e?.message||'Failed') } finally { setBusy(false) }
  }

  async function handleToggle(userId, mealId, claimed) {
    try { setErr(''); if (claimed) await removeMealEntry(userId, mealId); else await addMealEntry(userId, mealId) }
    catch(e) { setErr(e?.message||'Failed') }
  }

  return (
    <div className="ed-meals-tab">
      <div className="ed-meals-config">
        <div>
          <div className="ed-label" style={{marginBottom:6}}>Meal slots for this event</div>
          <p style={{fontSize:'0.82rem',color:'var(--text-muted)',marginBottom:12}}>Each registered user gets this many meal slots from this event.</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <input className="input-field" type="number" min="0" max="20" value={draft} onChange={e=>setDraft(e.target.value)} style={{width:80}} disabled={busy} />
          <button className="btn btn-primary" onClick={handleSaveCount} disabled={busy || Number(draft)===evMeals?.meals_count}>{busy?'Saving…':'Save'}</button>
          <button className="btn btn-ghost" onClick={loadMeals} disabled={busy}>Refresh</button>
        </div>
      </div>
      {err && <div className="ed-alert ed-alert-err">{err}</div>}

      <div className="ed-tab-toolbar" style={{marginTop:20}}>
        <div className="search-wrap">
          <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="input-field search-input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <span className="badge badge-info">{filteredUsers.length} participants</span>
      </div>

      {mealIds.length === 0 ? (
        <div className="empty-state"><p>Set meal slots above to see the claim matrix.</p></div>
      ) : (
        <div className="table-responsive" style={{marginTop:12}}>
          <table className="data-table meals-table">
            <thead><tr>
              <th>Participant</th>
              <th>Claimed / Allowed</th>
              {mealIds.map(m=><th key={m}>{m}</th>)}
            </tr></thead>
            <tbody>
              {filteredUsers.length===0 ? (
                <tr><td colSpan={mealIds.length+2} style={{textAlign:'center',color:'var(--text-muted)',padding:20}}>No participants.</td></tr>
              ) : filteredUsers.map(u => {
                const cm = Object.fromEntries(u.claims.map(c=>[c.meal_id,c.claimed]))
                return (
                  <tr key={u.user_id}>
                    <td>
                      <div style={{fontWeight:500,color:'var(--text-primary)'}}>{u.name}</div>
                      <div style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>@{u.username}</div>
                    </td>
                    <td>
                      <span className={`badge ${u.claimed>=u.allowance&&u.allowance>0?'badge-warning':'badge-info'}`}>{u.claimed}/{u.allowance}</span>
                    </td>
                    {mealIds.map((mid,i) => {
                      const claimed = !!cm[mid]
                      const out = (i+1)>(u.allowance||0)
                      return (
                        <td key={mid} style={{textAlign:'center'}}>
                          <button
                            className={`meal-chip${claimed?' claimed':''}${out?' out-of-scope':''}`}
                            onClick={()=>handleToggle(u.user_id,mid,claimed)}
                            disabled={out&&!claimed}
                            title={out?`Outside allowance (${u.allowance})`:claimed?'Remove':'Add'}
                          >
                            {out&&!claimed?'—':claimed?'✓':'+'}
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
      )}
    </div>
  )
}

// ── Main EventDetail ──────────────────────────────────────────────────────────

const TABS = ['details', 'participants', 'meals']
const TAB_LABELS = { details: 'Event Details', participants: 'Participants', meals: 'Meals' }

export default function EventDetail() {
  const { eventId } = useParams()
  const navigate    = useNavigate()
  const { user, isAdmin } = useAuth()
  const { events, participants } = useData()

  const [event, setEvent]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [activeTab, setActiveTab] = useState('details')

  const loadEvent = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await adminPanel.getEvent(eventId)
      setEvent(data)
    } catch(e) {
      setError(e?.message || 'Failed to load event.')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { loadEvent() }, [loadEvent])

  // Check if this EM is assigned to this event
  const canEdit = isAdmin || (user?.events?.includes(eventId) ?? false)

  function fmtStat(n) { return n ?? 0 }

  if (loading) return (
    <div className="ed-loading fade-in">
      <div className="ed-spinner"/>
      <span>Loading event…</span>
    </div>
  )
  if (error) return (
    <div className="ed-error fade-in">
      <p>{error}</p>
      <button className="btn btn-ghost" onClick={loadEvent}>Retry</button>
    </div>
  )
  if (!event) return null

  return (
    <div className="ed-page fade-in">
      {/* Breadcrumb */}
      <button className="ed-breadcrumb" onClick={() => navigate('/admin/dashboard/events')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back to Events
      </button>

      {/* Event header */}
      <div className="ed-header">
        <div className="ed-header-left">
          <h1 className="ed-event-name">{event.title || event.name}</h1>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            ID: <span style={{ fontFamily: 'monospace' }}>{event.name}</span>
          </div>
          <div className="ed-header-meta">
            {event.category && <span className="badge badge-accent">{event.category}</span>}
            {event.date && <span className="badge badge-info">{new Date(event.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>}
            {event.venue?.length > 0 && (
              <span style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>
                📍 {Array.isArray(event.venue)?event.venue.join(', '):event.venue}
              </span>
            )}
          </div>
        </div>
        <div className="ed-header-stats">
          {[
            { label: 'Registered', val: fmtStat(event.registered) },
            { label: 'Attended',   val: fmtStat(event.attended),   cls: 'stat-green' },
            { label: 'Submitted',  val: fmtStat(event.submitted),  cls: 'stat-violet' },
            { label: 'Restricted', val: fmtStat(event.restricted), cls: fmtStat(event.restricted)>0?'stat-red':'' },
          ].map(s => (
            <div key={s.label} className="ed-stat">
              <span className={`ed-stat-val ${s.cls||''}`}>{s.val}</span>
              <span className="ed-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="ed-tabs">
        {TABS.map(t => (
          <button key={t} className={`ed-tab-btn ${activeTab===t?'active':''}`} onClick={()=>setActiveTab(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="ed-tab-content">
        {activeTab==='details'      && <EventDetailsTab  event={event} canEdit={canEdit} onSaved={setEvent} />}
        {activeTab==='participants' && <ParticipantsTab  eventId={eventId} eventName={event.name} />}
        {activeTab==='meals'        && <MealsTab         event={event} />}
      </div>
    </div>
  )
}
