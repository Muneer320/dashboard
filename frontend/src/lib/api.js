/**
 * api.js — Ascent API client
 *
 * Base URL is read from VITE_API_BASE in .env (defaults to /api/v1).
 * In development, Vite proxies /api/* → BACKEND_URL (set in .env).
 * In production, set VITE_API_BASE to your hosted API URL.
 *
 * Tokens:
 *   User  → localStorage key: "ascent_token"
 *   Admin → localStorage key: "ascent_admin_token"
 */

const BASE = (import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/$/, '');

// ─── Token helpers ────────────────────────────────────────────────────────────

export const token = {
  getUser: () => localStorage.getItem('ascent_token'),
  setUser: (t) => localStorage.setItem('ascent_token', t),
  clearUser: () => localStorage.removeItem('ascent_token'),

  getAdmin: () => localStorage.getItem('ascent_admin_token'),
  setAdmin: (t) => localStorage.setItem('ascent_admin_token', t),
  clearAdmin: () => localStorage.removeItem('ascent_admin_token'),
};

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request(path, { method = 'GET', body, adminAuth = false } = {}) {
  const tok = adminAuth ? token.getAdmin() : token.getUser();
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = `Bearer ${tok}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({ detail: res.statusText }));

  if (!res.ok) {
    const msg = data?.detail ?? `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, data);
  }

  return data;
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// ─── Convenience methods ──────────────────────────────────────────────────────

const get = (path, opts) => request(path, { ...opts, method: 'GET' });
const post = (path, body, opts) => request(path, { ...opts, method: 'POST', body });
const patch = (path, body, opts) => request(path, { ...opts, method: 'PATCH', body });
const put = (path, body, opts) => request(path, { ...opts, method: 'PUT', body });
const del = (path, opts) => request(path, { ...opts, method: 'DELETE' });

// ─── Auth — User ──────────────────────────────────────────────────────────────

export const auth = {
  login: ({ email, password }) =>
    post('/auth/login', { email, password }),

  me: () => get('/auth/me'),
};

// ─── Auth — Admin ─────────────────────────────────────────────────────────────

export const adminAuth = {
  login: ({ username, password }) =>
    post('/auth/admin/login', { username, password }, { adminAuth: true }),

  me: () => get('/auth/admin/me', { adminAuth: true }),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = {
  get: (id) => get(`/users/${id}`),
  patch: (id, body) => patch(`/users/${id}`, body),
  events: (id) => get(`/users/${id}/events`),
  meals: (id) => get(`/users/${id}/meals`),
  myEvents: () => get('/users/me/my-events'),
};

// ─── Events ───────────────────────────────────────────────────────────────────

export const events = {
  list: () => get('/events'),
  publicList: () => get('/events/public'),
  get: (id) => get(`/events/${id}`),
  register: (id) => post(`/events/${id}/register`, {}),
  myTeam: (id) => get(`/events/${id}/my-team`),

  /**
 * POST /events/{id}/submit
 * body: { phase: number, answers: [{ question_id, answer }] }
 */
  submit: (id, { phase, answers }) =>
    post(`/events/${id}/submit`, { phase, answers }),

  /**
   * GET /events/{id}/submission?phase=N
   * Returns: { event_id, phase, phase_key, has_submission, submitted_at, answers }
   */
  submission: (id, phase) =>
    get(`/events/${id}/submission?phase=${phase}`),

  /**
   * GET /events/{id}/questions?phase=N
   * Returns: { event_id, phase, phase_key, questions: QuestionDefinition[] }
   */
  questions: (id, phase) =>
    get(`/events/${id}/questions?phase=${phase}`),

  /**
   * PUT /events/{id}/questions  (admin / event manager only)
   * body: { questions: { phase1: [...], phase2: [...] } }
   */
  setQuestions: (id, body) =>
    put(`/events/${id}/questions`, body, { adminAuth: true }),

  rating: (id, { value, feedback }) => post(`/events/${id}/rating`, { value, feedback }),
  myRating: (id) => get(`/events/${id}/rating/me`),
  ratingSummary: (id) => get(`/events/${id}/rating/summary`),
};

// ─── Schedule ─────────────────────────────────────────────────────────────────

export const schedule = {
  global: () => get('/schedule/global'),
  byDate: (date) => get(`/schedule/global/${date}`),   // "YYYY-MM-DD"
  forEvent: (id) => get(`/schedule/events/${id}`),
};

// ─── Announcements ────────────────────────────────────────────────────────────

export const announcements = {
  list: (limit = 50) => get(`/announcements?limit=${limit}`),
};

// ─── Feedback (anonymous overall-festival form) ──────────────────────────────

export const feedback = {
  // body: { scores: { organization, food, events, ambiance, communication }, fix, highlight }
  submit: (body) => post('/feedback', body),
};

// ─── Credentials (request access) ────────────────────────────────────────────

export const credentials = {
  // No token needed — public endpoint for people who don't have an account yet
  request: (body) =>
    fetch(`${BASE}/credentials-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new ApiError(d?.detail ?? 'Request failed', r.status, d);
      return d;
    }),

  // Public name-only event list for the pre-login form. Returns [{id, name}].
  events: () =>
    fetch(`${BASE}/credentials-requests/events`).then(async (r) => {
      const d = await r.json().catch(() => ([]));
      if (!r.ok) throw new ApiError(d?.detail ?? 'Could not load events', r.status, d);
      return Array.isArray(d) ? d : [];
    }),
};

// ─── Admin Panel ──────────────────────────────────────────────────────────────

export const adminPanel = {
  stats: () => get('/admin-panel/stats', { adminAuth: true }),

  // Per-event breakdown (used by Overview + DataContext)
  eventsStats: () => get('/admin-panel/events/stats', { adminAuth: true }),

  participants: (eventId) =>
    get(`/admin-panel/participants${eventId ? `?event_id=${eventId}` : ''}`, { adminAuth: true }),

  lookup: (params) => {
    const q = new URLSearchParams(params).toString();
    return get(`/admin-panel/participants/lookup?${q}`, { adminAuth: true });
  },

  myEvents: () => get('/admin-panel/my-events', { adminAuth: true }),
  adminUsers: () => get('/admin-panel/admin-users', { adminAuth: true }),

  // PATCH /admin-panel/participants/{user_id}/restrict
  // body: { event_id: str, restricted: bool }
  restrictParticipant: (userId, eventId, restricted) =>
    patch(`/admin-panel/participants/${userId}/restrict`, { event_id: eventId, restricted }, { adminAuth: true }),

  addAdminUser: (body) => post('/admin-panel/admin-users', body, { adminAuth: true }),
  updateAdminUser: (uid, body) => patch(`/admin-panel/admin-users/${uid}`, body, { adminAuth: true }),
  deleteAdminUser: (uid) => del(`/admin-panel/admin-users/${uid}`, { adminAuth: true }),

  // ── Single event detail + update ────────────────────────────────────────
  getEvent: (eventId) =>
    get(`/admin-panel/events/${eventId}`, { adminAuth: true }),
  updateEvent: (eventId, body) =>
    patch(`/admin-panel/events/${eventId}`, body, { adminAuth: true }),

  // ── Meals (per-event meals_count + per-user claim matrix) ────────────────
  eventsMealsCount: () =>
    get('/admin-panel/events/meals-count', { adminAuth: true }),
  setEventMealsCount: (eventId, meals_count) =>
    patch(`/admin-panel/events/${eventId}/meals-count`, { meals_count }, { adminAuth: true }),
  userMeals:        () => get('/admin-panel/meals/users', { adminAuth: true }),
  addUserMeal:      (userId, mealId) =>
    post(`/admin-panel/meals/users/${userId}/${mealId}`, {}, { adminAuth: true }),
  removeUserMeal:   (userId, mealId) =>
    del(`/admin-panel/meals/users/${userId}/${mealId}`, { adminAuth: true }),

  // ── Requested members (credential-request review) ───────────────────────
  //   GET  /admin-panel/requested-members?status_filter=pending|approved|rejected
  //   PATCH /admin-panel/requested-members/{id}   body: { status }
  requestedMembers: (statusFilter) => {
    const q = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : '';
    return get(`/admin-panel/requested-members${q}`, { adminAuth: true });
  },
  setRequestedMemberStatus: (id, newStatus) =>
    patch(`/admin-panel/requested-members/${id}`, { status: newStatus }, { adminAuth: true }),

  // ── Uncovered users (diff DB ↔ credentials CSV) ──────────────────────────
  // Given the email column of an admin's "already-sent" CSV, return DB
  // users that aren't on the list. Then regenerate passwords for the IDs
  // the admin selects so the existing Apps-Script mailer can deliver them.
  findUncoveredUsers: (emails) =>
    post('/admin-panel/uncovered-users', { emails }, { adminAuth: true }),
  regenerateUncovered: (user_ids) =>
    post('/admin-panel/uncovered-users/regenerate', { user_ids }, { adminAuth: true }),
};

// ─── Notifications (in-app bell) ─────────────────────────────────────────────

export const notifications = {
  list:        (limit = 50) => get(`/notifications?limit=${limit}`),
  markRead:    (id) => post(`/notifications/${id}/read`, {}),
  markAllRead: () => post('/notifications/read-all', {}),
};

// ─── Sidequest — admin-side ──────────────────────────────────────────────────

export const adminCoins = {
  // UGC queue
  ugcQueue:    (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/admin/ugc/queue${q ? `?${q}` : ''}`, { adminAuth: true });
  },
  approveUGC:  (submission_id) => post('/admin/ugc/approve', { submission_id }, { adminAuth: true }),
  rejectUGC:   (submission_id, reason) => post('/admin/ugc/reject', { submission_id, reason }, { adminAuth: true }),

  // Manual / leaderboard / snapshot
  manualAdjust: (student_id, coins, reason) =>
    post('/admin/coins/manual-adjust', { student_id, coins, reason }, { adminAuth: true }),
  leaderboard:  () => get('/admin/leaderboard', { adminAuth: true }),
  snapshotTake: (snapshot_type, force = false, force_reason = null) =>
    post('/admin/snapshot/take', { snapshot_type, force, force_reason }, { adminAuth: true }),

  // Surprise drops
  triggerDrop: (body) => post('/admin/surprise-drop/trigger', body, { adminAuth: true }),
  cancelDrop:  (drop_id) => post('/admin/surprise-drop/cancel', { drop_id }, { adminAuth: true }),

  // Booth activity, disputes, inventory, engagement, audit
  boothActivity: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/admin/booth/activity${q ? `?${q}` : ''}`, { adminAuth: true });
  },
  disputes:        (status = 'open') => get(`/admin/disputes?status=${encodeURIComponent(status)}`, { adminAuth: true }),
  resolveDispute:  (ticket_id, resolution_note, action) =>
    post('/admin/disputes/resolve', { ticket_id, resolution_note, action }, { adminAuth: true }),
  inventory:       () => get('/admin/inventory', { adminAuth: true }),
  engagementSubmit:(body) => post('/admin/engagement/submit', body, { adminAuth: true }),
  auditLog:        (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/admin/audit-log${q ? `?${q}` : ''}`, { adminAuth: true });
  },
};

// ─── Sidequest — booth volunteer ────────────────────────────────────────────

export const boothApi = {
  // booth_volunteer JWT used as adminAuth
  me:      () => get('/booth/me', { adminAuth: true }),
  award:   (student_id, client_uuid) => post('/booth/award', { student_id, client_uuid }, { adminAuth: true }),
  sync:    (awards) => post('/booth/sync', { awards }, { adminAuth: true }),
  student: (student_id) => get(`/booth/student/${student_id}`, { adminAuth: true }),
  search:  (q) => get(`/booth/search?q=${encodeURIComponent(q)}`, { adminAuth: true }),
  awards:  (todayOnly = true, limit = 50) =>
    get(`/booth/awards?today_only=${todayOnly}&limit=${limit}`, { adminAuth: true }),
};

// ─── Sidequest — Ascent Coins (student-facing) ───────────────────────────────

export const coins = {
  balance:          () => get('/coins/balance'),
  history:          () => get('/coins/history'),
  leaderboard:      () => get('/coins/leaderboard'),
  powerHourStatus:  () => get('/coins/power-hour-status'),
  dispute:          (ledger_entry_id, description) =>
    post('/coins/dispute', { ledger_entry_id, description }),
  redeemSticker:    () => post('/coins/redeem-sticker', {}),
  activeDrops:      () => get('/coins/surprise-drops/active'),
  claimDrop:        (drop_id) => post('/coins/surprise-drops/claim', { drop_id }),
};

// ─── Sidequest — UGC submission (student-facing) ─────────────────────────────

export const ugc = {
  eligibility: () => get('/ugc/eligibility'),
  submit: ({ source_type, url, participant_2_id }) =>
    post('/ugc/submit', { source_type, url, participant_2_id }),
  confirmCollab:        (collab_id) =>
    post('/ugc/creator-collab/confirm', { collab_id }),
  pendingConfirmations: () => get('/ugc/pending-confirmations'),
};

// ─── QR Scan ──────────────────────────────────────────────────────────────────

// Frontend uses `scan_type` internally (entry / attendance / food). The backend
// accepts those as aliases and canonicalises to mode = collegeEntry / event / food.
// Food scans auto-assign the next meal slot on the backend — no meal picker
// required from the client.
export const qr = {
  scan: ({ user_id, scan_type, event_id }) =>
    post(
      '/qr/scan',
      { user_id, mode: scan_type, event_id },
      { adminAuth: true },
    ),
};
