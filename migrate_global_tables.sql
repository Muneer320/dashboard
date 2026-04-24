-- Enable moddatetime extension
create extension if not exists moddatetime schema extensions;

-- 1. Create announcements table
CREATE TABLE announcements (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT          NOT NULL DEFAULT '',
  body         TEXT          NOT NULL,
  category     VARCHAR(128)  NOT NULL DEFAULT 'general',
  is_pinned    BOOLEAN       NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcements_category  ON announcements(category);
CREATE INDEX idx_announcements_is_pinned ON announcements(is_pinned);
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);

-- auto-bump updated_at
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- 2. Create global_schedule table
CREATE TABLE global_schedule (
  id         UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  date       DATE   NOT NULL UNIQUE,
  items      JSONB  NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_global_schedule_date ON global_schedule(date);

CREATE TRIGGER trg_global_schedule_updated_at
  BEFORE UPDATE ON global_schedule
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- 3. Migrate announcements
INSERT INTO announcements (id, title, body, category, is_pinned, created_at)
SELECT
  COALESCE((ann->>'id')::UUID, gen_random_uuid()),
  COALESCE(ann->>'title', ''),
  COALESCE(ann->>'announcement', ''),
  COALESCE(ann->>'category', 'general'),
  COALESCE((ann->>'is_pinned')::BOOLEAN, false),
  -- Try to parse time, fallback to global.created_at
  COALESCE(
    CASE 
      WHEN ann->>'time' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}' THEN (ann->>'time')::TIMESTAMPTZ
      ELSE g.created_at 
    END, 
    g.created_at
  )
FROM "global" g,
     jsonb_array_elements(g.announcements) AS ann
WHERE jsonb_array_length(g.announcements) > 0;

-- 4. Migrate schedule items
INSERT INTO global_schedule (date, items, created_at)
SELECT date, schedule, created_at
FROM "global"
WHERE jsonb_array_length(schedule) > 0
ON CONFLICT (date) DO UPDATE SET items = EXCLUDED.items;

-- 5. Drop the old global table
DROP TABLE "global";
