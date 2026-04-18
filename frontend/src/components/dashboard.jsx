// Ascent — Dashboard + Event Detail
import React from 'react';
import { useMobile, NavBar, PageBackground, QRCode, PosterPlaceholder } from './shared';

export function Dashboard({ onNav }) {
  const isMobile = useMobile();
  return (
    <PageBackground bgImage="uploads/dashboard_scene.png" blurAmount={16} dimAmount={0.78}>
      <NavBar variant="app" active="dashboard" onNav={onNav} />
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
            <div className="eyebrow">// DAY 01 · 08:42 IST</div>
            <h1 className="display" style={{ fontSize: isMobile ? 36 : 52, marginTop: 14, letterSpacing: '-0.02em' }}>
              Good morning, <span style={{ color: 'var(--violet)' }}>Aarav</span>.
            </h1>
            <div style={{ marginTop: 10, color: 'var(--ink-dim)', fontSize: 14 }}>
              You have <span style={{ color: 'var(--ink)' }}>3 events</span> today. First up: Hack Night kickoff, 10:00 at Block C.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a className="chip teal"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)' }}/> All systems go</a>
            <a onClick={() => onNav('report')} className="btn ghost sm">Report issue</a>
          </div>
        </div>

        {/* Main grid */}
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
                <a onClick={() => onNav('explore')} style={{ fontSize: 11, color: 'var(--violet)', cursor: 'pointer', fontFamily: 'var(--f-mono)', letterSpacing: '0.1em' }}>BROWSE →</a>
              </div>
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { name: 'Hack Night', cat: 'CODING', venue: 'Block C · Lab 204', status: 'Round 1 · Live', tone: 'violet' },
                  { name: 'Circuit Rush', cat: 'HARDWARE', venue: 'Robotics Lab', status: 'Tomorrow · 14:00', tone: 'teal' },
                  { name: 'Design Jam', cat: 'DESIGN', venue: 'Studio B', status: 'Tomorrow · 10:00', tone: 'amber' },
                ].map((ev, i) => (
                  <div key={i} onClick={() => onNav('event-detail')} style={{
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
                    }}>{ev.name[0]}</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--f-display)', fontSize: 15, fontWeight: 600 }}>{ev.name}</span>
                        <span className={`chip ${ev.tone}`} style={{ padding: '2px 7px', fontSize: 9 }}>{ev.cat}</span>
                      </div>
                      <div style={{ marginTop: 4, color: 'var(--ink-mute)', fontSize: 11, fontFamily: 'var(--f-mono)' }}>{ev.venue}</div>
                      {isMobile && <div style={{ marginTop: 4, fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-dim)' }}>{ev.status}</div>}
                    </div>
                    {!isMobile && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-dim)', letterSpacing: '0.08em' }}>{ev.status}</div>
                        <div style={{ marginTop: 4, fontSize: 18, color: 'var(--ink-mute)' }}>→</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Schedule snapshot */}
            <div className="glass" style={{ padding: isMobile ? 18 : 26 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="eyebrow">§ TODAY'S TIMELINE</div>
                <a onClick={() => onNav('schedule')} style={{ fontSize: 11, color: 'var(--violet)', cursor: 'pointer', fontFamily: 'var(--f-mono)', letterSpacing: '0.1em' }}>FULL →</a>
              </div>
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column' }}>
                {[
                  { t: '10:00', n: 'Hack Night · Kickoff', v: 'Block C · 204', mine: true },
                  { t: '12:30', n: 'Keynote · Dr. Ishan Mehra', v: 'Auditorium', mine: false },
                  { t: '14:00', n: 'Code Clash · Qualifiers', v: 'Block C · 301', mine: false },
                  { t: '18:00', n: 'Design Jam · Brief drop', v: 'Studio B', mine: true },
                  { t: '22:00', n: 'Hack Night · Demo', v: 'Main Stage', mine: true },
                ].map((s, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '52px 1fr auto',
                    alignItems: 'center', gap: 12,
                    padding: '12px 0',
                    borderTop: i === 0 ? 'none' : '1px solid var(--glass-border)',
                  }}>
                    <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: s.mine ? 'var(--violet)' : 'var(--ink-dim)' }}>{s.t}</div>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{s.n}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)', marginTop: 2 }}>{s.v}</div>
                    </div>
                    {s.mine && <div className="chip violet" style={{ padding: '2px 7px', fontSize: 9 }}>MINE</div>}
                  </div>
                ))}
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
                  <QRCode size={isMobile ? 120 : 152} seed="ASCENT-AARAV-042" />
                </div>
                <div style={{ flex: 1, width: isMobile ? '100%' : 'auto' }}>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>MEAL LOG</div>
                  {[
                    { m: 'Breakfast', s: 'Collected · 08:14', done: true },
                    { m: 'Lunch', s: 'Pending', done: false },
                    { m: 'Snacks', s: 'Pending', done: false },
                    { m: 'Dinner', s: 'Pending', done: false },
                  ].map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i === 0 ? 'none' : '1px solid var(--glass-border)' }}>
                      <span style={{ fontSize: 12, color: m.done ? 'var(--ink)' : 'var(--ink-dim)' }}>
                        {m.done ? '✓ ' : '○ '}{m.m}
                      </span>
                      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)' }}>{m.s}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 18, fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.12em', textAlign: 'center' }}>
                ID · ASC-AARAV-042 · VALID MAY 16–17
              </div>
            </div>

            {/* Announcements feed */}
            <div className="glass" style={{ padding: isMobile ? 18 : 26 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="eyebrow">§ ANNOUNCEMENTS</div>
                <a onClick={() => onNav('announcements')} style={{ fontSize: 11, color: 'var(--violet)', cursor: 'pointer', fontFamily: 'var(--f-mono)', letterSpacing: '0.1em' }}>ALL →</a>
              </div>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { t: '2m', n: 'Hack Night brief is out — check your team portal.', pin: true },
                  { t: '14m', n: 'Lunch moves to 13:00 today. Apologies, kitchen delay.' },
                  { t: '1h', n: 'Circuit Rush kit pickup begins at Block D lobby.' },
                  { t: '3h', n: 'Mirage photos from Day 0 are live in the gallery.' },
                ].map((a, i) => (
                  <div key={i} style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: a.pin ? '1px solid rgba(127,119,221,0.4)' : '1px solid var(--glass-border)',
                    background: a.pin ? 'rgba(127,119,221,0.08)' : 'rgba(255,255,255,0.02)',
                    display: 'flex', justifyContent: 'space-between', gap: 10,
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
                      {a.pin && <span className="chip violet" style={{ padding: '1px 6px', fontSize: 8, marginRight: 8 }}>PIN</span>}
                      {a.n}
                    </div>
                    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)', whiteSpace: 'nowrap' }}>{a.t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mini actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div onClick={() => onNav('leaderboard')} className="glass" style={{ padding: 18, cursor: 'pointer' }}>
                <div className="eyebrow" style={{ color: 'var(--teal)' }}>YOUR RANK</div>
                <div className="display" style={{ fontSize: 32, marginTop: 8 }}>#47</div>
                <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 4, fontFamily: 'var(--f-mono)' }}>↑ 12 SINCE YESTERDAY</div>
              </div>
              <div onClick={() => onNav('mirage')} className="glass" style={{ padding: 18, cursor: 'pointer' }}>
                <div className="eyebrow" style={{ color: 'var(--violet)' }}>MIRAGE</div>
                <div className="display" style={{ fontSize: 32, marginTop: 8 }}>248</div>
                <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 4, fontFamily: 'var(--f-mono)' }}>NEW PHOTOS TODAY</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}

// ─────────────────────────────────────────────────────────────
// Event Detail
// ─────────────────────────────────────────────────────────────
export function EventDetail({ onNav }) {
  const isMobile = useMobile();
  const [selectedRound, setSelectedRound] = React.useState(1);
  const rounds = [
    { n: 'Kickoff', t: '10:00', state: 'done', desc: 'Opening ceremony and theme reveal.' },
    { n: 'Round 1', t: '14:00', state: 'live', desc: 'Initial prototype review by mentors.' },
    { n: 'Checkpoint', t: '19:00', state: 'next', desc: 'Mid-hack progress check and feedback.' },
    { n: 'Round 2', t: '02:00', state: 'next', desc: 'Deep dive into technical architecture.' },
    { n: 'Demo', t: '09:00', state: 'next', desc: 'Final product presentation to judges.' },
    { n: 'Awards', t: '11:00', state: 'next', desc: 'Closing ceremony and prize distribution.' },
  ];

  return (
    <PageBackground bgImage="uploads/dashboard_scene.png" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="explore" onNav={onNav} />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '20px 16px 60px' : '32px 28px 80px' }}>
        <a onClick={() => onNav('dashboard')} style={{ color: 'var(--ink-mute)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--f-mono)', letterSpacing: '0.1em' }}>← DASHBOARD</a>

        <div style={{
          marginTop: 20,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr',
          gap: 32, alignItems: 'start',
        }}>
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span className="chip violet">CODING</span>
              <span className="chip">24H · TEAM OF 4</span>
              <span className="chip teal">LIVE NOW</span>
            </div>
            <h1 className="display" style={{ fontSize: isMobile ? 52 : 72, lineHeight: 0.95, letterSpacing: '-0.03em' }}>
              Hack<br/>Night.
            </h1>
            <div style={{ marginTop: 20, color: 'var(--ink-dim)', fontSize: 15, lineHeight: 1.6, maxWidth: 540 }}>
              Ascent's flagship 24-hour hackathon. You pick a track, grab a room, and ship something by sunrise.
              Judges visit every four hours — this year's theme drops at kickoff.
            </div>

            {/* Round timeline */}
            <div style={{ marginTop: 40 }}>
              <div className="eyebrow">§ ROUND TIMELINE</div>
              <div style={{
                marginTop: 16,
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)',
                gap: 8,
              }}>
                {rounds.map((r, i) => {
                  const isSelected = selectedRound === i;
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedRound(i)}
                      style={{
                        padding: isMobile ? 10 : 12, borderRadius: 8, cursor: 'pointer',
                        transition: 'all .2s',
                        border: isSelected
                          ? '1px solid rgba(127,119,221,0.8)'
                          : r.state === 'live'
                          ? '1px solid rgba(127,119,221,0.6)'
                          : '1px solid var(--glass-border)',
                        background: isSelected
                          ? 'rgba(127,119,221,0.2)'
                          : r.state === 'live'
                          ? 'rgba(127,119,221,0.12)'
                          : r.state === 'done'
                          ? 'rgba(29,158,117,0.06)'
                          : 'rgba(255,255,255,0.02)',
                        boxShadow: isSelected ? '0 0 20px rgba(127,119,221,0.25)' : 'none',
                      }}
                    >
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

              {selectedRound !== null && (() => {
                const r = rounds[selectedRound];
                const details = [
                  { label: 'Description', value: r.desc },
                  { label: 'Judging', value: selectedRound === 0 ? 'Theme announced — no judging' : selectedRound === 4 ? 'Full panel · 6 judges' : 'Mentor walkthrough · 3 judges' },
                  { label: 'Location', value: 'Block C · Lab 204' },
                ];
                return (
                  <div className="glass" style={{ marginTop: 14, padding: '18px 20px', borderLeft: '2px solid var(--violet)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <div className="eyebrow" style={{ color: 'var(--violet)' }}>{r.n} · {r.t}</div>
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {details.map(d => (
                            <div key={d.label} style={{ display: 'flex', gap: 12, fontSize: 12.5, flexWrap: 'wrap' }}>
                              <span style={{ color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: '0.1em', minWidth: 80 }}>{d.label.toUpperCase()}</span>
                              <span style={{ color: 'var(--ink-dim)' }}>{d.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        {r.state === 'done' && <a className="btn sm ghost">View Results →</a>}
                        {r.state === 'live' && <a className="btn sm primary">Submit →</a>}
                        {r.state === 'next' && <a className="btn sm">Remind 🔔</a>}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Seating arrangement */}
            <div style={{ marginTop: 40 }}>
              <div className="eyebrow">§ SEATING · BLOCK C · 204</div>
              <div className="glass" style={{ marginTop: 14, padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: isMobile ? 4 : 6 }}>
                  {Array.from({ length: 40 }).map((_, i) => {
                    const mine = i === 17;
                    const occupied = [2,3,7,9,11,14,18,19,22,25,28,31,32,36].includes(i);
                    return (
                      <div key={i} style={{
                        height: isMobile ? 22 : 28, borderRadius: 4,
                        background: mine ? 'rgba(127,119,221,0.5)' : occupied ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                        border: mine ? '1px solid var(--violet)' : '1px solid var(--glass-border)',
                        boxShadow: mine ? '0 0 16px var(--violet-glow)' : 'none',
                        display: 'grid', placeItems: 'center',
                        fontFamily: 'var(--f-mono)', fontSize: 8,
                        color: mine ? '#fff' : 'var(--ink-mute)',
                      }}>
                        {mine ? 'YOU' : ''}
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 14, display: 'flex', gap: 16, fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em', flexWrap: 'wrap' }}>
                  <span>● YOU</span><span>○ OCCUPIED</span><span>· EMPTY</span>
                </div>
              </div>
            </div>

            {/* Submission */}
            <div style={{ marginTop: 40 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="eyebrow">§ SUBMISSION</div>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--violet)', letterSpacing: '0.1em' }}>
                  DEADLINE · 08:52:14
                </div>
              </div>
              <div className="glass" style={{ marginTop: 14, padding: 20 }}>
                <div style={{
                  border: '1.5px dashed var(--glass-border-strong)',
                  borderRadius: 10, padding: 28,
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.015)',
                }}>
                  <div style={{ fontSize: 28, color: 'var(--ink-dim)' }}>⤴</div>
                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink)' }}>Drop your GitHub link or upload a .zip</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)' }}>MAX 200MB · TEAM LEADS ONLY</div>
                  <button className="btn sm" style={{ marginTop: 16 }}>Choose file</button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar — on mobile renders below */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: isMobile ? 'static' : 'sticky', top: 90 }}>
            <PosterPlaceholder title="HACK NIGHT" sub="700 × 400" w="100%" h={isMobile ? 180 : 250} tone="violet" />
            <div className="glass" style={{ padding: 20 }}>
              <div className="eyebrow">§ YOUR TEAM · DRAGONFLY</div>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { n: 'Aarav Rao', r: 'Lead · Full-stack', me: true },
                  { n: 'Meera Iyer', r: 'Design' },
                  { n: 'Kabir Nair', r: 'ML' },
                  { n: 'Simran Shah', r: 'Hardware' },
                ].map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: `linear-gradient(135deg, hsl(${i*80+220} 40% 50%), hsl(${i*80+160} 40% 40%))`,
                      border: '1px solid var(--glass-border)',
                      display: 'grid', placeItems: 'center',
                      fontFamily: 'var(--f-mono)', fontSize: 10, flexShrink: 0,
                    }}>{m.n.split(' ').map(x=>x[0]).join('')}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>{m.n} {m.me && <span style={{ color: 'var(--violet)', fontSize: 10, fontFamily: 'var(--f-mono)' }}>· YOU</span>}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{m.r}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass" style={{ padding: 20 }}>
              <div className="eyebrow">§ QUICK FACTS</div>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Venue', 'Block C · 204'],
                  ['Theme', 'Drops at kickoff'],
                  ['Prize', '₹3,00,000 + mentorship'],
                  ['Track', 'Open'],
                  ['Judges', '6 (industry + faculty)'],
                ].map(([k,v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--ink-mute)' }}>{k}</span>
                    <span style={{ color: 'var(--ink)', fontFamily: 'var(--f-mono)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <a onClick={() => onNav('rating')} className="btn sm ghost">Rate this event →</a>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
