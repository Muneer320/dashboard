-- ============================================================
-- 028_admin_booth_id.sql
-- Add a booth assignment column to the admins table so a
-- booth_volunteer's login token can carry the right booth_id
-- claim without a separate token-mint step.
--
-- Booth IDs are validated against BOOTH_SOURCE_MAP at the
-- application layer; we keep the column free-form text so new
-- booths can be introduced without a schema migration.
-- ============================================================

ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS booth_id TEXT;

CREATE INDEX IF NOT EXISTS idx_admins_booth_id ON admins(booth_id);
