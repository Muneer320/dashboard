// Ascent — Explore Events, Schedule, Leaderboard
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobile, NavBar, PageBackground, PosterPlaceholder } from './shared';
import { events as eventsApi, schedule as scheduleApi } from '../lib/api';

// Deterministic tone picker so cards don't reshuffle colours on every render.
const TONES = ['violet', 'teal', 'amber'];
function toneFor(id) {
  const s = String(id ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

export function Explore() {
  const isMobile = useMobile();
  const navigate = useNavigate();

  const [events, setEvents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    eventsApi.list()
      .then((list) => { if (!cancelled) setEvents(list ?? []); })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Failed to load events.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <PageBackground bgImage="uploads/dashboard_scene.png" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="explore" />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '40px 28px 80px' }}>
        <div className="eyebrow">§ ALL EVENTS · {loading ? '—' : String(events.length).padStart(2, '0')}</div>
        <h1 className="display" style={{ fontSize: isMobile ? 40 : 64, marginTop: 14, letterSpacing: '-0.02em' }}>Pick your fights.</h1>
        <div style={{ marginTop: 10, color: 'var(--ink-dim)', fontSize: 14, maxWidth: 540 }}>
          Registrations happen on Unstop. Click through to any event to see rules, prize money, and sign up your team.
        </div>

        {error && (
          <div style={{ marginTop: 24, padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ marginTop: 32, color: 'var(--ink-mute)', fontSize: 13, fontFamily: 'var(--f-mono)' }}>LOADING EVENTS…</div>
        ) : events.length === 0 ? (
          <div style={{ marginTop: 32, color: 'var(--ink-mute)', fontSize: 13 }}>No events scheduled yet. Check back soon.</div>
        ) : (
          <div style={{
            marginTop: 32,
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: 16,
          }}>
            {events.map((ev, i) => {
              const tone = toneFor(ev.id);
              const venue = Array.isArray(ev.venue) && ev.venue.length ? ev.venue[0] : '';
              const teamsCount = ev.participants_count ?? 0;
              return (
                <div
                  key={ev.id}
                  className="glass"
                  style={{ padding: 0, overflow: 'hidden', transition: 'all .3s', cursor: 'pointer' }}
                  onClick={() => navigate(`/event-detail/${ev.id}`)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(127,119,221,0.45)'; e.currentTarget.style.boxShadow = '0 0 30px rgba(127,119,221,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ position: 'relative' }}>
                    <PosterPlaceholder title={(ev.name || '').toUpperCase()} sub="700 × 400" w="100%" h={isMobile ? 140 : 180} tone={tone} />
                  </div>
                  <div style={{ padding: isMobile ? 16 : 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`chip ${tone}`} style={{ padding: '2px 8px', fontSize: 9 }}>
                        {venue ? venue.toUpperCase() : 'EVENT'}
                      </span>
                      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="display" style={{ fontSize: 20, marginTop: 12, letterSpacing: '-0.01em' }}>{ev.name}</div>
                    <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {ev.description || 'No description provided.'}
                    </div>
                    <div style={{ marginTop: 10, fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)' }}>
                      {teamsCount} REGISTERED
                    </div>
                    <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <a
                        className="btn sm"
                        onClick={(e) => { e.stopPropagation(); navigate(`/event-detail/${ev.id}`); }}
                      >Details</a>
                      <a
                        className="btn sm primary"
                        href={`https://unstop.com/search?q=${encodeURIComponent(ev.name || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >Unstop ↗</a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageBackground>
  );
}

// Format "2026-05-16T10:00:00+05:30" → "10:00"
function fmtHHMM(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return ''; }
}

// Format "2026-05-16" → "MAY 16"
function fmtDayLabel(iso) {
  if (!iso) return '';
  try {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString('en-IN', { month: 'short', day: '2-digit' }).toUpperCase();
  } catch { return iso.toUpperCase(); }
}

const DAY_TONES = ['violet', 'teal', 'amber'];

export function Schedule() {
  const isMobile = useMobile();

  const [days, setDays] = React.useState([]); // GlobalScheduleItem[] — each has {id, date, schedule, announcements}
  const [activeDate, setActiveDate] = React.useState(null);
  const [venue, setVenue] = React.useState('All');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    scheduleApi.global()
      .then((list) => {
        if (cancelled) return;
        const sorted = [...(list ?? [])].sort((a, b) => a.date.localeCompare(b.date));
        setDays(sorted);
        // Prefer today if present, else first day
        const today = new Date().toISOString().slice(0, 10);
        const todayDay = sorted.find(d => d.date === today);
        setActiveDate(todayDay ? todayDay.date : (sorted[0]?.date ?? null));
      })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Failed to load schedule.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const activeDay = days.find(d => d.date === activeDate);
  const slots = Array.isArray(activeDay?.schedule) ? activeDay.schedule : [];

  // Derive venue chips from the visible day, plus "All"
  const venues = React.useMemo(() => {
    const set = new Set();
    slots.forEach(s => { if (s.venue) set.add(s.venue); });
    return ['All', ...Array.from(set)];
  }, [slots]);

  // If the active day changes and the current venue filter isn't present, reset.
  React.useEffect(() => {
    if (venue !== 'All' && !venues.includes(venue)) setVenue('All');
  }, [venues]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = venue === 'All' ? slots : slots.filter(s => s.venue === venue);

  // Sort slots by start_time
  const sortedSlots = [...filtered].sort((a, b) =>
    String(a.start_time || '').localeCompare(String(b.start_time || ''))
  );

  return (
    <PageBackground bgImage="uploads/dashboard_scene.png" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="schedule" />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '40px 28px 80px' }}>
        <div className="eyebrow">§ LIVE SCHEDULE</div>
        <h1 className="display" style={{ fontSize: isMobile ? 36 : 64, marginTop: 14, letterSpacing: '-0.02em' }}>Every slot. Every stage.</h1>

        {error && (
          <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 28, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 999, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
            {days.length === 0 && !loading ? (
              <div style={{ padding: '8px 18px', fontSize: 12.5, color: 'var(--ink-mute)' }}>No days scheduled yet.</div>
            ) : days.map((d, i) => (
              <div key={d.date} onClick={() => setActiveDate(d.date)} style={{
                padding: '8px 18px', borderRadius: 999, cursor: 'pointer',
                fontSize: 12.5, fontWeight: 500,
                background: activeDate === d.date ? 'rgba(127,119,221,0.2)' : 'transparent',
                color: activeDate === d.date ? 'var(--ink)' : 'var(--ink-dim)',
                border: activeDate === d.date ? '1px solid rgba(127,119,221,0.5)' : '1px solid transparent',
              }}>
                Day {i + 1}
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, opacity: 0.6, marginLeft: 6 }}>
                  {fmtDayLabel(d.date)}
                </span>
              </div>
            ))}
          </div>
          {venues.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {venues.map(v => (
                <div key={v} onClick={() => setVenue(v)} className="chip" style={{
                  cursor: 'pointer', padding: '6px 12px', fontSize: 10,
                  background: venue === v ? 'rgba(127,119,221,0.18)' : undefined,
                  borderColor: venue === v ? 'rgba(127,119,221,0.55)' : undefined,
                  color: venue === v ? '#F1EFE8' : undefined,
                }}>{v}</div>
              ))}
            </div>
          )}
        </div>

        <div className="glass" style={{ marginTop: 28, padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13, fontFamily: 'var(--f-mono)' }}>LOADING…</div>
          ) : sortedSlots.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
              {days.length === 0 ? 'Schedule hasn\'t been published yet.' : 'Nothing scheduled for this day.'}
            </div>
          ) : sortedSlots.map((s, i) => {
            const tone = DAY_TONES[i % DAY_TONES.length];
            const timeLabel = fmtHHMM(s.start_time) + (s.end_time ? `–${fmtHHMM(s.end_time)}` : '');
            return (
              <div key={`${s.title}-${s.start_time}-${i}`} style={{
                display: isMobile ? 'flex' : 'grid',
                flexDirection: isMobile ? 'column' : undefined,
                gridTemplateColumns: isMobile ? undefined : '140px 1fr 160px',
                gap: isMobile ? 6 : 16,
                padding: isMobile ? '16px' : '18px 24px',
                borderTop: i === 0 ? 'none' : '1px solid var(--glass-border)',
                transition: 'background .2s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {isMobile ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontFamily: 'var(--f-mono)', fontSize: 16, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{fmtHHMM(s.start_time)}</div>
                      {s.venue && <span className={`chip ${tone}`} style={{ padding: '2px 8px', fontSize: 9 }}>{s.venue}</span>}
                    </div>
                    <div style={{ fontFamily: 'var(--f-display)', fontSize: 15, fontWeight: 600 }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)' }}>{fmtDayLabel(activeDate)} · {timeLabel}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontFamily: 'var(--f-mono)', fontSize: 18, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{timeLabel}</div>
                    <div>
                      <div style={{ fontFamily: 'var(--f-display)', fontSize: 18, fontWeight: 600 }}>{s.title}</div>
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)' }}>{fmtDayLabel(activeDate)}{s.venue ? ` · ${s.venue}` : ''}</div>
                    </div>
                    {s.venue ? (
                      <span className={`chip ${tone}`} style={{ padding: '3px 10px', fontSize: 9.5 }}>{s.venue}</span>
                    ) : <span />}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </PageBackground>
  );
}

export function Leaderboard() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const [tab, setTab] = React.useState('college');
  const colleges = [
    { r: 1, n: 'IIIT Bangalore', p: 1840, d: 'up' },
    { r: 2, n: 'BITS Pilani', p: 1720, d: 'up' },
    { r: 3, n: 'NIT Trichy', p: 1680, d: 'same' },
    { r: 4, n: 'IIT Madras', p: 1540, d: 'down' },
    { r: 5, n: 'VIT Vellore', p: 1490, d: 'up', mine: true },
    { r: 6, n: 'Manipal Institute', p: 1370, d: 'up' },
    { r: 7, n: 'PES University', p: 1290, d: 'down' },
    { r: 8, n: 'IIT Bombay', p: 1220, d: 'same' },
    { r: 9, n: 'DTU Delhi', p: 1180, d: 'up' },
    { r: 10, n: 'VNIT Nagpur', p: 1090, d: 'down' },
  ];
  const people = [
    { r: 1, n: 'Kabir Nair', c: 'IIIT Bangalore', p: 420 },
    { r: 2, n: 'Simran Shah', c: 'BITS Pilani', p: 395 },
    { r: 3, n: 'Aditi Sen', c: 'NIT Trichy', p: 380 },
    { r: 4, n: 'Rohan Das', c: 'IIT Madras', p: 360 },
    { r: 47, n: 'Aarav Rao', c: 'VIT Vellore', p: 185, mine: true },
  ];
  return (
    <PageBackground bgImage="uploads/dashboard_scene.png" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="leaderboard" />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '40px 28px 80px' }}>
        <div className="eyebrow">§ STANDINGS · LIVE</div>
        <h1 className="display" style={{ fontSize: isMobile ? 40 : 64, marginTop: 14, letterSpacing: '-0.02em' }}>The climb.</h1>

        <div style={{ marginTop: 28, display: 'flex', gap: 6, padding: 4, borderRadius: 999, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', width: 'fit-content' }}>
          {[['college','Colleges'],['global','Individuals']].map(([k,l]) => (
            <div key={k} onClick={() => setTab(k)} style={{
              padding: '8px 18px', borderRadius: 999, cursor: 'pointer',
              fontSize: 12.5, fontWeight: 500,
              background: tab === k ? 'rgba(127,119,221,0.2)' : 'transparent',
              color: tab === k ? 'var(--ink)' : 'var(--ink-dim)',
              border: tab === k ? '1px solid rgba(127,119,221,0.5)' : '1px solid transparent',
            }}>{l}</div>
          ))}
        </div>

        {/* Podium */}
        <div style={{
          marginTop: 32,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1.2fr 1fr' : '1fr 1.2fr 1fr',
          gap: isMobile ? 8 : 14,
          alignItems: 'end',
        }}>
          {[
            { r: 2, d: tab === 'college' ? colleges[1] : people[1], h: isMobile ? 110 : 180 },
            { r: 1, d: tab === 'college' ? colleges[0] : people[0], h: isMobile ? 140 : 230 },
            { r: 3, d: tab === 'college' ? colleges[2] : people[2], h: isMobile ? 90 : 150 },
          ].map((s, i) => (
            <div key={i} className="glass-strong" style={{
              height: s.h, padding: isMobile ? 12 : 22, position: 'relative', overflow: 'hidden',
              background: s.r === 1 ? 'linear-gradient(180deg, rgba(232,185,116,0.18), rgba(232,185,116,0.04))' : undefined,
              borderColor: s.r === 1 ? 'rgba(232,185,116,0.4)' : undefined,
            }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: s.r === 1 ? 'radial-gradient(closest-side, rgba(232,185,116,0.3), transparent 70%)' : 'radial-gradient(closest-side, rgba(127,119,221,0.18), transparent 70%)' }}/>
              <div style={{ position: 'relative' }}>
                <div className="display" style={{ fontSize: isMobile ? (s.r === 1 ? 44 : 36) : (s.r === 1 ? 86 : 68), letterSpacing: '-0.04em', color: s.r === 1 ? 'var(--amber)' : 'var(--ink)', lineHeight: 1 }}>#{s.r}</div>
                <div style={{ marginTop: 6, fontFamily: 'var(--f-display)', fontSize: isMobile ? 12 : 18, fontWeight: 600 }}>{s.d.n}</div>
                <div style={{ marginTop: 2, fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)' }}>{s.d.p} PTS</div>
              </div>
            </div>
          ))}
        </div>

        {/* Full list */}
        <div className="glass" style={{ marginTop: 20, padding: 0, overflow: 'hidden' }}>
          {(tab === 'college' ? colleges : people).map((row, i) => {
            const dirColor = row.d === 'up' ? 'var(--teal)' : row.d === 'down' ? '#D97777' : 'var(--ink-mute)';
            const dirSym = row.d === 'up' ? '↑' : row.d === 'down' ? '↓' : '—';
            return (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '48px 1fr auto' : '80px 1fr 120px 80px',
                alignItems: 'center', gap: isMobile ? 10 : 20,
                padding: isMobile ? '14px 16px' : '16px 24px',
                borderTop: i === 0 ? 'none' : '1px solid var(--glass-border)',
                background: row.mine ? 'rgba(127,119,221,0.1)' : 'transparent',
                borderLeft: row.mine ? '2px solid var(--violet)' : '2px solid transparent',
              }}>
                <div className="display" style={{ fontSize: isMobile ? 18 : 24, color: row.r <= 3 ? 'var(--amber)' : 'var(--ink-dim)' }}>#{row.r}</div>
                <div>
                  <div style={{ fontFamily: 'var(--f-display)', fontSize: isMobile ? 14 : 16, fontWeight: 600 }}>
                    {row.n} {row.mine && <span className="chip violet" style={{ padding: '1px 6px', fontSize: 9, marginLeft: 6 }}>YOU</span>}
                  </div>
                  {row.c && <div style={{ fontSize: 10, color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)' }}>{row.c}</div>}
                </div>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: isMobile ? 12 : 14, color: 'var(--ink)' }}>
                  {row.p} pts
                  {isMobile && row.d && <span style={{ marginLeft: 6, color: dirColor }}>{dirSym}</span>}
                </div>
                {!isMobile && row.d && <div style={{ fontFamily: 'var(--f-mono)', fontSize: 13, color: dirColor }}>{dirSym}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </PageBackground>
  );
}
