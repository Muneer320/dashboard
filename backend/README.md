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

## API Base URL

`/api/v1`

## Implemented Modules

- `auth`: login + me
- `users`: read/update profile
- `events`: list/get/register
- `submissions`: submit for event phase
- `qr`: food + event scan flows
- `health`: service liveness

## Core Rules Enforced

- Per-event registration checks
- Phase active/locked checks
- Access-level checks (`ROUND1`/`FINAL`/`FULL`)
- Transactional dual updates for:
  - `users.events`
  - `events.participants`
