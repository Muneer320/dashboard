// Ascent Merch — UPI Payment Modal (2 steps)
import React, { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useMobile } from "./shared";
import {
  generateUPILink,
  copyToClipboard,
  formatTimer,
  buildFormURL,
  UPI_ID,
} from "../utils/payment";

const TIMER_SECONDS = 300;

const TERMS = [
  "Availability is restricted exclusively to SST students due to high demand.",
  "All sales are final — no refunds or exchanges after payment.",
  "Management reserves the right to cancel suspicious or duplicate orders. In case of cancellation due to management constraints, a refund will be initiated.",
  "Email confirmation will be sent within 12 hours after payment verification.",
  "Items must be collected from the front desk reception from 22nd May onwards. We are not responsible for delivery of items. Failure to collect will not entitle you to a refund.",
  "Email confirmation mail with QR is mandatory to collect your merchandise from the front desk reception.",
  "Prices shown are inclusive of all taxes and printing charges.",
  "QR code expires after 5 minutes — refresh and retry if it times out.",
];

// ── Shared checkbox ────────────────────────────────────────────
function Checkbox({ checked, onChange, label }) {
  return (
    <label
      style={{
        display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
        padding: "10px 14px",
        background: checked ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${checked ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 8, transition: "all 0.2s",
      }}
    >
      <div
        style={{
          width: 18, height: 18, borderRadius: 4,
          border: `2px solid ${checked ? "var(--violet)" : "rgba(255,255,255,0.2)"}`,
          background: checked ? "var(--violet)" : "transparent",
          display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1, transition: "all 0.2s",
        }}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ display: "none" }} />
      <span style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.5 }}>{label}</span>
    </label>
  );
}

// ── Navigation-away warning (step 2 back/nav attempt) ─────────
function NavWarningPopup({ onStay, onLeave }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <div style={{ background: "rgba(20,12,30,0.99)", border: "1px solid rgba(251,191,36,0.4)", borderRadius: 18, padding: "28px 24px", maxWidth: 310, width: "90%", textAlign: "center", boxShadow: "0 28px 70px rgba(0,0,0,0.85)" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(251,191,36,0.1)", border: "1.5px solid rgba(251,191,36,0.35)", display: "grid", placeItems: "center", margin: "0 auto 14px", fontSize: 22 }}>💳</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>Already Paid?</div>
        <div style={{ fontSize: 12, color: "var(--ink-dim)", lineHeight: 1.65, marginBottom: 22 }}>
          If you've already made the payment, please fill the verification form before leaving so your order gets confirmed.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onLeave}
            style={{ flex: 1, padding: "10px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--ink-dim)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            Leave Anyway
          </button>
          <button
            onClick={onStay}
            style={{ flex: 2, padding: "10px", borderRadius: 10, background: "linear-gradient(135deg, #22c55e, #4ade80)", border: "none", color: "#052e16", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Stay &amp; Fill Form
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step dots (2 steps) ────────────────────────────────────────
function StepDots({ step }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 22 }}>
      {[1, 2].map((n) => (
        <div
          key={n}
          style={{
            width: n === step ? 20 : 6, height: 6, borderRadius: 999,
            background: n === step ? "var(--violet)" : n < step ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
            transition: "all 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

// ── Step 1: Cart summary + T&C ─────────────────────────────────
function StepConfirm({ cartItems, totalAmount, onNext, onClose }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div>
      <StepDots step={1} />

      {/* Cart items */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        {cartItems.map((item, i) => (
          <div
            key={item.id}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: i < cartItems.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
          >
            <img src={item.image} alt={item.name} style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 6, background: "#0a0a10", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: "var(--ink-dim)", fontFamily: "var(--f-mono)" }}>₹{item.price} × {item.quantity}</div>
              {item.size && (
                <div style={{ fontSize: 10, color: "var(--teal)", fontFamily: "var(--f-mono)", marginTop: 2 }}>
                  Size: {item.size}{item.printName?.trim() ? ` · Print: "${item.printName.trim()}"` : ""}
                </div>
              )}
            </div>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 14, fontWeight: 700, color: "var(--ink)", flexShrink: 0 }}>₹{item.price * item.quantity}</div>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(139,92,246,0.08)", borderTop: "1px solid rgba(139,92,246,0.2)" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--f-mono)", letterSpacing: "0.04em" }}>TOTAL</span>
          <span style={{ fontFamily: "var(--f-mono)", fontSize: 18, fontWeight: 700, color: "var(--violet)" }}>₹{totalAmount}</span>
        </div>
      </div>

      {/* T&C */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--ink-dim)", textTransform: "uppercase", fontFamily: "var(--f-mono)", marginBottom: 6 }}>Terms & Conditions</div>
        <div style={{ height: 130, overflowY: "auto", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {TERMS.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "grid", placeItems: "center", flexShrink: 0, fontSize: 8, color: "var(--ink-dim)", marginTop: 2 }}>{i + 1}</span>
              <span style={{ fontSize: 11.5, color: "var(--ink-dim)", lineHeight: 1.55 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} label="I have read and agree to the Terms & Conditions" />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} className="btn ghost" style={{ flex: 1 }}>Cancel</button>
        <button onClick={onNext} disabled={!agreed} className="btn primary" style={{ flex: 2, opacity: agreed ? 1 : 0.4, cursor: agreed ? "pointer" : "not-allowed" }}>
          Proceed to Payment →
        </button>
      </div>
    </div>
  );
}

// ── Form not filled warning popup ─────────────────────────────
function WarningPopup({ onClose }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        style={{ background: "rgba(20,12,30,0.99)", border: "1px solid rgba(239,68,68,0.45)", borderRadius: 18, padding: "28px 24px", maxWidth: 300, width: "88%", textAlign: "center", boxShadow: "0 28px 70px rgba(0,0,0,0.85)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(239,68,68,0.12)", border: "1.5px solid rgba(239,68,68,0.35)", display: "grid", placeItems: "center", margin: "0 auto 14px", fontSize: 22 }}>⚠</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f87171", marginBottom: 8 }}>Form Not Submitted</div>
        <div style={{ fontSize: 12, color: "var(--ink-dim)", lineHeight: 1.65, marginBottom: 22 }}>
          Please open the verification form, enter your UPI Transaction ID, and check the confirmation box before placing your order.
        </div>
        <button
          onClick={onClose}
          style={{ width: "100%", padding: "10px", borderRadius: 10, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "0.02em" }}
        >
          OK, I'll fill the form
        </button>
      </div>
    </div>
  );
}

// ── Step 2: QR + Verify (combined, scrollable) ─────────────────
function StepPayAndVerify({ cartItems, totalAmount, buyerName, buyerEmail, orderId, onClose }) {
  const isMobile = useMobile();
  const upiLink = generateUPILink(totalAmount, cartItems);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS);
  const [copied, setCopied] = useState(false);
  const [expired, setExpired] = useState(false);
  const [formOpened, setFormOpened] = useState(false);
  const [userReturned, setUserReturned] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) { setExpired(true); return; }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  // Detect when user returns to this tab after opening the form
  useEffect(() => {
    if (!formOpened || userReturned) return;
    const check = () => { if (!document.hidden) setUserReturned(true); };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [formOpened, userReturned]);

  const handleCopy = async () => {
    await copyToClipboard(UPI_ID);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = () => { setSecondsLeft(TIMER_SECONDS); setExpired(false); };

  const openForm = () => {
    window.open(buildFormURL(cartItems, totalAmount, buyerName, buyerEmail, orderId), "_blank", "noopener,noreferrer");
    setFormOpened(true);
  };

  const handleDone = () => {
    if (!confirmed) { setShowWarning(true); return; }
    onClose();
  };

  const timerColor = secondsLeft <= 60 ? "#f87171" : secondsLeft <= 120 ? "#fbbf24" : "#4ade80";

  const productSummary = cartItems
    .map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name))
    .join(", ");

  return (
    <div>
      {showWarning && <WarningPopup onClose={() => setShowWarning(false)} />}
      <StepDots step={2} />

      {/* Amount + timer */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 6 }}>
          Total payable: <strong style={{ color: "var(--ink)", fontSize: 15 }}>₹{totalAmount}</strong>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, background: `${timerColor}18`, border: `1px solid ${timerColor}40`, fontFamily: "var(--f-mono)", fontSize: 13, color: timerColor, fontWeight: 700 }}>
          <span style={{ fontSize: 10 }}>⏱</span>
          {expired ? "EXPIRED" : formatTimer(secondsLeft)}
        </div>
      </div>

      {/* QR */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <div style={{ padding: 14, background: expired ? "rgba(255,255,255,0.04)" : "#fff", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", position: "relative", opacity: expired ? 0.3 : 1, transition: "opacity 0.3s" }}>
          <QRCodeSVG value={upiLink} size={isMobile ? 160 : 180} bgColor="#ffffff" fgColor="#0a0a10" level="M" />
          {expired && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.65)", borderRadius: 14 }}>
              <span style={{ color: "#f87171", fontFamily: "var(--f-mono)", fontSize: 12, fontWeight: 700 }}>QR EXPIRED</span>
            </div>
          )}
        </div>
      </div>

      {/* Red notice beneath QR */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", marginBottom: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 10 }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
        <span style={{ fontSize: 12, color: "#f87171", fontWeight: 600, lineHeight: 1.5 }}>
          After payment, you <strong>must</strong> fill the verification form below — your order will not be confirmed without it.
        </span>
      </div>

      {expired ? (
        <button onClick={handleRefresh} className="btn primary" style={{ width: "100%", marginBottom: 12 }}>Refresh QR</button>
      ) : (
        <>
          {/* UPI ID */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "var(--ink-dim)", fontFamily: "var(--f-mono)", letterSpacing: "0.06em", marginBottom: 2 }}>UPI ID</div>
              <div style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--ink)", fontWeight: 600 }}>{UPI_ID}</div>
            </div>
            <button onClick={handleCopy} style={{ padding: "6px 12px", borderRadius: 8, background: copied ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.07)", border: `1px solid ${copied ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.1)"}`, color: copied ? "#4ade80" : "var(--ink)", fontSize: 11, fontFamily: "var(--f-mono)", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>
              {copied ? "✓ COPIED" : "COPY"}
            </button>
          </div>
          <a href={upiLink} style={{ display: "block", textAlign: "center", padding: "9px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: "var(--ink-dim)", marginBottom: 16, textDecoration: "none" }}>
            Open in UPI app ↗
          </a>
        </>
      )}

      {/* ── Divider ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
        <span style={{ fontSize: 10, fontFamily: "var(--f-mono)", color: "var(--ink-dim)", letterSpacing: "0.1em" }}>AFTER PAYMENT</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
      </div>

      {/* ── Submit Transaction ID ── */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Submit Transaction ID</div>
      <div style={{ fontSize: 12, color: "var(--ink-dim)", lineHeight: 1.6, marginBottom: 14 }}>
        Open the form below after paying.
      </div>

      {/* Pre-fill preview */}
      <div style={{ padding: "10px 14px", background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontFamily: "var(--f-mono)", color: "var(--violet)", letterSpacing: "0.08em", marginBottom: 8 }}>PRE-FILLED FOR YOU</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, lineHeight: 1.6 }}>
          {[
            ["Order ID", orderId],
            ["Name",     buyerName],
            ["Email",    buyerEmail],
            ["Items",    productSummary],
            ["Amount",   `₹${totalAmount}`],
            ["Date",     new Date().toLocaleDateString("en-IN")],
          ].map(([label, value]) => (
            <div key={label}>
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>{label}:</span>{" "}
              <span style={{ color: "var(--ink-dim)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* What to fill */}
      <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontFamily: "var(--f-mono)", color: "var(--ink-dim)", letterSpacing: "0.06em", marginBottom: 8 }}>YOU NEED TO FILL IN</div>
        {[
          { text: "UPI Transaction ID", required: true },
          { text: "Payment Screenshot", required: true },
        ].map(({ text, required }) => (
          <div key={text} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink)", marginBottom: 4 }}>
            <span style={{ color: "var(--teal)", fontSize: 9 }}>▸</span>
            {text}
            {required && <span style={{ fontSize: 10, color: "#f87171", fontFamily: "var(--f-mono)", fontWeight: 700 }}>required</span>}
          </div>
        ))}
      </div>

      <button
        onClick={openForm}
        style={{
          width: "100%", marginBottom: 12, padding: "14px",
          borderRadius: 12, border: "none", cursor: "pointer",
          background: "linear-gradient(135deg, #22c55e 0%, #4ade80 100%)",
          color: "#052e16", fontSize: 14, fontWeight: 700, letterSpacing: "0.03em",
          boxShadow: "0 0 16px rgba(74,222,128,0.25), 0 4px 12px rgba(34,197,94,0.2)",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 24px rgba(74,222,128,0.35), 0 6px 16px rgba(34,197,94,0.3)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 0 16px rgba(74,222,128,0.25), 0 4px 12px rgba(34,197,94,0.2)"; e.currentTarget.style.transform = "translateY(0)"; }}
      >
        {formOpened ? "Open Form Again ↗" : "Open Verification Form ↗"}
      </button>

      {/* State 1: form not yet opened */}
      {!formOpened && (
        <div style={{ textAlign: "center", fontSize: 11.5, color: "#fbbf24", marginBottom: 12, padding: "8px 12px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 8 }}>
          ⚠ Submit the form after paying to confirm your order.
        </div>
      )}

      {/* State 2: form opened, user hasn't switched back yet */}
      {formOpened && !userReturned && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--teal)", marginBottom: 12, padding: "10px 14px", background: "rgba(45,212,191,0.06)", border: "1px solid rgba(45,212,191,0.18)", borderRadius: 8 }}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>📋</span>
          <span>Fill in the form in the new tab, then come back here to confirm.</span>
        </div>
      )}

      {/* State 3: user returned — show confirmation checkbox */}
      {userReturned && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#4ade80", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--f-mono)" }}>
            <span>✓</span> You're back — confirm below to place your order.
          </div>
          <Checkbox
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            label="I confirm I have submitted the verification form with my UPI Transaction ID"
          />
        </div>
      )}

      <button
        onClick={handleDone}
        className={confirmed ? "btn primary" : "btn ghost"}
        style={{ width: "100%" }}
      >
        {confirmed ? "Done — Order Placed ✓" : "Done — Order Placed ✓"}
      </button>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────
export default function PaymentModal({ cartItems, totalAmount, buyerName, buyerEmail, orderId, onClose }) {
  const [step, setStep] = useState(1);
  const [showNavWarning, setShowNavWarning] = useState(false);
  const isMobile = useMobile();
  const leavingRef = useRef(false); // prevents double history.go on intentional leave

  // Push a sentinel history entry on step 2 so the back button hits it first.
  // Works with BrowserRouter (unlike useBlocker which needs a data router).
  useEffect(() => {
    if (step !== 2) return;
    window.history.pushState({ ascentPayModal: true }, "");

    const handlePop = () => {
      if (leavingRef.current) return; // intentional leave — let it through
      setShowNavWarning(true);
      window.history.pushState({ ascentPayModal: true }, ""); // re-trap
    };
    const handleUnload = (e) => { e.preventDefault(); e.returnValue = ""; };

    window.addEventListener("popstate", handlePop);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("popstate", handlePop);
      window.removeEventListener("beforeunload", handleUnload);
      if (!leavingRef.current) window.history.go(-1); // clean up sentinel on normal close
    };
  }, [step]);

  const handleNavLeave = useCallback(() => {
    leavingRef.current = true;
    setShowNavWarning(false);
    window.history.go(-1); // pop our sentinel
    onClose();
  }, [onClose]);

  const handleBackdrop = useCallback(
    (e) => { if (e.target === e.currentTarget && step === 1) onClose(); },
    [onClose, step]
  );

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && step === 1) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, step]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const LABELS = {
    1: ["Order Summary", "Confirm your order"],
    2: ["Scan & Pay", "Pay · then submit transaction ID"],
  };

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: isMobile ? "16px" : "24px",
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 440, maxHeight: "92vh", overflowY: "auto",
          background: "rgba(14,14,22,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          padding: isMobile ? "22px 18px" : "26px 26px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 10, letterSpacing: "0.1em", color: "var(--ink-dim)", textTransform: "uppercase", marginBottom: 2 }}>
              {LABELS[step][0]}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>
              {LABELS[step][1]}
            </div>
          </div>
          {/* X only on step 1 — step 2 requires form confirmation to close */}
          {step === 1 && (
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--ink-dim)", fontSize: 14, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>
              ✕
            </button>
          )}
        </div>

        {step === 1 && <StepConfirm cartItems={cartItems} totalAmount={totalAmount} onNext={() => setStep(2)} onClose={onClose} />}
        {step === 2 && <StepPayAndVerify cartItems={cartItems} totalAmount={totalAmount} buyerName={buyerName} buyerEmail={buyerEmail} orderId={orderId} onClose={onClose} />}
      </div>

      {showNavWarning && (
        <NavWarningPopup
          onStay={() => setShowNavWarning(false)}
          onLeave={handleNavLeave}
        />
      )}
    </div>
  );
}
