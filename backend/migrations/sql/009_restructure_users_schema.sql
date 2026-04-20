-- Migration 009: Restructure users table
-- - Remove access_level, role, team_id columns (deprecated)
-- - Add is_attending boolean (campus gate entry)
-- - Add cents integer (in-event currency)
-- - The users.events JSONB shape changes from:
--     { accessLevel, phase, status, submission, ... }
--   to:
--     { isAttending, phase, status, restricted, submission, submissionType,
--       submissionURL, submissionFile, submissionTime, teamId, score, rank }
--
-- NOTE: Run this against Supabase SQL editor. Back up data first.

BEGIN;

-- 1. Drop the foreign key to teams (team membership is now per-event inside events JSONB)
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_team_id_fkey;

ALTER TABLE users
    DROP COLUMN IF EXISTS team_id;

-- 2. Drop old enum columns
ALTER TABLE users
    DROP COLUMN IF EXISTS access_level;

ALTER TABLE users
    DROP COLUMN IF EXISTS role;

-- 3. Add new scalar columns
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_attending boolean NOT NULL DEFAULT false;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS cents integer NOT NULL DEFAULT 0;

-- 4. Migrate existing rows: reshape users.events JSONB entries in-place
--    Old shape: { "accessLevel": "ROUND1", "phase": 1, "status": "active",
--                 "submission": false, "submissionType": null, ... }
--    New shape: adds isAttending, restricted, teamId; removes accessLevel
UPDATE users
SET events = (
    SELECT jsonb_object_agg(
        event_key,
        (event_val
            -- add new fields (only if not already present)
            || jsonb_build_object(
                'isAttending',    COALESCE((event_val->>'isAttending')::boolean, false),
                'restricted',     COALESCE((event_val->>'restricted')::boolean, false),
                'teamId',         event_val->'teamId'   -- null if not set
            )
            -- remove deprecated field
            - 'accessLevel'
        )
    )
    FROM jsonb_each(users.events) AS e(event_key, event_val)
)
WHERE events IS NOT NULL AND events != '{}'::jsonb;

-- 5. Drop old enum types if no other tables reference them
DROP TYPE IF EXISTS access_level CASCADE;
DROP TYPE IF EXISTS user_role     CASCADE;

COMMIT;
