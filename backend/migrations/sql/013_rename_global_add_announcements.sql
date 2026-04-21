-- Migration 013: Rename global_schedule → "global", add announcements column
--
-- 1. Rename the table from global_schedule to "global"
--    ("global" is a reserved word in standard SQL so it must be quoted)
--
-- 2. Add the announcements JSONB column
--    Shape: [{ "announcement": str, "time": iso-datetime-str }]
--
-- 3. Update the index name to match the new table
--
-- Safe to re-run (IF NOT EXISTS / IF EXISTS guards throughout).

BEGIN;

-- ── 1. Rename table ───────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS global_schedule RENAME TO "global";

-- ── 2. Add announcements column ───────────────────────────────────────────────

ALTER TABLE "global"
    ADD COLUMN IF NOT EXISTS announcements jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN "global".announcements IS
  'Array of announcement items: [{announcement: str, time: iso-datetime-str}]';

-- ── 3. Re-create index under new table name ───────────────────────────────────

DROP INDEX IF EXISTS idx_global_schedule_date;
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_date ON "global" (date);

-- ── 4. Re-create the updated_at trigger for the renamed table ─────────────────

DROP TRIGGER IF EXISTS trg_global_schedule_updated_at ON "global";
CREATE TRIGGER trg_global_updated_at
    BEFORE UPDATE ON "global"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
