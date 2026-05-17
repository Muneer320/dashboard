// Ascent — Sponsors Page (redesigned)
import React, { useEffect, useRef } from 'react';
import { useMobile, NavBar, PageBackground, Footer } from './shared';

// ─── Data ─────────────────────────────────────────────────────────────────────

const s3Base = "https://ascent-users.s3.ap-south-1.amazonaws.com/sponsors";

const GROUPS = [
  { id: 'platform', label: 'Platform & Infrastructure', accent: '#4285F4', desc: 'The foundational technologies powering the next generation of applications.' },
  { id: 'ecosystem', label: 'Ecosystem & Innovation', accent: '#1D9E75', desc: 'Organisations investing in and accelerating student builders.' },
  { id: 'culture', label: 'Culture & Community', accent: '#F59E0B', desc: 'Brands bringing energy, lifestyle, and community to Ascent 2026.' }
];

const SPONSORS = [
  { name: 'Red Bull',              group: 'culture',   logo: `${s3Base}/RedBull.svg`,             label: 'Energy Partner',    color: '#CC1E10', desc: 'Official Energy Partner of Ascent 2026 — fuelling 48 hours of non-stop building.' },
  { name: 'Google for Developers', group: 'platform',  logo: `${s3Base}/Google%20for%20Developers.svg`, label: 'Platform Partner', color: '#4285F4', desc: 'Empowering developers worldwide with tools, platforms and community.' },
  { name: 'Meta Cognition',        group: 'platform',  logo: `${s3Base}/MetaCognition.svg`,       label: 'AI Partner',      color: '#7C3AED', desc: 'Advancing the frontier of human-AI collaboration and reasoning.' },
  { name: 'Vorflux.AI',            group: 'platform',  logo: `${s3Base}/Vorflux.svg`,             label: 'Infrastructure Partner',      color: '#7F77DD', desc: 'Building next-generation AI infrastructure for the modern web.' },
  { name: 'Together Fund',         group: 'ecosystem', logo: `${s3Base}/TogetherFund.svg`,        label: 'Venture Partner',    color: '#1D9E75', desc: 'Backing the builders of tomorrow through community-led investment.' },
  { name: 'CodeCrafters',          group: 'ecosystem', logo: `${s3Base}/CodeCrafters.svg`,        label: 'Learning Partner',    color: '#7F77DD', desc: 'The platform where engineers learn by rebuilding real-world software.' },
  { name: 'Dymension',             group: 'culture',   logo: `${s3Base}/Dymension.svg`,           label: 'Clothing Partner',    color: '#818CF8', desc: 'The future of fashion, an AI-driven clothing brand redefining style through generative design.' },
  { name: 'Omium AI',              group: 'platform',  logo: `${s3Base}/Omium.svg`,               label: 'Technology Partner',    color: '#1D9E75', desc: 'AI-first solutions for a smarter, more connected world.' },
  { name: 'Fueler',                group: 'ecosystem', logo: `${s3Base}/Fueler.svg`,              label: 'Portfolio Partner',    color: '#E8B974', desc: 'Proof-of-work portfolios for developers, designers, and creators.' },
  { name: 'Eyecandy Robotics',     group: 'ecosystem', logo: `${s3Base}/EyeCandy%20Robotics.svg`, label: 'Robotics Partner',  color: '#EC4899', desc: 'Pushing the edge of embedded systems and autonomous hardware.' },
  { name: 'CCCL Claude Community', group: 'culture',   logo: `${s3Base}/CCCL.svg`,                label: 'Community Partner', color: '#D97706', desc: 'A thriving community of builders exploring the limits of large language models.' },
];

const STATS = [
  { value: '5,000+', label: 'Registered attendees' },
  { value: '24',     label: 'Events across 6 tracks' },
  { value: '48h',    label: 'Of continuous hacking' },
  { value: '6L+',    label: 'Total prize pool' },
  { value: '800+',   label: 'Live demo audience' },
  { value: '11',     label: 'Sponsor organisations' },
];

const PERKS = [
  { title: 'Brand Visibility',    body: 'Your brand front and centre for 5,000+ attendees across banners, digital screens, and swag.' },
  { title: 'Talent Pipeline',     body: 'Direct access to India\'s most motivated student engineers at the peak of their learning curve.' },
  { title: 'Stage Time',          body: 'Keynote and product-demo slots on the main stage to an engaged, technical audience.' },
  { title: 'Event Naming Rights', body: 'Title your track, session, or prize category to build lasting association with the event.' },
  { title: 'Community Reach',     body: 'Prominent placement in all communications — email, social, Discord — reaching our full audience.' },
  { title: 'Prize Sponsorship',   body: 'Fund category prizes and walk away with direct, warm introductions to winning teams.' },
];

// ─── Marquee strip ────────────────────────────────────────────────────────────

function SponsorMarquee({ reverse = false }) {
  const names = SPONSORS.map(s => s.name);
  const all = [...names, ...names, ...names];
  return (
    <div style={{ overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}>
      <style>{`
        @keyframes marqL { from { transform: translateX(0) } to { transform: translateX(-33.333%) } }
        @keyframes marqR { from { transform: translateX(-33.333%) } to { transform: translateX(0) } }
      `}</style>
      <div style={{
        display: 'flex', gap: 64, alignItems: 'center', whiteSpace: 'nowrap',
        animation: `${reverse ? 'marqR' : 'marqL'} 32s linear infinite`,
      }}>
        {all.map((n, i) => {
          const s = SPONSORS.find(x => x.name === n);
          return s?.logo ? (
            <img key={i} src={s.logo} alt={n} style={{ height: 28, opacity: 0.7, objectFit: 'contain' }} />
          ) : (
            <span key={i} style={{
              fontFamily: 'var(--f-display)',
              fontSize: 18, fontWeight: 600,
              color: i % 3 === 0 ? (s?.color || 'var(--ink-dim)') : 'var(--ink-mute)',
              letterSpacing: '0.02em',
            }}>{n}</span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sponsor card (large featured) ───────────────────────────────────────────

function FeaturedCard({ sponsor, isMobile }) {
  return (
    <div style={{
      gridColumn: 'span 1',
      borderRadius: 20,
      border: '1px solid var(--glass-border)',
      background: 'rgba(255,255,255,0.025)',
      backdropFilter: 'blur(14px)',
      overflow: 'hidden',
      position: 'relative',
      minHeight: 200,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: isMobile ? 22 : 32,
      transition: 'border-color .25s, transform .25s',
      cursor: 'default',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = `${sponsor.color}55`;
      e.currentTarget.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = 'var(--glass-border)';
      e.currentTarget.style.transform = 'translateY(0)';
    }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: `radial-gradient(ellipse 80% 60% at 100% 0%, ${sponsor.color}18, transparent 65%)`,
        pointerEvents: 'none',
      }} />
      {/* Grid texture */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        maskImage: 'radial-gradient(ellipse at 80% 20%, #000 20%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      {/* Accent bar top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: sponsor.color, opacity: 0.8,
      }} />

      {/* Tier badge */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 2 }}>
        <span style={{
          fontFamily: 'var(--f-mono)',
          fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: sponsor.color,
          border: `1px solid ${sponsor.color}44`,
          padding: '3px 10px', borderRadius: 999,
          background: `${sponsor.color}0D`,
        }}>{sponsor.label}</span>
      </div>

      {/* Large index number */}
      <div style={{
        position: 'absolute', top: 12, left: 20, zIndex: 1,
        fontFamily: 'var(--f-mono)', fontSize: 11,
        color: 'var(--ink-faint)', letterSpacing: '0.1em',
      }}>{'0' + (SPONSORS.indexOf(sponsor) + 1)}</div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {sponsor.logo ? (
          <img src={sponsor.logo} alt={sponsor.name} style={{ height: 36, marginBottom: 16, maxWidth: '100%', objectFit: 'contain', objectPosition: 'left' }} />
        ) : (
          <div style={{
            fontFamily: 'var(--f-display)',
            fontSize: isMobile ? 22 : 30,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            lineHeight: 1.05,
            marginBottom: 10,
          }}>{sponsor.name}</div>
        )}
        <div style={{
          fontSize: 12.5, color: 'var(--ink-dim)',
          lineHeight: 1.55, maxWidth: 320,
        }}>{sponsor.desc}</div>
      </div>
    </div>
  );
}

// ─── Perk card ────────────────────────────────────────────────────────────────

function PerkCard({ perk, idx }) {
  return (
    <div style={{
      padding: '24px 24px',
      borderRadius: 14,
      border: '1px solid var(--glass-border)',
      background: 'rgba(255,255,255,0.02)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 14, right: 16,
        fontFamily: 'var(--f-mono)', fontSize: 10,
        color: 'var(--ink-faint)', letterSpacing: '0.1em',
      }}>{'0' + (idx + 1)}</div>
      <div style={{
        fontFamily: 'var(--f-display)', fontSize: 16,
        fontWeight: 700, letterSpacing: '-0.01em',
        color: 'var(--ink)', marginBottom: 10,
      }}>{perk.title}</div>
      <div style={{
        fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.6,
      }}>{perk.body}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Sponsors() {
  const isMobile = useMobile();
  const hPad = isMobile ? '20px' : '48px';

  return (
    <PageBackground>
      <NavBar variant="public" active="sponsors" />

      {/* ── HERO ── */}
      <section style={{
        padding: isMobile ? '70px 20px 40px' : '110px 48px 60px',
        position: 'relative', textAlign: 'center',
      }}>
        <div style={{
          position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
          width: 700, height: 700, pointerEvents: 'none',
        }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              position: 'absolute', inset: i * 90, borderRadius: '50%',
              border: '1px solid rgba(127,119,221,0.05)',
              maskImage: 'linear-gradient(180deg, #000 10%, transparent 80%)',
              WebkitMaskImage: 'linear-gradient(180deg, #000 10%, transparent 80%)',
            }} />
          ))}
        </div>

        <div className="fade-up" style={{ position: 'relative', zIndex: 2 }}>
          <div className="eyebrow" style={{ marginBottom: 18 }}>ASCENT 2026 · SPONSORS</div>
          <h1 className="display" style={{
            fontSize: isMobile ? 40 : 76, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.0,
          }}>
            Backed by the<br />
            <span style={{ color: 'var(--violet)' }}>ones who build.</span>
          </h1>
          <p style={{
            marginTop: 22, color: 'var(--ink-dim)',
            fontSize: isMobile ? 14 : 16, lineHeight: 1.65,
            maxWidth: 500, margin: '22px auto 0',
          }}>
            Ascent 2026 is made possible by organisations that believe in
            the next generation of builders, hackers, and tinkerers.
          </p>
        </div>
      </section>

      {/* ── SCROLLING MARQUEE ── */}
      <section style={{
        padding: '22px 0',
        borderTop: '1px solid var(--glass-border)',
        borderBottom: '1px solid var(--glass-border)',
        background: 'rgba(127,119,221,0.03)',
        display: 'flex', flexDirection: 'column', gap: 14,
        overflow: 'hidden',
      }}>
        <SponsorMarquee />
        <SponsorMarquee reverse />
      </section>

      {/* ── STATS STRIP ── */}
      <section style={{ padding: isMobile ? '50px 20px' : '80px 48px', position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: 28 }}>§ 01 · WHY ASCENT</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(6,1fr)',
            border: '1px solid var(--glass-border)',
            borderRadius: 18, overflow: 'hidden',
            background: 'rgba(255,255,255,0.02)',
          }}>
            {STATS.map((st, i) => (
              <div key={i} style={{
                padding: isMobile ? '20px 16px' : '30px 24px',
                borderRight: i < STATS.length - 1 ? '1px solid var(--glass-border)' : 'none',
                borderBottom: isMobile && i < STATS.length - 2 ? '1px solid var(--glass-border)' : 'none',
              }}>
                <div style={{
                  fontFamily: 'var(--f-display)', fontSize: isMobile ? 28 : 34,
                  fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--ink)',
                }}>{st.value}</div>
                <div style={{
                  marginTop: 6, fontFamily: 'var(--f-mono)', fontSize: 9.5,
                  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)',
                }}>{st.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SPONSOR SHOWCASE ── */}
      {GROUPS.map((group, groupIdx) => {
        const groupSponsors = SPONSORS.filter(s => s.group === group.id);
        if (groupSponsors.length === 0) return null;
        
        return (
          <section key={group.id} style={{
            padding: isMobile ? '30px 20px' : '50px 48px',
          }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ marginBottom: 32 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12,
                }}>
                  <div style={{
                    fontFamily: 'var(--f-mono)', fontSize: 9.5,
                    letterSpacing: '0.18em', textTransform: 'uppercase',
                    color: group.accent,
                  }}>§ 0{groupIdx + 2} · {group.label.toUpperCase()}</div>
                  <div style={{
                    flex: 1, height: 1,
                    background: `linear-gradient(90deg, ${group.accent}44, transparent)`,
                  }} />
                </div>
                <div style={{ 
                  color: 'var(--ink-dim)', fontSize: 14, maxWidth: 500, lineHeight: 1.6 
                }}>
                  {group.desc}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                gap: 16,
              }}>
                {groupSponsors.map((sp, i) => (
                  <FeaturedCard
                    key={sp.name}
                    sponsor={sp}
                    isMobile={isMobile}
                  />
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* ── WHAT YOU GET ── */}
      <section style={{ padding: isMobile ? '40px 20px 60px' : '60px 48px 90px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>§ 07 · SPONSOR BENEFITS</div>
          <h2 className="display" style={{
            fontSize: isMobile ? 28 : 44, letterSpacing: '-0.02em',
            marginTop: 14, marginBottom: 36,
          }}>What partners get</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
            gap: 14,
          }}>
            {PERKS.map((p, i) => <PerkCard key={i} perk={p} idx={i} />)}
          </div>
        </div>
      </section>

      {/* ── QUOTE STRIP ── */}
      <section style={{
        padding: isMobile ? '40px 20px' : '60px 48px',
        borderTop: '1px solid var(--glass-border)',
        borderBottom: '1px solid var(--glass-border)',
        background: 'rgba(127,119,221,0.03)',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{
            fontFamily: 'var(--f-display)',
            fontSize: isMobile ? 22 : 34,
            fontWeight: 700, letterSpacing: '-0.02em',
            color: 'var(--ink)', lineHeight: 1.2,
          }}>
            "The best time to put your brand in front of the builders
            who will run tomorrow's companies is{' '}
            <span style={{ color: 'var(--violet)' }}>right now.</span>"
          </div>
          <div style={{
            marginTop: 16, fontFamily: 'var(--f-mono)', fontSize: 10.5,
            letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-mute)',
          }}>— Ascent 2026 Sponsorship Team</div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: isMobile ? '50px 20px 80px' : '70px 48px 110px' }}>
        <div style={{
          maxWidth: 760, margin: '0 auto', textAlign: 'center',
          padding: isMobile ? '36px 24px' : '60px 72px',
          borderRadius: 22,
          border: '1px solid var(--glass-border-strong)',
          background: 'rgba(127,119,221,0.05)',
          backdropFilter: 'blur(20px)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 70% 55% at 50% 0%, rgba(127,119,221,0.14), transparent)',
            pointerEvents: 'none',
          }} />
          {/* Decorative grid */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            pointerEvents: 'none',
          }} />
          <div className="eyebrow" style={{ color: 'var(--violet)', position: 'relative' }}>
            PARTNER WITH ASCENT
          </div>
          <h2 className="display" style={{
            fontSize: isMobile ? 28 : 40, letterSpacing: '-0.02em',
            marginTop: 16, position: 'relative',
          }}>
            Want to reach 5,000+ builders?
          </h2>
          <p style={{
            marginTop: 18, color: 'var(--ink-dim)',
            fontSize: isMobile ? 13.5 : 15, lineHeight: 1.65,
            maxWidth: 460, margin: '18px auto 0', position: 'relative',
          }}>
            Ascent brings together India's sharpest student engineers for two
            days of building, shipping, and competing. Sponsorship slots are
            limited — get in touch early.
          </p>
          <a
            href="mailto:archived-559b490477@example.invalid"
            className="btn primary"
            style={{
              marginTop: 30, display: 'inline-flex',
              padding: isMobile ? '12px 28px' : '14px 36px',
              fontSize: 13.5, position: 'relative',
            }}
          >
            Get in touch
          </a>
        </div>
      </section>

      <Footer />
    </PageBackground>
  );
}
