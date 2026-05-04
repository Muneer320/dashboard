-- 025_fix_numeric_and_phone_types.sql
-- Fixes corrupted 'question_type' values and enforces text type for phone columns.

BEGIN;

-- 1. Standardize 'number' to 'numeric' in events.questions JSONB array
UPDATE events
SET questions = (
  SELECT jsonb_agg(
    CASE 
      WHEN q->>'question_type' = 'number' 
      THEN jsonb_set(q, '{question_type}', '"numeric"')
      ELSE q
    END
  )
  FROM jsonb_array_elements(questions) AS q
)
WHERE questions @> '[{"question_type": "number"}]'::jsonb;


-- 2. Explicitly enforce phone fields to be text (varchar)
-- Note: These might already be varchar, but this migration ensures they are explicitly cast
-- to a text-compatible format so no numeric casting bugs can occur.
ALTER TABLE requested_members
  ALTER COLUMN phone TYPE VARCHAR(32);

ALTER TABLE admins
  ALTER COLUMN phone TYPE VARCHAR(32);

COMMIT;
