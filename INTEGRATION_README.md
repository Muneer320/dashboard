# Ascent Dashboard — Integration README

How to run the frontend against the real FastAPI backend, where to look when things break, and what is wired vs still mocked.

For architecture detail see:
- `docs/BackendDocs/` — system overview, backend architecture, DB schema, API & workflows
- `docs/FrontendDocs/` — frontend architecture, component map, submission system detail

---

## Repo shape

```
Ascent Dashboard/
├── backend/              FastAPI, Python 3.13, uv, Supabase
│   ├── app/              routes, services, models, schemas
│   ├── migrations/sql/   001–022 sequential SQL scripts
│   └── tests/
├── frontend/             Vite + React 18, React Router v7
│   └── src/
│       ├── App.jsx           user app routes + admin mount at /admin/*
│       ├── components/       user-facing screens + submission form
│       ├── admin-panel/      separate React sub-app
│       └── lib/api.js        all API calls live here
├── docs/
│   ├── BackendDocs/      system overview, architecture, DB schema, API docs
│   └── FrontendDocs/     frontend architecture + component reference
└── INTEGRATION_README.md
```

> `frontend/components/` (at repo root level, outside `src/`) is a legacy copy — **do not edit it**. All active frontend code lives under `frontend/src/`.

The Mirage feature (`/mirage`) is owned by a separate developer. Do not touch `community.jsx::Mirage`.

---

## Running locally

### 1. Backend

```bash
cd backend
uv sync
cp .env.example .env    # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET_KEY
# Apply SQL migrations 001–022 in order via the Supabase SQL editor
uv run ascent-api
```

API listens on `http://localhost:8000`. Base path: `/api/v1`.
Swagger UI: `http://localhost:8000/docs`.

Migration order matters — run them sequentially. See `backend/migrations/sql/`.

> **Migration 022** (`022_test_submission_active.sql`) is a temporary test fixture. It creates
> `testplayer / password123`, activates phase 1 on Hacker's Quest, and registers the user.
> Run it against your dev/test DB only. A rollback block is included as SQL comments at the bottom.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite serves on `http://localhost:5173` and proxies `/api/*` to `http://localhost:8000` via
`vite.config.js`. No CORS configuration is needed in development.

### 3. Accounts

| Username | Password | Role |
|---|---|---|
| `superadmin` | `password123` | admin |
| `em1` / `em2` | `password123` | eventManager |
| `scanner1` | `password123` | Scanner |
| `user1` – `user15` | `password123` | user |
| `testplayer` | `password123` | user (migration 022 only) |

To create new event managers or scanners: `POST /api/v1/admin-panel/event-managers` (admin JWT required).

---

## Environment variables

### Backend (`backend/.env`)

| Var | Purpose |
|---|---|
| `API_V1_PREFIX` | Must be `/api/v1` — frontend proxy and API client both assume it |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase data + storage access |
| `JWT_SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT signing for user and admin flows |
| `SUPABASE_STORAGE_BUCKET`, `SUPABASE_SIGNED_URL_EXPIRES_SECONDS` | File storage config |
| `QR_RATE_LIMIT_PER_MINUTE` | `/qr/scan` rate limit per IP + per token |

### Frontend

| File | `VITE_API_BASE` |
|---|---|
| `.env.development` | `/api/v1` — goes through Vite proxy |
| `.env.production` | `https://api.your-domain.example/api/v1` |

---

## Auth and token storage

Two independent JWT tokens coexist in the same browser:

| Token | Issued by | Stored in | Used for |
|---|---|---|---|
| User token | `POST /auth/login` | `localStorage.ascent_token` | `/auth/me`, `/users/*`, `/events/*` |
| Admin token | `POST /auth/admin/login` | `localStorage.ascent_admin_token` | `/auth/admin/me`, `/admin-panel/*`, `/qr/scan` |

`api.js` selects the correct token via the `adminAuth: true` option on each call — not by URL inspection.

`AccessControlMiddleware` validates the JWT **before** any FastAPI dependency runs:

| Path pattern | Required JWT role |
|---|---|
| `/api/v1/admin*` | `admin` |
| `/api/v1/qr*` | `Scanner`, `eventManager`, or `admin` |
| All other `/api/v1/*` | any valid signed JWT |
| Health, docs, login | no JWT |

---

## Routing map

### User app (`src/App.jsx`)

| Path | Component | Status | Notes |
|---|---|---|---|
| `/` | `Landing` | ✅ static | |
| `/login` | `Login` | ✅ wired | Sends `{ email, password }` — backend accepts username value in the email field |
| `/credentials` | `Credentials` | ✅ wired | `POST /credentials-requests` |
| `/dashboard` | `Dashboard` | ✅ wired | Profile, registered events, meals, schedule, announcements |
| `/event-detail/:eventId` | `EventDetail` | ✅ wired | Phase timeline + question-based submission panel |
| `/explore` | `Explore` | ✅ wired | Event list + register |
| `/schedule` | `Schedule` | ⚠️ mock | Needs `GET /schedule/global` |
| `/leaderboard` | `Leaderboard` | ⚠️ mock | Needs leaderboard endpoint |
| `/announcements` | `Announcements` | ✅ wired | `GET /announcements` |
| `/lost-found` | `LostFound` | ⚠️ mock | Needs `GET/POST /lost-found` |
| `/rating` | `Rating` | ✅ wired | `POST /events/{id}/rating` |
| `/feedback` | `Feedback` | ✅ wired | `POST /feedback` |
| `/report` | `Report` | ⚠️ mock | Needs `POST /reports` |
| `/mirage` | `Mirage` | 🚫 out of scope | Separate developer |

### Admin panel (`src/admin-panel/App.jsx`, mounted at `/admin/*`)

| Path / Tab | Status | Endpoint |
|---|---|---|
| `/admin/login` | ✅ wired | `POST /auth/admin/login` |
| Overview | ✅ wired | `GET /admin-panel/stats`, `GET /admin-panel/events/stats` |
| Participants | ✅ wired | `GET /admin-panel/participants`, `PATCH .../restrict` |
| Scanner | ✅ wired | `GET .../lookup`, `POST /qr/scan` |
| My Events | ✅ wired | `GET /admin-panel/my-events` |
| Event Managers | ✅ wired | `GET/POST/PATCH/DELETE /admin-panel/event-managers` |

---

## Submission flow (end-to-end)

```
User opens EventDetail → selects a phase tab
  → SubmissionPanel mounts  (key remounts on phase change)
  → GET /events/{id}/questions?phase=N   (typed question list)
  → GET /events/{id}/submission?phase=N  (pre-fills if already submitted)

User fills form → clicks Submit
  → client-side validation (required, URL/email format, word limit, declarations)
  → POST /events/{id}/submit  { phase, answers: [{question_id, answer}] }
  → backend: validate_event_access() — registration, restriction, phase active/locked
  → backend: _validate_answers() — type-check each answer against question definition
  → write users.events[eventId].submission.phaseN  (user row first)
  → write events.participants[userId].submission.phaseN  (preserves score/feedback)
  → 201 → readonly view, teal dot appears on round tab
```

Phase gate: `is_active = true` AND `is_locked = false` in `event.rounds.phaseN`.
The frontend derives UI state (`LIVE` / `UPCOMING` / `LOCKED`) purely from these two flags.

---

## Smoke tests

```bash
# Backend health
curl http://localhost:8000/api/v1/health
# {"status":"ok"}

# User login
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"testplayer","password":"password123"}'
# {"access_token":"...","token_type":"bearer"}

# Fetch phase questions (sub in real TOKEN + EVENT_ID)
curl http://localhost:8000/api/v1/events/{EVENT_ID}/questions?phase=1 \
  -H 'Authorization: Bearer {TOKEN}'

# Full backend test suite
cd backend && uv run pytest
# 40 passed
```

---

## Common gotchas

| # | Gotcha | Fix |
|---|---|---|
| 1 | `AccessControlMiddleware` runs before `dependency_overrides` | Tests hitting protected routes must generate real signed JWTs via `create_access_token()` |
| 2 | Stale `frontend/components/` at repo root | Only edit `frontend/src/components/` |
| 3 | Login sends `email` field, value is actually the username | Backend `LoginRequest` uses `email` field name — do not change frontend without changing the schema too |
| 4 | Phase keys must be `phase1`, `phase2`, etc. | Lowercase, no spaces — enforced by backend regex `^phase\d+$` |
| 5 | Dual-write: user row first | A crash between the two writes is recoverable by re-submitting |
| 6 | `team_id` NOT NULL on `users` | May exist if migration 009 was not applied — migration 022 assigns testplayer to an existing team |
| 7 | `/qr/scan` is rate-limited | Return 429 cleanly in scanner UI |

---

## Where to find more

| Topic | Location |
|---|---|
| FastAPI schemas | `backend/app/schemas/*.py` |
| Service logic | `backend/app/services/*.py` |
| Middleware + role rules | `backend/app/core/middleware.py` |
| Question type definitions | `backend/app/schemas/question.py` |
| Submission validation | `backend/app/services/submission_service.py` |
| Frontend submission form | `frontend/src/components/submission.jsx` |
| API client | `frontend/src/lib/api.js` |
| Swagger UI | `http://localhost:8000/docs` |
| Backend tests | `cd backend && uv run pytest` |
