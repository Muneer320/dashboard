// Ascent — Auth pages: Login + Get Credentials

function Login({ onNav }) {
  const isMobile = useMobile();
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const AUTH_BG = 'uploads/auth_scene.png';
  return (
    <PageBackground bgImage={AUTH_BG} blurAmount={14} dimAmount={0.65}>
      <div style={{ padding: isMobile ? '16px 20px' : '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div onClick={() => onNav('landing')} style={{ cursor: 'pointer' }}>
          <AscentLogo size={18} />
        </div>
        <a onClick={() => onNav('credentials')} style={{ color: 'var(--ink-dim)', fontSize: isMobile ? 10 : 12, cursor: 'pointer', fontFamily: 'var(--f-mono)', letterSpacing: '0.1em' }}>
          {isMobile ? 'GET CREDS →' : 'NEED CREDENTIALS? →'}
        </a>
      </div>
      <div style={{ display: 'grid', placeItems: 'center', padding: isMobile ? '40px 20px 80px' : '60px 24px 120px', minHeight: 560 }}>
        <div className="fade-up glass-strong" style={{
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
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="archived-efc0ee75d9@example.invalid" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="label">Password</label>
                <a style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.12em', cursor: 'pointer' }}>FORGOT?</a>
              </div>
              <input className="input" type="password" placeholder="••••••••••" value={pw} onChange={e => setPw(e.target.value)} />
            </div>

            <button onClick={() => onNav('dashboard')} className="btn primary" style={{ width: '100%', marginTop: 26, padding: '14px', fontSize: 13 }}>
              Enter Ascent →
            </button>

            <div style={{
              marginTop: 26, padding: 14,
              border: '1px dashed var(--glass-border)',
              borderRadius: 10,
              display: 'flex', gap: 12, alignItems: 'flex-start',
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
        </div>
      </div>
    </PageBackground>
  );
}

function Credentials({ onNav }) {
  const isMobile = useMobile();
  const [submitted, setSubmitted] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', college: '', email: '', phone: '', events: [] });
  const eventOpts = ['Hack Night', 'Circuit Rush', 'Pitch./Dev', 'Code Clash', 'Design Jam', 'Robo Wars', 'Mirage Walk', 'Quantum Quiz'];
  const toggleEvent = (e) => setForm(f => ({
    ...f, events: f.events.includes(e) ? f.events.filter(x => x !== e) : [...f.events, e]
  }));

  const AUTH_BG = 'uploads/auth_scene.png';
  if (submitted) {
    return (
      <PageBackground bgImage={AUTH_BG} blurAmount={14} dimAmount={0.65}>
        <div style={{ padding: isMobile ? '16px 20px' : '22px 28px' }}>
          <div onClick={() => onNav('landing')} style={{ cursor: 'pointer', width: 'fit-content' }}>
            <AscentLogo size={18} />
          </div>
        </div>
        <div style={{ display: 'grid', placeItems: 'center', padding: isMobile ? '40px 20px' : '60px 24px', minHeight: 560 }}>
          <div className="fade-up glass-strong" style={{ width: '100%', maxWidth: 520, padding: isMobile ? 28 : 48, textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto',
              background: 'radial-gradient(closest-side, rgba(29,158,117,0.35), transparent 70%)',
              display: 'grid', placeItems: 'center',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M4 12l5 5L20 6" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="eyebrow" style={{ marginTop: 24, color: 'var(--teal)' }}>REQUEST RECEIVED</div>
            <div className="display" style={{ fontSize: 32, marginTop: 14, letterSpacing: '-0.02em' }}>
              You're on the list.
            </div>
            <div style={{ marginTop: 16, color: 'var(--ink-dim)', fontSize: 14, lineHeight: 1.6 }}>
              Your request is now with the Ascent organizers. Once verified, your credentials will
              land in your inbox within 24 hours. Keep an eye on <span style={{ color: 'var(--ink)' }}>{form.email || 'your email'}</span>.
            </div>
            <div style={{ marginTop: 30, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a onClick={() => onNav('landing')} className="btn sm">← Back home</a>
              <a onClick={() => setSubmitted(false)} className="btn ghost sm">Submit another</a>
            </div>
            <div style={{ marginTop: 32, padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>
              TICKET #ASC-{Math.floor(Math.random()*900000+100000)} · STATUS: PENDING_VERIFY
            </div>
          </div>
        </div>
      </PageBackground>
    );
  }

  return (
    <PageBackground bgImage={AUTH_BG} blurAmount={14} dimAmount={0.65}>
      <div style={{ padding: isMobile ? '16px 20px' : '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div onClick={() => onNav('landing')} style={{ cursor: 'pointer' }}>
          <AscentLogo size={18} />
        </div>
        <a onClick={() => onNav('login')} style={{ color: 'var(--ink-dim)', fontSize: isMobile ? 10 : 12, cursor: 'pointer', fontFamily: 'var(--f-mono)', letterSpacing: '0.1em' }}>
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
              <input className="input" placeholder="archived-efc0ee75d9@example.invalid" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/>
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="+91 98XXX XXXXX" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/>
            </div>
          </div>

          <div style={{ marginTop: 28 }}>
            <label className="label">Events of interest · pick as many as you like</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {eventOpts.map(e => {
                const active = form.events.includes(e);
                return (
                  <div key={e} onClick={() => toggleEvent(e)} className="chip" style={{
                    cursor: 'pointer',
                    borderColor: active ? 'rgba(127,119,221,0.6)' : undefined,
                    background: active ? 'rgba(127,119,221,0.15)' : undefined,
                    color: active ? '#F1EFE8' : undefined,
                    padding: '6px 14px', fontSize: 11,
                  }}>{e}</div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 28 }}>
            <label className="label">Anything else we should know? (optional)</label>
            <textarea className="input" rows={3} placeholder="Hostel required, team size, dietary preferences, etc." />
          </div>

          <div style={{
            marginTop: 28,
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: isMobile ? 16 : 0,
            paddingTop: 24, borderTop: '1px solid var(--glass-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 14, height: 14, border: '1px solid var(--glass-border-strong)', borderRadius: 3, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, background: 'var(--violet)', borderRadius: 1 }}/>
              </div>
              <span style={{ color: 'var(--ink-dim)', fontSize: 12 }}>I agree to the code of conduct and data policy.</span>
            </div>
            <button onClick={() => setSubmitted(true)} className="btn primary" style={{ padding: '14px 26px', width: isMobile ? '100%' : 'auto' }}>
              Request credentials →
            </button>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}

Object.assign(window, { Login, Credentials });
