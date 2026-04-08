# Ascent Dashboard

Ascent Dashboard is the central platform for Ascent Techfest participants.
It powers user onboarding, event participation, submissions, and QR-based validation.

## Monorepo Structure

- `backend/`: FastAPI service (Python, uv, PostgreSQL/Supabase)
- `frontend/`: Dashboard web application (to be implemented)
- `docs/`: product and technical planning docs

## Current Status

- Backend foundation is implemented with FastAPI.
- Core modules are scaffolded: auth, users, events, submissions, qr.
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

### 2. Run backend

```bash
cd backend
uv run ascent-api
```

API base path: `/api/v1`

### 3. Optional DB table bootstrap (local)

```bash
cd backend
uv run init-db
```

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
