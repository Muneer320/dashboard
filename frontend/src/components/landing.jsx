// Ascent — Landing Page
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobile, NavBar, PageBackground, Countdown, NumberCounter, PosterPlaceholder, Footer } from './shared';

export default function Landing() {
  const navigate = useNavigate();
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

  const LANDING_BG = 'https://res.cloudinary.com/dglvt0iom/image/upload/v1776879187/landing_hero_x2pe3l.jpg';
  const hPad = isMobile ? '20px' : '48px';

  return (
    <PageBackground>
      <NavBar variant="public" active="overview" />

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
          margin: 0,
          textAlign: 'center',
        }}>
          <img 
            src="https://res.cloudinary.com/dglvt0iom/image/upload/v1777041823/ascent_logo_uvllh8.svg" 
            alt="Ascent" 
            style={{ 
              height: isMobile ? 80 : 180, 
              display: 'inline-block',
              filter: 'drop-shadow(0px 10px 30px rgba(127,119,221,0.2))' 
            }} 
          />
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
          {/* <a onClick={() => navigate('/credentials')} className="btn primary" style={{ padding: isMobile ? '12px 20px' : '14px 26px', fontSize: 13 }}>
            Register
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, opacity: 0.7 }}>→</span>
          </a> */}
          <a onClick={() => navigate('/login')} className="btn" style={{ padding: isMobile ? '12px 20px' : '14px 26px', fontSize: 13 }}>
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
            Ascent is the annual tech fest hosted by <span style={{ color: 'var(--teal)' }}>Scaler School of Technology</span> — two days of hackathons, hardware mayhem,
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
              { v: 20,   s: '',    l: 'Events across 6 tracks' },
              { v: 5000, s: '+',   l: 'Registered builders' },
              { v: 6,   s: 'L',   l: 'Prize pool' },
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
              { tag: 'BUILD', title: "Hackathons that don't waste your weekend", body: 'Real problems. Real hardware. Real users in the next room. No corporate filler.' },
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
                Our Flagships
              </h2>
            </div>
            <a href="/explore" rel="noopener noreferrer" className="btn sm">See all events →</a>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 16,
          }}>
            {[
              { title: 'Anvil', imgUrl: 'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878460/Anvil_poydj2.png', linkUrl: 'https://unstop.com/hackathons/the-anvil-hackathon-ascent-scaler-school-of-technology-bengaluru-karnataka-1669632' },
              { title: 'Ship to Scale', imgUrl: 'https://res.cloudinary.com/dt1hemzmb/image/upload/f_auto,q_auto/1000126955_jjytt0', linkUrl: 'https://unstop.com/events/ship-to-scale-build-break-bank-ascent-scaler-school-of-technology-bengaluru-karnataka-1679327' },
              { title: 'Impulse', imgUrl: 'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878460/Impulse_fhczet.png', linkUrl: 'https://unstop.com/hackathons/impulse-cp-team-contest-ascent-scaler-school-of-technology-bengaluru-karnataka-1669639' },
              { title: 'Launchpad', imgUrl: 'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878460/Launchpad_dixz7h.png', linkUrl: 'https://unstop.com/events/launchpad-from-idea-to-impact-ascent-scaler-school-of-technology-bengaluru-karnataka-1669644' },
            ].map(({ title, imgUrl, linkUrl }) => (
              linkUrl ? (
                <a key={title} href={linkUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
                  <PosterPlaceholder title={title} imgUrl={imgUrl} w="100%" h={isMobile ? 200 : 340} />
                </a>
              ) : (
                <div key={title}>
                  <PosterPlaceholder title={title} imgUrl={imgUrl} w="100%" h={isMobile ? 200 : 340} />
                </div>
              )
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── SPONSOR WALL ─────────────── */}
      <section style={{ padding: isMobile ? '60px 0 40px' : '100px 0 60px', position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto 28px', padding: `0 ${hPad}`, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <h2 className="display" style={{ fontSize: isMobile ? 32 : 44, marginTop: 16, letterSpacing: '-0.02em', margin: 'auto' }}>
            Backed by the ones who build.
          </h2>
        </div>
      <SponsorStrip isMobile={isMobile} />
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

const s3Base = "https://ascent-users.s3.ap-south-1.amazonaws.com/sponsors";
const SPONSORS_LIST = [
  { name: 'Red Bull',              logo: `${s3Base}/RedBull.svg` },
  { name: 'Google for Developers', logo: `${s3Base}/Google%20for%20Developers.svg` },
  { name: 'Meta Cognition',        logo: `${s3Base}/MetaCognition.svg` },
  { name: 'Vorflux.AI',            logo: `${s3Base}/Vorflux.svg` },
  { name: 'Together Fund',         logo: `${s3Base}/TogetherFund.svg` },
  { name: 'CodeCrafters',          logo: `${s3Base}/CodeCrafters.svg` },
  { name: 'Dymension',             logo: `${s3Base}/Dymension.svg` },
  { name: 'Omium AI',              logo: `${s3Base}/Omium.svg` },
  { name: 'Fueler',                logo: `${s3Base}/Fueler.svg` },
  { name: 'Eyecandy Robotics',     logo: `${s3Base}/EyeCandy%20Robotics.svg` },
  { name: 'CCCL Claude Community', logo: `${s3Base}/CCCL.svg` },
];

function Marquee() {
  const all = [...SPONSORS_LIST, ...SPONSORS_LIST, ...SPONSORS_LIST];
  return (
    <div style={{ 
      display: 'flex', 
      gap: 64, 
      alignItems: 'center', 
      whiteSpace: 'nowrap', 
      animation: 'marq 40s linear infinite',
      width: 'fit-content'
    }}>
      <style>{`@keyframes marq { from { transform: translateX(0); } to { transform: translateX(-33.333%); } }`}</style>
      {all.map((s, i) => (
        <React.Fragment key={i}>
          {s.logo ? (
            <img 
              src={s.logo} 
              alt={s.name} 
              style={{ height: 26, opacity: 0.7, objectFit: 'contain' }} 
            />
          ) : (
            <span style={{
              fontFamily: 'var(--f-display)',
              fontSize: 20, fontWeight: 500,
              color: 'var(--ink-dim)',
              letterSpacing: '0.04em',
            }}>{s.name}</span>
          )}
          <span style={{ color: 'var(--violet)', fontSize: 18, opacity: 0.5 }}>★</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function SponsorStrip({ isMobile }) {
  return (
    <div style={{
      padding: isMobile ? '32px 20px' : '40px 48px',
      borderTop: '1px solid var(--glass-border)',
    }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: isMobile ? 32 : 56,
        rowGap: isMobile ? 28 : 40,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {SPONSORS_LIST.map(s => (
          <div key={s.name}
            style={{ transition: 'transform .2s, opacity .2s', cursor: 'pointer', opacity: 0.85 }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '0.85'; }}
          >
            {s.logo ? (
              <img
                src={s.logo}
                alt={s.name}
                style={{
                  height: isMobile ? 26 : 34,
                  maxWidth: isMobile ? 120 : 160,
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div style={{
                fontFamily: 'var(--f-display)',
                fontSize: isMobile ? 16 : 20,
                fontWeight: 600,
                color: 'var(--ink)',
                letterSpacing: '-0.01em',
              }}>{s.name}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

