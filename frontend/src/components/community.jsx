// Ascent — Mirage gallery, Announcements, Lost & Found
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobile, NavBar, PageBackground, ImgPlaceholder } from './shared';
import { useUserAuth } from '../lib/UserAuthContext';

export function Mirage() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const { user } = useUserAuth();
  const locked = !user?.is_attending;
  const cats = ['All', 'Hack Night', 'Circuit Rush', 'Keynote', 'Opening', 'Campus'];
  const [cat, setCat] = React.useState('All');
  const [lightbox, setLightbox] = React.useState(null);

  const photos = Array.from({ length: 18 }).map((_, i) => ({
    h: [220, 300, 260, 340, 200, 280, 320, 240, 300][i % 9],
    tone: ['violet', 'teal', 'amber', 'slate'][i % 4],
    c: cats[(i % (cats.length - 1)) + 1],
    caption: ['Demo day · 21:14', 'Solder night', 'Keynote hall', 'Opening fireworks', 'Dragonfly team', 'Block C glow'][i % 6],
  }));
  const filtered = cat === 'All' ? photos : photos.filter(p => p.c === cat);

  return (
    <PageBackground bgImage="https://res.cloudinary.com/dglvt0iom/image/upload/v1776878490/dashboard_scene_k9629h.jpg" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="mirage" />

      {/* ── Full-page lock overlay — starts below the navbar ── */}
      {locked && (
        <div style={{
          position: 'fixed', top: 56, left: 0, right: 0, bottom: 0, zIndex: 10,
          backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
          background: 'rgba(8, 8, 14, 0.82)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          textAlign: 'center', padding: 24,
        }}>
          <div style={{ fontSize: 48 }}>🔒</div>
          <div style={{
            fontFamily: 'var(--f-mono)', fontSize: isMobile ? 18 : 22,
            letterSpacing: '0.12em', color: 'var(--ink)',
            textTransform: 'uppercase', fontWeight: 700,
          }}>
            Unlocks at Round 2
          </div>
          <div style={{
            fontSize: 14, color: 'var(--ink-mute)',
            maxWidth: 320, lineHeight: 1.6,
          }}>
            Mirage opens its doors after Round 1. Come back for the full photo archive.
          </div>
        </div>
      )}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '40px 28px 80px' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', gap: 12 }}>
          <div>
            <div className="eyebrow">§ MIRAGE · PHOTO ARCHIVE</div>
            <h1 className="display" style={{ fontSize: isMobile ? 40 : 72, marginTop: 14, letterSpacing: '-0.03em' }}>The weekend, as seen.</h1>
          </div>
          {!isMobile && (
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>
              {photos.length * 14} PHOTOS · UPDATED 2M AGO
            </div>
          )}
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {cats.map(c => (
            <div key={c} onClick={() => setCat(c)} className="chip" style={{
              cursor: 'pointer', padding: '7px 14px', fontSize: 11,
              background: cat === c ? 'rgba(127,119,221,0.2)' : undefined,
              borderColor: cat === c ? 'rgba(127,119,221,0.55)' : undefined,
              color: cat === c ? '#F1EFE8' : undefined,
            }}>{c}</div>
          ))}
        </div>

        <div style={{ marginTop: 28, columns: isMobile ? 2 : 4, columnGap: isMobile ? 10 : 14 }}>
          {filtered.map((p, i) => (
            <div key={i} onClick={() => setLightbox(p)} style={{
              breakInside: 'avoid', marginBottom: isMobile ? 10 : 14, cursor: 'pointer',
              position: 'relative', borderRadius: 10, overflow: 'hidden',
              transition: 'all .3s',
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 40px rgba(127,119,221,0.35)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
            >
              <ImgPlaceholder w="100%" h={isMobile ? p.h * 0.65 : p.h} tone={p.tone} badge={p.c} />
            </div>
          ))}
        </div>
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(5,5,10,0.88)',
          display: 'grid', placeItems: 'center', zIndex: 100, padding: isMobile ? 16 : 40,
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{ maxWidth: 1000, width: '100%', position: 'relative' }}>
            <ImgPlaceholder w="100%" h={isMobile ? 240 : 600} tone={lightbox.tone} badge={lightbox.c} />
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ color: 'var(--ink)', fontSize: 14 }}>{lightbox.caption}</div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)' }}>TAP · CLOSE</div>
            </div>
          </div>
        </div>
      )}
    </PageBackground>
  );
}

// Broadcast categories — always show to every logged-in user
const BROADCAST_CATEGORIES = new Set(['general', 'pinned', 'schedule', 'meal', 'alert', 'info']);

export function Announcements() {
  const isMobile = useMobile();
  const [posts, setPosts]         = React.useState([]);
  const [loading, setLoading]     = React.useState(true);
  const [filter, setFilter]       = React.useState('all'); // 'all' | 'general' | 'events'
  // Set of lowercase event names the user is registered for
  const [myEventNames, setMyEventNames] = React.useState(null);
  // Set of all event names (lowercase) — used to detect event-targeted categories
  const [allEventNames, setAllEventNames] = React.useState(null);

  React.useEffect(() => {
    import('../lib/api').then(({ announcements: annApi, users, events: eventsApi }) => {
      Promise.all([
        annApi.list(50),
        users.myEvents().catch(() => []),    // user's registered events
        eventsApi.list().catch(() => []),    // all events (to detect event-targeted categories)
      ]).then(([data, myEvs, allEvs]) => {
        // Build lookup sets (lowercase names for case-insensitive match)
        const myNames  = new Set((myEvs  || []).map(e => e.name.trim().toLowerCase()));
        const allNames = new Set((allEvs || []).map(e => e.name.trim().toLowerCase()));

        // Sort: pinned first, then newest
        const sorted = [...data].sort((a, b) => {
          const aPin = a.category === 'pinned' ? 1 : 0;
          const bPin = b.category === 'pinned' ? 1 : 0;
          if (bPin !== aPin) return bPin - aPin;
          return new Date(b.time) - new Date(a.time);
        });

        setMyEventNames(myNames);
        setAllEventNames(allNames);
        setPosts(sorted);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    });
  }, []);

  // Decide whether this announcement is visible to the current user
  function isVisible(post) {
    if (allEventNames === null || myEventNames === null) return false;
    const cat = (post.category || 'general').trim().toLowerCase();
    // If it's a broadcast category → always show
    if (BROADCAST_CATEGORIES.has(cat)) return true;
    // If the category matches a known event name → show only if user is registered
    if (allEventNames.has(cat)) return myEventNames.has(cat);
    // Unknown category → treat as broadcast (safe default)
    return true;
  }

  function relativeTime(isoStr) {
    if (!isoStr) return '';
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const visible = posts.filter(p => {
    if (!isVisible(p)) return false;
    if (filter === 'all') return true;
    const cat = (p.category || 'general').trim().toLowerCase();
    const isEvent = allEventNames?.has(cat) && !BROADCAST_CATEGORIES.has(cat);
    if (filter === 'general') return !isEvent;
    if (filter === 'events')  return isEvent;
    return true;
  });

  const FILTERS = [
    { key: 'all',     label: 'All' },
    { key: 'general', label: 'General' },
    { key: 'events',  label: 'My Events' },
  ];

  return (
    <PageBackground bgImage="https://res.cloudinary.com/dglvt0iom/image/upload/v1776878490/dashboard_scene_k9629h.jpg" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="announcements" />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '40px 28px 80px' }}>
        <div className="eyebrow">§ ORGANIZER BROADCAST</div>
        <h1 className="display" style={{ fontSize: isMobile ? 40 : 64, marginTop: 14, letterSpacing: '-0.02em' }}>Notice board.</h1>
        <div style={{ marginTop: 10, color: 'var(--ink-dim)', fontSize: 14 }}>
          Official word from the organizers. Pinned items sit up top.
        </div>

        {/* Filter chips */}
        <div style={{ marginTop: 24, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <div
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="chip"
              style={{
                cursor: 'pointer', padding: '7px 16px', fontSize: 11,
                background: filter === f.key ? 'rgba(127,119,221,0.2)' : undefined,
                borderColor: filter === f.key ? 'rgba(127,119,221,0.55)' : undefined,
                color: filter === f.key ? '#F1EFE8' : undefined,
              }}
            >
              {f.label}
              {!loading && (
                <span style={{ marginLeft: 6, opacity: 0.5 }}>
                  {f.key === 'all'
                    ? posts.filter(isVisible).length
                    : posts.filter(p => {
                        if (!isVisible(p)) return false;
                        const cat = (p.category || 'general').trim().toLowerCase();
                        const isEv = allEventNames?.has(cat) && !BROADCAST_CATEGORIES.has(cat);
                        return f.key === 'events' ? isEv : !isEv;
                      }).length}
                </span>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading && (
            <div style={{ color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)', fontSize: 12, padding: 24, textAlign: 'center' }}>Loading…</div>
          )}
          {!loading && visible.length === 0 && (
            <div style={{ color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)', fontSize: 12, padding: 24, textAlign: 'center' }}>No announcements yet.</div>
          )}
          {visible.map((p, i) => {
            const pin = p.category === 'pinned';
            const cat = (p.category || '').trim().toLowerCase();
            // Show event badge only when it's targeted at a specific event
            const isEventTargeted = allEventNames?.has(cat) && !BROADCAST_CATEGORIES.has(cat);
            return (
              <div key={i} className="glass" style={{
                padding: isMobile ? 16 : 22,
                borderColor: pin ? 'rgba(127,119,221,0.45)' : undefined,
                background: pin ? 'rgba(127,119,221,0.07)' : undefined,
                position: 'relative',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                    {pin && <span className="chip violet" style={{ padding: '2px 8px', fontSize: 9, flexShrink: 0 }}>📌 PINNED</span>}
                    {isEventTargeted && (
                      <span className="chip" style={{ padding: '2px 8px', fontSize: 9, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {p.category}
                      </span>
                    )}
                    <span style={{ fontFamily: 'var(--f-display)', fontSize: isMobile ? 15 : 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{p.announcement}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', whiteSpace: 'nowrap', flexShrink: 0 }}>{relativeTime(p.time)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageBackground>
  );
}

export function LostFound() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const [tab, setTab] = React.useState('lost');
  const items = {
    lost: [
      { t: 'Black ThinkPad charger', w: 'Block C · 204', when: '2h ago', by: 'Aarav R.', tone: 'violet' },
      { t: 'Silver hoop earring (left)', w: 'Auditorium', when: '3h ago', by: 'Meera I.', tone: 'amber' },
      { t: 'Student ID card · VIT', w: 'Food court', when: '5h ago', by: 'Rohan D.', tone: 'teal' },
      { t: 'Blue water bottle', w: 'Block C hallway', when: 'Yesterday', by: 'Priya S.', tone: 'violet' },
    ],
    found: [
      { t: 'Wireless mouse (Logitech)', w: 'Studio B', when: '1h ago', by: 'Found by · Ops desk', tone: 'teal' },
      { t: 'Set of keys with red tag', w: 'Main gate', when: '4h ago', by: 'Found by · Security', tone: 'amber' },
      { t: 'AirPods case (no pods)', w: 'Lawn', when: '6h ago', by: 'Found by · Volunteer', tone: 'violet' },
    ],
  };
  return (
    <PageBackground bgImage="https://res.cloudinary.com/dglvt0iom/image/upload/v1776878490/dashboard_scene_k9629h.jpg" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="" />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '40px 28px 80px' }}>
        <div className="eyebrow">§ LOST &amp; FOUND</div>
        <h1 className="display" style={{ fontSize: isMobile ? 36 : 56, marginTop: 14, letterSpacing: '-0.02em' }}>Something missing?</h1>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 16 }}>
          <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 999, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
            {[['lost', `Lost · ${items.lost.length}`],['found', `Found · ${items.found.length}`]].map(([k,l]) => (
              <div key={k} onClick={() => setTab(k)} style={{
                padding: '8px 18px', borderRadius: 999, cursor: 'pointer',
                fontSize: 12.5, fontWeight: 500,
                background: tab === k ? 'rgba(127,119,221,0.2)' : 'transparent',
                color: tab === k ? 'var(--ink)' : 'var(--ink-dim)',
                border: tab === k ? '1px solid rgba(127,119,221,0.5)' : '1px solid transparent',
              }}>{l}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, width: isMobile ? '100%' : 'auto', maxWidth: 520 }}>
            <input className="input" placeholder="Search by keyword…" style={{ flex: 1 }} />
            <button className="btn primary sm" style={{ whiteSpace: 'nowrap' }}>+ Post</button>
          </div>
        </div>

        <div style={{
          marginTop: 24,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? 12 : 14,
        }}>
          {items[tab].map((it, i) => (
            <div key={i} className="glass" style={{ padding: 0, overflow: 'hidden' }}>
              <ImgPlaceholder w="100%" h={isMobile ? 120 : 160} tone={it.tone} label={`PHOTO ${i+1}`} />
              <div style={{ padding: isMobile ? 12 : 16 }}>
                <div style={{ fontFamily: 'var(--f-display)', fontSize: isMobile ? 14 : 16, fontWeight: 600 }}>{it.t}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-dim)' }}>Last seen · {it.w}</div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--f-mono)', fontSize: isMobile ? 9 : 10, color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>{it.when.toUpperCase()}</span>
                  <a className="btn sm" style={{ padding: '4px 10px', fontSize: 10 }}>Contact</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageBackground>
  );
}
