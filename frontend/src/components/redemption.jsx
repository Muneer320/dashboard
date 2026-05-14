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

const TIER_COLORS = {
  BADGE_STICKER: { bg: "rgba(127,119,221,0.10)", border: "rgba(127,119,221,0.35)", badge: "#7f77dd" },
  NOTEBOOK_MUG:  { bg: "rgba(64,212,196,0.10)",  border: "rgba(64,212,196,0.35)",  badge: "#40d4c4" },
  TOTE_BAG:      { bg: "rgba(245,176,76,0.10)",  border: "rgba(245,176,76,0.35)",  badge: "#f5b04c" },
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
  const startedRef = useRef(false); // true only after scanner.start() resolves
  const [status, setStatus] = useState("LOADING");

  const safeStop = (scanner) => {
    if (!scanner || !startedRef.current) return;
    startedRef.current = false;
    try { scanner.stop().catch(() => {}); } catch {}
  };

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

      const onDecode = (value) => {
        setStatus("DECODED");
        safeStop(scanner);
        onScan(value);
      };

      try {
        await scanner.start(
          { facingMode: { exact: "environment" } },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          onDecode, () => {},
        );
        if (!cancelled) { startedRef.current = true; setStatus("RUNNING"); }
      } catch {
        try {
          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            onDecode, () => {},
          );
          if (!cancelled) { startedRef.current = true; setStatus("RUNNING"); }
        } catch (e) {
          if (!cancelled) setStatus("ERROR: " + (e?.message || "Camera unavailable"));
        }
      }
    };

    start();
    return () => {
      cancelled = true;
      safeStop(scannerRef.current);
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

// ─── Cart Item Card (pending reservation) ────────────────────────────────────
function CartItemCard({ item, onGive, working, justGiven }) {
  const colors = TIER_COLORS[item.tier] || TIER_COLORS.BADGE_STICKER;

  return (
    <div style={{
      background: justGiven ? "rgba(29,158,117,0.08)" : colors.bg,
      border: `1px solid ${justGiven ? "rgba(29,158,117,0.4)" : colors.border}`,
      borderRadius: 12, padding: "16px 18px", marginBottom: 10,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      opacity: justGiven ? 0.7 : 1,
      transition: "all 0.2s",
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
            padding: "2px 8px", borderRadius: 999,
            background: colors.badge + "22", color: colors.badge,
            border: `1px solid ${colors.badge}55`,
          }}>{item.label.toUpperCase()}</span>
          {justGiven && (
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: "0.1em",
              color: "#40d4c4",
            }}>
              ✓ GIVEN
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onGive(item)}
        disabled={justGiven || working}
        style={{
          ...S.btnSm,
          background: justGiven ? "rgba(255,255,255,0.04)" : colors.badge,
          borderColor: justGiven ? "rgba(255,255,255,0.08)" : colors.badge,
          color: justGiven ? "#6b6b8a" : "#0d0d14",
          fontWeight: 700, whiteSpace: "nowrap",
          opacity: working && !justGiven ? 0.6 : 1,
          cursor: justGiven || working ? "not-allowed" : "pointer",
        }}
      >
        {justGiven ? "Given ✓" : "Hand Over"}
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]     = useState(false);
  const [scanKey, setScanKey]         = useState(0); // re-mount scanner on reset

  // Student data
  const [studentData, setStudentData] = useState(null); // { student, balance, cart, claimed }
  const [lookupErr, setLookupErr]     = useState("");
  const [looking, setLooking]         = useState(false);

  // Award — tracks which reservation_ids were just given this session
  const [working, setWorking]         = useState(false);
  const [givenIds, setGivenIds]       = useState(new Set());
  const [awardMsg, setAwardMsg]       = useState(null); // { ok, text }

  // History
  const [history, setHistory]         = useState([]);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await redemptionApi.history());
    } catch (err) {
      if (err?.status === 401) {
        token.clearAdmin();
        setLoggedIn(false);
      }
    }
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
      if (err?.status === 401) { token.clearAdmin(); setLoggedIn(false); return; }
      setLookupErr(err.message || "Student not found");
    } finally { setLooking(false); }
  }, []);

  const onScan = useCallback((value) => { lookupStudent(value); }, [lookupStudent]);

  // ── Debounced name search ──
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await redemptionApi.searchStudents(q);
        setSearchResults(res || []);
      } catch (err) {
        if (err?.status === 401) { token.clearAdmin(); setLoggedIn(false); return; }
        setSearchResults([]);
      } finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Hand over reward ──
  const giveReward = async (item) => {
    if (!window.confirm(`Hand over ${item.label} to ${studentData.student.name}?\n\nCoins were already deducted when they locked their cart.`)) return;
    setWorking(true); setAwardMsg(null);
    try {
      const res = await redemptionApi.award(item.reservation_id);
      setGivenIds(prev => new Set([...prev, item.reservation_id]));
      setAwardMsg({ ok: true, text: `✓ ${res.tier_label} handed over to ${studentData.student.name}.` });
      loadHistory();
    } catch (err) {
      setAwardMsg({ ok: false, text: err.message || "Failed to record handout" });
    } finally { setWorking(false); }
  };

  const reset = () => {
    setStudentData(null); setLookupErr(""); setAwardMsg(null);
    setGivenIds(new Set());
    setScanKey(k => k + 1); setScanMode("scan"); setManualId("");
    setSearchQuery(""); setSearchResults([]);
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
                {scanMode === "scan" ? "Scan Student QR" : "Search Student"}
              </span>
              <button style={S.btnSm} onClick={() => {
                setScanMode(m => m === "scan" ? "manual" : "scan");
                setLookupErr(""); setSearchQuery(""); setSearchResults([]);
              }}>
                {scanMode === "scan" ? "Manual Entry" : "Use Scanner"}
              </button>
            </div>

            {lookupErr && <div style={S.err}>{lookupErr}</div>}
            {looking && <p style={{ textAlign: "center", color: "#6b6b8a", fontSize: 13 }}>Looking up student…</p>}

            {scanMode === "scan" ? (
              <QRScanner key={scanKey} onScan={onScan} />
            ) : (
              <div>
                <label style={S.label}>STUDENT NAME OR EMAIL</label>
                <input
                  style={{ ...S.input, marginBottom: 12 }}
                  placeholder="Start typing a name or email…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {searching && (
                  <p style={{ fontSize: 12, color: "#6b6b8a", margin: "0 0 8px" }}>Searching…</p>
                )}
                {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
                  <p style={{ fontSize: 12, color: "#6b6b8a", margin: "0 0 8px" }}>No matches.</p>
                )}
                {searchResults.length > 0 && (
                  <div style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    overflow: "hidden",
                    marginBottom: 8,
                  }}>
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => lookupStudent(r.id)}
                        style={{
                          width: "100%", textAlign: "left",
                          padding: "10px 12px",
                          background: "transparent",
                          border: "none",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          color: "var(--ink)",
                          cursor: "pointer",
                          display: "flex", justifyContent: "space-between", gap: 8,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(127,119,221,0.10)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <span style={{ fontSize: 13 }}>{r.name || "(no name)"}</span>
                        <span style={{ fontSize: 11, color: "#6b6b8a" }}>{r.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Student card + cart ── */}
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

            {/* Handout result message */}
            {awardMsg && (
              <div style={awardMsg.ok ? S.ok : S.err}>{awardMsg.text}</div>
            )}

            {/* Pending cart items */}
            <div style={{ ...S.card }}>
              <span style={{ ...S.label }}>RESERVED REWARDS — CART</span>
              {studentData.cart.length === 0 ? (
                <div style={{
                  padding: "18px 0", textAlign: "center",
                  fontSize: 13, color: "#6b6b8a", lineHeight: 1.6,
                }}>
                  No rewards in cart.<br />
                  <span style={{ fontSize: 11 }}>Student hasn't locked any rewards yet.</span>
                </div>
              ) : (
                studentData.cart.map(item => (
                  <CartItemCard
                    key={item.reservation_id}
                    item={item}
                    onGive={giveReward}
                    working={working}
                    justGiven={givenIds.has(item.reservation_id)}
                  />
                ))
              )}
            </div>

            {/* Already claimed this session / previously */}
            {studentData.claimed.length > 0 && (
              <div style={{ ...S.card }}>
                <span style={{ ...S.label }}>ALREADY GIVEN</span>
                {studentData.claimed.map((c, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)",
                    fontSize: 13,
                  }}>
                    <span style={{ color: "#6b6b8a" }}>{c.label}</span>
                    <span style={{ color: "#40d4c4", fontSize: 11 }}>✓ given</span>
                  </div>
                ))}
              </div>
            )}
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
