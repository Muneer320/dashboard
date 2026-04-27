-- Migration: Add member_ids column to teams table
-- Run this in Supabase SQL editor once.

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS member_ids uuid[] NOT NULL DEFAULT '{}';

-- Backfill existing rows: scan users.events JSONB for each team
-- (only needed once; bulk-enroll will maintain it going forward)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM teams LOOP
    UPDATE teams
    SET member_ids = ARRAY(
      SELECT u.id
      FROM users u
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_each(u.events) AS ev(k, v)
        WHERE (v->>'teamId') = r.id::text
      )
    )
    WHERE id = r.id;
  END LOOP;
END $$;
