/*
  # Restore Superadmin Access

  This migration fixes the superadmin access issues by:
  1. Cleaning up existing problematic policies and data
  2. Ensuring superadmin role and permissions exist
  3. Properly assigning superadmin role to specified emails
  4. Creating clean, working RLS policies without recursion
  
  Target emails for superadmin access:
  - alaa_zekroum@hotmail.com  
  - alaa.kotbi@gmail.com
*/

-- =============================================================================
-- 1. CLEANUP - Disable RLS temporarily to fix issues
-- =============================================================================

ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start clean
DROP POLICY IF EXISTS "Superadmins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles only" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Service role can manage all user roles" ON user_roles;

-- =============================================================================
-- 2. ENSURE BASIC STRUCTURE EXISTS
-- =============================================================================

-- Ensure superadmin role exists
INSERT INTO roles (name, description) 
VALUES ('superadmin', 'Super Administrator with full system access')
ON CONFLICT (name) DO NOTHING;

-- Ensure basic admin permissions exist
INSERT INTO permissions (name, description, resource, action) VALUES
    ('system.admin', 'Full system administration access', 'system', 'admin'),
    ('users.manage', 'Manage all users', 'users', 'manage'),
    ('recordings.manage', 'Manage all recordings', 'recordings', 'manage'),
    ('subscriptions.manage', 'Manage all subscriptions', 'subscriptions', 'manage')
ON CONFLICT (name) DO NOTHING;

-- Link permissions to superadmin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'superadmin'),
    p.id
FROM permissions p
WHERE p.name IN ('system.admin', 'users.manage', 'recordings.manage', 'subscriptions.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================================================
-- 3. CLEAN AND RESTORE SUPERADMIN ASSIGNMENTS
-- =============================================================================

-- Get the superadmin role ID
DO $$
DECLARE
    superadmin_role_id uuid;
    target_emails text[] := ARRAY['alaa_zekroum@hotmail.com', 'alaa.kotbi@gmail.com'];
    email_addr text;
    user_id_found uuid;
    assignment_count integer := 0;
BEGIN
    -- Get superadmin role ID
    SELECT id INTO superadmin_role_id FROM roles WHERE name = 'superadmin';
    
    IF superadmin_role_id IS NULL THEN
        RAISE EXCEPTION 'Superadmin role not found';
    END IF;
    
    -- Clear existing superadmin assignments to start fresh
    DELETE FROM user_roles 
    WHERE role_id = superadmin_role_id;
    
    -- Assign superadmin role to target emails
    FOREACH email_addr IN ARRAY target_emails
    LOOP
        -- Find user by email
        SELECT id INTO user_id_found 
        FROM auth.users 
        WHERE email = email_addr;
        
        IF user_id_found IS NOT NULL THEN
            -- Assign superadmin role
            INSERT INTO user_roles (user_id, role_id, created_by)
            VALUES (user_id_found, superadmin_role_id, user_id_found)
            ON CONFLICT (user_id, role_id) DO NOTHING;
            
            assignment_count := assignment_count + 1;
            RAISE NOTICE 'Assigned superadmin role to: %', email_addr;
        ELSE
            RAISE NOTICE 'User not found for email: % (will be assigned when they sign up)', email_addr;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Successfully assigned superadmin role to % users', assignment_count;
END $$;

-- =============================================================================
-- 4. CREATE SAFE HELPER FUNCTIONS
-- =============================================================================

-- Drop existing policies that depend on the function first
DROP POLICY IF EXISTS "Allow superadmin full access to roles" ON roles;
DROP POLICY IF EXISTS "Allow superadmin full access to permissions" ON permissions;
DROP POLICY IF EXISTS "Allow superadmin full access to role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Superadmins can manage all user_roles" ON user_roles;
DROP POLICY IF EXISTS "Allow superadmin full access to user_roles" ON user_roles;
DROP POLICY IF EXISTS "Superadmins can manage all recordings" ON recordings;
DROP POLICY IF EXISTS "Superadmins can view all recordings" ON recordings;
DROP POLICY IF EXISTS "Superadmins can manage all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can view all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can manage all daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Superadmins can view all daily usage" ON daily_usage;

-- Drop existing function to recreate it cleanly
DROP FUNCTION IF EXISTS is_superadmin();

-- Create a simple, safe function to check superadmin status
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() 
        AND r.name = 'superadmin'
    );
$$;

-- =============================================================================
-- 5. CREATE SIMPLE, WORKING RLS POLICIES
-- =============================================================================

-- Re-enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Simple policies for roles table
CREATE POLICY "Allow superadmin full access to roles"
    ON roles FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Simple policies for permissions table
CREATE POLICY "Allow superadmin full access to permissions"
    ON permissions FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Simple policies for role_permissions table
CREATE POLICY "Allow superadmin full access to role_permissions"
    ON role_permissions FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Simple policies for user_roles table (the problematic one)
CREATE POLICY "Users can view their own roles"
    ON user_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Superadmins can manage all user_roles"
    ON user_roles FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- =============================================================================
-- 6. UPDATE AUTO-ASSIGNMENT TRIGGER
-- =============================================================================

-- Recreate the auto-assignment trigger function
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS auto_assign_superadmin_trigger ON auth.users;
CREATE TRIGGER auto_assign_superadmin_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_superadmin();

-- =============================================================================
-- 7. RECREATE VIEW
-- =============================================================================

DROP VIEW IF EXISTS user_roles_view;
CREATE VIEW user_roles_view AS
SELECT 
    ur.user_id,
    au.email,
    r.name as role_name,
    r.description as role_description,
    ur.created_at as role_assigned_at
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
JOIN auth.users au ON ur.user_id = au.id;

-- =============================================================================
-- 8. GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT ON user_roles_view TO authenticated;
GRANT EXECUTE ON FUNCTION is_superadmin() TO authenticated;

-- =============================================================================
-- 9. VERIFICATION
-- =============================================================================

-- Check the results
DO $$
DECLARE
    superadmin_count integer;
    role_count integer;
    permission_count integer;
BEGIN
    -- Count superadmin users
    SELECT COUNT(*) INTO superadmin_count
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE r.name = 'superadmin';
    
    -- Count roles
    SELECT COUNT(*) INTO role_count FROM roles;
    
    -- Count permissions
    SELECT COUNT(*) INTO permission_count FROM permissions;
    
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Superadmin users: %', superadmin_count;
    RAISE NOTICE 'Total roles: %', role_count;
    RAISE NOTICE 'Total permissions: %', permission_count;
    
    IF superadmin_count = 0 THEN
        RAISE WARNING 'No superadmin users found! Check if the target email addresses exist in auth.users';
    END IF;
END $$;