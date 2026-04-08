-- Row-level security policies for direct Supabase client access.
-- The backend can continue using its existing database connection path.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_row" ON users;
CREATE POLICY "users_select_own_row"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own_row" ON users;
CREATE POLICY "users_update_own_row"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "events_select_authenticated" ON events;
CREATE POLICY "events_select_authenticated"
ON events
FOR SELECT
TO authenticated
USING (true);

-- Backend-owned tables should not be writable from client-side Supabase sessions.
DROP POLICY IF EXISTS "rate_limit_entries_no_client_access" ON rate_limit_entries;
CREATE POLICY "rate_limit_entries_no_client_access"
ON rate_limit_entries
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);
