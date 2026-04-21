-- Migration 015: Add leader_id to teams
--
-- Adds leader_id to the teams table, linking to users.id.

BEGIN;

ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS leader_id uuid REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN teams.leader_id IS 'The team leader. Can be NULL if the team has no assigned leader.';

CREATE INDEX IF NOT EXISTS idx_teams_leader_id ON teams (leader_id);

COMMIT;
