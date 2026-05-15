BEGIN;

CREATE TABLE IF NOT EXISTS mirage_moments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    subtitle text NULL,
    day_label text NOT NULL
        CHECK (btrim(day_label) <> ''),
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'unpublished')),
    published_at timestamptz NULL,
    created_by_admin_id integer NULL REFERENCES admins(uid) ON DELETE SET NULL,
    updated_by_admin_id integer NULL REFERENCES admins(uid) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mirage_moment_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    moment_id uuid NOT NULL REFERENCES mirage_moments(id) ON DELETE CASCADE,
    is_cover boolean NOT NULL DEFAULT false,
    storage_path text NOT NULL,
    image_url text NULL,
    thumbnail_url text NULL,
    filename text NOT NULL,
    mime_type text NOT NULL,
    slide_title text NULL,
    display_order integer NOT NULL,
    width integer NULL,
    height integer NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mirage_moment_images_moment_id_display_order_key
        UNIQUE (moment_id, display_order)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS mirage_moment_image_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    moment_image_id uuid NOT NULL REFERENCES mirage_moment_images(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (moment_image_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mirage_moments_single_published
    ON mirage_moments (status)
    WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_mirage_moments_day_label_status
    ON mirage_moments(day_label, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mirage_moment_images_single_cover
    ON mirage_moment_images(moment_id)
    WHERE is_cover;

CREATE INDEX IF NOT EXISTS idx_mirage_moment_image_users_user_id
    ON mirage_moment_image_users(user_id);

DROP TRIGGER IF EXISTS trg_mirage_moments_updated_at ON mirage_moments;
CREATE TRIGGER trg_mirage_moments_updated_at
BEFORE UPDATE ON mirage_moments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_mirage_moment_images_updated_at ON mirage_moment_images;
CREATE TRIGGER trg_mirage_moment_images_updated_at
BEFORE UPDATE ON mirage_moment_images
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_mirage_moment_image_users_updated_at ON mirage_moment_image_users;
CREATE TRIGGER trg_mirage_moment_image_users_updated_at
BEFORE UPDATE ON mirage_moment_image_users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
