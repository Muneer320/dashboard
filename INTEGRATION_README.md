# Ascent Dashboard - Integration README

How to run the frontend against the real FastAPI backend, where to look when things break, and what is currently mocked vs wired.

This document is the operational companion to:
- `IMPLEMENTATION_PLAN.md` - the staged plan for wiring everything up.
- `API_GAPS.md` - the catalog of endpoints that exist, endpoints that are missing, and endpoints that do not quite match.

Read `API_GAPS.md` first if you are deciding what to build next. Read this file when you want to run the system.

---

## Repo shape

```text
dashboard/
|-- backend/          FastAPI, Python 3.12, uv, Supabase
|-- frontend/         Vite + React 18, React Router 7
|   |-- src/
|   |   |-- App.jsx                user app routes + admin mount
|   |   |-- components/            user-facing screens
|   |   |-- admin-panel/           separate React sub-app for organizers
|   |   `-- styles/
|   |-- .env                       Vite env (do not commit real secrets)
|   `-- vite.config.js             dev proxy -> localhost:8000
|-- docs/
|   |-- BackendDocs/               PRD, architecture, API and workflow docs
|   `-- FrontendDocs/
|-- IMPLEMENTATION_PLAN.md
|-- API_GAPS.md
`-- INTEGRATION_README.md          (this file)
```

The Mirage feature (photo archive at `/mirage`) is owned by a separate developer. It is imported in `App.jsx` and `community.jsx::Mirage`. Leave it alone during integration.

---

## Running locally

### 1. Backend

```bash
cd backend
uv sync
cp .env.example .env    # edit SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET_KEY, etc.
# Apply SQL migrations 001..007 in the Supabase SQL editor (order matters)
uv run ascent-api
```

The API listens on `http://localhost:8000`. Base path: `/api/v1`. OpenAPI is at `http://localhost:8000/api/v1/openapi.json`, and Swagger UI is at `http://localhost:8000/docs`.

Details on migrations and the admin seed are in `backend/README.md`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite serves on `http://localhost:5173` and proxies `/api/*` to `http://localhost:8000` through `vite.config.js`. That lets frontend code call `/api/v1/...` in both dev and prod without extra CORS setup.

### 3. Credentials

Today the admin panel reads demo accounts from `frontend/.env` using `VITE_USERS=...`. That is mock auth and will be removed once Phase 1 of `IMPLEMENTATION_PLAN.md` lands.

After wiring, create real accounts via:
- `migrations/sql/002_seed_admin_user.sql` for the first superadmin.
- `POST /api/v1/admin-panel/event-managers` for event managers and scanners.

---

## Environment variables

### Backend (`backend/.env`)

See `backend/.env.example`. The ones that matter for integration:

| Var | Purpose |
|---|---|
| `API_V1_PREFIX` | Must stay `/api/v1` because the frontend proxy and API client assume it. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Required for backend data access and storage operations against Supabase. |
| `JWT_SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES` | Auth token settings for both user and admin flows. |
| `SUPABASE_STORAGE_BUCKET`, `SUPABASE_SIGNED_URL_EXPIRES_SECONDS` | Control Supabase Storage upload and signed URL behavior. |
| `QR_RATE_LIMIT_PER_MINUTE` | `/qr/scan` per-IP and per-token rate limit. |

### Frontend

Two env files after Phase 0:

| File | Used by |
|---|---|
| `.env.development` | `VITE_API_BASE=/api/v1` - goes through the Vite proxy. |
| `.env.production` | `VITE_API_BASE=https://api.your-domain.example/api/v1` - direct backend URL. |

The current `frontend/.env` still contains `VITE_USERS=[...]` for mock accounts. That line is temporary and should disappear as part of Phase 1.

---

## Auth and token storage

Two independent JWT tokens live side by side in the same browser:

| Token | Issued by | Stored as | Used for |
|---|---|---|---|
| User token | `POST /auth/login` | `sessionStorage.ascent_user_token` | `/auth/me`, `/users/*`, `/events/*`, `/events/*/submit` |
| Admin token | `POST /auth/admin/login` | `sessionStorage.ascent_admin_token` | `/auth/admin/me`, `/admin/*`, `/admin-panel/*`, `/qr/scan` |

`http.js` decides which token to attach based on the outgoing URL:

- Paths under `/admin-panel/`, `/auth/admin/`, `/admin/`, `/qr/` use `ascent_admin_token`.
- Everything else uses `ascent_user_token`.

Both tokens use `sessionStorage`, not `localStorage`, so they die with the tab. This matches what the mock `AuthContext` already does.

---

## Routing map

### User app (`src/App.jsx`)

| Path | Component | Backend-wired? | Notes |
|---|---|---|---|
| `/` | `Landing` | n/a | Static. |
| `/credentials` | `Credentials` | blocked on `POST /credentials-requests` | Form collects name, college, email, phone, and events. |
| `/login` | `Login` | Phase 3 | Label should be `Username`, not `Email`, because the backend field is `username`. |
| `/dashboard` | `Dashboard` | partial Phase 4 | `/auth/me` and `/events` wired; schedule, meal log, announcements, and rank are mocks. |
| `/event-detail` | `EventDetail` | Phase 4, also rename route to `/events/:id` | `/events/{id}` and submissions wired; team and seating are mocks. |
| `/explore` | `Explore` | Phase 4 | `/events` wired; register button calls `/events/{id}/register`. |
| `/schedule` | `Schedule` | needs `GET /schedule` | Mock until backend exists. |
| `/leaderboard` | `Leaderboard` | needs `GET /leaderboard` | Mock until backend exists. |
| `/announcements` | `Announcements` | needs `GET /announcements` | Mock until backend exists. |
| `/lost-found` | `LostFound` | needs `GET/POST /lost-found` | Mock until backend exists. |
| `/rating` | `Rating` | needs ratings endpoints | Mock until backend exists. |
| `/feedback` | `Feedback` | needs `POST /feedback` | Mock until backend exists. |
| `/report` | `Report` | needs `POST /reports` and `GET /reports/me` | Mock until backend exists. |
| `/mirage` | `Mirage` | out of scope | Separate feature owned by another developer. |

### Admin panel (`src/admin-panel/App.jsx`, mounted at `/admin/*`)

| Path | Component | Backend-wired? | Endpoint |
|---|---|---|---|
| `/admin/login` | `Login` | Phase 1 | `POST /auth/admin/login` |
| `/admin/dashboard` | `Dashboard` shell | n/a | n/a |
| Overview tab | `tabs/Overview` | Phase 2 | `GET /admin-panel/stats`, `GET /admin-panel/events/stats` |
| Participants tab | `tabs/Participants` | Phase 2 | `GET /admin-panel/participants`, `PATCH /admin-panel/participants/{uid}/restrict` |
| Scanner tab | `tabs/Scanner` + `QrScanner` | Phase 2 | `GET /admin-panel/participants/lookup`, `POST /qr/scan` with `mode: entry | event | food` |
| My Events tab | `tabs/MyEvents` | Phase 2 | `GET /admin-panel/my-events` |
| Contact Info tab | `tabs/ContactInfo` | Phase 2 | `GET /admin-panel/event-managers` plus create, update, and delete when the UI adds them |

Legend: wired today, planned, blocked on backend work, or static.

---

## Today's state at a glance

| Surface | Current backing | Phase to wire |
|---|---|---|
| User-facing app | Hardcoded and mock-heavy in places | Phases 3-5 |
| Admin panel | `src/admin-panel/data.json` plus `VITE_USERS` env | Phases 1-2 |
| Vite proxy | Configured | Used from Phase 0 onward |
| Auth | Mostly sessionStorage-based client flow | Replaced in Phases 1 and 3 |
| QR scanning | Local lookup in `QrScanner.jsx` | Replaced in Phase 2 |

---

## Verifying the integration

Once Phases 0-2 are done, use this smoke test:

1. Backend health: `curl http://localhost:8000/api/v1/health` should return `{"status":"ok"}`.
2. Admin login: `/admin/login` with a seeded admin should call `POST /api/v1/auth/admin/login` and set `sessionStorage.ascent_admin_token`.
3. Admin data: `/admin/dashboard` should populate Overview cards from `GET /api/v1/admin-panel/stats`.
4. Restrict a participant: the Participants tab should persist state through `PATCH /admin-panel/participants/{uid}/restrict`.
5. QR scan in food mode: the Scanner tab should call `POST /qr/scan` and update food state in the database.

After Phases 3-4:

6. User login: `/login` should call `POST /api/v1/auth/login` and then `GET /auth/me`.
7. Dashboard: it should greet the real user and load registered events from `GET /events`.
8. Event detail: `/events/:id` should load real rounds and submit through `POST /events/{id}/submit`.

---

## Things that will trip you up

1. Two coexisting JWTs. Sending a user token to an admin endpoint returns 401. `http.js` has to route the correct token by path.
2. Stale `frontend/components/`. There is a duplicate outside `frontend/src/components/`. Keep editing only the `src` copy.
3. Route rename for event detail. Rename to `/events/:id` early so you do not touch every navigation twice.
4. Food meal slots. Backend currently enforces `meal1 | meal2 | meal3` while the dashboard shows four slots.
5. Login field naming. The backend expects `username`, not email.
6. Submission response shape. Confirm the final contract before binding UI to `submitted_at`.
7. `/qr/scan` is rate-limited. Handle 429s cleanly in the UI.
8. Cold-start admin account. Insert real accounts into Supabase before deleting `VITE_USERS`.
9. Mirage is out of scope. Do not touch `community.jsx::Mirage` or `/mirage`.

---

## Where to find more

- FastAPI schemas: `backend/app/schemas/*.py`
- Middleware and role rules: `backend/app/core/middleware.py`
- Service layer: `backend/app/services/*.py`
- Swagger: `http://localhost:8000/docs`
- Backend tests: `cd backend && uv run pytest`
- Planning docs: `docs/BackendDocs/0..5`
