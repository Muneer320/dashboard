// Ascent — Venue Tour (Matterport 3D)
import React from 'react';
import { NavBar, PageBackground, Footer } from './shared';

const MATTERPORT_URL =
  'https://my.matterport.com/show/?m=vaq2aHbSqEJ&ss=1&sr=-.11,-.8&play=1';

export default function Tour() {
  return (
    <PageBackground>
      <NavBar variant="public" active="tour" />

      <section
        style={{
          padding: '32px 28px 16px',
          maxWidth: 1280,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--f-display, var(--f-body))',
            fontSize: 'clamp(28px, 4vw, 44px)',
            margin: 0,
            color: 'var(--ink)',
            letterSpacing: '0.01em',
          }}
        >
          Venue Tour
        </h1>
        <p
          style={{
            color: 'var(--ink-dim)',
            marginTop: 8,
            fontSize: 14,
            fontFamily: 'var(--f-body)',
          }}
        >
          Walk through the Ascent venue in 3D. Drag to look around, click hotspots to move.
        </p>
      </section>

      <section
        style={{
          padding: '12px 28px 48px',
          maxWidth: 1280,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid var(--glass-border)',
            background: '#000',
            boxShadow: '0 12px 48px rgba(0,0,0,0.4)',
          }}
        >
          <iframe
            src={MATTERPORT_URL}
            title="Ascent 2026 Venue 3D Tour"
            allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen; vr"
            allowFullScreen
            loading="lazy"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              border: 0,
            }}
          />
        </div>
      </section>

      <Footer />
    </PageBackground>
  );
}
