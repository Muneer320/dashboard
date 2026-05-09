-- 032: soft-delete for admin accounts
ALTER TABLE admins ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
NOTIFY pgrst, 'reload schema';
