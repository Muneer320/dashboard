// Ascent — Sponsors Page
import React from 'react';
import { useMobile, NavBar, PageBackground, Footer } from './shared';

// ─── Sponsor data ─────────────────────────────────────────────────────────────

const SPONSORS = {
  'Google for Developers': { tag: 'GOLD',      color: '#4285F4' },
  'Red Bull':              { tag: 'ENERGY',    color: '#CC1E10' },
  'Together Fund':         { tag: 'SILVER',    color: '#1D9E75' },
  'CodeCrafters':          { tag: 'SILVER',    color: '#7F77DD' },
  'CCCL Claude Community': { tag: 'COMMUNITY', color: '#D97706' },
  'Maximem AI':            { tag: 'SILVER',    color: '#7F77DD' },
  'Omium AI':              { tag: 'SILVER',    color: '#1D9E75' },
  'Eyecandy Robotics':     { tag: 'ROBOTICS',  color: '#EC4899' },
  'Meta Cognition':        { tag: 'GOLD',      color: '#7C3AED' },
  'Vorflux.AI':            { tag: 'GOLD',      color: '#7F77DD' },
  'Fueler':                { tag: 'SILVER',    color: '#E8B974' },
};

// event → sponsors list
const EVENT_SPONSORS = [
  {
    event: 'General',
    sub: 'Official Energy Partner',
    sponsors: ['Red Bull'],
    accent: '#CC1E10',
    // SVG path for a lightning bolt
    iconPath: 'M13 2L4.5 13.5H11L9 22L19.5 10H13L13 2Z',
  },
  {
    event: 'Ship to Scale',
    sub: null,
    sponsors: ['Meta Cognition', 'Vorflux.AI', 'Together Fund', 'CCCL Claude Community'],
    accent: '#7F77DD',
    // Rocket / arrow up-right
    iconPath: 'M5 19L19 5M19 5H9M19 5V15',
  },
  {
    event: 'Anvil',
    sub: 'Hardware Hackathon',
    sponsors: ['Fueler', 'CodeCrafters', 'Maximem AI', 'Omium AI'],
    accent: '#1D9E75',
    // Wrench / tool
    iconPath: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  },
  {
    event: 'Robotics',
    sub: null,
    sponsors: ['Eyecandy Robotics'],
    accent: '#EC4899',
    // CPU / chip
    iconPath: 'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18',
  },
  {
    event: 'Impulse & Invariant',
    sub: 'Competitive Programming',
    sponsors: ['CodeCrafters'],
    accent: '#E8B974',
    // Code brackets
    iconPath: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  },
  {
    event: 'Tech Play Zone',
    sub: null,
    sponsors: ['Fueler'],
    accent: '#E8B974',
    // Gamepad / grid
    iconPath: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  },
  {
    event: 'PromptWars',
    sub: 'AI Prompt Engineering',
    sponsors: ['Google for Developers'],
    accent: '#4285F4',
    // Sparkle / star
    iconPath: 'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z',
  },
];

// Tier order for the master wall
const TIER_ORDER = ['GOLD', 'ENERGY', 'SILVER', 'ROBOTICS', 'COMMUNITY'];
const TIER_LABELS = {
  GOLD:      'GOLD',
  ENERGY:    'ENERGY PARTNER',
  SILVER:    'SILVER',
  ROBOTICS:  'ROBOTICS',
  COMMUNITY: 'COMMUNITY',
};
const TIER_SIZE = { GOLD: 28, ENERGY: 24, SILVER: 20, ROBOTICS: 18, COMMUNITY: 17 };

// ─── SVG icon helper ─────────────────────────────────────────────────────────

function Icon({ path, size = 16, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

// ─── Components ───────────────────────────────────────────────────────────────

function SponsorChip({ name, small = false }) {
  const s = SPONSORS[name] || { tag: 'PARTNER', color: '#7F77DD' };
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: small ? '5px 11px' : '8px 16px',
        borderRadius: 999,
        border: '1px solid var(--glass-border)',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(8px)',
        transition: 'border-color .2s, background .2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${s.color}66`;
        e.currentTarget.style.background = `${s.color}12`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--glass-border)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
      }}
    >
      <span style={{
        width: small ? 5 : 6,
        height: small ? 5 : 6,
        borderRadius: '50%',
        background: s.color,
        boxShadow: `0 0 6px ${s.color}`,
        flexShrink: 0,
      }} />
      <span style={{
        fontFamily: 'var(--f-body)',
        fontWeight: 600,
        fontSize: small ? 11.5 : 13,
        color: 'var(--ink)',
        whiteSpace: 'nowrap',
      }}>{name}</span>
    </div>
  );
}

function EventCard({ data, isMobile }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: '1px solid var(--glass-border)',
        background: 'rgba(255,255,255,0.025)',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Coloured accent bar on the left edge */}
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: 3,
        background: data.accent,
        borderRadius: '16px 0 0 16px',
      }} />

      {/* Subtle top-right ambient glow */}
      <div style={{
        position: 'absolute',
        top: -50, right: -50,
        width: 180, height: 180,
        borderRadius: '50%',
        background: `radial-gradient(closest-side, ${data.accent}18, transparent)`,
        pointerEvents: 'none',
      }} />

      <div style={{ padding: isMobile ? '18px 18px 18px 22px' : '26px 26px 26px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          {/* Icon box — consistent size, color driven by accent */}
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--glass-border)',
            display: 'grid', placeItems: 'center',
            flexShrink: 0,
            color: data.accent,
          }}>
            <Icon path={data.iconPath} size={15} color={data.accent} strokeWidth={1.9} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--f-display)',
              fontSize: isMobile ? 16 : 18,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--ink)',
            }}>{data.event}</div>
            {data.sub && (
              <div style={{
                fontFamily: 'var(--f-mono)',
                fontSize: 9.5,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--ink-mute)',
                marginTop: 3,
              }}>{data.sub}</div>
            )}
          </div>

          <div style={{
            fontFamily: 'var(--f-mono)',
            fontSize: 8.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: data.accent,
            border: `1px solid ${data.accent}44`,
            padding: '3px 8px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            {data.sponsors.length} sponsor{data.sponsors.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {data.sponsors.map(s => <SponsorChip key={s} name={s} small />)}
        </div>
      </div>
    </div>
  );
}

function TierRow({ label, names, isMobile }) {
  const size = TIER_SIZE[label] ?? 18;
  return (
    <div style={{
      display: isMobile ? 'flex' : 'grid',
      flexDirection: isMobile ? 'column' : undefined,
      gridTemplateColumns: isMobile ? undefined : '160px 1fr',
      padding: isMobile ? '20px 20px' : '28px 48px',
      borderTop: '1px solid var(--glass-border)',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: isMobile ? 12 : 0,
    }}>
      <div style={{
        fontFamily: 'var(--f-mono)',
        fontSize: 9.5,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--ink-mute)',
        minWidth: isMobile ? undefined : 160,
      }}>
        {TIER_LABELS[label]}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 12 : 24, rowGap: 14 }}>
        {names.map(name => {
          const s = SPONSORS[name] || {};
          return (
            <div
              key={name}
              style={{
                fontFamily: 'var(--f-display)',
                fontSize: size,
                fontWeight: 700,
                color: label === 'GOLD' ? 'var(--ink)' : 'var(--ink-dim)',
                letterSpacing: '-0.01em',
                cursor: 'default',
                transition: 'color .2s, text-shadow .2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = s.color || '#7F77DD';
                e.currentTarget.style.textShadow = `0 0 28px ${s.color || '#7F77DD'}88`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = label === 'GOLD' ? 'var(--ink)' : 'var(--ink-dim)';
                e.currentTarget.style.textShadow = 'none';
              }}
            >
              {name}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Sponsors() {
  const isMobile = useMobile();
  const hPad = isMobile ? '20px' : '48px';

  // Group sponsors by tier for the master wall
  const byTier = {};
  Object.entries(SPONSORS).forEach(([name, { tag }]) => {
    if (!byTier[tag]) byTier[tag] = [];
    byTier[tag].push(name);
  });

  return (
    <PageBackground>
      <NavBar variant="public" active="sponsors" />

      {/* ── HERO ── */}
      <section style={{
        padding: isMobile ? '70px 20px 50px' : '110px 48px 70px',
        position: 'relative',
        textAlign: 'center',
      }}>
        {/* Decorative rings */}
        <div style={{
          position: 'absolute', top: 60, left: '50%',
          transform: 'translateX(-50%)',
          width: 600, height: 600,
          pointerEvents: 'none',
        }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              position: 'absolute',
              inset: i * 80,
              borderRadius: '50%',
              border: '1px solid rgba(127,119,221,0.06)',
              maskImage: 'linear-gradient(180deg, #000 10%, transparent 85%)',
              WebkitMaskImage: 'linear-gradient(180deg, #000 10%, transparent 85%)',
            }} />
          ))}
        </div>

        <div className="fade-up" style={{ position: 'relative', zIndex: 2 }}>
          <div className="eyebrow" style={{ marginBottom: 20 }}>§ SPONSORS · ASCENT 2026</div>
          <h1 className="display" style={{
            fontSize: isMobile ? 38 : 72,
            letterSpacing: '-0.03em',
            margin: 0,
            lineHeight: 1,
          }}>
            Backed by the<br />
            <span style={{ color: 'var(--violet)' }}>ones who build.</span>
          </h1>
          <p style={{
            marginTop: 24,
            color: 'var(--ink-dim)',
            fontSize: isMobile ? 14 : 16,
            lineHeight: 1.65,
            maxWidth: 520,
            margin: '24px auto 0',
          }}>
            Ascent 2026 is powered by organisations that believe in the next
            generation of builders, hackers, and tinkerers.
          </p>
        </div>
      </section>

      {/* ── SPONSOR WALL ── */}
      <section style={{
        padding: isMobile ? '0 0 60px' : '0 0 80px',
        position: 'relative',
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto 28px',
          padding: `0 ${hPad}`,
        }}>
          <div className="eyebrow">§ 01 · ALL SPONSORS</div>
        </div>

        <div style={{ borderTop: '1px solid var(--glass-border)' }}>
          {TIER_ORDER.filter(t => byTier[t]).map(tier => (
            <TierRow
              key={tier}
              label={tier}
              names={byTier[tier]}
              isMobile={isMobile}
            />
          ))}
        </div>
      </section>

      {/* ── EVENT × SPONSOR MAP ── */}
      <section style={{
        padding: isMobile ? '40px 20px 80px' : '60px 48px 100px',
        position: 'relative',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>§ 02 · EVENT PARTNERS</div>
          <h2 className="display" style={{
            fontSize: isMobile ? 28 : 44,
            letterSpacing: '-0.02em',
            marginTop: 16,
            marginBottom: 36,
          }}>
            Who's powering what
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: 16,
          }}>
            {EVENT_SPONSORS.map(data => (
              <EventCard key={data.event} data={data} isMobile={isMobile} />
            ))}
          </div>
        </div>
      </section>

      {/* ── BECOME A SPONSOR CTA ── */}
      <section style={{
        padding: isMobile ? '20px 20px 80px' : '20px 48px 100px',
        position: 'relative',
      }}>
        <div style={{
          maxWidth: 780,
          margin: '0 auto',
          textAlign: 'center',
          padding: isMobile ? '36px 24px' : '52px 64px',
          borderRadius: 20,
          border: '1px solid var(--glass-border-strong)',
          background: 'rgba(127,119,221,0.05)',
          backdropFilter: 'blur(20px)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(127,119,221,0.12), transparent)',
            pointerEvents: 'none',
          }} />
          <div className="eyebrow" style={{ color: 'var(--violet)', position: 'relative' }}>
            PARTNER WITH US
          </div>
          <h2 className="display" style={{
            fontSize: isMobile ? 26 : 38,
            letterSpacing: '-0.02em',
            marginTop: 16,
            position: 'relative',
          }}>
            Want to reach 5,000+ builders?
          </h2>
          <p style={{
            marginTop: 16,
            color: 'var(--ink-dim)',
            fontSize: isMobile ? 13.5 : 15,
            lineHeight: 1.65,
            maxWidth: 480,
            margin: '16px auto 0',
            position: 'relative',
          }}>
            Ascent 2026 brings together India's sharpest student engineers for
            two days of building, shipping, and competing. Get in front of them.
          </p>
          <a
            href="mailto:archived-559b490477@example.invalid"
            className="btn primary"
            style={{
              marginTop: 28,
              display: 'inline-flex',
              padding: isMobile ? '12px 24px' : '14px 32px',
              fontSize: 13,
              position: 'relative',
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
