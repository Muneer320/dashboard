-- 025_fix_numeric_and_phone_types.sql
-- Fixes corrupted 'question_type' values and enforces text type for phone columns.

BEGIN;

UPDATE events
SET questions = jsonb_set(
  questions,
  '{phase1}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN q->>'question_type' = 'number'
        THEN jsonb_set(q, '{question_type}', '"numeric"')
        ELSE q
      END
    )
    FROM jsonb_array_elements(questions->'phase1') q
  )
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(questions->'phase1') q
  WHERE q->>'question_type' = 'number'
);

COMMIT;


-- 2. Explicitly enforce phone fields to be text (varchar)
-- Note: These might already be varchar, but this migration ensures they are explicitly cast
-- to a text-compatible format so no numeric casting bugs can occur.
ALTER TABLE requested_members
  ALTER COLUMN phone TYPE VARCHAR(32);

ALTER TABLE admins
  ALTER COLUMN phone TYPE VARCHAR(32);

COMMIT;
