# SQL Migrations for Supabase

These files are intended for the Supabase SQL editor.

Apply them in order after creating your Supabase project and copying the database connection string into `backend/.env`.

## Order

1. `001_init_schema.sql`
2. `002_seed_admin_user.sql` (optional, local/dev only)

## When to create the Supabase project

Create the Supabase project before applying any migration SQL.
You need the project connection details first so `DATABASE_URL` can point to the correct database.

## Notes

- The app expects PostgreSQL with `pgcrypto` available.
- The schema is designed to match the current SQLAlchemy models in `backend/app/models/`.
- Use the service-role or direct database connection for backend access; row-level security is not required for this backend-only data path.
