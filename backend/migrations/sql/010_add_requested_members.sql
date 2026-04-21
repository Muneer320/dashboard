-- Migration 010: Add requested_members table
-- Stores credential-request submissions from the /credentials frontend page.
-- Fields: name, college, email, phone, areas_of_interest (text[]), description, status.
--
-- Run this against Supabase SQL editor.

BEGIN;

CREATE TABLE IF NOT EXISTS requested_members (
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name               text        NOT NULL,
    college            text        NOT NULL,
    email              text        NOT NULL,
    phone              varchar(32) NOT NULL,
    areas_of_interest  text[]      NOT NULL DEFAULT '{}',
    description        text,
    status             varchar(32) NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Index for fast admin-panel lookups by status and email
CREATE INDEX IF NOT EXISTS idx_requested_members_status ON requested_members (status);
CREATE INDEX IF NOT EXISTS idx_requested_members_email  ON requested_members (email);

-- Auto-update updated_at on every row modification
-- set_updated_at() was created in migration 001; CREATE OR REPLACE is safe to re-run.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Create trigger only if it doesn't already exist
-- (pg_trigger must be joined with pg_class to safely scope by table)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        WHERE t.tgname = 'trg_requested_members_updated_at'
          AND c.relname = 'requested_members'
    ) THEN
        CREATE TRIGGER trg_requested_members_updated_at
        BEFORE UPDATE ON requested_members
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END;
$$;

-- Enable Row Level Security
ALTER TABLE requested_members ENABLE ROW LEVEL SECURITY;

-- Policy: allow authenticated users (admins via service role) to read/write all rows.
-- DROP first so this script is safe to re-run.
DROP POLICY IF EXISTS "Admins can manage requested_members" ON requested_members;
CREATE POLICY "Admins can manage requested_members"
ON requested_members
FOR ALL
USING (auth.role() = 'authenticated');

COMMIT;
