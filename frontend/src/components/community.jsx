// Ascent — Mirage gallery, Announcements, Lost & Found
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobile, NavBar, PageBackground, ImgPlaceholder } from './shared';
import { MirageGallery } from './MirageGallery';
import { useUserAuth } from '../lib/UserAuthContext';
import { mirage as mirageApi, token as authToken } from '../lib/api';

export function Mirage() {
  return <MirageGallery />;

  const isMobile = useMobile();
  const { user } = useUserAuth();
  const locked = false;
  const [days, setDays] = React.useState([]);
  const [selectedDay, setSelectedDay] = React.useState('All');
  const [loading, setLoading] = React.useState(!locked);
  const [error, setError] = React.useState('');
  const [lightbox, setLightbox] = React.useState(null);
  const userToken = authToken.getUser();

  const withToken = React.useCallback((url) => {
    if (!url || /^https?:\/\//i.test(url)) return url;
    if (!userToken) return url;
    const joiner = url.includes('?') ? '&' : '?';
    return `${url}${joiner}token=${encodeURIComponent(userToken)}`;
  }, [userToken]);

  React.useEffect(() => {
    let cancelled = false;
    if (locked) {
      setDays([]);
      setSelectedDay('All');
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setError('');
    mirageApi.gallery()
      .then((data) => {
        if (cancelled) return;
        const nextDays = Array.isArray(data) ? data : [];
        setDays(nextDays);
        setSelectedDay((prev) => (
          prev !== 'All' && nextDays.some(day => day.dayLabel === prev) ? prev : 'All'
        ));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load Mirage yet.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [locked]);

  const totalPhotos = days.reduce(
    (sum, day) => sum + day.sections.reduce((sectionSum, section) => sectionSum + (section.imageCount || 0), 0),
    0,
  );
  const dayOptions = ['All', ...days.map(day => day.dayLabel)];
  const visibleDays = selectedDay === 'All'
    ? days
    : days.filter(day => day.dayLabel === selectedDay);

  return (
    <PageBackground bgImage="https://res.cloudinary.com/dglvt0iom/image/upload/v1776878490/dashboard_scene_k9629h.jpg" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="mirage" />

      {locked && (
        <div style={{
          position: 'fixed', top: 56, left: 0, right: 0, bottom: 0, zIndex: 10,
          backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
          background: 'rgba(8, 8, 14, 0.82)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          textAlign: 'center', padding: 24,
        }}>
          <div style={{ fontSize: 48 }}>Lock</div>
          <div style={{
            fontFamily: 'var(--f-mono)', fontSize: isMobile ? 18 : 22,
            letterSpacing: '0.12em', color: 'var(--ink)',
            textTransform: 'uppercase', fontWeight: 700,
          }}>
            Mirage is live
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-mute)', maxWidth: 320, lineHeight: 1.6 }}>
            The photo archive is now open for every signed-in user.
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '40px 28px 80px' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', gap: 12 }}>
          <div>
            <div className="eyebrow">Mirage · Photo Archive</div>
            <h1 className="display" style={{ fontSize: isMobile ? 40 : 72, marginTop: 14, letterSpacing: '-0.03em' }}>The weekend, as seen.</h1>
          </div>
          {!isMobile && (
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>
              {totalPhotos} PHOTOS · DRIVE-SYNCED
            </div>
          )}
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {dayOptions.map(day => (
            <div key={day} onClick={() => setSelectedDay(day)} className="chip" style={{
              cursor: 'pointer', padding: '7px 14px', fontSize: 11,
              background: selectedDay === day ? 'rgba(127,119,221,0.2)' : undefined,
              borderColor: selectedDay === day ? 'rgba(127,119,221,0.55)' : undefined,
              color: selectedDay === day ? '#F1EFE8' : undefined,
            }}>{day}</div>
          ))}
        </div>

        {loading && (
          <div style={{ marginTop: 28, color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)', fontSize: 12 }}>
            Loading Mirage from Drive...
          </div>
        )}

        {!loading && error && (
          <div style={{
            marginTop: 28,
            padding: '14px 16px',
            borderRadius: 12,
            background: 'rgba(220, 80, 80, 0.1)',
            border: '1px solid rgba(220, 80, 80, 0.28)',
            color: '#f1b0b0',
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {!loading && !error && visibleDays.length === 0 && !locked && (
          <div style={{ marginTop: 28, color: 'var(--ink-mute)', fontSize: 14 }}>
            No Mirage folders are published yet.
          </div>
        )}

        {!loading && !error && visibleDays.map((day) => (
          <div key={day.dayLabel} style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'var(--f-display)', fontSize: isMobile ? 28 : 34, color: 'var(--ink)' }}>
                {day.dayLabel}
              </div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>
                {day.sections.reduce((sum, section) => sum + (section.imageCount || 0), 0)} FRAMES
              </div>
            </div>

            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {day.sections.map((section) => (
                <div key={section.id} className="glass" style={{ padding: isMobile ? 16 : 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--f-display)', fontSize: isMobile ? 22 : 26, color: 'var(--ink)' }}>
                        {section.sectionTitle}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-dim)' }}>
                        {section.eventName || 'Custom section'} · {section.imageCount} image{section.imageCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="chip" style={{ padding: '6px 10px', fontSize: 10 }}>
                      {section.recursive ? 'MULTI-FOLDER' : 'DIRECT FOLDER'}
                    </div>
                  </div>

                  {section.images?.length === 0 ? (
                    <div style={{ marginTop: 16, color: 'var(--ink-mute)', fontSize: 13 }}>
                      This folder is published but currently has no readable images.
                    </div>
                  ) : (
                    <div style={{
                      marginTop: 16,
                      display: 'grid',
                      gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
                      gap: isMobile ? 10 : 12,
                    }}>
                      {section.images.map((image) => (
                        <button
                          key={image.fileId}
                          type="button"
                          onClick={() => setLightbox({
                            ...image,
                            sectionTitle: section.sectionTitle,
                            dayLabel: day.dayLabel,
                          })}
                          style={{
                            padding: 0,
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: 12,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ aspectRatio: '1 / 1', background: 'rgba(255,255,255,0.03)' }}>
                            <img
                              src={withToken(image.url)}
                              alt={image.name}
                              loading="lazy"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </div>
                          <div style={{ padding: '10px 11px 12px' }}>
                            <div style={{
                              fontSize: 12,
                              color: 'var(--ink)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {image.name}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(5,5,10,0.88)',
          display: 'grid', placeItems: 'center', zIndex: 100, padding: isMobile ? 16 : 40,
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{ maxWidth: 1000, width: '100%', position: 'relative' }}>
            <div style={{ borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.03)' }}>
              <img
                src={withToken(lightbox.url)}
                alt={lightbox.name}
                style={{ width: '100%', maxHeight: isMobile ? '70vh' : '78vh', objectFit: 'contain', display: 'block' }}
              />
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ color: 'var(--ink)', fontSize: 14 }}>
                {lightbox.sectionTitle} · {lightbox.name}
              </div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)' }}>TAP · CLOSE</div>
            </div>
          </div>
        </div>
      )}
    </PageBackground>
  );
}

function MirageLegacy() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const { user } = useUserAuth();
  const locked = false;
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
            Mirage is live
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-mute)', maxWidth: 320, lineHeight: 1.6 }}>
            The photo archive is now open for every signed-in user.
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

// ── Shared helpers ─────────────────────────────────────────────────────────────

const BROADCAST_CATEGORIES = new Set(['general', 'pinned', 'schedule', 'meal', 'alert', 'info', 'visitor']);

/** Parse raw text into spans + clickable anchor elements for any URLs */
function RichText({ text, style = {} }) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  const parts = text.split(urlRegex);
  return (
    <span style={style}>
      {parts.map((part, i) => {
        if (urlRegex.test(part)) {
          urlRegex.lastIndex = 0;
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ color: 'var(--violet)', textDecoration: 'underline', wordBreak: 'break-all' }}
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

// ── User-facing Announcements page ────────────────────────────────────────────

export function Announcements() {
  const isMobile = useMobile();
  const [posts, setPosts]         = React.useState([]);
  const [loading, setLoading]     = React.useState(true);
  const [filter, setFilter]       = React.useState('all');
  const [myEventNames, setMyEventNames] = React.useState(null);
  const [allEventNames, setAllEventNames] = React.useState(null);

  React.useEffect(() => {
    import('../lib/api').then(({ announcements: annApi, users, events: eventsApi }) => {
      Promise.all([
        annApi.list(50),
        users.myEvents().catch(() => []),
        eventsApi.list().catch(() => []),
      ]).then(([data, myEvs, allEvs]) => {
        const norm = (s) => (s || '').trim().toLowerCase();
        const myNames  = new Set((myEvs  || []).map(e => norm(e.name)).filter(Boolean));
        const allNames = new Set((allEvs || []).map(e => norm(e.name)).filter(Boolean));

        const pinned   = data.filter(p => p.category === 'pinned');
        const unpinned = data.filter(p => p.category !== 'pinned');

        const byTimeDesc = (a, b) => {
          const ta = Date.parse(a.time);
          const tb = Date.parse(b.time);
          if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
          return tb - ta;
        };
        pinned.sort(byTimeDesc);
        unpinned.sort(byTimeDesc);

        setMyEventNames(myNames);
        setAllEventNames(allNames);
        setPosts([...pinned, ...unpinned]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    });
  }, []);

  function isVisible(post) {
    if (allEventNames === null || myEventNames === null) return false;
    const cat = (post.category || 'general').trim().toLowerCase();
    if (BROADCAST_CATEGORIES.has(cat)) return true;
    if (allEventNames.has(cat)) return myEventNames.has(cat);
    for (const myName of myEventNames) {
      if (cat.includes(myName) || myName.includes(cat)) return true;
    }
    for (const evName of allEventNames) {
      if (cat.includes(evName) || evName.includes(cat)) return false;
    }
    return true;
  }

  function isEventTargetedPost(post) {
    const cat = (post.category || 'general').trim().toLowerCase();
    if (BROADCAST_CATEGORIES.has(cat)) return false;
    if (allEventNames?.has(cat)) return true;
    for (const evName of allEventNames || []) {
      if (cat.includes(evName) || evName.includes(cat)) return true;
    }
    return false;
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

  const FILTERS = [
    { key: 'all',      label: 'All' },
    { key: 'general',  label: 'General' },
    { key: 'events',   label: 'My Events' },
    { key: 'visitors', label: 'Visitors' },
  ];

  const visible = posts.filter(p => {
    if (!isVisible(p)) return false;
    if (filter === 'all') return true;
    const isEvent = isEventTargetedPost(p);
    const cat = (p.category || 'general').trim().toLowerCase();
    if (filter === 'general') return !isEvent && cat !== 'visitor';
    if (filter === 'events')  return isEvent;
    if (filter === 'visitors') return cat === 'visitor';
    return true;
  });

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
                        const isEv = isEventTargetedPost(p);
                        const cat = (p.category || 'general').trim().toLowerCase();
                        if (f.key === 'visitors') return cat === 'visitor';
                        if (f.key === 'events')   return isEv;
                        if (f.key === 'general')  return !isEv && cat !== 'visitor';
                        return true;
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
            <div style={{ color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)', fontSize: 12, padding: 24, textAlign: 'center' }}>
              {filter === 'events' ? (
                <>
                  <div>No announcements for your events yet.</div>
                  <div style={{ marginTop: 10, opacity: 0.75, textTransform: 'none', letterSpacing: 'normal' }}>
                    {myEventNames && myEventNames.size > 0
                      ? <>You're registered for: <span style={{ color: 'var(--ink)' }}>{[...myEventNames].join(', ')}</span></>
                      : "You don't appear to be registered for any events yet."}
                  </div>
                </>
              ) : filter === 'visitors' ? (
                <div>No visitor announcements yet.</div>
              ) : 'No announcements yet.'}
            </div>
          )}
          {visible.map((p, i) => {
            const pin = p.category === 'pinned' || p.is_pinned;
            const isEventTargeted = isEventTargetedPost(p);
            return (
              <div key={p.id || i} className="glass" style={{
                padding: isMobile ? '16px 18px' : '22px 26px',
                borderColor: pin ? 'rgba(127,119,221,0.45)' : undefined,
                background: pin ? 'rgba(127,119,221,0.06)' : undefined,
                position: 'relative',
              }}>
                {/* Header row: chips + timestamp */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                    {pin && <span className="chip violet" style={{ padding: '2px 8px', fontSize: 9, flexShrink: 0 }}>📌 PINNED</span>}
                    {isEventTargeted && (
                      <span className="chip" style={{ padding: '2px 8px', fontSize: 9, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {p.category}
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {relativeTime(p.time)}
                  </span>
                </div>

                {/* Title */}
                {p.title && (
                  <div style={{
                    marginTop: 12,
                    fontFamily: 'var(--f-display)',
                    fontSize: isMobile ? 18 : 22,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: 'var(--ink)',
                    lineHeight: 1.25,
                  }}>
                    {p.title}
                  </div>
                )}

                {/* Body with link rendering */}
                {p.announcement && (
                  <div style={{
                    marginTop: p.title ? 8 : 12,
                    fontSize: isMobile ? 14 : 15,
                    color: p.title ? 'var(--ink-dim)' : 'var(--ink)',
                    fontWeight: p.title ? 400 : 500,
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    <RichText text={p.announcement} />
                  </div>
                )}
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
