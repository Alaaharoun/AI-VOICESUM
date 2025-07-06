/*
  # Create Foundational Tables
  
  This migration creates all foundational tables needed for the superadmin system:
  1. roles - User roles
  2. permissions - System permissions  
  3. role_permissions - Links roles to permissions
  4. profiles - User profiles
  5. user_roles - Links users to roles
  
  This ensures proper dependency order and avoids migration conflicts.
*/

-- =============================================================================
-- 1. CREATE ROLES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 2. CREATE PERMISSIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  resource text,
  action text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 3. CREATE ROLE_PERMISSIONS JUNCTION TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- =============================================================================
-- 4. CREATE PROFILES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 5. CREATE USER_ROLES JUNCTION TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id, role_id)
);

-- =============================================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 7. CREATE BASIC RLS POLICIES
-- =============================================================================

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- User roles policies
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- 8. INSERT SUPERADMIN ROLE AND PERMISSIONS
-- =============================================================================

-- Insert superadmin role
INSERT INTO roles (name, description) 
VALUES ('superadmin', 'Super Administrator with full system access')
ON CONFLICT (name) DO NOTHING;

-- Insert comprehensive admin permissions
INSERT INTO permissions (name, description, resource, action) VALUES
    ('system.admin', 'Full system administration access', 'system', 'admin'),
    ('users.manage', 'Manage all users', 'users', 'manage'),
    ('users.view', 'View all users', 'users', 'view'),
    ('recordings.manage', 'Manage all recordings', 'recordings', 'manage'),
    ('recordings.view', 'View all recordings', 'recordings', 'view'),
    ('subscriptions.manage', 'Manage all subscriptions', 'subscriptions', 'manage'),
    ('subscriptions.view', 'View all subscriptions', 'subscriptions', 'view'),
    ('profiles.manage', 'Manage all profiles', 'profiles', 'manage'),
    ('profiles.view', 'View all profiles', 'profiles', 'view'),
    ('daily_usage.manage', 'Manage all daily usage', 'daily_usage', 'manage'),
    ('daily_usage.view', 'View all daily usage', 'daily_usage', 'view'),
    ('roles.manage', 'Manage user roles and permissions', 'roles', 'manage'),
    ('roles.view', 'View user roles and permissions', 'roles', 'view'),
    ('analytics.view', 'View system analytics and reports', 'analytics', 'view'),
    ('settings.manage', 'Manage system settings and configuration', 'settings', 'manage')
ON CONFLICT (name) DO NOTHING;

-- Link all permissions to superadmin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'superadmin'),
    p.id
FROM permissions p
WHERE p.name IN (
    'system.admin', 'users.manage', 'users.view', 'recordings.manage', 
    'recordings.view', 'subscriptions.manage', 'subscriptions.view',
    'profiles.manage', 'profiles.view', 'daily_usage.manage', 'daily_usage.view',
    'roles.manage', 'roles.view', 'analytics.view', 'settings.manage'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================================================
-- 9. CREATE HELPER FUNCTIONS
-- =============================================================================

-- Function to check if user is superadmin
CREATE OR REPLACE FUNCTION is_superadmin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
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
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_uuid AND p.name = permission_name
    );
END;
$$;

-- Function to assign superadmin role to specific emails
CREATE OR REPLACE FUNCTION assign_superadmin_to_emails()
RETURNS TABLE(email text, status text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    superadmin_role_id uuid;
    target_emails text[] := ARRAY['alaa_zekroum@hotmail.com', 'alaa.kotbi@gmail.com'];
    email_addr text;
    user_id_found uuid;
BEGIN
    -- Get superadmin role ID
    SELECT id INTO superadmin_role_id FROM roles WHERE name = 'superadmin';
    
    IF superadmin_role_id IS NULL THEN
        RETURN QUERY SELECT ''::text, 'ERROR'::text, 'Superadmin role not found'::text;
        RETURN;
    END IF;
    
    -- Loop through target emails
    FOREACH email_addr IN ARRAY target_emails
    LOOP
        -- Find user by email in auth.users
        SELECT au.id INTO user_id_found
        FROM auth.users au
        WHERE au.email = email_addr;
        
        -- If user exists, assign superadmin role
        IF user_id_found IS NOT NULL THEN
            INSERT INTO user_roles (user_id, role_id, created_by)
            VALUES (user_id_found, superadmin_role_id, user_id_found)
            ON CONFLICT (user_id, role_id) DO NOTHING;
            
            RETURN QUERY SELECT email_addr, 'SUCCESS'::text, 'Assigned superadmin role'::text;
        ELSE
            RETURN QUERY SELECT email_addr, 'WARNING'::text, 'User not found - will be assigned when they sign up'::text;
        END IF;
    END LOOP;
END;
$$;

-- =============================================================================
-- 10. CREATE VIEW FOR EASY ROLE CHECKING
-- =============================================================================

CREATE OR REPLACE VIEW user_roles_view AS
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
-- 11. GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT ON user_roles_view TO authenticated;
GRANT EXECUTE ON FUNCTION is_superadmin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION has_permission(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_superadmin_to_emails() TO authenticated;

-- =============================================================================
-- 12. ASSIGN SUPERADMIN ROLES TO TARGET EMAILS
-- =============================================================================

-- Execute the assignment function for existing users
SELECT * FROM assign_superadmin_to_emails();

-- =============================================================================
-- 13. VERIFICATION
-- =============================================================================

-- Check the results
DO $$
DECLARE
    superadmin_count integer;
    role_count integer;
    permission_count integer;
    assignment_count integer;
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
    
    -- Count role-permission assignments for superadmin
    SELECT COUNT(*) INTO assignment_count
    FROM role_permissions rp
    JOIN roles r ON rp.role_id = r.id
    WHERE r.name = 'superadmin';
    
    RAISE NOTICE 'Foundational tables migration completed successfully!';
    RAISE NOTICE 'Superadmin users: %', superadmin_count;
    RAISE NOTICE 'Total roles: %', role_count;
    RAISE NOTICE 'Total permissions: %', permission_count;
    RAISE NOTICE 'Superadmin permissions: %', assignment_count;
    
    IF superadmin_count = 0 THEN
        RAISE WARNING 'No superadmin users found! Check if the target email addresses exist in auth.users';
    END IF;
    
    IF assignment_count < 10 THEN
        RAISE WARNING 'Not all permissions assigned to superadmin role!';
    END IF;
END $$; 