// Ascent Merch — UPI Payment Modal (3 steps)
import React, { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useMobile } from "./shared";
import {
  generateUPILink,
  copyToClipboard,
  formatTimer,
  buildFormURL,
  UPI_ID,
} from "../utils/payment";

const TIMER_SECONDS = 300; // 5 minutes

const TERMS = [
  "All sales are final — no refunds or exchanges after payment.",
  "Email confirmation will be sent within 24–48 hours after payment verification.",
  "Items must be collected from the Ascent booth during fest hours only.",
  "Prices shown are inclusive of all taxes and printing charges.",
  "Customised items (T-Shirt with Name) are non-transferable.",
  "Management reserves the right to cancel suspicious or duplicate orders.",
  "QR code expires after 5 minutes — refresh and retry if it times out.",
];

// ── Step indicators ────────────────────────────────────────────
function StepDots({ step }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 24 }}>
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          style={{
            width: n === step ? 20 : 6,
            height: 6,
            borderRadius: 999,
            background: n === step
              ? "var(--violet)"
              : n < step
              ? "rgba(255,255,255,0.3)"
              : "rgba(255,255,255,0.1)",
            transition: "all 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

// ── Step 1: Order confirmation + T&C ──────────────────────────
function StepConfirm({ item, onNext, onClose }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div>
      <StepDots step={1} />

      {/* Product summary */}
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: "14px 16px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          marginBottom: 20,
          alignItems: "center",
        }}
      >
        <img
          src={item.image}
          alt={item.name}
          style={{
            width: 64,
            height: 64,
            objectFit: "contain",
            borderRadius: 8,
            background: "#0a0a10",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 4 }}>
            {item.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
              ₹{item.price}
            </span>
            <span
              style={{
                fontFamily: "var(--f-mono)",
                fontSize: 11,
                color: "var(--ink-dim)",
                textDecoration: "line-through",
                opacity: 0.6,
              }}
            >
              ₹{item.originalPrice}
            </span>
          </div>
        </div>
      </div>

      {/* T&C */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "var(--ink-dim)",
            textTransform: "uppercase",
            fontFamily: "var(--f-mono)",
            marginBottom: 8,
          }}
        >
          Terms & Conditions
        </div>
        <div
          style={{
            height: 150,
            overflowY: "auto",
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10,
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {TERMS.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  fontSize: 9,
                  color: "var(--ink-dim)",
                  marginTop: 1,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 12, color: "var(--ink-dim)", lineHeight: 1.55 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Checkbox */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          marginBottom: 20,
          padding: "10px 14px",
          background: agreed ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.02)",
          border: `1px solid ${agreed ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.07)"}`,
          borderRadius: 8,
          transition: "all 0.2s",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            border: `2px solid ${agreed ? "var(--violet)" : "rgba(255,255,255,0.2)"}`,
            background: agreed ? "var(--violet)" : "transparent",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            transition: "all 0.2s",
          }}
        >
          {agreed && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ display: "none" }}
        />
        <span style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.4 }}>
          I have read and agree to the Terms & Conditions
        </span>
      </label>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} className="btn ghost" style={{ flex: 1 }}>
          Cancel
        </button>
        <button
          onClick={onNext}
          disabled={!agreed}
          className="btn primary"
          style={{
            flex: 2,
            opacity: agreed ? 1 : 0.4,
            cursor: agreed ? "pointer" : "not-allowed",
          }}
        >
          Proceed to Payment →
        </button>
      </div>
    </div>
  );
}

// ── Step 2: QR Code + timer ────────────────────────────────────
function StepQR({ item, onNext, onClose }) {
  const isMobile = useMobile();
  const upiLink = generateUPILink(item.price, item.name);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS);
  const [copied, setCopied] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) { setExpired(true); return; }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const handleCopy = async () => {
    await copyToClipboard(UPI_ID);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const timerColor = secondsLeft <= 60 ? "#f87171" : secondsLeft <= 120 ? "#fbbf24" : "#4ade80";

  return (
    <div>
      <StepDots step={2} />

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 4 }}>
          Pay <strong style={{ color: "var(--ink)" }}>₹{item.price}</strong> for {item.name}
        </div>
        {/* Timer */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 999,
            background: `${timerColor}18`,
            border: `1px solid ${timerColor}40`,
            fontFamily: "var(--f-mono)",
            fontSize: 13,
            color: timerColor,
            fontWeight: 700,
          }}
        >
          <span style={{ fontSize: 10 }}>⏱</span>
          {expired ? "EXPIRED" : formatTimer(secondsLeft)}
        </div>
      </div>

      {/* QR */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            padding: 16,
            background: expired ? "rgba(255,255,255,0.04)" : "#fff",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.1)",
            position: "relative",
            opacity: expired ? 0.35 : 1,
            transition: "opacity 0.3s",
          }}
        >
          <QRCodeSVG
            value={upiLink}
            size={isMobile ? 180 : 200}
            bgColor="#ffffff"
            fgColor="#0a0a10"
            level="M"
          />
          {expired && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                background: "rgba(0,0,0,0.6)",
                borderRadius: 16,
              }}
            >
              <span style={{ color: "#f87171", fontFamily: "var(--f-mono)", fontSize: 12, fontWeight: 700 }}>
                QR EXPIRED
              </span>
            </div>
          )}
        </div>
      </div>

      {expired ? (
        <button
          onClick={() => setSecondsLeft(TIMER_SECONDS) || setExpired(false)}
          className="btn primary"
          style={{ width: "100%", marginBottom: 10 }}
        >
          Refresh QR
        </button>
      ) : (
        <>
          {/* UPI ID row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              marginBottom: 14,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "var(--ink-dim)", fontFamily: "var(--f-mono)", letterSpacing: "0.06em", marginBottom: 2 }}>
                UPI ID
              </div>
              <div style={{ fontFamily: "var(--f-mono)", fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>
                {UPI_ID}
              </div>
            </div>
            <button
              onClick={handleCopy}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                background: copied ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.07)",
                border: `1px solid ${copied ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.1)"}`,
                color: copied ? "#4ade80" : "var(--ink)",
                fontSize: 11,
                fontFamily: "var(--f-mono)",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
                letterSpacing: "0.04em",
              }}
            >
              {copied ? "✓ COPIED" : "COPY"}
            </button>
          </div>

          {/* Open in UPI app */}
          <a
            href={upiLink}
            style={{
              display: "block",
              textAlign: "center",
              padding: "10px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: 12,
              color: "var(--ink-dim)",
              marginBottom: 14,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            Open in UPI app ↗
          </a>

          <button onClick={onNext} className="btn primary" style={{ width: "100%" }}>
            Already Paid? Verify Here →
          </button>
        </>
      )}

      <button
        onClick={onClose}
        style={{
          width: "100%",
          marginTop: 10,
          background: "transparent",
          border: "none",
          color: "var(--ink-dim)",
          fontSize: 12,
          cursor: "pointer",
          padding: "6px",
          fontFamily: "var(--f-body)",
        }}
      >
        Cancel
      </button>
    </div>
  );
}

// ── Step 3: Google Form redirect ───────────────────────────────
function StepVerify({ item, onClose }) {
  const [opened, setOpened] = useState(false);

  const openForm = () => {
    const url = buildFormURL(item.name, item.price);
    window.open(url, "_blank", "noopener,noreferrer");
    setOpened(true);
  };

  return (
    <div>
      <StepDots step={3} />

      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(139,92,246,0.15)",
            border: "1px solid rgba(139,92,246,0.3)",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 16px",
            fontSize: 24,
          }}
        >
          ✓
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)", marginBottom: 8 }}>
          Payment done?
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-dim)", lineHeight: 1.6, maxWidth: 300, margin: "0 auto" }}>
          Submit your UPI Transaction ID via the form below. We'll verify and confirm your order within 24–48 hours.
        </div>
      </div>

      {/* What the form needs */}
      <div
        style={{
          padding: "14px 16px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 10,
          marginBottom: 20,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 11, fontFamily: "var(--f-mono)", color: "var(--ink-dim)", letterSpacing: "0.06em", marginBottom: 4 }}>
          YOU'LL NEED TO PROVIDE
        </div>
        {["UPI Transaction ID", "Your name", "Email address", "Phone number", "Payment screenshot (optional)"].map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink)" }}>
            <span style={{ color: "var(--teal)", fontSize: 10 }}>▸</span> {f}
          </div>
        ))}
        <div style={{ marginTop: 6, padding: "8px 10px", background: "rgba(139,92,246,0.07)", borderRadius: 6, fontSize: 11, color: "var(--ink-dim)" }}>
          <strong style={{ color: "var(--violet)" }}>Pre-filled:</strong> {item.name} · ₹{item.price} · {new Date().toLocaleDateString("en-IN")}
        </div>
      </div>

      <button onClick={openForm} className="btn primary" style={{ width: "100%", marginBottom: 10 }}>
        {opened ? "Open Form Again ↗" : "Open Verification Form ↗"}
      </button>

      {opened && (
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#4ade80",
            marginBottom: 12,
            padding: "8px",
            background: "rgba(74,222,128,0.06)",
            border: "1px solid rgba(74,222,128,0.15)",
            borderRadius: 8,
          }}
        >
          Form opened in new tab. Come back here once submitted.
        </div>
      )}

      <button onClick={onClose} className="btn ghost" style={{ width: "100%" }}>
        Done
      </button>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────
export default function PaymentModal({ item, onClose }) {
  const [step, setStep] = useState(1);
  const isMobile = useMobile();

  // Close on backdrop click
  const handleBackdrop = useCallback(
    (e) => { if (e.target === e.currentTarget) onClose(); },
    [onClose]
  );

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "16px" : "24px",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "rgba(16,16,24,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          padding: isMobile ? "24px 20px" : "28px 28px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
          position: "relative",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--f-mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                color: "var(--ink-dim)",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              {step === 1 ? "Order Summary" : step === 2 ? "Scan & Pay" : "Verify Payment"}
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)" }}>
              {step === 1 ? "Confirm your order" : step === 2 ? "Complete payment" : "Submit transaction ID"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--ink-dim)",
              fontSize: 16,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {step === 1 && (
          <StepConfirm item={item} onNext={() => setStep(2)} onClose={onClose} />
        )}
        {step === 2 && (
          <StepQR item={item} onNext={() => setStep(3)} onClose={onClose} />
        )}
        {step === 3 && (
          <StepVerify item={item} onClose={onClose} />
        )}
      </div>
    </div>
  );
}
