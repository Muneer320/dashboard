CREATE TABLE IF NOT EXISTS mirage_search_people (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email text NULL,
    username text NULL,
    name text NULL,
    photo_count integer NOT NULL DEFAULT 0,
    cover_photo_id uuid NULL REFERENCES mirage_job_images(id) ON DELETE SET NULL,
    latest_photo_at timestamptz NULL,
    search_text text NOT NULL DEFAULT '',
    is_searchable boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mirage_search_person_photos (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    photo_id uuid NOT NULL REFERENCES mirage_job_images(id) ON DELETE CASCADE,
    job_id uuid NULL REFERENCES mirage_jobs(id) ON DELETE SET NULL,
    day_label text NULL,
    display_order integer NOT NULL DEFAULT 0,
    publish_state text NOT NULL DEFAULT 'published',
    gallery_visibility text NOT NULL DEFAULT 'live',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mirage_search_person_photos_user_photo
    ON mirage_search_person_photos(user_id, photo_id);

CREATE INDEX IF NOT EXISTS idx_mirage_search_people_photo_count
    ON mirage_search_people(photo_count DESC);

CREATE INDEX IF NOT EXISTS idx_mirage_search_people_latest_photo_at
    ON mirage_search_people(latest_photo_at DESC);

CREATE INDEX IF NOT EXISTS idx_mirage_search_people_is_searchable
    ON mirage_search_people(is_searchable);

CREATE INDEX IF NOT EXISTS idx_mirage_search_people_search_text
    ON mirage_search_people(lower(search_text));

CREATE INDEX IF NOT EXISTS idx_mirage_search_person_photos_user_order
    ON mirage_search_person_photos(user_id, display_order);

CREATE INDEX IF NOT EXISTS idx_mirage_search_person_photos_user_created
    ON mirage_search_person_photos(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mirage_search_person_photos_visibility
    ON mirage_search_person_photos(publish_state, gallery_visibility);

DROP TRIGGER IF EXISTS trg_mirage_search_people_updated_at ON mirage_search_people;
CREATE TRIGGER trg_mirage_search_people_updated_at
BEFORE UPDATE ON mirage_search_people
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_mirage_search_person_photos_updated_at ON mirage_search_person_photos;
CREATE TRIGGER trg_mirage_search_person_photos_updated_at
BEFORE UPDATE ON mirage_search_person_photos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
