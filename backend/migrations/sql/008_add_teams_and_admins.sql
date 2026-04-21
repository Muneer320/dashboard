-- Migration 008: Add teams, link users to teams, and create admins table
-- Fixed: ADD COLUMN must happen before any DO block that queries team_id.

-- ── 1. Create the teams table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teams (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       varchar(255) NOT NULL,
    event_id   uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_teams_updated_at ON teams;
CREATE TRIGGER trg_teams_updated_at
BEFORE UPDATE ON teams
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2. Add team_id column FIRST (before any query that uses it) ───────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id uuid;

-- ── 3. Backfill existing rows that have no team_id ────────────────────────────

DO $$
DECLARE
    default_event_id uuid;
    default_team_id  uuid;
BEGIN
    -- Only do backfill if there are rows with a NULL team_id
    IF EXISTS (SELECT 1 FROM users WHERE team_id IS NULL) THEN
        -- Pick the first event, or create a placeholder
        SELECT id INTO default_event_id FROM events LIMIT 1;
        IF default_event_id IS NULL THEN
            INSERT INTO events (name)
            VALUES ('Default Event Setup')
            RETURNING id INTO default_event_id;
        END IF;

        -- Create a default team for the backfill
        INSERT INTO teams (name, event_id)
        VALUES ('Default System Team', default_event_id)
        RETURNING id INTO default_team_id;

        UPDATE users SET team_id = default_team_id WHERE team_id IS NULL;
    END IF;
END $$;

-- ── 4. Now it's safe to enforce NOT NULL and the FK ───────────────────────────

ALTER TABLE users ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_team_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT;

-- ── 5. Create the admin_role enum and admins table ────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role_enum') THEN
        CREATE TYPE admin_role_enum AS ENUM ('admin', 'eventManager', 'Scanner');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS admins (
    uid           SERIAL       PRIMARY KEY,
    role          admin_role_enum NOT NULL DEFAULT 'admin',
    username      varchar(64)  NOT NULL UNIQUE,
    name          varchar(255) NOT NULL,
    password_hash varchar(255) NOT NULL,
    events        jsonb        NOT NULL DEFAULT '[]'::jsonb,
    phone         varchar(20),
    mail          varchar(255) NOT NULL UNIQUE,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_admins_updated_at ON admins;
CREATE TRIGGER trg_admins_updated_at
BEFORE UPDATE ON admins
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 6. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_teams_event_id  ON teams(event_id);
CREATE INDEX IF NOT EXISTS idx_users_team_id   ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_mail     ON admins(mail);
