BEGIN;

ALTER TABLE mirage_job_images
    ADD COLUMN IF NOT EXISTS asset_status text NOT NULL DEFAULT 'pending'
        CHECK (asset_status IN ('pending', 'downloading', 'optimizing', 'uploading', 'ready', 'failed')),
    ADD COLUMN IF NOT EXISTS asset_error text NULL,
    ADD COLUMN IF NOT EXISTS asset_attempt_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS asset_optimized_at timestamptz NULL,
    ADD COLUMN IF NOT EXISTS source_mime_type text NULL,
    ADD COLUMN IF NOT EXISTS source_extension text NULL,
    ADD COLUMN IF NOT EXISTS optimized_format text NULL,
    ADD COLUMN IF NOT EXISTS thumb_storage_key text NULL,
    ADD COLUMN IF NOT EXISTS thumb_public_url text NULL,
    ADD COLUMN IF NOT EXISTS preview_storage_key text NULL,
    ADD COLUMN IF NOT EXISTS preview_public_url text NULL,
    ADD COLUMN IF NOT EXISTS inference_storage_key text NULL,
    ADD COLUMN IF NOT EXISTS inference_public_url text NULL,
    ADD COLUMN IF NOT EXISTS inference_local_path text NULL,
    ADD COLUMN IF NOT EXISTS optimized_width integer NULL,
    ADD COLUMN IF NOT EXISTS optimized_height integer NULL,
    ADD COLUMN IF NOT EXISTS optimized_sha256 text NULL;

ALTER TABLE mirage_jobs
    ADD COLUMN IF NOT EXISTS asset_state text NOT NULL DEFAULT 'idle'
        CHECK (asset_state IN ('idle', 'discovering', 'downloading', 'optimizing', 'uploading', 'ready', 'failed')),
    ADD COLUMN IF NOT EXISTS asset_stats_json jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_mirage_job_images_asset_status
    ON mirage_job_images(job_id, asset_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_mirage_jobs_asset_state
    ON mirage_jobs(asset_state, updated_at DESC);

COMMIT;
