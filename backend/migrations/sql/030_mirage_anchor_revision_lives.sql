BEGIN;

ALTER TABLE mirage_user_profiles
ADD COLUMN IF NOT EXISTS anchor_revision_lives_remaining integer NOT NULL DEFAULT 3
CHECK (anchor_revision_lives_remaining >= 0 AND anchor_revision_lives_remaining <= 10);

COMMIT;
