-- Create and configure the Supabase Storage bucket used by submission uploads.
-- Apply after the core schema migrations.

insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do update
set name = excluded.name,
    public = false;

update storage.buckets
set public = false
where id = 'submissions';

-- No storage object policies are required for the current backend flow.
-- The API uploads with the service role key and returns signed URLs for access.
