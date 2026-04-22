-- ============================================================
-- Phase 1 Setup — run in Supabase SQL Editor
-- Sets phase1 as active (submissions open) for all events
-- except Override.exe / Impulse / Invariant (hosted externally).
-- Also ensures phase2 is not active/locked so it doesn't show
-- as "done" before phase1 has even completed.
-- ============================================================

-- 1. DIAGNOSTIC — view current phase states before making changes
SELECT
  id,
  name,
  rounds->'phase1'->>'is_active'  AS p1_active,
  rounds->'phase1'->>'is_locked'  AS p1_locked,
  rounds->'phase1'->>'end_time'   AS p1_end,
  rounds->'phase2'->>'is_active'  AS p2_active,
  rounds->'phase2'->>'is_locked'  AS p2_locked
FROM events
ORDER BY name;

-- ============================================================
-- 2. OPEN phase1 for all events that have a phase1 round,
--    EXCEPT the three platform-hosted events.
-- ============================================================
UPDATE events
SET rounds = jsonb_set(
  rounds,
  '{phase1, is_active}',
  'true'::jsonb,
  false   -- don't create key if missing
)
WHERE
  lower(name) NOT IN ('override.exe', 'impulse', 'invariant')
  AND rounds ? 'phase1';

-- ============================================================
-- 3. RESET phase2 (and beyond) so they don't show as done/active
--    while phase1 is still running.
--    Safe to run even if phase2 doesn't exist — the false flag
--    in jsonb_set prevents key creation.
-- ============================================================
UPDATE events
SET rounds = jsonb_set(
  jsonb_set(
    rounds,
    '{phase2, is_active}',
    'false'::jsonb,
    false
  ),
  '{phase2, is_locked}',
  'false'::jsonb,
  false
)
WHERE rounds ? 'phase2';

-- Same for phase3 if any event has it
UPDATE events
SET rounds = jsonb_set(
  jsonb_set(
    rounds,
    '{phase3, is_active}',
    'false'::jsonb,
    false
  ),
  '{phase3, is_locked}',
  'false'::jsonb,
  false
)
WHERE rounds ? 'phase3';

-- ============================================================
-- 4. VERIFY — check states look correct after the update
-- ============================================================
SELECT
  id,
  name,
  rounds->'phase1'->>'is_active'  AS p1_active,
  rounds->'phase1'->>'is_locked'  AS p1_locked,
  rounds->'phase1'->>'end_time'   AS p1_end,
  rounds->'phase2'->>'is_active'  AS p2_active,
  rounds->'phase2'->>'is_locked'  AS p2_locked
FROM events
ORDER BY name;
