BEGIN;

CREATE TABLE IF NOT EXISTS mirage_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    day_label text NOT NULL,
    section_title text NOT NULL,
    event_id uuid NULL REFERENCES events(id) ON DELETE SET NULL,
    drive_folder_url text NOT NULL,
    drive_folder_id text NOT NULL,
    recursive boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    is_published boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mirage_sections_day_sort
    ON mirage_sections(day_label, sort_order, section_title);

CREATE INDEX IF NOT EXISTS idx_mirage_sections_event_id
    ON mirage_sections(event_id);

COMMIT;
