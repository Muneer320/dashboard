# Ascent Dashboard Backend (FastAPI)

FastAPI backend for user identity, event participation, submissions, and QR validation.

## Stack

- FastAPI
- SQLAlchemy (async)
- PostgreSQL (Supabase-compatible)
- JWT auth (python-jose)
- uv for dependency + virtual environment management

## Setup (uv)

1. Install dependencies and create virtual environment:

```bash
uv sync
```

If you need a pip-compatible install path, use:

```bash
pip install -r requirements.txt
```

2. Configure environment:

```bash
copy .env.example .env
```

3. (Optional) Create tables on local DB:

```bash
uv run init-db
```

4. Run API server:

```bash
uv run ascent-api
```

5. Run tests:

```bash
uv run pytest
```

## Supabase Setup

Create the Supabase project before applying the SQL files in `migrations/sql/`.

Apply them in order through the Supabase SQL editor:

1. `migrations/sql/001_init_schema.sql`
2. `migrations/sql/002_seed_admin_user.sql` if you need a local/dev admin user
3. `migrations/sql/003_rate_limit_entries.sql`
4. `migrations/sql/004_rls_policies.sql`

Then copy the Supabase database connection string into `.env` as `DATABASE_URL`.

Configure storage for file submissions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (default: `submissions`)
- `SUPABASE_SIGNED_URL_EXPIRES_SECONDS`

## API Base URL

`/api/v1`

## Implemented Modules

- `auth`: login + me
- `admin`: Unstop sync
- `users`: read/update profile
- `events`: list/get/register
- `submissions`: submit for event phase
- `files`: signed file download handling
- `qr`: food + event scan flows
- `health`: service liveness

## Runtime Behavior

- JWTs include role claims for middleware checks.
- Background jobs run through the FastAPI lifespan and can be disabled in tests by setting `BACKGROUND_JOB_INTERVAL_SECONDS=0`.
- File submissions are uploaded to Supabase Storage and returned as signed URLs.
- QR scan rate limiting is persisted in PostgreSQL.
- Admin endpoints can activate, lock, and unlock event phases.
- Unstop sync can optionally send temporary credentials by SMTP when email settings are configured.

## Database URL Note

The backend normalizes plain `postgresql://` URLs to the asyncpg driver at runtime, so the database URL in `.env` can be the standard Supabase connection string format.

## Core Rules Enforced

- Per-event registration checks
- Phase active/locked checks
- Access-level checks (`ROUND1`/`FINAL`/`FULL`)
- Transactional dual updates for:
  - `users.events`
  - `events.participants`

## Migration Files Included

- `migrations/README.md`
- `migrations/sql/001_init_schema.sql`
- `migrations/sql/002_seed_admin_user.sql`
- `migrations/sql/003_rate_limit_entries.sql`
- `migrations/sql/004_rls_policies.sql`

## Supabase Manual Steps Still Required

- Run `migrations/sql/003_rate_limit_entries.sql` in the Supabase SQL editor.
- Run `migrations/sql/004_rls_policies.sql` if you want direct client-side Supabase access restrictions.
- Create the configured storage bucket in Supabase (default: `submissions`) if it does not exist.
- Configure SMTP settings in `.env` later if you want automatic credential emails.

## Test Coverage

- `uv run pytest`
- Covers route wiring, admin sync, admin phase controls, QR handling, submission parsing, background jobs, signed file storage, persistent rate limiting, and DB URL normalization.
