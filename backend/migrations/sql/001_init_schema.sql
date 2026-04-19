-- Ascent Dashboard initial schema for Supabase SQL editor
-- Apply after creating the Supabase project and linking DATABASE_URL.

create extension if not exists pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_level') THEN
        CREATE TYPE access_level AS ENUM ('ROUND1', 'FINAL', 'FULL');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('user', 'admin', 'scanner', 'superAdmin', 'eventManage', 'EM');
    END IF;
END$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unstop_id varchar(128) UNIQUE,
    username varchar(64) NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL,
    name varchar(255) NOT NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    events jsonb NOT NULL DEFAULT '{}'::jsonb,
    food jsonb NOT NULL DEFAULT '{"meal1": false, "meal2": false, "meal3": false}'::jsonb,
    access_level access_level NOT NULL DEFAULT 'ROUND1',
    role user_role NOT NULL DEFAULT 'user',
    is_attending boolean NOT NULL DEFAULT false,
    is_profile_complete boolean NOT NULL DEFAULT false,
    cents integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    description text NOT NULL DEFAULT '',
    start_date timestamptz,
    end_date timestamptz,
    venue text[] NOT NULL DEFAULT '{}'::text[],
    judges text[] NOT NULL DEFAULT '{}'::text[],
    rounds jsonb NOT NULL DEFAULT '{}'::jsonb,
    participants jsonb NOT NULL DEFAULT '{}'::jsonb,
    rules text NOT NULL DEFAULT '',
    max_participants integer NOT NULL DEFAULT 500,
    registration_deadline timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_users_unstop_id ON users (unstop_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_events_name ON events (name);
CREATE INDEX IF NOT EXISTS idx_events_registration_deadline ON events (registration_deadline);
