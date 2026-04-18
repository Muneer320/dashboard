// Ascent — Landing Page

function Landing({ onNav }) {
  const isMobile = useMobile();
  const heroRef = React.useRef(null);
  const [mouse, setMouse] = React.useState({ x: 0.5, y: 0.5 });

  React.useEffect(() => {
    const el = heroRef.current; if (!el) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      setMouse({
        x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
        y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
      });
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, []);

  const LANDING_BG = 'uploads/landing_hero.jpg';
  const hPad = isMobile ? '20px' : '48px';

  return (
    <PageBackground>
      <NavBar variant="public" active="overview" onNav={onNav} />

      {/* ─────────────── HERO ─────────────── */}
      <section
        ref={heroRef}
        style={{
          position: 'relative',
          minHeight: isMobile ? 600 : 820,
          padding: isMobile ? '60px 20px 80px' : '80px 48px 100px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url('${LANDING_BG}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          filter: 'blur(2px)',
          transform: 'scale(1.04)',
        }}/>
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'linear-gradient(to bottom, rgba(8,8,14,0.68) 0%, rgba(8,8,14,0.42) 45%, rgba(8,8,14,0.88) 100%)',
        }}/>

        {!isMobile && (
          <div style={{
            position: 'absolute',
            width: 600, height: 600,
            borderRadius: '50%',
            left: `calc(${mouse.x * 100}% - 300px)`,
            top: `calc(${mouse.y * 100}% - 300px)`,
            background: 'radial-gradient(closest-side, rgba(127,119,221,0.08), transparent 65%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
            transition: 'left .2s ease, top .2s ease',
          }}/>
        )}

        <Rings />

        <div className="fade-up" style={{ animationDelay: '.1s', marginBottom: 36, marginTop: 20 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '8px 16px 8px 14px',
            border: '1px solid var(--glass-border-strong)',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 999,
            backdropFilter: 'blur(14px)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--teal)',
              boxShadow: '0 0 10px var(--teal)',
              animation: 'pulseGlow 1.6s ease-in-out infinite',
            }}/>
            <span style={{
              fontFamily: 'var(--f-mono)', fontSize: isMobile ? 9 : 11,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'var(--ink-dim)',
            }}>
              Ascent 2026 · May 16–17 · Main Campus
            </span>
          </div>
        </div>

        <h1 className="display fade-up" style={{
          animationDelay: '.25s',
          position: 'relative', zIndex: 2,
          fontSize: isMobile ? 80 : 180,
          lineHeight: 0.86,
          margin: 0,
          textAlign: 'center',
          letterSpacing: '-0.045em',
        }}>
          <span style={{
            background: 'linear-gradient(180deg, #F1EFE8 0%, #F1EFE8 55%, rgba(241,239,232,0.25) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            ASCENT
          </span>
        </h1>

        <div className="fade-up" style={{
          animationDelay: '.45s',
          marginTop: 28, textAlign: 'center',
          position: 'relative', zIndex: 2,
          padding: isMobile ? '0 8px' : 0,
        }}>
          <div style={{
            fontFamily: 'var(--f-display)',
            fontSize: isMobile ? 22 : 30, fontWeight: 500,
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
          }}>
            Escape the Ordinary.
          </div>
          <div style={{
            marginTop: 14, color: 'var(--ink-dim)',
            fontSize: isMobile ? 13 : 15, lineHeight: 1.6,
            maxWidth: 560, margin: '14px auto 0',
          }}>
            Two days. Twenty-four events. One campus turning itself into a machine for the curious.
          </div>
        </div>

        <div className="fade-up" style={{
          animationDelay: '.6s',
          marginTop: 36, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center',
          position: 'relative', zIndex: 2,
        }}>
          <a onClick={() => onNav('credentials')} className="btn primary" style={{ padding: isMobile ? '12px 20px' : '14px 26px', fontSize: 13 }}>
            Get Credentials
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, opacity: 0.7 }}>→</span>
          </a>
          <a onClick={() => onNav('login')} className="btn" style={{ padding: isMobile ? '12px 20px' : '14px 26px', fontSize: 13 }}>
            Login
          </a>
        </div>

        <div className="fade-up" style={{
          animationDelay: '.8s',
          marginTop: isMobile ? 48 : 72,
          width: '100%', maxWidth: 760,
          position: 'relative', zIndex: 2,
          padding: isMobile ? '0 4px' : 0,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 14,
          }}>
            <div className="eyebrow" style={{ fontSize: isMobile ? 9 : undefined }}>T-MINUS · GATES OPEN 09:00 IST</div>
            <div className="eyebrow" style={{ color: 'var(--violet)', fontSize: isMobile ? 9 : undefined }}>// LIVE</div>
          </div>
          <Countdown target="2026-05-16T09:00:00+05:30" />
        </div>

        {!isMobile && (
          <div style={{
            position: 'absolute', bottom: 28, left: 48, right: 48,
            display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--f-mono)', fontSize: 10.5,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            color: 'var(--ink-mute)',
          }}>
            <span>SYS.ONLINE · 42 NODES</span>
            <span>SCROLL ↓</span>
            <span>LAT 12.9716 · LON 77.5946</span>
          </div>
        )}
      </section>

      {/* ─────────────── MARQUEE STRIP ─────────────── */}
      <section style={{
        padding: '18px 0',
        borderTop: '1px solid var(--glass-border)',
        borderBottom: '1px solid var(--glass-border)',
        overflow: 'hidden',
        background: 'rgba(127,119,221,0.03)',
      }}>
        <Marquee />
      </section>

      {/* ─────────────── OVERVIEW / STATS ─────────────── */}
      <section style={{ padding: isMobile ? '60px 20px 40px' : '120px 48px 60px', position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="eyebrow">§ 01 · OVERVIEW</div>
          <h2 className="display" style={{
            fontSize: isMobile ? 36 : 64, marginTop: 18,
            maxWidth: 820, letterSpacing: '-0.02em',
          }}>
            A weekend where <span style={{ color: 'var(--violet)' }}>builders</span>,{' '}
            <span style={{ color: 'var(--teal)' }}>tinkerers</span>, and the genuinely curious collide.
          </h2>
          <div style={{ marginTop: 24, color: 'var(--ink-dim)', fontSize: isMobile ? 14 : 16, lineHeight: 1.65, maxWidth: 620 }}>
            Ascent is the annual tech fest hosted by our college — two days of hackathons, hardware mayhem,
            design jams, late-night pitch sessions, and the kind of conversations you'll remember years later.
          </div>

          <div style={{
            marginTop: isMobile ? 40 : 72,
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            border: '1px solid var(--glass-border)',
            borderRadius: 18,
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.02)',
          }}>
            {[
              { v: 24,   s: '',    l: 'Events across 6 tracks' },
              { v: 2400, s: '+',   l: 'Registered builders' },
              { v: 18,   s: 'L',   l: 'Prize pool (INR)' },
              { v: 48,   s: 'h',   l: 'Of continuous chaos' },
            ].map((st, i) => (
              <div key={i} style={{
                padding: isMobile ? 20 : 32,
                borderRight: isMobile
                  ? (i % 2 === 0 ? '1px solid var(--glass-border)' : 'none')
                  : (i < 3 ? '1px solid var(--glass-border)' : 'none'),
                borderBottom: isMobile && i < 2 ? '1px solid var(--glass-border)' : 'none',
                position: 'relative',
              }}>
                <div className="display" style={{ fontSize: isMobile ? 40 : 64, letterSpacing: '-0.03em' }}>
                  <NumberCounter to={st.v} suffix={st.s} />
                </div>
                <div style={{ marginTop: 10, color: 'var(--ink-mute)', fontSize: isMobile ? 10 : 12, fontFamily: 'var(--f-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {st.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── FEATURE TRIPTYCH ─────────────── */}
      <section style={{ padding: isMobile ? '40px 20px' : '80px 48px', position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: 16,
          }}>
            {[
              { tag: 'BUILD', title: 'Hackathons that don\'t waste your weekend', body: 'Real problems. Real hardware. Real users in the next room. No corporate filler.' },
              { tag: 'SHIP',  title: 'Demo days on the main stage', body: 'Every final rides on a live demo in front of 800 people. Nothing wrong with a little pressure.' },
              { tag: 'CLIMB', title: 'Leaderboards that actually track you', body: 'Ascent awards points across every event, stacking into college and individual rankings.' },
            ].map((c, i) => (
              <div key={i} className="glass" style={{ padding: 28, position: 'relative', overflow: 'hidden' }}>
                <div className="eyebrow" style={{ color: ['var(--violet)','var(--teal)','var(--amber)'][i] }}>// {c.tag}</div>
                <div className="display" style={{ fontSize: 24, marginTop: 18, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
                  {c.title}
                </div>
                <div style={{ marginTop: 14, color: 'var(--ink-dim)', fontSize: 13.5, lineHeight: 1.55 }}>
                  {c.body}
                </div>
                <div style={{
                  position: 'absolute', right: 18, top: 18,
                  fontFamily: 'var(--f-mono)', fontSize: 10,
                  color: 'var(--ink-faint)', letterSpacing: '0.2em',
                }}>0{i+1}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── POSTER SHOWCASE ─────────────── */}
      <section style={{ padding: isMobile ? '40px 20px' : '80px 48px', position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end',
            marginBottom: 28, gap: 12,
          }}>
            <div>
              <div className="eyebrow">§ 02 · POSTERS</div>
              <h2 className="display" style={{ fontSize: isMobile ? 32 : 44, marginTop: 16, letterSpacing: '-0.02em' }}>
                This year's headliners.
              </h2>
            </div>
            <a onClick={() => onNav('explore')} className="btn sm">See all 24 events →</a>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 16,
          }}>
            {[
              { title: 'MIRAGE', tone: 'violet' },
              { title: 'CIRCUIT RUSH', tone: 'teal' },
              { title: 'PITCH./DEV', tone: 'amber' },
              { title: 'HACK NIGHT', tone: 'violet' },
            ].map(({ title, tone }) => (
              <PosterPlaceholder key={title} title={title} sub="700 × 400" w="100%" h={isMobile ? 200 : 340} tone={tone} />
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── SPONSOR WALL ─────────────── */}
      <section style={{ padding: isMobile ? '60px 0 40px' : '100px 0 60px', position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto 28px', padding: `0 ${hPad}` }}>
          <div className="eyebrow">§ 03 · PARTNERS</div>
          <h2 className="display" style={{ fontSize: isMobile ? 32 : 44, marginTop: 16, letterSpacing: '-0.02em' }}>
            Backed by the ones who build.
          </h2>
        </div>
        <SponsorStrip isMobile={isMobile} />
      </section>

      {/* ─────────────── FAQ ─────────────── */}
      <section style={{ padding: isMobile ? '60px 20px 40px' : '100px 48px 40px', position: 'relative' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div className="eyebrow">§ 04 · FAQ</div>
          <h2 className="display" style={{ fontSize: isMobile ? 32 : 44, marginTop: 16, letterSpacing: '-0.02em' }}>
            Questions, answered.
          </h2>
          <div style={{ marginTop: 40 }}>
            <FAQList />
          </div>
        </div>
      </section>

      <Footer />
    </PageBackground>
  );
}

// ─────────────────────────────────────────────────────────────
// Concentric rings background behind hero
// ─────────────────────────────────────────────────────────────
function Rings() {
  return (
    <div style={{
      position: 'absolute',
      top: 240, left: '50%', transform: 'translateX(-50%)',
      width: 900, height: 900,
      pointerEvents: 'none',
    }}>
      {[0,1,2,3,4,5].map(i => (
        <div key={i} style={{
          position: 'absolute',
          inset: i * 70,
          borderRadius: '50%',
          border: '1px solid rgba(241,239,232,0.04)',
          maskImage: 'linear-gradient(180deg, #000 10%, transparent 90%)',
          WebkitMaskImage: 'linear-gradient(180deg, #000 10%, transparent 90%)',
        }}/>
      ))}
      <div style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
      }}>
        <div style={{
          width: 4, height: 4, borderRadius: '50%',
          background: 'var(--violet)', boxShadow: '0 0 20px var(--violet)',
        }}/>
      </div>
    </div>
  );
}

function Marquee() {
  const items = ['HACK NIGHT', '★', 'CIRCUIT RUSH', '★', 'MIRAGE', '★', 'PITCH./DEV', '★', 'CODE CLASH', '★', 'DESIGN JAM', '★', 'ROBO WARS', '★', 'QUANTUM QUIZ', '★'];
  return (
    <div style={{ display: 'flex', gap: 48, whiteSpace: 'nowrap', animation: 'marq 40s linear infinite' }}>
      <style>{`@keyframes marq { to { transform: translateX(-50%); } }`}</style>
      {[...items, ...items].map((t, i) => (
        <span key={i} style={{
          fontFamily: 'var(--f-display)',
          fontSize: 22, fontWeight: 500,
          color: t === '★' ? 'var(--violet)' : 'var(--ink-dim)',
          letterSpacing: t === '★' ? 0 : '0.04em',
        }}>{t}</span>
      ))}
    </div>
  );
}

function SponsorStrip({ isMobile }) {
  const tiers = [
    { label: 'TITLE', names: ['NIMBUS/AI', 'HELIOS'] },
    { label: 'PLATINUM', names: ['MONORAIL', 'GRIDLOCK', 'UMBRA'] },
    { label: 'GOLD', names: ['FORMA', 'KERNEL', 'QUANTA', 'REFRACT', 'SPINDLE'] },
    { label: 'COMMUNITY', names: ['DEVSTACK', 'LOOPCO', 'MOSAIC', 'PARAGON', 'ATLAS', 'VIREO'] },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tiers.map(tier => (
        <div key={tier.label} style={{
          display: isMobile ? 'flex' : 'grid',
          flexDirection: isMobile ? 'column' : undefined,
          gridTemplateColumns: isMobile ? undefined : '120px 1fr',
          padding: isMobile ? '20px 20px' : '24px 48px',
          borderTop: '1px solid var(--glass-border)',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: isMobile ? 10 : 0,
        }}>
          <div className="eyebrow" style={{ color: 'var(--ink-mute)', minWidth: isMobile ? undefined : 120 }}>{tier.label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 16 : 32, rowGap: 14 }}>
            {tier.names.map(n => (
              <div key={n} style={{
                fontFamily: 'var(--f-display)',
                fontSize: tier.label === 'TITLE' ? (isMobile ? 22 : 32) : tier.label === 'PLATINUM' ? (isMobile ? 18 : 24) : (isMobile ? 15 : 18),
                fontWeight: 600,
                color: tier.label === 'TITLE' ? 'var(--ink)' : 'var(--ink-dim)',
                letterSpacing: '-0.01em',
                cursor: 'pointer', transition: 'color .2s, text-shadow .2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--violet)'; e.currentTarget.style.textShadow = '0 0 24px rgba(127,119,221,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = tier.label === 'TITLE' ? 'var(--ink)' : 'var(--ink-dim)'; e.currentTarget.style.textShadow = 'none'; }}
              >
                {n}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FAQList() {
  const faqs = [
    { q: 'Who can participate?', a: 'Any undergraduate or postgraduate student with a valid college ID. We also run a short open track for first-year students and a couple of invite-only finals.' },
    { q: 'How do I get credentials?', a: 'Fill out the request form on the Get Credentials page. Our organizers verify your college ID and email, then send your login within 24 hours.' },
    { q: 'Is there a participation fee?', a: 'Entry to the campus and most events is free. A handful of premium events (Hack Night, Robo Wars) carry a small registration fee that covers kits, food, and prizes.' },
    { q: 'Can I form my own team?', a: 'Yes. Most events allow teams of 2–4. We also run a matchmaking thread on our Discord if you\'re flying solo.' },
    { q: 'Where does the fest happen?', a: 'Across the main campus — block C for coding tracks, the robotics lab for hardware events, and the auditorium for finals. A full map ships with your credentials.' },
    { q: 'What about food and stay?', a: 'All meals are covered by your Food QR. Outstation participants get a hostel bed (limited, first-come, first-served — request on the form).' },
  ];
  const [open, setOpen] = React.useState(0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ borderTop: '1px solid var(--glass-border)' }}>
            <div
              onClick={() => setOpen(isOpen ? -1 : i)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '22px 4px',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', flexShrink: 0 }}>
                  0{i+1}
                </span>
                <span style={{
                  fontFamily: 'var(--f-display)',
                  fontSize: 17, fontWeight: 500,
                  letterSpacing: '-0.01em',
                  color: isOpen ? 'var(--ink)' : 'var(--ink-dim)',
                  transition: 'color .2s',
                }}>{f.q}</span>
              </div>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                border: '1px solid var(--glass-border-strong)',
                display: 'grid', placeItems: 'center',
                color: 'var(--ink-dim)', flexShrink: 0, marginLeft: 12,
                transform: isOpen ? 'rotate(45deg)' : 'rotate(0)',
                transition: 'transform .3s',
              }}>+</div>
            </div>
            <div style={{
              overflow: 'hidden',
              maxHeight: isOpen ? 200 : 0,
              transition: 'max-height .4s ease',
            }}>
              <div style={{
                padding: '0 4px 22px 32px',
                color: 'var(--ink-dim)',
                fontSize: 14, lineHeight: 1.6, maxWidth: 700,
              }}>{f.a}</div>
            </div>
          </div>
        );
      })}
      <div style={{ borderTop: '1px solid var(--glass-border)' }}/>
    </div>
  );
}

Object.assign(window, { Landing });
