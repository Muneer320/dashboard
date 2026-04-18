// Ascent — Mirage gallery, Announcements, Lost & Found

function Mirage({ onNav }) {
  const isMobile = useMobile();
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
    <PageBackground bgImage="uploads/dashboard_scene.png" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="mirage" onNav={onNav} />
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

function Announcements({ onNav }) {
  const isMobile = useMobile();
  const posts = [
    { pin: true, t: 'HACK NIGHT BRIEF OUT', when: '2 min ago', body: 'Theme: Resilience. Deliverables live on the team portal. Judges visit at 14:00, 18:00, 22:00 and 02:00. Please be ready with a 60-second intro.' },
    { pin: true, t: 'LUNCH DELAYED TO 13:00', when: '14 min ago', body: 'Kitchen is behind by ~30 minutes. Food QR still active. We\'ll ping again the moment counters open.' },
    { pin: false, t: 'Circuit Rush kit pickup', when: '1 hour ago', body: 'Teams registered for Circuit Rush can collect kits from the Block D lobby until 16:00.' },
    { pin: false, t: 'Mirage · Day 0 photos live', when: '3 hours ago', body: '192 photos from the opening ceremony are now in Mirage. Find yourself, tag friends.' },
    { pin: false, t: 'Robo Wars bracket posted', when: '5 hours ago', body: 'Double elimination, starts tomorrow 11:00 at Robotics Lab. Check Schedule for your slot.' },
    { pin: false, t: 'Lost headphones claimed', when: 'Yesterday', body: 'Black over-ear pair found at Block C · 204 was claimed by its owner. Lost & Found is at the registration desk.' },
  ];
  return (
    <PageBackground bgImage="uploads/dashboard_scene.png" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="announcements" onNav={onNav} />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '40px 28px 80px' }}>
        <div className="eyebrow">§ ORGANIZER BROADCAST</div>
        <h1 className="display" style={{ fontSize: isMobile ? 40 : 64, marginTop: 14, letterSpacing: '-0.02em' }}>Notice board.</h1>
        <div style={{ marginTop: 10, color: 'var(--ink-dim)', fontSize: 14 }}>
          Official word from the organizers. Pinned items sit up top.
        </div>

        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {posts.map((p, i) => (
            <div key={i} className="glass" style={{
              padding: isMobile ? 16 : 22,
              borderColor: p.pin ? 'rgba(127,119,221,0.45)' : undefined,
              background: p.pin ? 'rgba(127,119,221,0.07)' : undefined,
              position: 'relative',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                  {p.pin && <span className="chip violet" style={{ padding: '2px 8px', fontSize: 9, flexShrink: 0 }}>📌 PINNED</span>}
                  <span style={{ fontFamily: 'var(--f-display)', fontSize: isMobile ? 15 : 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{p.t}</span>
                </div>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.when}</span>
              </div>
              <div style={{ marginTop: 10, color: 'var(--ink-dim)', fontSize: 13.5, lineHeight: 1.6 }}>{p.body}</div>
            </div>
          ))}
        </div>
      </div>
    </PageBackground>
  );
}

function LostFound({ onNav }) {
  const isMobile = useMobile();
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
    <PageBackground bgImage="uploads/dashboard_scene.png" blurAmount={18} dimAmount={0.80}>
      <NavBar variant="app" active="" onNav={onNav} />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '40px 28px 80px' }}>
        <div className="eyebrow">§ LOST & FOUND</div>
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

Object.assign(window, { Mirage, Announcements, LostFound });
