/*
  # Fix Complete Superadmin Role System

  This migration creates a complete, working superadmin role system with:

  1. Proper Tables Structure
     - Ensures all role-related tables exist with correct constraints
     - Creates indexes for performance
     
  2. Superadmin Role & Permissions
     - Creates 'superadmin' role with comprehensive permissions
     - Links all admin permissions to superadmin role
     
  3. Helper Functions
     - Safe is_superadmin() function that avoids recursion
     - Permission checking functions
     - Daily usage management function
     
  4. Row Level Security
     - Proper RLS policies that don't cause infinite recursion
     - Superadmin access to all data
     
  5. User Assignment
     - Assigns superadmin role to specified email addresses
     - Auto-assignment trigger for future signups
     
  6. Views
     - user_roles_view for easy role checking
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. CLEAN UP EXISTING PROBLEMATIC POLICIES
-- =============================================================================

-- Drop all existing policies that might cause recursion
DROP POLICY IF EXISTS "Superadmins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Superadmins can manage all user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

-- Temporarily disable RLS to allow clean setup
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. ENSURE ALL TABLES EXIST WITH PROPER STRUCTURE
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
-- 3. CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- =============================================================================
-- 4. INSERT SUPERADMIN ROLE
-- =============================================================================

INSERT INTO roles (name, description) 
VALUES ('superadmin', 'Super Administrator with full system access')
ON CONFLICT (name) DO UPDATE SET 
    description = EXCLUDED.description,
    updated_at = now();

-- =============================================================================
-- 5. CREATE COMPREHENSIVE ADMIN PERMISSIONS
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
-- 6. LINK ALL PERMISSIONS TO SUPERADMIN ROLE
-- =============================================================================

-- Clear existing role permissions for superadmin and re-add them
DELETE FROM role_permissions 
WHERE role_id = (SELECT id FROM roles WHERE name = 'superadmin');

INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'superadmin'),
    p.id
FROM permissions p;

-- =============================================================================
-- 7. CREATE SAFE HELPER FUNCTIONS (NO RECURSION)
-- =============================================================================

-- Drop existing policies that depend on functions first
DROP POLICY IF EXISTS "Allow superadmin full access to roles" ON roles;
DROP POLICY IF EXISTS "Allow superadmin full access to permissions" ON permissions;
DROP POLICY IF EXISTS "Allow superadmin full access to role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Superadmins can manage all user_roles" ON user_roles;
DROP POLICY IF EXISTS "Superadmins can view all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can manage all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can view all recordings" ON recordings;
DROP POLICY IF EXISTS "Superadmins can manage all recordings" ON recordings;
DROP POLICY IF EXISTS "Superadmins can view all daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Superadmins can manage all daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Superadmins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Superadmins can manage all roles" ON roles;
DROP POLICY IF EXISTS "Superadmins can manage all permissions" ON permissions;
DROP POLICY IF EXISTS "Superadmins can manage all role_permissions" ON role_permissions;

-- Drop existing functions to recreate them
DROP FUNCTION IF EXISTS is_superadmin(uuid);
DROP FUNCTION IF EXISTS has_permission(text, uuid);
DROP FUNCTION IF EXISTS get_or_create_daily_usage(uuid);

-- Safe function to check if user is superadmin (avoids RLS recursion)
CREATE OR REPLACE FUNCTION is_superadmin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = COALESCE(user_uuid, auth.uid())
        AND r.name = 'superadmin'
    );
$$;

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION has_permission(permission_name text, user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON ur.role_id = rp.role_id
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = COALESCE(user_uuid, auth.uid())
        AND p.name = permission_name
    );
$$;

-- Function to get or create daily usage
CREATE OR REPLACE FUNCTION get_or_create_daily_usage(user_uuid uuid)
RETURNS TABLE(user_id uuid, usage_date date, seconds_used integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert or update daily usage record
    INSERT INTO public.daily_usage (user_id, usage_date, seconds_used)
    VALUES (user_uuid, CURRENT_DATE, 0)
    ON CONFLICT (user_id, usage_date) 
    DO NOTHING;
    
    -- Return the current usage
    RETURN QUERY
    SELECT du.user_id, du.usage_date, du.seconds_used
    FROM public.daily_usage du
    WHERE du.user_id = user_uuid 
    AND du.usage_date = CURRENT_DATE;
END;
$$;

-- =============================================================================
-- 8. CREATE USER ROLES VIEW
-- =============================================================================

DROP VIEW IF EXISTS user_roles_view;
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
-- 9. ASSIGN SUPERADMIN ROLE TO SPECIFIED USERS
-- =============================================================================

-- Function to safely assign superadmin role
CREATE OR REPLACE FUNCTION assign_superadmin_role(user_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    target_user_id uuid;
    superadmin_role_id uuid;
BEGIN
    -- Get superadmin role ID
    SELECT id INTO superadmin_role_id FROM public.roles WHERE name = 'superadmin';
    
    IF superadmin_role_id IS NULL THEN
        RETURN 'ERROR: Superadmin role not found';
    END IF;
    
    -- Find user by email
    SELECT id INTO target_user_id FROM auth.users WHERE email = user_email;
    
    IF target_user_id IS NULL THEN
        RETURN 'PENDING: User ' || user_email || ' not found, will be assigned when they sign up';
    END IF;
    
    -- Assign role (using ON CONFLICT to prevent duplicates)
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (target_user_id, superadmin_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    -- Verify assignment
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = target_user_id AND role_id = superadmin_role_id) THEN
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
-- 10. CREATE TRIGGER FOR AUTOMATIC SUPERADMIN ASSIGNMENT
-- =============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_assign_superadmin_trigger ON auth.users;
DROP FUNCTION IF EXISTS auto_assign_superadmin();

-- Trigger function to auto-assign superadmin role to specified emails
CREATE OR REPLACE FUNCTION auto_assign_superadmin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    superadmin_role_id uuid;
BEGIN
    -- Check if this is one of our target superadmin emails
    IF NEW.email IN ('alaa_zekroum@hotmail.com', 'alaa.kotbi@gmail.com') THEN
        -- Get superadmin role ID
        SELECT id INTO superadmin_role_id FROM public.roles WHERE name = 'superadmin';
        
        IF superadmin_role_id IS NOT NULL THEN
            -- Assign superadmin role
            INSERT INTO public.user_roles (user_id, role_id)
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
-- 11. ENABLE ROW LEVEL SECURITY AND CREATE SAFE POLICIES
-- =============================================================================

-- Enable RLS on all role-related tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create safe policies that don't cause recursion

-- Policies for roles table
CREATE POLICY "Superadmins can view all roles"
    ON roles FOR SELECT
    TO authenticated
    USING (is_superadmin());

CREATE POLICY "Superadmins can manage all roles"
    ON roles FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Policies for permissions table
CREATE POLICY "Superadmins can view all permissions"
    ON permissions FOR SELECT
    TO authenticated
    USING (is_superadmin());

CREATE POLICY "Superadmins can manage all permissions"
    ON permissions FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Policies for role_permissions table
CREATE POLICY "Superadmins can view all role_permissions"
    ON role_permissions FOR SELECT
    TO authenticated
    USING (is_superadmin());

CREATE POLICY "Superadmins can manage all role_permissions"
    ON role_permissions FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Policies for user_roles table (SAFE - no recursion)
CREATE POLICY "Users can view their own roles"
    ON user_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Superadmins can view all user_roles"
    ON user_roles FOR SELECT
    TO authenticated
    USING (is_superadmin());

CREATE POLICY "Superadmins can manage all user_roles"
    ON user_roles FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- =============================================================================
-- 12. UPDATE EXISTING TABLE POLICIES FOR SUPERADMIN ACCESS
-- =============================================================================

-- Update recordings table policies
DROP POLICY IF EXISTS "Superadmins can manage all recordings" ON recordings;
DROP POLICY IF EXISTS "Superadmins can view all recordings" ON recordings;

CREATE POLICY "Superadmins can view all recordings"
    ON recordings FOR SELECT
    TO authenticated
    USING (is_superadmin());

CREATE POLICY "Superadmins can manage all recordings"
    ON recordings FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Update user_subscriptions table policies
DROP POLICY IF EXISTS "Superadmins can manage all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can view all subscriptions" ON user_subscriptions;

CREATE POLICY "Superadmins can view all subscriptions"
    ON user_subscriptions FOR SELECT
    TO authenticated
    USING (is_superadmin());

CREATE POLICY "Superadmins can manage all subscriptions"
    ON user_subscriptions FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Update daily_usage table policies
DROP POLICY IF EXISTS "Superadmins can manage all daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Superadmins can view all daily usage" ON daily_usage;

CREATE POLICY "Superadmins can view all daily usage"
    ON daily_usage FOR SELECT
    TO authenticated
    USING (is_superadmin());

CREATE POLICY "Superadmins can manage all daily usage"
    ON daily_usage FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Update profiles table policies
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
-- 13. VERIFICATION AND FINAL STATUS
-- =============================================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON user_roles_view TO authenticated;

-- Success message
SELECT 'Complete superadmin system setup finished successfully!' as setup_status,
       'Roles: ' || (SELECT COUNT(*) FROM roles) as total_roles,
       'Permissions: ' || (SELECT COUNT(*) FROM permissions) as total_permissions,
       'Superadmin assignments: ' || (SELECT COUNT(*) FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE r.name = 'superadmin') as superadmin_users;