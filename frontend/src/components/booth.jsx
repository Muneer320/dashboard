// Booth Tool — mobile-first awarding flow for booth_volunteer accounts.
//
// Login → student lookup (manual fallback if QR scanner isn't available
// in this iteration) → confirm award → success state with 60s greyout.
// Failed network requests queue in IndexedDB and flush on reconnect via
// POST /api/v1/booth/sync.

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { adminAuth, boothApi, token, ApiError } from "../lib/api";
import { Html5Qrcode } from "html5-qrcode";

// Match a v4-ish UUID; tolerant of upper/lower case. Booth QR encodes the
// student's full UUID; legacy "ASCENT-XXXXXXXX" labels won't match and the
// volunteer will be told to use manual search.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────────────────────────────────────────
// IndexedDB offline queue (simple key-value store)
// ─────────────────────────────────────────────────────────────
const DB_NAME = "booth_queue", STORE = "awards", DB_VER = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "client_uuid" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function queueAward(award) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(award);
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}

async function readAllQueued() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => rej(req.error);
  });
}

async function clearQueued(client_uuids) {
  if (!client_uuids?.length) return;
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    client_uuids.forEach((id) => store.delete(id));
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}

// ─────────────────────────────────────────────────────────────
// UUID v4 (crypto.randomUUID with fallback)
// ─────────────────────────────────────────────────────────────
function uuid() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function BoothTool() {
  const [tok, setTok] = useState(token.getAdmin());
  if (!tok) return <BoothLogin onLogin={() => setTok(token.getAdmin())} />;
  return <BoothMain onLogout={() => { token.clearAdmin(); setTok(null); }} />;
}

// ─── Login ──────────────────────────────────────────────────
function BoothLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setWorking(true); setError("");
    try {
      const res = await adminAuth.login({ username, password });
      token.setAdmin(res.access_token);
      const me = await adminAuth.me();
      if (me.role !== "booth_volunteer" && me.role !== "admin") {
        token.clearAdmin();
        setError("This account is not a booth volunteer.");
        return;
      }
      onLogin();
    } catch (e) {
      setError(e.message || "Login failed");
    } finally { setWorking(false); }
  };

  return (
    <Shell>
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 24,
      }}>
        <div className="display" style={{ fontSize: 32, color: "var(--ink)", letterSpacing: "-0.02em" }}>
          Booth <span style={{ color: "var(--violet)" }}>Tool</span>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6, letterSpacing: "0.18em" }}>
          ASCENT'26 · BOOTH VOLUNTEER
        </div>

        <form onSubmit={submit} className="glass-strong"
          style={{ width: "100%", maxWidth: 360, marginTop: 28, padding: 22 }}>
          <label className="label">USERNAME</label>
          <input className="input" value={username} required
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username" />
          <div style={{ height: 12 }} />
          <label className="label">PASSWORD</label>
          <input className="input" type="password" value={password} required
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" />
          {error && (
            <div style={{
              marginTop: 12, padding: "8px 12px", borderRadius: "var(--r-md)",
              background: "rgba(232,185,116,0.08)", color: "var(--amber)",
              border: "1px solid rgba(232,185,116,0.3)", fontSize: 12.5,
            }}>{error}</div>
          )}
          <button className="btn primary" type="submit" disabled={working}
            style={{ width: "100%", marginTop: 16, padding: "14px 22px" }}>
            {working ? "…" : "Sign in"}
          </button>
        </form>
      </div>
    </Shell>
  );
}

// ─── Main awarding flow ────────────────────────────────────
function BoothMain({ onLogout }) {
  const [me, setMe] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null); // student detail
  const [step, setStep] = useState("search"); // search | confirm | success
  const [searchMode, setSearchMode] = useState("scan"); // scan | manual
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [greyout, setGreyout] = useState(0);
  const [awards, setAwards] = useState([]);

  const loadAwards = useCallback(() => {
    boothApi.awards(true, 50).then(setAwards).catch(() => {});
  }, []);
  useEffect(() => { loadAwards(); }, [loadAwards]);
  useEffect(() => {
    const id = setInterval(loadAwards, 20000);
    return () => clearInterval(id);
  }, [loadAwards]);

  useEffect(() => {
    boothApi.me()
      .then(setMe)
      .catch(() => adminAuth.me().then(setMe).catch(() => onLogout()));
  }, [onLogout]);

  // Refresh queue count
  const refreshQueueCount = useCallback(async () => {
    const items = await readAllQueued();
    setPendingQueueCount(items.length);
  }, []);
  useEffect(() => { refreshQueueCount(); }, [refreshQueueCount]);

  // Online/offline tracking
  useEffect(() => {
    const onl = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", onl);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", onl);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Auto-sync queued awards when back online
  const syncQueue = useCallback(async () => {
    const items = await readAllQueued();
    if (items.length === 0) return;
    try {
      const res = await boothApi.sync(items.map((it) => ({
        student_id: it.student_id,
        client_uuid: it.client_uuid,
        awarded_at: it.awarded_at,
      })));
      const allClientUuids = items.map((i) => i.client_uuid);
      await clearQueued(allClientUuids);
      await refreshQueueCount();
      console.info("synced", res);
    } catch (e) {
      console.warn("sync failed, will retry", e);
    }
  }, [refreshQueueCount]);

  useEffect(() => {
    if (online) syncQueue();
  }, [online, syncQueue]);

  // Greyout timer
  useEffect(() => {
    if (greyout <= 0) return;
    const id = setInterval(() => setGreyout((g) => Math.max(0, g - 1)), 1000);
    return () => clearInterval(id);
  }, [greyout]);

  // Manual search — debounce via setTimeout inside the effect so the only
  // dependency is `searchQ`. Using a useCallback-based debounce here
  // re-creates its identity every render and produces an infinite refetch loop.
  useEffect(() => {
    const q = searchQ.trim();
    if (!q || q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      boothApi.search(q)
        .then((rs) => setSearchResults(rs || []))
        .catch((e) => setError(e.message))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ]);

  const pickStudent = async (id) => {
    setError(""); setSelected(null);
    try {
      const detail = await boothApi.student(id);
      setSelected(detail);
      setStep("confirm");
    } catch (e) { setError(e.message); }
  };

  const onScan = useCallback((decoded) => {
    const value = (decoded || "").trim();
    // Accept both the new full-UUID QR (My QR page) and the legacy
    // "ASCENT-XXXXXXXX" label from the dashboard QR. The backend resolves
    // the legacy form to a full UUID by prefix match.
    if (!UUID_RE.test(value) && !/^ASCENT-[0-9A-F]{8}$/i.test(value)) {
      setError("Not a recognised student QR. Ask the student to open My QR, or use manual search.");
      return;
    }
    pickStudent(value);
  }, []);

  const award = async () => {
    if (!selected) return;
    setError(""); setWorking(true);
    const client_uuid = uuid();
    try {
      const res = await boothApi.award(selected.id, client_uuid);
      setStep("success");
      setSelected({ ...selected, name: res.student_name || selected.name, last_award: res.coins_awarded });
      setGreyout(60);
      loadAwards();
    } catch (e) {
      // If network error, queue it
      const isNetwork = !(e instanceof ApiError) || e.status === 0 || e.status === 503;
      if (isNetwork) {
        await queueAward({
          client_uuid, student_id: selected.id,
          awarded_at: new Date().toISOString(),
        });
        await refreshQueueCount();
        setStep("success");
        setSelected({ ...selected, last_award: "QUEUED" });
        setGreyout(60);
      } else {
        setError(e.message);
      }
    } finally { setWorking(false); }
  };

  return (
    <Shell>
      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 5,
        padding: "14px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid var(--glass-border)",
        background: "rgba(13,13,18,0.75)",
        backdropFilter: "blur(18px)",
      }}>
        <div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.18em" }}>
            BOOTH · {me?.role === "admin" ? "ADMIN" : "VOLUNTEER"}
            {me?.booth_id && (
              <span style={{
                marginLeft: 8, padding: "2px 8px", borderRadius: 999,
                background: "rgba(127,119,221,0.15)", color: "var(--violet)",
                border: "1px solid rgba(127,119,221,0.4)", letterSpacing: "0.1em",
              }}>
                {me.booth_id}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 2 }}>{me?.username || "…"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {pendingQueueCount > 0 && (
            <span className="chip amber" style={{ fontSize: 9.5 }}>
              ↻ {pendingQueueCount} QUEUED
            </span>
          )}
          <span className="chip" style={{ fontSize: 9.5,
            color: online ? "var(--teal)" : "var(--amber)",
            borderColor: online ? "rgba(29,158,117,0.4)" : "rgba(232,185,116,0.4)",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: online ? "var(--teal)" : "var(--amber)",
              display: "inline-block", marginRight: 6,
            }} />
            {online ? "ONLINE" : "OFFLINE"}
          </span>
          <button onClick={onLogout} className="btn ghost sm" style={{ fontSize: 11 }}>Sign out</button>
        </div>
      </header>

      <div style={{ padding: 20, maxWidth: 720, margin: "0 auto" }}>
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: "var(--r-md)", marginBottom: 16,
            background: "rgba(232,185,116,0.08)", color: "var(--amber)",
            border: "1px solid rgba(232,185,116,0.3)", fontSize: 13,
          }}>{error}</div>
        )}

        {step === "search" && (
          <>
            <div className="eyebrow">§ FIND STUDENT</div>
            <h1 className="display" style={{ fontSize: 28, marginTop: 8, marginBottom: 18 }}>
              {searchMode === "scan" ? "Scan student QR." : "Search by name."}
            </h1>

            {searchMode === "scan" ? (
              <>
                <QRScanner onDecoded={onScan} onError={(m) => setError(m)} />
                <button
                  className="btn ghost"
                  onClick={() => { setError(""); setSearchMode("manual"); }}
                  style={{ marginTop: 14, width: "100%" }}
                >
                  Can't scan? Search by name instead
                </button>
              </>
            ) : (
              <>
                <input
                  className="input"
                  autoFocus
                  placeholder="Search by name or username…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  style={{ fontSize: 16, padding: "14px 18px" }}
                />

                <div style={{ marginTop: 16 }}>
                  {searching && <div style={{ color: "var(--ink-mute)", fontSize: 13 }}>Searching…</div>}
                  {!searching && searchQ.length >= 2 && searchResults.length === 0 && (
                    <div style={{ color: "var(--ink-mute)", fontSize: 13 }}>No students match.</div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {searchResults.map((r) => (
                      <button key={r.id} onClick={() => pickStudent(r.id)} className="glass"
                        style={{
                          textAlign: "left", padding: "14px 16px", border: "1px solid var(--glass-border)",
                          cursor: "pointer", color: "var(--ink)",
                        }}>
                        <div style={{ fontSize: 15 }}>{r.name}</div>
                        <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>
                          @{r.username}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="btn ghost"
                  onClick={() => { setError(""); setSearchQ(""); setSearchResults([]); setSearchMode("scan"); }}
                  style={{ marginTop: 16, width: "100%" }}
                >
                  Back to QR scanner
                </button>
              </>
            )}
          </>
        )}

        {step === "confirm" && selected && (
          <div className="glass-strong fade-up" style={{ padding: 22 }}>
            <div className="eyebrow">§ CONFIRM AWARD</div>
            <div className="display" style={{ fontSize: 26, marginTop: 10 }}>{selected.name}</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>
              ID {selected.id?.slice(0, 12)}…
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 14 }}>
              <Pill label="BALANCE" value={selected.balance ?? "—"} />
              {selected.already_awarded_this_booth && (
                <span className="chip amber">ALREADY AWARDED TODAY</span>
              )}
            </div>

            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="btn primary"
                disabled={selected.already_awarded_this_booth || working || greyout > 0}
                onClick={award}
                style={{ padding: "16px 24px", fontSize: 15 }}>
                {working ? "Awarding…" : greyout > 0 ? `Wait ${greyout}s` : "AWARD COINS"}
              </button>
              <button className="btn ghost" onClick={() => { setStep("search"); setSelected(null); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === "success" && selected && (
          <div className="glass-strong fade-up" style={{
            padding: 28, textAlign: "center",
            background: "linear-gradient(180deg, rgba(29,158,117,0.18), rgba(29,158,117,0.04))",
            borderColor: "rgba(29,158,117,0.4)",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "var(--teal)", color: "#062018",
              fontSize: 30, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto",
            }}>✓</div>
            <div style={{ fontSize: 22, marginTop: 16 }}>
              {selected.last_award === "QUEUED" ? "Saved offline" : `+${selected.last_award} coins`}
            </div>
            <div style={{ color: "var(--ink-dim)", fontSize: 14, marginTop: 6 }}>
              {selected.last_award === "QUEUED"
                ? `Will sync when reconnected (${pendingQueueCount} queued)`
                : `to ${selected.name}`}
            </div>
            <button className="btn primary"
              onClick={() => { setStep("search"); setSelected(null); setSearchQ(""); setSearchResults([]); }}
              style={{ marginTop: 22 }}>
              Award next
            </button>
            {greyout > 0 && (
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 12 }}>
                COOLDOWN {greyout}s
              </div>
            )}
          </div>
        )}

        {/* Recent awards by this volunteer at this booth (today) */}
        <div className="glass" style={{ marginTop: 28, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="eyebrow">§ TODAY'S AWARDS</div>
            <span className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>
              {awards.length} TOTAL
            </span>
          </div>
          {awards.length === 0 ? (
            <div style={{
              padding: 18, textAlign: "center",
              color: "var(--ink-mute)", fontSize: 12.5,
            }}>
              No awards from this booth yet today.
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              {awards.map((a) => (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 4px", borderBottom: "1px solid var(--glass-border)", gap: 12,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 13.5, color: "var(--ink)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {a.student_name || "—"}
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 2 }}>
                      @{a.student_username || a.student_id?.slice(0, 8)} ·{" "}
                      {new Date(a.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <span className="mono" style={{ color: "var(--teal)", fontSize: 14, fontWeight: 600 }}>
                    +{a.coins}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// QR scanner — html5-qrcode wrapping a back-camera live stream.
// Stops itself on first decode (parent decides what's next via onDecoded).
// Caller must remount or call start again to scan a second time.
// ─────────────────────────────────────────────────────────────
function QRScanner({ onDecoded, onError }) {
  const elementId = "booth-qr-reader";
  const scannerRef = useRef(null);
  const stoppedRef = useRef(false);
  // Hold the latest callbacks in refs so the effect can run once with [].
  // Inline parent callbacks change identity every render — using them
  // directly as deps would tear down + re-init the scanner on every
  // render, racing with start() and causing "Cannot stop" errors.
  const onDecodedRef = useRef(onDecoded);
  const onErrorRef = useRef(onError);
  useEffect(() => { onDecodedRef.current = onDecoded; }, [onDecoded]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const [status, setStatus] = useState("starting"); // starting | running | stopped | error
  const [errMsg, setErrMsg] = useState("");

  // Safely stop the scanner — html5-qrcode throws synchronously when the
  // scanner isn't running yet, so guard with the library's own state enum.
  const safeStop = (scanner) => {
    try {
      // Html5QrcodeScannerState: NOT_STARTED=1, SCANNING=2, PAUSED=3
      const state = scanner.getState?.();
      if (state === 2 /* SCANNING */ || state === 3 /* PAUSED */) {
        return scanner.stop().then(() => scanner.clear()).catch(() => {});
      }
    } catch { /* ignore */ }
    try { scanner.clear(); } catch { /* ignore */ }
    return Promise.resolve();
  };

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(elementId, /* verbose */ false);
    scannerRef.current = scanner;

    const start = async () => {
      try {
        const config = {
          fps: 10,
          qrbox: (vw, vh) => {
            const min = Math.min(vw, vh);
            const size = Math.floor(min * 0.7);
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
        };
        const onDecode = (decoded) => {
          if (stoppedRef.current) return;
          stoppedRef.current = true;
          safeStop(scanner);
          setStatus("stopped");
          onDecodedRef.current?.(decoded);
        };
        // Prefer rear camera on phones; fall back to whatever is available.
        try {
          await scanner.start(
            { facingMode: { exact: "environment" } },
            config, onDecode, () => {},
          );
        } catch {
          if (cancelled) return;
          await scanner.start(
            { facingMode: "environment" },
            config, onDecode, () => {},
          );
        }
        if (!cancelled) setStatus("running");
      } catch (e) {
        if (cancelled) return;
        const msg = (e && e.message) || "Camera unavailable";
        setStatus("error");
        setErrMsg(msg);
        onErrorRef.current?.(msg);
      }
    };
    start();

    return () => {
      cancelled = true;
      stoppedRef.current = true;
      const s = scannerRef.current;
      if (s) safeStop(s);
    };
  }, []); // run once — callbacks read from refs

  return (
    <div className="glass" style={{ padding: 12, borderRadius: "var(--r-md)" }}>
      <div
        id={elementId}
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          aspectRatio: "1 / 1",
          borderRadius: 10,
          overflow: "hidden",
          background: "rgba(0,0,0,0.6)",
        }}
      />
      <div className="mono" style={{
        textAlign: "center", marginTop: 10,
        fontSize: 11, letterSpacing: "0.18em",
        color: status === "error" ? "var(--amber)" : "var(--ink-mute)",
      }}>
        {status === "starting" && "STARTING CAMERA…"}
        {status === "running" && "POINT AT STUDENT QR"}
        {status === "stopped" && "DECODED"}
        {status === "error" && (errMsg || "CAMERA UNAVAILABLE")}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function Pill({ label, value }) {
  return (
    <div style={{
      padding: "10px 14px", borderRadius: "var(--r-md)",
      background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)",
    }}>
      <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-mute)", letterSpacing: "0.15em" }}>{label}</div>
      <div className="mono" style={{ fontSize: 16, color: "var(--ink)", marginTop: 2, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="bg-noise" style={{
      position: "relative", minHeight: "100vh", background: "var(--bg)", overflow: "hidden",
    }}>
      <div className="bg-glow-violet" style={{ top: -200, left: -200, zIndex: 0 }} />
      <div className="bg-glow-teal"   style={{ top: 220, right: -200, zIndex: 0 }} />
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  );
}

