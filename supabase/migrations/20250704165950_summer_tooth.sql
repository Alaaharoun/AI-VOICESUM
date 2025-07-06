/*
  # Fix Complete Superadmin Role System

  1. Tables & Structure
     - Ensure all role/permission tables exist with proper constraints
     - Create junction tables for many-to-many relationships
     - Add proper indexes for performance

  2. Roles & Permissions
     - Create 'superadmin' role with description
     - Create comprehensive admin permissions
     - Link all permissions to superadmin role

  3. Superadmin Users
     - Assign superadmin role to: alaa_zekroum@hotmail.com, alaa.kotbi@gmail.com
     - Handle both existing and future user accounts
     - Create trigger for automatic assignment

  4. Security & Access
     - RLS policies for all role-related tables
     - Helper functions for permission checking
     - Superadmin access policies for all data tables

  5. Views & Functions
     - user_roles_view for easy role checking
     - is_superadmin() function
     - has_permission() function
*/

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. ENSURE ALL TABLES EXIST WITH PROPER STRUCTURE
-- =============================================================================

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
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- =============================================================================
-- 3. INSERT SUPERADMIN ROLE
-- =============================================================================

INSERT INTO roles (name, description) 
VALUES ('superadmin', 'Super Administrator with full system access')
ON CONFLICT (name) DO UPDATE SET 
    description = EXCLUDED.description,
    updated_at = now();

-- =============================================================================
-- 4. CREATE COMPREHENSIVE ADMIN PERMISSIONS
-- =============================================================================

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
    ('system.admin', 'Full system administration access', 'system', 'admin')
ON CONFLICT (name) DO UPDATE SET 
    description = EXCLUDED.description,
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    updated_at = now();

-- =============================================================================
-- 5. LINK ALL PERMISSIONS TO SUPERADMIN ROLE
-- =============================================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'superadmin'),
    p.id
FROM permissions p
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================================================
-- 6. CREATE HELPER FUNCTIONS
-- =============================================================================

-- Function to check if user is superadmin
CREATE OR REPLACE FUNCTION is_superadmin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = user_uuid 
        AND r.name = 'superadmin'
    );
$$;

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION has_permission(permission_name text, user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_uuid 
        AND p.name = permission_name
    );
$$;

-- Function to get or create daily usage (needed for the app)
CREATE OR REPLACE FUNCTION get_or_create_daily_usage(user_uuid uuid)
RETURNS TABLE(user_id uuid, usage_date date, seconds_used integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert or update daily usage record
    INSERT INTO daily_usage (user_id, usage_date, seconds_used)
    VALUES (user_uuid, CURRENT_DATE, 0)
    ON CONFLICT (user_id, usage_date) 
    DO NOTHING;
    
    -- Return the current usage
    RETURN QUERY
    SELECT du.user_id, du.usage_date, du.seconds_used
    FROM daily_usage du
    WHERE du.user_id = user_uuid 
    AND du.usage_date = CURRENT_DATE;
END;
$$;

-- =============================================================================
-- 7. CREATE USER ROLES VIEW
-- =============================================================================

CREATE OR REPLACE VIEW user_roles_view AS
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
-- 8. ASSIGN SUPERADMIN ROLE TO SPECIFIED USERS
-- =============================================================================

-- Function to assign superadmin role to user by email
CREATE OR REPLACE FUNCTION assign_superadmin_role(user_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_user_id uuid;
    superadmin_role_id uuid;
    result_message text;
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
    
    -- Assign role (using ON CONFLICT to prevent duplicates)
    INSERT INTO user_roles (user_id, role_id)
    VALUES (target_user_id, superadmin_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    -- Check if assignment was successful
    IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = target_user_id AND role_id = superadmin_role_id) THEN
        RETURN 'SUCCESS: Superadmin role assigned to ' || user_email;
    ELSE
        RETURN 'ERROR: Failed to assign superadmin role to ' || user_email;
    END IF;
END;
$$;

-- Assign superadmin roles to specified users
SELECT assign_superadmin_role('alaa_zekroum@hotmail.com') as assignment_result_1;
SELECT assign_superadmin_role('alaa.kotbi@gmail.com') as assignment_result_2;

-- =============================================================================
-- 9. CREATE TRIGGER FOR AUTOMATIC SUPERADMIN ASSIGNMENT
-- =============================================================================

-- Trigger function to auto-assign superadmin role to specified emails
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_assign_superadmin_trigger ON auth.users;

-- Create trigger for new user signups
CREATE TRIGGER auto_assign_superadmin_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_superadmin();

-- =============================================================================
-- 10. ENABLE ROW LEVEL SECURITY AND CREATE POLICIES
-- =============================================================================

-- Enable RLS on all role-related tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Superadmins can manage all roles" ON roles;
DROP POLICY IF EXISTS "Superadmins can manage all permissions" ON permissions;
DROP POLICY IF EXISTS "Superadmins can manage all role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Superadmins can manage all user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

-- Policies for roles table
CREATE POLICY "Superadmins can manage all roles"
    ON roles FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Policies for permissions table
CREATE POLICY "Superadmins can manage all permissions"
    ON permissions FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Policies for role_permissions table
CREATE POLICY "Superadmins can manage all role_permissions"
    ON role_permissions FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Policies for user_roles table
CREATE POLICY "Superadmins can manage all user_roles"
    ON user_roles FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

CREATE POLICY "Users can view their own roles"
    ON user_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- =============================================================================
-- 11. UPDATE EXISTING TABLE POLICIES FOR SUPERADMIN ACCESS
-- =============================================================================

-- Update recordings table policies for superadmin access
DROP POLICY IF EXISTS "Superadmins can manage all recordings" ON recordings;
DROP POLICY IF EXISTS "Superadmins can view all recordings" ON recordings;

CREATE POLICY "Superadmins can manage all recordings"
    ON recordings FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Update user_subscriptions table policies for superadmin access
DROP POLICY IF EXISTS "Superadmins can manage all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can view all subscriptions" ON user_subscriptions;

CREATE POLICY "Superadmins can manage all subscriptions"
    ON user_subscriptions FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Update daily_usage table policies for superadmin access
DROP POLICY IF EXISTS "Superadmins can manage all daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Superadmins can view all daily usage" ON daily_usage;

CREATE POLICY "Superadmins can manage all daily usage"
    ON daily_usage FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Update profiles table policies for superadmin access
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Superadmins can manage all profiles" ON profiles;

CREATE POLICY "Superadmins can view all profiles"
    ON profiles FOR SELECT
    TO authenticated
    USING (is_superadmin());

CREATE POLICY "Superadmins can manage all profiles"
    ON profiles FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- =============================================================================
-- 12. VERIFICATION QUERIES (commented out for production)
-- =============================================================================

-- The following queries can be uncommented to verify the setup:

-- Check roles created
-- SELECT * FROM roles WHERE name = 'superadmin';

-- Check permissions created
-- SELECT COUNT(*) as permission_count FROM permissions;

-- Check role-permission assignments
-- SELECT r.name as role_name, COUNT(rp.permission_id) as permission_count
-- FROM roles r
-- LEFT JOIN role_permissions rp ON r.id = rp.role_id
-- WHERE r.name = 'superadmin'
-- GROUP BY r.name;

-- Check user role assignments
-- SELECT * FROM user_roles_view WHERE role_name = 'superadmin';

-- Test helper functions
-- SELECT is_superadmin() as am_i_superadmin;
-- SELECT has_permission('system.admin') as can_admin_system;

-- Final success message
SELECT 'Superadmin system setup completed successfully!' as setup_status;