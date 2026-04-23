// Ascent — Shared UI components
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUserAuth } from "../lib/UserAuthContext";
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
      {withMark && (
        <div
          style={{
            width: size * 1.1,
            height: size * 1.1,
            borderRadius: 6,
            background:
              "linear-gradient(135deg, rgba(127,119,221,0.35), rgba(29,158,117,0.18))",
            border: "1px solid rgba(255,255,255,0.16)",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--f-mono)",
            fontSize: size * 0.5,
            color: "var(--ink)",
            letterSpacing: 0,
          }}
        >
          <svg
            width={size * 0.55}
            height={size * 0.55}
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M4 20 L12 4 L20 20"
              stroke="#F1EFE8"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d="M8 14 L16 14"
              stroke="#7F77DD"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
      <div
        style={{
          fontFamily: "var(--f-display)",
          fontWeight: 700,
          fontSize: size,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
        }}
      >
        ASCENT
        <span style={{ color: "var(--violet)", marginLeft: 2 }}>.</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sticky Navbar used across all app-internal pages
// ─────────────────────────────────────────────────────────────
export function NavBar({ active, variant = "app" }) {
  const isMobile = useMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoverLogout, setHoverLogout] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useUserAuth() || {};

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
    "Mirage",
    "Announcements",
  ];
  const publicItems = ["Overview", "Events", "FAQ"];
  const items = variant === "app" ? appItems : publicItems;

  const navClick = (key) => {
    const routes = {
      dashboard: "/dashboard",
      schedule: "/schedule",
      explore: "/explore",
      leaderboard: "/leaderboard",
      mirage: "/mirage",
      announcements: "/announcements",
      landing: "/",
      overview: "/",
      events: "/explore",
      faq: "/faq",
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
              <div
                style={{ position: "relative" }}
                onMouseEnter={() => setHoverLogout(true)}
                onMouseLeave={() => setHoverLogout(false)}
              >
                <div
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
                    border: "1px solid rgba(255,255,255,0.2)",
                    cursor: "pointer",
                  }}
                  onClick={() => navClick("event-detail")}
                >
                  {initials}
                </div>

                {hoverLogout && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      paddingTop: 8,
                      zIndex: 50,
                    }}
                  >
                    <button
                      onClick={handleLogout}
                      style={{
                        background: "#e53e3e",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: 6,
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                      }}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <a onClick={() => navClick("login")} className="btn ghost sm">
                  Login
                </a>
                <a
                  onClick={() => navClick("credentials")}
                  className="btn primary sm"
                >
                  Register
                </a>
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
                <a
                  onClick={() => navClick("credentials")}
                  className="btn primary"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Register
                </a>
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
// QR placeholder (visual fake)
// ─────────────────────────────────────────────────────────────
export function QRCode({ size = 180, seed = "ASCENT-ABC123" }) {
  const cells = 21;
  const rng = (i) => {
    let h = 2166136261;
    for (let j = 0; j < seed.length; j++)
      h = (h ^ seed.charCodeAt(j)) * 16777619;
    h = (h ^ i) * 16777619;
    return ((h >>> 0) % 1000) / 1000;
  };
  const c = size / cells;
  const rects = [];
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const inFinder =
        (x < 7 && y < 7) ||
        (x >= cells - 7 && y < 7) ||
        (x < 7 && y >= cells - 7);
      let on;
      if (inFinder) {
        const lx = x < 7 ? x : x - (cells - 7);
        const ly = y < 7 ? y : y - (cells - 7);
        on =
          lx === 0 ||
          lx === 6 ||
          ly === 0 ||
          ly === 6 ||
          (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
      } else {
        on = rng(y * cells + x) > 0.52;
      }
      if (on)
        rects.push(
          <rect
            key={`${x}-${y}`}
            x={x * c}
            y={y * c}
            width={c}
            height={c}
            fill="#F1EFE8"
          />,
        );
    }
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ borderRadius: 8, background: "#0D0D12" }}
    >
      {rects}
    </svg>
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
            {["IG", "X", "IN", "YT", "GH"].map((s) => (
              <div
                key={s}
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
                }}
              >
                {s}
              </div>
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
                items: ["Overview", "Events", "Schedule", "Sponsors"],
              },
              {
                h: "Participate",
                items: ["Register", "Login", "FAQ", "Code of Conduct"],
              },
            ].map((col) => (
              <div key={col.h}>
                <div className="eyebrow" style={{ marginBottom: 14 }}>
                  {col.h}
                </div>
                {col.items.map((it) => (
                  <div
                    key={it}
                    style={{
                      color: "var(--ink-dim)",
                      fontSize: 13,
                      marginBottom: 8,
                      cursor: "pointer",
                    }}
                  >
                    {it}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          [
            { h: 'Fest', items: ['Overview','Events','Schedule'] },
            { h: 'Participate', items: ['Get Credentials','Login','FAQ'] },
            { h: 'Contact', items: ['archived-559b490477@example.invalid','14, 3rd cross, Parappana Agrahar, Electronic City Rd, Electronic City Phase I, Electronic City, Bengaluru, Karnataka 560100, India'] },
          ].map(col => (
            <div key={col.h}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                {col.h}
              </div>
              {col.items.map((it) => (
                <div
                  key={it}
                  style={{
                    color: "var(--ink-dim)",
                    fontSize: 13,
                    marginBottom: 8,
                    cursor: "pointer",
                  }}
                >
                  {it}
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
