-- Migration 017: Add `category` field to announcement items in "global".announcements
--
-- Context
--   Announcements live as a JSONB array on the "global" table (one row per
--   event date). Each element used to look like
--     { "announcement": str, "time": iso-datetime-str }
--   and we now want every item to carry a `category` string so the dashboard
--   feed can filter by category (general / schedule / meal / alert / …).
--
-- What this migration does
--   1. Backfill every existing announcement element with category = "general"
--      unless it already has one.
--   2. Refresh the column comment so the new shape is documented at the DB.
--
-- Idempotent: `||` with jsonb_build_object only writes the key when missing,
-- and re-running on already-migrated data is a no-op.

BEGIN;

-- ── 1. Backfill `category` on each JSONB array element ─────────────────────

UPDATE "global"
   SET announcements = COALESCE(
       (
           SELECT jsonb_agg(
               CASE
                   WHEN elem ? 'category' THEN elem
                   ELSE elem || jsonb_build_object('category', 'general')
               END
           )
           FROM jsonb_array_elements(announcements) AS elem
       ),
       '[]'::jsonb
   )
 WHERE announcements IS NOT NULL
   AND jsonb_typeof(announcements) = 'array'
   AND jsonb_array_length(announcements) > 0;

-- ── 2. Update column comment to reflect the new shape ──────────────────────

COMMENT ON COLUMN "global".announcements IS
  'Array of announcement items: '
  '[{announcement: str, time: iso-datetime-str, category: str}]. '
  'category is a free-form tag such as "general", "schedule", "meal", "alert".';

COMMIT;
