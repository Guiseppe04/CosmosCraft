-- RBAC refactor migration
-- This keeps the legacy users.role column as a compatibility field while ensuring the RBAC tables are authoritative.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
    CREATE TYPE user_role_enum AS ENUM ('customer', 'staff', 'admin', 'super_admin');
  END IF;
END $$;

ALTER TABLE users
  ALTER COLUMN role TYPE user_role_enum
  USING role::text::user_role_enum;

ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'customer';

INSERT INTO roles (role_id, name, description, level, is_system)
VALUES
  (gen_random_uuid(), 'super_admin', 'Full system access with all permissions', 100, true),
  (gen_random_uuid(), 'admin', 'Administrative access to manage system', 80, true),
  (gen_random_uuid(), 'staff', 'Staff access for day-to-day operations', 50, true),
  (gen_random_uuid(), 'customer', 'Regular customer access', 10, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (permission_id, name, description, category)
VALUES
  (gen_random_uuid(), 'manage_users', 'Create, update, delete users', 'users'),
  (gen_random_uuid(), 'assign_roles', 'Assign roles to users', 'users'),
  (gen_random_uuid(), 'view_users', 'View user information', 'users'),
  (gen_random_uuid(), 'manage_products', 'Create, update, delete products', 'products'),
  (gen_random_uuid(), 'view_products', 'View product catalog', 'products'),
  (gen_random_uuid(), 'manage_orders', 'Create, update, delete orders', 'orders'),
  (gen_random_uuid(), 'view_orders', 'View order details', 'orders'),
  (gen_random_uuid(), 'cancel_orders', 'Cancel orders', 'orders'),
  (gen_random_uuid(), 'manage_services', 'Create, update, delete services', 'services'),
  (gen_random_uuid(), 'view_services', 'View service list', 'services'),
  (gen_random_uuid(), 'manage_appointments', 'Create, update, delete appointments', 'appointments'),
  (gen_random_uuid(), 'view_appointments', 'View appointment details', 'appointments'),
  (gen_random_uuid(), 'approve_appointments', 'Approve or reject appointments', 'appointments'),
  (gen_random_uuid(), 'manage_payments', 'View and manage payments', 'payments'),
  (gen_random_uuid(), 'verify_payments', 'Verify payment submissions', 'payments'),
  (gen_random_uuid(), 'refund_payments', 'Process payment refunds', 'payments'),
  (gen_random_uuid(), 'manage_cart', 'Manage shopping cart', 'cart'),
  (gen_random_uuid(), 'checkout', 'Process checkout and orders', 'cart'),
  (gen_random_uuid(), 'manage_customizations', 'Create, update, delete customizations', 'customizations'),
  (gen_random_uuid(), 'view_customizations', 'View customization designs', 'customizations'),
  (gen_random_uuid(), 'view_reports', 'Access reports and analytics', 'reports'),
  (gen_random_uuid(), 'export_data', 'Export data from system', 'reports'),
  (gen_random_uuid(), 'manage_settings', 'Manage system settings', 'system'),
  (gen_random_uuid(), 'manage_roles', 'Create and manage roles', 'system'),
  (gen_random_uuid(), 'manage_permissions', 'Manage permissions', 'system')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT role_id FROM roles WHERE name = 'super_admin'), permission_id FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT role_id FROM roles WHERE name = 'admin'), permission_id FROM permissions
WHERE name NOT IN ('manage_roles', 'manage_permissions')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT role_id FROM roles WHERE name = 'staff'), permission_id FROM permissions
WHERE name IN ('view_products', 'manage_orders', 'view_orders', 'cancel_orders', 'view_services', 'manage_appointments', 'view_appointments', 'approve_appointments', 'manage_payments', 'verify_payments', 'view_customizations')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT role_id FROM roles WHERE name = 'customer'), permission_id FROM permissions
WHERE name IN ('view_products', 'view_services', 'view_appointments', 'manage_cart', 'checkout', 'view_customizations', 'view_orders')
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT user_id,
  CASE
    WHEN role = 'super_admin' THEN (SELECT role_id FROM roles WHERE name = 'super_admin')
    WHEN role = 'admin' THEN (SELECT role_id FROM roles WHERE name = 'admin')
    WHEN role = 'staff' THEN (SELECT role_id FROM roles WHERE name = 'staff')
    ELSE (SELECT role_id FROM roles WHERE name = 'customer')
  END
FROM users
WHERE role IS NOT NULL
ON CONFLICT DO NOTHING;
