-- Add is_full_admin flag to users table.
-- full_admin users have global access across all tenants and are exempt from tenant guards.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_full_admin BOOLEAN NOT NULL DEFAULT false;
