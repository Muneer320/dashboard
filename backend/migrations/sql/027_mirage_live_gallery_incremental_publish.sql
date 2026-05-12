BEGIN;

ALTER TABLE mirage_jobs
    ADD COLUMN IF NOT EXISTS gallery_visibility text NOT NULL DEFAULT 'draft'
        CHECK (gallery_visibility IN ('draft', 'live', 'unpublished')),
    ADD COLUMN IF NOT EXISTS batch_state text NOT NULL DEFAULT 'idle'
        CHECK (batch_state IN ('idle', 'discovering', 'downloading', 'detecting_faces', 'matching_users', 'writing_mappings', 'awaiting_approval', 'published', 'failed')),
    ADD COLUMN IF NOT EXISTS current_batch_id uuid NULL;

ALTER TABLE image_user_mappings
    ADD COLUMN IF NOT EXISTS publish_state text NOT NULL DEFAULT 'published'
        CHECK (publish_state IN ('staged', 'published')),
    ADD COLUMN IF NOT EXISTS batch_id uuid NULL,
    ADD COLUMN IF NOT EXISTS published_at timestamptz NULL;

UPDATE mirage_jobs
SET gallery_visibility = CASE
        WHEN status = 'live' THEN 'live'
        ELSE 'draft'
    END,
    batch_state = CASE
        WHEN status = 'pending' THEN 'idle'
        WHEN status = 'processing' THEN 'matching_users'
        WHEN status = 'review' THEN 'awaiting_approval'
        WHEN status = 'rerun_pending' THEN 'matching_users'
        WHEN status = 'approved' THEN 'published'
        WHEN status = 'live' THEN 'published'
        WHEN status = 'failed' THEN 'failed'
        WHEN status = 'cancelled' THEN 'idle'
        ELSE COALESCE(batch_state, 'idle')
    END
WHERE TRUE;

UPDATE image_user_mappings
SET publish_state = 'published',
    published_at = COALESCE(published_at, updated_at, created_at, now())
WHERE publish_state <> 'published'
   OR published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mirage_jobs_gallery_visibility
    ON mirage_jobs(gallery_visibility, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_mirage_jobs_batch_state
    ON mirage_jobs(batch_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_image_user_mappings_publish_state
    ON image_user_mappings(job_id, publish_state, updated_at DESC);

COMMIT;
