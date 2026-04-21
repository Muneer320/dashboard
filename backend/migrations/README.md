# SQL Migrations for Supabase

These files are intended for the Supabase SQL editor.

Apply them in order after creating your Supabase project and configuring the Supabase environment values in `backend/.env`.

## Order

1. `001_init_schema.sql`
2. `002_seed_admin_user.sql` (optional, local/dev only)
3. `003_rate_limit_entries.sql`
4. `004_rls_policies.sql`
5. `005_create_submissions_bucket.sql`
6. `006_update_users_schema.sql`
7. `007_update_user_roles.sql`

## When to create the Supabase project

Create the Supabase project before applying any migration SQL.
You need the project details first so `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` can be configured correctly.

## Notes

- The app expects PostgreSQL with `pgcrypto` available.
- The schema is designed to match the current SQLAlchemy models in `backend/app/models/`.
- `004_rls_policies.sql` is for direct Supabase client access. The backend can still use its existing database connection path.
- `005_create_submissions_bucket.sql` creates the private Storage bucket used by file submissions.
