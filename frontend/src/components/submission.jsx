/**
 * submission.jsx — Question-based submission form
 *
 * Renders the per-phase submission form for EventDetail.
 * Supports all 8 question types defined in backend/app/schemas/question.py:
 *   text, text-long, url, mcq, multi-choice, numeric, email, declaration
 *
 * Props
 * ─────
 * eventId      string    UUID of the event
 * phase        number    Phase number (1, 2, …)
 * phaseData    object    Round data from event.rounds.phaseN
 *                        { is_active, is_locked, title, start_time, end_time, … }
 * isRegistered bool      Whether the current user is registered for the event
 * isRestricted bool      Whether the user is restricted
 * onSuccess    fn?       Called after a successful submission
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { events as eventsApi } from '../lib/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return iso; }
}

function wordCount(str) {
  return str.trim() ? str.trim().split(/\s+/).length : 0;
}

/** Debounced word-count display helper */
function WordCounter({ value, limit }) {
  const count = wordCount(value);
  const over = limit != null && count > limit;
  return (
    <div style={{
      marginTop: 4, textAlign: 'right',
      fontFamily: 'var(--f-mono)', fontSize: 10,
      color: over ? '#f87171' : 'var(--ink-mute)',
      letterSpacing: '0.08em',
    }}>
      {count}{limit != null ? ` / ${limit} words` : ' words'}
    </div>
  );
}

/** Sanitise free-text: trim, collapse multiple spaces */
function sanitiseText(raw) {
  return raw.replace(/\s+/g, ' ').trim();
}

/** Client-side URL validation */
function isValidUrl(str) {
  if (!str.trim()) return true; // empty OK for optional
  return /^https?:\/\//i.test(str.trim());
}

/** Client-side email validation */
function isValidEmail(str) {
  if (!str.trim()) return true; // empty OK for optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
}

// ─── Input components per type ────────────────────────────────────────────────

/** text / text-long */
function TextInput({ q, value, onChange, disabled }) {
  const isLong = q.question_type === 'text-long';
  const limit = q.word_limit ?? (isLong ? 500 : null);
  const count = wordCount(value);
  const over = limit != null && count > limit;
  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${over ? 'rgba(248,113,113,0.5)' : 'var(--glass-border)'}`,
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--ink)',
    fontSize: 13.5,
    fontFamily: 'var(--f-body)',
    outline: 'none',
    resize: isLong ? 'vertical' : 'none',
    minHeight: isLong ? 100 : undefined,
    boxSizing: 'border-box',
    transition: 'border-color .2s',
    opacity: disabled ? 0.5 : 1,
  };
  return (
    <div>
      {isLong ? (
        <textarea
          style={inputStyle}
          rows={4}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          placeholder={q.question_type === 'text-long' ? 'Type your answer here…' : 'Short answer…'}
        />
      ) : (
        <input
          type="text"
          style={inputStyle}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Short answer…"
        />
      )}
      {limit != null && (
        <WordCounter value={value} limit={limit} />
      )}
      {over && (
        <div style={{ marginTop: 4, fontSize: 11, color: '#f87171', fontFamily: 'var(--f-mono)' }}>
          {count - limit} word{count - limit !== 1 ? 's' : ''} over limit
        </div>
      )}
    </div>
  );
}

/** url */
function UrlInput({ q, value, onChange, disabled }) {
  const invalid = value.trim() && !isValidUrl(value);
  return (
    <div>
      <input
        type="url"
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 8,
          border: `1px solid ${invalid ? 'rgba(248,113,113,0.5)' : 'var(--glass-border)'}`,
          background: 'rgba(255,255,255,0.04)',
          color: 'var(--ink)', fontSize: 13.5, fontFamily: 'var(--f-mono)',
          outline: 'none', boxSizing: 'border-box', transition: 'border-color .2s',
          opacity: disabled ? 0.5 : 1,
        }}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder="https://…"
      />
      {invalid && (
        <div style={{ marginTop: 4, fontSize: 11, color: '#f87171', fontFamily: 'var(--f-mono)' }}>
          Must start with http:// or https://
        </div>
      )}
    </div>
  );
}

/** email */
function EmailInput({ q, value, onChange, disabled }) {
  const invalid = value.trim() && !isValidEmail(value);
  return (
    <div>
      <input
        type="email"
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 8,
          border: `1px solid ${invalid ? 'rgba(248,113,113,0.5)' : 'var(--glass-border)'}`,
          background: 'rgba(255,255,255,0.04)',
          color: 'var(--ink)', fontSize: 13.5, fontFamily: 'var(--f-mono)',
          outline: 'none', boxSizing: 'border-box', transition: 'border-color .2s',
          opacity: disabled ? 0.5 : 1,
        }}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder="you@example.com"
      />
      {invalid && (
        <div style={{ marginTop: 4, fontSize: 11, color: '#f87171', fontFamily: 'var(--f-mono)' }}>
          Enter a valid email address
        </div>
      )}
    </div>
  );
}

/** numeric */
function NumericInput({ q, value, onChange, disabled }) {
  return (
    <input
      type="number"
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 8,
        border: '1px solid var(--glass-border)',
        background: 'rgba(255,255,255,0.04)',
        color: 'var(--ink)', fontSize: 13.5, fontFamily: 'var(--f-mono)',
        outline: 'none', boxSizing: 'border-box',
        opacity: disabled ? 0.5 : 1,
      }}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder="0"
    />
  );
}

/** mcq — single choice */
function McqInput({ q, value, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {(q.options || []).map(opt => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(selected ? '' : opt)}
            style={{
              padding: '7px 16px',
              borderRadius: 999,
              border: selected
                ? '1px solid rgba(127,119,221,0.7)'
                : '1px solid var(--glass-border)',
              background: selected
                ? 'rgba(127,119,221,0.2)'
                : 'rgba(255,255,255,0.03)',
              color: selected ? '#C6C2F5' : 'var(--ink-dim)',
              fontFamily: 'var(--f-body)', fontSize: 12.5,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all .15s',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/** multi-choice — multiple selections */
function MultiChoiceInput({ q, value, onChange, disabled }) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {(q.options || []).map(opt => {
        const isSelected = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => toggle(opt)}
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              border: isSelected
                ? '1px solid rgba(29,158,117,0.7)'
                : '1px solid var(--glass-border)',
              background: isSelected
                ? 'rgba(29,158,117,0.15)'
                : 'rgba(255,255,255,0.03)',
              color: isSelected ? '#8AE3C2' : 'var(--ink-dim)',
              fontFamily: 'var(--f-body)', fontSize: 12.5,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all .15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{
              width: 14, height: 14, borderRadius: 3,
              border: `1.5px solid ${isSelected ? 'rgba(29,158,117,0.8)' : 'rgba(255,255,255,0.25)'}`,
              background: isSelected ? 'rgba(29,158,117,0.4)' : 'transparent',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, flexShrink: 0,
            }}>
              {isSelected && '✓'}
            </span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/** declaration — must acknowledge all */
function DeclarationInput({ q, value, onChange, disabled }) {
  const acknowledged = Array.isArray(value) ? value : [];
  const toggle = (decl) => {
    if (acknowledged.includes(decl)) {
      onChange(acknowledged.filter(d => d !== decl));
    } else {
      onChange([...acknowledged, decl]);
    }
  };
  const allAcknowledged = (q.declarations || []).every(d => acknowledged.includes(d));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(q.declarations || []).map((decl, i) => {
        const isChecked = acknowledged.includes(decl);
        return (
          <div
            key={i}
            onClick={() => !disabled && toggle(decl)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '10px 14px', borderRadius: 8,
              border: `1px solid ${isChecked ? 'rgba(232,185,116,0.4)' : 'var(--glass-border)'}`,
              background: isChecked ? 'rgba(232,185,116,0.06)' : 'rgba(255,255,255,0.02)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all .15s',
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
              border: `1.5px solid ${isChecked ? 'rgba(232,185,116,0.8)' : 'rgba(255,255,255,0.25)'}`,
              background: isChecked ? 'rgba(232,185,116,0.3)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: 'var(--amber)',
            }}>
              {isChecked && '✓'}
            </div>
            <span style={{ fontSize: 13, color: isChecked ? 'var(--ink)' : 'var(--ink-dim)', lineHeight: 1.5 }}>
              {decl}
            </span>
          </div>
        );
      })}
      {!allAcknowledged && q.required && (
        <div style={{ fontSize: 11, color: 'rgba(232,185,116,0.8)', fontFamily: 'var(--f-mono)', marginTop: 2 }}>
          All declarations must be acknowledged
        </div>
      )}
    </div>
  );
}

/** Route each question type to the right input */
function QuestionInput({ q, value, onChange, disabled }) {
  switch (q.question_type) {
    case 'text':
    case 'text-long':
      return <TextInput q={q} value={value ?? ''} onChange={onChange} disabled={disabled} />;
    case 'url':
      return <UrlInput q={q} value={value ?? ''} onChange={onChange} disabled={disabled} />;
    case 'email':
      return <EmailInput q={q} value={value ?? ''} onChange={onChange} disabled={disabled} />;
    case 'numeric':
      return <NumericInput q={q} value={value ?? ''} onChange={onChange} disabled={disabled} />;
    case 'mcq':
      return <McqInput q={q} value={value ?? ''} onChange={onChange} disabled={disabled} />;
    case 'multi-choice':
      return <MultiChoiceInput q={q} value={value ?? []} onChange={onChange} disabled={disabled} />;
    case 'declaration':
      return <DeclarationInput q={q} value={value ?? []} onChange={onChange} disabled={disabled} />;
    default:
      return <TextInput q={q} value={value ?? ''} onChange={onChange} disabled={disabled} />;
  }
}

// ─── Phase timing helpers ─────────────────────────────────────────────────────

/**
 * Determine the exact submission-window state from round data.
 * Returns one of: 'not-registered' | 'restricted' | 'no-phase' |
 *                 'upcoming' | 'open' | 'locked' | 'closed'
 */
export function getSubmissionState({ phaseData, isRegistered, isRestricted, isNoPhase }) {
  if (!isRegistered)  return 'not-registered';
  if (isRestricted)   return 'restricted';
  if (isNoPhase || !phaseData) return 'no-phase';

  const { is_active, is_locked } = phaseData;

  if (is_locked)  return 'locked';
  if (!is_active) return 'upcoming';
  return 'open';
}

/** Human-readable status banner props */
const STATUS_META = {
  'not-registered': { color: 'var(--amber)', bg: 'rgba(232,185,116,0.08)', icon: '🔒', text: 'Register for this event to submit.' },
  'restricted':     { color: '#f87171',      bg: 'rgba(248,113,113,0.08)', icon: '⛔', text: 'Your account is restricted from this event.' },
  'no-phase':       { color: 'var(--ink-mute)', bg: 'rgba(255,255,255,0.03)', icon: 'ℹ', text: 'No submission phase is configured for this round.' },
  'upcoming':       { color: 'var(--violet)', bg: 'rgba(127,119,221,0.08)', icon: '⏳', text: 'Submission window has not opened yet.' },
  'locked':         { color: 'var(--ink-mute)', bg: 'rgba(255,255,255,0.04)', icon: '🔐', text: 'This phase has been locked by organizers.' },
  'closed':         { color: 'var(--ink-mute)', bg: 'rgba(255,255,255,0.04)', icon: '✓', text: 'Phase has ended.' },
  'open':           null,  // no banner — form is shown
};

// ─── Status Banner ────────────────────────────────────────────────────────────

function StatusBanner({ state }) {
  const meta = STATUS_META[state];
  if (!meta) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px', borderRadius: 8,
      border: `1px solid ${meta.color}33`,
      background: meta.bg,
      marginBottom: 16,
    }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{meta.icon}</span>
      <span style={{ fontSize: 12.5, color: meta.color, lineHeight: 1.5 }}>{meta.text}</span>
    </div>
  );
}

// ─── Existing submission display ──────────────────────────────────────────────

function ExistingSubmission({ submission, questions, onEdit }) {
  if (!submission?.has_submission) return null;
  const answerMap = {};
  (submission.answers || []).forEach(a => { answerMap[a.question_id] = a.answer; });

  const formatAnswer = (q, raw) => {
    if (raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0)) return '—';
    if (Array.isArray(raw)) return raw.join(', ');
    return String(raw);
  };

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 10,
      border: '1px solid rgba(29,158,117,0.35)',
      background: 'rgba(29,158,117,0.06)',
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, color: 'var(--teal)' }}>✓</span>
          <div>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>Submission recorded</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)', marginTop: 2 }}>
              {fmtDateTime(submission.submitted_at)}
            </div>
          </div>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="btn sm ghost"
            style={{ fontSize: 11 }}
          >
            Edit ↺
          </button>
        )}
      </div>

      {questions && questions.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {questions.map((q) => {
            const raw = answerMap[q.question_id];
            return (
              <div key={q.question_id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                <div style={{
                  fontFamily: 'var(--f-mono)', fontSize: 9.5, color: 'var(--ink-mute)',
                  letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4,
                }}>
                  {q.question_text}
                </div>
                <div style={{
                  fontSize: 12.5, color: raw != null && raw !== '' ? 'var(--ink)' : 'var(--ink-mute)',
                  fontFamily: q.question_type === 'url' || q.question_type === 'email' ? 'var(--f-mono)' : 'var(--f-body)',
                  wordBreak: 'break-word',
                }}>
                  {q.question_type === 'url' && raw ? (
                    <a href={raw} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--violet)', textDecoration: 'underline' }}>
                      {raw}
                    </a>
                  ) : (
                    formatAnswer(q, raw)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main SubmissionPanel component ──────────────────────────────────────────

export function SubmissionPanel({ eventId, phase, phaseData, isRegistered, isRestricted, onSuccess }) {
  const isNoPhase = !phaseData;

  const submissionState = getSubmissionState({ phaseData, isRegistered, isRestricted: !!isRestricted, isNoPhase });
  const canSubmit = submissionState === 'open';

  // Questions fetched from API
  const [questions, setQuestions]     = useState(null);  // null = loading, [] = no questions
  const [questionsErr, setQuestionsErr] = useState(null);
  const [loadingQ, setLoadingQ]       = useState(false);

  // Existing submission from API
  const [existing, setExisting]       = useState(null);
  const [loadingEx, setLoadingEx]     = useState(false);

  // Form state: map of question_id → current answer value
  const [answers, setAnswers]         = useState({});

  // Edit mode: when true, show form even if submission exists
  const [editMode, setEditMode]       = useState(false);

  // Submission
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  // ── Load questions ──────────────────────────────────────────────────────────
  const loadQuestions = useCallback(async () => {
    if (!isRegistered || !phaseData || !eventId) return;
    setLoadingQ(true);
    setQuestionsErr(null);
    try {
      const res = await eventsApi.questions(eventId, phase);
      setQuestions(res.questions ?? []);
    } catch (err) {
      // 404 = no questions defined for this phase
      if (err.status === 404) {
        setQuestions([]);
      } else {
        setQuestionsErr(err.message || 'Failed to load questions.');
      }
    } finally {
      setLoadingQ(false);
    }
  }, [eventId, phase, isRegistered, phaseData]);

  // ── Load existing submission ────────────────────────────────────────────────
  const loadExisting = useCallback(async () => {
    if (!isRegistered || !eventId) return;
    setLoadingEx(true);
    try {
      const res = await eventsApi.submission(eventId, phase);
      setExisting(res);
      // Pre-fill answers with existing submission
      if (res.has_submission && res.answers) {
        const prefill = {};
        res.answers.forEach(a => { prefill[a.question_id] = a.answer; });
        setAnswers(prefill);
      }
    } catch {
      // If not registered / no submission, just ignore
      setExisting(null);
    } finally {
      setLoadingEx(false);
    }
  }, [eventId, phase, isRegistered]);

  useEffect(() => {
    if (isRegistered && phaseData) {
      loadQuestions();
      loadExisting();
    }
  }, [loadQuestions, loadExisting, isRegistered, phaseData]);

  // ── Client-side validation before submit ───────────────────────────────────
  function validate() {
    if (!questions) return null;
    for (const q of questions) {
      const val = answers[q.question_id];
      const isEmpty = val === undefined || val === null || val === '' ||
        (Array.isArray(val) && val.length === 0);

      if (q.required && isEmpty) {
        return `"${q.question_text}" is required.`;
      }

      if (q.question_type === 'url' && val && !isValidUrl(val)) {
        return `"${q.question_text}": URL must start with http:// or https://.`;
      }

      if (q.question_type === 'email' && val && !isValidEmail(val)) {
        return `"${q.question_text}": Enter a valid email address.`;
      }

      const wLimit = q.word_limit ?? (q.question_type === 'text-long' ? 500 : null);
      if (wLimit != null && val && wordCount(val) > wLimit) {
        return `"${q.question_text}": Answer exceeds ${wLimit} word limit.`;
      }

      if (q.question_type === 'declaration' && q.required) {
        const acked = Array.isArray(val) ? val : [];
        const missing = (q.declarations || []).filter(d => !acked.includes(d));
        if (missing.length > 0) {
          return `"${q.question_text}": All declarations must be acknowledged.`;
        }
      }
    }
    return null;
  }

  // ── Build answers payload ───────────────────────────────────────────────────
  function buildPayload() {
    return (questions || []).map(q => {
      let raw = answers[q.question_id];

      // Sanitise text types
      if (q.question_type === 'text' || q.question_type === 'text-long') {
        raw = sanitiseText(String(raw ?? ''));
      }
      if (q.question_type === 'url' || q.question_type === 'email') {
        raw = String(raw ?? '').trim();
      }
      if (q.question_type === 'numeric') {
        raw = raw === '' || raw == null ? null : parseInt(raw, 10);
      }
      if (!Array.isArray(raw) && (q.question_type === 'multi-choice' || q.question_type === 'declaration')) {
        raw = raw ?? [];
      }

      return { question_id: q.question_id, answer: raw };
    }).filter(a => a.answer !== null && a.answer !== undefined);
  }

  // ── Submit handler ──────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const res = await eventsApi.submit(eventId, {
        phase,
        answers: buildPayload(),
      });
      setSubmitSuccess(res);
      setEditMode(false);
      // Refresh the existing submission display
      await loadExisting();
      onSuccess?.(res);
    } catch (err) {
      // Parse structured error from backend
      let msg = err.message || 'Submission failed.';
      if (err.data?.detail) {
        msg = typeof err.data.detail === 'string'
          ? err.data.detail
          : JSON.stringify(err.data.detail);
      }
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  const loading = loadingQ || loadingEx;

  // ── Decide what to render ───────────────────────────────────────────────────
  const showExisting = existing?.has_submission && !editMode;
  const showForm = canSubmit && !showExisting;
  const showReadonlyForm = !canSubmit && existing?.has_submission && !editMode;

  return (
    <div>
      {/* ─ Status banner (not-registered / restricted / upcoming / locked) ─ */}
      <StatusBanner state={submissionState} />

      {/* ─ Loading ─ */}
      {loading && isRegistered && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: 'var(--ink-mute)', fontSize: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Loading submission…
        </div>
      )}

      {/* ─ Questions fetch error ─ */}
      {questionsErr && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', fontSize: 12.5, color: '#f87171', marginBottom: 14 }}>
          {questionsErr}
        </div>
      )}

      {/* ─ No questions configured ─ */}
      {!loading && isRegistered && phaseData && questions?.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', textAlign: 'center', padding: '16px 0', fontFamily: 'var(--f-mono)' }}>
          No questions defined for this phase yet.
        </div>
      )}

      {/* ─ Existing submission (readonly view) ─ */}
      {!loading && (showExisting || showReadonlyForm) && (
        <ExistingSubmission
          submission={existing}
          questions={questions}
          onEdit={canSubmit ? () => setEditMode(true) : null}
        />
      )}

      {/* ─ Active submission form ─ */}
      {!loading && (showForm || (editMode && canSubmit)) && questions && questions.length > 0 && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Edit mode notice */}
          {editMode && existing?.has_submission && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 7, background: 'rgba(127,119,221,0.08)', border: '1px solid rgba(127,119,221,0.2)', fontSize: 12 }}>
              <span style={{ color: 'var(--violet)' }}>Editing previous submission — changes will overwrite.</span>
              <button type="button" onClick={() => setEditMode(false)} style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
          )}

          {/* Questions */}
          {questions.map((q, idx) => (
            <div key={q.question_id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                <label style={{
                  fontSize: 13, color: 'var(--ink)', fontWeight: 500, lineHeight: 1.4,
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                }}>
                  <span style={{
                    fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)',
                    borderRadius: 4, padding: '1px 5px', flexShrink: 0, marginTop: 2,
                  }}>
                    {idx + 1}
                  </span>
                  {q.question_text}
                  {q.required && (
                    <span style={{ color: '#f87171', fontSize: 12, flexShrink: 0 }}>*</span>
                  )}
                </label>
                <span style={{
                  fontFamily: 'var(--f-mono)', fontSize: 9, color: 'var(--ink-mute)',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)',
                  borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {q.question_type}
                </span>
              </div>
              <QuestionInput
                q={q}
                value={answers[q.question_id]}
                onChange={v => setAnswers(prev => ({ ...prev, [q.question_id]: v }))}
                disabled={submitting}
              />
            </div>
          ))}

          {/* Validation / server error */}
          {submitError && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.3)',
              fontSize: 12.5, color: '#f87171', lineHeight: 1.5,
            }}>
              {submitError}
            </div>
          )}

          {/* Success flash */}
          {submitSuccess && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(29,158,117,0.08)',
              border: '1px solid rgba(29,158,117,0.3)',
              fontSize: 12.5, color: '#8AE3C2',
            }}>
              ✓ Submission recorded at {fmtDateTime(submitSuccess.submitted_at)}
            </div>
          )}

          {/* Submit button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn sm primary"
              disabled={submitting || !!questionsErr}
              style={{ minWidth: 120 }}
            >
              {submitting
                ? 'Submitting…'
                : existing?.has_submission
                  ? 'Resubmit ↺'
                  : 'Submit ⤴'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
