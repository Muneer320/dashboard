-- Migration 024: Activate Phase 1 for all real events
-- Sets phase1.is_active = true, is_locked = false for all 9 real events
-- Fixes phase2 showing as "DONE" by setting is_locked = false (upcoming, not done)
--
-- Platform-based events (Override.exe, Impulse, Invariant) also get phase1 activated
-- but the frontend shows a "submit on the platform" message for them.
--
-- Two-phase events (Robo Race, Robo Run, Robo Soccer, Anvil, Launchpad, ReThesis):
--   phase2 changes from is_locked:true → is_locked:false so it shows as UPCOMING not DONE

BEGIN;

-- ── Robo Race (a1b2c3d4-0001) — two phases ──────────────────────────────────
UPDATE events
SET rounds = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(rounds,
          '{phase1,is_active}', 'true'),
        '{phase1,is_locked}', 'false'),
      '{phase2,is_active}', 'false'),
    '{phase2,is_locked}', 'false')
WHERE id = 'a1b2c3d4-0001-4000-8000-000000000001';

-- ── Robo Run (a1b2c3d4-0002) — two phases ───────────────────────────────────
UPDATE events
SET rounds = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(rounds,
          '{phase1,is_active}', 'true'),
        '{phase1,is_locked}', 'false'),
      '{phase2,is_active}', 'false'),
    '{phase2,is_locked}', 'false')
WHERE id = 'a1b2c3d4-0002-4000-8000-000000000002';

-- ── Robo Soccer (a1b2c3d4-0003) — two phases ────────────────────────────────
UPDATE events
SET rounds = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(rounds,
          '{phase1,is_active}', 'true'),
        '{phase1,is_locked}', 'false'),
      '{phase2,is_active}', 'false'),
    '{phase2,is_locked}', 'false')
WHERE id = 'a1b2c3d4-0003-4000-8000-000000000003';

-- ── Anvil Hackathon (a1b2c3d4-0004) — two phases ────────────────────────────
UPDATE events
SET rounds = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(rounds,
          '{phase1,is_active}', 'true'),
        '{phase1,is_locked}', 'false'),
      '{phase2,is_active}', 'false'),
    '{phase2,is_locked}', 'false')
WHERE id = 'a1b2c3d4-0004-4000-8000-000000000004';

-- ── Launchpad (a1b2c3d4-0005) — two phases ──────────────────────────────────
UPDATE events
SET rounds = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(rounds,
          '{phase1,is_active}', 'true'),
        '{phase1,is_locked}', 'false'),
      '{phase2,is_active}', 'false'),
    '{phase2,is_locked}', 'false')
WHERE id = 'a1b2c3d4-0005-4000-8000-000000000005';

-- ── ReThesis (a1b2c3d4-0006) — two phases ───────────────────────────────────
UPDATE events
SET rounds = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(rounds,
          '{phase1,is_active}', 'true'),
        '{phase1,is_locked}', 'false'),
      '{phase2,is_active}', 'false'),
    '{phase2,is_locked}', 'false')
WHERE id = 'a1b2c3d4-0006-4000-8000-000000000006';

-- ── Override.exe (a1b2c3d4-0007) — single phase, platform CTF ───────────────
-- Marking active so the frontend can detect it; UI shows "submit on CTF platform"
UPDATE events
SET rounds = jsonb_set(
    jsonb_set(rounds,
      '{phase1,is_active}', 'true'),
    '{phase1,is_locked}', 'false')
WHERE id = 'a1b2c3d4-0007-4000-8000-000000000007';

-- ── Impulse (a1b2c3d4-0008) — single phase, platform CP contest ─────────────
UPDATE events
SET rounds = jsonb_set(
    jsonb_set(rounds,
      '{phase1,is_active}', 'true'),
    '{phase1,is_locked}', 'false')
WHERE id = 'a1b2c3d4-0008-4000-8000-000000000008';

-- ── Invariant (a1b2c3d4-0009) — single phase, platform CP contest ───────────
UPDATE events
SET rounds = jsonb_set(
    jsonb_set(rounds,
      '{phase1,is_active}', 'true'),
    '{phase1,is_locked}', 'false')
WHERE id = 'a1b2c3d4-0009-4000-8000-000000000009';

COMMIT;
