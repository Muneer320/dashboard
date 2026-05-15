import React from 'react';

import { getMirageMomentHeroState } from './mirageMomentHeroState';

function clampPercent(value, fallback = 50) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(0, Math.min(100, next));
}

function clampZoom(value, fallback = 1) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(1, Math.min(2.5, next));
}

function cropTransform(slide) {
  const cropX = clampPercent(slide?.cropX, 50);
  const cropY = clampPercent(slide?.cropY, 50);
  const cropZoom = clampZoom(slide?.cropZoom, 1);
  return {
    objectPosition: `${cropX}% ${cropY}%`,
    transform: `scale(${cropZoom})`,
    transformOrigin: `${cropX}% ${cropY}%`,
  };
}

function heroFrameStyle(isMobile) {
  return {
    width: '100%',
    aspectRatio: isMobile ? '16 / 10' : '16 / 8.8',
    minHeight: isMobile ? 220 : 320,
    position: 'relative',
  };
}

function HeroEyebrow({ isMobile }) {
  return (
    <div style={{ padding: isMobile ? '14px 14px 0' : '16px 18px 0', position: 'relative', zIndex: 3 }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 10px',
          borderRadius: 999,
          background: 'rgba(7,10,20,0.38)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(12px)',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          fontSize: 9,
          color: 'rgba(255,255,255,0.76)',
        }}
      >
        Moment of the day
      </div>
    </div>
  );
}

function EmptyPhotoStack({ isMobile }) {
  const cards = [
    {
      left: isMobile ? 4 : 10,
      top: isMobile ? 18 : 26,
      rotate: '-10deg',
      scale: 0.88,
      glow: 'rgba(79, 126, 225, 0.3)',
      eyebrow: 'Scene 01',
      title: 'Opening energy',
      tone: 'Atmosphere first',
    },
    {
      left: isMobile ? 24 : 72,
      top: isMobile ? 0 : 0,
      rotate: '0deg',
      scale: 1,
      glow: 'rgba(245, 170, 92, 0.24)',
      eyebrow: 'Hero frame',
      title: 'Your lead image',
      tone: 'Set the visual tone',
    },
    {
      left: isMobile ? 82 : 204,
      top: isMobile ? 18 : 30,
      rotate: '9deg',
      scale: 0.9,
      glow: 'rgba(116, 140, 225, 0.22)',
      eyebrow: 'Scene 03',
      title: 'Closing detail',
      tone: 'Balance the story',
    },
  ];

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        right: isMobile ? 20 : 34,
        top: isMobile ? 76 : 60,
        width: isMobile ? 220 : 390,
        height: isMobile ? 142 : 236,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
      >
        {cards.map((card, idx) => (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: card.left,
              top: card.top,
              width: isMobile ? 116 : 184,
              height: isMobile ? 94 : 146,
              borderRadius: isMobile ? 18 : 22,
              transform: `rotate(${card.rotate}) scale(${card.scale})`,
              border: '1px solid rgba(255,255,255,0.16)',
              background: `linear-gradient(145deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 38%, rgba(255,255,255,0.06) 100%), ${card.glow}`,
              boxShadow: '0 34px 70px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.18)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 40%, rgba(8,10,18,0.32) 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: isMobile ? 10 : 12,
                top: isMobile ? 10 : 12,
                width: isMobile ? 18 : 22,
                height: isMobile ? 18 : 22,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.06)',
                display: 'grid',
                placeItems: 'center',
                color: 'rgba(255,255,255,0.75)',
                fontSize: isMobile ? 12 : 14,
                lineHeight: 1,
              }}
            >
              +
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                padding: isMobile ? '12px 12px 10px' : '14px 14px 12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--f-mono)',
                  fontSize: isMobile ? 8 : 9,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.56)',
                }}
              >
                {card.eyebrow}
              </div>
              <div>
                <div
                style={{
                  fontFamily: 'var(--f-display)',
                  fontSize: isMobile ? 14 : 18,
                  lineHeight: 1,
                  color: 'rgba(255,255,255,0.92)',
                  textShadow: '0 10px 24px rgba(0,0,0,0.24)',
                }}
              >
                {card.title}
              </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: isMobile ? 9 : 10,
                    lineHeight: 1.35,
                    color: 'rgba(255,255,255,0.62)',
                    maxWidth: isMobile ? 78 : 118,
                  }}
                >
                  {card.tone}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyMomentHero({ isMobile }) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 26% 58%, rgba(62,102,182,0.24), transparent 34%), radial-gradient(circle at 72% 28%, rgba(194,118,65,0.18), transparent 28%), linear-gradient(135deg, rgba(14,16,24,0.94) 0%, rgba(22,24,32,0.90) 45%, rgba(17,20,29,0.96) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 22%, rgba(4,7,16,0.38) 68%, rgba(4,7,16,0.72) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: isMobile ? '52px 52px' : '74px 74px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.85) 100%)',
          opacity: 0.22,
        }}
      />

      <EmptyPhotoStack isMobile={isMobile} />

      <div
        style={{
          position: 'absolute',
          left: isMobile ? 14 : 18,
          right: isMobile ? 14 : 18,
          bottom: isMobile ? 14 : 16,
          display: 'flex',
          gap: isMobile ? 14 : 18,
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'flex-end',
          justifyContent: 'space-between',
          zIndex: 4,
        }}
      >
        <div style={{ flex: '1 1 auto', minWidth: 0, maxWidth: isMobile ? '100%' : 520 }}>
          <div
            style={{
              fontFamily: 'var(--f-mono)',
              fontSize: 10,
              letterSpacing: '0.34em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.56)',
            }}
          >
            Opening frames
          </div>
          <h2
            className="display"
            style={{
              fontSize: isMobile ? 28 : 44,
              margin: '10px 0 0',
              letterSpacing: '-0.04em',
              lineHeight: 0.98,
              maxWidth: 760,
              color: 'var(--ink)',
              textShadow: '0 16px 36px rgba(0,0,0,0.38)',
            }}
          >
            Start with the strongest shots
          </h2>
          <div
            style={{
              marginTop: 10,
              maxWidth: isMobile ? '100%' : 560,
              color: 'rgba(244,242,236,0.74)',
              fontSize: isMobile ? 13 : 14,
              lineHeight: 1.5,
            }}
          >
            No featured slides are live for this moment yet. Build a three-frame opener with one lead image and a couple of supporting shots to give Mirage a cleaner first impression.
          </div>
        </div>

        <div
          style={{
            minWidth: isMobile ? '100%' : 188,
            alignSelf: isMobile ? 'stretch' : 'flex-end',
            borderRadius: 16,
            padding: isMobile ? '12px 13px' : '14px 15px',
            background: 'rgba(7,10,20,0.42)',
            border: '1px solid rgba(255,255,255,0.10)',
            backdropFilter: 'blur(16px)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 12,
            }}
          >
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.48)' }}>
              Featured
            </span>
            <span style={{ fontFamily: 'var(--f-display)', fontSize: isMobile ? 24 : 28, color: 'var(--ink)', lineHeight: 1 }}>
              0
            </span>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, color: 'rgba(244,242,236,0.64)' }}>
            Curate a cover set and this hero will begin rotating through the strongest scene-setters.
          </div>
        </div>
      </div>
    </>
  );
}

function FilledMomentHero({
  isMobile,
  slides,
  clampedIndex,
  broken,
  setBroken,
  src,
  slide,
  moment,
  label,
  go,
  setPreviewOpen,
}) {
  const imageButtonStyle = {
    position: 'absolute',
    inset: 0,
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: src ? 'zoom-in' : 'default',
    zIndex: 2,
  };

  return (
    <>
      <div style={{ flex: 1, position: 'absolute', inset: 0 }}>
        <div style={{ pointerEvents: 'none', inset: 0, position: 'absolute', background: 'linear-gradient(180deg,rgba(4,7,16,0.30) 0%,rgba(4,7,16,0.02) 36%,rgba(4,7,16,0.88) 100%)', zIndex: 1 }} />

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
                ...cropTransform(s),
              }}
            />
          );
        })}

        {src ? (
          <button
            type="button"
            aria-label="Open moment preview"
            onClick={() => setPreviewOpen(true)}
            style={imageButtonStyle}
          />
        ) : null}

        {!src ? (
          <div style={{ inset: 0, position: 'absolute', display: 'grid', placeItems: 'center', color: '#c8d1ff52', letterSpacing: '0.2em', fontSize: 11, textTransform: 'uppercase', zIndex: 0 }}>
            Slide unavailable
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: 'absolute',
          left: isMobile ? 14 : 18,
          right: isMobile ? 14 : 18,
          bottom: isMobile ? 14 : 16,
          display: 'flex',
          gap: isMobile ? 10 : 14,
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'flex-end',
          justifyContent: 'space-between',
          zIndex: 4,
        }}
      >
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <h2
            className="display"
            style={{
              fontSize: isMobile ? 24 : 38,
              margin: 0,
              letterSpacing: '-0.035em',
              lineHeight: 1.02,
              maxWidth: 760,
              color: 'var(--ink)',
              textShadow: '0 10px 30px rgba(0,0,0,0.45)',
            }}
          >
            {moment.title}
          </h2>
          {moment.subtitle ? (
            <div style={{ marginTop: 7, color: 'rgba(244,242,236,0.74)', maxWidth: 500, fontSize: 12, lineHeight: 1.45 }}>
              {moment.subtitle}
            </div>
          ) : null}
          {(slide.participants || []).length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
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
            <div style={{ marginTop: 8, fontSize: 12, color: '#f3f5ffbf' }}>{slide.slideTitle}</div>
          ) : null}
          <div style={{ marginTop: 8, fontFamily: 'var(--f-mono)', fontSize: 9, opacity: 0.5, letterSpacing: '0.1em' }}>
            CLICK IMAGE TO PREVIEW
          </div>
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
              width: 34,
              height: 34,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(8,14,42,0.35)',
              color: 'var(--ink)',
              backdropFilter: 'blur(14px)',
              cursor: 'pointer',
            }}
          >
            {'<'}
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go('next')}
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(8,14,42,0.35)',
              color: 'var(--ink)',
              backdropFilter: 'blur(14px)',
              cursor: 'pointer',
            }}
          >
            {'>'}
          </button>
        </div>
      </div>
    </>
  );
}

export function MirageMomentHero({ moment, isMobile }) {
  const { slides, isEmpty } = React.useMemo(
    () => getMirageMomentHeroState(moment),
    [moment],
  );
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [broken, setBroken] = React.useState({});
  const [previewOpen, setPreviewOpen] = React.useState(false);

  React.useEffect(() => {
    setIndex(0);
    setBroken({});
    setPreviewOpen(false);
  }, [moment?.momentId]);

  React.useEffect(() => {
    if (!slides.length || paused || previewOpen) return undefined;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 7800);
    return () => window.clearInterval(id);
  }, [slides.length, paused, previewOpen, moment?.momentId]);

  React.useEffect(() => {
    if (!previewOpen || !slides.length) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPreviewOpen(false);
      }
      if (event.key === 'ArrowLeft') {
        setPaused(true);
        setIndex((current) => (current - 1 + slides.length) % slides.length);
      }
      if (event.key === 'ArrowRight') {
        setPaused(true);
        setIndex((current) => (current + 1) % slides.length);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewOpen, slides.length]);

  if (!moment) return null;

  const clampedIndex = Math.min(index, Math.max(slides.length - 1, 0));
  const slide = slides[clampedIndex] || slides[0] || null;
  const src =
    slide && !broken[slide.imageId]
      ? slide.imageUrl || slide.thumbnailUrl
      : null;
  const label = slides.length ? `${clampedIndex + 1} / ${slides.length}` : '0 / 0';

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
    <>
      <section
        className="glass"
        style={{
          marginTop: 0,
          padding: 0,
          overflow: 'hidden',
          borderRadius: 18,
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.11)',
          width: '100%',
          boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
        }}
      >
        <div style={heroFrameStyle(isMobile)}>
          <HeroEyebrow isMobile={isMobile} />
          {isEmpty ? (
            <EmptyMomentHero isMobile={isMobile} />
          ) : (
            <FilledMomentHero
              isMobile={isMobile}
              slides={slides}
              clampedIndex={clampedIndex}
              broken={broken}
              setBroken={setBroken}
              src={src}
              slide={slide}
              moment={moment}
              label={label}
              go={go}
              setPreviewOpen={setPreviewOpen}
            />
          )}
        </div>
      </section>

      {previewOpen && !isEmpty ? (
        <div
          onClick={() => setPreviewOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3,6,18,0.82)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 120,
            padding: isMobile ? 16 : 28,
            backdropFilter: 'blur(16px)',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(1120px, 100%)',
              borderRadius: 24,
              overflow: 'hidden',
              background: 'rgba(8,12,26,0.96)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 40px 120px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ position: 'relative', aspectRatio: isMobile ? '5 / 4' : '3 / 2', background: 'rgba(255,255,255,0.03)' }}>
              {src ? (
                <img
                  alt={slide?.slideTitle || moment.title}
                  src={src}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    ...cropTransform(slide),
                  }}
                />
              ) : null}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,8,18,0.20) 0%, rgba(6,8,18,0.05) 35%, rgba(6,8,18,0.45) 100%)' }} />
              <button
                type="button"
                aria-label="Close preview"
                onClick={() => setPreviewOpen(false)}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.16)',
                  background: 'rgba(9,14,30,0.55)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 18,
                }}
              >
                x
              </button>
            </div>

            <div style={{ padding: isMobile ? 16 : 18, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row' }}>
              <div>
                <div style={{ fontFamily: 'var(--f-display)', fontSize: isMobile ? 24 : 28, color: 'var(--ink)' }}>
                  {moment.title}
                </div>
                {slide?.slideTitle ? (
                  <div style={{ marginTop: 6, color: 'var(--ink-dim)', fontSize: 14 }}>
                    {slide.slideTitle}
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
                <span style={{ fontFamily: 'var(--f-mono)', letterSpacing: '0.08em', fontSize: 10, opacity: 0.55 }}>
                  {label}
                </span>
                <button
                  type="button"
                  aria-label="Previous slide"
                  onClick={() => go('prev')}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                  }}
                >
                  {'<'}
                </button>
                <button
                  type="button"
                  aria-label="Next slide"
                  onClick={() => go('next')}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                  }}
                >
                  {'>'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
