-- Migration to add new roles to the user_role ENUM
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superAdmin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'eventManage';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'EM';
