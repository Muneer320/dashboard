-- Migration: add role column to users table
-- Adds a role TEXT column with a CHECK constraint.
-- All existing rows default to 'participant'.
-- New self-registered visitors will have role = 'visitor'.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'participant'
  CHECK (role IN ('participant', 'visitor'));

-- Backfill: mark every existing user as a participant explicitly
UPDATE public.users SET role = 'participant' WHERE role IS NULL OR role = 'participant';

COMMENT ON COLUMN public.users.role IS
  'participant = organiser-provisioned attendee; visitor = self-registered walk-in';
