// Ascent Merch — Payment Utilities
const UPI_ID = "archive-disabled@invalid";
const PAYEE_NAME = "Archived event";

// ── Order ID generator ─────────────────────────────────────────
// Generates a unique correlation key shared across both forms.
export function generateOrderId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const random = Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `ASC-${random}`;
}

// ── UPI deep link ──────────────────────────────────────────────
export function generateUPILink(amount, cartItems = []) {
  const note =
    cartItems.length > 0
      ? "Ascent: " +
        cartItems
          .map((i) => {
            let s = i.quantity > 1 ? `${i.name}x${i.quantity}` : i.name;
            if (i.size) s += `(${i.size})`;
            return s;
          })
          .join(", ")
      : "Ascent-Merch-Order";

  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: PAYEE_NAME,
    am: String(amount),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}

// ── Copy to clipboard ──────────────────────────────────────────
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  }
}

// ── Timer formatter ────────────────────────────────────────────
export function formatTimer(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ── FORM-1 — Checkout Form (auto-submitted on Checkout) ───────
const ORDER_FORM_RESPONSE_URL =
  "https://example.invalid/archived-form";

const ORDER_ENTRY_ORDER_ID = "entry.737236600";
const ORDER_ENTRY_NAME     = "entry.73640048";
const ORDER_ENTRY_EMAIL    = "entry.866687402";
const ORDER_ENTRY_ITEMS    = "entry.1400168311";
const ORDER_ENTRY_AMOUNT   = "entry.1691331310";
const ORDER_ENTRY_DATE     = "entry.894286697";

export async function submitOrderForm({ orderId, buyerName, buyerEmail, cartItems, totalAmount }) {
  const itemsSummary = cartItems
    .map((i) => {
      let desc = i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name;
      if (i.size) desc += ` [Size: ${i.size}]`;
      if (i.printName?.trim()) desc += ` [Print: ${i.printName.trim()}]`;
      return desc;
    })
    .join(", ");

  const date = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const body = new URLSearchParams({
    [ORDER_ENTRY_ORDER_ID]: orderId,
    [ORDER_ENTRY_NAME]:     buyerName,
    [ORDER_ENTRY_EMAIL]:    buyerEmail,
    [ORDER_ENTRY_ITEMS]:    itemsSummary,
    [ORDER_ENTRY_AMOUNT]:   `₹${totalAmount}`,
    [ORDER_ENTRY_DATE]:     date,
  });

  try {
    await fetch(ORDER_FORM_RESPONSE_URL, { method: "POST", mode: "no-cors", body });
  } catch {
    // no-cors — response is always opaque, failure is silent
  }
}

// ── FORM-2 — Verification Form (opened after payment) ─────────
const VERIFY_FORM_BASE_URL =
  "https://example.invalid/archived-form";

const VERIFY_ENTRY_ORDER_ID = "entry.13149367";
const VERIFY_ENTRY_NAME     = "entry.1801982307";
const VERIFY_ENTRY_EMAIL    = "entry.158704254";
const VERIFY_ENTRY_ITEMS    = "entry.402391598";
const VERIFY_ENTRY_AMOUNT   = "entry.295197486";
const VERIFY_ENTRY_DATE     = "entry.1364751440";

export function buildFormURL(cartItems, totalAmount, buyerName = "", buyerEmail = "", orderId = "") {
  const itemsSummary = cartItems
    .map((i) => {
      let desc = i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name;
      if (i.size) desc += ` [Size: ${i.size}]`;
      if (i.printName?.trim()) desc += ` [Print: ${i.printName.trim()}]`;
      return desc;
    })
    .join(", ");

  const date = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const params = new URLSearchParams({
    [VERIFY_ENTRY_ORDER_ID]: orderId,
    [VERIFY_ENTRY_NAME]:     buyerName,
    [VERIFY_ENTRY_EMAIL]:    buyerEmail,
    [VERIFY_ENTRY_ITEMS]:    itemsSummary,
    [VERIFY_ENTRY_AMOUNT]:   `₹${totalAmount}`,
    [VERIFY_ENTRY_DATE]:     date,
    usp: "pp_url",
  });
  return `${VERIFY_FORM_BASE_URL}?${params.toString()}`;
}

export { UPI_ID };
