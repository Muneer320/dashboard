// Ascent — Auth pages: Login + Get Credentials
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobile, PageBackground, AscentLogo } from './shared';
import { useUserAuth } from '../lib/UserAuthContext';
import { credentials as credApi } from '../lib/api';

export function Login() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const { login, error, setError } = useUserAuth();
  const [email, setEmail]   = React.useState('');
  const [pw, setPw]         = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const AUTH_BG = 'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878498/auth_scene_vjvvtq.jpg';

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const ok = await login(email.trim(), pw);
    setLoading(false);
    if (ok) navigate('/dashboard');
  }

  return (
    <PageBackground bgImage={AUTH_BG} blurAmount={14} dimAmount={0.65}>
      <div style={{ padding: isMobile ? '16px 20px' : '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <AscentLogo size={18} />
        </div>
        <a onClick={() => navigate('/credentials')} style={{ color: 'var(--ink-dim)', fontSize: isMobile ? 10 : 12, cursor: 'pointer', fontFamily: 'var(--f-mono)', letterSpacing: '0.1em' }}>
          {isMobile ? 'GET CREDS →' : 'NEED CREDENTIALS? →'}
        </a>
      </div>
      <div style={{ display: 'grid', placeItems: 'center', padding: isMobile ? '40px 20px 80px' : '60px 24px 120px', minHeight: 560 }}>
        <form onSubmit={handleSubmit} className="fade-up glass-strong" style={{
          width: '100%', maxWidth: 440, padding: isMobile ? 24 : 36,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'relative' }}>
            <div className="eyebrow">§ LOGIN</div>
            <div className="display" style={{ fontSize: 34, marginTop: 14, letterSpacing: '-0.02em' }}>
              Welcome back.
            </div>
            <div style={{ marginTop: 10, color: 'var(--ink-dim)', fontSize: 13 }}>
              Sign in with the credentials sent to your email.
            </div>

            <div style={{ marginTop: 30 }}>
              <label className="label">Email or username</label>
              <input
                className="input" type="text" placeholder="archived-efc0ee75d9@example.invalid or username"
                value={email} onChange={e => { setError(''); setEmail(e.target.value); }}
                required autoComplete="username"
              />
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="label">Password</label>
              </div>
              <input
                className="input" type="password" placeholder="••••••••••"
                value={pw} onChange={e => { setError(''); setPw(e.target.value); }}
                required autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn primary"
              style={{ width: '100%', marginTop: 26, padding: '14px', fontSize: 13 }}
            >
              {loading ? 'Signing in…' : 'Enter Ascent →'}
            </button>

            <div style={{
              marginTop: 26, padding: 14,
              border: '1px dashed var(--glass-border)',
              borderRadius: 10, display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, background: 'var(--teal)', boxShadow: '0 0 8px var(--teal)', flexShrink: 0 }}/>
              <div style={{ fontSize: 12, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
                Credentials are issued by Ascent organizers only.
                There is no self-signup — request access via the credentials form.
              </div>
            </div>

            <div style={{ marginTop: 24, textAlign: 'center', fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.14em' }}>
              SECURED · TLS 1.3 · SSO-READY
            </div>
          </div>
        </form>
      </div>
    </PageBackground>
  );
}

export function Credentials() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading]     = React.useState(false);
  const [error, setError]         = React.useState('');
  const [ticketId, setTicketId]   = React.useState('');
  const [form, setForm] = React.useState({ name: '', college: '', email: '', phone: '', notes: '' });

  const AUTH_BG = 'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878498/auth_scene_vjvvtq.jpg';

  async function handleSubmit() {
    if (!form.name || !form.email) { setError('Name and email are required.'); return; }
    setError('');
    setLoading(true);
    try {
      // Backend requires college + phone (NOT NULL columns). Let them through
      // as empty strings if the user skipped them — the admin review tab will
      // still show the request.
      const res = await credApi.request({
        name:    form.name,
        college: form.college || '',
        email:   form.email,
        phone:   form.phone || '',
        note:    form.notes || null,
      });
      // Use the real ticket_id issued by the server so follow-ups match.
      setTicketId(res?.ticket_id || '');
      setSubmitted(true);
    } catch (e) {
      // Duplicate-email 409 responses include a structured detail object we
      // can surface nicely instead of the raw "[object Object]" fallback.
      let msg = e.message || 'Submission failed. Please try again.';
      if (e.data?.detail && typeof e.data.detail === 'object') {
        const d = e.data.detail;
        msg = d.message
          ? `${d.message}${d.ticket_id ? ` (ticket ${d.ticket_id})` : ''}`
          : msg;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <PageBackground bgImage={AUTH_BG} blurAmount={14} dimAmount={0.65}>
        <div style={{ padding: isMobile ? '16px 20px' : '22px 28px' }}>
          <div onClick={() => navigate('/')} style={{ cursor: 'pointer', width: 'fit-content' }}>
            <AscentLogo size={18} />
          </div>
        </div>
        <div style={{ display: 'grid', placeItems: 'center', padding: isMobile ? '40px 20px' : '60px 24px', minHeight: 560 }}>
          <div className="fade-up glass-strong" style={{ width: '100%', maxWidth: 520, padding: isMobile ? 28 : 48, textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto', background: 'radial-gradient(closest-side, rgba(29,158,117,0.35), transparent 70%)', display: 'grid', placeItems: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M4 12l5 5L20 6" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="eyebrow" style={{ marginTop: 24, color: 'var(--teal)' }}>REQUEST RECEIVED</div>
            <div className="display" style={{ fontSize: 32, marginTop: 14, letterSpacing: '-0.02em' }}>You're on the list.</div>
            <div style={{ marginTop: 16, color: 'var(--ink-dim)', fontSize: 14, lineHeight: 1.6 }}>
              Your request is now with the Ascent organizers. Once verified, your credentials will
              land in your inbox within 24 hours. Keep an eye on <span style={{ color: 'var(--ink)' }}>{form.email}</span>.
            </div>
            <div style={{ marginTop: 30, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a onClick={() => navigate('/')} className="btn sm">← Back home</a>
              <a onClick={() => { setSubmitted(false); setForm({ name: '', college: '', email: '', phone: '', events: [], notes: '' }); }} className="btn ghost sm">Submit another</a>
            </div>
            <div style={{ marginTop: 32, padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>
              TICKET #{ticketId} · STATUS: PENDING_VERIFY
            </div>
          </div>
        </div>
      </PageBackground>
    );
  }

  return (
    <PageBackground bgImage={AUTH_BG} blurAmount={14} dimAmount={0.65}>
      <div style={{ padding: isMobile ? '16px 20px' : '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <AscentLogo size={18} />
        </div>
        <a onClick={() => navigate('/login')} style={{ color: 'var(--ink-dim)', fontSize: isMobile ? 10 : 12, cursor: 'pointer', fontFamily: 'var(--f-mono)', letterSpacing: '0.1em' }}>
          {isMobile ? 'LOGIN →' : 'ALREADY HAVE ACCESS? →'}
        </a>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '24px 20px 80px' : '40px 24px 120px' }}>
        <div className="eyebrow">§ REQUEST CREDENTIALS</div>
        <h1 className="display" style={{ fontSize: isMobile ? 36 : 56, marginTop: 16, letterSpacing: '-0.02em', maxWidth: 700 }}>
          Tell us who you are.
        </h1>
        <div style={{ marginTop: 16, color: 'var(--ink-dim)', fontSize: 15, maxWidth: 560, lineHeight: 1.6 }}>
          No self-signup — Ascent credentials are issued by organizers after verifying your college ID. Fill this and expect an email within 24 hours.
        </div>

        <div className="glass-strong fade-up" style={{ marginTop: 48, padding: isMobile ? 20 : 40 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
            <div>
              <label className="label">Full name</label>
              <input className="input" placeholder="Aarav Rao" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/>
            </div>
            <div>
              <label className="label">College</label>
              <input className="input" placeholder="e.g. IIIT Bangalore" value={form.college} onChange={e => setForm({...form, college: e.target.value})}/>
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="archived-efc0ee75d9@example.invalid" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/>
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="+91 98XXX XXXXX" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/>
            </div>
          </div>

          <div style={{ marginTop: 28 }}>
            <label className="label">Anything else we should know? (optional)</label>
            <textarea className="input" rows={3} placeholder="Hostel required, team size, dietary preferences, etc." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>

          {error && (
            <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171' }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: 28, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? 16 : 0, paddingTop: 24, borderTop: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 14, height: 14, border: '1px solid var(--glass-border-strong)', borderRadius: 3, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, background: 'var(--violet)', borderRadius: 1 }}/>
              </div>
              <span style={{ color: 'var(--ink-dim)', fontSize: 12 }}>I agree to the code of conduct and data policy.</span>
            </div>
            <button onClick={handleSubmit} disabled={loading} className="btn primary" style={{ padding: '14px 26px', width: isMobile ? '100%' : 'auto' }}>
              {loading ? 'Submitting…' : 'Request credentials →'}
            </button>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
