import React from 'react';

function sortedSlides(moment) {
  const list = Array.isArray(moment?.images) ? moment.images.slice() : [];
  list.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  return list;
}

export function MirageMomentHero({ moment, isMobile, eyebrowLabel = 'Moment of the day' }) {
  const slides = React.useMemo(() => sortedSlides(moment), [moment]);
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [broken, setBroken] = React.useState({});

  React.useEffect(() => {
    setIndex(0);
    setBroken({});
  }, [moment?.momentId]);

  React.useEffect(() => {
    if (!slides.length || paused) return undefined;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 7800);
    return () => window.clearInterval(id);
  }, [slides.length, paused, moment?.momentId]);

  if (!moment || !slides.length) return null;

  const clampedIndex = Math.min(index, slides.length - 1);
  const slide = slides[clampedIndex] || slides[0];
  const src =
    slide && !broken[slide.imageId]
      ? slide.imageUrl || slide.thumbnailUrl
      : null;
  const label = `${clampedIndex + 1} / ${slides.length}`;

  const go = (direction) => {
    setPaused(true);
    setIndex((i) => {
      const n = slides.length;
      if (!n) return 0;
      return direction === 'next'
        ? (i + 1) % n
        : (i - 1 + n) % n;
    });
  };

  return (
    <section
      className="glass"
      style={{
        marginTop: isMobile ? 18 : 24,
        padding: 0,
        overflow: 'hidden',
        borderRadius: 26,
        position: 'relative',
        border: '1px solid rgba(255,255,255,0.09)',
      }}
    >
      <div style={{ height: isMobile ? 320 : 420, position: 'relative' }}>
        <div style={{ padding: '20px 20px 0', position: 'relative', zIndex: 3 }}>
          <div style={{ letterSpacing: '0.42em', textTransform: 'uppercase', fontSize: 10, opacity: 0.55 }}>
            {eyebrowLabel}
          </div>
          <h2
            className="display"
            style={{
              fontSize: isMobile ? 28 : 40,
              margin: '12px 0 4px',
              letterSpacing: '-0.04em',
              lineHeight: 1.05,
            }}
          >
            {moment.title}
          </h2>
          {moment.subtitle ? (
            <div style={{ color: 'var(--ink-dim)', maxWidth: 520, fontSize: 13, lineHeight: 1.55 }}>
              {moment.subtitle}
            </div>
          ) : null}
        </div>

        <div style={{ flex: 1, position: 'absolute', inset: 0 }}>
          {/* Layered vignette */}
          <div style={{ pointerEvents: 'none', inset: 0, position: 'absolute', background: 'linear-gradient(180deg,rgba(3,8,26,0.65) 0%,rgba(3,8,26,0.15) 32%,rgba(3,8,26,0.75) 100%)', zIndex: 1 }} />

          {slides.map((s, i) => {
            const visible = i === clampedIndex;
            const fadeSrc =
              s && !broken[s.imageId] ? s.imageUrl || s.thumbnailUrl : null;
            return (
              <img
                key={s.imageId}
                alt=""
                src={fadeSrc || ''}
                onError={() =>
                  fadeSrc &&
                  setBroken((prev) => ({ ...prev, [s.imageId]: true }))
                }
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: visible ? 1 : 0,
                  transition: 'opacity 980ms cubic-bezier(.4,.16,.22,1)',
                  zIndex: 0,
                }}
              />
            );
          })}
          {!src ? (
            <div style={{ inset: 0, position: 'absolute', display: 'grid', placeItems: 'center', color: '#c8d1ff52', letterSpacing: '0.2em', fontSize: 11, textTransform: 'uppercase', zIndex: 0 }}>
              Slide unavailable
            </div>
          ) : null}
        </div>

        <div
          style={{
            position: 'absolute',
            left: isMobile ? 16 : 24,
            right: isMobile ? 16 : 24,
            bottom: isMobile ? 16 : 20,
            display: 'flex',
            gap: isMobile ? 12 : 16,
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'flex-end',
            justifyContent: 'space-between',
            zIndex: 4,
          }}
        >
          <div style={{ flex: '1 1 auto' }}>
            {(slide.participants || []).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, opacity: 0.55 }}>Featuring</span>
                {(slide.participants || []).map((p) => (
                  <span
                    key={p.userId}
                    style={{
                      borderRadius: 999,
                      padding: '4px 10px',
                      background: 'rgba(255,255,255,0.09)',
                      fontSize: 12,
                      border: '1px solid rgba(255,255,255,0.12)',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    {p.name || p.username || p.userId.slice(0, 8)}
                  </span>
                ))}
              </div>
            )}
            {slide.slideTitle ? (
              <div style={{ marginTop: 10, fontSize: 13, color: '#f3f5ffbf' }}>{slide.slideTitle}</div>
            ) : null}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--f-mono)', letterSpacing: '0.08em', fontSize: 10, opacity: 0.55 }}>
              {label}
            </span>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => go('prev')}
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(8,14,42,0.35)',
                color: 'var(--ink)',
                backdropFilter: 'blur(14px)',
                cursor: 'pointer',
              }}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => go('next')}
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(8,14,42,0.35)',
                color: 'var(--ink)',
                backdropFilter: 'blur(14px)',
                cursor: 'pointer',
              }}
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
