-- 031: add redemption_volunteer role
ALTER TYPE admin_role_enum ADD VALUE IF NOT EXISTS 'redemption_volunteer';
NOTIFY pgrst, 'reload schema';
