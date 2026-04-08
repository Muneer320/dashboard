# Ascent Dashboard

Ascent Dashboard is the central platform for Ascent Techfest participants.
It powers user onboarding, event participation, submissions, and QR-based validation.

## Monorepo Structure

- `backend/`: FastAPI service (Python, uv, PostgreSQL/Supabase)
- `frontend/`: Dashboard web application (to be implemented)
- `docs/`: product and technical planning docs

## Current Status

- Backend foundation is implemented with FastAPI.
- Core modules are implemented: auth, admin sync, users, events, submissions, files, qr.
- Background jobs, auth/role middleware, signed file uploads, persistent QR rate limiting, email hooks, and route-level/API tests are now included.
- Access-control and dual-update consistency rules are enforced in service logic.

## Tech Stack

- Backend: FastAPI, SQLAlchemy async, asyncpg, JWT
- Database: PostgreSQL (Supabase-compatible)
- Package and environment management: uv

## Quick Start

### 1. Backend setup

```bash
cd backend
uv sync
copy .env.example .env
```

### 2. Create the Supabase project first

Create the Supabase project before applying any SQL migrations.
You need the Supabase connection details to set `backend/.env` correctly.

### 3. Apply SQL migrations

Open the Supabase SQL editor and run the migration files in order:

1. `backend/migrations/sql/001_init_schema.sql`
2. `backend/migrations/sql/002_seed_admin_user.sql` if you want a local/dev admin user
3. `backend/migrations/sql/003_rate_limit_entries.sql`
4. `backend/migrations/sql/004_rls_policies.sql`

### 4. Run backend

```bash
cd backend
uv run ascent-api
```

API base path: `/api/v1`

The backend normalizes plain `postgresql://` URLs to the async driver at runtime, so the Supabase connection string in `backend/.env` can work as long as it points to the correct database.

### 5. Optional DB table bootstrap (local)

```bash
cd backend
uv run init-db
```

### 6. Run backend tests

```bash
cd backend
uv run pytest
```

The test suite covers route wiring, admin phase controls, the scheduled-job helpers, signed file storage, persistent rate limiting, and the Unstop sync flow.

## Implemented Backend Additions Since the First Cut

- Lifespan-managed background jobs for phase cleanup, rate-limit cleanup, and file-based Unstop sync.
- JWT role claims with middleware enforcement for admin and scanner routes.
- Multipart submission handling with signed file URLs and a file download endpoint.
- Admin phase activation/locking endpoints for event lifecycle control.
- API-level tests covering auth, events, submissions, admin sync, QR scanning, background jobs, signed storage, and persistent rate limiting.

## Supabase Note

- Run `backend/migrations/sql/004_rls_policies.sql` if you want RLS policies in Supabase for direct client access.
- The backend can keep using its existing database connection path.

## Documentation

See planning and architecture documents in `docs/`:

- `0. User & Event Dashboard_ Backend & System Design (Detailed PRD).md`
- `1. SystemOverview.md`
- `2. BackendArchitecture.md`
- `3. DatabaseAndModels.md`
- `4. APIandWorkflows.md`
- `5. ImplimentationPlan.md`

## Development Notes

- Keep backend logic authoritative; frontend should stay thin.
- For dual-structure updates (`users.events` and `events.participants`), always write both in one transaction.
- Enforce event-scoped access control for all protected operations.
- The SQLAlchemy models and the SQL migration files are intentionally aligned so the Supabase SQL editor can be used directly.
