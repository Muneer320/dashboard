/**
 * api.js - Ascent API client
 *
 * Base URL is read from VITE_API_BASE in .env (defaults to /api/v1).
 * In development, Vite proxies /api/* to BACKEND_URL (set in .env).
 * In production, set VITE_API_BASE to your hosted API URL.
 *
 * Tokens:
 *   User  -> localStorage key: "ascent_token"
 *   Admin -> localStorage key: "ascent_admin_token"
 */

const BASE = (import.meta.env.VITE_API_BASE || '/api/v1').replace(/\/$/, '');

export const token = {
  getUser: () => localStorage.getItem('ascent_token'),
  setUser: (t) => localStorage.setItem('ascent_token', t),
  clearUser: () => localStorage.removeItem('ascent_token'),

  getAdmin: () => localStorage.getItem('ascent_admin_token'),
  setAdmin: (t) => localStorage.setItem('ascent_admin_token', t),
  clearAdmin: () => localStorage.removeItem('ascent_admin_token'),
};

async function request(path, { method = 'GET', body, adminAuth = false } = {}) {
  const tok = adminAuth ? token.getAdmin() : token.getUser();
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = `Bearer ${tok}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined
      ? { body: isFormData ? body : JSON.stringify(body) }
      : {}),
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({ detail: res.statusText }));

  if (!res.ok) {
    if (res.status === 401) {
      const inAdminArea = window.location.pathname.startsWith('/admin');
      if (inAdminArea) {
        token.clearAdmin();
        if (!window.location.pathname.startsWith('/admin/login')) {
          window.location.href = '/admin/login';
        }
      } else {
        token.clearUser();
        const safePaths = ['/login', '/'];
        const alreadyOnSafePage = safePaths.some(
          (p) => window.location.pathname === p || window.location.pathname.startsWith('/login'),
        );
        if (!alreadyOnSafePage) {
          window.location.href = '/login';
        }
      }
    }
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

const get = (path, opts) => request(path, { ...opts, method: 'GET' });
const post = (path, body, opts) => request(path, { ...opts, method: 'POST', body });
const patch = (path, body, opts) => request(path, { ...opts, method: 'PATCH', body });
const put = (path, body, opts) => request(path, { ...opts, method: 'PUT', body });
const del = (path, opts) => request(path, { ...opts, method: 'DELETE' });

export const auth = {
  login: ({ email, password }) => post('/auth/login', { email, password }),
  me: () => get('/auth/me'),
  visitorSignup: (body) => post('/auth/visitor-signup', body),
};

export const adminAuth = {
  login: ({ username, password }) =>
    post('/auth/admin/login', { username, password }, { adminAuth: true }),
  me: () => get('/auth/admin/me', { adminAuth: true }),
};

export const users = {
  get: (id) => get(`/users/${id}`),
  patch: (id, body) => patch(`/users/${id}`, body),
  events: (id) => get(`/users/${id}/events`),
  meals: (id) => get(`/users/${id}/meals`),
  myEvents: () => get('/users/me/my-events'),
  myLeaderboard: (options = 100) => {
    if (typeof options === 'number') {
      return get(`/users/me/leaderboard?top_limit=${encodeURIComponent(options)}`);
    }
    const {
      topLimit = 100,
      page = 1,
      pageSize,
      search,
    } = options || {};
    const params = new URLSearchParams();
    params.set('top_limit', String(topLimit));
    params.set('page', String(page));
    if (pageSize != null) params.set('page_size', String(pageSize));
    if (search && String(search).trim()) params.set('search', String(search).trim());
    return get(`/users/me/leaderboard?${params.toString()}`);
  },
  mirageProfile: () => get('/users/me/mirage/profile'),
  uploadMirageImage: (file, poseLabel = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (poseLabel) formData.append('pose_label', poseLabel);
    return post('/users/me/mirage/images', formData);
  },
  deleteMirageImage: (imageId) => del(`/users/me/mirage/images/${imageId}`),
  submitMirageProfile: (consentEnabled) =>
    post('/users/me/mirage/profile/submit', { consentEnabled }),
};

export const events = {
  list: () => get('/events'),
  publicList: () => get('/events/public'),
  get: (id) => get(`/events/${id}`),
  register: (id) => post(`/events/${id}/register`, {}),
  myTeam: (id) => get(`/events/${id}/my-team`),
  submit: (id, { phase, answers }) => post(`/events/${id}/submit`, { phase, answers }),
  submission: (id, phase) => get(`/events/${id}/submission?phase=${phase}`),
  questions: (id, phase) => get(`/events/${id}/questions?phase=${phase}`),
  setQuestions: (id, body) => put(`/events/${id}/questions`, body, { adminAuth: true }),
  rating: (id, { value, feedback }) => post(`/events/${id}/rating`, { value, feedback }),
  myRating: (id) => get(`/events/${id}/rating/me`),
  ratingSummary: (id) => get(`/events/${id}/rating/summary`),
};

export const schedule = {
  global: () => get('/schedule/global'),
  byDate: (date) => get(`/schedule/global/${date}`),
  forEvent: (id) => get(`/schedule/events/${id}`),
};

export const announcements = {
  list: (limit = 50) => get(`/announcements?limit=${limit}`),
};

export const feedback = {
  submit: (body) => post('/feedback', body),
};

export const mirage = {
  overview: () => get('/mirage/overview'),
  gallery: () => get('/mirage/gallery'),
  collection: (collectionId) => get(`/mirage/collections/${collectionId}`),
  momentHero: () => get('/mirage/moment'),
  searchPeople: (query, limit = 8) => {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return get(`/mirage/search/people?${params.toString()}`);
  },
  searchParticipant: (userId) => get(`/mirage/search/people/${userId}`),
  myPhotos: () => get('/mirage/me/photos'),
  toggleLike: (photoId) => post(`/mirage/photos/${photoId}/like`, {}),
};

export const credentials = {
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

  events: () =>
    fetch(`${BASE}/credentials-requests/events`).then(async (r) => {
      const d = await r.json().catch(() => ([]));
      if (!r.ok) throw new ApiError(d?.detail ?? 'Could not load events', r.status, d);
      return Array.isArray(d) ? d : [];
    }),
};

export const adminPanel = {
  stats: () => get('/admin-panel/stats', { adminAuth: true }),
  eventsStats: () => get('/admin-panel/events/stats', { adminAuth: true }),
  participants: (eventId) =>
    get(`/admin-panel/participants${eventId ? `?event_id=${eventId}` : ''}`, { adminAuth: true }),

  lookup: (params) => {
    const q = new URLSearchParams(params).toString();
    return get(`/admin-panel/participants/lookup?${q}`, { adminAuth: true });
  },

  myEvents: () => get('/admin-panel/my-events', { adminAuth: true }),
  adminUsers: () => get('/admin-panel/admin-users', { adminAuth: true }),

  restrictParticipant: (userId, eventId, restricted) =>
    patch(`/admin-panel/participants/${userId}/restrict`, { event_id: eventId, restricted }, { adminAuth: true }),

  addAdminUser: (body) => post('/admin-panel/admin-users', body, { adminAuth: true }),
  updateAdminUser: (uid, body) => patch(`/admin-panel/admin-users/${uid}`, body, { adminAuth: true }),
  deleteAdminUser: (uid) => del(`/admin-panel/admin-users/${uid}`, { adminAuth: true }),
  restoreAdminUser: (uid) => post(`/admin-panel/admin-users/${uid}/restore`, {}, { adminAuth: true }),

  getEvent: (eventId) => get(`/admin-panel/events/${eventId}`, { adminAuth: true }),
  updateEvent: (eventId, body) => patch(`/admin-panel/events/${eventId}`, body, { adminAuth: true }),

  eventsMealsCount: () => get('/admin-panel/events/meals-count', { adminAuth: true }),
  setEventMealsCount: (eventId, mealsCount) =>
    patch(`/admin-panel/events/${eventId}/meals-count`, { meals_count: mealsCount }, { adminAuth: true }),
  foodStats: () => get('/admin-panel/meals/food-stats', { adminAuth: true }),
  userMeals: () => get('/admin-panel/meals/users', { adminAuth: true }),
  addUserMeal: (userId, mealId) =>
    post(`/admin-panel/meals/users/${userId}/${mealId}`, {}, { adminAuth: true }),
  removeUserMeal: (userId, mealId) =>
    del(`/admin-panel/meals/users/${userId}/${mealId}`, { adminAuth: true }),

  requestedMembers: (statusFilter) => {
    const q = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : '';
    return get(`/admin-panel/requested-members${q}`, { adminAuth: true });
  },
  setRequestedMemberStatus: (id, newStatus) =>
    patch(`/admin-panel/requested-members/${id}`, { status: newStatus }, { adminAuth: true }),

  findUncoveredUsers: (emails) =>
    post('/admin-panel/uncovered-users', { emails }, { adminAuth: true }),
  regenerateUncovered: (userIds) =>
    post('/admin-panel/uncovered-users/regenerate', { user_ids: userIds }, { adminAuth: true }),

  manualEnroll: (body) =>
    post('/admin-panel/registrations/manual', body, { adminAuth: true }),

  teamLookup: (email, eventId) =>
    get(`/admin-panel/team/lookup?email=${encodeURIComponent(email)}&event_id=${encodeURIComponent(eventId)}`, { adminAuth: true }),

  removeTeamMember: (teamId, userId, eventId) =>
    post('/admin-panel/team/remove-member', { team_id: teamId, user_id: userId, event_id: eventId }, { adminAuth: true }),

  resetPassword: (email, newPassword) =>
    post('/admin-panel/users/reset-password', { email, new_password: newPassword }, { adminAuth: true }),

  selectPhase: (eventId, emails) =>
    post('/admin-panel/registrations/select-phase', { event_id: eventId, emails }, { adminAuth: true }),

  downloadSubmissions: async (eventId) => {
    const tok = token.getAdmin();
    const res = await fetch(`${BASE}/admin-panel/events/${eventId}/submissions/download`, {
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new ApiError(d?.detail ?? `HTTP ${res.status}`, res.status, d);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename=([^;]+)/);
    const filename = match ? match[1].trim() : `submissions_${eventId.slice(0, 8)}.csv`;
    return { blobUrl: URL.createObjectURL(blob), filename };
  },

  mirageMomentsList: () => get('/admin-panel/mirage/moments', { adminAuth: true }),

  mirageMomentGet: (momentId) => get(`/admin-panel/mirage/moments/${momentId}`, { adminAuth: true }),

  mirageMomentCreate: (body) =>
    post('/admin-panel/mirage/moments', body, { adminAuth: true }),

  mirageMomentPatch: (momentId, body) =>
    patch(`/admin-panel/mirage/moments/${momentId}`, body, { adminAuth: true }),

  mirageMomentUploadImages: (momentId, files) => {
    const fd = new FormData();
    for (const f of files) fd.append('images', f);
    return post(`/admin-panel/mirage/moments/${momentId}/images`, fd, { adminAuth: true });
  },

  mirageMomentPublish: (momentId) =>
    post(`/admin-panel/mirage/moments/${momentId}/publish`, {}, { adminAuth: true }),

  mirageMomentUnpublish: (momentId) =>
    post(`/admin-panel/mirage/moments/${momentId}/unpublish`, {}, { adminAuth: true }),

  mirageMomentDelete: (momentId) =>
    del(`/admin-panel/mirage/moments/${momentId}`, { adminAuth: true }),

  mirageMomentImagePatch: (imageId, body) =>
    patch(`/admin-panel/mirage/moment-images/${imageId}`, body, { adminAuth: true }),

  mirageMomentImageDelete: (imageId) =>
    del(`/admin-panel/mirage/moment-images/${imageId}`, { adminAuth: true }),
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
  reverificationQueue: (hours = 24) => get(`/admin/ugc/reverification-queue?hours=${hours}`, { adminAuth: true }),

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
  studentsOverview: (search = '') => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return get(`/admin/coins/students${q}`, { adminAuth: true });
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
  reserveReward:    (tier) => post('/coins/reserve-reward', { tier }),
  myReservations:   () => get('/coins/my-reservations'),
  activeDrops:      () => get('/coins/surprise-drops/active'),
  claimDrop:        (drop_id) => post('/coins/surprise-drops/claim', { drop_id }),
};

// ─── Sidequest — UGC submission (student-facing) ─────────────────────────────

async function uploadFile(path, file) {
  const tok = token.getUser();
  const formData = new FormData();
  formData.append('file', file);
  const headers = {};
  if (tok) headers['Authorization'] = `Bearer ${tok}`;
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: formData });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new ApiError(data?.detail ?? `HTTP ${res.status}`, res.status, data);
  return data;
}

export const ugc = {
  eligibility: () => get('/ugc/eligibility'),
  uploadProof: (file) => uploadFile('/ugc/upload-proof', file),
  submit: ({ source_type, url, proof_type = 'url', participant_2_id }) =>
    post('/ugc/submit', { source_type, url, proof_type, participant_2_id }),
  confirmCollab:        (collab_id) =>
    post('/ugc/creator-collab/confirm', { collab_id }),
  pendingConfirmations: () => get('/ugc/pending-confirmations'),
};

// ─── Redemption Booth ─────────────────────────────────────────────────────────

export const redemptionApi = {
  getStudent:  (student_id) => get(`/redemption/student/${student_id}`, { adminAuth: true }),
  searchStudents: (q) => get(`/redemption/search?q=${encodeURIComponent(q)}`, { adminAuth: true }),
  award:       (reservation_id) =>
    post('/redemption/award', { reservation_id }, { adminAuth: true }),
  history:     () => get('/redemption/history', { adminAuth: true }),
};

// ─── QR Scan ──────────────────────────────────────────────────────────────────

// Frontend uses `scan_type` internally (entry / attendance / food). The backend
// accepts those as aliases and canonicalises to mode = collegeEntry / event / food.
// Food scans auto-assign the next meal slot on the backend — no meal picker
// required from the client.
export const qr = {
  scan: ({ user_id, scan_type, event_id }) =>
    post('/qr/scan', { user_id, mode: scan_type, event_id }, { adminAuth: true }),
};
