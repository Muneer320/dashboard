BEGIN;

CREATE TABLE IF NOT EXISTS mirage_user_profiles (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    consent_enabled boolean NOT NULL DEFAULT false,
    enrollment_status text NOT NULL DEFAULT 'draft'
        CHECK (enrollment_status IN ('draft', 'processing', 'ready', 'needs_more_images', 'failed')),
    approved_anchor_count integer NOT NULL DEFAULT 0,
    last_embedding_version integer NOT NULL DEFAULT 0,
    last_processed_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mirage_user_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_path text NULL,
    filename text NOT NULL,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'deleted')),
    quality_score numeric NULL,
    rejection_reason text NULL,
    pose_label text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mirage_user_embeddings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_image_id uuid NOT NULL REFERENCES mirage_user_images(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    embedding_vector jsonb NOT NULL,
    model_name text NOT NULL,
    model_version text NULL,
    preprocessing_version text NOT NULL DEFAULT 'face_preprocess_v1',
    embedding_version integer NOT NULL DEFAULT 1,
    quality_score numeric NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_image_id, embedding_version, model_version, preprocessing_version)
);

CREATE TABLE IF NOT EXISTS mirage_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NULL REFERENCES events(id) ON DELETE SET NULL,
    event_name_snapshot text NULL,
    day_label text NOT NULL,
    drive_folder_url text NOT NULL,
    drive_folder_id text NOT NULL,
    recursive boolean NOT NULL DEFAULT false,
    matching_mode text NOT NULL DEFAULT 'high_precision'
        CHECK (matching_mode IN ('high_precision', 'balanced', 'high_recall')),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'review', 'rerun_pending', 'approved', 'live', 'failed', 'cancelled')),
    claimed_by text NULL,
    claimed_at timestamptz NULL,
    stats_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    review_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    approved_at timestamptz NULL,
    live_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mirage_job_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES mirage_jobs(id) ON DELETE CASCADE,
    drive_file_id text NULL,
    filename text NOT NULL,
    display_order integer NOT NULL DEFAULT 0,
    sha256 text NULL,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'processed', 'review_required', 'rerun_requested', 'approved', 'rejected', 'failed')),
    attempt_count integer NOT NULL DEFAULT 0,
    last_error text NULL,
    rerun_reason text NULL,
    review_image_path text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id, drive_file_id)
);

CREATE TABLE IF NOT EXISTS mirage_detected_faces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_image_id uuid NOT NULL REFERENCES mirage_job_images(id) ON DELETE CASCADE,
    bbox jsonb NOT NULL DEFAULT '{}'::jsonb,
    landmarks jsonb NOT NULL DEFAULT '[]'::jsonb,
    detection_score numeric NULL,
    quality_score numeric NULL,
    crop_path text NULL,
    status text NOT NULL DEFAULT 'unknown'
        CHECK (status IN ('auto_accept_candidate', 'review_required', 'approved', 'rejected', 'unknown')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mirage_face_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    face_id uuid NOT NULL REFERENCES mirage_detected_faces(id) ON DELETE CASCADE,
    user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
    best_score numeric NULL,
    second_best_score numeric NULL,
    margin numeric NULL,
    auto_decision text NULL
        CHECK (auto_decision IS NULL OR auto_decision IN ('approved', 'auto_accept_candidate', 'review_required', 'rejected', 'unknown')),
    review_decision text NULL
        CHECK (review_decision IS NULL OR review_decision IN ('approved', 'rejected', 'unknown')),
    reviewed_by integer NULL REFERENCES admins(uid) ON DELETE SET NULL,
    reviewed_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mirage_review_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NULL REFERENCES mirage_jobs(id) ON DELETE SET NULL,
    job_image_id uuid NULL REFERENCES mirage_job_images(id) ON DELETE SET NULL,
    face_id uuid NULL REFERENCES mirage_detected_faces(id) ON DELETE SET NULL,
    face_match_id uuid NULL REFERENCES mirage_face_matches(id) ON DELETE SET NULL,
    action_type text NOT NULL,
    actor_admin_uid integer NULL REFERENCES admins(uid) ON DELETE SET NULL,
    notes text NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mirage_photo_likes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_image_id uuid NOT NULL REFERENCES mirage_job_images(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_image_id, user_id)
);

ALTER TABLE mirage_jobs
    ADD COLUMN IF NOT EXISTS force_recheck boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS only_pending boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS user_scope text NOT NULL DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS image_scope text NOT NULL DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS model_version text NOT NULL DEFAULT 'buffalo_l',
    ADD COLUMN IF NOT EXISTS preprocessing_version text NOT NULL DEFAULT 'face_preprocess_v1',
    ADD COLUMN IF NOT EXISTS match_threshold numeric NOT NULL DEFAULT 0.62;

ALTER TABLE mirage_job_images
    ADD COLUMN IF NOT EXISTS gdrive_url text NULL,
    ADD COLUMN IF NOT EXISTS download_url text NULL,
    ADD COLUMN IF NOT EXISTS mime_type text NULL,
    ADD COLUMN IF NOT EXISTS download_status text NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS face_detection_status text NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS detected_face_count integer NOT NULL DEFAULT 0;

ALTER TABLE mirage_user_embeddings
    ADD COLUMN IF NOT EXISTS model_version text NULL,
    ADD COLUMN IF NOT EXISTS preprocessing_version text NOT NULL DEFAULT 'face_preprocess_v1';

UPDATE mirage_user_embeddings
SET model_version = COALESCE(model_version, model_name)
WHERE model_version IS NULL;

ALTER TABLE mirage_user_embeddings
    DROP CONSTRAINT IF EXISTS mirage_user_embeddings_user_image_id_embedding_version_key;

CREATE UNIQUE INDEX IF NOT EXISTS mirage_user_embeddings_user_image_version_model_preprocess_uidx
    ON mirage_user_embeddings(user_image_id, embedding_version, model_version, preprocessing_version);

CREATE TABLE IF NOT EXISTS inference_user_image_status (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NULL REFERENCES events(id) ON DELETE SET NULL,
    job_id uuid NOT NULL REFERENCES mirage_jobs(id) ON DELETE CASCADE,
    image_id uuid NOT NULL REFERENCES mirage_job_images(id) ON DELETE CASCADE,
    gdrive_file_id text NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'positive', 'negative', 'failed')),
    best_score numeric NULL,
    matched_face_index integer NULL,
    matched_anchor_id text NULL,
    reason text NULL,
    model_version text NOT NULL,
    preprocessing_version text NOT NULL,
    inference_attempt_count integer NOT NULL DEFAULT 0,
    last_inferred_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id, image_id, user_id, model_version, preprocessing_version)
);

CREATE TABLE IF NOT EXISTS image_user_mappings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NULL REFERENCES events(id) ON DELETE SET NULL,
    job_id uuid NOT NULL REFERENCES mirage_jobs(id) ON DELETE CASCADE,
    image_id uuid NOT NULL REFERENCES mirage_job_images(id) ON DELETE CASCADE,
    gdrive_file_id text NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gdrive_url text NOT NULL,
    download_url text NOT NULL,
    best_score numeric NOT NULL,
    matched_face_index integer NULL,
    matched_anchor_id text NULL,
    model_version text NOT NULL,
    preprocessing_version text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id, image_id, user_id, model_version, preprocessing_version)
);

CREATE INDEX IF NOT EXISTS idx_mirage_user_images_user_status
    ON mirage_user_images(user_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_mirage_user_embeddings_user_version
    ON mirage_user_embeddings(user_id, embedding_version DESC);

CREATE INDEX IF NOT EXISTS idx_mirage_jobs_status_created
    ON mirage_jobs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mirage_jobs_event_id
    ON mirage_jobs(event_id);

CREATE INDEX IF NOT EXISTS idx_mirage_job_images_job_status_order
    ON mirage_job_images(job_id, status, display_order);

CREATE INDEX IF NOT EXISTS idx_mirage_detected_faces_image_status
    ON mirage_detected_faces(job_image_id, status);

CREATE INDEX IF NOT EXISTS idx_mirage_face_matches_face_user
    ON mirage_face_matches(face_id, user_id);

CREATE INDEX IF NOT EXISTS idx_mirage_face_matches_user_review
    ON mirage_face_matches(user_id, review_decision, auto_decision);

CREATE INDEX IF NOT EXISTS idx_mirage_review_actions_job_created
    ON mirage_review_actions(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mirage_photo_likes_job_image
    ON mirage_photo_likes(job_image_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inference_status_job_image_status
    ON inference_user_image_status(job_id, image_id, status);

CREATE INDEX IF NOT EXISTS idx_inference_status_user_status
    ON inference_user_image_status(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_inference_status_model_versions
    ON inference_user_image_status(model_version, preprocessing_version, status);

CREATE INDEX IF NOT EXISTS idx_image_user_mappings_user_created
    ON image_user_mappings(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_image_user_mappings_job_image
    ON image_user_mappings(job_id, image_id);

DROP TRIGGER IF EXISTS trg_mirage_user_profiles_updated_at ON mirage_user_profiles;
CREATE TRIGGER trg_mirage_user_profiles_updated_at
BEFORE UPDATE ON mirage_user_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_mirage_user_images_updated_at ON mirage_user_images;
CREATE TRIGGER trg_mirage_user_images_updated_at
BEFORE UPDATE ON mirage_user_images
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_mirage_user_embeddings_updated_at ON mirage_user_embeddings;
CREATE TRIGGER trg_mirage_user_embeddings_updated_at
BEFORE UPDATE ON mirage_user_embeddings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_mirage_jobs_updated_at ON mirage_jobs;
CREATE TRIGGER trg_mirage_jobs_updated_at
BEFORE UPDATE ON mirage_jobs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_mirage_job_images_updated_at ON mirage_job_images;
CREATE TRIGGER trg_mirage_job_images_updated_at
BEFORE UPDATE ON mirage_job_images
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_mirage_detected_faces_updated_at ON mirage_detected_faces;
CREATE TRIGGER trg_mirage_detected_faces_updated_at
BEFORE UPDATE ON mirage_detected_faces
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_mirage_face_matches_updated_at ON mirage_face_matches;
CREATE TRIGGER trg_mirage_face_matches_updated_at
BEFORE UPDATE ON mirage_face_matches
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_inference_user_image_status_updated_at ON inference_user_image_status;
CREATE TRIGGER trg_inference_user_image_status_updated_at
BEFORE UPDATE ON inference_user_image_status
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_image_user_mappings_updated_at ON image_user_mappings;
CREATE TRIGGER trg_image_user_mappings_updated_at
BEFORE UPDATE ON image_user_mappings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO mirage_jobs (
    event_id,
    event_name_snapshot,
    day_label,
    drive_folder_url,
    drive_folder_id,
    recursive,
    matching_mode,
    status,
    stats_json,
    review_summary,
    approved_at,
    live_at,
    created_at,
    updated_at
)
SELECT
    ms.event_id,
    COALESCE(ev.name, ms.section_title),
    ms.day_label,
    ms.drive_folder_url,
    ms.drive_folder_id,
    ms.recursive,
    'high_precision',
    CASE WHEN ms.is_published THEN 'live' ELSE 'approved' END,
    '{}'::jsonb,
    '{}'::jsonb,
    CASE WHEN ms.is_published THEN now() ELSE NULL END,
    CASE WHEN ms.is_published THEN now() ELSE NULL END,
    ms.created_at,
    ms.updated_at
FROM mirage_sections ms
LEFT JOIN events ev ON ev.id = ms.event_id
WHERE NOT EXISTS (
    SELECT 1
    FROM mirage_jobs mj
    WHERE mj.drive_folder_url = ms.drive_folder_url
      AND mj.day_label = ms.day_label
      AND COALESCE(mj.event_name_snapshot, '') = COALESCE(ev.name, ms.section_title, '')
);

COMMIT;
