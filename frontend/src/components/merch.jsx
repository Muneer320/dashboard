// Ascent — Merch Store
import React, { useState, useEffect, useMemo } from "react";
import { useMobile, NavBar, PageBackground } from "./shared";
import { useUserAuth } from "../lib/UserAuthContext";
import PaymentModal from "./PaymentModal";
import { submitOrderForm, generateOrderId } from "../utils/payment";

// ── Stock toggle ───────────────────────────────────────────────
// Set to true to mark everything sold out (no cart). Flip to false when restocked.
const MERCH_SOLD_OUT = true;

const ITEMS = [
  {
    id: "badge",
    name: "Badge",
    description: "Collectible pin badge with the Ascent emblem.",
    price: 49,
    originalPrice: 99,
    image: "/merch/badge.jpeg",
    tag: null,
  },
  {
    id: "notepad",
    name: "Notepad",
    description: "Premium spiral notebook with exclusive Ascent cover art.",
    price: 199,
    originalPrice: 356,
    image: "/merch/notebook.jpeg",
    tag: null,
  },
  {
    id: "totebag",
    name: "Tote Bag",
    description: "Canvas tote with the full Escape the Ordinary artwork.",
    price: 329,
    originalPrice: 499,
    image: "/merch/tote2.jpeg",
    tag: null,
  },
  {
    id: "tshirt",
    name: "T-Shirt",
    description: "Oversized premium quality. Clean ASCENT branding, no name.",
    price: 549,
    originalPrice: 610,
    image: "/merch/tshirt1.png",
    tag: null,
  },
  {
    id: "tshirt-name",
    name: "T-Shirt with Name",
    description: "Oversized premium quality. Your name printed on the back.",
    price: 649,
    originalPrice: 721,
    image: "/merch/tshirt2.jpeg",
    tag: "Bestseller",
    tagColor: "var(--violet)",
  },
  {
    id: "mug",
    name: "Mug",
    description: "Ceramic mug with exclusive Ascent gold artwork.",
    price: 249,
    originalPrice: 359,
    image: "/merch/mug.jpeg",
    tag: null,
  },
];

const SIZES = ["S", "M", "L", "XL", "2XL"];
const TSHIRT_IDS = ["tshirt", "tshirt-name"];
const isTshirt = (id) => TSHIRT_IDS.includes(id);

// ── Cart Drawer ────────────────────────────────────────────────
function CartDrawer({ cart, onClose, onRemove, onChangeQty, onUpdate, onCheckout, buyerName, buyerEmail, isSSTStudent, onNameChange, onEmailChange, onSSTChange }) {
  const isMobile = useMobile();
  const [showChart, setShowChart] = useState(false);
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const missingSize = cart.filter((i) => isTshirt(i.id) && !i.size);
  const missingPrint = cart.filter((i) => i.id === "tshirt-name" && !i.printName?.trim());
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail);
  const canCheckout =
    missingSize.length === 0 &&
    missingPrint.length === 0 &&
    buyerName.trim().length > 0 &&
    emailValid &&
    isSSTStudent;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} />

      {/* Panel */}
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 901, width: isMobile ? "100vw" : 400, background: "rgba(14,14,22,0.99)", borderLeft: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", boxShadow: "-16px 0 48px rgba(0,0,0,0.6)" }}>

        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>Your Cart</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)" }}>
              {cart.reduce((s, i) => s + i.quantity, 0)} item{cart.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--ink-dim)", fontSize: 14, display: "grid", placeItems: "center", cursor: "pointer" }}>✕</button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-dim)", fontSize: 13 }}>
              Your cart is empty.<br />Add items to get started.
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 14,
                }}
              >
                {/* ── Item row ── */}
                <div style={{ display: "flex", gap: 12, padding: "14px 14px 12px", alignItems: "center" }}>
                  <img
                    src={item.image} alt={item.name}
                    style={{ width: 54, height: 54, objectFit: "contain", borderRadius: 8, background: "#0a0a10", flexShrink: 0, border: "1px solid rgba(255,255,255,0.06)" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>{item.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => onChangeQty(item.id, -1)} style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 16, cursor: "pointer", display: "grid", placeItems: "center", lineHeight: 1 }}>−</button>
                      <span style={{ fontFamily: "var(--f-mono)", fontSize: 14, fontWeight: 700, color: "#fff", minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
                      <button onClick={() => onChangeQty(item.id, 1)} style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 16, cursor: "pointer", display: "grid", placeItems: "center", lineHeight: 1 }}>+</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontFamily: "var(--f-mono)", fontSize: 15, fontWeight: 700, color: "#fff" }}>₹{item.price * item.quantity}</span>
                    <button onClick={() => onRemove(item.id)} style={{ background: "none", border: "none", color: "#f87171", fontSize: 11, cursor: "pointer", fontFamily: "var(--f-mono)", letterSpacing: "0.04em", padding: 0 }}>REMOVE</button>
                  </div>
                </div>

                {/* ── T-shirt extras ── */}
                {isTshirt(item.id) && (
                  <div style={{ margin: "0 10px 12px", padding: "12px 14px", background: "rgba(0,0,0,0.25)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 14 }}>

                    {/* Size */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontFamily: "var(--f-mono)", fontWeight: 700, letterSpacing: "0.08em", color: item.size ? "#4ade80" : "#fbbf24" }}>
                          {item.size ? `✓ SIZE ${item.size} SELECTED` : "⚠ SELECT SIZE"}
                        </span>
                        <button
                          onClick={() => setShowChart((v) => !v)}
                          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#ccc", fontSize: 10, cursor: "pointer", fontFamily: "var(--f-mono)", padding: "3px 8px", borderRadius: 6, letterSpacing: "0.04em" }}
                        >
                          📏 SIZE CHART
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {SIZES.map((s) => (
                          <button
                            key={s}
                            onClick={() => onUpdate(item.id, { size: s })}
                            style={{
                              flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700,
                              fontFamily: "var(--f-mono)", cursor: "pointer", transition: "all 0.15s",
                              background: item.size === s ? "var(--violet)" : "rgba(255,255,255,0.07)",
                              border: `1px solid ${item.size === s ? "rgba(139,92,246,0.8)" : "rgba(255,255,255,0.12)"}`,
                              color: item.size === s ? "#fff" : "#aaa",
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>

                      {/* Size chart — inline below size buttons */}
                      {showChart && (
                        <div style={{ marginTop: 10, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)" }}>
                          <img src="/merch/sizechart.jpeg" alt="Size Chart" style={{ width: "100%", display: "block" }} />
                        </div>
                      )}
                    </div>

                    {/* Name to print */}
                    {item.id === "tshirt-name" && (
                      <div>
                        <div style={{ fontSize: 11, fontFamily: "var(--f-mono)", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8, color: item.printName?.trim() ? "#4ade80" : "#fbbf24" }}>
                          {item.printName?.trim() ? `✓ PRINT: "${item.printName.trim()}"` : "⚠ NAME TO PRINT ON T-SHIRT"}
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. Ratnesh (max 20 chars)"
                          value={item.printName ?? ""}
                          onChange={(e) => onUpdate(item.id, { printName: e.target.value })}
                          maxLength={20}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.08)",
                            border: "1.5px solid rgba(255,255,255,0.2)",
                            color: "#fff",
                            fontSize: 13,
                            fontFamily: "var(--f-mono)",
                            letterSpacing: "0.06em",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                          onFocus={(e) => { e.target.style.border = "1.5px solid var(--violet)"; }}
                          onBlur={(e) => { e.target.style.border = "1.5px solid rgba(255,255,255,0.2)"; }}
                        />
                        <div style={{ fontSize: 10.5, color: "#888", marginTop: 5 }}>
                          Printed on the back of your T-shirt.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>

            {/* Buyer details */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontFamily: "var(--f-mono)", color: "var(--ink-dim)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Your Details</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { type: "text",  placeholder: "Full Name",      value: buyerName,  onChange: onNameChange },
                  { type: "email", placeholder: "Email Address",  value: buyerEmail, onChange: onEmailChange },
                ].map(({ type, placeholder, value, onChange }) => (
                  <input
                    key={type}
                    type={type}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                      display: "block", width: "100%", padding: "10px 12px", borderRadius: 8, boxSizing: "border-box",
                      background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.14)",
                      color: "#fff", fontSize: 13, fontFamily: "var(--f-body)", outline: "none",
                    }}
                    onFocus={(e) => { e.target.style.border = "1.5px solid var(--violet)"; }}
                    onBlur={(e) => { e.target.style.border = "1.5px solid rgba(255,255,255,0.14)"; }}
                  />
                ))}
              </div>

              {/* SST student confirmation */}
              <label
                htmlFor="sst-student-check"
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10, marginTop: 10, padding: "10px 12px",
                  borderRadius: 8, background: "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${isSSTStudent ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.14)"}`,
                  cursor: "pointer", userSelect: "none",
                }}
              >
                <input
                  id="sst-student-check"
                  type="checkbox"
                  checked={isSSTStudent}
                  onChange={(e) => onSSTChange(e.target.checked)}
                  style={{ marginTop: 2, accentColor: "var(--violet)", cursor: "pointer", flexShrink: 0 }}
                />
                <span style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.5 }}>
                  I confirm I am a <strong>Scaler Student</strong>.
                  <div style={{ fontSize: 10.5, color: "var(--ink-dim)", marginTop: 2 }}>
                    Merch is currently open to Scaler Students only.
                  </div>
                </span>
              </label>
            </div>

            {/* Validation warning */}
            {!canCheckout && (
              <div style={{ marginBottom: 10, padding: "8px 12px", background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8, fontSize: 11.5, color: "#fbbf24", lineHeight: 1.5 }}>
                ⚠ {missingSize.length > 0 && `Select size for: ${missingSize.map(i => i.name).join(", ")}. `}
                {missingPrint.length > 0 && `Enter name to print for T-Shirt with Name. `}
                {!buyerName.trim() && `Enter your name. `}
                {buyerName.trim() && !emailValid && `Enter a valid email. `}
                {buyerName.trim() && emailValid && !isSSTStudent && `Confirm you are a Scaler Student.`}
              </div>
            )}

            {/* Breakdown */}
            <div style={{ marginBottom: 12 }}>
              {cart.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-dim)", marginBottom: 4 }}>
                  <span>{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}{item.size ? ` (${item.size})` : ""}</span>
                  <span style={{ fontFamily: "var(--f-mono)" }}>₹{item.price * item.quantity}</span>
                </div>
              ))}
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>Total</span>
                <span style={{ fontFamily: "var(--f-mono)", fontSize: 20, fontWeight: 700, color: "var(--violet)" }}>₹{total}</span>
              </div>
            </div>

            <button
              onClick={onCheckout}
              disabled={!canCheckout}
              className="btn primary"
              style={{ width: "100%", padding: "12px 0", fontSize: 14, opacity: canCheckout ? 1 : 0.4, cursor: canCheckout ? "pointer" : "not-allowed" }}
            >
              Checkout · ₹{total} →
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Merch Card ─────────────────────────────────────────────────
function MerchCard({ item, isMobile, inCart, onAddToCart, onOpenCart, soldOut }) {
  const [hovered, setHovered] = useState(false);
  const [flash, setFlash] = useState(false);

  const handleAdd = () => {
    if (inCart) { onOpenCart(); return; }
    onAddToCart(item);
    setFlash(true);
    setTimeout(() => setFlash(false), 1500);
  };

  const discount = item.originalPrice
    ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
    : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 14, overflow: "hidden",
        transition: "all 0.25s ease",
        transform: hovered ? "translateY(-4px)" : "none",
        boxShadow: hovered ? "0 16px 48px rgba(0,0,0,0.5)" : "0 2px 8px rgba(0,0,0,0.2)",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Image */}
      <div style={{ position: "relative", width: "100%", paddingBottom: "100%", overflow: "hidden", background: "#0a0a10" }}>
        <img
          src={item.image}
          alt={item.name}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "contain", objectPosition: "center",
            transition: "transform 0.4s ease",
            transform: hovered ? "scale(1.06)" : "scale(1)",
            filter: (soldOut || item.comingSoon) ? "brightness(0.35) grayscale(0.4)" : "none",
          }}
        />
        {item.tag && (
          <div style={{ position: "absolute", top: 10, left: 10, background: item.tagColor ?? "rgba(255,255,255,0.15)", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", padding: "3px 9px", borderRadius: 999, textTransform: "uppercase", fontFamily: "var(--f-mono)" }}>
            {item.tag}
          </div>
        )}
        {item.comingSoon && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 11, letterSpacing: "0.14em", color: "var(--teal)", textTransform: "uppercase", border: "1px solid var(--teal)", padding: "6px 16px", borderRadius: 999, background: "rgba(0,0,0,0.6)" }}>
              Coming Soon
            </span>
          </div>
        )}
        {soldOut && !item.comingSoon && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 11, letterSpacing: "0.14em", color: "#f87171", textTransform: "uppercase", border: "1px solid #f87171", padding: "6px 16px", borderRadius: 999, background: "rgba(0,0,0,0.6)" }}>
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "14px 16px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 5, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontFamily: "var(--f-body)", fontWeight: 700, fontSize: 14, color: "var(--ink)", letterSpacing: "-0.01em" }}>
          {item.name}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-dim)", lineHeight: 1.5, flex: 1 }}>
          {item.description}
        </div>

        {/* Pricing */}
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 7 }}>
          {item.price ? (
            <>
              <span style={{ fontFamily: "var(--f-mono)", fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>₹{item.price}</span>
              {item.originalPrice && (
                <span style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-dim)", textDecoration: "line-through", opacity: 0.55 }}>₹{item.originalPrice}</span>
              )}
              {discount && (
                <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", padding: "1px 6px", borderRadius: 999, fontFamily: "var(--f-mono)" }}>
                  -{discount}%
                </span>
              )}
            </>
          ) : (
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--teal)", letterSpacing: "0.06em" }}>TBA</span>
          )}
        </div>

        {/* Add to cart button */}
        {!item.comingSoon && (
          soldOut ? (
            <button
              disabled
              style={{
                marginTop: 10, width: "100%", padding: "9px 0", borderRadius: 9,
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.25)",
                color: "#f87171",
                fontSize: 11, fontWeight: 700, fontFamily: "var(--f-mono)",
                letterSpacing: "0.06em", cursor: "not-allowed", opacity: 0.7,
              }}
            >
              OUT OF STOCK
            </button>
          ) : (
            <button
              onClick={handleAdd}
              style={{
                marginTop: 10, width: "100%", padding: "9px 0", borderRadius: 9,
                background: flash
                  ? "rgba(74,222,128,0.2)"
                  : inCart
                  ? "rgba(139,92,246,0.25)"
                  : hovered
                  ? "var(--violet)"
                  : "rgba(139,92,246,0.15)",
                border: `1px solid ${flash ? "rgba(74,222,128,0.5)" : inCart ? "rgba(139,92,246,0.5)" : "rgba(139,92,246,0.35)"}`,
                color: flash ? "#4ade80" : "#fff",
                fontSize: 11, fontWeight: 700, fontFamily: "var(--f-mono)",
                letterSpacing: "0.06em", cursor: "pointer", transition: "all 0.2s",
              }}
            >
              {flash ? "✓ ADDED" : inCart ? "IN CART — VIEW →" : "ADD TO CART"}
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ── Merch Store ────────────────────────────────────────────────
export default function MerchStore() {
  const isMobile = useMobile();
  const { user } = useUserAuth();

  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem("ascent-merch-cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("ascent-merch-cart", JSON.stringify(cart));
  }, [cart]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [isSSTStudent, setIsSSTStudent] = useState(false);
  const [orderId, setOrderId] = useState("");

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      const extra = isTshirt(item.id) ? { size: null, printName: item.id === "tshirt-name" ? "" : undefined } : {};
      return [...prev, { ...item, quantity: 1, ...extra }];
    });
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((c) => c.id !== id));

  const updateCartItem = (id, updates) =>
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));

  const changeQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((c) => c.id === id ? { ...c, quantity: c.quantity + delta } : c)
        .filter((c) => c.quantity > 0)
    );
  };

  const handleCheckout = () => {
    const newOrderId = generateOrderId();
    setOrderId(newOrderId);
    submitOrderForm({ orderId: newOrderId, buyerName, buyerEmail, cartItems: cart, totalAmount: cartTotal });
    setDrawerOpen(false);
    setCheckingOut(true);
  };

  const handleModalClose = () => {
    setCheckingOut(false);
    setCart([]);
    localStorage.removeItem("ascent-merch-cart");
  };

  return (
    <PageBackground glows={true}>
      {checkingOut && (
        <PaymentModal
          cartItems={cart}
          totalAmount={cartTotal}
          buyerName={buyerName}
          buyerEmail={buyerEmail}
          orderId={orderId}
          onClose={handleModalClose}
        />
      )}

      {drawerOpen && (
        <CartDrawer
          cart={cart}
          onClose={() => setDrawerOpen(false)}
          onRemove={removeFromCart}
          onChangeQty={changeQty}
          onUpdate={updateCartItem}
          onCheckout={handleCheckout}
          buyerName={buyerName}
          buyerEmail={buyerEmail}
          isSSTStudent={isSSTStudent}
          onNameChange={setBuyerName}
          onEmailChange={setBuyerEmail}
          onSSTChange={setIsSSTStudent}
        />
      )}

      <NavBar variant={user ? "app" : "public"} active="merch" />

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: isMobile ? "28px 16px 100px" : "48px 32px 100px" }}>

        {/* Hero */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 28 : 48, alignItems: "center", marginBottom: isMobile ? 40 : 56 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              § MERCH STORE · {MERCH_SOLD_OUT ? "SOLD OUT" : `${ITEMS.filter((i) => !i.comingSoon).length} ITEMS`}
            </div>
            <h1 className="display" style={{ fontSize: isMobile ? 38 : 60, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 16 }}>
              Wear the<br />ascent.
            </h1>
            <p style={{ color: "var(--ink-dim)", fontSize: 14, lineHeight: 1.65, maxWidth: 380, marginBottom: 24 }}>
              Official Ascent × Scaler School of Technology merchandise.
              Limited stock — grab yours before it's gone.
            </p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, fontSize: 12, color: "var(--ink-dim)", fontFamily: "var(--f-mono)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: MERCH_SOLD_OUT ? "#f87171" : "#4ade80", boxShadow: MERCH_SOLD_OUT ? "0 0 6px #f87171" : "0 0 6px #4ade80", flexShrink: 0 }} />
              {MERCH_SOLD_OUT ? "Sold out · Techfest 2026" : "Available only for Scaler Students · Techfest 2026"}
            </div>
          </div>

          {!isMobile && (
            <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", aspectRatio: "1/1", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
              <img src="/merch/mainpic.jpeg" alt="Ascent Merch Collection" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
            </div>
          )}
        </div>

        {/* Important Notice */}
        <div
          style={{
            marginBottom: isMobile ? 28 : 40,
            padding: isMobile ? "16px 18px" : "20px 24px",
            background: "linear-gradient(135deg, rgba(251,191,36,0.08), rgba(139,92,246,0.08))",
            border: "1px solid rgba(251,191,36,0.28)",
            borderRadius: 14,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "#fbbf24", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                Important Update
              </div>
              <div style={{ fontSize: isMobile ? 13 : 14, color: "var(--ink)", lineHeight: 1.55 }}>
                Due to high demand, availability is now restricted <strong style={{ color: "#fbbf24" }}>exclusively to Scaler Students</strong>.
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }}>📦</span>
            <div>
              <div style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--violet)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                Collection
              </div>
              <div style={{ fontSize: isMobile ? 13 : 14, color: "var(--ink)", lineHeight: 1.55 }}>
                Available at the <strong style={{ color: "#fff" }}>front desk reception</strong> from <strong style={{ color: "#fff" }}>22nd May</strong> onwards.
              </div>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: isMobile ? 12 : 20 }}>
          {ITEMS.map((item) => (
            <MerchCard
              key={item.id}
              item={item}
              isMobile={isMobile}
              inCart={cart.some((c) => c.id === item.id)}
              onAddToCart={addToCart}
              onOpenCart={() => setDrawerOpen(true)}
              soldOut={MERCH_SOLD_OUT}
            />
          ))}
        </div>
      </div>

      {/* Floating cart FAB */}
      {!MERCH_SOLD_OUT && cartCount > 0 && (
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            position: "fixed",
            bottom: isMobile ? 20 : 28,
            right: isMobile ? 16 : 28,
            zIndex: 800,
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 20px",
            background: "var(--violet)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 999,
            color: "#fff",
            fontSize: 13, fontWeight: 700,
            fontFamily: "var(--f-mono)",
            cursor: "pointer",
            boxShadow: "0 8px 32px rgba(139,92,246,0.45)",
            transition: "transform 0.2s, box-shadow 0.2s",
            letterSpacing: "0.03em",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(139,92,246,0.6)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(139,92,246,0.45)"; }}
        >
          <span style={{ fontSize: 16 }}>🛒</span>
          {cartCount} item{cartCount !== 1 ? "s" : ""} · ₹{cartTotal}
        </button>
      )}
    </PageBackground>
  );
}
