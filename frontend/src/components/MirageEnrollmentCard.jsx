import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { users } from '../lib/api';
import { useUserAuth } from '../lib/UserAuthContext';
import { NavBar, PageBackground, useMobile } from './shared';

const STATUS_COPY = {
  draft: 'Add 6–10 photos to start your Mirage enrollment.',
  processing: 'Your photos are in the face pipeline right now.',
  ready: 'Your Mirage enrollment is ready and will be used for event matching.',
  needs_more_images: 'Add more clear angles so Mirage can build a stronger profile.',
  failed: 'Some processing failed. Replace the rejected photos and try again.',
};

function toneForStatus(status) {
  if (status === 'ready') return 'rgba(29,158,117,0.16)';
  if (status === 'processing') return 'rgba(127,119,221,0.18)';
  if (status === 'failed') return 'rgba(220, 80, 80, 0.14)';
  return 'rgba(255,255,255,0.05)';
}

export function MirageEnrollmentCard({ defaultExpanded = false, standalone = false }) {
  const navigate = useNavigate();
  const { user } = useUserAuth();
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [consentEnabled, setConsentEnabled] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const canUseMirage = Boolean(user?.is_attending);

  if (!canUseMirage) {
    return null;
  }

  const loadProfile = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await users.mirageProfile();
      setProfile(next);
      setConsentEnabled(Boolean(next?.consentEnabled));
    } catch (err) {
      setError(err.message || 'Could not load your Mirage enrollment.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (expanded) {
      loadProfile();
    }
  }, [expanded, loadProfile]);

  React.useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setUploading(true);
    setError('');
    try {
      for (const file of files) {
        await users.uploadMirageImage(file);
      }
      setNotice(`${files.length} image${files.length > 1 ? 's' : ''} queued for Mirage.`);
      await loadProfile();
    } catch (err) {
      setError(err.message || 'Could not upload these Mirage images.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function handleDelete(imageId) {
    if (!window.confirm('Remove this photo?')) return;
    setError('');
    try {
      await users.deleteMirageImage(imageId);
      setNotice('Photo removed.');
      await loadProfile();
    } catch (err) {
      setError(err.message || 'Could not remove this image.');
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const next = await users.submitMirageProfile(consentEnabled);
      await loadProfile();
      setNotice(
        next?.enrollmentStatus === 'ready'
          ? 'Mirage enrollment submitted. Your face profile is queued for processing.'
          : 'Enrollment saved. Your face profile is queued for processing.',
      );
    } catch (err) {
      setError(err.message || 'Could not submit your Mirage profile.');
    } finally {
      setSubmitting(false);
    }
  }

  const status = profile?.enrollmentStatus || 'draft';
  const images = profile?.images || [];
  const approvedCount = profile?.approvedAnchorCount || 0;
  const requiredCount = profile?.requiredAnchorCount || 6;
  const maxAnchorCount = profile?.maxAnchorCount || 10;
  const readyForSubmission = Boolean(profile?.readyForSubmission);
  const canUploadMore = images.length < maxAnchorCount;

  if (!expanded) {
    return (
      <div
        className="glass"
        style={{
          padding: 20,
          background: 'linear-gradient(135deg, rgba(127,119,221,0.14), rgba(9, 10, 18, 0.88))',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="eyebrow">Mirage Enrollment</div>
          <div style={{ marginTop: 8, color: 'var(--ink-dim)', fontSize: 14, lineHeight: 1.6 }}>
            Build your private face profile so Mirage can find your event photos after admin approval.
          </div>
        </div>
        <button type="button" className="btn primary" onClick={() => navigate('/mirage/profile')}>
          Build face profile
        </button>
      </div>
    );
  }

  return (
    <div
      className="glass"
      style={{
        padding: 22,
        background: `linear-gradient(135deg, ${toneForStatus(status)}, rgba(9, 10, 18, 0.88))`,
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow">Mirage Enrollment</div>
          <div style={{ marginTop: 10, fontFamily: 'var(--f-display)', fontSize: 28, color: 'var(--ink)' }}>
            Build your face profile
          </div>
          <div style={{ marginTop: 8, maxWidth: 620, fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.65 }}>
            Upload 6-10 clear selfies from different angles so Mirage can find your photos after event review. Front-facing, left, right, slightly up, slightly down, and one candid angle is a strong set.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div
            className="chip"
            style={{
              padding: '8px 12px',
              fontSize: 11,
              borderColor: 'rgba(255,255,255,0.16)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            {approvedCount}/{requiredCount} approved
          </div>
          <button
            type="button"
            className="chip"
            style={{ padding: '8px 12px', fontSize: 11, cursor: 'pointer' }}
            onClick={() => (standalone ? navigate('/mirage') : setExpanded(false))}
          >
            {standalone ? 'Back to Mirage' : 'Hide'}
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 12,
        }}
      >
        <StatPill label="Status" value={status.replaceAll('_', ' ')} />
        <StatPill label="Queued" value={`${images.length}/${maxAnchorCount}`} />
        <StatPill label="Consent" value={consentEnabled ? 'enabled' : 'required'} />
      </div>

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, opacity: 0.55 }}>Revision chances</span>
        {[0, 1, 2].map((i) => {
          const remaining = Math.min(
            3,
            Math.max(0, profile?.anchorRevisionLivesRemaining ?? 3),
          );
          const filled = i < remaining;
          return (
            <span
              key={i}
              title={`${remaining} chance${remaining === 1 ? '' : 's'} left to revise your photos after mistaken approvals`}
              style={{
                fontSize: 20,
                lineHeight: 1,
                color: filled ? '#ff6b8a' : 'rgba(255,255,255,0.22)',
              }}
              aria-hidden
            >
              {filled ? '♥' : '♡'}
            </span>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-mute)', maxWidth: 620, lineHeight: 1.55 }}>
        Three revision chances: after your enrollment is live, each additional photo that gets approved consumes one heart so you can replace mistaken uploads.
      </div>

      <div
        style={{
          marginTop: 18,
          padding: '14px 16px',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
          fontSize: 13,
          color: 'var(--ink-dim)',
        }}
      >
        {STATUS_COPY[status] || STATUS_COPY.draft}
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <label
            className="btn primary"
            style={{
              display: canUploadMore ? 'inline-flex' : 'none',
              cursor: uploading ? 'wait' : 'pointer',
              opacity: uploading ? 0.65 : 1,
            }}
          >
            {uploading ? 'Uploading...' : 'Take photo'}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              disabled={uploading}
              aria-label="Take a new photo or choose images from your gallery"
              style={{ display: 'none' }}
            />
          </label>
          {!canUploadMore && (
            <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
              You&apos;ve reached the {maxAnchorCount}-photo limit for this enrollment.
            </div>
          )}
          {status === 'ready' && (
            <button type="button" className="btn sm" onClick={() => navigate('/mirage')}>
              Open Mirage
            </button>
          )}
        </div>
        {canUploadMore && (
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', maxWidth: 420, lineHeight: 1.55 }}>
            Opens your camera or photo library—pick one shot or select several images at once.
          </div>
        )}
      </div>

      <label
        style={{
          marginTop: 18,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '14px 16px',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={consentEnabled}
          onChange={(event) => setConsentEnabled(event.target.checked)}
          style={{ marginTop: 3 }}
        />
        <div>
          <div style={{ fontSize: 13, color: 'var(--ink)' }}>I consent to Mirage face matching for event photos.</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.6 }}>
            Your photos stay private and are only used to match approved event images inside Mirage.
          </div>
        </div>
      </label>

      <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn primary"
          onClick={handleSubmit}
          disabled={!readyForSubmission || !consentEnabled || submitting}
        >
          {submitting ? 'Submitting...' : 'Submit for matching'}
        </button>
        <button type="button" className="btn sm ghost" onClick={loadProfile} disabled={loading}>
          Refresh status
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(220, 80, 80, 0.28)',
            background: 'rgba(220, 80, 80, 0.1)',
            color: '#f0b3b3',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 18, fontSize: 12, color: 'var(--ink-mute)' }}>Loading your photos...</div>
      ) : (
        <div style={{ marginTop: 20 }}>
          <div className="eyebrow">Your photos</div>
          {images.length === 0 ? (
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-mute)' }}>
              No photos yet. Use Take photo to add shots from your camera or gallery.
            </div>
          ) : (
            <div
              style={{
                marginTop: 14,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 12,
              }}
            >
              {images.map((image) => (
                <div
                  key={image.imageId}
                  style={{
                    borderRadius: 16,
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div style={{ aspectRatio: '1 / 1', background: 'rgba(255,255,255,0.04)' }}>
                    {image.previewUrl ? (
                      <img
                        src={image.previewUrl}
                        alt={image.filename}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : null}
                  </div>
                  <div style={{ padding: '12px 12px 14px' }}>
                    <div style={{ fontSize: 12, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {image.filename}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-mute)', textTransform: 'capitalize' }}>
                      {image.status.replaceAll('_', ' ')}
                    </div>
                    {typeof image.qualityScore === 'number' && (
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-dim)' }}>
                        quality {(image.qualityScore || 0).toFixed(2)}
                      </div>
                    )}
                    {image.rejectionReason && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#efb1b1', lineHeight: 1.5 }}>
                        {image.rejectionReason}
                      </div>
                    )}
                    <div style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        className="chip"
                        style={{ padding: '6px 10px', fontSize: 10, cursor: 'pointer' }}
                        onClick={() => handleDelete(image.imageId)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!!notice && (
        <div
          style={{
            marginTop: 16,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(127,119,221,0.35)',
            background: 'rgba(127,119,221,0.12)',
            color: 'var(--ink)',
            fontSize: 12,
          }}
        >
          {notice}
        </div>
      )}
    </div>
  );
}

export function MirageProfilePage() {
  const isMobile = useMobile();
  const { user } = useUserAuth();

  if (user && !user.is_attending) {
    return <Navigate to="/mirage" replace />;
  }

  return (
    <PageBackground>
      <NavBar active="Mirage" />
      <main style={{ padding: isMobile ? '48px 18px 80px' : '64px 48px 96px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div className="eyebrow">Mirage · Face Profile</div>
          <h1
            style={{
              margin: '12px 0 10px',
              fontFamily: 'var(--f-display)',
              fontSize: isMobile ? 42 : 72,
              lineHeight: 0.95,
              color: 'var(--ink)',
            }}
          >
            Build your face profile.
          </h1>
          <p style={{ maxWidth: 720, color: 'var(--ink-dim)', fontSize: 16, lineHeight: 1.7, marginBottom: 28 }}>
            Upload 6–10 clear selfies from different angles. These stay private and are only used to match you in approved Mirage event photos.
          </p>
          <MirageEnrollmentCard defaultExpanded standalone />
        </div>
      </main>
    </PageBackground>
  );
}

function StatPill({ label, value }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--ink-mute)', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ marginTop: 6, fontFamily: 'var(--f-display)', fontSize: 18, color: 'var(--ink)' }}>
        {value}
      </div>
    </div>
  );
}
