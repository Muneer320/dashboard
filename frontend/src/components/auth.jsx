// Ascent — Auth pages: Login + Visitor Sign-Up
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobile, PageBackground, AscentLogo } from './shared';
import { useUserAuth } from '../lib/UserAuthContext';
import { auth as authApi, credentials as credApi, token as tokenStore } from '../lib/api';

// ─── Shared helpers ──────────────────────────────────────────────────────────

const AUTH_BG = 'https://res.cloudinary.com/dglvt0iom/image/upload/v1776878498/auth_scene_vjvvtq.jpg';

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      marginTop: 14, padding: '10px 14px', borderRadius: 8,
      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
      fontSize: 13, color: '#f87171',
    }}>{msg}</div>
  );
}

// ─── Login ──────────────────────────────────────────────────────────────────

export function Login() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const { login, error, setError } = useUserAuth();
  const [tab, setTab]       = React.useState('login'); // 'login' | 'visitor'
  const [email, setEmail]   = React.useState('');
  const [pw, setPw]         = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function handleLogin(e) {
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
        <a
          onClick={() => { setTab(tab === 'login' ? 'visitor' : 'login'); setError?.(''); }}
          style={{ color: 'var(--ink-dim)', fontSize: isMobile ? 10 : 12, cursor: 'pointer', fontFamily: 'var(--f-mono)', letterSpacing: '0.1em' }}
        >
          {tab === 'login' ? (isMobile ? 'VISITOR SIGN-UP →' : 'ATTENDING AS VISITOR? →') : (isMobile ? 'LOGIN →' : 'ALREADY HAVE ACCESS? →')}
        </a>
      </div>

      <div style={{ display: 'grid', placeItems: 'center', padding: isMobile ? '30px 20px 80px' : '50px 24px 120px', minHeight: 560 }}>
        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="fade-up glass-strong" style={{
            width: '100%', maxWidth: 440, padding: isMobile ? 24 : 36,
            position: 'relative', overflow: 'hidden',
          }}>
            <div className="eyebrow">§ LOGIN</div>
            <div className="display" style={{ fontSize: 34, marginTop: 14, letterSpacing: '-0.02em' }}>Welcome back.</div>
            <div style={{ marginTop: 10, color: 'var(--ink-dim)', fontSize: 13 }}>
              Sign in with the credentials sent to your email.
            </div>

            <div style={{ marginTop: 30 }}>
              <label className="label">Email or username</label>
              <input
                className="input" type="text" placeholder="archived-efc0ee75d9@example.invalid or username"
                value={email} onChange={e => { setError?.(''); setEmail(e.target.value); }}
                required autoComplete="username"
              />
            </div>
            <div style={{ marginTop: 18 }}>
              <label className="label">Password</label>
              <input
                className="input" type="password" placeholder="••••••••••"
                value={pw} onChange={e => { setError?.(''); setPw(e.target.value); }}
                required autoComplete="current-password"
              />
            </div>

            <ErrorBox msg={error} />

            <button type="submit" disabled={loading} className="btn primary"
              style={{ width: '100%', marginTop: 26, padding: '14px', fontSize: 13 }}>
              {loading ? 'Signing in…' : 'Enter Ascent →'}
            </button>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Visiting the fest? </span>
              <a onClick={() => { setTab('visitor'); setError?.(''); }}
                style={{ fontSize: 12, color: 'var(--violet)', cursor: 'pointer' }}>
                Sign up as a visitor →
              </a>
            </div>

            <div style={{ marginTop: 24, fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.14em', textAlign: 'center' }}>
              SECURED · TLS 1.3 · SSO-READY
            </div>
          </form>
        ) : (
          <VisitorSignupForm isMobile={isMobile} onSwitchToLogin={() => { setTab('login'); setError?.(''); }} navigate={navigate} />
        )}
      </div>
    </PageBackground>
  );
}

// ─── Visitor Sign-Up Form ────────────────────────────────────────────────────

function VisitorSignupForm({ isMobile, onSwitchToLogin, navigate }) {
  const { login } = useUserAuth();
  const [step, setStep]     = React.useState(1); // 1=account, 2=details
  const [loading, setLoading] = React.useState(false);
  const [error, setError]   = React.useState('');
  const [done, setDone]     = React.useState(false);

  const [form, setForm] = React.useState({
    name: '', email: '', password: '', confirmPassword: '',
    phone: '', college: '', city: '', branch: '', year: '', gender: '', emergency_contact: '',
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const BRANCH_OPTIONS = [
    'B.Tech/BE (Bachelor of Technology/Bachelor of Engineering)',
    'B.Sc (Bachelor of Science)',
    'BCA (Bachelor of Computer Applications)',
    'MBA/PGDM',
    'M.Tech/ME',
    'MCA',
    'Other',
  ];
  const YEAR_OPTIONS = ['2025', '2026', '2027', '2028', '2029', '2030', 'Graduated'];

  function validateStep1() {
    if (!form.name.trim()) return 'Full name is required.';
    if (!form.email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Enter a valid email.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError('');

    if (step === 1) { setStep(2); return; }

    setLoading(true);
    try {
      const res = await authApi.visitorSignup({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone || null,
        college: form.college || null,
        city: form.city || null,
        branch: form.branch || null,
        year: form.year || null,
        gender: form.gender || null,
        emergency_contact: form.emergency_contact || null,
      });
      // Store JWT and navigate to dashboard
      tokenStore.setUser(res.access_token);
      setDone(true);
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (e) {
      setError(e.message || 'Sign-up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="fade-up glass-strong" style={{ width: '100%', maxWidth: 480, padding: isMobile ? 28 : 48, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto', background: 'radial-gradient(closest-side, rgba(29,158,117,0.3), transparent)', display: 'grid', placeItems: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M4 12l5 5L20 6" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="display" style={{ fontSize: 28, marginTop: 20, letterSpacing: '-0.02em' }}>You're in.</div>
        <div style={{ marginTop: 10, color: 'var(--ink-dim)', fontSize: 13 }}>Welcome to Ascent 2026, {form.name.split(' ')[0]}.</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="fade-up glass-strong" style={{
      width: '100%', maxWidth: 560, padding: isMobile ? 22 : 40,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[1, 2].map(s => (
          <div key={s} style={{
            flex: 1, height: 3, borderRadius: 99,
            background: s <= step ? 'var(--violet)' : 'rgba(255,255,255,0.1)',
            transition: 'background .3s',
          }} />
        ))}
      </div>

      <div className="eyebrow">{step === 1 ? '§ VISITOR SIGN-UP · STEP 1 of 2' : '§ VISITOR SIGN-UP · STEP 2 of 2'}</div>
      <div className="display" style={{ fontSize: isMobile ? 24 : 30, marginTop: 12, letterSpacing: '-0.02em' }}>
        {step === 1 ? 'Create your account.' : 'A bit about you.'}
      </div>
      <div style={{ marginTop: 8, color: 'var(--ink-dim)', fontSize: 13 }}>
        {step === 1
          ? 'Get instant access to the Ascent 2026 dashboard as a visitor.'
          : 'Optional details — skip anything that doesn\'t apply.'}
      </div>

      {step === 1 && (
        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Full name *">
            <input className="input" placeholder="Aarav Rao" value={form.name} onChange={set('name')} required />
          </Field>
          <Field label="Email *">
            <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required autoComplete="email" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <Field label="Password *">
              <input className="input" type="password" placeholder="Min. 8 characters" value={form.password} onChange={set('password')} required autoComplete="new-password" />
            </Field>
            <Field label="Confirm password *">
              <input className="input" type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={set('confirmPassword')} required />
            </Field>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <Field label="Phone">
              <input className="input" placeholder="+91 98XXX XXXXX" value={form.phone} onChange={set('phone')} />
            </Field>
            <Field label="City">
              <input className="input" placeholder="Bengaluru, Karnataka" value={form.city} onChange={set('city')} />
            </Field>
          </div>
          <Field label="College / Institution">
            <input className="input" placeholder="e.g. IIIT Bangalore" value={form.college} onChange={set('college')} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <Field label="Branch / Programme">
              <select className="input" value={form.branch} onChange={set('branch')}
                style={{ appearance: 'none', cursor: 'pointer', background: 'var(--glass-bg, rgba(255,255,255,0.06))', color: 'var(--ink)', borderColor: 'var(--glass-border)' }}>
                <option value="" style={{ background: '#1a1a2e', color: '#e0e0e0' }}>Select branch</option>
                {BRANCH_OPTIONS.map(b => <option key={b} value={b} style={{ background: '#1a1a2e', color: '#e0e0e0' }}>{b}</option>)}
              </select>
            </Field>
            <Field label="Graduation year">
              <select className="input" value={form.year} onChange={set('year')}
                style={{ appearance: 'none', cursor: 'pointer', background: 'var(--glass-bg, rgba(255,255,255,0.06))', color: 'var(--ink)', borderColor: 'var(--glass-border)' }}>
                <option value="" style={{ background: '#1a1a2e', color: '#e0e0e0' }}>Select year</option>
                {YEAR_OPTIONS.map(y => <option key={y} value={y} style={{ background: '#1a1a2e', color: '#e0e0e0' }}>{y}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <Field label="Gender">
              <select className="input" value={form.gender} onChange={set('gender')}
                style={{ appearance: 'none', cursor: 'pointer', background: 'var(--glass-bg, rgba(255,255,255,0.06))', color: 'var(--ink)', borderColor: 'var(--glass-border)' }}>
                <option value="" style={{ background: '#1a1a2e', color: '#e0e0e0' }}>Prefer not to say</option>
                <option value="M" style={{ background: '#1a1a2e', color: '#e0e0e0' }}>Male</option>
                <option value="F" style={{ background: '#1a1a2e', color: '#e0e0e0' }}>Female</option>
                <option value="NB" style={{ background: '#1a1a2e', color: '#e0e0e0' }}>Non-binary</option>
                <option value="O" style={{ background: '#1a1a2e', color: '#e0e0e0' }}>Other</option>
              </select>
            </Field>
            <Field label="Emergency contact (optional)">
              <input className="input" placeholder="+91 XXXXX XXXXX" value={form.emergency_contact} onChange={set('emergency_contact')} />
            </Field>
          </div>
        </div>
      )}

      <ErrorBox msg={error} />

      <div style={{ marginTop: 26, display: 'flex', gap: 10 }}>
        {step === 2 && (
          <button type="button" className="btn" onClick={() => setStep(1)}
            style={{ padding: '13px 20px', fontSize: 13 }}>
            ← Back
          </button>
        )}
        <button type="submit" disabled={loading} className="btn primary"
          style={{ flex: 1, padding: '13px', fontSize: 13 }}>
          {loading ? 'Creating account…' : step === 1 ? 'Continue →' : 'Create account →'}
        </button>
      </div>

      <div style={{ marginTop: 18, textAlign: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Already have an account? </span>
        <a onClick={onSwitchToLogin} style={{ fontSize: 12, color: 'var(--violet)', cursor: 'pointer' }}>Log in →</a>
      </div>
    </form>
  );
}

// ─── Credentials request form ────────────────────────────────────────────────

export function Credentials() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading]     = React.useState(false);
  const [error, setError]         = React.useState('');
  const [ticketId, setTicketId]   = React.useState('');
  const [form, setForm] = React.useState({ name: '', college: '', email: '', phone: '', notes: '' });

  async function handleSubmit() {
    if (!form.name || !form.email) { setError('Name and email are required.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await credApi.request({
        name:    form.name,
        college: form.college || '',
        email:   form.email,
        phone:   form.phone || '',
        note:    form.notes || null,
      });
      setTicketId(res?.ticket_id || '');
      setSubmitted(true);
    } catch (e) {
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
              Your request is now with the Ascent organizers. Once verified, your credentials will land in your inbox within 24 hours. Keep an eye on <span style={{ color: 'var(--ink)' }}>{form.email}</span>.
            </div>
            <div style={{ marginTop: 30, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a onClick={() => navigate('/')} className="btn sm">← Back home</a>
              <a onClick={() => { setSubmitted(false); setForm({ name: '', college: '', email: '', phone: '', notes: '' }); }} className="btn ghost sm">Submit another</a>
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
          No self-signup — Ascent credentials are issued by organizers after verifying your college ID.
        </div>

        <div className="glass-strong fade-up" style={{ marginTop: 48, padding: isMobile ? 20 : 40 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
            <div><label className="label">Full name</label><input className="input" placeholder="Aarav Rao" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/></div>
            <div><label className="label">College</label><input className="input" placeholder="e.g. IIIT Bangalore" value={form.college} onChange={e => setForm({...form, college: e.target.value})}/></div>
            <div><label className="label">Email</label><input className="input" type="email" placeholder="archived-efc0ee75d9@example.invalid" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></div>
            <div><label className="label">Phone</label><input className="input" placeholder="+91 98XXX XXXXX" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/></div>
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
