// Ascent — Dashboard + Event Detail (fully wired to backend)
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMobile, NavBar, PageBackground, QRCode, PosterPlaceholder } from './shared';
import { useUserAuth } from '../lib/UserAuthContext';
import { users, events as eventsApi, schedule as scheduleApi, announcements as annApi } from '../lib/api';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return iso; }
}

function relTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 32, color: 'var(--ink-mute)' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        style={{ animation: 'spin 1s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────
export function Dashboard() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const { user } = useUserAuth();

  const [profile,  setProfile]  = useState(null);
  const [myEvents, setMyEvents] = useState([]);   // [ { eventId, eventData, entry } ]
  const [meals,    setMeals]    = useState([]);   // MealSlot[]
  const [schedule, setSchedule] = useState([]);   // ScheduleItem[] for today
  const [anns,     setAnns]     = useState([]);   // Announcement[]
  const [loading,  setLoading]  = useState(true);

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Run all fetches in parallel
      const [profileData, eventsData, mealsData, scheduleData, annsData] = await Promise.allSettled([
        users.get(user.id),
        eventsApi.list(),
        users.meals(user.id),
        scheduleApi.byDate(today).catch(() => null),   // 404 if no schedule today → null
        annApi.list(6),
      ]);

      if (profileData.status === 'fulfilled') setProfile(profileData.value);
      if (mealsData.status    === 'fulfilled') setMeals(mealsData.value ?? []);
      if (annsData.status     === 'fulfilled') {
        const list = annsData.value ?? [];
        setAnns([...list].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)));
      }

      // Cross-reference registered events
      if (profileData.status === 'fulfilled' && eventsData.status === 'fulfilled') {
        const prof = profileData.value;
        const registered = prof.events || {};   // { eventId: { isAttending, submitted, ... } }
        const allEvents  = eventsData.value ?? [];
        const mine = allEvents
          .filter(ev => registered[ev.id])
          .map(ev => ({ eventId: ev.id, eventData: ev, entry: registered[ev.id] }));
        setMyEvents(mine);
      }

      // Today's schedule — extract items
      if (scheduleData.status === 'fulfilled' && scheduleData.value) {
        setSchedule(scheduleData.value.schedule ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [user, today]);

  useEffect(() => { load(); }, [load]);

  const displayName = profile?.name ?? user?.name ?? '…';
  const userId = user?.id ?? '';
  const qrSeed = `ASCENT-${userId.slice(0, 8).toUpperCase()}`;

  return (
    <PageBackground bgImage="uploads/dashboard_scene.png" blurAmount={16} dimAmount={0.78}>
      <NavBar variant="app" active="dashboard" />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '40px 28px 80px' }}>

        {/* Welcome header */}
        <div className="fade-up" style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'flex-end',
          gap: isMobile ? 16 : 0,
        }}>
          <div>
            <div className="eyebrow">// {today} · {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST</div>
            <h1 className="display" style={{ fontSize: isMobile ? 36 : 52, marginTop: 14, letterSpacing: '-0.02em' }}>
              {greeting()}, <span style={{ color: 'var(--violet)' }}>{displayName.split(' ')[0]}</span>.
            </h1>
            <div style={{ marginTop: 10, color: 'var(--ink-dim)', fontSize: 14 }}>
              You have <span style={{ color: 'var(--ink)' }}>{myEvents.length} event{myEvents.length !== 1 ? 's' : ''}</span> registered.
              {schedule.length > 0 && ` First up: ${schedule[0].title}, ${fmtTime(schedule[0].start_time)} at ${schedule[0].venue}.`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a className="chip teal"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)' }}/> All systems go</a>
            <a onClick={() => navigate('/report')} className="btn ghost sm">Report issue</a>
          </div>
        </div>

        {loading ? <Spinner /> : (
          <div style={{
            marginTop: 36,
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.35fr 1fr',
            gap: 20,
          }}>
            {/* LEFT column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Registered events */}
              <div className="glass" style={{ padding: isMobile ? 18 : 26 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="eyebrow">§ REGISTERED EVENTS</div>
                  <a onClick={() => navigate('/explore')} style={{ fontSize: 11, color: 'var(--violet)', cursor: 'pointer', fontFamily: 'var(--f-mono)', letterSpacing: '0.1em' }}>BROWSE →</a>
                </div>
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {myEvents.length === 0 ? (
                    <div style={{ color: 'var(--ink-mute)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                      No events registered yet. <a onClick={() => navigate('/explore')} style={{ color: 'var(--violet)', cursor: 'pointer' }}>Browse events →</a>
                    </div>
                  ) : myEvents.map((ev) => {
                    const tones = ['violet', 'teal', 'amber'];
                    const tone = tones[myEvents.indexOf(ev) % tones.length];
                    const venue = Array.isArray(ev.eventData.venue) ? ev.eventData.venue.join(' · ') : (ev.eventData.venue || '');
                    const isLive = ev.entry?.isAttending;
                    return (
                      <div key={ev.eventId}
                        onClick={() => navigate(`/event-detail/${ev.eventId}`)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '44px 1fr' : '52px 1fr auto',
                          alignItems: 'center', gap: 12,
                          padding: 14, borderRadius: 10,
                          border: '1px solid var(--glass-border)',
                          background: 'rgba(255,255,255,0.02)',
                          cursor: 'pointer', transition: 'all .2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(127,119,221,0.35)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}
                      >
                        <div style={{
                          width: isMobile ? 44 : 52, height: isMobile ? 44 : 52, borderRadius: 8,
                          background: `linear-gradient(135deg, rgba(127,119,221,0.3), rgba(29,158,117,0.1))`,
                          border: '1px solid rgba(255,255,255,0.08)',
                          display: 'grid', placeItems: 'center',
                          fontFamily: 'var(--f-display)', fontSize: 18, fontWeight: 700,
                        }}>{ev.eventData.name[0]}</div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--f-display)', fontSize: 15, fontWeight: 600 }}>{ev.eventData.name}</span>
                          </div>
                          <div style={{ marginTop: 4, color: 'var(--ink-mute)', fontSize: 11, fontFamily: 'var(--f-mono)' }}>{venue}</div>
                          {isMobile && (
                            <div style={{ marginTop: 4, fontFamily: 'var(--f-mono)', fontSize: 11, color: isLive ? 'var(--violet)' : 'var(--ink-dim)' }}>
                              {isLive ? 'Attending' : ev.entry?.submitted ? 'Submitted' : 'Registered'}
                            </div>
                          )}
                        </div>
                        {!isMobile && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: isLive ? 'var(--violet)' : 'var(--ink-dim)', letterSpacing: '0.08em' }}>
                              {isLive ? 'Attending' : ev.entry?.submitted ? 'Submitted' : 'Registered'}
                            </div>
                            <div style={{ marginTop: 4, fontSize: 18, color: 'var(--ink-mute)' }}>→</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Schedule snapshot */}
              <div className="glass" style={{ padding: isMobile ? 18 : 26 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="eyebrow">§ TODAY'S TIMELINE</div>
                  <a onClick={() => navigate('/schedule')} style={{ fontSize: 11, color: 'var(--violet)', cursor: 'pointer', fontFamily: 'var(--f-mono)', letterSpacing: '0.1em' }}>FULL →</a>
                </div>
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column' }}>
                  {schedule.length === 0 ? (
                    <div style={{ color: 'var(--ink-mute)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No schedule published for today.</div>
                  ) : schedule.slice(0, 6).map((s, i) => {
                    const myEventVenues = myEvents.flatMap(ev => ev.eventData.venue ?? []);
                    const mine = myEventVenues.some(v => s.venue?.toLowerCase().includes(v.toLowerCase()));
                    return (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: '52px 1fr auto',
                        alignItems: 'center', gap: 12,
                        padding: '12px 0',
                        borderTop: i === 0 ? 'none' : '1px solid var(--glass-border)',
                      }}>
                        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: mine ? 'var(--violet)' : 'var(--ink-dim)' }}>{fmtTime(s.start_time)}</div>
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{s.title}</div>
                          <div style={{ fontSize: 10, color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)', marginTop: 2 }}>{s.venue}</div>
                        </div>
                        {mine && <div className="chip violet" style={{ padding: '2px 7px', fontSize: 9 }}>MINE</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* FOOD QR */}
              <div className="glass-strong" style={{ padding: isMobile ? 18 : 26, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(127,119,221,0.25), transparent 70%)' }}/>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', position: 'relative' }}>
                  <div>
                    <div className="eyebrow" style={{ color: 'var(--violet)' }}>§ FOOD QR</div>
                    <div className="display" style={{ fontSize: 20, marginTop: 10, letterSpacing: '-0.01em' }}>
                      Scan at any meal counter.
                    </div>
                    <div style={{ marginTop: 6, color: 'var(--ink-mute)', fontSize: 12 }}>One code · all meals · both days</div>
                  </div>
                  <div className="chip teal" style={{ padding: '4px 10px', fontSize: 9.5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', boxShadow: '0 0 8px var(--teal)' }}/>
                    ACTIVE
                  </div>
                </div>
                <div style={{
                  marginTop: 22,
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: 18, alignItems: isMobile ? 'center' : 'flex-start',
                  position: 'relative',
                }}>
                  <div style={{ padding: 12, borderRadius: 10, background: '#F1EFE8', border: '3px solid rgba(127,119,221,0.4)', boxShadow: '0 0 40px rgba(127,119,221,0.25)' }}>
                    <QRCode size={isMobile ? 120 : 152} seed={qrSeed} />
                  </div>
                  <div style={{ flex: 1, width: isMobile ? '100%' : 'auto' }}>
                    <div className="eyebrow" style={{ marginBottom: 10 }}>MEAL LOG</div>
                    {meals.length === 0 ? (
                      <div style={{ color: 'var(--ink-mute)', fontSize: 12 }}>Loading meals…</div>
                    ) : meals.map((m, i) => (
                      <div key={m.slot} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i === 0 ? 'none' : '1px solid var(--glass-border)' }}>
                        <span style={{ fontSize: 12, color: m.collected ? 'var(--ink)' : 'var(--ink-dim)' }}>
                          {m.collected ? '✓ ' : '○ '}{m.label}
                        </span>
                        <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)' }}>
                          {m.collected ? 'Collected' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 18, fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.12em', textAlign: 'center' }}>
                  ID · {qrSeed} · ASCENT 2026
                </div>
              </div>

              {/* Announcements feed */}
              <div className="glass" style={{ padding: isMobile ? 18 : 26 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="eyebrow">§ ANNOUNCEMENTS</div>
                  <a onClick={() => navigate('/announcements')} style={{ fontSize: 11, color: 'var(--violet)', cursor: 'pointer', fontFamily: 'var(--f-mono)', letterSpacing: '0.1em' }}>ALL →</a>
                </div>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {anns.length === 0 ? (
                    <div style={{ color: 'var(--ink-mute)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No announcements yet.</div>
                  ) : anns.slice(0, 4).map((a, i) => (
                    <div key={a.id || i} style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: a.is_pinned ? '1px solid rgba(127,119,221,0.4)' : '1px solid var(--glass-border)',
                      background: a.is_pinned ? 'rgba(127,119,221,0.08)' : 'rgba(255,255,255,0.02)',
                      display: 'flex', justifyContent: 'space-between', gap: 10,
                    }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
                        {a.is_pinned && <span className="chip violet" style={{ padding: '1px 6px', fontSize: 8, marginRight: 8 }}>PIN</span>}
                        {a.content}
                      </div>
                      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)', whiteSpace: 'nowrap' }}>{relTime(a.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageBackground>
  );
}

// ─────────────────────────────────────────────────────────────
// Event Detail
// ─────────────────────────────────────────────────────────────
export function EventDetail() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const { user } = useUserAuth();
  const { eventId } = useParams();   // /event-detail/:eventId

  const [event,    setEvent]    = useState(null);
  const [team,     setTeam]     = useState(null);   // MyTeamResponse | null
  const [evSched,  setEvSched]  = useState([]);     // ScheduleItem[]
  const [userEntry, setEntry]   = useState(null);   // user.events[eventId]
  const [loading,  setLoading]  = useState(true);
  const [submitForm, setSubmitForm] = useState({ repo: '', deploy: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg]   = useState('');

  const [selectedRound, setSelectedRound] = useState(0);

  const load = useCallback(async () => {
    if (!user || !eventId) return;
    setLoading(true);
    try {
      const [evData, teamData, schedData, profileData] = await Promise.allSettled([
        eventsApi.get(eventId),
        eventsApi.myTeam(eventId).catch(() => null),
        scheduleApi.forEvent(eventId).catch(() => null),
        users.get(user.id),
      ]);
      if (evData.status  === 'fulfilled') setEvent(evData.value);
      if (teamData.status === 'fulfilled') setTeam(teamData.value);
      if (schedData.status === 'fulfilled' && schedData.value) setEvSched(schedData.value.schedule ?? []);
      if (profileData.status === 'fulfilled') {
        const registered = profileData.value.events || {};
        setEntry(registered[eventId] ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [user, eventId]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!submitForm.repo && !submitForm.deploy) return;
    setSubmitting(true);
    setSubmitMsg('');
    try {
      await eventsApi.submit(eventId, {
        phase: 1,
        repo_link:    submitForm.repo    || null,
        deploy_link:  submitForm.deploy  || null,
      });
      setSubmitMsg('Submission recorded! ✓');
    } catch (err) {
      setSubmitMsg(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <PageBackground bgImage="uploads/dashboard_scene.png" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="explore" />
      <Spinner />
    </PageBackground>
  );

  if (!event) return (
    <PageBackground bgImage="uploads/dashboard_scene.png" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="explore" />
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--ink-mute)' }}>Event not found.</div>
    </PageBackground>
  );

  // Build rounds from event.rounds object or event schedule
  const now = Date.now();
  const rounds = evSched.length > 0
    ? evSched.map((s, i) => {
        const start = s.start_time ? new Date(s.start_time).getTime() : 0;
        const end = s.end_time ? new Date(s.end_time).getTime() : start + 3600000;
        const isLive = start && end ? now >= start && now <= end : false;
        const isPast = end ? now > end : false;
        return {
          n: s.title, t: fmtTime(s.start_time), state: isLive ? 'live' : isPast ? 'done' : 'next', desc: `${s.venue}`
        };
      })
    : Object.entries(event.rounds ?? {}).map(([key, val]) => {
        const start = val?.start_time ? new Date(val.start_time).getTime() : 0;
        const end = val?.end_time ? new Date(val.end_time).getTime() : 0;
        let isLive = val?.is_active === true;
        let isPast = val?.is_locked === true;
        if (start && end) {
          isLive = now >= start && now <= end;
          isPast = now > end;
        }
        return {
          n: val?.title || key,
          t: val?.start_time ? fmtTime(val.start_time) : (val?.time ?? ''),
          state: isLive ? 'live' : isPast ? 'done' : (val?.state ?? 'next'),
          desc: val?.description ?? ''
        };
      });

  const venue = Array.isArray(event.venue) ? event.venue.join(' · ') : (event.venue || '');

  return (
    <PageBackground bgImage="uploads/dashboard_scene.png" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="explore" />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '20px 16px 60px' : '32px 28px 80px' }}>
        <a onClick={() => navigate('/dashboard')} style={{ color: 'var(--ink-mute)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--f-mono)', letterSpacing: '0.1em' }}>← DASHBOARD</a>

        <div style={{
          marginTop: 20,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr',
          gap: 32, alignItems: 'start',
        }}>
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {userEntry?.isAttending && <span className="chip teal">ATTENDING</span>}
              {userEntry?.submitted   && <span className="chip violet">SUBMITTED</span>}
              <span className="chip">{venue}</span>
            </div>
            <h1 className="display" style={{ fontSize: isMobile ? 52 : 72, lineHeight: 0.95, letterSpacing: '-0.03em' }}>
              {event.name}.
            </h1>
            <div style={{ marginTop: 20, color: 'var(--ink-dim)', fontSize: 15, lineHeight: 1.6, maxWidth: 540 }}>
              {event.description || 'No description available.'}
            </div>

            {/* Round timeline */}
            {rounds.length > 0 && (
              <div style={{ marginTop: 40 }}>
                <div className="eyebrow">§ ROUND TIMELINE</div>
                <div style={{
                  marginTop: 16,
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : `repeat(${Math.min(rounds.length, 6)}, 1fr)`,
                  gap: 8,
                }}>
                  {rounds.map((r, i) => {
                    const isSelected = selectedRound === i;
                    return (
                      <div key={i} onClick={() => setSelectedRound(i)} style={{
                        padding: isMobile ? 10 : 12, borderRadius: 8, cursor: 'pointer', transition: 'all .2s',
                        border: isSelected ? '1px solid rgba(127,119,221,0.8)' : r.state === 'live' ? '1px solid rgba(127,119,221,0.6)' : '1px solid var(--glass-border)',
                        background: isSelected ? 'rgba(127,119,221,0.2)' : r.state === 'live' ? 'rgba(127,119,221,0.12)' : r.state === 'done' ? 'rgba(29,158,117,0.06)' : 'rgba(255,255,255,0.02)',
                        boxShadow: isSelected ? '0 0 20px rgba(127,119,221,0.25)' : 'none',
                      }}>
                        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 9, letterSpacing: '0.1em',
                          color: r.state === 'live' ? 'var(--violet)' : r.state === 'done' ? 'var(--teal)' : 'var(--ink-mute)' }}>
                          {r.state === 'live' ? 'NOW' : r.state === 'done' ? '✓' : 'NEXT'}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>{r.n}</div>
                        <div style={{ marginTop: 2, fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)' }}>{r.t}</div>
                      </div>
                    );
                  })}
                </div>

                {rounds[selectedRound] && (() => {
                  const r = rounds[selectedRound];
                  return (
                    <div className="glass" style={{ marginTop: 14, padding: '18px 20px', borderLeft: '2px solid var(--violet)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <div className="eyebrow" style={{ color: 'var(--violet)' }}>{r.n} {r.t && `· ${r.t}`}</div>
                          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-dim)' }}>{r.desc}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          {r.state === 'done' && <a className="btn sm ghost">View Results →</a>}
                          {r.state === 'live' && <a onClick={() => document.getElementById('submission-form')?.scrollIntoView({ behavior: 'smooth' })} className="btn sm primary">Submit →</a>}
                          {r.state === 'next' && <a className="btn sm">Remind 🔔</a>}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Submission form */}
            <div id="submission-form" style={{ marginTop: 40 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="eyebrow">§ SUBMISSION</div>
              </div>
              <div className="glass" style={{ marginTop: 14, padding: 20 }}>
                {userEntry?.submitted ? (
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <div style={{ fontSize: 28, color: 'var(--teal)' }}>✓</div>
                    <div style={{ marginTop: 8, fontSize: 14, color: 'var(--ink)' }}>Submission recorded</div>
                    <div style={{ marginTop: 4, fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)' }}>You can resubmit to update your links</div>
                  </div>
                ) : null}
                {(() => {
                  const isRegistered = !!userEntry;
                  const currentRound = rounds[selectedRound];
                  const canSubmit = isRegistered && currentRound?.state === 'live';
                  
                  return (
                    <>
                      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: userEntry?.submitted ? 16 : 0, opacity: canSubmit ? 1 : 0.5 }}>
                        <input
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box' }}
                          placeholder="GitHub / Repository link"
                          value={submitForm.repo}
                          onChange={e => setSubmitForm(f => ({ ...f, repo: e.target.value }))}
                          disabled={!canSubmit}
                        />
                        <input
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box' }}
                          placeholder="Deployed URL (optional)"
                          value={submitForm.deploy}
                          onChange={e => setSubmitForm(f => ({ ...f, deploy: e.target.value }))}
                          disabled={!canSubmit}
                        />
                        {submitMsg && <div style={{ fontSize: 12, color: submitMsg.startsWith('Error') ? 'var(--danger, #e55)' : 'var(--teal)', fontFamily: 'var(--f-mono)' }}>{submitMsg}</div>}
                        <button type="submit" className="btn sm primary" disabled={submitting || (!submitForm.repo && !submitForm.deploy) || !canSubmit}>
                          {submitting ? 'Submitting…' : userEntry?.submitted ? 'Resubmit ↺' : 'Submit ⤴'}
                        </button>
                      </form>
                      {!isRegistered && (
                        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--amber, #f5a623)', textAlign: 'center', backgroundColor: 'rgba(245, 166, 35, 0.1)', padding: '8px', borderRadius: 6 }}>
                          You must be registered for this event to submit.
                        </div>
                      )}
                      {isRegistered && currentRound?.state !== 'live' && (
                        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--amber, #f5a623)', textAlign: 'center', backgroundColor: 'rgba(245, 166, 35, 0.1)', padding: '8px', borderRadius: 6 }}>
                          Submissions are only allowed during the active phase timeframe.
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: isMobile ? 'static' : 'sticky', top: 90 }}>
            <PosterPlaceholder title={event.name.toUpperCase()} sub="700 × 400" w="100%" h={isMobile ? 180 : 250} tone="violet" />

            {/* Team */}
            {team && (
              <div className="glass" style={{ padding: 20 }}>
                <div className="eyebrow">§ YOUR TEAM · {team.name?.toUpperCase() ?? 'TEAM'}</div>
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(team.members ?? []).map((m, i) => (
                    <div key={m.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: `linear-gradient(135deg, hsl(${i * 80 + 220} 40% 50%), hsl(${i * 80 + 160} 40% 40%))`,
                        border: '1px solid var(--glass-border)',
                        display: 'grid', placeItems: 'center',
                        fontFamily: 'var(--f-mono)', fontSize: 10, flexShrink: 0,
                      }}>{(m.name ?? '?').split(' ').map(x => x[0]).join('')}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>
                          {m.name}
                          {String(m.id) === String(user?.id) && <span style={{ color: 'var(--violet)', fontSize: 10, fontFamily: 'var(--f-mono)' }}> · YOU</span>}
                          {m.is_leader && <span style={{ color: 'var(--teal)', fontSize: 10, fontFamily: 'var(--f-mono)' }}> · LEAD</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{m.username}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick facts */}
            <div className="glass" style={{ padding: 20 }}>
              <div className="eyebrow">§ QUICK FACTS</div>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Venue',        venue || '—'],
                  ['Participants', `${event.participants_count ?? 0} registered`],
                  ...Object.entries(event.rounds ?? {}).slice(0, 2).map(([k, v]) => [k, v?.time ?? '—']),
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--ink-mute)' }}>{k}</span>
                    <span style={{ color: 'var(--ink)', fontFamily: 'var(--f-mono)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <a onClick={() => navigate(`/rating?event_id=${eventId}`)} className="btn sm ghost">Rate this event →</a>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
