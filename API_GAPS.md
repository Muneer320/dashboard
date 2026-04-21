# API Gaps — what the frontend needs that the backend does not yet ship

_Last reviewed: 2026-04-21 against `backend/app/api/routes/*` (FastAPI, `/api/v1`) and `frontend/src/**`._

This document is the single source of truth for what the **frontend** expects to call versus what the **backend** currently exposes. It is intentionally scoped to the integration work — the **Mirage** feature (photo gallery under `/mirage`) is excluded, it's owned by another dev.

---

## 0. TL;DR

The frontend today has **zero real HTTP calls** — every screen is driven by hardcoded arrays or `admin-panel/data.json`. The Vite proxy is already wired (`/api` → `http://localhost:8000`), and the backend already ships enough endpoints to power **most of the admin panel** and **parts of the user app**. The rest is missing.

- **Admin panel**: backend coverage is ~95%. Only minor mapping work (status strings, id shape) is required.
- **User app**: backend coverage is ~35%. Core auth + events + submissions exist. Almost everything else (schedule, announcements, leaderboard, ratings, feedback, reports, lost & found, team, seating, meal log) is missing.

---

## 1. What the backend ships today

Mounted under `/api/v1`. Complete list:

| # | Method | Path | Auth |
|---|--------|------|------|
| 1 | GET    | `/health` | open |
| 2 | POST   | `/auth/login` | open |
| 3 | POST   | `/auth/register` | open |
| 4 | GET    | `/auth/me` | user |
| 5 | POST   | `/auth/admin/login` | open |
| 6 | GET    | `/auth/admin/me` | admin |
| 7 | POST   | `/admin/unstop/sync` | admin |
| 8 | POST   | `/admin/events/{event_id}/phases/{phase}/activate` | admin |
| 9 | POST   | `/admin/events/{event_id}/phases/{phase}/lock` | admin |
| 10 | POST  | `/admin/events/{event_id}/phases/{phase}/unlock` | admin |
| 11 | GET   | `/users/{user_id}` | user |
| 12 | PATCH | `/users/{user_id}` | user |
| 13 | GET   | `/users/{user_id}/events` | user |
| 14 | GET   | `/events` | user |
| 15 | GET   | `/events/{event_id}` | user |
| 16 | POST  | `/events/{event_id}/register` | user |
| 17 | GET   | `/events/{event_id}/participants` | scanner+ |
| 18 | POST  | `/events/{event_id}/submit` | user |
| 19 | GET   | `/events/{event_id}/submission` | user |
| 20 | POST  | `/qr/scan` | scanner+ |
| 21 | GET   | `/admin-panel/stats` | admin/EM |
| 22 | GET   | `/admin-panel/events/stats` | admin/EM |
| 23 | GET   | `/admin-panel/participants` | admin/EM |
| 24 | PATCH | `/admin-panel/participants/{user_id}/restrict` | admin |
| 25 | GET   | `/admin-panel/participants/lookup` | scanner+ |
| 26 | GET   | `/admin-panel/my-events` | admin/EM |
| 27 | GET   | `/admin-panel/event-managers` | admin |
| 28 | POST  | `/admin-panel/event-managers` | admin |
| 29 | PATCH | `/admin-panel/event-managers/{uid}` | admin |
| 30 | DELETE| `/admin-panel/event-managers/{uid}` | admin |

---

## 2. Admin panel — endpoint map

| Frontend screen / action | Backend endpoint | Status | Notes |
|---|---|---|---|
| `Login.jsx` submit (admin / scanner / EM) | `POST /auth/admin/login` | covered | Drop `VITE_USERS` lookup, replace with real call. Store token in `sessionStorage` (key: `ascent_admin_token`). |
| `AuthContext.canAccess()` matrix | `GET /auth/admin/me` → `role` | covered | Use returned `role` instead of hardcoded one in `.env`. |
| Overview stats widget (`Overview.jsx`) | `GET /admin-panel/stats` | covered | Field names already line up with `StatsResponse`. |
| Overview "per-event breakdown" table | `GET /admin-panel/events/stats` | covered | — |
| Participants tab table (`Participants.jsx`) | `GET /admin-panel/participants?event_id=&search=&status=` | covered | Map frontend status values: `"participating" ↔ active`, `"restricted" ↔ restricted`. |
| Participants tab "restrict / restore" toggle | `PATCH /admin-panel/participants/{user_id}/restrict` | covered | Body: `{event_id, restricted: bool}`. |
| Scanner · Entry (`Scanner.jsx`, sub-tab `entry`) | `POST /qr/scan` with `mode: "collegeEntry"` | covered | Sets `is_attending`. |
| Scanner · Attendance (per-event) | `POST /qr/scan` with `mode: "event", event_id` | covered | — |
| Scanner · Food | `POST /qr/scan` with `mode: "food", meal: "meal1"\|"meal2"\|"meal3"` | covered | Meal picker UI needs to map names → meal1/2/3 (see §4.1 below). |
| Manual lookup in `QrScanner.jsx` (name / email / id) | `GET /admin-panel/participants/lookup?q=` | covered | Replace local `.find()` with this call. |
| MyEvents tab (`MyEvents.jsx`) | `GET /admin-panel/my-events` | covered | — |
| Contact Info tab list (`ContactInfo.jsx`) | `GET /admin-panel/event-managers` | covered | — |
| _(Not wired yet)_ Create / edit / delete EM | `POST` / `PATCH` / `DELETE /admin-panel/event-managers[/ {uid}]` | covered | Admin-only. UI doesn't have forms for this yet. |

**Verdict:** admin panel is fully implementable against the existing backend. No new endpoints are strictly required for the current UI.

---

## 3. User-facing app — endpoint map

### 3.1 Already supported

| Frontend screen / action | Backend endpoint | Notes |
|---|---|---|
| `/login` submit (`auth.jsx`) | `POST /auth/login` | Field naming mismatch — see §4.2. |
| `/dashboard` header name | `GET /auth/me` | Returns `name`, `is_attending`. |
| `/dashboard` "Registered events" | `GET /users/{id}/events` or `GET /events` | Either works; the `/events` list currently returns only events the user is part of. |
| `/event-detail` event info | `GET /events/{event_id}` | Returns rounds dict + venue. |
| `/event-detail` submission drop zone | `POST /events/{event_id}/submit` (multipart) | Use `submission_type: "file"` or `"url"`. Returns signed URL in response. |
| `/event-detail` "your submission" indicator | `GET /events/{event_id}/submission?phase=N` | — |
| `/explore` card list | `GET /events` | — |
| `/explore` register button on each card | `POST /events/{event_id}/register` | Currently the UI sends users to unstop.com; swap for a call to this endpoint when self-register is enabled. |
| `/dashboard` food QR payload | derive from `auth/me.id` | The QR just needs to encode the user_id; no new endpoint needed. Scanner calls `/qr/scan` with it. |

### 3.2 **Missing from the backend**

These are the gaps. Suggested endpoint shapes are listed in §5.

| Frontend screen | What it shows | Missing endpoint |
|---|---|---|
| `/credentials` form (`auth.jsx` → `Credentials`) | Full name, college, email, phone, events of interest, free-text note, "Request credentials" submit | **`POST /credentials-requests`** (accepts the form, creates a pending ticket). `/auth/register` is not a substitute — it requires a password the user doesn't have yet, the UX copy explicitly says "no self-signup". |
| `/dashboard` "Today's timeline" widget | Time, event name, venue, mine-or-not | **`GET /schedule?day=1`** (see §5.2). Today this is hardcoded. |
| `/schedule` full schedule | Day 1 / Day 2 / venue filters | same endpoint as above with filters |
| `/dashboard` food QR "Meal Log" | Breakfast ✓ Collected 08:14 etc. | **`GET /users/{id}/meals`** — no read endpoint exists; `/qr/scan` writes only. |
| `/dashboard` "Announcements" widget & `/announcements` page | Pinned + feed, relative timestamps | **`GET /announcements`**. Admin post endpoint (`POST /announcements`) optional for later. |
| `/leaderboard` | Colleges tab + individuals tab, podium + full list, delta arrows | **`GET /leaderboard?type=college\|individual`** |
| `/dashboard` "YOUR RANK #47" card | User's position in individual leaderboard | Derived from leaderboard endpoint (add `me: true` flag in response row, or separate `GET /leaderboard/me`). |
| `/rating` | Per-event star rating + review text | **`POST /events/{id}/rating`** + **`GET /events/{id}/rating/me`** to pre-fill edit state + **`GET /events/{id}/rating/summary`** for aggregate (★4.3 / 214 reviews). |
| `/feedback` | Anonymous 5-axis sliders + two free-text fields | **`POST /feedback`** (no auth required, or auth required but payload discarded for anonymity). |
| `/report` + sidebar tracker | Category, description, optional photo upload, "your tracked reports" list with status | **`POST /reports`** (multipart) + **`GET /reports/me`**. Admin would need `PATCH /reports/{id}` for status changes; out of scope for v1 UI. |
| `/lost-found` | Lost tab, Found tab, search, "+ Post" button, contact button | **`GET /lost-found?type=lost\|found&q=`** + **`POST /lost-found`** (multipart). |
| `/event-detail` "Your team · Dragonfly" card | Team name + member list + roles | **`GET /events/{id}/my-team`** — not in backend. Team model exists (`app/models/team.py`) but no route. |
| `/event-detail` Seating grid (40 seats, "YOU" highlighted, occupied cells) | Per-seat state | **`GET /events/{id}/seating?me=true`** — not in backend. |
| `/dashboard` "Mirage · 248 new photos today" mini card | Count badge | Out of scope (friend's feature). Use placeholder. |

### 3.3 Field-shape mismatches (not missing, just different)

| Frontend | Backend | Fix |
|---|---|---|
| Login form labels "Email" (`type="email"`) | `LoginRequest.username` | Either (a) rename the input to Username in UI, or (b) have the backend accept email-as-username in `auth_service`. Recommend (a) — copy change only. |
| Admin login form labels "Username" | `LoginRequest.username` | Already aligned. |
| `DataContext.stats.attending` uses `p.attended` | Backend `StatsResponse.attending` counts `is_attending` | Same semantics. Just use backend value directly, drop client-side computation. |
| Participant `status` strings: `participating` \| `restricted` | Backend `ParticipantItem.status`: `active` \| `restricted` | Map `active ↔ participating` in an adapter in `api/participants.js`. |
| Participant fields: `teamName`, `email`, `phone` | Backend `ParticipantItem`: only `teamId`, `name`, `username` (no email/phone) | Either enrich `ParticipantItem` or drop these columns from the participants table UI. |
| `submission: { deployed, repo }` (two URLs) | Backend stores a single submission per `(event, user, phase)`, `submission_type: url \| file` | Decide: (a) allow two submissions per phase (one deployed, one repo) via a `variant` field, or (b) collapse UI to a single URL. Recommend (a). |
| Event IDs: frontend uses `"e1"` … `"e5"`; backend uses whatever the DB generates (likely UUID or slug) | — | Drop fixtures, use backend IDs. |

---

## 4. Behavioral notes that need a decision before wiring

### 4.1 Meal slot naming
Backend QR accepts `meal1`, `meal2`, `meal3`. Frontend dashboard shows Breakfast / Lunch / Snacks / Dinner (4 slots). Choose:
- **A.** Extend backend to accept `meal4` (recommended — 4 slots is the actual requirement).
- **B.** Collapse dashboard UI to 3 meals.

### 4.2 Login identity
Backend `LoginRequest` is `username`, frontend says "Email". Quick fix: change the label/placeholder in `src/components/auth.jsx` `Login` from Email → Username (or Login ID). Long term, allow email as a login alias server-side.

### 4.3 Credentials request flow
The auth page explicitly promises "credentials are issued by organizers" and "no self-signup." The backend's `POST /auth/register` directly creates a user with a password. These are different flows. Options:
- **A.** Keep `register` internal-only; add `POST /credentials-requests` that creates a pending ticket, organizer approves → `admin/unstop/sync` creates the user and emails credentials. (Recommended; matches existing admin flow.)
- **B.** Rewrite the Credentials page to collect a password (changes the UX copy).

### 4.4 Submission polymorphism
Frontend's event detail has a combined drop-zone ("Drop your GitHub link or upload a .zip"). The `rating` page also lists events with reviewed/unreviewed states. Decide: one submission per phase, or multiple (deployed + repo + file)?

---

## 5. Proposed endpoint specs for the missing pieces

All paths are under `/api/v1`. Pydantic-style shapes.

### 5.1 Credentials request

```
POST /credentials-requests      open
body: {
  name: str, college: str, email: str, phone: str,
  events_of_interest: list[str], note: str | None
}
→ 201 { ticket_id: "ASC-123456", status: "pending_verify" }
```

### 5.2 Schedule

```
GET /schedule?day=1&venue=Block+C    user
→ [
    {
      time: "10:00",          # IST, HH:MM
      day: 1,
      event_id: "evt_xyz" | null,
      title: "Hack Night · Kickoff",
      venue: "Block C · 204",
      tone: "violet" | "teal" | "amber",
      is_mine: bool,
    },
    ...
  ]
```
Optionally: `GET /schedule/mine` for just the user's events.

### 5.3 Announcements

```
GET /announcements?limit=20       user
→ [ { id, title, body, pinned: bool, posted_at: iso, posted_by: str } ]

POST /announcements               admin (optional, for admin panel CMS)
body: { title, body, pinned }
```

### 5.4 Leaderboard

```
GET /leaderboard?type=college         user  →  [ { rank, name, points, delta: "up"|"down"|"same" } ]
GET /leaderboard?type=individual      user  →  [ { rank, user_id, name, college, points, is_me: bool } ]
GET /leaderboard/me                   user  →  { rank, points, delta }
```

### 5.5 Meals read endpoint

```
GET /users/{user_id}/meals           user (self or admin)
→ { meals: [ { slot: "meal1", status: "collected"|"pending", at: iso | null } ] }
```

### 5.6 Ratings & feedback

```
POST /events/{event_id}/rating        user
body: { stars: 1..5, review: str | None }
→ 201 { id, stars, review, submitted_at }

GET  /events/{event_id}/rating/me     user  →  { stars, review } | null
GET  /events/{event_id}/rating/summary user →  { avg: float, count: int }

POST /feedback                        user (payload NOT linked back)
body: {
  organization: 0..10, food: 0..10, events: 0..10,
  ambiance: 0..10, communication: 0..10,
  fix_next_year: str | None, nailed_it: str | None
}
→ 201 { message: "received" }
```

### 5.7 Reports / issues

```
POST /reports                         user  (multipart)
body: category: "Technical"|"Food"|"Venue"|"Safety"|"Other",
      description: str, photo: UploadFile | None
→ 201 { id: "RPT-0442", status: "received", created_at: iso }

GET  /reports/me                      user
→ [ { id, title, category, status: "received"|"in-progress"|"resolved", when: iso } ]

PATCH /reports/{id}                   admin (status updates)
```

### 5.8 Lost & Found

```
GET  /lost-found?type=lost&q=keys     user
→ [ { id, title, type: "lost"|"found", last_seen: str, posted_at, posted_by, photo_url } ]

POST /lost-found                      user (multipart)
body: { type: "lost"|"found", title, last_seen, photo?: UploadFile }
```

### 5.9 Team & seating

```
GET /events/{event_id}/my-team        user
→ { team_id, name, members: [{ user_id, name, role, is_me: bool }] }

GET /events/{event_id}/seating        user
→ { room: "Block C · 204",
    seats: [ { index: 0, state: "empty"|"occupied"|"mine" }, ... ] }
```

---

## 6. Out of scope for this integration

- `/mirage` (community photo gallery) — owned by another dev.
- `/credentials` organizer-approval workflow beyond accepting the form — the existing `admin/unstop/sync` can do the provisioning once approved.
- Real-time pushes (announcements are fine to pull every N seconds; WebSocket/SSE is a later optimization).
- Mobile push / SMS for report status changes — polling only for v1.
