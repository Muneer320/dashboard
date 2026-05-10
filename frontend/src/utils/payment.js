// Ascent Merch — Payment Utilities

const UPI_ID = "archive-disabled@invalid";
const PAYEE_NAME = "Archived event";

// ── UPI deep link ──────────────────────────────────────────────
export function generateUPILink(amount, productName) {
  const note = `Ascent-${productName.replace(/\s+/g, "-")}`;
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
    // fallback for older browsers
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

// ── Google Form URL builder ────────────────────────────────────
// To get entry IDs:
// 1. Open your Google Form
// 2. Click the 3-dot menu → "Get pre-filled link"
// 3. Fill each field with a dummy value and click "Get link"
// 4. The URL will contain entry.XXXXXXXXX=dummy for each field
// 5. Replace the ENTRY_* constants below with those IDs
const GOOGLE_FORM_BASE_URL =
  "https://example.invalid/archived-form";

const ENTRY_PRODUCT   = "entry.1266756626";
const ENTRY_AMOUNT    = "entry.211352510";
const ENTRY_TIMESTAMP = "entry.1013538216";

export function buildFormURL(productName, amount) {
  const timestamp = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const params = new URLSearchParams({
    [ENTRY_PRODUCT]:   productName,
    [ENTRY_AMOUNT]:    `₹${amount}`,
    [ENTRY_TIMESTAMP]: timestamp,
    usp: "pp_url",
  });
  return `${GOOGLE_FORM_BASE_URL}?${params.toString()}`;
}

export { UPI_ID };
