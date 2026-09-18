-- Promote leftover super_admin accounts to the current admin role.
-- App auth only accepts admin | user; rows still marked super_admin would 403.
UPDATE users SET auth_role = 'admin' WHERE auth_role = 'super_admin';
