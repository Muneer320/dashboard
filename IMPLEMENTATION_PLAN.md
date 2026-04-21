# Frontend ↔ Backend Integration Plan

This is the concrete, staged plan for wiring `frontend/` to `backend/`. Read `API_GAPS.md` first — this document assumes you've accepted the gap list and the proposed endpoint shapes there.

**Scope:** everything except the `Mirage` photo gallery (owned by another dev).

**Principle:** ship admin panel first — it's 95% supported by the existing backend. Then tackle the user app, cutting over screen-by-screen. Don't gate shipping on the missing long-tail endpoints (leaderboard, reports, lost & found) — keep those screens on mock data behind a feature flag until the backend catches up.

---

## Phase 0 — Foundations (half a day)

All later phases depend on these files existing.

1. **Env config**
   - Create `frontend/.env.development`:
     ```
     VITE_API_BASE=/api/v1
     ```
     (Relative path — Vite dev server will proxy it via the existing `vite.config.js` proxy → `http://localhost:8000`.)
   - Create `frontend/.env.production`:
     ```
     VITE_API_BASE=https://api.ascent.example.com/api/v1
     ```
   - **Delete** the `VITE_USERS=[...]` line from `frontend/.env` — that was mock auth, now replaced by the backend. Keep the file (gitignored) for other secrets.

2. **HTTP client** — `frontend/src/lib/http.js` (new)
   - A thin wrapper around `fetch` that:
     - Prepends `import.meta.env.VITE_API_BASE`.
     - Attaches `Authorization: Bearer <token>` from `sessionStorage` (picks `ascent_admin_token` if inside `/admin/*` routes, else `ascent_user_token`).
     - Throws a typed `ApiError` with `status`, `code`, `message`, `body` on non-2xx.
     - Exposes `.get, .post, .patch, .del, .postForm` (for multipart).
   - Keep it in plain JS — no axios, no react-query yet. ~80 lines total.

3. **API modules** — `frontend/src/api/*.js` (new folder)
   - One module per domain. Each file exports typed-ish functions, one per endpoint. The UI never calls `http` directly — only these modules.
   - Files:
     - `api/auth.js` — `login`, `adminLogin`, `register`, `me`, `adminMe`, `logout` (client-side token clear).
     - `api/users.js` — `getUser`, `updateUser`, `getUserEvents`.
     - `api/events.js` — `listEvents`, `getEvent`, `register`, `getParticipants`, `submit`, `getSubmission`.
     - `api/qr.js` — `scan({ userId, mode, meal?, eventId? })`.
     - `api/adminPanel.js` — `getStats`, `getEventStats`, `getParticipants`, `restrict`, `lookup`, `getMyEvents`, `listEventManagers`, `createEventManager`, `updateEventManager`, `deleteEventManager`.
   - Everything returns plain JS objects matching the Pydantic schemas in `backend/app/schemas/`.

4. **Error toast component**
   - Add `frontend/src/components/ErrorToast.jsx` — a tiny component that reads a global error channel and renders a stacked toast. Both apps mount it once at the root. Lets every call site just `throw` and the UI surfaces it uniformly.

**Done when:** you can open `frontend/src/api/auth.js` in a script and run `await auth.login('admin', 'admin@ascent123')` against a live backend and see a token come back.

---

## Phase 1 — Admin panel auth (half a day)

Rewire **admin** login only — everything else in the admin panel can keep its current mock data until Phase 2.

1. `src/admin-panel/context/AuthContext.jsx`
   - Remove `const RAW_USERS = JSON.parse(import.meta.env.VITE_USERS || '[]')` and the `.find()` match.
   - `login(username, password)` → `await api.auth.adminLogin(...)`. On success, store `access_token` under `sessionStorage.ascent_admin_token`, then call `api.auth.adminMe()` and store the user object under `ascent_admin_user`.
   - `logout()` clears both keys.
   - Hydrate `useState` from `sessionStorage.ascent_admin_user` on mount; if a token exists but hydration yields null, call `adminMe` once to rehydrate.
   - `canAccess()` matrix stays identical — the role strings from the backend (`admin`, `eventManager`, `Scanner`, `superAdmin`) should be mapped to the frontend's three roles (`admin`, `event_manager`, `scanner`) in a small helper.

2. `src/admin-panel/components/Login.jsx`
   - No visual changes. Just `await` the new `login(...)`; remove the `setTimeout(500)` UX delay (real network is the delay now).
   - Kill the `Demo: admin / admin@ascent` hint.

3. Manual check:
   - Start backend.
   - Apply migrations 001–007.
   - Log in with a real admin username/password.
   - Log out, refresh, observe redirect to `/admin/login`.

**Done when:** admin login works end-to-end against the real backend, mock `VITE_USERS` is gone, and a hard refresh keeps the session.

---

## Phase 2 — Admin panel data (1 day)

Replace `DataContext.jsx` with real API calls. This is the highest-leverage change because **all admin tabs read from `useData()`**.

1. `src/admin-panel/context/DataContext.jsx`
   - Remove `import rawData from '../data.json'`.
   - On mount, fire these in parallel: `adminPanel.getStats()`, `adminPanel.getEventStats()`, `adminPanel.getParticipants()`, `adminPanel.listEventManagers()`, `adminPanel.getMyEvents()`.
   - Expose the responses as `stats`, `eventStats`, `participants`, `eventManagers`, `myEvents`.
   - Add a `refetch(scope?)` function. Mutations call it after success.

2. Mutations
   - `updateParticipantStatus(id, event_id, newStatus)` → `adminPanel.restrict(id, { event_id, restricted: newStatus === 'restricted' })` → `refetch('participants')`.
   - `markAttended / markFoodClaimed / markEntryScanned` → `qr.scan(...)` calls instead of local mutation:
     - Entry → `scan({ userId, mode: 'collegeEntry' })`
     - Attendance → `scan({ userId, mode: 'event', eventId })`
     - Food → `scan({ userId, mode: 'food', meal })` — needs a meal picker in the Scanner UI (see Phase 2.3 below).
   - After each scan, `refetch('participants')`.

3. Scanner UI — `src/admin-panel/components/QrScanner.jsx`
   - Replace the local `participants.find()` with a call to `adminPanel.lookup({ q: input })`. Matches by id / name / email are now the backend's problem.
   - In `Scanner.jsx` parent, add a meal picker (Breakfast / Lunch / Snacks / Dinner) visible only when the `food` sub-tab is active. Map labels → `meal1..meal3` (or request `meal4` — see `API_GAPS.md` §4.1).

4. Status string mapping
   - Backend returns `status: "active" | "restricted"`.
   - Frontend currently renders `"participating" | "restricted"`.
   - Add an adapter in `api/adminPanel.js`: map on the way in, map on the way out. Don't rename fields across the whole UI.

5. Remove `src/admin-panel/data.json` once every component is off it. Keep the file around in git history, not in the tree.

**Done when:**
- Every tab (Overview, Participants, Scanner, MyEvents, ContactInfo) renders live data.
- Restricting a participant persists across refresh.
- A QR scan writes to the database and the participants table updates on refresh.

---

## Phase 3 — User app auth (half a day)

1. Create `src/context/UserAuthContext.jsx` — parallel to the admin one but for the user-facing app.
   - `login(username, password)` → `auth.login(...)` → store `sessionStorage.ascent_user_token` + `ascent_user_profile`.
   - `me()` rehydrates on mount if a token exists.
   - `logout()` clears and navigates to `/login`.

2. Wrap `App.jsx` routes (non-admin) in `<UserAuthProvider>`.
   - Add a `<UserProtectedRoute>` for `/dashboard`, `/event-detail`, `/explore`, `/schedule`, `/leaderboard`, `/announcements`, `/lost-found`, `/rating`, `/feedback`, `/report`.
   - Leave `/`, `/login`, `/credentials`, `/mirage` public.

3. Rewire `src/components/auth.jsx`
   - **`Login`**: change the "Email" label + placeholder to "Username" (see `API_GAPS.md` §4.2). Wire the submit button to `userAuth.login(...)` → navigate to `/dashboard`.
   - **`Credentials`**: wire to a new endpoint `POST /credentials-requests`. **Blocked on backend** — until then, keep the `setSubmitted(true)` stub but switch the submit button to an `await api.credentials.request(form)` call that swallows the error and still shows the confirmation screen. That way once the backend lands, zero UI work is needed.

**Done when:** a user with real credentials can log in, refresh, and land on the dashboard without being redirected.

---

## Phase 4 — User app: events, submissions, profile (1 day)

These are the endpoints that already exist on the backend — highest ROI.

1. `src/components/dashboard.jsx`
   - Header name: `auth.me()` → `user.name`.
   - "Registered events" list: `events.listEvents()`. Keep only the first 3.
   - Food QR: render `user.id` as the QR payload (no new endpoint).
   - Remove the hardcoded arrays for events and schedule.
   - Leave Announcements / Meal Log / Rank cards on placeholder data with a `TODO` comment — Phase 5.

2. `src/components/discover.jsx` → `Explore`
   - Replace the local `events = [...]` array with `events.listEvents()`.
   - Swap the "Unstop ↗" button for a real `events.register(id)` call. Show a toast on success. Keep the `target="_blank"` unstop link as a fallback for events that require it.

3. `src/components/dashboard.jsx` → `EventDetail`
   - `events.getEvent(id)` on mount — `id` comes from the route. Change the route from `/event-detail` to `/events/:id` so the id is in the URL.
   - Rounds timeline: use `event.rounds` dict from the response.
   - Submission drop zone:
     - URL path: `events.submit(id, { submission_type: 'url', value })`.
     - File path: `events.submit(id, { submission_type: 'file', file })` via multipart.
     - On mount, also call `events.getSubmission(id, phase)` to pre-fill the "already submitted" state.
   - Team / seating cards: placeholders with TODO — Phase 5.

4. Profile (optional for v1)
   - No dedicated UI exists today. `users.getUser` / `users.updateUser` can wait.

**Done when:**
- `/dashboard` shows the logged-in user's real name and real registered events.
- `/explore` lists real events from the database; clicking Register actually registers them.
- `/events/:id` shows real rounds and accepts real submissions.

---

## Phase 5 — Long-tail features (depends on backend work)

Each of these waits on a backend endpoint listed in `API_GAPS.md` §5. Strategy: wire each screen behind a fallback — if the endpoint returns 404, render the current mock data. That way the screens don't regress while backend catches up, and cutting over is zero-diff when the endpoint ships.

Cut-over order (in diminishing order of user visibility):

1. **Announcements** — pure GET, easy backend. Wire `/announcements` + Dashboard widget.
2. **Schedule** — pure GET, Day/Venue filters client-side.
3. **Leaderboard** — pure GET, two types.
4. **Meal log** — user-visible food QR status.
5. **Rating + Review** — post-event.
6. **Feedback (anonymous)**.
7. **Report an issue** (multipart photo).
8. **Lost & Found** (multipart photo).
9. **Team roster** + **Seating** for event detail.
10. **Credentials request** (if backend goes with ticketing approach).

Each is 2–4 hours of frontend work once the endpoint exists.

---

## Phase 6 — Hardening

1. **Interceptor for 401** — on any 401 from a protected call, clear the relevant token and navigate to the right login page. Prevents zombie sessions.
2. **Optimistic UI for scans** — the current `setTimeout(800)` spinner in `QrScanner.jsx` should be replaced with real latency. Add an optimistic local flip of the participant row so scanners don't wait.
3. **Rate-limit handling** — `/qr/scan` is rate limited (backend middleware). On 429, show a clear "slow down" toast instead of a generic error.
4. **CORS** — backend needs `CORSMiddleware` for the production domain. Dev is fine via Vite proxy.
5. **Tests** — backend already has route tests. Add a thin `frontend/src/api/*.test.js` using `msw` to mock the endpoints and exercise each adapter.
6. **Type safety (optional)** — consider generating TS types from the backend's OpenAPI (`/api/v1/openapi.json`) via `openapi-typescript`. The frontend is JSX today, but even JSDoc-level types from OpenAPI would catch drift.

---

## Files that will change

Create:
- `frontend/.env.development`, `frontend/.env.production`
- `frontend/src/lib/http.js`
- `frontend/src/api/auth.js`
- `frontend/src/api/users.js`
- `frontend/src/api/events.js`
- `frontend/src/api/qr.js`
- `frontend/src/api/adminPanel.js`
- `frontend/src/api/credentials.js` (stub; real once backend lands)
- `frontend/src/components/ErrorToast.jsx`
- `frontend/src/context/UserAuthContext.jsx`

Edit:
- `frontend/.env` (remove `VITE_USERS`)
- `frontend/src/App.jsx` (wrap user routes in `UserAuthProvider`, add `UserProtectedRoute`, change `/event-detail` → `/events/:id`)
- `frontend/src/admin-panel/context/AuthContext.jsx` (real login)
- `frontend/src/admin-panel/context/DataContext.jsx` (real data, remove data.json import)
- `frontend/src/admin-panel/components/Login.jsx` (no UX delay)
- `frontend/src/admin-panel/components/QrScanner.jsx` (real lookup)
- `frontend/src/admin-panel/components/tabs/Scanner.jsx` (meal picker)
- `frontend/src/components/auth.jsx` (Login wired; Credentials wired once backend exists)
- `frontend/src/components/dashboard.jsx` (Dashboard + EventDetail live data)
- `frontend/src/components/discover.jsx` (Explore live data, real register)

Delete (eventually, once nothing reads them):
- `frontend/src/admin-panel/data.json`
- `frontend/components/` (this is a stale duplicate of `frontend/src/components/` — confirm no one imports from here, then delete)

Do not touch (Mirage — owned by another dev):
- `frontend/src/components/community.jsx::Mirage`
- `/mirage` route

---

## Risks & watch-outs

1. **Admin login token name clash** — the user app and admin panel will coexist in the same browser. Keep their tokens under distinct storage keys (`ascent_user_token` vs `ascent_admin_token`) and have `http.js` pick the right one by inspecting the URL of the outgoing request (paths under `/admin-panel/`, `/auth/admin/`, `/admin/` use admin token; everything else uses user token). Don't try to share a single token — the backend issues different JWT subjects.

2. **`/events` in two routers** — the backend registers both `events.py` and `submissions.py` under the `/events` prefix. That's fine for FastAPI, but when you write `api/events.js` remember the submission endpoints live in the same API module.

3. **Data migration for the demo accounts** — `VITE_USERS` contains five accounts the demo relies on (admin, scanner1, 3 event managers). Before deleting it, create these accounts in Supabase via `migrations/sql/002_seed_admin_user.sql` style or `POST /admin-panel/event-managers`. Otherwise the demo breaks.

4. **Submission "signed_url" shape** — the `SubmissionResponse` in `backend/app/schemas/submission.py` claims `submitted_at: datetime` but the route documentation suggests the signed URL is packed into it. Confirm with the backend dev before wiring — if that's actually the case, rename `submitted_at` to `download_url` on the server.

5. **Frontend has a stale `/frontend/components/` copy** — not imported anywhere currently, but keep an eye on your grep results. The live code is under `/frontend/src/components/`.

---

## Rough estimate

| Phase | Effort |
|---|---|
| 0. Foundations | 0.5 day |
| 1. Admin auth | 0.5 day |
| 2. Admin data | 1 day |
| 3. User auth | 0.5 day |
| 4. User events / submissions | 1 day |
| 5. Long-tail (each) | 2–4 h × ~9 features, gated on backend |
| 6. Hardening | 1 day |

Phases 0–4 are ~3.5 developer-days and ship a functioning MVP where the admin panel is fully live and the user app's core loop (login → dashboard → explore → register → submit) works against the real backend. Everything else can land incrementally.
