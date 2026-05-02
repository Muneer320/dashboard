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

// ─────────────────────────────────────────────────────────────
// Source labels & coin/tier reference
// ─────────────────────────────────────────────────────────────
const SOURCE_LABEL = {
  RSVP_POST:        "RSVP LinkedIn",
  ROUND1_PROJECT:   "Round 1 Project",
  AR_FILTER:        "AR Filter Snap",
  SCAVENGER_HUNT:   "Scavenger Hunt",
  RAZORPAY_PITCH:   "Razorpay Pitch",
  FUTURE_VISION:    "Future Vision",
  CREATOR_COLLAB:   "Creator Collab",
  MVP_MUSEUM:       "MVP Museum",
  JOBS_WALL:        "Jobs Wall",
  ESPORTS_1ST:      "Esports — 1st",
  ESPORTS_2ND:      "Esports — 2nd",
  ESPORTS_3RD:      "Esports — 3rd",
  ECO_EXCHANGE:     "Eco Exchange",
  ECO_DESIGN_WIN:   "Eco Design Win",
  EVENT_WIN:        "Event Win",
  ENGAGEMENT:       "Engagement",
  POWER_HOUR_BONUS: "Power Hour Bonus",
  SURPRISE_DROP:    "Surprise Drop",
  REVERSAL:         "Reversal",
  RESTORE:          "Restore",
  MANUAL_ADJUSTMENT:"Manual Adjustment",
};

const COIN_VALUES = {
  RSVP_POST: 100, ROUND1_PROJECT: 500, FUTURE_VISION: 100,
  MVP_MUSEUM: 100, JOBS_WALL: 100, CREATOR_COLLAB: 150,
};

const TIER_THRESHOLDS  = { STICKER: 500,  MUG: 1500, TSHIRT: 2500, PREMIUM_KIT: 4000 };
const TIER_RANK_CUTOFFS = {                 MUG: 30,   TSHIRT: 50,   PREMIUM_KIT: 10 };
const TIER_LABEL = { STICKER: "Sticker", MUG: "Mug", TSHIRT: "T-shirt", PREMIUM_KIT: "Premium Kit" };

// Sources allowed in the UGC submit grid (URL submissions only — booth
// sources like AR_FILTER are awarded by volunteers, not via this page).
const SUBMIT_SOURCES = [
  "RSVP_POST", "ROUND1_PROJECT", "FUTURE_VISION",
  "MVP_MUSEUM", "JOBS_WALL", "CREATOR_COLLAB",
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

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 32, color: "var(--ink-mute)" }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
    default:      return null;
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
                  <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 12 }}>
                    <span style={{ color: "var(--teal)", display: "inline-flex" }}><NavIcon k="coin" /></span>
                    <span className="display" style={{ fontSize: isMobile ? 56 : 72, color: "var(--ink)" }}>
                      {(balance?.balance ?? 0).toLocaleString()}
                    </span>
                    <span className="mono" style={{ fontSize: 12, color: "var(--ink-mute)", letterSpacing: "0.18em" }}>
                      COINS
                    </span>
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
export function UGCSubmitPage() {
  const isMobile = useMobile();
  const [eligibility, setEligibility] = useState(null);
  const [phStatus, setPhStatus] = useState({ active: false });
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("RSVP_POST");
  const [url, setUrl] = useState("");
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
  const eligibilityKey = {
    RSVP_POST: "rsvp", ROUND1_PROJECT: "round1_project",
    FUTURE_VISION: "future_vision", MVP_MUSEUM: "mvp_museum",
    JOBS_WALL: "jobs_wall", CREATOR_COLLAB: "creator_collab",
  }[selected];
  const isEligible = eligibility?.[eligibilityKey];

  const submit = async () => {
    if (!url.trim()) {
      setResult({ ok: false, message: "Paste a public post URL." }); return;
    }
    if (isCollab && !partner.trim()) {
      setResult({ ok: false, message: "Partner user ID required for Creator Collab." }); return;
    }
    setSubmitting(true);
    try {
      const res = await ugcApi.submit({
        source_type: selected, url: url.trim(),
        participant_2_id: isCollab ? partner.trim() : undefined,
      });
      const reason = res.auto_check_result?.reason;
      if (res.status === "rejected") {
        setResult({ ok: false, message: `Rejected: ${reason || "auto-check failed"}` });
      } else {
        setResult({
          ok: true,
          message: res.status === "pending_manual"
            ? "Submitted — admin will review manually."
            : "Auto-check passed! Moving to Admin Queue",
          flags: res.auto_check_result?.flags || [],
        });
        setUrl(""); setPartner("");
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
                }[src];
                const eligibleHere = eligibility[key];
                const active = selected === src;
                return (
                  <button key={src} onClick={() => { setSelected(src); setResult(null); }}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: "var(--r-md)",
                      border: `1px solid ${active ? "rgba(127,119,221,0.55)" : "var(--glass-border)"}`,
                      background: active ? "rgba(127,119,221,0.10)" : "rgba(255,255,255,0.025)",
                      color: eligibleHere ? "var(--ink)" : "var(--ink-mute)",
                      cursor: "pointer", opacity: eligibleHere ? 1 : 0.6,
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12.5 }}>{SOURCE_LABEL[src]}</span>
                      <span className="mono" style={{
                        fontSize: 10, letterSpacing: "0.05em",
                        color: active ? "var(--violet)" : "var(--ink-mute)",
                      }}>{eligibleHere ? "●" : "🔒"}</span>
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 4 }}>
                      +{COIN_VALUES[src] || 0} COINS
                    </div>
                  </button>
                );
              })}
            </div>

            {/* URL field */}
            <div style={{ marginTop: 22 }}>
              <label className="label">SOURCE URL</label>
              <input
                className="input" placeholder="https://linkedin.com/posts/…"
                value={url} onChange={(e) => setUrl(e.target.value)}
                disabled={!isEligible}
              />
            </div>

            {isCollab && (
              <div style={{ marginTop: 14 }}>
                <label className="label">PARTNER USER ID</label>
                <input
                  className="input" placeholder="UUID of your collab partner"
                  value={partner} onChange={(e) => setPartner(e.target.value)}
                  disabled={!isEligible}
                />
              </div>
            )}

            <p style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 14 }}>
              By submitting, you confirm this content meets the ASCENT'26 code of conduct.
            </p>

            <button className="btn primary sm"
              disabled={submitting || !isEligible}
              onClick={submit}
              style={{ marginTop: 14, opacity: submitting || !isEligible ? 0.6 : 1 }}>
              {submitting ? "Checking…" : "SUBMIT & AUTO-CHECK"}
            </button>

            {!isEligible && (
              <div style={{
                marginTop: 14, padding: "10px 12px", borderRadius: "var(--r-md)",
                background: "rgba(232,185,116,0.08)", border: "1px solid rgba(232,185,116,0.4)",
                color: "var(--amber)", fontSize: 12.5,
              }}>
                {selected === "ROUND1_PROJECT"
                  ? "Register for a build event first."
                  : (selected === "MVP_MUSEUM" || selected === "JOBS_WALL")
                  ? "MVP + Jobs Wall shared cap reached."
                  : "Already submitted for this source."}
              </div>
            )}

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
                  {result.ok && result.flags && result.flags.length === 0 && (
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
              <div className="eyebrow">§ VALIDATION RULES</div>
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
              <span style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.18em", textAlign: "right" }}>COINS EARNED</span>
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

      <div style={{
        marginTop: 24,
        display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap: 18,
      }}>
        {/* STICKER (FCFS) */}
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
                Present this code at any merch booth. Expires {fmtTime(stickerCode.expires_at)}.
              </p>
            </div>
          ) : balance.balance >= TIER_THRESHOLDS.STICKER ? (
            <button className="btn primary sm" onClick={redeem} disabled={redeeming}
              style={{ marginTop: 18 }}>
              {redeeming ? "…" : "AVAILABLE — CLAIM NOW"}
            </button>
          ) : (
            <ProgressTo current={balance.balance} target={TIER_THRESHOLDS.STICKER} />
          )}
        </div>

        <RankRewardCard tier="MUG"          level="LEVEL 2 · MUG"         balance={balance.balance} rank={balance.rank} />
        <RankRewardCard tier="TSHIRT"       level="LEVEL 3 · T-SHIRT"     balance={balance.balance} rank={balance.rank} />
        <RankRewardCard tier="PREMIUM_KIT"  level="LEVEL 4 · PREMIUM KIT" balance={balance.balance} rank={balance.rank} />
      </div>

      {/* DIGITAL SAFETY NET */}
      <div className="glass" style={{ marginTop: 26, padding: 22 }}>
        <div className="eyebrow">§ DIGITAL SAFETY NET</div>
        <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 10, maxWidth: 580 }}>
          Cross a coin threshold but miss the rank cut? You still earn a certificate
          plus a LinkedIn badge. Issued automatically after each snapshot.
        </p>
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
