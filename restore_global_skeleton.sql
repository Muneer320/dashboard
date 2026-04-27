-- restore_global_skeleton.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- RECOVERY SCAFFOLD for the `global` table.
--
-- ⚠️ This is NOT your original data. The original schedule rows were written
-- through the admin UI and aren't checked into the repo. Treat this as a
-- skeleton to get the app running again; replace titles/venues/times with
-- your real plan (or restore via Supabase PITR if you're on Pro tier).
--
-- Table shape (per backend/app/models/global_schedule.py):
--   id              uuid      PK, default gen_random_uuid()
--   date            date      UNIQUE
--   schedule        jsonb     array of {title, start_time, end_time, venue}
--   announcements   jsonb     array of {id, announcement, time, category, is_pinned}
--   created_at      timestamp default now()
--   updated_at      timestamp default now()
--
-- Safe to re-run — ON CONFLICT (date) DO NOTHING preserves anything already
-- inserted so you can rerun without clobbering later edits.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "global" (date, schedule, announcements) VALUES

-- ── Day 1 · Thu, 24 Apr 2026 ────────────────────────────────────────────────
('2026-04-24',
 '[
    {"title": "Gates Open & Check-in",    "start_time": "2026-04-24T08:30:00+05:30", "end_time": "2026-04-24T10:00:00+05:30", "venue": "Main Entrance"},
    {"title": "Opening Ceremony",         "start_time": "2026-04-24T10:00:00+05:30", "end_time": "2026-04-24T11:00:00+05:30", "venue": "Auditorium"},
    {"title": "Keynote",                  "start_time": "2026-04-24T11:15:00+05:30", "end_time": "2026-04-24T12:15:00+05:30", "venue": "Auditorium"},
    {"title": "Lunch",                    "start_time": "2026-04-24T13:00:00+05:30", "end_time": "2026-04-24T14:00:00+05:30", "venue": "Food Court"},
    {"title": "Invariant · Round 1",      "start_time": "2026-04-24T21:00:00+05:30", "end_time": "2026-04-24T23:00:00+05:30", "venue": "Online · Dashboard"}
 ]'::jsonb,
 '[
    {"id": "a24-01", "announcement": "Welcome to Day 1 of Ascent 2026. Check-in opens at 08:30 at the main entrance.", "time": "2026-04-24T08:00:00+05:30", "category": "general",  "is_pinned": true},
    {"id": "a24-02", "announcement": "Keynote starts at 11:15 in the Auditorium — seats fill fast.",                  "time": "2026-04-24T10:45:00+05:30", "category": "schedule", "is_pinned": false}
 ]'::jsonb),

-- ── Day 2 · Fri, 25 Apr 2026 ────────────────────────────────────────────────
('2026-04-25',
 '[
    {"title": "Breakfast",                "start_time": "2026-04-25T08:00:00+05:30", "end_time": "2026-04-25T09:30:00+05:30", "venue": "Food Court"},
    {"title": "Anvil · Round 1 (online)", "start_time": "2026-04-25T10:00:00+05:30", "end_time": "2026-04-25T23:59:00+05:30", "venue": "Online"},
    {"title": "Robo Race · Submissions Close", "start_time": "2026-04-25T23:59:00+05:30", "end_time": "2026-04-25T23:59:00+05:30", "venue": "Online"},
    {"title": "Lunch",                    "start_time": "2026-04-25T13:00:00+05:30", "end_time": "2026-04-25T14:00:00+05:30", "venue": "Food Court"},
    {"title": "Workshop: Intro to Systems", "start_time": "2026-04-25T15:00:00+05:30", "end_time": "2026-04-25T17:00:00+05:30", "venue": "Block C · 204"},
    {"title": "Dinner",                   "start_time": "2026-04-25T19:30:00+05:30", "end_time": "2026-04-25T20:30:00+05:30", "venue": "Food Court"}
 ]'::jsonb,
 '[
    {"id": "a25-01", "announcement": "Anvil Round 1 submissions close tonight at 23:59 IST. Upload early.", "time": "2026-04-25T09:00:00+05:30", "category": "alert",   "is_pinned": true},
    {"id": "a25-02", "announcement": "Breakfast is being served at the Food Court until 09:30.",           "time": "2026-04-25T08:15:00+05:30", "category": "meal",    "is_pinned": false}
 ]'::jsonb),

-- ── Day 3 · Sat, 26 Apr 2026 ────────────────────────────────────────────────
('2026-04-26',
 '[
    {"title": "Breakfast",                   "start_time": "2026-04-26T08:00:00+05:30", "end_time": "2026-04-26T09:30:00+05:30", "venue": "Food Court"},
    {"title": "Anvil · Round 2 (on-site)",   "start_time": "2026-04-26T10:00:00+05:30", "end_time": "2026-04-26T18:00:00+05:30", "venue": "Block C · Hack Hall"},
    {"title": "Robo Race · Finals",          "start_time": "2026-04-26T11:00:00+05:30", "end_time": "2026-04-26T13:00:00+05:30", "venue": "Studio B · Arena"},
    {"title": "Lunch",                       "start_time": "2026-04-26T13:00:00+05:30", "end_time": "2026-04-26T14:00:00+05:30", "venue": "Food Court"},
    {"title": "Pitch Panel · Round 1",       "start_time": "2026-04-26T15:00:00+05:30", "end_time": "2026-04-26T17:00:00+05:30", "venue": "Auditorium"},
    {"title": "Mirage gallery opens",        "start_time": "2026-04-26T18:00:00+05:30", "end_time": "2026-04-26T22:00:00+05:30", "venue": "Lawn"},
    {"title": "Dinner",                      "start_time": "2026-04-26T19:30:00+05:30", "end_time": "2026-04-26T20:30:00+05:30", "venue": "Food Court"}
 ]'::jsonb,
 '[
    {"id": "a26-01", "announcement": "Anvil Round 2 begins at 10:00 in Block C Hack Hall. Bring your laptops and chargers.", "time": "2026-04-26T09:30:00+05:30", "category": "Anvil",   "is_pinned": true},
    {"id": "a26-02", "announcement": "Robo Race finals are in Studio B at 11:00 — spectators welcome.",                     "time": "2026-04-26T10:15:00+05:30", "category": "general", "is_pinned": false}
 ]'::jsonb),

-- ── Day 4 · Sun, 27 Apr 2026 ────────────────────────────────────────────────
('2026-04-27',
 '[
    {"title": "Breakfast",                   "start_time": "2026-04-27T08:00:00+05:30", "end_time": "2026-04-27T09:30:00+05:30", "venue": "Food Court"},
    {"title": "Anvil · Demo Day",            "start_time": "2026-04-27T10:00:00+05:30", "end_time": "2026-04-27T13:00:00+05:30", "venue": "Block C · Hack Hall"},
    {"title": "Lunch",                       "start_time": "2026-04-27T13:00:00+05:30", "end_time": "2026-04-27T14:00:00+05:30", "venue": "Food Court"},
    {"title": "Invariant · Finals",          "start_time": "2026-04-27T14:30:00+05:30", "end_time": "2026-04-27T17:30:00+05:30", "venue": "Block C · 102"},
    {"title": "Closing Ceremony & Awards",   "start_time": "2026-04-27T18:00:00+05:30", "end_time": "2026-04-27T19:30:00+05:30", "venue": "Auditorium"}
 ]'::jsonb,
 '[
    {"id": "a27-01", "announcement": "Closing ceremony and awards at 18:00 in the Auditorium. Don''t miss it.", "time": "2026-04-27T12:00:00+05:30", "category": "general", "is_pinned": true},
    {"id": "a27-02", "announcement": "Demo Day starts at 10:00 — all Anvil teams present in 5-min slots.",     "time": "2026-04-27T09:30:00+05:30", "category": "Anvil",   "is_pinned": false}
 ]'::jsonb)

ON CONFLICT (date) DO NOTHING;
