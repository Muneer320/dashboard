BEGIN;

-- Fast substring search on users (name / username / JSON email) for Mirage people search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_users_mirage_search_name_trgm
    ON users USING gin (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_mirage_search_username_trgm
    ON users USING gin (lower(username) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_mirage_search_email_trgm
    ON users USING gin (lower(coalesce(details->>'email', '')) gin_trgm_ops);

-- Narrow lookups for published face mappings by user_id (Mirage search second phase).
CREATE INDEX IF NOT EXISTS idx_image_user_mappings_user_published
    ON image_user_mappings(user_id)
    WHERE publish_state = 'published';

COMMIT;
