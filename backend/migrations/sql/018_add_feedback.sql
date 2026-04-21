-- Migration 018: Add feedback table
--
-- Backs the anonymous overall-festival feedback form at /feedback.
-- The route layer requires a valid JWT (so only participants can submit),
-- but the row deliberately does NOT carry user_id — this channel is
-- advertised to users as anonymous.
--
-- Shape:
--   scores   jsonb    : { organization, food, events, ambiance, communication }
--                        each int 0..10
--   fix      text     : "one thing we should fix next year" (optional)
--   highlight text    : "one thing we nailed" (optional)
--
-- Safe to re-run (CREATE TABLE IF NOT EXISTS).

BEGIN;

CREATE TABLE IF NOT EXISTS feedback (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    scores      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    fix         text,
    highlight   text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  feedback           IS 'Anonymous overall-festival feedback submissions (no user_id).';
COMMENT ON COLUMN feedback.scores    IS 'Slider scores: {organization, food, events, ambiance, communication} each 0..10.';
COMMENT ON COLUMN feedback.fix       IS 'Free-text: one thing we should fix next year.';
COMMENT ON COLUMN feedback.highlight IS 'Free-text: one thing we nailed.';

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC);

-- Row Level Security to match the rest of the schema.
-- Only the backend (service role) reads this table; no user-facing reads.
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read feedback" ON feedback;
CREATE POLICY "Admins can read feedback"
ON feedback
FOR ALL
USING (auth.role() = 'authenticated');

COMMIT;
