-- Migration 016: Add ticket_id to requested_members
--
-- Context
--   The credentials service used to generate a random ticket id at response-
--   time, which meant the same request could echo back a different id on every
--   call. We now persist a human-readable ticket_id (e.g. "ASC-482910") so the
--   id is stable across reads, and the service-layer dedup guard
--   (one active pending/approved request per email) has a real handle to
--   return.
--
-- What this migration does
--   1. Add a nullable ticket_id column
--   2. Backfill all existing rows with a unique ASC-XXXXXX string
--   3. Mark the column NOT NULL + UNIQUE, with a lookup index
--
-- Safe to re-run (IF [NOT] EXISTS guards throughout).

BEGIN;

-- ── 1. Add column (nullable for now so backfill has somewhere to land) ──────

ALTER TABLE requested_members
    ADD COLUMN IF NOT EXISTS ticket_id varchar(32);

COMMENT ON COLUMN requested_members.ticket_id IS
  'Human-readable ticket reference shown to the requester (format: ASC-######).';

-- ── 2. Backfill existing rows with a unique ASC-###### id ───────────────────
--
-- We loop over NULLs and pick a random 6-digit number; if it collides with an
-- already-issued ticket_id we retry. 1M slots · small row counts → converges
-- almost immediately, and the UNIQUE index added below will reject anything
-- that slips through.

DO $$
DECLARE
    r          record;
    candidate  varchar(32);
    attempts   int;
BEGIN
    FOR r IN
        SELECT id
        FROM requested_members
        WHERE ticket_id IS NULL
    LOOP
        attempts := 0;
        LOOP
            candidate := 'ASC-' || lpad((floor(random() * 1000000))::int::text, 6, '0');
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM requested_members WHERE ticket_id = candidate
            );
            attempts := attempts + 1;
            IF attempts > 25 THEN
                RAISE EXCEPTION
                    'could not allocate a unique ticket_id for row % after 25 tries',
                    r.id;
            END IF;
        END LOOP;

        UPDATE requested_members
           SET ticket_id = candidate
         WHERE id = r.id;
    END LOOP;
END
$$;

-- ── 3. Lock it down ─────────────────────────────────────────────────────────

ALTER TABLE requested_members
    ALTER COLUMN ticket_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_requested_members_ticket_id
    ON requested_members (ticket_id);

COMMIT;
