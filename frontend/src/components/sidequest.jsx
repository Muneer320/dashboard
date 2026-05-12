// Ascent — Sidequest (Coins / UGC / Rewards / Leaderboard / History)
//
// Layout structure follows the wireframes the owner attached:
//   left sidebar (Command Center / Verification / Leaderboard / Inventory /
//   Settings), minimal topbar, glass-card panels in the main area.
// Visual language uses tokens.css from the existing site (violet primary,
// teal secondary, amber for Power Hour, dark glass cards, Syne/Montserrat/
// JetBrains Mono).

import React, {
  useEffect, useState, useCallback, useMemo, useRef,
} from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useUserAuth } from "../lib/UserAuthContext";
import { useMobile, AscentLogo, NavBar, PageBackground } from "./shared";
import { QRCodeSVG } from "qrcode.react";
import { coins as coinsApi, ugc as ugcApi } from "../lib/api";
import ascentCoinImg from "../assets/ascent-coin.png";

// ─────────────────────────────────────────────────────────────
// Source labels & coin/tier reference
// ─────────────────────────────────────────────────────────────
const SOURCE_LABEL = {
  RSVP_POST:              "RSVP LinkedIn",
  ROUND1_PROJECT:         "Round 1 Project",
  AR_FILTER:              "AR Filter Story",
  SCAVENGER_HUNT:         "Scavenger Hunt",
  RAZORPAY_PITCH:         "Razorpay Pitch",
  FUTURE_VISION:          "Future Vision",
  CREATOR_COLLAB:         "Creator Collab",
  MVP_MUSEUM:             "MVP Museum",
  JOBS_WALL:              "Jobs Wall",
  ESPORTS_1ST:            "Esports — 1st",
  ESPORTS_2ND:            "Esports — 2nd",
  ESPORTS_3RD:            "Esports — 3rd",
  ECO_EXCHANGE:           "Eco Exchange",
  ECO_DESIGN_WIN:         "Eco Design Win",
  EVENT_WIN:              "Event Win",
  ENGAGEMENT:             "Engagement",
  POWER_HOUR_BONUS:       "Power Hour Bonus",
  SURPRISE_DROP:          "Surprise Drop",
  REVERSAL:               "Reversal",
  RESTORE:                "Restore",
  MANUAL_ADJUSTMENT:      "Manual Adjustment",
  REDEMPTION:             "Redemption",
  MEME_CHALLENGE:         "Meme Challenge",
  SIGNATURE_PHOTO_BOOTH:  "Signature & Photo Booth",
};

const COIN_VALUES = {
  RSVP_POST: 300, ROUND1_PROJECT: 500, FUTURE_VISION: 100,
  MVP_MUSEUM: 100, JOBS_WALL: 100, CREATOR_COLLAB: 150,
  AR_FILTER: 200,
  MEME_CHALLENGE: 0,           // TBD
  SIGNATURE_PHOTO_BOOTH: 0,    // TBD
};

// 5-level tier system
const TIER_THRESHOLDS  = { STICKER: 500, BADGE: 700, NOTEPAD: 1000, MUG: 1200, TOTE_BAG_MUG: 1500 };
const TIER_RANK_CUTOFFS = { BADGE: 100, NOTEPAD: 75, MUG: 30, TOTE_BAG_MUG: 10 };
const TIER_LABEL = {
  STICKER: "Sticker", BADGE: "Badge", NOTEPAD: "Notepad",
  MUG: "Mug", TOTE_BAG_MUG: "Tote Bag + Mug",
};

// Screenshot-based sources (file upload, not URL)
const SCREENSHOT_SOURCES = new Set(["AR_FILTER"]);

// Sources shown in the student UGC submit grid
const SUBMIT_SOURCES = [
  "RSVP_POST", "AR_FILTER", "MEME_CHALLENGE", "SIGNATURE_PHOTO_BOOTH",
  "ROUND1_PROJECT", "FUTURE_VISION", "MVP_MUSEUM", "JOBS_WALL", "CREATOR_COLLAB",
];

// ─────────────────────────────────────────────────────────────
// Time / count helpers
// ─────────────────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short",
    });
  } catch { return iso; }
}
function relTime(iso) {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso)) / 1000;
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}
function fmtCountdown(seconds) {
  if (seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─────────────────────────────────────────────────────────────
// FlipCoin — 3-D Y-axis flip on hover.
//   size      : px number for width/height (default 64)
//   float     : adds a gentle idle bob + ambient glow (for hero display)
// ─────────────────────────────────────────────────────────────
const COIN_CSS = `
@keyframes coinFlipHover {
  0%   { transform: rotateY(0deg); }
  100% { transform: rotateY(360deg); }
}
@keyframes coinFloat {
  0%,100% { transform: translateY(0px) rotateY(0deg); }
  50%      { transform: translateY(-10px) rotateY(0deg); }
}
@keyframes coinGlow {
  0%,100% { box-shadow: 0 0 22px 6px rgba(212,175,55,0.25), 0 0 60px 10px rgba(212,175,55,0.10); }
  50%      { box-shadow: 0 0 36px 10px rgba(212,175,55,0.48), 0 0 90px 18px rgba(212,175,55,0.22); }
}
@keyframes spin { to { transform: rotate(360deg); } }

.coin-flip-wrap {
  display: inline-block;
  perspective: 700px;
  cursor: pointer;
  flex-shrink: 0;
}
.coin-flip-inner {
  position: relative;
  transform-style: preserve-3d;
  transition: none;
  border-radius: 50%;
}
.coin-flip-wrap:hover .coin-flip-inner {
  animation: coinFlipHover 0.65s cubic-bezier(0.4, 0, 0.2, 1) both;
}
.coin-flip-inner img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
  pointer-events: none;
  user-select: none;
}
.coin-flip-wrap.coin-hero .coin-flip-inner {
  animation: coinFloat 3.2s ease-in-out infinite;
  border-radius: 50%;
}
.coin-flip-wrap.coin-hero {
  filter: drop-shadow(0 0 18px rgba(212,175,55,0.45)) drop-shadow(0 0 6px rgba(212,175,55,0.30));
  transition: filter 0.3s ease;
}
.coin-flip-wrap.coin-hero:hover {
  filter: drop-shadow(0 0 28px rgba(212,175,55,0.70)) drop-shadow(0 0 10px rgba(212,175,55,0.55));
}
.coin-flip-wrap.coin-hero:hover .coin-flip-inner {
  animation: coinFlipHover 0.65s cubic-bezier(0.4, 0, 0.2, 1) both;
}
`;

let _coinStyleInjected = false;
function injectCoinStyles() {
  if (_coinStyleInjected) return;
  _coinStyleInjected = true;
  const el = document.createElement("style");
  el.textContent = COIN_CSS;
  document.head.appendChild(el);
}

function FlipCoin({ size = 64, hero = false }) {
  useEffect(() => { injectCoinStyles(); }, []);
  return (
    <div
      className={`coin-flip-wrap${hero ? " coin-hero" : ""}`}
      style={{ width: size, height: size }}
    >
      <div className="coin-flip-inner" style={{ width: size, height: size }}>
        <img src={ascentCoinImg} alt="Ascent Cent" draggable={false} />
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 32, color: "var(--ink-mute)" }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Layout shell — left sidebar + minimal topbar
// ─────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: "command",      label: "Command Center", to: "/coins",            iconKey: "grid" },
  { key: "verification", label: "Verification",   to: "/coins/submit",     iconKey: "check" },
  { key: "leaderboard",  label: "Leaderboard",    to: "/coins/leaderboard",iconKey: "bars" },
  { key: "rewards",      label: "Rewards",        to: "/coins/rewards",    iconKey: "box" },
  { key: "qr",           label: "My QR",          to: "/coins/qr",         iconKey: "qr" },
  { key: "history",      label: "History",        to: "/coins/history",    iconKey: "clock" },
  { key: "guide",        label: "How to Earn",    to: "/coins/guide",      iconKey: "book" },
  { key: "terms",        label: "Terms",          to: "/coins/terms",      iconKey: "scroll" },
];

function NavIcon({ k }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (k) {
    case "grid":  return <svg {...common}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    case "check": return <svg {...common}><polyline points="20 6 9 17 4 12"/></svg>;
    case "bars":  return <svg {...common}><line x1="6" y1="20" x2="6" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/></svg>;
    case "box":   return <svg {...common}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg>;
    case "clock": return <svg {...common}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case "gear":  return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case "menu":  return <svg {...common}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
    case "bell":  return <svg {...common}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
    case "search":return <svg {...common}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    case "x":     return <svg {...common}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    case "bolt":  return <svg {...common}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor"/></svg>;
    case "coin":  return <svg {...common}><circle cx="12" cy="12" r="9"/><text x="12" y="16" textAnchor="middle" fontSize="11" fill="currentColor" stroke="none" fontFamily="var(--f-display)" fontWeight="700">$</text></svg>;
    case "qr":    return <svg {...common}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="21"/><line x1="18" y1="14" x2="18" y2="18"/><line x1="14" y1="18" x2="21" y2="18"/></svg>;
    case "book":   return <svg {...common}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
    case "scroll": return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
    default:       return null;
  }
}

function SidequestLayout({ active, children }) {
  const isMobile = useMobile();
  const { user } = useUserAuth() || {};
  const [open, setOpen] = useState(false);

  return (
    <PageBackground
      bgImage="https://res.cloudinary.com/dglvt0iom/image/upload/v1776878490/dashboard_scene_k9629h.jpg"
      blurAmount={16}
      dimAmount={0.78}
    >
      {/* Public app NavBar — keeps cross-app nav (Dashboard / Schedule /
          Explore / My Coins / Mirage / Announcements) visible while inside
          the Sidequest shell. */}
      <div style={{ position: "relative", zIndex: 3 }}>
        <NavBar variant="app" active="my coins" />
      </div>

      <div style={{
        position: "relative", zIndex: 2,
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "240px 1fr",
        minHeight: "calc(100vh - 56px)",
      }}>
        {/* SIDEBAR */}
        {(isMobile && open) || !isMobile ? (
          <aside style={{
            position: isMobile ? "fixed" : "sticky",
            top: isMobile ? 0 : 56, left: 0,
            height: isMobile ? "100vh" : "calc(100vh - 56px)",
            width: isMobile ? 260 : "auto",
            zIndex: isMobile ? 60 : 5,
            padding: "22px 18px",
            background: "rgba(10,10,16,0.78)",
            borderRight: "1px solid var(--glass-border)",
            backdropFilter: "blur(22px) saturate(140%)",
            WebkitBackdropFilter: "blur(22px) saturate(140%)",
            display: "flex", flexDirection: "column", gap: 26,
          }}>
            {/* Brand */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div className="mono" style={{
                  fontSize: 11, letterSpacing: "0.22em", color: "var(--teal)", textTransform: "uppercase",
                }}>Ascent Admin</div>
                {isMobile && (
                  <button onClick={() => setOpen(false)} style={{
                    background: "transparent", border: 0, color: "var(--ink-mute)", cursor: "pointer",
                  }}>
                    <NavIcon k="x" />
                  </button>
                )}
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 6 }}>
                Terminal v2.0.4
              </div>
            </div>

            {/* Nav */}
            <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {NAV_ITEMS.map((it) => {
                const isActive = active === it.key;
                return (
                  <NavLink
                    key={it.key} to={it.to}
                    onClick={() => setOpen(false)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 12px", borderRadius: "var(--r-md)",
                      textDecoration: "none",
                      fontSize: 12.5, letterSpacing: "0.06em", textTransform: "uppercase",
                      fontFamily: "var(--f-mono)",
                      color: isActive ? "var(--ink)" : "var(--ink-mute)",
                      background: isActive ? "rgba(127,119,221,0.12)" : "transparent",
                      borderLeft: `2px solid ${isActive ? "var(--violet)" : "transparent"}`,
                    }}>
                    <NavIcon k={it.iconKey} />
                    <span>{it.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Session footer */}
            <div className="glass" style={{ padding: 12 }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--ink-mute)" }}>
                SESSION
              </div>
              <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--ink)" }}>
                {user?.name || "Operator"}
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--teal)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--teal)" }} />
                ACTIVE
              </div>
            </div>
          </aside>
        ) : null}

        {isMobile && open && (
          <div onClick={() => setOpen(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 55,
            backdropFilter: "blur(4px)",
          }} />
        )}

        {/* MAIN */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          {isMobile && (
            <header style={{
              position: "sticky", top: 56, zIndex: 4,
              padding: "10px 16px",
              borderBottom: "1px solid var(--glass-border)",
              background: "rgba(13,13,18,0.55)",
              backdropFilter: "blur(18px) saturate(130%)",
              WebkitBackdropFilter: "blur(18px) saturate(130%)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <button onClick={() => setOpen(true)} style={{
                background: "transparent", border: 0, color: "var(--ink)", cursor: "pointer",
              }}>
                <NavIcon k="menu" />
              </button>
              <span className="mono" style={{
                fontSize: 11, letterSpacing: "0.18em", color: "var(--ink-mute)",
              }}>SIDEQUEST</span>
            </header>
          )}

          {/* Content */}
          <div style={{ padding: isMobile ? "20px 16px 60px" : "28px 32px 80px" }}>
            {children}
          </div>
        </div>
      </div>
    </PageBackground>
  );
}

// ─────────────────────────────────────────────────────────────
// Power Hour banner — shared across pages
// ─────────────────────────────────────────────────────────────
function PowerHourBanner({ status }) {
  const navigate = useNavigate();
  if (!status?.active) return null;
  return (
    <div className="glass-strong" style={{
      padding: "14px 18px", marginBottom: 22,
      borderColor: "rgba(232,185,116,0.45)",
      background: "linear-gradient(180deg, rgba(232,185,116,0.20), rgba(232,185,116,0.06))",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ color: "var(--amber)" }}><NavIcon k="bolt" /></span>
        <div>
          <div className="mono" style={{
            fontSize: 11, letterSpacing: "0.18em", color: "var(--amber)", textTransform: "uppercase",
          }}>{status.label || "Power Hour Active"}</div>
          <div style={{ fontSize: 14, color: "var(--ink)", marginTop: 4 }}>
            2× multiplier active. Post in the next{" "}
            <span className="mono" style={{ color: "var(--amber)" }}>{fmtCountdown(status.ends_in_seconds)}</span>
            {" "}to qualify.
          </div>
        </div>
      </div>
      <button className="btn primary sm" onClick={() => navigate("/coins/submit")}
        style={{ borderColor: "rgba(232,185,116,0.55)", background: "linear-gradient(180deg, rgba(232,185,116,0.28), rgba(232,185,116,0.12))" }}>
        ACT NOW
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Inline guide shown at the top of Command Center.
// Expanded on first visit (localStorage), collapses after "Got it".
// ─────────────────────────────────────────────────────────────
const GUIDE_SEEN_KEY = "ascent_guide_seen_v1";

function CommandGuide({ isMobile }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => {
    try { return !localStorage.getItem(GUIDE_SEEN_KEY); } catch { return true; }
  });

  const dismiss = () => {
    setOpen(false);
    try { localStorage.setItem(GUIDE_SEEN_KEY, "1"); } catch {}
  };

  return (
    <div style={{ marginBottom: 22 }}>
      {/* ── collapsed toggle bar ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            width: "100%", display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 12,
            padding: "11px 18px", borderRadius: 12,
            border: "1px solid rgba(127,119,221,0.25)",
            background: "rgba(127,119,221,0.06)",
            color: "var(--ink-mute)", cursor: "pointer",
            fontSize: 12.5, fontFamily: "var(--f-mono)",
            letterSpacing: "0.06em",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>📖</span>
            HOW TO EARN CENTS — TAP TO EXPAND
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* ── expanded guide ── */}
      {open && (
        <div style={{
          borderRadius: 16,
          border: "1px solid rgba(127,119,221,0.28)",
          background: "linear-gradient(135deg,rgba(127,119,221,0.08) 0%,rgba(64,212,196,0.04) 100%)",
          overflow: "hidden",
        }}>
          {/* header */}
          <div style={{
            display: "flex", alignItems: "flex-start",
            justifyContent: "space-between", gap: 12,
            padding: isMobile ? "20px 20px 0" : "24px 28px 0",
            flexWrap: "wrap",
          }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>§ BEFORE YOU START</div>
              <h2 style={{
                margin: 0, fontFamily: "var(--f-display)",
                fontSize: isMobile ? 20 : 24, color: "var(--ink)",
              }}>
                How to earn{" "}
                <span style={{ color: "var(--violet)" }}>Ascent Cents</span>
              </h2>
            </div>
            <button
              onClick={dismiss}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--glass-border)",
                borderRadius: 8, padding: "6px 14px",
                color: "var(--ink-mute)", cursor: "pointer",
                fontSize: 12, fontFamily: "var(--f-mono)",
                letterSpacing: "0.06em", flexShrink: 0,
              }}
            >GOT IT ✕</button>
          </div>

          <div style={{ padding: isMobile ? "18px 20px 24px" : "20px 28px 28px" }}>

            {/* 4-step flow */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
              gap: 10, marginBottom: 22,
            }}>
              {[
                { n: "01", head: "Participate",  body: "Post on LinkedIn/Instagram, use AR filter, visit booths.", color: "#7f77dd" },
                { n: "02", head: "Submit proof", body: "Paste a URL or upload a screenshot in Verification.",      color: "#40d4c4" },
                { n: "03", head: "Get verified", body: "Admins review it. Approved or Rejected with a reason.",    color: "#f5b04c" },
                { n: "04", head: "Cents added",  body: "Cents land automatically once approved.",                  color: "#1d9e75" },
              ].map(({ n, head, body, color }) => (
                <div key={n} style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${color}33`,
                  borderTop: `3px solid ${color}`,
                  borderRadius: 12, padding: "14px 14px",
                }}>
                  <div style={{
                    fontFamily: "var(--f-mono)", fontSize: 22,
                    fontWeight: 700, color, opacity: 0.65, lineHeight: 1,
                    marginBottom: 6,
                  }}>{n}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{head}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.55 }}>{body}</div>
                </div>
              ))}
            </div>

            {/* activity + tier row */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 14,
            }}>
              {/* activities */}
              <div>
                <div className="eyebrow" style={{ marginBottom: 10 }}>§ WHAT YOU CAN SUBMIT</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {EARN_ACTIVITIES.map(({ icon, activity, coins, confirmed }) => (
                    <div key={activity} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", borderRadius: 10,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--glass-border)",
                      opacity: confirmed ? 1 : 0.65,
                    }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                      <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{activity}</span>
                      {confirmed
                        ? <span style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--teal)", fontWeight: 700 }}>{coins}¢</span>
                        : <span style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.06em" }}>TBD</span>
                      }
                    </div>
                  ))}
                </div>
              </div>

              {/* tiers + redemption note */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>§ REWARD TIERS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {REWARD_TIERS.map(({ level, reward, emoji, color }) => (
                      <div key={level} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 12px", borderRadius: 10,
                        background: `${color}0e`,
                        border: `1px solid ${color}33`,
                      }}>
                        <span style={{ fontSize: 16 }}>{emoji}</span>
                        <span style={{
                          fontFamily: "var(--f-mono)", fontSize: 10,
                          color, letterSpacing: "0.1em", minWidth: 44,
                        }}>LVL {level}</span>
                        <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>{reward}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{
                  padding: "12px 14px", borderRadius: 10,
                  background: "rgba(245,176,76,0.07)",
                  border: "1px solid rgba(245,176,76,0.22)",
                  fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.6,
                }}>
                  <strong style={{ color: "#f5b04c" }}>To redeem —</strong>{" "}
                  go to Rewards, generate a code, then visit the merch booth
                  before it expires. Code is valid for 30 min.
                </div>
              </div>
            </div>

            {/* bottom CTA */}
            <div style={{
              marginTop: 20,
              display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
              borderTop: "1px solid var(--glass-border)", paddingTop: 18,
            }}>
              <button className="btn primary sm" onClick={() => navigate("/coins/submit")}>
                Submit proof now →
              </button>
              <button className="btn sm" onClick={() => navigate("/coins/guide")}>
                Full guide
              </button>
              <button
                onClick={dismiss}
                style={{
                  marginLeft: "auto", background: "transparent", border: 0,
                  color: "var(--ink-mute)", cursor: "pointer",
                  fontSize: 12, fontFamily: "var(--f-mono)", letterSpacing: "0.06em",
                }}
              >dismiss</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// CoinsHomePage  →  /coins   (Command Center)
// ─────────────────────────────────────────────────────────────
export function CoinsHomePage() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phStatus, setPhStatus] = useState({ active: false, ends_in_seconds: 0 });
  const [disputeOpen, setDisputeOpen] = useState(null);
  const [disputeText, setDisputeText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, h, ph] = await Promise.allSettled([
        coinsApi.balance(), coinsApi.history(), coinsApi.powerHourStatus(),
      ]);
      if (b.status === "fulfilled") setBalance(b.value);
      if (h.status === "fulfilled") setHistory(h.value || []);
      if (ph.status === "fulfilled") setPhStatus(ph.value);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  // Live refresh every 15s — balance, history, and power-hour status — so
  // an admin approval shows up on the student's dashboard without reload.
  // Also re-fetch on focus when the tab regains attention.
  useEffect(() => {
    const tick = () => {
      coinsApi.balance().then(setBalance).catch(() => {});
      coinsApi.history().then((d) => setHistory(d || [])).catch(() => {});
      coinsApi.powerHourStatus().then(setPhStatus).catch(() => {});
    };
    const id = setInterval(tick, 15000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const submitDispute = async () => {
    if (!disputeOpen || !disputeText.trim()) return;
    try {
      await coinsApi.dispute(disputeOpen, disputeText.trim());
      setDisputeOpen(null); setDisputeText("");
      alert("Dispute raised — admin will review shortly.");
    } catch (e) { alert(`Failed: ${e.message}`); }
  };

  const tier = balance?.tier_status;
  const nextSnapshotTier = tier?.next_tier;
  // Approximate progress to the next snapshot tier (visualised as a bar)
  const progressPct = useMemo(() => {
    if (!balance || !nextSnapshotTier) return 100;
    const prev = Object.entries(TIER_THRESHOLDS)
      .filter(([, t]) => t < TIER_THRESHOLDS[nextSnapshotTier])
      .reduce((acc, [, t]) => Math.max(acc, t), 0);
    const span = TIER_THRESHOLDS[nextSnapshotTier] - prev;
    return Math.max(2, Math.min(100, Math.round(((balance.balance - prev) / span) * 100)));
  }, [balance, nextSnapshotTier]);

  return (
    <SidequestLayout active="command">
      <CommandGuide isMobile={isMobile} />
      <PowerHourBanner status={phStatus} />

      {loading ? <Spinner /> : (
        <>
          {/* HERO ROW: Live balance + operations panel */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr",
            gap: 18,
          }}>
            {/* LIVE BALANCE */}
            <div className="glass-strong fade-up" style={{ padding: isMobile ? 22 : 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div>
                  <div className="eyebrow">§ LIVE BALANCE</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 14 }}>
                    <FlipCoin size={isMobile ? 72 : 96} hero />
                    <div>
                      <span className="display" style={{ fontSize: isMobile ? 56 : 76, color: "var(--ink)", lineHeight: 1, display: "block" }}>
                        {(balance?.balance ?? 0).toLocaleString()}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", letterSpacing: "0.22em", marginTop: 4, display: "block" }}>
                        ASCENT CENTS
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn primary sm" onClick={() => navigate("/coins/submit")}>SUBMIT UGC</button>
                  <button className="btn sm" onClick={() => navigate("/coins/rewards")}>REWARDS</button>
                </div>
              </div>
            </div>

            {/* OPERATIONS */}
            <div className="glass" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="eyebrow">§ OPERATIONS</div>
              <OpRow label="Submit UGC"   onClick={() => navigate("/coins/submit")} />
              <OpRow label="Leaderboard"  onClick={() => navigate("/coins/leaderboard")} />
              <OpRow label="Rewards Vault" onClick={() => navigate("/coins/rewards")} />
              <OpRow label="Coin History"  onClick={() => navigate("/coins/history")} />
            </div>
          </div>

          {/* CURRENT STATUS */}
          <div className="glass" style={{
            marginTop: 18, padding: isMobile ? 22 : 26,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="eyebrow">§ CURRENT STATUS</div>
                <div className="display" style={{ fontSize: isMobile ? 32 : 40, marginTop: 8 }}>
                  Rank {balance?.rank ?? "—"}
                </div>
                <div style={{ marginTop: 8, color: "var(--ink-dim)", fontSize: 13.5 }}>
                  {nextSnapshotTier
                    ? <>In line for <span style={{ color: "var(--violet)" }}>{TIER_LABEL[nextSnapshotTier]}</span> at next snapshot.</>
                    : <>You've crossed every tier threshold.</>}
                </div>
              </div>
              {balance?.rank != null && balance.rank <= 50 && (
                <span className="chip teal">↑ TOP {Math.max(5, Math.ceil((balance.rank / (balance.total_students || 100)) * 100))}%</span>
              )}
            </div>

            {nextSnapshotTier && (
              <>
                <div style={{
                  marginTop: 18, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "hidden",
                }}>
                  <div style={{
                    width: `${progressPct}%`, height: "100%",
                    background: "linear-gradient(90deg, var(--teal), var(--violet))",
                    boxShadow: "0 0 18px var(--violet-glow)",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }} className="mono">
                  <span style={{ fontSize: 11, color: "var(--ink-mute)", letterSpacing: "0.1em" }}>
                    CURRENT: {(balance?.balance ?? 0).toLocaleString()}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-mute)", letterSpacing: "0.1em" }}>
                    CUTOFF: {TIER_THRESHOLDS[nextSnapshotTier].toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* RECENT ACTIVITY */}
          <div className="glass" style={{ marginTop: 18, padding: isMobile ? 18 : 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="eyebrow">§ RECENT ACTIVITY</div>
              <a onClick={() => navigate("/coins/history")} style={{
                fontSize: 11, color: "var(--violet)", cursor: "pointer",
                fontFamily: "var(--f-mono)", letterSpacing: "0.1em",
              }}>VIEW ALL →</a>
            </div>

            {history.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", color: "var(--ink-mute)", fontSize: 13 }}>
                No coin activity yet. Earn your first coins by posting on LinkedIn.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
                {history.slice(0, 5).map((entry) => (
                  <ActivityRow key={entry.id} entry={entry} onDispute={() => setDisputeOpen(entry.id)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {disputeOpen && (
        <DisputeModal
          onCancel={() => setDisputeOpen(null)}
          text={disputeText} setText={setDisputeText} onSubmit={submitDispute}
        />
      )}
    </SidequestLayout>
  );
}

function OpRow({ label, onClick }) {
  return (
    <button onClick={onClick} className="mono" style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "12px 14px", borderRadius: "var(--r-md)",
      border: "1px solid var(--glass-border)",
      background: "rgba(255,255,255,0.025)", color: "var(--ink)",
      fontSize: 12, letterSpacing: "0.05em", cursor: "pointer", textAlign: "left",
    }}>
      <span>{label}</span>
      <span style={{ color: "var(--ink-mute)" }}>›</span>
    </button>
  );
}

function ActivityRow({ entry, onDispute }) {
  const isReversal = entry.source_type === "REVERSAL";
  const isNeg = entry.coins < 0;
  const color = isNeg ? "var(--amber)" : "var(--teal)";
  const inGracePeriod = isReversal && entry.grace_deadline &&
    new Date(entry.grace_deadline) > new Date();

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "13px 0", borderBottom: "1px solid var(--glass-border)", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: isNeg ? "rgba(232,185,116,0.12)" : "rgba(29,158,117,0.14)",
          color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          {isNeg ? "↩" : "✓"}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, color: "var(--ink)" }}>
              {SOURCE_LABEL[entry.source_type] || entry.source_type}
            </span>
            {entry.power_hour_applied && <span className="chip amber" style={{ fontSize: 9 }}>2× POWER HOUR</span>}
            {entry.status === "pending" && <span className="chip" style={{ fontSize: 9 }}>PENDING</span>}
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 3 }}>
            {relTime(entry.created_at)}
          </div>
          {inGracePeriod && (
            <div className="mono" style={{ fontSize: 10.5, color: "var(--amber)", marginTop: 4 }}>
              Repost by {fmtTime(entry.grace_deadline)} to restore.
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="mono" style={{ color, fontSize: 15, fontWeight: 600 }}>
          {entry.coins > 0 ? "+" : ""}{entry.coins || "--"}
        </span>
        <button onClick={onDispute} className="mono" style={{
          background: "transparent", border: "1px solid var(--glass-border)", color: "var(--ink-mute)",
          padding: "5px 9px", borderRadius: 999, cursor: "pointer", fontSize: 9, letterSpacing: "0.1em",
        }}>DISPUTE</button>
      </div>
    </div>
  );
}

function DisputeModal({ onCancel, text, setText, onSubmit }) {
  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, background: "rgba(5,5,10,0.7)", zIndex: 70,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      backdropFilter: "blur(6px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} className="glass-strong" style={{
        padding: 26, maxWidth: 460, width: "100%",
      }}>
        <div className="eyebrow">§ RAISE DISPUTE</div>
        <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 10 }}>
          Tell us what's wrong with this entry. An admin will review.
        </p>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Describe the issue…" rows={4}
          className="input" style={{ marginTop: 12, resize: "vertical" }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn sm" onClick={onCancel}>Cancel</button>
          <button className="btn primary sm" onClick={onSubmit}>Submit</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// UGCSubmitPage  →  /coins/submit   (Verification)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Submission state helpers — render LOCK / REJECTED / NEEDS-REVIEW
// pills on the source tiles and a contextual banner above the form.
// ─────────────────────────────────────────────────────────────
function tileStateFor(latest, eligible) {
  // No prior submission for this source.
  if (!latest) {
    return eligible
      ? { kind: "open",   label: "OPEN",   pillTone: "var(--teal)",
          borderColor: "var(--glass-border)", bg: "rgba(255,255,255,0.025)",
          textColor: "var(--ink)", opacity: 1 }
      : { kind: "capped", label: "CAPPED", pillTone: "var(--ink-mute)",
          borderColor: "var(--glass-border)", bg: "rgba(255,255,255,0.025)",
          textColor: "var(--ink-mute)", opacity: 0.6 };
  }
  switch (latest.status) {
    case "verified":
      return { kind: "verified", label: "VERIFIED", pillTone: "var(--teal)",
        borderColor: "rgba(64,212,196,0.35)", bg: "rgba(64,212,196,0.08)",
        textColor: "var(--ink)", opacity: 1,
        subtext: "Locked — coins credited.", subtextColor: "var(--teal)" };
    case "submitted":
    case "auto_checked":
    case "admin_queued":
    case "pending_manual":
      return { kind: "review", label: "IN REVIEW", pillTone: "var(--violet)",
        borderColor: "rgba(127,119,221,0.45)", bg: "rgba(127,119,221,0.08)",
        textColor: "var(--ink)", opacity: 1,
        subtext: "Awaiting admin verification.", subtextColor: "var(--violet)" };
    case "rejected":
      return { kind: "rejected", label: "REJECTED", pillTone: "var(--amber)",
        borderColor: "rgba(232,185,116,0.45)", bg: "rgba(232,185,116,0.06)",
        textColor: "var(--ink)", opacity: 1,
        subtext: latest.rejection_reason
          ? `Reason: ${latest.rejection_reason}`
          : "Tap to re-submit.",
        subtextColor: "var(--amber)" };
    case "needs_review":
      return { kind: "needs_review", label: "RE-VERIFY", pillTone: "var(--amber)",
        borderColor: "rgba(232,185,116,0.45)", bg: "rgba(232,185,116,0.06)",
        textColor: "var(--ink)", opacity: 1,
        subtext: "Post changed — re-submit to restore coins.",
        subtextColor: "var(--amber)" };
    default:
      return eligible
        ? { kind: "open", label: "OPEN", pillTone: "var(--teal)",
            borderColor: "var(--glass-border)", bg: "rgba(255,255,255,0.025)",
            textColor: "var(--ink)", opacity: 1 }
        : { kind: "capped", label: "CAPPED", pillTone: "var(--ink-mute)",
            borderColor: "var(--glass-border)", bg: "rgba(255,255,255,0.025)",
            textColor: "var(--ink-mute)", opacity: 0.6 };
  }
}

function TileStatusPill({ state }) {
  const isLocked = state.kind === "verified" || state.kind === "review";
  return (
    <span className="mono" style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 9, letterSpacing: "0.12em",
      padding: "2px 7px", borderRadius: 999,
      border: `1px solid ${state.pillTone}`,
      color: state.pillTone,
      background: "transparent",
    }}>
      {isLocked && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )}
      {state.label}
    </span>
  );
}

function SubmissionStateBanner({ source, latest, eligible }) {
  if (!latest) {
    if (!eligible) {
      return (
        <div style={{
          marginTop: 14, padding: "10px 12px", borderRadius: "var(--r-md)",
          background: "rgba(232,185,116,0.08)", border: "1px solid rgba(232,185,116,0.4)",
          color: "var(--amber)", fontSize: 12.5,
        }}>
          {source === "ROUND1_PROJECT"
            ? "Register for a build event first."
            : (source === "MVP_MUSEUM" || source === "JOBS_WALL")
            ? "MVP + Jobs Wall shared cap reached."
            : "Submission window is closed for this source."}
        </div>
      );
    }
    return null;
  }

  const wrap = (tone, body) => (
    <div style={{
      marginTop: 14, padding: "12px 14px", borderRadius: "var(--r-md)",
      background: tone.bg, border: `1px solid ${tone.border}`,
      color: tone.text, fontSize: 12.5,
    }}>
      {body}
    </div>
  );

  if (latest.status === "verified") {
    return wrap(
      { bg: "rgba(64,212,196,0.10)", border: "rgba(64,212,196,0.4)", text: "var(--teal)" },
      <>
        <strong style={{ color: "var(--ink)" }}>Verified.</strong>{" "}
        Coins are credited and locked. You can't re-submit this source unless
        admin re-verification flags it.
      </>
    );
  }
  if (["submitted", "auto_checked", "admin_queued", "pending_manual"].includes(latest.status)) {
    return wrap(
      { bg: "rgba(127,119,221,0.10)", border: "rgba(127,119,221,0.4)", text: "var(--violet)" },
      <>
        <strong style={{ color: "var(--ink)" }}>In review.</strong>{" "}
        Auto-check passed — awaiting admin verification. Submission is locked
        until they decide.
      </>
    );
  }
  if (latest.status === "rejected") {
    return wrap(
      { bg: "rgba(232,185,116,0.10)", border: "rgba(232,185,116,0.4)", text: "var(--amber)" },
      <>
        <strong style={{ color: "var(--ink)" }}>Rejected by admin.</strong>{" "}
        {latest.rejection_reason ? `Reason: ${latest.rejection_reason}.` : ""}{" "}
        Fix the issue and submit a new URL below.
      </>
    );
  }
  if (latest.status === "needs_review") {
    return wrap(
      { bg: "rgba(232,185,116,0.10)", border: "rgba(232,185,116,0.4)", text: "var(--amber)" },
      <>
        <strong style={{ color: "var(--ink)" }}>Re-verification required.</strong>{" "}
        Your previously verified post failed the 24h re-check. Re-submit
        within the grace window to restore your coins.
      </>
    );
  }
  return null;
}

export function UGCSubmitPage() {
  const isMobile = useMobile();
  const [eligibility, setEligibility] = useState(null);
  const [phStatus, setPhStatus] = useState({ active: false });
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("RSVP_POST");
  const [url, setUrl] = useState("");
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [partner, setPartner] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const reload = useCallback(async () => {
    const [e, ph, pendingCC, h] = await Promise.allSettled([
      ugcApi.eligibility(), coinsApi.powerHourStatus(),
      ugcApi.pendingConfirmations(), coinsApi.history(),
    ]);
    if (e.status === "fulfilled") setEligibility(e.value);
    if (ph.status === "fulfilled") setPhStatus(ph.value);
    if (pendingCC.status === "fulfilled") setPending(pendingCC.value || []);
    if (h.status === "fulfilled") setHistory(h.value || []);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const isCollab = selected === "CREATOR_COLLAB";
  const isScreenshot = SCREENSHOT_SOURCES.has(selected);
  const eligibilityKey = {
    RSVP_POST: "rsvp", ROUND1_PROJECT: "round1_project",
    FUTURE_VISION: "future_vision", MVP_MUSEUM: "mvp_museum",
    JOBS_WALL: "jobs_wall", CREATOR_COLLAB: "creator_collab",
    AR_FILTER: "ar_filter",
    MEME_CHALLENGE: "meme_challenge",
    SIGNATURE_PHOTO_BOOTH: "signature_photo_booth",
  }[selected];
  const isEligible = eligibility?.[eligibilityKey];
  const latestForSelected = eligibility?.latest_submissions?.[selected];
  // A source is "locked" while a submission is in review or already verified.
  // Rejected and needs_review (re-verification needed) are treated as open
  // so the user can re-submit a fresh URL.
  const lockedStatuses = new Set(["submitted", "auto_checked", "admin_queued", "pending_manual", "verified"]);
  const isLocked = !!latestForSelected && lockedStatuses.has(latestForSelected.status);
  const canSubmit = isEligible && !isLocked;

  const submit = async () => {
    if (isScreenshot) {
      if (!screenshotFile) {
        setResult({ ok: false, message: "Please select a screenshot image to upload." }); return;
      }
    } else {
      if (!url.trim()) {
        setResult({ ok: false, message: "Paste a public post URL." }); return;
      }
      if (!/^https?:\/\/.+\..+/i.test(url.trim())) {
        setResult({ ok: false, message: "That doesn't look like a URL — paste a valid link starting with https://" }); return;
      }
    }
    if (isCollab && !partner.trim()) {
      setResult({ ok: false, message: "Partner user ID required for Creator Collab." }); return;
    }
    setSubmitting(true);
    try {
      let submitUrl = url.trim();
      let proofType = "url";
      if (isScreenshot) {
        setResult({ ok: null, message: "Uploading screenshot…" });
        const uploaded = await ugcApi.uploadProof(screenshotFile);
        submitUrl = uploaded.url;
        proofType = "screenshot";
      }
      const res = await ugcApi.submit({
        source_type: selected, url: submitUrl, proof_type: proofType,
        participant_2_id: isCollab ? partner.trim() : undefined,
      });
      const reason = res.auto_check_result?.reason;
      if (res.status === "rejected") {
        const msg = reason === "invalid_url_format"
          ? "That doesn't look like a URL — paste a valid link starting with https://"
          : `Rejected: ${reason || "auto-check failed"}`;
        setResult({ ok: false, message: msg });
      } else {
        setResult({
          ok: true,
          isScreenshotResult: isScreenshot,
          message: isScreenshot
            ? "Awaiting Admin Verification."
            : res.status === "pending_manual"
            ? "Submitted — admin will review manually."
            : "Auto-check passed! Moving to Admin Queue",
          flags: res.auto_check_result?.flags || [],
        });
        setUrl(""); setPartner(""); setScreenshotFile(null);
      }
      reload();
    } catch (e) {
      setResult({ ok: false, message: `Failed: ${e.message}` });
    } finally { setSubmitting(false); }
  };

  const verifiedCount = history.filter(h => h.coins > 0 && SUBMIT_SOURCES.includes(h.source_type)).length;

  return (
    <SidequestLayout active="verification">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <span className="chip violet" style={{ fontSize: 9.5 }}>UGC INGESTION</span>
        <span className="chip" style={{ fontSize: 9.5 }}>NODE: OMEGA-7</span>
      </div>
      <h1 className="display" style={{ fontSize: isMobile ? 28 : 40, marginTop: 6 }}>
        Content <span style={{ color: "var(--violet)" }}>Verification</span>.
      </h1>
      <p style={{ fontSize: 13.5, color: "var(--ink-dim)", marginTop: 6, marginBottom: 22, maxWidth: 560 }}>
        Submit links for automated protocol validation.
      </p>

      <PowerHourBanner status={phStatus} />

      {pending.length > 0 && (
        <div className="glass" style={{ padding: 18, marginBottom: 22 }}>
          <div className="eyebrow">§ AWAITING YOUR CONFIRMATION</div>
          {pending.map((p) => <PendingCollabRow key={p.id} item={p} onResolve={reload} />)}
        </div>
      )}

      {loading || !eligibility ? <Spinner /> : (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr",
          gap: 18, alignItems: "start",
        }}>
          {/* LEFT — main form */}
          <div className="glass-strong" style={{ padding: isMobile ? 20 : 26 }}>
            <div className="eyebrow">§ SELECT SUBMISSION PROTOCOL</div>
            <div style={{
              marginTop: 14, display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr",
              gap: 10,
            }}>
              {SUBMIT_SOURCES.map((src) => {
                const key = {
                  RSVP_POST: "rsvp", ROUND1_PROJECT: "round1_project",
                  FUTURE_VISION: "future_vision", MVP_MUSEUM: "mvp_museum",
                  JOBS_WALL: "jobs_wall", CREATOR_COLLAB: "creator_collab",
                  AR_FILTER: "ar_filter",
                  MEME_CHALLENGE: "meme_challenge",
                  SIGNATURE_PHOTO_BOOTH: "signature_photo_booth",
                }[src];
                const eligibleHere = eligibility[key];
                const active = selected === src;
                const latest = eligibility.latest_submissions?.[src];
                const tileState = tileStateFor(latest, eligibleHere);
                return (
                  <button key={src} onClick={() => { setSelected(src); setResult(null); }}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: "var(--r-md)",
                      border: `1px solid ${
                        active ? "rgba(127,119,221,0.55)"
                        : tileState.borderColor
                      }`,
                      background: active ? "rgba(127,119,221,0.10)"
                        : tileState.bg,
                      color: tileState.textColor,
                      cursor: "pointer", opacity: tileState.opacity,
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12.5 }}>{SOURCE_LABEL[src]}</span>
                      <TileStatusPill state={tileState} />
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 4 }}>
                      +{COIN_VALUES[src] || 0} COINS
                    </div>
                    {tileState.subtext && (
                      <div style={{
                        fontSize: 10.5,
                        color: tileState.subtextColor || "var(--ink-mute)",
                        marginTop: 6,
                        lineHeight: 1.35,
                        wordBreak: "break-word",
                      }}>
                        {tileState.subtext}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Per-source state banner — supersedes the eligibility note */}
            <SubmissionStateBanner
              source={selected}
              latest={latestForSelected}
              eligible={isEligible}
            />

            {/* URL or screenshot upload depending on selected source */}
            {isScreenshot ? (
              <div style={{ marginTop: 22 }}>
                <label className="label">STORY SCREENSHOT</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="input"
                  disabled={!canSubmit}
                  onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
                  style={{ padding: "10px 12px", cursor: canSubmit ? "pointer" : "not-allowed" }}
                />
                <p style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 8 }}>
                  Upload your Instagram AR Filter story screenshot (JPEG/PNG/WebP, max 10 MB).
                  Account must be public and must include #ASCENT26.
                </p>
              </div>
            ) : (
              <div style={{ marginTop: 22 }}>
                <label className="label">SOURCE URL</label>
                <input
                  className="input" placeholder="https://linkedin.com/posts/…"
                  value={url} onChange={(e) => setUrl(e.target.value)}
                  disabled={!canSubmit}
                />
              </div>
            )}

            {isCollab && (
              <div style={{ marginTop: 14 }}>
                <label className="label">PARTNER USER ID</label>
                <input
                  className="input" placeholder="UUID of your collab partner"
                  value={partner} onChange={(e) => setPartner(e.target.value)}
                  disabled={!canSubmit}
                />
              </div>
            )}

            <p style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 14 }}>
              By submitting, you confirm this content meets the ASCENT'26 code of conduct.
            </p>

            <button className="btn primary sm"
              disabled={submitting || !canSubmit}
              onClick={submit}
              style={{ marginTop: 14, opacity: submitting || !canSubmit ? 0.6 : 1 }}>
              {submitting
                ? (isScreenshot ? "Uploading…" : "Checking…")
                : (latestForSelected?.status === "rejected" || latestForSelected?.status === "needs_review")
                ? (isScreenshot ? "RE-UPLOAD & SUBMIT" : "RE-SUBMIT & AUTO-CHECK")
                : (isScreenshot ? "UPLOAD & SUBMIT" : "SUBMIT & AUTO-CHECK")}
            </button>

            {result && (
              <div style={{
                marginTop: 14, padding: "12px 14px", borderRadius: "var(--r-md)",
                background: result.ok ? "rgba(29,158,117,0.10)" : "rgba(232,185,116,0.10)",
                border: `1px solid ${result.ok ? "rgba(29,158,117,0.4)" : "rgba(232,185,116,0.4)"}`,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: result.ok ? "var(--teal)" : "var(--amber)", color: "#0a0a14",
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>{result.ok ? "✓" : "!"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--ink)" }}>{result.message}</div>
                  {result.ok && !result.isScreenshotResult && result.flags && result.flags.length === 0 && (
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 4 }}>
                      # FOUND #ASCENT26 · ✓ PUBLIC VISIBILITY CONFIRMED
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — validation rules + batch stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="glass" style={{ padding: 22 }}>
              <div className="eyebrow">§ SUBMISSION GUIDELINES</div>
              {isScreenshot ? (
                <>
                  <ValidationRule
                    title="Instagram story screenshot"
                    body="Upload a screenshot of your AR Filter story post. Stories cannot be reverified after approval."
                  />
                  <ValidationRule
                    title="Account must be public"
                    body="Private or restricted accounts will be rejected."
                  />
                  <ValidationRule
                    title="Include #ASCENT26"
                    body="The hashtag must be visible in the story screenshot."
                  />
                </>
              ) : (
                <>
                  <ValidationRule
                    title="Hashtag #ASCENT26 required"
                    body="Must be included in the primary caption, not just comments."
                  />
                  <ValidationRule
                    title="Post must be public"
                    body="Private accounts or restricted posts will fail auto-validation."
                  />
                  <ValidationRule
                    title="Timestamps matter"
                    body="Posts must be published within the active event window."
                  />
                  <ValidationRule
                    title="No duplicates or reused content"
                    body="Duplicate URLs, deleted posts, or reused content will be rejected."
                  />
                </>
              )}
            </div>

            <div className="glass" style={{ padding: 22 }}>
              <div className="eyebrow">§ YOUR BATCH STATS</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 10 }}>
                <span className="display" style={{ fontSize: 44, color: "var(--teal)" }}>{verifiedCount}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", letterSpacing: "0.15em" }}>
                  VERIFIED DROPS
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </SidequestLayout>
  );
}

function ValidationRule({ title, body }) {
  return (
    <div style={{
      display: "flex", gap: 10, padding: "12px 0",
      borderBottom: "1px solid var(--glass-border)",
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        background: "rgba(29,158,117,0.18)", color: "var(--teal)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, flexShrink: 0, marginTop: 1,
      }}>✓</div>
      <div>
        <div style={{ fontSize: 13, color: "var(--ink)" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 3 }}>{body}</div>
      </div>
    </div>
  );
}

function PendingCollabRow({ item, onResolve }) {
  const [working, setWorking] = useState(false);
  const confirm = async () => {
    setWorking(true);
    try { await ugcApi.confirmCollab(item.id); onResolve?.(); }
    catch (e) { alert(`Failed: ${e.message}`); }
    finally { setWorking(false); }
  };
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 0", borderBottom: "1px solid var(--glass-border)", gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--ink)" }}>
          Collab invite from{" "}
          <span className="mono" style={{ color: "var(--violet)" }}>{item.participant_1.slice(0, 8)}…</span>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>
          Expires {fmtTime(item.deadline)}
        </div>
      </div>
      <button className="btn primary sm" disabled={working} onClick={confirm}>
        {working ? "…" : "Confirm"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LeaderboardPage  →  /coins/leaderboard
// ─────────────────────────────────────────────────────────────
export function LeaderboardPage() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    try {
      const [d, b] = await Promise.allSettled([coinsApi.leaderboard(), coinsApi.balance()]);
      if (d.status === "fulfilled") setData(d.value);
      if (b.status === "fulfilled") setBalance(b.value);
      setUpdatedAt(new Date().toISOString());
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <SidequestLayout active="leaderboard">
      <div className="eyebrow">§ GLOBAL STANDING</div>
      <h1 className="display" style={{ fontSize: isMobile ? 28 : 40, marginTop: 6, marginBottom: 18 }}>
        Leaderboard.
      </h1>

      {loading ? <Spinner /> : (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr",
          gap: 18, alignItems: "start",
        }}>
          {/* LEFT — Top 100 table */}
          <div className="glass" style={{ padding: isMobile ? 16 : 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="eyebrow">§ TOP 100 OPERATIVES</div>
              {updatedAt && (
                <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>
                  ⟳ {relTime(updatedAt)}
                </span>
              )}
            </div>

            <div style={{
              marginTop: 14,
              display: "grid", gridTemplateColumns: "60px 1fr 100px",
              padding: "8px 6px",
              borderBottom: "1px solid var(--glass-border)",
            }} className="mono">
              <span style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.18em" }}>RANK</span>
              <span style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.18em" }}>OPERATIVE</span>
              <span style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.18em", textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                <FlipCoin size={13} />
                CENTS
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {(data?.top || []).map((row, idx) => (
                <LeaderboardRow key={row.student_id} rank={idx + 1} row={row}
                  isMe={row.student_id === data?.me?.student_id} />
              ))}
              {data?.me && (data?.top || []).every(r => r.student_id !== data.me.student_id) && (
                <>
                  <div style={{ height: 1, background: "var(--glass-border)", margin: "10px 0" }} />
                  <LeaderboardRow rank={data.me.rank} row={data.me} isMe />
                </>
              )}
            </div>
          </div>

          {/* RIGHT — current rank, event horizons, acquisition status */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* CURRENT RANK */}
            <div className="glass-strong" style={{ padding: 22 }}>
              <div className="eyebrow">§ CURRENT RANK</div>
              {balance?.rank == null ? (
                <>
                  <div style={{
                    fontSize: 16, color: "var(--ink)", marginTop: 12, lineHeight: 1.4,
                  }}>
                    Earn some coins
                  </div>
                  <div className="mono" style={{
                    fontSize: 10.5, color: "var(--ink-mute)", marginTop: 6,
                  }}>
                    Submit a post or visit a booth to land on the leaderboard.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 10 }}>
                    <span className="display" style={{ fontSize: 56, color: "var(--ink)" }}>
                      {balance.rank}
                    </span>
                    {balance.rank <= 50 && (
                      <span className="mono" style={{ fontSize: 12, color: "var(--teal)" }}>↑ TOP 50</span>
                    )}
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 4 }}>
                    of {balance.total_students ?? "—"} operatives
                  </div>
                </>
              )}
            </div>

            {/* EVENT HORIZONS */}
            <div className="glass" style={{ padding: 22 }}>
              <div className="eyebrow">§ EVENT HORIZONS</div>
              <HorizonItem
                state="passed" tier="MUG"
                title="Day 1 Midnight"
                subtitle="Mug snapshot"
              />
              <HorizonItem
                state="incoming" tier="TSHIRT"
                title="Day 2 T-3h"
                subtitle="Snapshot at Rank 50 cutoff"
              />
              <HorizonItem
                state="pending" tier="PREMIUM_KIT"
                title="Final Close"
                subtitle="Premium Kit allocation"
              />
            </div>

            {/* ACQUISITION STATUS */}
            <div className="glass" style={{ padding: 22 }}>
              <div className="eyebrow">§ ACQUISITION STATUS</div>
              <AcquisitionRow
                tier="STICKER" labelLevel="L1" sub="Base tier clearance"
                balance={balance?.balance ?? 0} rank={balance?.rank}
              />
              <AcquisitionRow
                tier="MUG" labelLevel="L2" sub="Awarded Digital Badge"
                balance={balance?.balance ?? 0} rank={balance?.rank}
              />
              <AcquisitionRow
                tier="TSHIRT" labelLevel="L3" sub="Current Goal"
                balance={balance?.balance ?? 0} rank={balance?.rank}
                showSafety
              />
              <AcquisitionRow
                tier="PREMIUM_KIT" labelLevel="L4" sub="Final close target"
                balance={balance?.balance ?? 0} rank={balance?.rank}
              />

              <div style={{ marginTop: 14 }}>
                <button className="btn sm" onClick={() => navigate("/coins/rewards")}
                  style={{ width: "100%" }}>
                  DIGITAL SAFETY NET
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SidequestLayout>
  );
}

function HorizonItem({ state, tier, title, subtitle }) {
  const config = {
    passed:   { color: "var(--ink-mute)", label: "PASSED",          dot: "var(--ink-mute)" },
    incoming: { color: "var(--violet)",   label: "INCOMING WINDOW", dot: "var(--violet)" },
    pending:  { color: "var(--ink-mute)", label: "PENDING",         dot: "var(--ink-faint)" },
  }[state];
  return (
    <div style={{
      display: "flex", gap: 12, padding: "12px 0",
      borderBottom: "1px solid var(--glass-border)",
      opacity: state === "passed" ? 0.55 : 1,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: config.dot, marginTop: 6, flexShrink: 0,
        boxShadow: state === "incoming" ? "0 0 12px var(--violet-glow)" : "none",
      }} />
      <div style={{ flex: 1 }}>
        <div className="mono" style={{
          fontSize: 9.5, color: config.color, letterSpacing: "0.18em",
        }}>{config.label}</div>
        <div style={{ marginTop: 4, fontSize: 13.5, color: "var(--ink)" }}>{title}{" "}
          <span style={{ color: "var(--ink-mute)" }}>({TIER_LABEL[tier]})</span>
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 3 }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function AcquisitionRow({ tier, labelLevel, sub, balance, rank, showSafety }) {
  const threshold = TIER_THRESHOLDS[tier];
  const cutoff = TIER_RANK_CUTOFFS[tier];
  const meetsCoins = balance >= threshold;
  const meetsRank = cutoff == null ? meetsCoins : (rank != null && rank <= cutoff);

  let badge, badgeBg, badgeColor;
  if (tier === "STICKER" && meetsCoins) {
    badge = "CLAIMED"; badgeBg = "rgba(29,158,117,0.16)"; badgeColor = "var(--teal)";
  } else if (!meetsCoins) {
    badge = "LOCKED"; badgeBg = "rgba(255,255,255,0.04)"; badgeColor = "var(--ink-mute)";
  } else if (meetsCoins && !meetsRank) {
    badge = "MISSED"; badgeBg = "rgba(232,185,116,0.14)"; badgeColor = "var(--amber)";
  } else {
    badge = "ELIGIBLE"; badgeBg = "rgba(127,119,221,0.14)"; badgeColor = "#C6C2F5";
  }

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0",
      borderBottom: "1px solid var(--glass-border)",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: "var(--r-sm)",
        background: "rgba(255,255,255,0.04)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, color: "var(--ink-dim)", flexShrink: 0,
      }}>
        {tier === "STICKER" ? "✦" : tier === "MUG" ? "☕" : tier === "TSHIRT" ? "👕" : "🎁"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: "var(--ink)" }}>{TIER_LABEL[tier]}</span>
          <span className="mono" style={{ fontSize: 9.5, color: "var(--ink-mute)" }}>({labelLevel})</span>
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 3 }}>{sub}</div>
        {showSafety && cutoff && rank != null && (
          <div style={{ marginTop: 8 }}>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-mute)", letterSpacing: "0.1em" }}>
              RANK SAFETY MARGIN
            </div>
            <div className="mono" style={{ fontSize: 11, color: rank <= cutoff ? "var(--violet)" : "var(--amber)", marginTop: 2 }}>
              {rank} / {cutoff}
              {rank > cutoff - 5 && rank <= cutoff && (
                <span style={{ marginLeft: 8, color: "var(--amber)" }}>⚠ Danger close to cutoff</span>
              )}
            </div>
          </div>
        )}
      </div>
      <span className="mono" style={{
        padding: "4px 9px", borderRadius: 999, fontSize: 9, letterSpacing: "0.12em",
        background: badgeBg, color: badgeColor, flexShrink: 0,
      }}>{badge}</span>
    </div>
  );
}

function LeaderboardRow({ rank, row, isMe }) {
  const display = row.name || row.username || (row.student_id ? `${row.student_id.slice(0, 8)}…` : "—");
  const initials = (row.name || row.username || row.student_id || "??")
    .split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "??";

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "60px 1fr 100px",
      alignItems: "center", padding: "12px 6px",
      borderBottom: "1px solid var(--glass-border)",
      background: isMe ? "rgba(127,119,221,0.10)" : "transparent",
      borderRadius: isMe ? "var(--r-md)" : 0,
    }}>
      <div className="mono" style={{
        fontSize: 13,
        color: (rank != null && rank <= 3) ? "var(--violet)" : "var(--ink-mute)",
      }}>
        {rank == null ? "NA" : (rank <= 3 ? `0${rank}` : rank)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: rank <= 3
            ? "linear-gradient(135deg, var(--violet), var(--teal))"
            : "rgba(255,255,255,0.08)",
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontFamily: "var(--f-mono)", flexShrink: 0, fontWeight: 600,
        }}>
          {initials}
        </div>
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 13, color: "var(--ink)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {display}
            </span>
            {isMe && <span className="chip violet" style={{ fontSize: 9 }}>YOU</span>}
          </div>
          {row.username && row.name && (
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 2 }}>
              @{row.username}
            </div>
          )}
        </div>
      </div>
      <div className="mono" style={{ fontSize: 14, color: "var(--ink)", textAlign: "right", fontWeight: 600 }}>
        {(row.coins ?? 0).toLocaleString()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Reward journey — road of checkpoints from 0 to top tier.
// ─────────────────────────────────────────────────────────────
const TIER_ICONS = {
  STICKER: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" />
      <path d="M21 11l-10 10v-6a4 4 0 0 1 4-4h6z" />
    </svg>
  ),
  BADGE: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/>
    </svg>
  ),
  NOTEPAD: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  MUG: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h13v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8z" />
      <path d="M16 11h2a3 3 0 0 1 0 6h-2" />
      <path d="M7 4v2M11 4v2" />
    </svg>
  ),
  TOTE_BAG_MUG: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="13" rx="1" />
      <path d="M3 12h18M12 8v13" />
      <path d="M12 8c-1.5-3-5-3-5-1s3 1 5 1zM12 8c1.5-3 5-3 5-1s-3 1-5 1z" />
    </svg>
  ),
};

function RewardJourney({ balance }) {
  const isMobile = useMobile();
  const tiers = [
    { key: "STICKER",      label: "Sticker",       threshold: TIER_THRESHOLDS.STICKER },
    { key: "BADGE",        label: "Badge",         threshold: TIER_THRESHOLDS.BADGE },
    { key: "NOTEPAD",      label: "Notepad",       threshold: TIER_THRESHOLDS.NOTEPAD },
    { key: "MUG",          label: "Mug",           threshold: TIER_THRESHOLDS.MUG },
    { key: "TOTE_BAG_MUG", label: "Tote Bag + Mug",threshold: TIER_THRESHOLDS.TOTE_BAG_MUG },
  ];
  const max = tiers[tiers.length - 1].threshold;
  const pct = Math.max(0, Math.min(100, (balance / max) * 100));
  const nextTier = tiers.find((t) => balance < t.threshold);
  const remaining = nextTier ? nextTier.threshold - balance : 0;

  const headline = nextTier ? (
    <>
      Next stop ·{" "}
      <span style={{ color: "var(--ink)" }}>{nextTier.label}</span>
      <span className="mono" style={{ color: "var(--ink-mute)", marginLeft: 8 }}>
        {remaining.toLocaleString()} coins to go
      </span>
    </>
  ) : (
    <span style={{ color: "var(--teal)" }}>All checkpoints cleared — legendary.</span>
  );

  // ── Mobile: vertical list with even spacing ─────────────────────────
  if (isMobile) {
    const ROW_H = 72;   // fixed height per checkpoint row (px)
    const totalH = tiers.length * ROW_H;
    const TRACK_X = 20; // horizontal center of the vertical track
    const filledH = Math.round((pct / 100) * totalH);

    return (
      <div className="glass" style={{ padding: 18, marginTop: 22 }}>
        <div className="eyebrow">§ JOURNEY MAP</div>
        <div style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 8 }}>{headline}</div>

        <div style={{ position: "relative", marginTop: 20, height: totalH }}>
          {/* Track base */}
          <div style={{
            position: "absolute", left: TRACK_X - 2, top: 0, bottom: 0, width: 4,
            borderRadius: 999, background: "rgba(255,255,255,0.06)",
          }} />
          {/* Track fill */}
          <div style={{
            position: "absolute", left: TRACK_X - 2, top: 0, width: 4,
            height: filledH, maxHeight: totalH,
            background: "linear-gradient(180deg, var(--teal), var(--violet))",
            boxShadow: "0 0 10px var(--violet-glow)",
            borderRadius: 999, transition: "height 700ms ease",
          }} />

          {tiers.map((t, i) => {
            const reached = balance >= t.threshold;
            const isNext  = nextTier?.key === t.key;
            const dotColor = reached ? "var(--teal)" : isNext ? "var(--amber)" : "var(--ink-mute)";
            // Centre each row evenly
            const top = i * ROW_H + ROW_H / 2 - 8;
            return (
              <div key={t.key} style={{
                position: "absolute", top, left: 0, right: 0,
                display: "flex", alignItems: "center", gap: 14,
              }}>
                {/* Dot */}
                <div style={{
                  flexShrink: 0,
                  width: 16, height: 16, borderRadius: "50%",
                  background: reached ? "var(--violet)" : "rgba(20,20,28,0.9)",
                  border: `2px solid ${dotColor}`,
                  boxShadow: reached ? "0 0 10px var(--violet-glow)" : isNext ? "0 0 8px rgba(245,176,76,0.4)" : "none",
                  marginLeft: TRACK_X - 8,
                }} />
                {/* Label */}
                <div>
                  <div className="mono" style={{
                    fontSize: 9.5, letterSpacing: "0.16em", color: dotColor,
                  }}>
                    {reached ? "UNLOCKED" : isNext ? "NEXT UP" : "LOCKED"}
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--ink)", marginTop: 1 }}>{t.label}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 1 }}>
                    {t.threshold.toLocaleString()} coins
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Desktop: horizontal road ─────────────────────────────────────────
  //
  // Three-zone layout:
  //   Zone A (0 → TRACK_Y-8):    icon discs
  //   Zone B (TRACK_Y±3):        track + dots
  //   Zone C (TRACK_Y+16 → end): status / name / threshold labels
  //   Zone D (below labels):     YOU chip (never overlaps)
  //
  const TRACK_Y   = 58;   // px from container top — track centre
  const ICON_SZ   = 38;   // icon disc diameter
  const DOT_SZ    = 14;   // checkpoint dot diameter
  const ICON_TOP  = TRACK_Y - 10 - ICON_SZ;      // = 10
  const DOT_TOP   = TRACK_Y - DOT_SZ / 2;        // = 51
  const STATUS_Y  = TRACK_Y + DOT_SZ / 2 + 7;   // = 72
  const NAME_Y    = STATUS_Y + 13;               // = 85
  const THRESH_Y  = NAME_Y + 17;                 // = 102
  const YOU_Y     = THRESH_Y + 18;               // = 120  ← below all labels
  const CONT_H    = YOU_Y + 22;                  // = 142

  // Track spans 5%…95%
  const toX = (v) => 5 + (Math.min(v, max) / max) * 90;
  const youX = toX(balance);

  return (
    <div className="glass" style={{ padding: 24, marginTop: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="eyebrow">§ JOURNEY MAP</div>
          <div style={{ fontSize: 14, color: "var(--ink-dim)", marginTop: 8 }}>{headline}</div>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", letterSpacing: "0.18em" }}>
          {balance.toLocaleString()} / {max.toLocaleString()} COINS
        </div>
      </div>

      <div style={{ position: "relative", height: CONT_H, marginTop: 24 }}>
        {/* Track base */}
        <div style={{
          position: "absolute", left: "5%", right: "5%",
          top: TRACK_Y - 3, height: 6, borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          backgroundImage: "repeating-linear-gradient(90deg,rgba(255,255,255,0.09) 0 8px,transparent 8px 18px)",
        }} />
        {/* Filled track */}
        <div style={{
          position: "absolute", left: "5%", top: TRACK_Y - 3, height: 6,
          width: `${youX - 5}%`,
          background: "linear-gradient(90deg, var(--teal), var(--violet))",
          boxShadow: "0 0 12px var(--violet-glow)",
          borderRadius: 999, transition: "width 700ms ease",
        }} />

        {/* Checkpoints */}
        {tiers.map((t) => {
          const reached = balance >= t.threshold;
          const isNext  = nextTier?.key === t.key;
          const x = toX(t.threshold);
          const accentColor = reached ? "var(--teal)" : isNext ? "var(--amber)" : "var(--ink-mute)";

          return (
            <div key={t.key} style={{
              position: "absolute", left: `${x}%`, top: 0, height: CONT_H,
              transform: "translateX(-50%)", width: 96, pointerEvents: "none",
            }}>
              {/* Icon disc */}
              <div style={{
                position: "absolute", top: ICON_TOP,
                left: "50%", transform: "translateX(-50%)",
                width: ICON_SZ, height: ICON_SZ, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: reached
                  ? "linear-gradient(140deg,rgba(127,119,221,0.22),rgba(64,212,196,0.16))"
                  : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${reached ? "var(--violet)" : isNext ? "var(--amber)" : "rgba(255,255,255,0.10)"}`,
                color: reached ? "var(--ink)" : isNext ? "var(--amber)" : "var(--ink-mute)",
                boxShadow: reached ? "0 0 12px var(--violet-glow)" : "none",
              }}>
                {TIER_ICONS[t.key]}
              </div>

              {/* Checkpoint dot on track */}
              <div style={{
                position: "absolute", top: DOT_TOP,
                left: "50%", transform: "translateX(-50%)",
                width: DOT_SZ, height: DOT_SZ, borderRadius: "50%",
                background: reached ? "var(--violet)" : "rgba(16,16,24,0.95)",
                border: `2px solid ${reached ? "var(--violet)" : isNext ? "var(--amber)" : "rgba(255,255,255,0.18)"}`,
                boxShadow: reached ? "0 0 10px var(--violet-glow)" : isNext ? "0 0 8px rgba(245,176,76,0.4)" : "none",
                zIndex: 1,
              }} />

              {/* Status */}
              <div className="mono" style={{
                position: "absolute", top: STATUS_Y,
                left: "50%", transform: "translateX(-50%)",
                fontSize: 8.5, letterSpacing: "0.18em",
                color: accentColor, whiteSpace: "nowrap",
              }}>
                {reached ? "UNLOCKED" : isNext ? "NEXT UP" : "LOCKED"}
              </div>

              {/* Name */}
              <div style={{
                position: "absolute", top: NAME_Y,
                left: "50%", transform: "translateX(-50%)",
                fontSize: 12, color: "var(--ink)", whiteSpace: "nowrap",
              }}>
                {t.label}
              </div>

              {/* Threshold */}
              <div className="mono" style={{
                position: "absolute", top: THRESH_Y,
                left: "50%", transform: "translateX(-50%)",
                fontSize: 9.5, color: "var(--ink-mute)", whiteSpace: "nowrap",
              }}>
                {t.threshold.toLocaleString()}
              </div>
            </div>
          );
        })}

        {/* YOU chip — sits below all labels, rides along the x axis */}
        {balance > 0 && (
          <div style={{
            position: "absolute", top: YOU_Y, left: `${youX}%`,
            transform: "translateX(-50%)",
            transition: "left 700ms ease", pointerEvents: "none", zIndex: 2,
          }}>
            <div className="mono" style={{
              fontSize: 9, letterSpacing: "0.2em", whiteSpace: "nowrap",
              padding: "3px 8px", borderRadius: 999,
              background: "rgba(127,119,221,0.18)", border: "1px solid var(--violet-dim)",
              color: "var(--ink)",
            }}>
              ▲ YOU · {balance.toLocaleString()}
            </div>
          </div>
        )}

        {/* Pulsing dot at fill tip */}
        {balance > 0 && (
          <div style={{
            position: "absolute", top: TRACK_Y - 6,
            left: `calc(5% + ${youX - 5}% - 6px)`,
            width: 12, height: 12, borderRadius: "50%",
            background: "var(--ink)", border: "2.5px solid var(--violet)",
            boxShadow: "0 0 10px var(--violet-glow)",
            animation: "pulseDot 1.6s ease-in-out infinite",
            transition: "left 700ms ease",
            zIndex: 2, pointerEvents: "none",
          }} />
        )}
      </div>

      <style>{`
        @keyframes pulseDot {
          0%,100%{box-shadow:0 0 8px var(--violet-glow);}
          50%    {box-shadow:0 0 18px var(--violet-glow);}
        }
      `}</style>
    </div>
  );
}

function CheckpointDot({ reached, isNext }) {
  return (
    <div style={{
      width: 16, height: 16, borderRadius: "50%",
      background: reached ? "var(--violet)" : "rgba(20,20,28,0.9)",
      border: `2px solid ${reached ? "var(--violet)" : isNext ? "var(--amber)" : "rgba(255,255,255,0.18)"}`,
      boxShadow: reached
        ? "0 0 12px var(--violet-glow)"
        : isNext ? "0 0 10px rgba(245,176,76,0.45)" : "none",
      flex: "0 0 auto",
    }} />
  );
}

// ─────────────────────────────────────────────────────────────
// RewardsPage  →  /coins/rewards   (Inventory)
// ─────────────────────────────────────────────────────────────
export function RewardsPage() {
  const isMobile = useMobile();
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stickerCode, setStickerCode] = useState(null);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    coinsApi.balance().then(setBalance).finally(() => setLoading(false));
  }, []);

  const redeem = async () => {
    setRedeeming(true);
    try {
      const res = await coinsApi.redeemSticker();
      setStickerCode(res);
    } catch (e) { alert(`Failed: ${e.message}`); }
    finally { setRedeeming(false); }
  };

  if (loading || !balance) return <SidequestLayout active="inventory"><Spinner /></SidequestLayout>;

  return (
    <SidequestLayout active="inventory">
      <div className="eyebrow">§ REWARDS VAULT</div>
      <h1 className="display" style={{ fontSize: isMobile ? 28 : 40, marginTop: 6 }}>
        Your <span style={{ color: "var(--violet)" }}>{balance.balance.toLocaleString()}</span>{" "}
        <span style={{ color: "var(--ink-dim)" }}>coins.</span>
      </h1>

      <RewardJourney balance={balance.balance} />

      {/* Stock notice */}
      <div style={{
        marginTop: 18, padding: "12px 16px", borderRadius: "var(--r-md)",
        background: "rgba(232,185,116,0.07)", border: "1px solid rgba(232,185,116,0.3)",
        fontSize: 12.5, color: "var(--ink-dim)", display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ color: "var(--amber)", fontSize: 16 }}>⚠</span>
        <span>
          <strong style={{ color: "var(--ink)" }}>Stock note:</strong>{" "}
          Adding a reward to cart does not reserve stock. Redemption QR codes expire
          after a limited time if unused — visit the redemption booth promptly.
        </span>
      </div>

      <div style={{
        marginTop: 18,
        display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap: 18,
      }}>
        {/* LEVEL 1 — STICKER (FCFS) */}
        <div className="glass" style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="eyebrow">§ LEVEL 1 · STICKER</div>
              <div className="display" style={{ fontSize: 26, marginTop: 8 }}>
                {TIER_THRESHOLDS.STICKER.toLocaleString()} coins
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 4, letterSpacing: "0.1em" }}>
                FIRST-COME-FIRST-SERVED
              </div>
            </div>
            <span className="chip violet" style={{ fontSize: 9 }}>FCFS</span>
          </div>

          {stickerCode ? (
            <div style={{ marginTop: 18 }}>
              <div className="mono" style={{
                fontSize: 22, padding: "16px 14px", borderRadius: "var(--r-md)",
                background: "rgba(127,119,221,0.10)", border: "1px solid var(--violet-dim)",
                color: "var(--ink)", textAlign: "center", letterSpacing: "0.2em",
              }}>{stickerCode.code}</div>
              <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 10 }}>
                Present this code at the redemption booth. Expires {fmtTime(stickerCode.expires_at)}.
              </p>
            </div>
          ) : balance.balance >= TIER_THRESHOLDS.STICKER ? (
            <button className="btn primary sm" onClick={redeem} disabled={redeeming}
              style={{ marginTop: 18 }}>
              {redeeming ? "…" : "GENERATE REDEMPTION CODE"}
            </button>
          ) : (
            <ProgressTo current={balance.balance} target={TIER_THRESHOLDS.STICKER} />
          )}
        </div>

        <RankRewardCard tier="BADGE"        level="LEVEL 2 · BADGE"         balance={balance.balance} rank={balance.rank} />
        <RankRewardCard tier="NOTEPAD"      level="LEVEL 3 · NOTEPAD"       balance={balance.balance} rank={balance.rank} />
        <RankRewardCard tier="MUG"          level="LEVEL 4 · MUG"           balance={balance.balance} rank={balance.rank} />
        <RankRewardCard tier="TOTE_BAG_MUG" level="LEVEL 5 · TOTE BAG + MUG" balance={balance.balance} rank={balance.rank} />
      </div>

    </SidequestLayout>
  );
}

function ProgressTo({ current, target }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: "linear-gradient(90deg, var(--teal), var(--violet))",
          boxShadow: "0 0 12px var(--violet-glow)",
        }} />
      </div>
      <div className="mono" style={{
        fontSize: 11, color: "var(--ink-mute)", marginTop: 8, letterSpacing: "0.1em",
      }}>
        {current.toLocaleString()} / {target.toLocaleString()} COINS
      </div>
    </div>
  );
}

function RankRewardCard({ tier, level, balance, rank }) {
  const cutoff = TIER_RANK_CUTOFFS[tier];
  const threshold = TIER_THRESHOLDS[tier];
  const meetsCoins = balance >= threshold;
  const meetsRank = rank != null && rank <= cutoff;

  let statusLine, color, badge;
  if (meetsCoins && meetsRank) {
    statusLine = "In allocation zone — awaiting snapshot.";
    color = "var(--teal)"; badge = "ELIGIBLE";
  } else if (meetsCoins && !meetsRank) {
    statusLine = `Eligible coins — currently rank ${rank ?? "—"} of ${cutoff} cutoff. Builder Certificate if outside top ${cutoff}.`;
    color = "var(--amber)"; badge = "RANK GAP";
  } else {
    statusLine = `Top ${cutoff} by snapshot — must hold ${threshold.toLocaleString()}+ coins.`;
    color = "var(--ink-mute)"; badge = "LOCKED";
  }

  return (
    <div className="glass" style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow">§ {level}</div>
          <div className="display" style={{ fontSize: 26, marginTop: 8 }}>
            {threshold.toLocaleString()} · top {cutoff}
          </div>
        </div>
        <span className="chip" style={{ fontSize: 9 }}>{badge}</span>
      </div>
      <p style={{ fontSize: 12.5, color, marginTop: 14 }}>{statusLine}</p>
      {!meetsCoins && <ProgressTo current={balance} target={threshold} />}
      {meetsCoins && rank != null && (
        <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 10, letterSpacing: "0.1em" }}>
          YOUR RANK · #{rank}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CoinHistoryPage  →  /coins/history
// ─────────────────────────────────────────────────────────────
export function CoinHistoryPage() {
  const isMobile = useMobile();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    coinsApi.history().then((d) => setHistory(d || [])).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "ALL") return history;
    if (filter === "EARNED") return history.filter(h => h.coins > 0);
    if (filter === "REVERSED") return history.filter(h => h.coins < 0);
    return history.filter(h => h.source_type === filter);
  }, [history, filter]);

  const totals = useMemo(() => {
    const earned = history.filter(h => h.coins > 0).reduce((a, h) => a + h.coins, 0);
    const reversed = history.filter(h => h.coins < 0).reduce((a, h) => a + h.coins, 0);
    return { earned, reversed, net: earned + reversed };
  }, [history]);

  return (
    <SidequestLayout active="history">
      <div className="eyebrow">§ COIN HISTORY</div>
      <h1 className="display" style={{ fontSize: isMobile ? 28 : 40, marginTop: 6 }}>
        Every transaction.
      </h1>

      <div className="glass" style={{
        marginTop: 18, padding: 18,
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr 1fr" : "repeat(3, 1fr)",
        gap: 18,
      }}>
        <Stat label="EARNED" value={`+${totals.earned}`} color="var(--teal)" />
        <Stat label="REVERSED" value={totals.reversed.toString()} color="var(--amber)" />
        <Stat label="NET" value={totals.net.toString()} color="var(--ink)" />
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["ALL", "EARNED", "REVERSED", ...SUBMIT_SOURCES].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={filter === f ? "chip violet" : "chip"}
            style={{ cursor: "pointer", fontSize: 9.5 }}>
            {f === "ALL" ? "ALL" : (SOURCE_LABEL[f] || f).toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="glass" style={{ marginTop: 18, padding: 18 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", color: "var(--ink-mute)", fontSize: 13 }}>
              No entries match this filter.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {filtered.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} onDispute={() => {}} />
              ))}
            </div>
          )}
        </div>
      )}
    </SidequestLayout>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mono" style={{ fontSize: 22, color, marginTop: 6, fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Guide — How to Earn Cents
// ─────────────────────────────────────────────────────────────

const EARN_ACTIVITIES = [
  { icon: "💼", activity: "RSVP LinkedIn Post",     type: "LinkedIn URL",          coins: 300,  confirmed: true  },
  { icon: "📸", activity: "AR Filter Story",         type: "Instagram Screenshot",  coins: 200,  confirmed: true  },
  { icon: "🔍", activity: "Scavenger Hunt",           type: "Volunteer Verification",coins: null, confirmed: false },
  { icon: "✍️", activity: "Signature & Photo Booth", type: "LinkedIn URL",          coins: null, confirmed: false },
  { icon: "😂", activity: "Meme Challenge",           type: "LinkedIn URL",          coins: null, confirmed: false },
  { icon: "🎮", activity: "Esports Arena",            type: "Tournament Results",    coins: null, confirmed: false },
  { icon: "🏟️", activity: "Booth Activities",        type: "Volunteer Verification",coins: null, confirmed: false },
];

const REWARD_TIERS = [
  { level: 1, reward: "Sticker",       emoji: "🏷️", color: "#7f77dd", hint: "Claim at any merch booth" },
  { level: 2, reward: "Badge",          emoji: "🎖️", color: "#40d4c4", hint: "Snap-on enamel badge" },
  { level: 3, reward: "Notepad",        emoji: "📓", color: "#f5b04c", hint: "ASCENT branded notepad" },
  { level: 4, reward: "Mug",            emoji: "☕", color: "#1d9e75", hint: "Limited edition mug" },
  { level: 5, reward: "Tote Bag + Mug", emoji: "🛍️", color: "#dc6464", hint: "Top participants only" },
];

const HOW_IT_WORKS = [
  { n: "01", head: "Do an activity",   body: "Post on LinkedIn or Instagram, use the AR filter, visit booths, or join micro-events during the fest.",  color: "#7f77dd" },
  { n: "02", head: "Submit proof",     body: "Paste your URL or upload a screenshot in the Verification section. Takes under 30 seconds.",             color: "#40d4c4" },
  { n: "03", head: "Get verified",     body: "Admins review your submission. You'll see Approved or Rejected — with a reason if it's rejected.",        color: "#f5b04c" },
  { n: "04", head: "Cents credited",   body: "Cents land in your account automatically once approved. Open your dashboard to see the new balance.",     color: "#1d9e75" },
];

const SUBMISSION_RULES = [
  {
    platform: "LinkedIn Posts",
    emoji: "💼",
    rules: ["Account must be set to public", "Include required hashtags and tags in the post"],
  },
  {
    platform: "Instagram Posts / Reels",
    emoji: "📷",
    rules: ["Account must be set to public", "Required hashtags and tags are mandatory"],
  },
  {
    platform: "Instagram Stories",
    emoji: "⏱️",
    rules: ["Submit a screenshot as proof", "Stories are not re-verified after initial approval"],
  },
];

function GuideAccordion({ title, emoji, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      borderRadius: 12,
      border: "1px solid var(--glass-border)",
      overflow: "hidden",
      marginBottom: 8,
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 12,
          padding: "14px 18px",
          background: open ? "rgba(127,119,221,0.08)" : "rgba(255,255,255,0.025)",
          border: 0, cursor: "pointer",
          color: "var(--ink)", textAlign: "left",
          transition: "background 0.15s",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{emoji}</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" style={{
            flexShrink: 0, color: "var(--ink-mute)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: "14px 18px 16px", background: "rgba(255,255,255,0.015)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function GuidePage() {
  const isMobile = useMobile();
  const navigate = useNavigate();

  return (
    <SidequestLayout active="guide">

      {/* ── Hero ── */}
      <div className="glass-strong" style={{
        padding: isMobile ? "28px 22px" : "36px 40px",
        marginBottom: 28,
        borderRadius: 16,
        background: "linear-gradient(135deg, rgba(127,119,221,0.12) 0%, rgba(64,212,196,0.06) 100%)",
        border: "1px solid rgba(127,119,221,0.25)",
      }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>§ GUIDE</div>
        <h1 style={{
          margin: 0,
          fontFamily: "var(--f-display)",
          fontSize: isMobile ? 30 : 40,
          lineHeight: 1.15,
          color: "var(--ink)",
        }}>
          How to earn{" "}
          <span style={{ color: "var(--violet)" }}>Ascent Cents</span>
        </h1>
        <p style={{
          margin: "14px 0 0",
          fontSize: 15,
          color: "var(--ink-mute)",
          lineHeight: 1.65,
          maxWidth: 580,
        }}>
          Participate in activities, post on social media, and visit booths
          across the fest. Every approved submission adds Cents to your balance —
          which you can spend on rewards or use to climb the leaderboard.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <button className="btn primary sm" onClick={() => navigate("/coins/submit")}>
            Submit Proof
          </button>
          <button className="btn sm" onClick={() => navigate("/coins/rewards")}>
            View Rewards
          </button>
        </div>
      </div>

      {/* ── How it Works ── */}
      <div style={{ marginBottom: 32 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>§ THE PROCESS</div>
        <h2 style={{
          margin: "0 0 20px",
          fontFamily: "var(--f-display)",
          fontSize: isMobile ? 22 : 26,
          color: "var(--ink)",
        }}>How it works</h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
          gap: 14,
        }}>
          {HOW_IT_WORKS.map(({ n, head, body, color }) => (
            <div key={n} className="glass" style={{
              padding: "22px 20px",
              borderRadius: 14,
              borderTop: `3px solid ${color}`,
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{
                fontFamily: "var(--f-mono)",
                fontSize: 28,
                fontWeight: 700,
                color,
                lineHeight: 1,
                opacity: 0.7,
              }}>{n}</div>
              <div style={{
                fontSize: 15, fontWeight: 700,
                color: "var(--ink)",
              }}>{head}</div>
              <div style={{
                fontSize: 13, color: "var(--ink-mute)",
                lineHeight: 1.6,
              }}>{body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Ways to Earn ── */}
      <div style={{ marginBottom: 32 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>§ ACTIVITIES</div>
        <h2 style={{
          margin: "0 0 6px",
          fontFamily: "var(--f-display)",
          fontSize: isMobile ? 22 : 26,
          color: "var(--ink)",
        }}>Ways to earn</h2>
        <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--ink-mute)" }}>
          Confirmed Cent values shown below. TBD activities will be updated before the event.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
          gap: 12,
        }}>
          {EARN_ACTIVITIES.map(({ icon, activity, type, coins, confirmed }) => (
            <div key={activity} className="glass" style={{
              padding: "18px 20px",
              borderRadius: 14,
              display: "flex", alignItems: "center", gap: 16,
              opacity: confirmed ? 1 : 0.7,
            }}>
              <div style={{
                fontSize: 28, flexShrink: 0,
                width: 52, height: 52,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--glass-border)",
              }}>{icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 3 }}>
                  {activity}
                </div>
                <div style={{
                  fontSize: 11.5, color: "var(--ink-mute)",
                  fontFamily: "var(--f-mono)", letterSpacing: "0.04em",
                }}>{type}</div>
              </div>
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                {confirmed ? (
                  <>
                    <div style={{
                      fontSize: 22, fontWeight: 800,
                      color: "var(--teal)",
                      fontFamily: "var(--f-display)",
                      lineHeight: 1,
                    }}>{coins}</div>
                    <div style={{
                      fontSize: 10, color: "var(--teal)", opacity: 0.7,
                      fontFamily: "var(--f-mono)", letterSpacing: "0.12em",
                      marginTop: 2,
                    }}>CENTS</div>
                  </>
                ) : (
                  <span style={{
                    fontSize: 11, color: "var(--ink-mute)",
                    fontFamily: "var(--f-mono)", letterSpacing: "0.08em",
                    padding: "3px 8px", borderRadius: 6,
                    border: "1px solid var(--glass-border)",
                    background: "rgba(255,255,255,0.03)",
                  }}>TBD</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Reward Tiers ── */}
      <div style={{ marginBottom: 32 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>§ REWARDS</div>
        <h2 style={{
          margin: "0 0 6px",
          fontFamily: "var(--f-display)",
          fontSize: isMobile ? 22 : 26,
          color: "var(--ink)",
        }}>Reward tiers</h2>
        <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--ink-mute)" }}>
          Earn more Cents to unlock higher tier rewards. Some items have limited stock.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)",
          gap: 12,
        }}>
          {REWARD_TIERS.map(({ level, reward, emoji, color, hint }) => (
            <div key={level} style={{
              padding: "20px 16px",
              borderRadius: 14,
              border: `1px solid ${color}44`,
              background: `${color}0d`,
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 10, textAlign: "center",
            }}>
              <div style={{ fontSize: 32 }}>{emoji}</div>
              <div style={{
                fontFamily: "var(--f-mono)", fontSize: 10,
                letterSpacing: "0.16em",
                color,
                background: `${color}22`,
                border: `1px solid ${color}44`,
                padding: "2px 8px", borderRadius: 999,
              }}>
                LVL {level}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{reward}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.5 }}>{hint}</div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 14, padding: "12px 18px", borderRadius: 10,
          background: "rgba(245,176,76,0.07)",
          border: "1px solid rgba(245,176,76,0.22)",
          fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.6,
        }}>
          <strong style={{ color: "#f5b04c" }}>Limited stock —</strong>{" "}
          some rewards may run out. Top leaderboard participants at each
          snapshot may also receive additional prizes.
        </div>
      </div>

      {/* ── Redemption ── */}
      <div style={{ marginBottom: 32 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>§ REDEMPTION</div>
        <h2 style={{
          margin: "0 0 6px",
          fontFamily: "var(--f-display)",
          fontSize: isMobile ? 22 : 26,
          color: "var(--ink)",
        }}>How to redeem</h2>
        <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--ink-mute)" }}>
          Redemption happens at the merch booth on event day — not online.
        </p>

        <div className="glass" style={{ padding: isMobile ? 20 : 28, borderRadius: 14 }}>
          {[
            { n: 1, head: "Open Rewards",         body: "Go to the Rewards section in your dashboard.",                         icon: "🏆" },
            { n: 2, head: "Select a reward",       body: "Pick a reward you're eligible for based on your Cents balance.",        icon: "👆" },
            { n: 3, head: "Generate a code",       body: "Tap Claim to generate a redemption QR code — it's valid for 30 min.",  icon: "📲" },
            { n: 4, head: "Visit the booth",       body: "Head to the merch booth before your code expires.",                     icon: "🏃" },
            { n: 5, head: "Collect your reward",   body: "Volunteer scans or reads your code and hands over the reward.",         icon: "🎁" },
          ].map(({ n, head, body, icon }, idx, arr) => (
            <div key={n} style={{
              display: "flex", gap: 18,
              paddingBottom: idx < arr.length - 1 ? 20 : 0,
              position: "relative",
            }}>
              {/* connector line */}
              {idx < arr.length - 1 && (
                <div style={{
                  position: "absolute",
                  left: 19, top: 42, bottom: 0,
                  width: 2,
                  background: "linear-gradient(to bottom, rgba(127,119,221,0.3), transparent)",
                }} />
              )}
              <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: "rgba(127,119,221,0.12)",
                border: "1px solid rgba(127,119,221,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, zIndex: 1,
              }}>{icon}</div>
              <div style={{ paddingTop: 6 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  {n}. {head}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.6 }}>{body}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 12, padding: "12px 18px", borderRadius: 10,
          background: "rgba(239,68,68,0.07)",
          border: "1px solid rgba(239,68,68,0.22)",
          fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.6,
        }}>
          <strong style={{ color: "#f87171" }}>Heads up —</strong>{" "}
          selecting a reward does not reserve stock. Your QR code expires if
          unused. Don't generate it until you're ready to walk to the booth.
        </div>
      </div>

      {/* ── Submission Guidelines (collapsible) ── */}
      <div style={{ marginBottom: 32 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>§ RULES</div>
        <h2 style={{
          margin: "0 0 6px",
          fontFamily: "var(--f-display)",
          fontSize: isMobile ? 22 : 26,
          color: "var(--ink)",
        }}>Submission guidelines</h2>
        <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--ink-mute)" }}>
          Tap a platform to see what's required. Missing any rule = rejection.
        </p>

        {SUBMISSION_RULES.map(({ platform, emoji, rules }) => (
          <GuideAccordion key={platform} title={platform} emoji={emoji}>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {rules.map((r) => (
                <li key={r} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  fontSize: 13.5, color: "var(--ink-dim)", lineHeight: 1.55,
                }}>
                  <span style={{ color: "var(--teal)", marginTop: 1, flexShrink: 0 }}>✓</span>
                  {r}
                </li>
              ))}
            </ul>
          </GuideAccordion>
        ))}

        <GuideAccordion title="What gets rejected?" emoji="❌">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              "Duplicate submissions (same URL submitted twice)",
              "Invalid or broken URLs",
              "Missing required hashtags or tags",
              "Post was deleted or set to private after submission",
              "Reused content from a previous event",
            ].map((r) => (
              <div key={r} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                fontSize: 13.5, color: "var(--ink-dim)", lineHeight: 1.55,
              }}>
                <span style={{ color: "#f87171", marginTop: 1, flexShrink: 0 }}>✕</span>
                {r}
              </div>
            ))}
            <div style={{
              marginTop: 8, padding: "10px 14px", borderRadius: 8,
              background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
              fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.6,
            }}>
              Verified posts may be re-checked during the event. If a post is deleted
              or modified after approval, associated Cents may be reversed.
            </div>
          </div>
        </GuideAccordion>
      </div>

      {/* ── Stay Updated ── */}
      <div className="glass" style={{
        padding: isMobile ? 20 : 26, borderRadius: 14,
        display: "flex", flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "flex-start" : "center",
        gap: 18,
      }}>
        <div style={{ fontSize: 36 }}>📣</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
            Stay updated
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.6, marginBottom: 12 }}>
            New activities, bonus opportunities, leaderboard changes, and reward
            announcements will be posted on:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["Dashboard notifications", "WhatsApp community", "Discord", "Official ASCENT channels"].map((ch) => (
              <span key={ch} style={{
                padding: "4px 12px", borderRadius: 999,
                fontSize: 12, fontFamily: "var(--f-mono)", letterSpacing: "0.06em",
                background: "rgba(64,212,196,0.1)",
                border: "1px solid rgba(64,212,196,0.3)",
                color: "var(--teal)",
              }}>{ch}</span>
            ))}
          </div>
        </div>
      </div>

    </SidequestLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// My QR — student shows this to a booth volunteer to earn coins
// for an on-ground micro-event they just completed.
// ─────────────────────────────────────────────────────────────
export function MyQRPage() {
  const { user } = useUserAuth() || {};
  const isMobile = useMobile();
  const userId = user?.id || "";
  const qrLabel = userId ? `ASCENT-${userId.slice(0, 8).toUpperCase()}` : "ASCENT-LOADING";
  // QR encodes the full UUID so the booth scanner can call /booth/student/:id
  // directly. The label below the QR is the truncated human-readable form.
  const qrValue = userId || "ASCENT-LOADING";

  return (
    <SidequestLayout active="qr">
      <div className="fade-in" style={{ display: "grid", placeItems: "center", padding: isMobile ? 16 : 32 }}>
        <div className="card" style={{
          padding: isMobile ? 24 : 36, maxWidth: 480, width: "100%",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
        }}>
          <div className="eyebrow">My QR</div>
          <h2 style={{ margin: 0, textAlign: "center" }}>Show this at any booth</h2>
          <p style={{
            color: "var(--ink-mute)", textAlign: "center", margin: 0, fontSize: 14, lineHeight: 1.5,
          }}>
            A volunteer scans this code to credit coins for the activity you just
            completed at their booth. The booth is pre-scoped to one micro-event,
            so you can&apos;t be awarded for the wrong thing.
          </p>

          <div style={{
            padding: 18, borderRadius: 14, background: "white",
            boxShadow: "0 0 60px rgba(127,119,221,0.25)",
          }}>
            <QRCodeSVG
              value={qrValue}
              size={isMobile ? 220 : 280}
              level="M"
              marginSize={2}
            />
          </div>

          <div className="mono" style={{ fontSize: 13, color: "var(--ink-mute)", letterSpacing: 0.5 }}>
            {qrLabel}
          </div>

          <div style={{
            width: "100%", padding: 12, borderRadius: 10,
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.25)",
            color: "var(--ink-mute)", fontSize: 12, lineHeight: 1.5,
          }}>
            <strong style={{ color: "var(--ink)" }}>Heads up:</strong>{" "}
            keep your screen on full brightness. Each booth credits a fixed
            coin amount; one award per student per booth.
          </div>
        </div>
      </div>
    </SidequestLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// Terms & Conditions page  (/coins/terms)
// ─────────────────────────────────────────────────────────────
const TERMS_SECTIONS = [
  {
    id: "ugc",
    emoji: "📤",
    title: "User-Generated Content (UGC) Submissions",
    color: "var(--violet)",
    items: [
      "You may submit proof of participation for eligible activities listed in the How to Earn guide.",
      "Each activity type permits only one approved submission per registered participant. Duplicate submissions will be rejected.",
      "Submitted proof (URL or screenshot) must be original, publicly visible, and directly related to the Ascent Techfest 2026 activity it is claimed for.",
      "Fabricated, edited, or borrowed proof constitutes fraud and will result in immediate disqualification and revocation of all Ascent Cents earned.",
      "The organisers reserve the right to request additional verification at any time.",
      "By submitting, you grant the Ascent Techfest team a non-exclusive right to display your submission internally for verification purposes.",
    ],
  },
  {
    id: "coins",
    emoji: "🪙",
    title: "Coin Crediting & Verification Policy",
    color: "var(--teal)",
    items: [
      "Ascent Cents are credited only after a volunteer or administrator manually reviews and approves your submission.",
      "Review typically completes within a few hours; during peak periods it may take up to 24 hours.",
      "Approval is final at the reviewer's discretion. An approved submission cannot be re-reviewed except through the formal dispute process.",
      "Coin amounts are fixed per activity type and are displayed in the guide. No negotiation or partial credit is available.",
      "Cents earned at on-site booths (QR scan) are credited instantly and are final.",
      "Rejected submissions may be resubmitted once if the rejection reason can be remedied (e.g., a clearer screenshot). A second rejection is final.",
    ],
  },
  {
    id: "reversal",
    emoji: "↩️",
    title: "Reversal & Correction Policy",
    color: "var(--amber)",
    items: [
      "The Ascent Cents ledger is append-only. Corrections are applied as reversal entries, not edits. Your full transaction history is always preserved.",
      "Reversals may be issued if a submission is later found to be fraudulent, if a technical error caused a double credit, or if a booth credited the wrong amount.",
      "You will be notified in-app when a reversal is posted to your account.",
      "If a reversal reduces your balance below zero, your balance is floored at 0 — no negative balances are carried forward.",
      "Reversals applied due to fraud are not appealable.",
    ],
  },
  {
    id: "rewards",
    emoji: "🎁",
    title: "Rewards & Redemption",
    color: "var(--violet)",
    items: [
      "Rewards are physical merchandise (stickers, badges, notepads, mugs, tote bags) distributed at designated redemption booths inside the fest venue.",
      "Redemption is available only to registered Ascent Techfest 2026 participants with a valid QR code.",
      "Each participant may redeem a reward only once. Redemption is irreversible.",
      "Spending Cents on a reward does not remove you from the leaderboard — your historical balance is retained for ranking.",
      "Reward stock is limited. If a tier reward runs out, the next available tier may be offered at the organiser's discretion.",
      "Rewards have no monetary value and cannot be exchanged or refunded.",
      "The organisers reserve the right to modify reward tiers or available stock without prior notice.",
    ],
  },
  {
    id: "leaderboard",
    emoji: "🏆",
    title: "Leaderboard & Rankings",
    color: "var(--teal)",
    items: [
      "The public leaderboard displays participant usernames and coin balances. Participation in the leaderboard is automatic and cannot be opted out of.",
      "Rankings are updated periodically — they reflect the latest leaderboard snapshot, not real-time balances.",
      "In the event of a tie, the participant who reached that balance earlier (by timestamp) ranks higher.",
      "Leaderboard-based reward tiers (Badge, Notepad, Mug, Tote Bag + Mug) are determined at a cut-off snapshot taken by organisers. Rank at that moment is final.",
    ],
  },
  {
    id: "powerhour",
    emoji: "⚡",
    title: "Power Hour",
    color: "var(--amber)",
    items: [
      "Power Hour is a time-limited bonus window during which all approved submissions earn an additional coin multiplier.",
      "Power Hour windows are announced via the in-app notification system. No advance notice is guaranteed.",
      "Submissions approved during an active Power Hour automatically receive the multiplier. Submissions approved outside Power Hour do not, even if they were submitted during one.",
      "Power Hour parameters (multiplier value, duration, frequency) are at the sole discretion of the organisers and may change without notice.",
    ],
  },
  {
    id: "conduct",
    emoji: "🚫",
    title: "Prohibited Conduct",
    color: "#e05252",
    items: [
      "Submitting proof on behalf of another participant, or allowing another participant to submit on your behalf.",
      "Coordinating with others to manipulate rankings (e.g., bulk-submitting identical content across accounts).",
      "Exploiting any bug or unintended behaviour in the platform to gain Cents. Such Cents will be reversed and the participant may be disqualified.",
      "Attempting to scan another participant's QR code at a booth.",
      "Any behaviour that violates the broader Ascent Techfest Code of Conduct applies here as well.",
    ],
  },
  {
    id: "disputes",
    emoji: "⚖️",
    title: "Dispute Resolution",
    color: "var(--teal)",
    items: [
      "If you believe a submission was incorrectly rejected or a coin amount is wrong, raise a dispute within 12 hours of the decision via the Feedback form.",
      "Include your submission ID and a clear explanation of the discrepancy.",
      "Disputes are reviewed by an ops lead or admin. Their decision is final.",
      "Disputes raised after 12 hours, or disputes without supporting evidence, may be declined without review.",
    ],
  },
  {
    id: "modifications",
    emoji: "📋",
    title: "Modifications & Availability",
    color: "var(--ink-mute)",
    items: [
      "These terms govern the Ascent Cents system for Ascent Techfest 2026 only. Cents have no value outside this event.",
      "The organisers may update these terms at any time. The in-app notification system will be used to communicate significant changes.",
      "The Ascent Cents system may be paused, modified, or discontinued at any point during the event without liability.",
      "Participation in the Ascent Cents system constitutes acceptance of these terms.",
    ],
  },
];

export function TermsPage() {
  const isMobile = useMobile();
  const navigate = useNavigate();

  return (
    <SidequestLayout active="terms">

      {/* ── Hero ── */}
      <div className="glass-strong" style={{
        padding: isMobile ? "28px 22px" : "36px 40px",
        marginBottom: 32,
        borderRadius: 16,
        background: "linear-gradient(135deg, rgba(127,119,221,0.10) 0%, rgba(64,212,196,0.05) 100%)",
        border: "1px solid rgba(127,119,221,0.22)",
      }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>§ LEGAL</div>
        <h1 style={{
          margin: 0,
          fontFamily: "var(--f-display)",
          fontSize: isMobile ? 28 : 38,
          lineHeight: 1.15,
          color: "var(--ink)",
        }}>
          Terms &{" "}
          <span style={{ color: "var(--violet)" }}>Conditions</span>
        </h1>
        <p style={{
          margin: "14px 0 0",
          fontSize: 14,
          color: "var(--ink-mute)",
          lineHeight: 1.65,
          maxWidth: 600,
        }}>
          These terms govern the <strong style={{ color: "var(--ink)" }}>Ascent Cents</strong> gamification
          system for Ascent Techfest 2026. By participating — submitting proof,
          scanning QR codes, or redeeming rewards — you agree to the rules below.
          Last updated: May 2026.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <button className="btn sm" onClick={() => navigate("/coins/guide")}>
            How to Earn
          </button>
          <button className="btn sm" onClick={() => navigate("/coins")}>
            Command Center
          </button>
        </div>
      </div>

      {/* ── Quick index ── */}
      <div className="glass" style={{
        padding: "18px 22px",
        borderRadius: 14,
        marginBottom: 32,
        display: "flex",
        flexWrap: "wrap",
        gap: "8px 16px",
      }}>
        {TERMS_SECTIONS.map(({ id, emoji, title }) => (
          <a
            key={id}
            href={`#terms-${id}`}
            style={{
              fontSize: 13,
              color: "var(--violet)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
            onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
          >
            {emoji} {title.split("(")[0].trim()}
          </a>
        ))}
      </div>

      {/* ── Sections ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 40 }}>
        {TERMS_SECTIONS.map(({ id, emoji, title, color, items }) => (
          <div
            key={id}
            id={`terms-${id}`}
            className="glass"
            style={{
              borderRadius: 14,
              borderLeft: `4px solid ${color}`,
              padding: isMobile ? "22px 18px" : "26px 28px",
              scrollMarginTop: 80,
            }}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 22 }}>{emoji}</span>
              <h2 style={{
                margin: 0,
                fontFamily: "var(--f-display)",
                fontSize: isMobile ? 16 : 18,
                color: "var(--ink)",
                lineHeight: 1.25,
              }}>{title}</h2>
            </div>
            <ol style={{
              margin: 0,
              paddingLeft: 22,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              {items.map((item, i) => (
                <li key={i} style={{
                  fontSize: 13,
                  color: "var(--ink-mute)",
                  lineHeight: 1.7,
                }}>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      {/* ── Footer note ── */}
      <div style={{
        padding: "16px 20px",
        borderRadius: 12,
        background: "rgba(127,119,221,0.06)",
        border: "1px solid rgba(127,119,221,0.15)",
        fontSize: 12,
        color: "var(--ink-mute)",
        lineHeight: 1.7,
        marginBottom: 8,
      }}>
        <strong style={{ color: "var(--ink)" }}>Questions?</strong>{" "}
        Reach out to the Ascent Coins desk at any information booth inside the venue,
        or use the{" "}
        <span
          style={{ color: "var(--violet)", cursor: "pointer", textDecoration: "underline" }}
          onClick={() => navigate("/feedback")}
        >
          Feedback form
        </span>
        {" "}in the app. Ascent Cents have no monetary value and are valid only
        during Ascent Techfest 2026.
      </div>

    </SidequestLayout>
  );
}
