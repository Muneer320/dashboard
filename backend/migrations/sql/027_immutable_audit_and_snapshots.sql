-- ============================================================
-- 027_immutable_audit_and_snapshots.sql
-- Enforce that audit_log and leaderboard_snapshots are never
-- UPDATEd or DELETEd, even by buggy/malicious code paths.
--
-- Postgres RULE ON UPDATE/DELETE DO INSTEAD NOTHING silently
-- swallows the operation rather than raising — that means a
-- compromised actor can't even tell whether the row "took" a
-- change. INSERTs are unaffected.
-- ============================================================

DROP RULE IF EXISTS audit_log_no_update ON audit_log;
DROP RULE IF EXISTS audit_log_no_delete ON audit_log;
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

DROP RULE IF EXISTS leaderboard_snapshots_no_update ON leaderboard_snapshots;
DROP RULE IF EXISTS leaderboard_snapshots_no_delete ON leaderboard_snapshots;
CREATE RULE leaderboard_snapshots_no_update AS ON UPDATE TO leaderboard_snapshots DO INSTEAD NOTHING;
CREATE RULE leaderboard_snapshots_no_delete AS ON DELETE TO leaderboard_snapshots DO INSTEAD NOTHING;
