-- 026_drop_events_participants.sql
-- Drops the redundant events.participants JSONB column.
--
-- Background:
--   events.participants was a mirror of per-user registration state that
--   duplicated data already stored in users.events[event_id]. It was excluded
--   from every lean query (because it could be MB-scale per event), never read
--   by the participants admin tab (which queries users.events instead), and
--   caused an unnecessary double-write on every restrict/unrestrict action.
--
--   The source of truth for all registration state is users.events.
--   Capacity counting now queries users whose events map contains the event_id.

BEGIN;

ALTER TABLE public.events DROP COLUMN IF EXISTS participants;

COMMIT;
