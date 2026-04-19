-- Migration to add new fields to the users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_attending boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cents integer NOT NULL DEFAULT 0;
