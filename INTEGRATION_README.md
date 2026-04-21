# Ascent Dashboard — Integration README

How to run the frontend against the real FastAPI backend, where to look when things break, and what is currently mocked vs wired.

This document is the operational companion to:
- **`IMPLEMENTATION_PLAN.md`** — the staged plan for wiring everything up.
- **`API_GAPS.md`** — the catalog of endpoints that exist, endpoints that are missing, and endpoints that don't quite match.

Read `API_GAPS.md` first if you're deciding what to build next. Read this file when you want to _run_ the system.

---

## Repo shape

```
dashboard/
├── backend/          FastAPI · Python 3.12 · uv · SQLAlchemy-async · Supabase/Postgres
├── frontend/         Vite + React 18 · React Router 7
│   ├── src/
│   │   ├── App.jsx                user app routes + admin mount
│   │   ├── components/            user-facing screens (landing, auth, dashboard, explore, ...)
│   │   ├── admin-panel/           separate React sub-app for organizers
│   │   └── styles/
│   ├── .env                       Vite env (DO NOT commit real secrets)
│   └── vite.config.js             dev proxy → localhost:8000
├── docs/
│   ├── BackendDocs/               PRD, architecture, API & workflow docs
│   └── FrontendDocs/
├── IMPLEMENTATION_PLAN.md
├── API_GAPS.md
└── INTEGRATION_README.md          (this file)
```

The **Mirage** feature (photo archive at `/mirage`) is owned by a separate dev. It's imported in `App.jsx` and `community.jsx::Mirage`. Leave it alone during integration.

---

## Running locally

### 1. Backend

```bash
cd backend
uv sync
cp .env.example .env    # edit DATABASE_URL, JWT_SECRET_KEY, etc.
# Apply SQL migrations 001..007 in the Supabase SQL editor (order matters)
uv run ascent-api
```

The API listens on `http://localhost:8000`. Base path: `/api/v1`. OpenAPI at `http://localhost:8000/api/v1/openapi.json`, Swagger UI at `http://localhost:8000/docs`.

Details on migrations and the admin seed are in `backend/README.md`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite serves on `http://localhost:5173` and **proxies `/api/*` to `http://localhost:8000`** (see `vite.config.js`). That means frontend code can just call `/api/v1/...` and in both dev and prod it Just Works — no CORS dance.

### 3. Credentials

Today the admin panel reads demo accounts from `frontend/.env` (`VITE_USERS=...`). That's mock auth and will be removed once `Phase 1` of `IMPLEMENTATION_PLAN.md` lands.

After wiring, create real accounts via:
- `migrations/sql/002_seed_admin_user.sql` for the first superadmin.
- `POST /api/v1/admin-panel/event-managers` for event managers & scanners (admin-only).

---

## Environment variables

### Backend (`backend/.env`)

See `backend/.env.example`. The ones that matter for integration:

| Var | Purpose |
|---|---|
| `API_V1_PREFIX` | Must stay `/api/v1` — frontend proxy + API client assume this. |
| `DATABASE_URL` | Postgres or Supabase. Backend normalizes `postgresql://` → `postgresql+asyncpg://` at runtime. |
| `JWT_SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES` | Auth tokens — both user and admin use HS256. |
| `SUPABASE_*` | Only needed if you're using Supabase Storage for file uploads. |
| `QR_RATE_LIMIT_PER_MINUTE` | `/qr/scan` per-IP+token rate limit. |

### Frontend

Two env files after Phase 0:

| File | Used by |
|---|---|
| `.env.development` | `VITE_API_BASE=/api/v1` — goes through Vite proxy. |
| `.env.production` | `VITE_API_BASE=https://api.your-domain.example/api/v1` — direct. |

The current `frontend/.env` still contains `VITE_USERS=[...]` (mock accounts). That line is temporary and will be deleted as part of Phase 1.

---

## Auth & token storage

Two independent JWT tokens live side-by-side in the same browser:

| Token | Issued by | Stored as | Used for |
|---|---|---|---|
| User token | `POST /auth/login` | `sessionStorage.ascent_user_token` | `/auth/me`, `/users/*`, `/events/*` (user), `/events/*/submit` |
| Admin token | `POST /auth/admin/login` | `sessionStorage.ascent_admin_token` | `/auth/admin/me`, `/admin/*`, `/admin-panel/*`, `/qr/scan` |

`http.js` (the API wrapper) decides which token to attach based on the outgoing URL:

- Paths under `/admin-panel/`, `/auth/admin/`, `/admin/`, `/qr/` → use `ascent_admin_token`.
- Everything else → `ascent_user_token`.

Both tokens are `sessionStorage` (not `localStorage`) so they die with the tab. This matches what the mock `AuthContext` already does.

---

## Routing map

### User app (`src/App.jsx`)

| Path | Component | Backend-wired? | Notes |
|---|---|---|---|
| `/` | `Landing` | n/a | Static. |
| `/credentials` | `Credentials` | ⏳ blocked on `POST /credentials-requests` | Form collects name/college/email/phone/events. |
| `/login` | `Login` | ⏳ Phase 3 | "Email" label needs → "Username" (backend field is `username`). |
| `/dashboard` | `Dashboard` | ⏳ partial Phase 4 | `/auth/me` + `/events` wired; schedule, meal log, announcements, rank are mocks. |
| `/event-detail` | `EventDetail` | ⏳ Phase 4, also rename route to `/events/:id` | `/events/{id}` + submissions wired; team + seating are mocks. |
| `/explore` | `Explore` | ⏳ Phase 4 | `/events` wired; register button calls `/events/{id}/register`. |
| `/schedule` | `Schedule` | ❌ needs `GET /schedule` | Mock until backend. |
| `/leaderboard` | `Leaderboard` | ❌ needs `GET /leaderboard` | Mock until backend. |
| `/announcements` | `Announcements` | ❌ needs `GET /announcements` | Mock until backend. |
| `/lost-found` | `LostFound` | ❌ needs `GET/POST /lost-found` | Mock until backend. |
| `/rating` | `Rating` | ❌ needs ratings endpoints | Mock until backend. |
| `/feedback` | `Feedback` | ❌ needs `POST /feedback` | Mock until backend. |
| `/report` | `Report` | ❌ needs `POST /reports` + `GET /reports/me` | Mock until backend. |
| `/mirage` | `Mirage` | out of scope | Friend's feature. |

### Admin panel (`src/admin-panel/App.jsx`, mounted at `/admin/*`)

| Path | Component | Backend-wired? | Endpoint |
|---|---|---|---|
| `/admin/login` | `Login` | ⏳ Phase 1 | `POST /auth/admin/login` |
| `/admin/dashboard` | `Dashboard` shell | — | — |
| Overview tab | `tabs/Overview` | ⏳ Phase 2 | `GET /admin-panel/stats`, `GET /admin-panel/events/stats` |
| Participants tab | `tabs/Participants` | ⏳ Phase 2 | `GET /admin-panel/participants`, `PATCH /admin-panel/participants/{uid}/restrict` |
| Scanner tab | `tabs/Scanner` + `QrScanner` | ⏳ Phase 2 | `GET /admin-panel/participants/lookup`, `POST /qr/scan` (with `mode: entry \| event \| food`) |
| My Events tab | `tabs/MyEvents` | ⏳ Phase 2 | `GET /admin-panel/my-events` |
| Contact Info tab | `tabs/ContactInfo` | ⏳ Phase 2 | `GET /admin-panel/event-managers` (+ create/update/delete when the UI adds those) |

Legend: ✅ wired today (nothing yet), ⏳ planned, ❌ blocked on backend work, n/a static.

---

## Today's state at a glance

| Surface | Current backing | Phase to wire |
|---|---|---|
| User-facing app | 100% mock data, hardcoded JSX arrays | Phases 3–5 |
| Admin panel | `src/admin-panel/data.json` + `VITE_USERS` env | Phases 1–2 |
| Vite proxy | Configured, unused | Used from Phase 0 onwards |
| Auth | `sessionStorage.ascent_user` (admin side only), plain client-side compare | Replaced in Phases 1 + 3 |
| QR scanning | Local `.find()` in `QrScanner.jsx` | Replaced in Phase 2 |

---

## Verifying the integration

Once Phases 0–2 are done, here's a smoke test:

1. **Backend health** — `curl http://localhost:8000/api/v1/health` → `{"status":"ok"}`.
2. **Admin login** — from the browser, `/admin/login` with a seeded admin. Network tab should show `POST /api/v1/auth/admin/login` returning a token; `sessionStorage.ascent_admin_token` should be set.
3. **Admin data** — `/admin/dashboard` → Overview tab shows stat cards populated from `GET /api/v1/admin-panel/stats`. Counts should match what's in the database.
4. **Restrict a participant** — on the Participants tab, toggle a participant to restricted. Network shows `PATCH /admin-panel/participants/{uid}/restrict`. Refresh. State persists.
5. **QR scan (food)** — in the Scanner tab, pick food mode + Breakfast, enter a participant id. Network shows `POST /qr/scan`. Participant's `food.meal1` is set to `true` in the DB.

After Phases 3–4:

6. **User login** — `/login` with a real user. Network shows `POST /api/v1/auth/login` + the follow-up `GET /auth/me`.
7. **Dashboard** — greets the user by their real name. "Registered events" block is loaded from `GET /events`, not hardcoded.
8. **Event detail** — `/events/:id` loads real rounds. Drop a URL submission. Network shows `POST /events/{id}/submit` with `submission_type: "url"`. Refresh, state pre-fills from `GET /events/{id}/submission?phase=N`.

---

## Things that will trip you up

1. **Two coexisting JWTs.** If you accidentally send the user token to an admin endpoint you'll get a 401. `http.js` has to do the path-based routing of which token to attach (see `IMPLEMENTATION_PLAN.md` Phase 0).
2. **Stale `frontend/components/`.** There's a duplicate of the user components at `frontend/components/` (no `src/`). Nothing imports it, but ripgrep for `/api/` will hit both copies. Keep editing only `frontend/src/components/`.
3. **Route rename for event detail.** The app currently navigates to `/event-detail` and reads the event from hardcoded state. When you wire `GET /events/{id}`, rename the route to `/events/:id` and thread the id through. Do this once, early, or you'll touch every `navigate('/event-detail')` twice.
4. **Food meal slots.** Backend enforces `meal1 | meal2 | meal3`. The dashboard shows 4 slots (Breakfast / Lunch / Snacks / Dinner). See `API_GAPS.md` §4.1 — pick option A (extend to `meal4`) or B (drop a slot) before you wire the scanner.
5. **Login field naming.** Backend's `LoginRequest` is `username`. The user-facing login page is labeled "Email". Just relabel it — don't try to make the backend accept email as a secondary field unless you want a bigger change.
6. **Submission response shape.** `SubmissionResponse.submitted_at` is declared `datetime` in `backend/app/schemas/submission.py` but the submissions route hints the signed URL gets packed in there. Confirm with the backend dev before binding the UI to that field.
7. **`/qr/scan` is rate-limited.** 10 scans/minute per IP+token by default. If you're doing a stress test on the Scanner UI, expect 429s. Handle them with a clear toast.
8. **Cold-start admin account.** Before Phase 1 deletes `VITE_USERS`, insert real accounts into Supabase. The `002_seed_admin_user.sql` migration covers the admin; event managers and scanners come from `POST /admin-panel/event-managers`.
9. **Mirage is out of scope.** Don't touch `community.jsx::Mirage` or `/mirage`. It's a separate PR from a separate dev.

---

## Where to find more

- FastAPI schemas (request/response shapes): `backend/app/schemas/*.py`
- Middleware / role rules: `backend/app/core/middleware.py`
- Service layer (business logic): `backend/app/services/*.py`
- Swagger: `http://localhost:8000/docs` while backend runs.
- Backend tests: `cd backend && uv run pytest` — covers route wiring + auth + QR + submissions.
- Planning docs: `docs/BackendDocs/0..5`.
