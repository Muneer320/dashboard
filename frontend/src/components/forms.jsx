// Ascent — Rating, Feedback, Report Issue
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMobile, NavBar, PageBackground } from './shared';
import { events as eventsApi } from '../lib/api';

export function Rating() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('event_id'); // passed from EventDetail rate button

  const [stars, setStars]     = React.useState(0);
  const [hover, setHover]     = React.useState(0);
  const [feedback, setFeedback] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError]     = React.useState('');

  async function handleSubmit() {
    if (!eventId) { setError('No event selected. Go back and click Rate from an event page.'); return; }
    if (!stars)   { setError('Please pick a star rating first.'); return; }
    setError('');
    setLoading(true);
    try {
      await eventsApi.rating(eventId, { value: stars, feedback: feedback.trim() || null });
      setSuccess(true);
    } catch (e) {
      setError(e.message || 'Submission failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageBackground bgImage="uploads/dashboard_scene.png" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="" />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '40px 28px 80px' }}>
        <div className="eyebrow">§ RATE &amp; REVIEW</div>
        <h1 className="display" style={{ fontSize: isMobile ? 40 : 56, marginTop: 14, letterSpacing: '-0.02em' }}>How was it?</h1>
        <div style={{ marginTop: 10, color: 'var(--ink-dim)', fontSize: 14, maxWidth: 500 }}>
          Rate events after they wrap. Your score feeds into next year's programming.
        </div>

        {/* Active rating card */}
        <div className="glass-strong fade-up" style={{ marginTop: 32, padding: isMobile ? 20 : 32 }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 40 }}>✓</div>
              <div className="display" style={{ fontSize: 28, marginTop: 12 }}>Thanks for the feedback!</div>
              <div style={{ marginTop: 10, color: 'var(--ink-dim)', fontSize: 14 }}>Your rating has been saved.</div>
              <button onClick={() => navigate(-1)} className="btn sm" style={{ marginTop: 20 }}>← Go back</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 16 }}>
                <div>
                  <span className="chip teal">{eventId ? 'SELECTED EVENT' : 'NO EVENT SELECTED'}</span>
                  <div className="display" style={{ fontSize: isMobile ? 26 : 34, marginTop: 12, letterSpacing: '-0.02em' }}>
                    {eventId ? `Event ID: ${eventId.slice(0,8)}…` : 'Pick an event'}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 24, display: 'flex', gap: isMobile ? 6 : 8, flexWrap: 'wrap' }}>
                {[1,2,3,4,5].map(i => {
                  const lit = (hover || stars) >= i;
                  return (
                    <div key={i} onClick={() => setStars(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} style={{
                      width: isMobile ? 44 : 48, height: isMobile ? 44 : 48, display: 'grid', placeItems: 'center',
                      borderRadius: 10,
                      border: lit ? '1px solid rgba(127,119,221,0.5)' : '1px solid var(--glass-border)',
                      background: lit ? 'rgba(127,119,221,0.15)' : 'rgba(255,255,255,0.02)',
                      color: lit ? 'var(--violet)' : 'var(--ink-mute)',
                      fontSize: isMobile ? 20 : 22, cursor: 'pointer', transition: 'all .15s',
                    }}>★</div>
                  );
                })}
              </div>

              <textarea
                className="input" rows={3} style={{ marginTop: 20 }}
                placeholder="Anything specific? (optional)"
                value={feedback} onChange={e => setFeedback(e.target.value)}
              />

              {error && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171' }}>
                  {error}
                </div>
              )}

              <div style={{ marginTop: 20, display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Reviews are public.</div>
                <button onClick={handleSubmit} disabled={loading || !stars} className="btn primary" style={{ width: isMobile ? '100%' : 'auto' }}>
                  {loading ? 'Submitting…' : 'Submit review →'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </PageBackground>
  );
}

export function Feedback() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const sliders = ['Organization', 'Food', 'Events', 'Ambiance', 'Communication'];
  const [vals, setVals] = React.useState(Object.fromEntries(sliders.map(s => [s, 7])));
  return (
    <PageBackground bgImage="uploads/dashboard_scene.png" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="" />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '40px 28px 80px' }}>
        <div className="eyebrow">§ OVERALL FEEDBACK · ANONYMOUS</div>
        <h1 className="display" style={{ fontSize: isMobile ? 40 : 56, marginTop: 14, letterSpacing: '-0.02em' }}>Be honest.</h1>
        <div style={{ marginTop: 10, color: 'var(--ink-dim)', fontSize: 14, maxWidth: 520 }}>
          This form is submitted anonymously. We read every single one before planning next year.
        </div>

        <div className="glass-strong fade-up" style={{ marginTop: 32, padding: isMobile ? 20 : 34 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {sliders.map(s => (
              <div key={s}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label className="label" style={{ margin: 0 }}>{s}</label>
                  <div className="display" style={{ fontSize: 24, color: 'var(--violet)' }}>{vals[s]}<span style={{ color: 'var(--ink-mute)', fontSize: 14 }}>/10</span></div>
                </div>
                <div style={{ position: 'relative', height: 8 }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'rgba(255,255,255,0.06)' }}/>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${vals[s]*10}%`, borderRadius: 999, background: 'linear-gradient(90deg, var(--teal), var(--violet))', boxShadow: '0 0 12px rgba(127,119,221,0.5)' }}/>
                  <input type="range" min="0" max="10" value={vals[s]} onChange={e => setVals(v => ({...v, [s]: +e.target.value}))} style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer',
                  }}/>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>
                  <span>POOR</span><span>EXCELLENT</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 30 }}>
            <label className="label">One thing we should fix next year</label>
            <textarea className="input" rows={3} placeholder="Be specific. Be kind. Be honest." />
          </div>
          <div style={{ marginTop: 18 }}>
            <label className="label">One thing we nailed</label>
            <textarea className="input" rows={3} placeholder="What made the weekend for you?" />
          </div>

          <div style={{ marginTop: 26, display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 16, paddingTop: 20, borderTop: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', flexShrink: 0 }}/> ANONYMOUS · NOT LINKED TO YOU
            </div>
            <button className="btn primary" style={{ width: isMobile ? '100%' : 'auto' }}>Submit feedback →</button>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}

export function Report() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const [cat, setCat] = React.useState('Technical');
  const cats = ['Technical', 'Food', 'Venue', 'Safety', 'Other'];
  const tracked = [
    { id: 'RPT-0421', t: 'Projector not working in Lab 204', s: 'resolved', when: '2h ago' },
    { id: 'RPT-0438', t: 'Charging points broken near auditorium', s: 'in-progress', when: '45m ago' },
    { id: 'RPT-0442', t: 'Water dispenser empty · Block D', s: 'received', when: '12m ago' },
  ];
  const stateColor = { 'resolved': 'var(--teal)', 'in-progress': 'var(--amber)', 'received': 'var(--violet)' };
  return (
    <PageBackground bgImage="uploads/dashboard_scene.png" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="" />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '40px 28px 80px' }}>
        <div className="eyebrow">§ REPORT AN ISSUE</div>
        <h1 className="display" style={{ fontSize: isMobile ? 40 : 56, marginTop: 14, letterSpacing: '-0.02em' }}>Tell ops.</h1>
        <div style={{ marginTop: 10, color: 'var(--ink-dim)', fontSize: 14, maxWidth: 540 }}>
          Something broken, unsafe, or off? Drop it here. Reports route to the ops lead on duty.
        </div>

        <div style={{
          marginTop: 32,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr',
          gap: 24, alignItems: 'start',
        }}>
          {/* Form */}
          <div className="glass-strong" style={{ padding: isMobile ? 20 : 30 }}>
            <label className="label">Category</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {cats.map(c => (
                <div key={c} onClick={() => setCat(c)} className="chip" style={{
                  cursor: 'pointer', padding: '8px 14px', fontSize: 11,
                  background: cat === c ? 'rgba(127,119,221,0.2)' : undefined,
                  borderColor: cat === c ? 'rgba(127,119,221,0.55)' : undefined,
                  color: cat === c ? '#F1EFE8' : undefined,
                }}>{c}</div>
              ))}
            </div>

            <div style={{ marginTop: 22 }}>
              <label className="label">What's going on?</label>
              <textarea className="input" rows={5} placeholder="Describe the issue. Location, severity, who's affected." />
            </div>

            <div style={{ marginTop: 22 }}>
              <label className="label">Attach photo (optional)</label>
              <div style={{
                border: '1.5px dashed var(--glass-border-strong)',
                borderRadius: 10, padding: 24, textAlign: 'center',
                background: 'rgba(255,255,255,0.015)',
              }}>
                <div style={{ fontSize: 22, color: 'var(--ink-dim)' }}>⤴</div>
                <div style={{ fontSize: 12, color: 'var(--ink-dim)', marginTop: 6 }}>Drop image · PNG / JPG · up to 10MB</div>
              </div>
            </div>

            <div style={{ marginTop: 22, display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 12 }}>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>
                AVG RESPONSE · 14 MIN
              </div>
              <button className="btn primary" style={{ width: isMobile ? '100%' : 'auto' }}>Send to organizers →</button>
            </div>
          </div>

          {/* Your tracked reports */}
          <div className="glass" style={{ padding: isMobile ? 16 : 22 }}>
            <div className="eyebrow">§ YOUR REPORTS</div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tracked.map((r, i) => (
                <div key={i} style={{
                  padding: 14, borderRadius: 8,
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(255,255,255,0.02)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>{r.id}</span>
                    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9.5, color: stateColor[r.s], letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      ● {r.s}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink)' }}>{r.t}</div>
                  <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)' }}>{r.when.toUpperCase()}</div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 3 }}>
                    {['received','in-progress','resolved'].map((st, j) => {
                      const reached = ['received','in-progress','resolved'].indexOf(r.s) >= j;
                      return <div key={st} style={{ flex: 1, height: 3, borderRadius: 2, background: reached ? stateColor[st] : 'rgba(255,255,255,0.08)' }}/>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
