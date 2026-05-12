// Redemption Booth — standalone tool for redemption_volunteer accounts.
// Flow: Login → Scan student QR → View balance + tiers → Give reward → Deduct coins.

import React, { useState, useEffect, useCallback, useRef } from "react";
import { adminAuth, redemptionApi, token } from "../lib/api";

// Dynamically imported so the package is only fetched when the
// scanner is actually rendered (after login, in scan mode).
// This avoids crashing the whole React tree if Vite hasn't
// pre-bundled html5-qrcode yet after a fresh npm install.
let Html5Qrcode = null;
async function loadScanner() {
  if (!Html5Qrcode) {
    const mod = await import("html5-qrcode");
    Html5Qrcode = mod.Html5Qrcode;
  }
  return Html5Qrcode;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidv4() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const TIER_COLORS = {
  STICKER:      { bg: "rgba(127,119,221,0.10)", border: "rgba(127,119,221,0.4)", badge: "#7f77dd" },
  BADGE:        { bg: "rgba(64,212,196,0.10)",  border: "rgba(64,212,196,0.4)",  badge: "#40d4c4" },
  NOTEPAD:      { bg: "rgba(245,176,76,0.10)",  border: "rgba(245,176,76,0.4)",  badge: "#f5b04c" },
  MUG:          { bg: "rgba(29,158,117,0.10)",  border: "rgba(29,158,117,0.4)",  badge: "#1d9e75" },
  TOTE_BAG_MUG: { bg: "rgba(220,100,100,0.10)", border: "rgba(220,100,100,0.4)", badge: "#dc6464" },
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg,#0d0d14 0%,#111128 100%)",
    color: "#e8e8f0",
    fontFamily: "'Inter','Segoe UI',sans-serif",
    padding: "0 0 60px",
  },
  topbar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(10,10,20,0.6)",
    backdropFilter: "blur(12px)",
    position: "sticky", top: 0, zIndex: 10,
  },
  brand: { fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", color: "#7f77dd" },
  wrap: { maxWidth: 520, margin: "0 auto", padding: "24px 16px" },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 14, padding: 22, marginBottom: 16,
  },
  label: { fontSize: 10, letterSpacing: "0.16em", color: "#6b6b8a", marginBottom: 8, display: "block" },
  input: {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8, padding: "11px 14px", color: "#e8e8f0", fontSize: 14, outline: "none",
  },
  btnPrimary: {
    width: "100%", padding: "13px", borderRadius: 8, border: "none", cursor: "pointer",
    background: "linear-gradient(135deg,#7f77dd,#5f58c0)", color: "#fff",
    fontSize: 14, fontWeight: 600, letterSpacing: "0.06em",
  },
  btnSm: {
    padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)", color: "#e8e8f0",
    fontSize: 12, cursor: "pointer", fontWeight: 500,
  },
  err: {
    background: "rgba(220,80,80,0.12)", border: "1px solid rgba(220,80,80,0.4)",
    borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f08080", marginBottom: 14,
  },
  ok: {
    background: "rgba(29,158,117,0.12)", border: "1px solid rgba(29,158,117,0.4)",
    borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#40d4c4", marginBottom: 14,
  },
};

// ─── QR Scanner component ────────────────────────────────────────────────────
function QRScanner({ onScan }) {
  const divId = "redemption-qr-reader";
  const scannerRef = useRef(null);
  const [status, setStatus] = useState("LOADING");

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      let Cls;
      try {
        Cls = await loadScanner();
      } catch {
        if (!cancelled) setStatus("ERROR: Failed to load scanner library");
        return;
      }

      if (cancelled) return;
      const scanner = new Cls(divId);
      scannerRef.current = scanner;
      setStatus("STARTING");

      try {
        await scanner.start(
          { facingMode: { exact: "environment" } },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (value) => { setStatus("DECODED"); scanner.stop().catch(() => {}); onScan(value); },
          () => {},
        );
        if (!cancelled) setStatus("RUNNING");
      } catch {
        try {
          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (value) => { setStatus("DECODED"); scanner.stop().catch(() => {}); onScan(value); },
            () => {},
          );
          if (!cancelled) setStatus("RUNNING");
        } catch (e) {
          if (!cancelled) setStatus("ERROR: " + (e?.message || "Camera unavailable"));
        }
      }
    };

    start();
    return () => {
      cancelled = true;
      if (scannerRef.current) scannerRef.current.stop().catch(() => {});
    };
  }, [onScan]);

  return (
    <div>
      <div id={divId} style={{ width: "100%", borderRadius: 10, overflow: "hidden" }} />
      <p style={{ textAlign: "center", fontSize: 11, color: "#6b6b8a", marginTop: 8 }}>
        {status === "RUNNING" ? "Point camera at student QR code" : status}
      </p>
    </div>
  );
}

// ─── Tier Card ────────────────────────────────────────────────────────────────
function TierCard({ tier, onGive, working }) {
  const colors = TIER_COLORS[tier.key] || TIER_COLORS.STICKER;
  const disabled = !tier.eligible || tier.already_redeemed || working;

  let statusText, statusColor;
  if (tier.already_redeemed) { statusText = "ALREADY REDEEMED"; statusColor = "#6b6b8a"; }
  else if (!tier.eligible)   { statusText = `NEED ${tier.threshold} COINS`; statusColor = "#f5b04c"; }
  else                       { statusText = "ELIGIBLE"; statusColor = "#40d4c4"; }

  return (
    <div style={{
      background: tier.eligible && !tier.already_redeemed ? colors.bg : "rgba(255,255,255,0.02)",
      border: `1px solid ${tier.eligible && !tier.already_redeemed ? colors.border : "rgba(255,255,255,0.08)"}`,
      borderRadius: 12, padding: "16px 18px", marginBottom: 10,
      opacity: tier.already_redeemed ? 0.55 : 1,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
            padding: "2px 8px", borderRadius: 999,
            background: colors.badge + "22", color: colors.badge, border: `1px solid ${colors.badge}55`,
          }}>{tier.label.toUpperCase()}</span>
          <span style={{ fontSize: 10, color: statusColor, fontWeight: 600, letterSpacing: "0.1em" }}>
            {statusText}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "#a0a0c0" }}>
          {tier.threshold.toLocaleString()} coins required
        </div>
      </div>
      <button
        onClick={() => onGive(tier)}
        disabled={disabled}
        style={{
          ...S.btnSm,
          background: !disabled ? colors.badge : "rgba(255,255,255,0.04)",
          borderColor: !disabled ? colors.badge : "rgba(255,255,255,0.08)",
          color: !disabled ? "#0d0d14" : "#6b6b8a",
          fontWeight: 700, whiteSpace: "nowrap",
          opacity: working ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {tier.already_redeemed ? "Done" : "Give Reward"}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RedemptionBooth() {
  // Auth
  const [loggedIn, setLoggedIn] = useState(!!token.getAdmin());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authErr, setAuthErr]   = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Scan / lookup
  const [scanMode, setScanMode]       = useState("scan"); // "scan" | "manual"
  const [manualId, setManualId]       = useState("");
  const [scanKey, setScanKey]         = useState(0); // re-mount scanner on reset

  // Student data
  const [studentData, setStudentData] = useState(null); // { student, balance, tiers }
  const [lookupErr, setLookupErr]     = useState("");
  const [looking, setLooking]         = useState(false);

  // Award
  const [working, setWorking]         = useState(false);
  const [awardMsg, setAwardMsg]       = useState(null); // { ok, text }

  // History
  const [history, setHistory]         = useState([]);

  const loadHistory = useCallback(async () => {
    try { setHistory(await redemptionApi.history()); } catch {}
  }, []);

  useEffect(() => { if (loggedIn) loadHistory(); }, [loggedIn, loadHistory]);

  // ── Login ──
  const login = async (e) => {
    e.preventDefault();
    setAuthErr(""); setAuthLoading(true);
    try {
      const res = await adminAuth.login({ username, password });
      token.setAdmin(res.access_token);
      setLoggedIn(true);
    } catch (err) {
      setAuthErr(err.message || "Login failed");
    } finally { setAuthLoading(false); }
  };

  // ── Lookup student ──
  const lookupStudent = useCallback(async (id) => {
    const clean = id.trim();
    if (!UUID_RE.test(clean)) {
      setLookupErr("Invalid QR — not a student UUID."); return;
    }
    setLookupErr(""); setLooking(true); setStudentData(null); setAwardMsg(null);
    try {
      const data = await redemptionApi.getStudent(clean);
      setStudentData(data);
    } catch (err) {
      setLookupErr(err.message || "Student not found");
    } finally { setLooking(false); }
  }, []);

  const onScan = useCallback((value) => { lookupStudent(value); }, [lookupStudent]);

  // ── Give reward ──
  const giveReward = async (tier) => {
    if (!window.confirm(`Give ${tier.label} to ${studentData.student.name}?\n\nThis will deduct ${tier.threshold} coins.`)) return;
    setWorking(true); setAwardMsg(null);
    try {
      const res = await redemptionApi.award(studentData.student.id, tier.key, uuidv4());
      setAwardMsg({ ok: true, text: `✓ ${res.tier_label} given! ${res.coins_deducted} coins deducted. New balance: ${res.new_balance}` });
      // Refresh student data
      const updated = await redemptionApi.getStudent(studentData.student.id);
      setStudentData(updated);
      loadHistory();
    } catch (err) {
      setAwardMsg({ ok: false, text: err.message || "Failed to award reward" });
    } finally { setWorking(false); }
  };

  const reset = () => {
    setStudentData(null); setLookupErr(""); setAwardMsg(null);
    setScanKey(k => k + 1); setScanMode("scan"); setManualId("");
  };

  // ── Login screen ──
  if (!loggedIn) {
    return (
      <div style={S.page}>
        <div style={S.topbar}>
          <span style={S.brand}>ASCENT — REDEMPTION BOOTH</span>
        </div>
        <div style={S.wrap}>
          <div style={S.card}>
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700 }}>Volunteer Login</h2>
            {authErr && <div style={S.err}>{authErr}</div>}
            <form onSubmit={login}>
              <label style={S.label}>USERNAME</label>
              <input style={{ ...S.input, marginBottom: 12 }} value={username}
                onChange={e => setUsername(e.target.value)} required autoComplete="username" />
              <label style={S.label}>PASSWORD</label>
              <input style={{ ...S.input, marginBottom: 20 }} type="password" value={password}
                onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
              <button style={S.btnPrimary} type="submit" disabled={authLoading}>
                {authLoading ? "Signing in…" : "SIGN IN"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Main booth ──
  return (
    <div style={S.page}>
      <div style={S.topbar}>
        <span style={S.brand}>ASCENT — REDEMPTION BOOTH</span>
        <button style={S.btnSm} onClick={() => { token.clearAdmin(); setLoggedIn(false); setStudentData(null); }}>
          Logout
        </button>
      </div>

      <div style={S.wrap}>

        {/* ── Step 1: Scan or Manual ── */}
        {!studentData && (
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {scanMode === "scan" ? "Scan Student QR" : "Enter Student ID"}
              </span>
              <button style={S.btnSm} onClick={() => { setScanMode(m => m === "scan" ? "manual" : "scan"); setLookupErr(""); }}>
                {scanMode === "scan" ? "Manual Entry" : "Use Scanner"}
              </button>
            </div>

            {lookupErr && <div style={S.err}>{lookupErr}</div>}
            {looking && <p style={{ textAlign: "center", color: "#6b6b8a", fontSize: 13 }}>Looking up student…</p>}

            {scanMode === "scan" ? (
              <QRScanner key={scanKey} onScan={onScan} />
            ) : (
              <div>
                <label style={S.label}>STUDENT UUID</label>
                <input
                  style={{ ...S.input, marginBottom: 12 }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={manualId}
                  onChange={e => setManualId(e.target.value)}
                />
                <button style={S.btnPrimary} onClick={() => lookupStudent(manualId)} disabled={looking}>
                  LOOK UP
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Student card + tiers ── */}
        {studentData && (
          <>
            {/* Student header */}
            <div style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{studentData.student.name}</div>
                <div style={{ fontSize: 12, color: "#6b6b8a" }}>@{studentData.student.username}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#7f77dd" }}>
                  {studentData.balance.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: "#6b6b8a", letterSpacing: "0.12em" }}>ASCENT COINS</div>
                <button style={{ ...S.btnSm, marginTop: 10, fontSize: 11 }} onClick={reset}>
                  Scan Another
                </button>
              </div>
            </div>

            {/* Award result message */}
            {awardMsg && (
              <div style={awardMsg.ok ? S.ok : S.err}>{awardMsg.text}</div>
            )}

            {/* Tier cards */}
            <div style={{ ...S.card }}>
              <span style={{ ...S.label }}>REWARD TIERS</span>
              {studentData.tiers.map(tier => (
                <TierCard key={tier.key} tier={tier} onGive={giveReward} working={working} />
              ))}
            </div>
          </>
        )}

        {/* ── Recent Redemptions ── */}
        {history.length > 0 && (
          <div style={S.card}>
            <span style={S.label}>THIS SESSION — RECENT REDEMPTIONS</span>
            {history.slice(0, 10).map(h => (
              <div key={h.id} style={{
                display: "flex", justifyContent: "space-between",
                padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)",
                fontSize: 13,
              }}>
                <span style={{ color: "#a0a0c0" }}>{h.tier.replace("_", " ")}</span>
                <span style={{ color: "#6b6b8a", fontSize: 11 }}>
                  {new Date(h.claimed_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
