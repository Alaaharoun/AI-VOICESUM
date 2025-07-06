/*
  # Complete Admin System Reset and Fix

  This migration completely resets and rebuilds the admin system to resolve
  all permission conflicts and ensure proper superadmin functionality.
  
  1. Clean Database State
    - Remove all existing conflicting roles/permissions
    - Reset RLS policies
    
  2. Rebuild Admin System
    - Create fresh superadmin role
    - Set up proper permissions
    - Configure safe RLS policies
    
  3. Assign Superadmin Access
    - Grant superadmin to specified emails
    - Set up auto-assignment trigger
*/

-- =============================================================================
-- 1. COMPLETE CLEANUP - Remove all existing admin data
-- =============================================================================

-- Disable RLS temporarily for cleanup
ALTER TABLE IF EXISTS user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS role_permissions DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Superadmins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Superadmins can view all user_roles" ON user_roles;
DROP POLICY IF EXISTS "Superadmins can manage all user_roles" ON user_roles;
DROP POLICY IF EXISTS "Superadmins can view all roles" ON roles;
DROP POLICY IF EXISTS "Superadmins can manage all roles" ON roles;
DROP POLICY IF EXISTS "Superadmins can view all permissions" ON permissions;
DROP POLICY IF EXISTS "Superadmins can manage all permissions" ON permissions;
DROP POLICY IF EXISTS "Superadmins can view all role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Superadmins can manage all role_permissions" ON role_permissions;

-- Drop existing policies that depend on functions first
DROP POLICY IF EXISTS "Superadmins can view all recordings" ON recordings;
DROP POLICY IF EXISTS "Superadmins can manage all recordings" ON recordings;
DROP POLICY IF EXISTS "Superadmins can view all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can manage all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can view all daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Superadmins can manage all daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Superadmins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Superadmins can manage all roles" ON roles;
DROP POLICY IF EXISTS "Superadmins can manage all permissions" ON permissions;
DROP POLICY IF EXISTS "Superadmins can manage all role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Superadmins can manage all user_roles" ON user_roles;

-- Drop existing triggers first (before functions)
DROP TRIGGER IF EXISTS auto_assign_superadmin_trigger ON auth.users;

-- Drop existing functions that might cause issues
DROP FUNCTION IF EXISTS is_superadmin(uuid);
DROP FUNCTION IF EXISTS has_permission(text, uuid);
DROP FUNCTION IF EXISTS assign_superadmin_role(text);
DROP FUNCTION IF EXISTS auto_assign_superadmin();

-- Drop existing view
DROP VIEW IF EXISTS user_roles_view;

-- Clear all existing data (start fresh)
DELETE FROM user_roles;
DELETE FROM role_permissions;
DELETE FROM permissions;
DELETE FROM roles;

-- =============================================================================
-- 2. RECREATE TABLES WITH PROPER STRUCTURE
-- =============================================================================

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(50) UNIQUE NOT NULL,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(100) UNIQUE NOT NULL,
    description text,
    resource varchar(50) NOT NULL,
    action varchar(50) NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Role permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

-- User roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    UNIQUE(user_id, role_id)
);

-- =============================================================================
-- 3. CREATE INDEXES
-- =============================================================================

DROP INDEX IF EXISTS idx_user_roles_user_id;
DROP INDEX IF EXISTS idx_user_roles_role_id;
DROP INDEX IF EXISTS idx_role_permissions_role_id;
DROP INDEX IF EXISTS idx_role_permissions_permission_id;

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- =============================================================================
-- 4. INSERT FRESH DATA
-- =============================================================================

-- Insert superadmin role
INSERT INTO roles (name, description) 
VALUES ('superadmin', 'Super Administrator with full system access');

-- Insert all required permissions
INSERT INTO permissions (name, description, resource, action) VALUES
    ('users.read', 'View all users', 'users', 'read'),
    ('users.write', 'Create and update users', 'users', 'write'),
    ('users.delete', 'Delete users', 'users', 'delete'),
    ('roles.read', 'View all roles', 'roles', 'read'),
    ('roles.write', 'Create and update roles', 'roles', 'write'),
    ('roles.delete', 'Delete roles', 'roles', 'delete'),
    ('permissions.read', 'View all permissions', 'permissions', 'read'),
    ('permissions.write', 'Create and update permissions', 'permissions', 'write'),
    ('permissions.delete', 'Delete permissions', 'permissions', 'delete'),
    ('subscriptions.read', 'View all subscriptions', 'subscriptions', 'read'),
    ('subscriptions.write', 'Create and update subscriptions', 'subscriptions', 'write'),
    ('subscriptions.delete', 'Delete subscriptions', 'subscriptions', 'delete'),
    ('recordings.read', 'View all recordings', 'recordings', 'read'),
    ('recordings.write', 'Create and update recordings', 'recordings', 'write'),
    ('recordings.delete', 'Delete recordings', 'recordings', 'delete'),
    ('system.admin', 'Full system administration access', 'system', 'admin');

-- Link all permissions to superadmin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'superadmin'),
    p.id
FROM permissions p;

-- =============================================================================
-- 5. CREATE SAFE HELPER FUNCTIONS (NO RLS CONFLICTS)
-- =============================================================================

-- Create a simple, safe superadmin check function
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM user_roles ur
        INNER JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name = 'superadmin'
    );
$$;

-- Function to assign superadmin role
CREATE OR REPLACE FUNCTION assign_superadmin_role(user_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_user_id uuid;
    superadmin_role_id uuid;
BEGIN
    -- Get superadmin role ID
    SELECT id INTO superadmin_role_id FROM roles WHERE name = 'superadmin';
    
    IF superadmin_role_id IS NULL THEN
        RETURN 'ERROR: Superadmin role not found';
    END IF;
    
    -- Find user by email
    SELECT id INTO target_user_id FROM auth.users WHERE email = user_email;
    
    IF target_user_id IS NULL THEN
        RETURN 'PENDING: User ' || user_email || ' not found, will be assigned when they sign up';
    END IF;
    
    -- Assign role
    INSERT INTO user_roles (user_id, role_id)
    VALUES (target_user_id, superadmin_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    RETURN 'SUCCESS: Superadmin role assigned to ' || user_email;
END;
$$;

-- =============================================================================
-- 6. ASSIGN SUPERADMIN TO SPECIFIED USERS
-- =============================================================================

-- Clear any existing assignments and create fresh ones
DELETE FROM user_roles 
WHERE role_id = (SELECT id FROM roles WHERE name = 'superadmin');

-- Assign superadmin roles to your specified emails
SELECT assign_superadmin_role('alaa_zekroum@hotmail.com') as result1;
SELECT assign_superadmin_role('alaa.kotbi@gmail.com') as result2;

-- =============================================================================
-- 7. CREATE AUTO-ASSIGNMENT TRIGGER
-- =============================================================================

-- Trigger function to auto-assign superadmin role
CREATE OR REPLACE FUNCTION auto_assign_superadmin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    superadmin_role_id uuid;
BEGIN
    -- Check if this is one of our target superadmin emails
    IF NEW.email IN ('alaa_zekroum@hotmail.com', 'alaa.kotbi@gmail.com') THEN
        -- Get superadmin role ID
        SELECT id INTO superadmin_role_id FROM roles WHERE name = 'superadmin';
        
        IF superadmin_role_id IS NOT NULL THEN
            -- Assign superadmin role
            INSERT INTO user_roles (user_id, role_id)
            VALUES (NEW.id, superadmin_role_id)
            ON CONFLICT (user_id, role_id) DO NOTHING;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for new user signups
CREATE TRIGGER auto_assign_superadmin_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_superadmin();

-- =============================================================================
-- 8. CREATE USER ROLES VIEW
-- =============================================================================

CREATE VIEW user_roles_view AS
SELECT 
    au.id as user_id,
    au.email,
    r.name as role_name,
    r.description as role_description,
    ur.created_at as role_assigned_at
FROM auth.users au
JOIN user_roles ur ON au.id = ur.user_id
JOIN roles r ON ur.role_id = r.id;

-- =============================================================================
-- 9. ENABLE RLS AND CREATE SIMPLE, SAFE POLICIES
-- =============================================================================

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Simple policies that work without recursion

-- Roles policies
CREATE POLICY "Allow superadmin full access to roles"
    ON roles FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Permissions policies  
CREATE POLICY "Allow superadmin full access to permissions"
    ON permissions FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Role permissions policies
CREATE POLICY "Allow superadmin full access to role_permissions"
    ON role_permissions FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- User roles policies
CREATE POLICY "Users can view their own roles"
    ON user_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Allow superadmin full access to user_roles"
    ON user_roles FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- =============================================================================
-- 10. GRANT PERMISSIONS
-- =============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON user_roles_view TO authenticated;
GRANT EXECUTE ON FUNCTION is_superadmin() TO authenticated;

-- =============================================================================
-- 11. VERIFICATION
-- =============================================================================

SELECT 
    'Admin system reset completed successfully!' as status,
    (SELECT COUNT(*) FROM roles) as total_roles,
    (SELECT COUNT(*) FROM permissions) as total_permissions,
    (SELECT COUNT(*) FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE r.name = 'superadmin') as superadmin_users;