# Ascent Dashboard — Database Schema (Latest)

Source of truth: the dataclasses in `backend/app/models/` plus the `.table(...)` calls in `backend/app/services/`. The backend talks to Supabase (Postgres) via the `supabase-py` async SDK — every query returns plain dicts, and each model has a `from_row()` to hydrate a dataclass plus (where writes originate from code) a `to_insert()` to shape the payload.

All timestamps are `TIMESTAMPTZ` with `DEFAULT now()`. `updated_at` is maintained by a DB trigger on every row modification. UUID primary keys use `gen_random_uuid()` unless the row is inserted with a client-side UUID (the services usually do this so the echoed id is deterministic).

---

## Tables at a glance

| Table              | Purpose                                                  | PK type       | Key JSONB columns                     |
|--------------------|----------------------------------------------------------|---------------|---------------------------------------|
| `users`            | Participant accounts, per-event enrollment, food, cents  | `UUID`        | `details`, `events`, `food`           |
| `events`           | Competition/event catalog + per-event config             | `UUID`        | `rounds`, `participants`, `schedule`  |
| `admins`           | Staff accounts (admin / eventManager / Scanner)          | `SERIAL uid`  | `events`                              |
| `teams`            | Teams formed inside team-based events                    | `UUID`        | —                                     |
| `ratings`          | Per-user, per-event 1–5 star rating + optional feedback  | `UUID`        | —                                     |
| `global`           | Day-level global schedule + announcements feed           | `UUID`        | `schedule`, `announcements`           |
| `feedback`         | Anonymous overall-festival feedback (sliders + text)     | `UUID`        | `scores`                              |
| `requested_members`| Credential requests submitted from the pre-login page    | `UUID`        | —                                     |
| `rate_limit_entries` | Per-key request counters backing the rate limiter      | `UUID`        | —                                     |

> Note: `global` is a reserved SQL word — it's always quoted in queries (`.table("global")`).

---

## Table: `users`

Represents a festival participant. Most of the per-festival state hangs off this row in JSONB: event enrollment, food check-ins, profile details, and the in-event currency balance (`cents`).

| Column                | DB type        | Nullable | Default           | Notes |
|-----------------------|----------------|----------|-------------------|-------|
| `id`                  | `UUID`         | no       | `gen_random_uuid()` | Primary key. |
| `username`            | `VARCHAR(64)`  | no       | —                 | Unique login handle. |
| `password_hash`       | `VARCHAR(255)` | no       | —                 | Bcrypt hash. |
| `name`                | `VARCHAR(255)` | no       | —                 | Display name. |
| `unstop_id`           | `VARCHAR(128)` | yes      | `NULL`            | External ID from the Unstop sync (unique when present). |
| `is_attending`        | `BOOLEAN`      | no       | `false`           | Flipped to `true` on the college-entry QR scan. |
| `details`             | `JSONB`        | no       | `'{}'`            | Free-form profile fields filled in via `/profile`. |
| `events`              | `JSONB`        | no       | `'{}'`            | Per-event enrollment object — see shape below. |
| `food`                | `JSONB`        | no       | `'{"meal1":false,"meal2":false,"meal3":false}'` | Per-meal check-in flags. |
| `is_profile_complete` | `BOOLEAN`      | no       | `false`           | Turns `true` once `/profile` is submitted. |
| `cents`               | `INTEGER`      | no       | `0`               | In-event currency balance. |
| `created_at`          | `TIMESTAMPTZ`  | no       | `now()`           | |
| `updated_at`          | `TIMESTAMPTZ`  | no       | `now()`           | Auto-bumped on update. |

Indexes: `idx_users_username` (unique), `idx_users_unstop_id` (unique on non-null).

### `users.events` — shape

Keyed by event UUID string. Each value is the user's enrollment record for that event.

```jsonc
{
  "<event-uuid>": {
    "isAttending": false,          // toggled on event-entry QR scan
    "phase": 0,                    // current phase/round index for this user
    "status": "registered",        // "registered" | "eliminated" | "qualified" | ...
    "restricted": false,           // admin-set lockout
    "teamId": null,                // UUID string when in a team event
    "score": null,
    "rank": null,

    // Overwritten on every submission — always holds the latest phase's submission.
    // Nested object (NOT flat fields). Both links are optional individually; at
    // least one must be non-empty for the submit call to succeed.
    "submission": {
      "repoLink":    "https://github.com/...",
      "deployLink":  "https://myapp.vercel.app",
      "submittedAt": "2026-04-22T14:30:00+00:00"   // ISO8601
    }
  }
}
```

> Before the first submission this key is absent (or `false` on legacy rows). Per-phase history is kept on the event row — see `events.participants` below.

### `users.food` — shape

```jsonc
{ "meal1": false, "meal2": false, "meal3": false }
```

Each flag is set to `true` exactly once by a Scanner at the food QR station.

---

## Table: `events`

Catalog of events with per-event configuration. `rounds`, `participants`, and `schedule` are JSONB so the schema can evolve per event without DDL churn.

| Column                 | DB type        | Nullable | Default  | Notes |
|------------------------|----------------|----------|----------|-------|
| `id`                   | `UUID`         | no       | `gen_random_uuid()` | |
| `name`                 | `VARCHAR(255)` | no       | —        | |
| `description`          | `TEXT`         | no       | `''`     | Markdown-friendly blurb. |
| `start_date`           | `TIMESTAMPTZ`  | yes      | `NULL`   | |
| `end_date`             | `TIMESTAMPTZ`  | yes      | `NULL`   | |
| `venue`                | `TEXT[]`       | no       | `'{}'`   | One entry per round/location. |
| `judges`               | `TEXT[]`       | no       | `'{}'`   | Judge display names. |
| `rounds`               | `JSONB`        | no       | `'{}'`   | Round config — flexible per event (phase rules, gating, etc.). |
| `participants`         | `JSONB`        | no       | `'{}'`   | Fast-lookup mirror of enrolled users, counts, and team rosters. |
| `schedule`             | `JSONB`        | no       | `'[]'`   | Array of schedule items — see shape below. |
| `rules`                | `TEXT`         | no       | `''`     | Rulebook markdown. |
| `max_participants`     | `INTEGER`      | no       | `500`    | Capacity cap enforced at register time. |
| `registration_deadline`| `TIMESTAMPTZ`  | yes      | `NULL`   | |
| `created_at`           | `TIMESTAMPTZ`  | no       | `now()`  | |
| `updated_at`           | `TIMESTAMPTZ`  | no       | `now()`  | |

Indexes: `idx_events_name`, `idx_events_registration_deadline`.

### `events.schedule` — shape (same as `global.schedule`)

```jsonc
[
  {
    "title": "Round 1 kickoff",
    "start_time": "2026-04-22T10:00:00+05:30",
    "end_time":   "2026-04-22T11:30:00+05:30",
    "venue": "Auditorium A"
  }
]
```

### `events.participants` — shape

Mirror of enrollment kept for quick aggregate reads (admin panel counts, capacity checks) and as the **per-phase submission history** for a user in this event.

```jsonc
{
  "<user-uuid>": {
    "teamId":   "<team-uuid> | null",
    "joinedAt": "ISO8601",

    // Keyed by phase: "phase1", "phase2", ... — each value has the same
    // nested shape as users.events[event_id].submission.
    "submission": {
      "phase1": {
        "repoLink":    "https://github.com/...",
        "deployLink":  "https://myapp.vercel.app",
        "submittedAt": "2026-04-22T14:30:00+00:00"
      },
      "phase2": { "repoLink": "...", "deployLink": "...", "submittedAt": "..." }
    }
  }
}
```

> `users.events[event_id].submission` always holds the latest submission (overwritten per submit). `events.participants[user_id].submission.phaseN` preserves each phase's submission separately so judges/admins can see a history. Both are written in the same `submit_for_event` call — user row first, then event row.

---

## Table: `admins`

Staff accounts. Unlike `users`, this table uses a `SERIAL uid` primary key — historical decision, preserved through the migration.

| Column          | DB type            | Nullable | Default           | Notes |
|-----------------|--------------------|----------|-------------------|-------|
| `uid`           | `SERIAL`           | no       | autoincrement     | Primary key. |
| `username`      | `VARCHAR(64)`      | no       | —                 | Unique. |
| `name`          | `VARCHAR(255)`     | no       | —                 | |
| `password_hash` | `VARCHAR(255)`     | no       | —                 | Bcrypt hash. |
| `mail`          | `VARCHAR(255)`     | no       | —                 | Unique. |
| `role`          | `admin_role_enum`  | no       | `'admin'`         | One of `admin`, `eventManager`, `Scanner`. |
| `events`        | `JSONB`            | no       | `'[]'`            | Array of event UUID strings this admin manages (only meaningful for `eventManager`). |
| `phone`         | `VARCHAR(20)`      | yes      | `NULL`            | |
| `created_at`    | `TIMESTAMPTZ`      | no       | `now()`           | |
| `updated_at`    | `TIMESTAMPTZ`      | no       | `now()`           | |

Role semantics:

- `admin` — full access (manages everything including other admins).
- `eventManager` — scoped to events in `admins.events`; can also use scanner features.
- `Scanner` — QR scanning only (college entry, food, event entry).

Indexes: `idx_admins_username` (unique), `idx_admins_mail` (unique).

---

## Table: `teams`

Used by team-based events. Team membership is denormalized onto each participating `users.events[event_id].teamId` for read-speed; this table is the source of truth for team identity + leader.

| Column       | DB type        | Nullable | Default           | Notes |
|--------------|----------------|----------|-------------------|-------|
| `id`         | `UUID`         | no       | `gen_random_uuid()` | |
| `name`       | `VARCHAR(255)` | no       | —                 | |
| `event_id`   | `UUID`         | no       | —                 | FK → `events(id)` `ON DELETE CASCADE`. |
| `leader_id`  | `UUID`         | yes      | `NULL`            | FK → `users(id)` `ON DELETE SET NULL`. |
| `created_at` | `TIMESTAMPTZ`  | no       | `now()`           | |
| `updated_at` | `TIMESTAMPTZ`  | no       | `now()`           | |

Indexes: `idx_teams_event_id`, `idx_teams_leader_id`.

---

## Table: `ratings`

One rating per user per event (1–5 stars + optional free-text feedback). Services use `.upsert(..., on_conflict="user_id,event_id")` so a repeat submission updates in place.

| Column       | DB type        | Nullable | Default           | Notes |
|--------------|----------------|----------|-------------------|-------|
| `id`         | `UUID`         | no       | `gen_random_uuid()` | |
| `user_id`    | `UUID`         | no       | —                 | FK → `users(id)` `ON DELETE CASCADE`. |
| `event_id`   | `UUID`         | no       | —                 | FK → `events(id)` `ON DELETE CASCADE`. |
| `value`      | `INTEGER`      | no       | —                 | `CHECK (value BETWEEN 1 AND 5)`. |
| `feedback`   | `TEXT`         | yes      | `NULL`            | Optional review text. |
| `created_at` | `TIMESTAMPTZ`  | no       | `now()`           | |
| `updated_at` | `TIMESTAMPTZ`  | no       | `now()`           | |

Constraints: `UNIQUE (user_id, event_id)`.
Indexes: `idx_ratings_event_id`, `idx_ratings_user_id`.

---

## Table: `global`

One row per calendar date. Holds the day's master schedule feed and the rolling announcements list. Table name is quoted (`"global"`) because it's a reserved SQL word.

| Column          | DB type       | Nullable | Default           | Notes |
|-----------------|---------------|----------|-------------------|-------|
| `id`            | `UUID`        | no       | `gen_random_uuid()` | |
| `date`          | `DATE`        | no       | —                 | Unique — one row per day. |
| `schedule`      | `JSONB`       | no       | `'[]'`            | Same item shape as `events.schedule`. |
| `announcements` | `JSONB`       | no       | `'[]'`            | Array — see shape below. |
| `created_at`    | `TIMESTAMPTZ` | no       | `now()`           | |
| `updated_at`    | `TIMESTAMPTZ` | no       | `now()`           | |

Indexes: `idx_global_date` (unique).

### `global.announcements` — shape

```jsonc
[
  {
    "announcement": "Registration for Round 2 is now open",
    "time": "2026-04-22T14:00:00+05:30",
    "category": "general"     // "general" | "schedule" | "urgent" | ...
  }
]
```

---

## Table: `feedback`

Anonymous overall-festival feedback. **Intentionally no `user_id`** — the route requires a valid JWT (bot deterrent) but the row never records who submitted it.

| Column       | DB type       | Nullable | Default           | Notes |
|--------------|---------------|----------|-------------------|-------|
| `id`         | `UUID`        | no       | `gen_random_uuid()` | |
| `scores`     | `JSONB`       | no       | `'{}'`            | Slider ratings — see shape below. |
| `fix`        | `TEXT`        | yes      | `NULL`            | "One thing we should fix next year." |
| `highlight`  | `TEXT`        | yes      | `NULL`            | "One thing we nailed." |
| `created_at` | `TIMESTAMPTZ` | no       | `now()`           | Immutable — no `updated_at`. |

Indexes: `idx_feedback_created_at`.

### `feedback.scores` — shape

Each slider is `0–10`.

```jsonc
{
  "organization":  0,
  "food":          0,
  "events":        0,
  "ambiance":      0,
  "communication": 0
}
```

---

## Table: `requested_members`

Backing store for the public `/credentials` page — a visitor submits a request, an admin reviews and approves/rejects. The service enforces "one active request per email" (active = `pending` or `approved`).

| Column               | DB type        | Nullable | Default           | Notes |
|----------------------|----------------|----------|-------------------|-------|
| `id`                 | `UUID`         | no       | `gen_random_uuid()` | |
| `ticket_id`          | `VARCHAR(32)`  | no       | —                 | Unique human-readable ref, e.g. `ASC-482910`. |
| `name`               | `TEXT`         | no       | —                 | |
| `college`            | `TEXT`         | no       | —                 | |
| `email`              | `TEXT`         | no       | —                 | Dedup guard runs on this column. |
| `phone`              | `VARCHAR(32)`  | no       | —                 | |
| `areas_of_interest`  | `TEXT[]`       | no       | `'{}'`            | Event/area tags the requester is interested in. |
| `description`        | `TEXT`         | yes      | `NULL`            | Free-form note. |
| `status`             | `VARCHAR(32)`  | no       | `'pending'`       | One of `pending`, `approved`, `rejected`. |
| `created_at`         | `TIMESTAMPTZ`  | no       | `now()`           | |
| `updated_at`         | `TIMESTAMPTZ`  | no       | `now()`           | |

Indexes: `idx_requested_members_email`, `idx_requested_members_status`, `idx_requested_members_ticket_id` (unique).

---

## Table: `rate_limit_entries`

One row per rate-limit bucket. The service upserts/increments and prunes rows whose window has expired.

| Column              | DB type        | Nullable | Default           | Notes |
|---------------------|----------------|----------|-------------------|-------|
| `id`                | `UUID`         | no       | `gen_random_uuid()` | |
| `rate_key`          | `VARCHAR(512)` | no       | —                 | Unique bucket key (usually IP or IP+route). |
| `request_count`     | `INTEGER`      | no       | `0`               | Count inside the current window. |
| `window_started_at` | `TIMESTAMPTZ`  | yes      | `now()`           | When this window opened. |
| `created_at`        | `TIMESTAMPTZ`  | no       | `now()`           | |
| `updated_at`        | `TIMESTAMPTZ`  | no       | `now()`           | |

Indexes: `idx_rate_limit_entries_rate_key` (unique), `idx_rate_limit_entries_window_started_at`.

---

## Enums

### `admin_role_enum`

| Value          | Meaning |
|----------------|---------|
| `admin`        | Full platform access. |
| `eventManager` | Scoped to events listed in `admins.events`; can scan. |
| `Scanner`      | QR-scanning only. |

---

## Relationships

```
events (1) ────< (N) teams
events (1) ────< (N) ratings
users  (1) ────< (N) ratings
users  (1) ────< (N) teams        via teams.leader_id (SET NULL on delete)
```

Additional "soft" relationships held in JSONB (no FK enforcement at the DB layer):

- `users.events[event_id]` → `events(id)` — per-user enrollment mirror.
- `users.events[event_id].teamId` → `teams(id)`.
- `events.participants[user_id]` → `users(id)` — per-event enrollment mirror.
- `admins.events[i]` → `events(id)` — event-manager scope.

These are maintained in application code; there is no referential-integrity constraint on them, so service-layer writes are careful about ordering (e.g. `register_for_event` writes the event row before the user row; `submit_for_event` does the opposite so a mid-write failure leaves a recoverable state).

---

## Conventions

- **Timestamps.** Every table has `created_at`; everything except `feedback` also has `updated_at`, maintained by a trigger. All timestamps are timezone-aware (`TIMESTAMPTZ`).
- **IDs.** UUID primary keys use v4. The app generates UUIDs client-side (in Python) before insert so the returned `id` is always known — the DB `DEFAULT gen_random_uuid()` is a safety net.
- **No soft deletes.** Deletes are hard; FK cascades are explicit per relation (see the FK notes under each table).
- **JSONB over narrow columns.** Flexible per-event state (`rounds`, `participants`, enrollment, food, announcements) lives in JSONB to keep schema churn minimal as event rules evolve.
- **Aggregates.** PostgREST doesn't expose SQL aggregates directly, so counts/averages (ratings summary, admin-panel stats) are pulled as rows and computed in Python.

---

Sources: `backend/app/models/*.py` (dataclasses are the canonical column list) and `backend/app/services/*.py` (authoritative for JSONB shapes and write semantics).
