# Ascent Dashboard Backend

[![FastAPI](https://img.shields.io/badge/FastAPI-0F766E?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![uv](https://img.shields.io/badge/uv-111827?style=for-the-badge&logo=uv&logoColor=white)](https://docs.astral.sh/uv/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![pytest](https://img.shields.io/badge/pytest-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white)](https://docs.pytest.org/)

Backend service for the Ascent Dashboard platform. It provides authentication, user profile management, event browsing and registration, participant visibility, submission uploads, QR scan handling, rate limiting, admin workflows, and optional Unstop synchronization.

The service is designed to run against Supabase PostgreSQL and Supabase Storage, with FastAPI acting as the application boundary and business-rule enforcement layer.

## Overview

This backend was implemented from the project documentation and is now the primary runtime for the dashboard backend. The current codebase includes:

- JWT-based authentication with role claims.
- User registration, login, profile retrieval, and profile updates.
- Event listing, event details, registration, and participant lookup.
- Submission upload handling via Supabase Storage signed URLs.
- QR scan handling with persistent rate limiting in PostgreSQL.
- Admin endpoints for Unstop synchronization and event phase control.
- Background jobs for periodic cleanup and sync work.
- SQL migrations for schema, rate limiting, RLS, and storage bucket setup.

## Architecture

```mermaid
flowchart LR
    Client[Dashboard / Admin / Scanner Clients] --> API[FastAPI Application]
    API --> Middleware[Access Control Middleware]
    API --> Services[Service Layer]
    Services --> DB[(Supabase PostgreSQL)]
    Services --> Storage[(Supabase Storage)]
    Services --> SMTP[SMTP Provider]
    Services --> Jobs[Background Jobs]
    Jobs --> DB
    Jobs --> Unstop[Unstop Source]
```

```mermaid
sequenceDiagram
    participant C as Client
    participant A as FastAPI
    participant S as Service Layer
    participant D as PostgreSQL
    participant B as Supabase Storage

    C->>A: Request login, event access, upload, or scan
    A->>A: Authenticate and enforce access rules
    A->>S: Invoke route-specific service
    S->>D: Read or write relational / JSONB data
    alt File upload
        S->>B: Upload to private bucket
        B-->>S: Signed URL response
    end
    S-->>A: Domain response
    A-->>C: JSON response
```

## Technology Stack

| Layer                 | Technology                      | Purpose                                     |
| --------------------- | ------------------------------- | ------------------------------------------- |
| API framework         | FastAPI                         | HTTP routing, dependency injection, OpenAPI |
| Runtime               | Python                          | Application runtime                         |
| Dependency management | uv                              | Virtual environment and package management  |
| ORM                   | SQLAlchemy async                | Database models and queries                 |
| Database driver       | asyncpg                         | Async PostgreSQL connectivity               |
| Auth                  | python-jose + passlib           | JWT and password hashing                    |
| Database              | Supabase PostgreSQL             | Primary persistent storage                  |
| File storage          | Supabase Storage                | Private submission uploads                  |
| Testing               | pytest + pytest-asyncio + httpx | Unit and API tests                          |

## What Is Implemented

### Application modules

| Module      | Responsibility                                           |
| ----------- | -------------------------------------------------------- |
| auth        | Register, login, and current-user flow                   |
| users       | Profile operations, user events, and access lookup       |
| events      | Event list, event detail, registration, and participants |
| submissions | Submission upload and submission retrieval               |
| qr          | QR scan processing and rate-limited access               |
| admin       | Unstop sync and event phase control                      |
| health      | Liveness endpoint                                        |

### Service layer

| Service            | Responsibility                          |
| ------------------ | --------------------------------------- |
| auth_service       | Authentication and token issuance       |
| user_service       | User-domain operations                  |
| event_service      | Registration and participant management |
| submission_service | Submission ingestion and persistence    |
| file_storage       | Supabase file upload and signed URLs    |
| qr_service         | QR validation and scan logic            |
| rate_limit_service | Persistent request limiting             |
| background_jobs    | Periodic sync and cleanup loop          |
| email_service      | SMTP email delivery helper              |
| unstop_service     | Unstop data import/update support       |
| access_control     | Shared role and access helpers          |

### Data model summary

| Table              | Purpose                                                               |
| ------------------ | --------------------------------------------------------------------- |
| users              | User profile, auth metadata, role, access level, and dashboard fields |
| events             | Event metadata, participants, rounds, and rules                       |
| rate_limit_entries | Persistent QR rate-limit state                                        |

The schema intentionally uses JSONB in places where the dashboard needs flexible nested data, while still keeping relational tables for identities and control data.

## API Surface

All routes are mounted under the version prefix defined by `API_V1_PREFIX`, currently `/api/v1`.

| Method | Path                                                    | Purpose                         |
| ------ | ------------------------------------------------------- | ------------------------------- |
| GET    | /api/v1/health                                          | Service health check            |
| POST   | /api/v1/auth/login                                      | Login and issue a JWT           |
| POST   | /api/v1/auth/register                                   | Create a new user               |
| GET    | /api/v1/auth/me                                         | Return the authenticated user   |
| GET    | /api/v1/users/{user_id}                                 | Fetch a user profile            |
| PATCH  | /api/v1/users/{user_id}                                 | Update a user profile           |
| GET    | /api/v1/users/{user_id}/events                          | Get events linked to a user     |
| GET    | /api/v1/users/{user_id}/access                          | Get user access summary         |
| GET    | /api/v1/events                                          | List events                     |
| GET    | /api/v1/events/{event_id}                               | Get event details               |
| POST   | /api/v1/events/{event_id}/register                      | Register a user for an event    |
| GET    | /api/v1/events/{event_id}/participants                  | List event participants         |
| POST   | /api/v1/events/{event_id}/submit                        | Upload a submission             |
| GET    | /api/v1/events/{event_id}/submission                    | Fetch the current submission    |
| POST   | /api/v1/qr/scan                                         | Process a QR scan               |
| POST   | /api/v1/admin/unstop/sync                               | Sync data from an Unstop source |
| POST   | /api/v1/admin/events/{event_id}/phases/{phase}/activate | Activate a phase                |
| POST   | /api/v1/admin/events/{event_id}/phases/{phase}/lock     | Lock a phase                    |
| POST   | /api/v1/admin/events/{event_id}/phases/{phase}/unlock   | Unlock a phase                  |

## Environment Variables

Settings are loaded from `backend/.env` through Pydantic settings.

| Variable                            | Default                                                      | Purpose                             | Required        |
| ----------------------------------- | ------------------------------------------------------------ | ----------------------------------- | --------------- |
| PROJECT_NAME                        | Ascent Dashboard Backend                                     | FastAPI app title                   | No              |
| VERSION                             | 0.1.0                                                        | App version shown in OpenAPI        | No              |
| API_V1_PREFIX                       | /api/v1                                                      | Base API prefix                     | No              |
| DATABASE_URL                        | postgresql+asyncpg://archive:archive-local-only@127.0.0.1:5432/archive_demo | PostgreSQL connection string        | Yes             |
| JWT_SECRET_KEY                      | change-this-in-env                                           | JWT signing key                     | Yes             |
| JWT_ALGORITHM                       | HS256                                                        | JWT algorithm                       | No              |
| ACCESS_TOKEN_EXPIRE_MINUTES         | 60                                                           | Token lifetime                      | No              |
| SUPABASE_URL                        | None                                                         | Supabase project URL                | Yes for uploads |
| SUPABASE_SERVICE_ROLE_KEY           | None                                                         | Supabase service role key           | Yes for uploads |
| SUPABASE_STORAGE_BUCKET             | submissions                                                  | Storage bucket name                 | Yes for uploads |
| SUPABASE_SIGNED_URL_EXPIRES_SECONDS | 604800                                                       | Signed URL lifetime                 | No              |
| BACKGROUND_JOB_INTERVAL_SECONDS     | 300                                                          | Background loop interval            | No              |
| UNSTOP_SYNC_SOURCE_JSON             | None                                                         | Optional local JSON source for sync | No              |
| QR_RATE_LIMIT_PER_MINUTE            | 10                                                           | QR scan limit                       | No              |
| QR_RATE_LIMIT_WINDOW_SECONDS        | 60                                                           | QR rate-limit window                | No              |
| SMTP_HOST                           | None                                                         | SMTP server hostname                | Optional        |
| SMTP_PORT                           | 587                                                          | SMTP server port                    | Optional        |
| SMTP_USERNAME                       | None                                                         | SMTP auth username                  | Optional        |
| SMTP_PASSWORD                       | None                                                         | SMTP auth password                  | Optional        |
| SMTP_USE_TLS                        | true                                                         | Enable STARTTLS                     | Optional        |
| SMTP_FROM_EMAIL                     | None                                                         | Sender email address                | Optional        |

## Setup

### 1. Install dependencies

```bash
uv sync
```

If you need a pip-compatible install path:

```bash
pip install -r requirements.txt
```

### 2. Configure environment

Create a local environment file:

```bash
copy .env.example .env
```

Populate the required values, especially `DATABASE_URL` and `JWT_SECRET_KEY`.

### 3. Run migrations in Supabase

Apply the SQL files in order through the Supabase SQL editor:

1. `migrations/sql/001_init_schema.sql`
2. `migrations/sql/002_seed_admin_user.sql` (optional, local/dev only)
3. `migrations/sql/003_rate_limit_entries.sql`
4. `migrations/sql/004_rls_policies.sql`
5. `migrations/sql/005_create_submissions_bucket.sql`
6. `migrations/sql/006_update_users_schema.sql`
7. `migrations/sql/007_update_user_roles.sql`

### 4. Run the application

```bash
uv run ascent-api
```

### 5. Run the tests

```bash
uv run pytest
```

## Supabase Configuration

### Database

The backend expects a PostgreSQL database compatible with Supabase. At runtime, the database URL is normalized to use the asyncpg driver when needed, so a standard Supabase connection string can be copied into `DATABASE_URL`.

### Storage

Submission files are stored in a private Supabase Storage bucket named `submissions` by default.

The flow is:

1. Receive an upload request.
2. Upload the file to the configured bucket using the service role key.
3. Generate a signed URL.
4. Return the signed URL to the client.

The migration in `migrations/sql/005_create_submissions_bucket.sql` creates the private bucket. The current backend flow does not require a public bucket.

### RLS

The repository includes `migrations/sql/004_rls_policies.sql` for direct client-side Supabase access control. The backend itself uses its own database connection path, so RLS is mainly for hardening direct Supabase access.

## QR Scanning Flow

The backend provides a unified endpoint (`POST /api/v1/qr/scan`) to handle QR code scans for participant activities.

### Authorization and Rate Limiting
- **Roles:** The endpoint requires the caller to hold one of the following roles: `scanner`, `admin`, `superAdmin`, `eventManage`, or `EM`.
- **Rate Limiting:** Scans are subjected to persistent, database-backed rate limiting (configurable via `QR_RATE_LIMIT_PER_MINUTE`) to prevent abuse and spam scanning.

### Scan Modes

The request payload accepts three different `mode` values:

1. **`collegeEntry`**: Marks the user's initial arrival. Toggles the `is_attending` flag on their profile to `true`.
2. **`event`**: Marks a user's attendance for a specific event. Requires an `event_id` and verifies that the user is in the event's `participants` dictionary before toggling `isAttending` to `true` within their participant record.
3. **`food`**: Marks meal consumption. Requires a `meal` identifier (e.g., `meal1`). Updates the user's `food` JSONB dictionary.

### Response Behavior
The endpoint evaluates the backend's action and returns an `accepted` status if the flag was successfully set. It returns `rejected` if the user was already marked for that specific mode (e.g., already scanned for the event, or already consumed the meal).

## Runtime Behavior

- Authentication uses hashed passwords and JWTs with embedded role claims.
- Access control is enforced in middleware and shared service helpers.
- Event registration updates both user and event records transactionally.
- QR scan handling is backed by PostgreSQL rate-limit rows rather than only in-memory counters.
- Background jobs run via the FastAPI lifespan hook and can be disabled by setting `BACKGROUND_JOB_INTERVAL_SECONDS=0`.
- Submission uploads are handled by Supabase Storage and returned as signed URLs.
- Optional SMTP integration can send generated credentials when email settings are configured.
- Optional Unstop synchronization can ingest from a local JSON source.

## Directory Structure

```text
backend/
  app/
    api/
    core/
    db/
    models/
    schemas/
    services/
  migrations/
    sql/
  tests/
  requirements.txt
  README.md
```

## Key Files

| File                            | Role                                           |
| ------------------------------- | ---------------------------------------------- |
| app/main.py                     | FastAPI app bootstrap and lifespan tasks       |
| app/api/router.py               | Top-level router aggregation                   |
| app/core/config.py              | Environment and settings model                 |
| app/core/middleware.py          | Auth and QR access control                     |
| app/db/session.py               | Async SQLAlchemy engine/session setup          |
| app/services/file_storage.py    | Supabase file upload and signed URL generation |
| app/services/background_jobs.py | Periodic sync and cleanup work                 |
| migrations/sql/\*.sql           | Supabase-ready SQL migrations                  |
| tests/                          | Route and service coverage                     |

## Implementation Notes

### Why JSONB is used

The event and user flows intentionally keep some denormalized structures in JSONB columns so the backend can store dashboard-facing payloads without forcing every nested attribute into a separate relational table. This keeps the implementation aligned with the project requirements while still preserving a relational core for identity and control data.

### Why the bucket is private

The current upload model uses the backend as the trusted boundary. Files are uploaded with the service role key, then exposed only through signed URLs. That keeps access controlled and avoids public bucket exposure.

## Testing

The backend test suite covers:

- Route wiring and response contracts.
- Authentication and access-control helpers.
- Background job logic.
- Submission file storage behavior.
- QR rate limiting.
- SMTP email helper behavior.
- Database URL normalization.

Run the suite with:

```bash
uv run pytest
```

## Deployment Notes

Before deploying, make sure the following are in place:

- Supabase project created.
- Database schema migrations applied.
- Private submissions bucket created.
- `DATABASE_URL` set to the Supabase database connection string.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured.
- `JWT_SECRET_KEY` set to a strong secret.
- SMTP settings configured only if credential emails are required.

## Current Project Status

The backend already implements the major platform slices from the project documentation:

- Authentication and user profile flows.
- Event browsing, registration, and participant access.
- Submission upload flow with Supabase Storage.
- QR scan handling and persistent rate limiting.
- Admin sync and phase management endpoints.
- Supabase migration files, including RLS and storage bucket setup.
- Test coverage for the main runtime and service components.

## Troubleshooting

| Symptom                              | Likely Cause                                    | Fix                                                                  |
| ------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------- |
| App fails to start                   | Missing or invalid `DATABASE_URL`               | Check `.env` and the Supabase connection string                      |
| Uploads fail                         | Missing Supabase storage config                 | Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and bucket name     |
| JWT errors                           | Wrong secret or algorithm mismatch              | Regenerate `JWT_SECRET_KEY` and confirm `JWT_ALGORITHM`              |
| Email does not send                  | SMTP settings missing or invalid                | Configure `SMTP_*` values                                            |
| QR scans rate limit too aggressively | Default limit/window too low for the deployment | Adjust `QR_RATE_LIMIT_PER_MINUTE` and `QR_RATE_LIMIT_WINDOW_SECONDS` |

## Related Migrations

- [migrations/README.md](migrations/README.md)
- [migrations/sql/001_init_schema.sql](migrations/sql/001_init_schema.sql)
- [migrations/sql/003_rate_limit_entries.sql](migrations/sql/003_rate_limit_entries.sql)
- [migrations/sql/004_rls_policies.sql](migrations/sql/004_rls_policies.sql)
- [migrations/sql/005_create_submissions_bucket.sql](migrations/sql/005_create_submissions_bucket.sql)
- [migrations/sql/006_update_users_schema.sql](migrations/sql/006_update_users_schema.sql)
- [migrations/sql/007_update_user_roles.sql](migrations/sql/007_update_user_roles.sql)
