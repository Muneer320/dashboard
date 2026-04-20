-- Migration: Add teams, link users to teams (NOT NULL), and create admins table

-- 1. Create the teams table
CREATE TABLE IF NOT EXISTS teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at in teams
DROP TRIGGER IF EXISTS trg_teams_updated_at ON teams;
CREATE TRIGGER trg_teams_updated_at
BEFORE UPDATE ON teams
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 2. Modify users table to include team_id (NOT NULL)
-- If there are existing rows, we create a default team to prevent NOT NULL constraint violation.
DO $$
DECLARE
    default_event_id uuid;
    default_team_id uuid;
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE team_id IS NULL) THEN
        -- check if an event exists, if not create a temporary one or pick first
        SELECT id INTO default_event_id FROM events LIMIT 1;
        IF default_event_id IS NULL THEN
            INSERT INTO events (name) VALUES ('Default Event Setup') RETURNING id INTO default_event_id;
        END IF;

        -- Create a default team
        INSERT INTO teams (name, event_id) VALUES ('Default System Team', default_event_id) RETURNING id INTO default_team_id;

        -- We only alter if 'team_id' doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'team_id') THEN
            ALTER TABLE users ADD COLUMN team_id uuid;
        END IF;

        UPDATE users SET team_id = default_team_id WHERE team_id IS NULL;
    END IF;
END $$;

-- Actually add/alter the constraint
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id uuid;
ALTER TABLE users ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_team_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT;

-- 3. Create the admin_role enum and admins table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role_enum') THEN
        CREATE TYPE admin_role_enum AS ENUM ('admin', 'eventManager', 'Scanner');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS admins (
    uid SERIAL PRIMARY KEY,
    role admin_role_enum NOT NULL DEFAULT 'admin',
    username varchar(64) NOT NULL UNIQUE,
    name varchar(255) NOT NULL,
    password_hash varchar(255) NOT NULL,
    events jsonb DEFAULT '[]'::jsonb,
    phone varchar(20),
    mail varchar(255) NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at in admins
DROP TRIGGER IF EXISTS trg_admins_updated_at ON admins;
CREATE TRIGGER trg_admins_updated_at
BEFORE UPDATE ON admins
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_teams_event_id ON teams(event_id);
CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_mail ON admins(mail);
