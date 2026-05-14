// Ascent — Shared UI components
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import { useUserAuth } from "../lib/UserAuthContext";
import { notifications as notificationsApi, coins as coinsApi, users } from "../lib/api";
import ascentCoinImg from "../assets/ascent-coin.png";

let _navCoinStyleInjected = false;
function injectNavCoinStyles() {
  if (_navCoinStyleInjected) return;
  _navCoinStyleInjected = true;
  const el = document.createElement("style");
  el.textContent = `
    @keyframes navCoinFlip { 0%{transform:rotateY(0deg)} 100%{transform:rotateY(360deg)} }
    .nav-coin-wrap { perspective:500px; display:inline-flex; align-items:center; }
    .nav-coin-inner { border-radius:50%; transform-style:preserve-3d; }
    .nav-coin-wrap:hover .nav-coin-inner { animation:navCoinFlip 0.55s cubic-bezier(0.4,0,0.2,1) both; }
    .nav-coin-inner img { display:block; border-radius:50%; pointer-events:none; user-select:none; }
  `;
  document.head.appendChild(el);
}

// ─────────────────────────────────────────────────────────────
// Profile Popover
// ─────────────────────────────────────────────────────────────
function ProfilePopover({ user, setUser, logout }) {
  const [editing, setEditing] = useState(false);
  
  const details = useMemo(() => {
    if (!user?.details) return {};
    try {
      return typeof user.details === 'string' ? JSON.parse(user.details) : user.details;
    } catch { return {}; }
  }, [user]);

  const [form, setForm] = useState({ 
    name: user?.name || '', 
    phone: details?.phone || '', 
    college: details?.college || '',
    city: details?.city || '',
    year: details?.year || '',
    branch: details?.branch || '',
    gender: details?.gender || '',
    emergency_contact: details?.emergency_contact || ''
  });
  const [saving, setSaving] = useState(false);

  // Stop propagation to prevent closing on hover-out if they are typing
  const handleInteraction = (e) => e.stopPropagation();

  const editsCount = details?.name_edits || 0;
  const canEditName = editsCount < 2;

  const handleSave = async () => {
    setSaving(true);
    try {
      const newDetails = { ...details, phone: form.phone, college: form.college, city: form.city, year: form.year, branch: form.branch, gender: form.gender, emergency_contact: form.emergency_contact };
      if (form.name !== user?.name) {
        newDetails.name_edits = editsCount + 1;
      }
      const updatedUser = await users.patch('me', { name: form.name, details: newDetails });
      if (setUser) setUser(updatedUser);
      setEditing(false);
    } catch (e) {
      alert(e.data?.detail || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div 
      onMouseEnter={handleInteraction}
      onMouseLeave={e => editing && handleInteraction(e)}
      style={{
        width: 320, padding: 20,
        background: 'rgba(20,20,25,0.95)',
        backdropFilter: 'blur(24px)',
        border: '1px solid var(--glass-border-strong)',
        borderRadius: 16,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', gap: 16,
        cursor: 'default',
        textAlign: 'left'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontFamily: 'var(--f-display)', color: 'var(--ink)' }}>Profile</h3>
        {!editing ? (
          <button onClick={() => setEditing(true)} style={{ background: 'transparent', border: 'none', color: 'var(--violet)', fontSize: 12, cursor: 'pointer' }}>Edit</button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(false)} style={{ background: 'transparent', border: 'none', color: 'var(--ink-dim)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ background: 'transparent', border: 'none', color: 'var(--violet)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Name {editing ? `(${2 - editsCount} edits left)` : ''}
          </span>
          {editing && canEditName ? (
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--ink)', padding: '6px 10px', borderRadius: 6, fontSize: 13, outline: 'none' }} />
          ) : (
            <div style={{ fontSize: 14, color: 'var(--ink)' }}>{user.name}</div>
          )}
        </label>
        
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</span>
          <div style={{ fontSize: 14, color: 'var(--ink-dim)' }}>{user.email || user.username}</div>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</span>
          {editing ? (
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--ink)', padding: '6px 10px', borderRadius: 6, fontSize: 13, outline: 'none' }} />
          ) : (
            <div style={{ fontSize: 14, color: 'var(--ink)' }}>{details.phone || 'Not provided'}</div>
          )}
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>College</span>
          {editing ? (
            <input value={form.college} onChange={e => setForm({...form, college: e.target.value})} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--ink)', padding: '6px 10px', borderRadius: 6, fontSize: 13, outline: 'none' }} />
          ) : (
            <div style={{ fontSize: 14, color: 'var(--ink)' }}>{details.college || 'Not provided'}</div>
          )}
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Branch / Specialization</span>
          {editing ? (
            <input value={form.branch} onChange={e => setForm({...form, branch: e.target.value})} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--ink)', padding: '6px 10px', borderRadius: 6, fontSize: 13, outline: 'none' }} />
          ) : (
            <div style={{ fontSize: 14, color: 'var(--ink)' }}>{details.branch || 'Not provided'}</div>
          )}
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>City</span>
            {editing ? (
              <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--ink)', padding: '6px 10px', borderRadius: 6, fontSize: 13, outline: 'none' }} />
            ) : (
              <div style={{ fontSize: 14, color: 'var(--ink)' }}>{details.city || 'Not provided'}</div>
            )}
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Year</span>
            {editing ? (
              <input value={form.year} onChange={e => setForm({...form, year: e.target.value})} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--ink)', padding: '6px 10px', borderRadius: 6, fontSize: 13, outline: 'none' }} />
            ) : (
              <div style={{ fontSize: 14, color: 'var(--ink)' }}>{details.year || 'Not provided'}</div>
            )}
          </label>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emergency Contact</span>
          {editing ? (
            <input value={form.emergency_contact} onChange={e => setForm({...form, emergency_contact: e.target.value})} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--ink)', padding: '6px 10px', borderRadius: 6, fontSize: 13, outline: 'none' }} />
          ) : (
            <div style={{ fontSize: 14, color: 'var(--ink)' }}>{details.emergency_contact || 'Not provided'}</div>
          )}
        </label>
      </div>

      <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 16, marginTop: 4 }}>
        <button onClick={logout} style={{ width: '100%', padding: '8px', background: 'rgba(229, 62, 62, 0.1)', color: '#fc8181', border: '1px solid rgba(229, 62, 62, 0.2)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(229, 62, 62, 0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(229, 62, 62, 0.1)'}>Logout</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Responsive hook
// ─────────────────────────────────────────────────────────────
export function useMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [breakpoint]);
  return mobile;
}

// ─────────────────────────────────────────────────────────────
// Logo placeholder — user will swap with real logo
// ─────────────────────────────────────────────────────────────
export function AscentLogo({ size = 22, withMark = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <img 
        src="https://res.cloudinary.com/dglvt0iom/image/upload/v1777041823/ascent_logo_uvllh8.svg" 
        alt="Ascent Logo" 
        style={{ height: size * 1.5, display: "block" }} 
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sticky Navbar used across all app-internal pages
// ─────────────────────────────────────────────────────────────
export function NavBar({ active, variant = "app" }) {
  useEffect(() => { injectNavCoinStyles(); }, []);
  const isMobile = useMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);
  const [notifs, setNotifs] = useState({ items: [], unread: 0 });
  const [coinBalance, setCoinBalance] = useState(() => {
    const cached = localStorage.getItem("ascentCoinBalance");
    return cached !== null ? Number(cached) : null;
  });
  const navigate = useNavigate();
  const { user, logout, setUser } = useUserAuth() || {};

  // Close popovers on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const onDoc = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [profileOpen]);

  useEffect(() => {
    if (!bellOpen) return;
    const onDoc = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [bellOpen]);

  // Poll notifications every 15s — only when there is a logged-in user.
  const loadNotifs = useCallback(() => {
    if (!user) return;
    notificationsApi.list(20).then(setNotifs).catch((e) => {
      if (e?.status === 401) logout?.();
    });
  }, [user, logout]);
  useEffect(() => { loadNotifs(); }, [loadNotifs]);
  useEffect(() => {
    if (!user) return;
    // Poll every 15s so an admin approval/rejection shows up in the bell
    // within ~15s without manually reloading. Also re-fetch when the tab
    // regains focus so a returning user gets the latest state immediately.
    const id = setInterval(loadNotifs, 15000);
    const onFocus = () => loadNotifs();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadNotifs, user]);

  // Coin balance — pulled into the topbar chip. Only meaningful when the
  // user is logged in; backend returns 401/403 otherwise.
  const loadCoins = useCallback(() => {
    if (!user) return;
    coinsApi.balance()
      .then((b) => {
        const val = typeof b?.balance === "number" ? b.balance : null;
        setCoinBalance(val);
        if (val !== null) localStorage.setItem("ascentCoinBalance", String(val));
      })
      .catch((e) => {
        if (e?.status === 401) logout?.();
      });
  }, [user, logout]);
  useEffect(() => { loadCoins(); }, [loadCoins]);
  useEffect(() => {
    if (!user) return;
    const id = setInterval(loadCoins, 30000);
    const onFocus = () => loadCoins();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadCoins, user]);

  const onBellOpen = () => {
    setBellOpen((v) => {
      const next = !v;
      if (next && notifs.unread > 0) {
        notificationsApi.markAllRead()
          .then(() => setNotifs((n) => ({
            ...n, unread: 0,
            items: n.items.map(it => ({ ...it, read_at: it.read_at || new Date().toISOString() })),
          })))
          .catch(() => {});
      }
      return next;
    });
  };

  function relTimeShort(iso) {
    if (!iso) return "";
    const d = (Date.now() - new Date(iso)) / 1000;
    if (d < 60) return `${Math.floor(d)}s`;
    if (d < 3600) return `${Math.floor(d / 60)}m`;
    if (d < 86400) return `${Math.floor(d / 3600)}h`;
    return `${Math.floor(d / 86400)}d`;
  }

  const handleLogout = () => {
    if (logout) logout();
    navigate("/");
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AR";
  const displayName = user?.name || "Aarav Rao";
  const appItems = [
    "Dashboard",
    "Schedule",
    "Explore",
    "Leaderboard",
    ...(user?.is_attending ? ["My Coins"] : []),
    "Mirage",
    "Announcements",
    "Merch",
  ];
  const publicItems = ["Overview", "Schedule", "Events", "Sponsors", "FAQ", "Merch", "Tour"];
  const items = variant === "app" ? appItems : publicItems;

  const navClick = (key) => {
    const routes = {
      dashboard: "/dashboard",
      schedule: "/schedule",
      explore: "/explore",
      leaderboard: "/leaderboard",
      "my coins": "/coins",
      mirage: "/mirage",
      announcements: "/announcements",
      landing: "/",
      overview: "/",
      events: "/explore",
      sponsors: "/sponsors",
      faq: "/faq",
      merch: "/merch",
      tour: "/tour",
      login: "/login",
      credentials: "/credentials",
      "event-detail": "/event-detail",
    };
    navigate(routes[key] ?? `/${key}`);
    setMenuOpen(false);
  };

  return (
    <>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          padding: isMobile ? "12px 20px" : "14px 28px",
          backdropFilter: "blur(18px) saturate(130%)",
          WebkitBackdropFilter: "blur(18px) saturate(130%)",
          background: "rgba(13,13,18,0.6)",
          borderBottom: "1px solid var(--glass-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div
            onClick={() => navClick("landing")}
            style={{ cursor: "pointer" }}
          >
            <AscentLogo size={18} />
          </div>
          {!isMobile && (
            <nav style={{ display: "flex", gap: 4 }}>
              {items.map((item) => {
                const key = item.toLowerCase();
                const isActive = (active || "").toLowerCase() === key;
                return (
                  <a
                    key={item}
                    onClick={() => navClick(key)}
                    style={{
                      padding: "8px 14px",
                      fontSize: 12.5,
                      letterSpacing: "0.01em",
                      color: isActive ? "var(--ink)" : "var(--ink-dim)",
                      background: isActive
                        ? "rgba(255,255,255,0.06)"
                        : "transparent",
                      border: isActive
                        ? "1px solid var(--glass-border)"
                        : "1px solid transparent",
                      borderRadius: 999,
                      cursor: "pointer",
                      transition: "all .2s",
                      fontFamily: "var(--f-body)",
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) =>
                      !isActive && (e.currentTarget.style.color = "var(--ink)")
                    }
                    onMouseLeave={(e) =>
                      !isActive &&
                      (e.currentTarget.style.color = "var(--ink-dim)")
                    }
                  >
                    {item}
                  </a>
                );
              })}
            </nav>
          )}
        </div>

        {isMobile ? (
          <button
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--glass-border)",
              borderRadius: 8,
              width: 38,
              height: 38,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              color: "var(--ink)",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {variant === "app" ? (
              <>
              {/* Bell */}
              <div ref={bellRef} style={{ position: "relative" }}>
                <button
                  onClick={onBellOpen}
                  aria-label="Notifications"
                  style={{
                    background: "transparent", border: 0, color: "var(--ink-dim)",
                    cursor: "pointer", padding: 6, position: "relative",
                  }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  {notifs.unread > 0 && (
                    <span style={{
                      position: "absolute", top: 0, right: 0,
                      minWidth: 16, height: 16, borderRadius: 999, padding: "0 4px",
                      background: "var(--violet)", color: "#fff",
                      fontSize: 9, fontFamily: "var(--f-mono)", fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 0 0 2px var(--bg)",
                    }}>{notifs.unread > 9 ? "9+" : notifs.unread}</span>
                  )}
                </button>

                {bellOpen && (
                  <div className="fade-up" style={{
                    position: "absolute", top: "calc(100% + 10px)", right: 0,
                    width: 360, maxHeight: 480, overflowY: "auto",
                    padding: 14, zIndex: 50,
                    background: "rgba(15, 15, 22, 0.97)",
                    border: "1px solid var(--glass-border-strong)",
                    borderRadius: "var(--r-lg)",
                    backdropFilter: "blur(28px) saturate(140%)",
                    WebkitBackdropFilter: "blur(28px) saturate(140%)",
                    boxShadow: "0 30px 80px -30px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.04)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px 8px" }}>
                      <div className="eyebrow">§ NOTIFICATIONS</div>
                      <span className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>
                        {notifs.items.length} TOTAL
                      </span>
                    </div>
                    {notifs.items.length === 0 ? (
                      <div style={{ padding: 24, textAlign: "center", color: "var(--ink-mute)", fontSize: 12.5 }}>
                        No notifications yet.
                      </div>
                    ) : notifs.items.map((n) => {
                      const tone =
                        n.template_key === "ugc_rejected" ? "var(--amber)" :
                        n.template_key === "ugc_approved" ? "var(--teal)" :
                        n.template_key === "post_deleted_reversal" ? "var(--amber)" :
                        "var(--violet)";
                      return (
                        <div key={n.id} style={{
                          padding: "12px 4px",
                          borderBottom: "1px solid var(--glass-border)",
                          opacity: n.read_at ? 0.7 : 1,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: tone, flexShrink: 0 }} />
                              <span style={{
                                fontSize: 13, color: "var(--ink)", fontWeight: 500,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                {n.title}
                              </span>
                            </div>
                            <span className="mono" style={{ fontSize: 9.5, color: "var(--ink-mute)", flexShrink: 0 }}>
                              {relTimeShort(n.created_at)}
                            </span>
                          </div>
                          <div style={{
                            fontSize: 12, color: "var(--ink-dim)", marginTop: 6,
                            marginLeft: 14, lineHeight: 1.45,
                          }}>
                            {n.body}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Coin balance chip — only shown to attending users */}
              {coinBalance != null && user?.is_attending && (
                <button
                  onClick={() => navigate("/coins/rewards")}
                  aria-label={`Coin balance ${coinBalance.toLocaleString()}`}
                  className="mono"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "6px 11px", height: 30, borderRadius: 999,
                    background: "linear-gradient(135deg, rgba(127,119,221,0.18), rgba(64,212,196,0.12))",
                    border: "1px solid var(--violet-dim)",
                    color: "var(--ink)", fontSize: 12, letterSpacing: "0.06em",
                    cursor: "pointer",
                    boxShadow: "0 0 0 0 var(--violet-glow)",
                    transition: "box-shadow .2s, transform .15s, border-color .2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 14px var(--violet-glow)";
                    e.currentTarget.style.borderColor = "var(--violet)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 0 0 var(--violet-glow)";
                    e.currentTarget.style.borderColor = "var(--violet-dim)";
                  }}
                >
                  <div className="nav-coin-wrap">
                    <div className="nav-coin-inner">
                      <img src={ascentCoinImg} alt="" width={18} height={18} />
                    </div>
                  </div>
                  <span style={{ fontWeight: 600 }}>{coinBalance.toLocaleString()}</span>
                </button>
              )}

              <div ref={profileRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setProfileOpen((v) => !v)}
                  aria-label="Profile menu"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, var(--violet), var(--teal))",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--f-mono)",
                    fontSize: 11,
                    color: "#fff",
                    border: profileOpen
                      ? "2px solid var(--violet)"
                      : "1px solid rgba(255,255,255,0.2)",
                    cursor: "pointer",
                    padding: 0,
                    boxShadow: profileOpen
                      ? "0 0 0 3px rgba(127,119,221,0.18)"
                      : "none",
                    transition: "box-shadow .2s, border-color .2s",
                  }}
                >
                  {initials}
                </button>

                {profileOpen && (
                  <div
                    className="fade-up"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 10px)",
                      right: 0,
                      paddingTop: 12,
                      zIndex: 50,
                      background: "rgba(15, 15, 22, 0.97)",
                      border: "1px solid var(--glass-border-strong)",
                      borderRadius: "var(--r-lg)",
                      backdropFilter: "blur(28px) saturate(140%)",
                      WebkitBackdropFilter: "blur(28px) saturate(140%)",
                      boxShadow:
                        "0 30px 80px -30px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.04)",
                    }}
                  >
                    <ProfilePopover
                      user={user}
                      setUser={setUser}
                      logout={() => {
                        setProfileOpen(false);
                        handleLogout();
                      }}
                    />
                  </div>
                )}
              </div>
              </>
            ) : (
              <>
                <a onClick={() => navClick("login")} className="btn ghost sm">
                  Login
                </a>
                {/* <a
                  onClick={() => navClick("credentials")}
                  className="btn primary sm"
                >
                  Register
                </a> */}
              </>
            )}
          </div>
        )}
      </div>

      {/* Mobile slide-down menu */}
      {isMobile && menuOpen && (
        <div
          style={{
            position: "fixed",
            top: 53,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 39,
            background: "rgba(10,10,16,0.97)",
            backdropFilter: "blur(24px)",
            borderTop: "1px solid var(--glass-border)",
            display: "flex",
            flexDirection: "column",
            padding: "20px 20px 32px",
            overflowY: "auto",
          }}
        >
          {items.map((item) => {
            const key = item.toLowerCase();
            const isActive = (active || "").toLowerCase() === key;
            return (
              <a
                key={item}
                onClick={() => navClick(key)}
                style={{
                  display: "block",
                  padding: "16px 4px",
                  fontSize: 22,
                  fontFamily: "var(--f-display)",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  color: isActive ? "var(--violet)" : "var(--ink)",
                  borderBottom: "1px solid var(--glass-border)",
                  cursor: "pointer",
                }}
              >
                {item}
              </a>
            );
          })}
          <div
            style={{
              marginTop: 28,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {variant === "app" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 4px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background:
                        "linear-gradient(135deg, var(--violet), var(--teal))",
                      display: "grid",
                      placeItems: "center",
                      fontFamily: "var(--f-mono)",
                      fontSize: 12,
                      color: "#fff",
                    }}
                  >
                    {initials}
                  </div>
                  <span
                    style={{
                      color: "var(--ink-dim)",
                      fontSize: 13,
                      fontFamily: "var(--f-body)",
                    }}
                  >
                    {displayName}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    background: "#e53e3e",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 6,
                    padding: "6px 16px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <a
                  onClick={() => navClick("login")}
                  className="btn ghost"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Login
                </a>
                {/* <a
                  onClick={() => navClick("credentials")}
                  className="btn primary"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Register
                </a> */}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Countdown Timer
// ─────────────────────────────────────────────────────────────
export function useCountdown(targetIso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const target = useMemo(() => new Date(targetIso).getTime(), [targetIso]);
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000) % 24;
  const m = Math.floor(diff / 60000) % 60;
  const s = Math.floor(diff / 1000) % 60;
  return { d, h, m, s };
}

function CountdownUnit({ value, label, small }) {
  const v = String(value).padStart(2, "0");
  return (
    <div
      style={{
        flex: 1,
        padding: small ? "14px 12px 12px" : "22px 20px 18px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(20px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontFamily: "var(--f-display)",
          fontSize: small ? 34 : 56,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: "var(--ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {v}
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: "var(--f-mono)",
          fontSize: small ? 9 : 10.5,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: "var(--violet)",
          boxShadow: "0 0 8px var(--violet)",
        }}
      />
    </div>
  );
}

export function Countdown({ target }) {
  const isMobile = useMobile();
  const { d, h, m, s } = useCountdown(target);
  return (
    <div style={{ display: "flex", gap: isMobile ? 8 : 12, width: "100%" }}>
      <CountdownUnit value={d} label="Days" small={isMobile} />
      <CountdownUnit value={h} label="Hours" small={isMobile} />
      <CountdownUnit value={m} label="Mins" small={isMobile} />
      <CountdownUnit value={s} label="Secs" small={isMobile} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Animated number counter
// ─────────────────────────────────────────────────────────────
export function NumberCounter({
  to,
  duration = 1400,
  suffix = "",
  decimals = 0,
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {n.toFixed(decimals)}
      {suffix}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Placeholder poster
// ─────────────────────────────────────────────────────────────
export function PosterPlaceholder({
  title = "POSTER",
  sub = "700 × 400",
  w = 700,
  h = 400,
  tone = "violet",
  style = {},
  imgUrl = null,
}) {
  const wNum = typeof w === "number" ? w : 700;
  const g =
    tone === "teal"
      ? "linear-gradient(135deg, rgba(29,158,117,0.35), rgba(127,119,221,0.15) 60%, rgba(13,13,18,0.9))"
      : tone === "amber"
        ? "linear-gradient(135deg, rgba(232,185,116,0.35), rgba(127,119,221,0.15) 60%, rgba(13,13,18,0.9))"
        : "linear-gradient(135deg, rgba(127,119,221,0.35), rgba(29,158,117,0.15) 60%, rgba(13,13,18,0.9))";
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 14,
        overflow: "hidden",
        position: "relative",
        background: imgUrl ? `url(${imgUrl}) center/cover no-repeat` : g,
        border: "1px solid rgba(255,255,255,0.1)",
        ...style,
      }}
    >
      {!imgUrl && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 14px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              maskImage:
                "radial-gradient(ellipse at center, #000 30%, transparent 75%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <div className="eyebrow" style={{ opacity: 0.7 }}>
              [ drop poster {sub} ]
            </div>
            <div
              style={{
                fontFamily: "var(--f-display)",
                fontWeight: 700,
                fontSize: Math.min(48, wNum * 0.09),
                letterSpacing: "-0.02em",
                color: "rgba(241,239,232,0.85)",
              }}
            >
              {title}
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "repeating-linear-gradient(to bottom, transparent 0 2px, rgba(0,0,0,0.08) 2px 3px)",
              pointerEvents: "none",
            }}
          />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Image placeholder (generic, for gallery etc.)
// ─────────────────────────────────────────────────────────────
export function ImgPlaceholder({
  w,
  h,
  label,
  tone = "violet",
  style = {},
  badge,
}) {
  const tones = {
    violet: ["rgba(127,119,221,0.3)", "rgba(29,158,117,0.1)"],
    teal: ["rgba(29,158,117,0.3)", "rgba(127,119,221,0.12)"],
    amber: ["rgba(232,185,116,0.28)", "rgba(127,119,221,0.12)"],
    slate: ["rgba(120,130,160,0.25)", "rgba(29,158,117,0.08)"],
  }[tone] || ["rgba(127,119,221,0.3)", "rgba(29,158,117,0.1)"];
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 10,
        background: `linear-gradient(135deg, ${tones[0]}, ${tones[1]})`,
        border: "1px solid rgba(255,255,255,0.08)",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 8px)",
        }}
      />
      {label && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 10,
            fontFamily: "var(--f-mono)",
            fontSize: 9.5,
            color: "rgba(241,239,232,0.7)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
      )}
      {badge && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            padding: "2px 8px",
            borderRadius: 999,
            fontFamily: "var(--f-mono)",
            fontSize: 9,
            background: "rgba(13,13,18,0.7)",
            color: "var(--ink-dim)",
            border: "1px solid rgba(255,255,255,0.12)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {badge}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// QR (real, scan-ready)
// ─────────────────────────────────────────────────────────────
export function QRCode({ size = 180, seed = "ASCENT-ABC123" }) {
  const value = seed || "ASCENT-ABC123";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        overflow: "hidden",
        background: "#0D0D12",
        display: "grid",
        placeItems: "center",
      }}
    >
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        includeMargin={true}
        bgColor="#0D0D12"
        fgColor="#F1EFE8"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Background scaffold with grid + noise + glows
// ─────────────────────────────────────────────────────────────
export function PageBackground({
  children,
  glows = true,
  bgImage = null,
  blurAmount = 18,
  dimAmount = 0.72,
}) {
  return (
    <div
      className="bg-noise"
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {bgImage && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              backgroundImage: `url('${bgImage}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: `blur(${blurAmount}px)`,
              transform: "scale(1.08)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              background: `rgba(10,10,16,${dimAmount})`,
            }}
          />
        </>
      )}
      <div
        className="bg-grid"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          maskImage:
            "radial-gradient(ellipse 90% 60% at 50% 30%, #000 40%, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 60% at 50% 30%, #000 40%, transparent 85%)",
        }}
      />
      {glows && (
        <>
          <div
            className="bg-glow-violet"
            style={{ top: -180, left: -180, zIndex: 1 }}
          />
          <div
            className="bg-glow-teal"
            style={{ top: 180, right: -200, zIndex: 1 }}
          />
        </>
      )}
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────
export function Footer() {
  const isMobile = useMobile();
  const navigate = useNavigate();

  const handleNav = (to) => {
    if (!to) return;
    if (to.startsWith('mailto:')) {
      window.location.href = to;
    } else {
      navigate(to);
    }
  };
  return (
    <footer
      style={{
        marginTop: 80,
        padding: isMobile ? "40px 20px 28px" : "60px 48px 32px",
        borderTop: "1px solid var(--glass-border)",
        background:
          "linear-gradient(180deg, transparent, rgba(127,119,221,0.05))",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr 1fr 1fr",
          gap: isMobile ? 32 : 48,
        }}
      >
        <div>
          <AscentLogo size={22} />
          <div
            style={{
              marginTop: 18,
              color: "var(--ink-dim)",
              fontSize: 13,
              lineHeight: 1.6,
              maxWidth: 320,
            }}
          >
            A college tech fest built for the curious. Build, break, ship,
            repeat.
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            {[
              { label: "IG", url: "https://www.instagram.com/ascent.sst/" },
              { label: "UN", url: "https://unstop.com/college-fests/ascent-scaler-school-of-technology-bengaluru-karnataka-454762" }
            ].map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: "1px solid var(--glass-border)",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--f-mono)",
                  fontSize: 10,
                  color: "var(--ink-dim)",
                  cursor: "pointer",
                  textDecoration: "none"
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
        {isMobile ? (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}
          >
            {[
              {
                h: "Fest",
                items: [
                  { label: "Overview", to: "/login" },
                  { label: "Events", to: "/explore" },
                  { label: "Schedule", to: "/schedule" },
                  { label: "Sponsors", to: null },
                ],
              },
              {
                h: "Participate",
                items: [
                  // { label: "Register", to: "/credentials" },
                  { label: "Login", to: "/login" },
                  { label: "FAQ", to: "/faq" },
                  { label: "Code of Conduct", to: null },
                ],
              },
            ].map((col) => (
              <div key={col.h}>
                <div className="eyebrow" style={{ marginBottom: 14 }}>
                  {col.h}
                </div>
                {col.items.map((it) => (
                  <div
                    key={it.label}
                    onClick={() => handleNav(it.to)}
                    style={{
                      color: "var(--ink-dim)",
                      fontSize: 13,
                      marginBottom: 8,
                      cursor: it.to ? "pointer" : "default",
                      opacity: it.to ? 1 : 0.6,
                    }}
                  >
                    {it.label}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          [
            { h: 'Fest', items: [
                { label: 'Overview', to: '/' },
                { label: 'Events', to: '/explore' },
                { label: 'Schedule', to: '/schedule' },
                { label: 'Sponsors', to: '/sponsors' },
              ] 
            },
            { h: 'Participate', items: [
                // { label: 'Register', to: '/credentials' },
                { label: 'Login', to: '/login' },
                { label: 'FAQ', to: '/faq' },
              ] 
            },
            { h: 'Contact', items: [
                { label: 'archived-559b490477@example.invalid', to: 'mailto:archived-559b490477@example.invalid' },
                { label: '14, 3rd cross, Parappana Agrahar, Electronic City Rd, Electronic City Phase I, Electronic City, Bengaluru, Karnataka 560100, India', to: null },
              ] 
            },
          ].map(col => (
            <div key={col.h}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                {col.h}
              </div>
              {col.items.map((it) => (
                <div
                  key={it.label}
                  onClick={() => handleNav(it.to)}
                  style={{
                    color: "var(--ink-dim)",
                    fontSize: 13,
                    marginBottom: 8,
                    cursor: it.to ? "pointer" : "default",
                    opacity: it.to ? 1 : 0.6,
                  }}
                >
                  {it.label}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
      <div
        style={{
          marginTop: 48,
          paddingTop: 20,
          borderTop: "1px solid var(--glass-border)",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          gap: isMobile ? 6 : 0,
          color: "var(--ink-mute)",
          fontSize: 11,
          fontFamily: "var(--f-mono)",
          letterSpacing: "0.1em",
        }}
      >
        <span>© 2026 ASCENT FEST · MAY 16–17 · v2.6</span>
        <span>BUILT FOR THE ONES WHO CLIMB</span>
      </div>
    </footer>
  );
}
