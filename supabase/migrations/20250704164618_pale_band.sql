/*
  # Superadmin Role System

  1. New Tables
    - `roles` - User roles
    - `permissions` - System permissions
    - `role_permissions` - Links roles to permissions
    - `user_roles` - Links users to roles
  
  2. Roles & Permissions
    - Create "superadmin" role with full permissions
    - Create necessary permissions for admin operations
    
  3. Superadmin Users
    - Assign superadmin role to specified email addresses:
      - alaa_zekroum@hotmail.com
      - alaa.kotbi@gmail.com
      
  4. Security
    - RLS policies for role management
    - Helper functions to check user permissions
*/

-- Create roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  resource text,
  action text,
  created_at timestamptz DEFAULT now()
);

-- Create role_permissions junction table if it doesn't exist
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id, role_id)
);

-- Enable RLS on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create policies for user_roles
CREATE POLICY "Superadmins can manage all user roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'superadmin'
    )
  );

-- Insert superadmin role if it doesn't exist
INSERT INTO roles (name, description) 
VALUES ('superadmin', 'Super Administrator with full system access')
ON CONFLICT (name) DO NOTHING;

-- Insert admin permissions if they don't exist
INSERT INTO permissions (name, description, resource, action) VALUES
  ('manage_all_users', 'Manage all user accounts', 'users', 'manage'),
  ('manage_all_subscriptions', 'Manage all user subscriptions', 'subscriptions', 'manage'),
  ('manage_all_recordings', 'Access and manage all recordings', 'recordings', 'manage'),
  ('manage_roles', 'Manage user roles and permissions', 'roles', 'manage'),
  ('view_analytics', 'View system analytics and reports', 'analytics', 'view'),
  ('manage_settings', 'Manage system settings and configuration', 'settings', 'manage')
ON CONFLICT (name) DO NOTHING;

-- Link all permissions to superadmin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'superadmin'),
  p.id
FROM permissions p
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role_id = (SELECT id FROM roles WHERE name = 'superadmin') 
  AND rp.permission_id = p.id
);

-- Function to check if user is superadmin
CREATE OR REPLACE FUNCTION is_superadmin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid AND r.name = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION has_permission(permission_name text, user_uuid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = user_uuid AND p.name = permission_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to assign superadmin role to specific users
CREATE OR REPLACE FUNCTION assign_superadmin_to_emails()
RETURNS TABLE(email text, status text, message text) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function to assign superadmin roles
SELECT * FROM assign_superadmin_to_emails();

-- Create view for easy user role checking
CREATE OR REPLACE VIEW user_roles_view AS
SELECT 
  ur.user_id,
  au.email,
  r.name as role_name,
  r.description as role_description,
  ur.created_at as role_assigned_at
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
JOIN roles r ON ur.role_id = r.id;

-- Grant access to the view
GRANT SELECT ON user_roles_view TO authenticated;

-- Update existing RLS policies to allow superadmin access

-- Allow superadmins to view all user subscriptions
DROP POLICY IF EXISTS "Superadmins can view all subscriptions" ON user_subscriptions;
CREATE POLICY "Superadmins can view all subscriptions"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Allow superadmins to manage all subscriptions  
DROP POLICY IF EXISTS "Superadmins can manage all subscriptions" ON user_subscriptions;
CREATE POLICY "Superadmins can manage all subscriptions"
  ON user_subscriptions
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Allow superadmins to view all recordings
DROP POLICY IF EXISTS "Superadmins can view all recordings" ON recordings;
CREATE POLICY "Superadmins can view all recordings"
  ON recordings
  FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Allow superadmins to manage all recordings
DROP POLICY IF EXISTS "Superadmins can manage all recordings" ON recordings;
CREATE POLICY "Superadmins can manage all recordings"
  ON recordings
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Allow superadmins to view all daily usage
CREATE POLICY "Superadmins can view all daily usage"
  ON daily_usage
  FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Allow superadmins to manage all daily usage
CREATE POLICY "Superadmins can manage all daily usage"
  ON daily_usage
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

/*
  # Additional Superadmin Policies and Functions

  This migration adds additional policies and functions for the superadmin system.
  The foundational tables are already created in the earlier migration.
*/

-- =============================================================================
-- 1. ADDITIONAL RLS POLICIES FOR SUPERADMIN ACCESS
-- =============================================================================

-- Allow superadmins to view all user subscriptions
DROP POLICY IF EXISTS "Superadmins can view all subscriptions" ON user_subscriptions;
CREATE POLICY "Superadmins can view all subscriptions"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Allow superadmins to manage all subscriptions  
DROP POLICY IF EXISTS "Superadmins can manage all subscriptions" ON user_subscriptions;
CREATE POLICY "Superadmins can manage all subscriptions"
  ON user_subscriptions
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Allow superadmins to view all recordings
DROP POLICY IF EXISTS "Superadmins can view all recordings" ON recordings;
CREATE POLICY "Superadmins can view all recordings"
  ON recordings
  FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Allow superadmins to manage all recordings
DROP POLICY IF EXISTS "Superadmins can manage all recordings" ON recordings;
CREATE POLICY "Superadmins can manage all recordings"
  ON recordings
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- =============================================================================
-- 2. ADDITIONAL SUPERADMIN POLICIES FOR ROLE TABLES
-- =============================================================================

-- Allow superadmins full access to roles table
DROP POLICY IF EXISTS "Allow superadmin full access to roles" ON roles;
CREATE POLICY "Allow superadmin full access to roles"
    ON roles FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Allow superadmins full access to permissions table
DROP POLICY IF EXISTS "Allow superadmin full access to permissions" ON permissions;
CREATE POLICY "Allow superadmin full access to permissions"
    ON permissions FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Allow superadmins full access to role_permissions table
DROP POLICY IF EXISTS "Allow superadmin full access to role_permissions" ON role_permissions;
CREATE POLICY "Allow superadmin full access to role_permissions"
    ON role_permissions FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Allow superadmins to manage all user_roles
DROP POLICY IF EXISTS "Superadmins can manage all user_roles" ON user_roles;
CREATE POLICY "Superadmins can manage all user_roles"
    ON user_roles FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- =============================================================================
-- 3. SERVICE ROLE POLICIES FOR ADMINISTRATIVE OPERATIONS
-- =============================================================================

-- Service role policies for administrative operations
DROP POLICY IF EXISTS "Service role can manage all user roles" ON user_roles;
CREATE POLICY "Service role can manage all user roles"
    ON user_roles FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage all roles" ON roles;
CREATE POLICY "Service role can manage all roles"
    ON roles FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage all permissions" ON permissions;
CREATE POLICY "Service role can manage all permissions"
    ON permissions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage all role_permissions" ON role_permissions;
CREATE POLICY "Service role can manage all role_permissions"
    ON role_permissions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- 4. VERIFICATION
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
    
    RAISE NOTICE 'Additional policies migration completed successfully!';
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