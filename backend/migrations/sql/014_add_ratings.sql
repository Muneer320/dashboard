-- Migration 014: Add ratings table
--
-- Stores per-user, per-event star ratings (1-5) with optional text feedback.
-- One row per (user_id, event_id) — unique constraint enforced at DB level.
--
-- Safe to re-run (CREATE TABLE IF NOT EXISTS).

BEGIN;

CREATE TABLE IF NOT EXISTS ratings (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id    uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    value       integer     NOT NULL CHECK (value BETWEEN 1 AND 5),
    feedback    text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_rating_user_event UNIQUE (user_id, event_id)
);

COMMENT ON TABLE ratings IS 'User star ratings for events (1-5), one per user per event.';
COMMENT ON COLUMN ratings.value IS 'Star rating: 1 (worst) to 5 (best).';
COMMENT ON COLUMN ratings.feedback IS 'Optional free-text review.';

-- Indexes for the common query patterns
CREATE INDEX IF NOT EXISTS idx_ratings_event_id ON ratings (event_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user_id  ON ratings (user_id);

-- Auto-update trigger
DROP TRIGGER IF EXISTS trg_ratings_updated_at ON ratings;
CREATE TRIGGER trg_ratings_updated_at
    BEFORE UPDATE ON ratings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable RLS to match the rest of the schema
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

COMMIT;
