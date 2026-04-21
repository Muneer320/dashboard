-- Migration 011: Add schedule + global schedule table
--
-- 1. Add `schedule` JSONB column to events table
--    Shape: [{ "title": str, "start_time": iso-str, "end_time": iso-str, "venue": str }]
--
-- 2. Create `global_schedule` table for whole-event timeline
--    Shape: rows keyed by date, each row holds same schedule-item array
--
-- Run this against Supabase SQL editor. Safe to re-run (IF NOT EXISTS everywhere).

BEGIN;

-- ── 1. events.schedule ───────────────────────────────────────────────────────

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS schedule jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN events.schedule IS
  'Array of schedule items: [{title, start_time, end_time, venue}]';

-- ── 2. global_schedule table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS global_schedule (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    date        date        NOT NULL UNIQUE,   -- e.g. 2026-05-10
    schedule    jsonb       NOT NULL DEFAULT '[]'::jsonb,
    -- Same item shape as events.schedule: [{title, start_time, end_time, venue}]
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  global_schedule IS 'Whole-event global timeline, one row per day.';
COMMENT ON COLUMN global_schedule.schedule IS
  'Array of schedule items: [{title, start_time, end_time, venue}]';

-- Index for quick date lookups
CREATE INDEX IF NOT EXISTS idx_global_schedule_date ON global_schedule (date);

-- Auto-update trigger (reuses function created in migration 001)
DROP TRIGGER IF EXISTS trg_global_schedule_updated_at ON global_schedule;
CREATE TRIGGER trg_global_schedule_updated_at
    BEFORE UPDATE ON global_schedule
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable RLS to match the rest of the schema
ALTER TABLE global_schedule ENABLE ROW LEVEL SECURITY;

COMMIT;
