-- Persistent QR rate limiting support.

CREATE TABLE IF NOT EXISTS rate_limit_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_key varchar(512) NOT NULL UNIQUE,
    request_count integer NOT NULL DEFAULT 0,
    window_started_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_rate_limit_entries_updated_at ON rate_limit_entries;
CREATE TRIGGER trg_rate_limit_entries_updated_at
BEFORE UPDATE ON rate_limit_entries
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rate_limit_entries_rate_key ON rate_limit_entries (rate_key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_entries_window_started_at ON rate_limit_entries (window_started_at);