/*
  # Fix Superadmin Role System

  1. New Tables
    - `user_roles` - Links users to roles (junction table)

  2. Roles & Permissions Setup
    - Ensure "superadmin" role exists with full permissions
    - Create necessary permissions for admin operations
    - Link all permissions to superadmin role

  3. Superadmin Users
    - Assign superadmin role to specified email addresses:
      - alaa_zekroum@hotmail.com
      - alaa.kotbi@gmail.com

  4. Security
    - RLS policies for role management
    - Helper functions to check user permissions
    - Policies allowing superadmin access to all data

  5. Views
    - user_roles_view for easy role checking
*/

-- First, ensure all required tables exist with proper structure

-- Create user_roles junction table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Add unique constraint to prevent duplicate role assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_roles_user_id_role_id_key' 
    AND table_name = 'user_roles'
  ) THEN
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE(user_id, role_id);
  END IF;
END $$;

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Superadmins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

-- Create policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

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

-- Create or replace helper functions

-- Function to check if user is superadmin
CREATE OR REPLACE FUNCTION is_superadmin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  IF user_uuid IS NULL THEN
    RETURN false;
  END IF;
  
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
  IF user_uuid IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = user_uuid AND p.name = permission_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely assign superadmin role to specific users
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

-- Function to auto-assign superadmin role when target users sign up
CREATE OR REPLACE FUNCTION auto_assign_superadmin_on_signup()
RETURNS trigger AS $$
DECLARE
  superadmin_role_id uuid;
  target_emails text[] := ARRAY['alaa_zekroum@hotmail.com', 'alaa.kotbi@gmail.com'];
BEGIN
  -- Check if the new user's email is in our target list
  IF NEW.email = ANY(target_emails) THEN
    -- Get superadmin role ID
    SELECT id INTO superadmin_role_id FROM roles WHERE name = 'superadmin';
    
    -- If role exists, assign it
    IF superadmin_role_id IS NOT NULL THEN
      INSERT INTO user_roles (user_id, role_id, created_by)
      VALUES (NEW.id, superadmin_role_id, NEW.id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-assign superadmin role
DROP TRIGGER IF EXISTS auto_assign_superadmin_trigger ON auth.users;
CREATE TRIGGER auto_assign_superadmin_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_superadmin_on_signup();

-- Execute the assignment function for existing users
SELECT * FROM assign_superadmin_to_emails();

-- Create or replace view for easy user role checking
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

-- Update user_roles policies to allow superadmin management
CREATE POLICY "Superadmins can manage all user roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Drop existing superadmin policies on other tables to recreate them cleanly
DROP POLICY IF EXISTS "Superadmins can view all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can manage all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can view all recordings" ON recordings;
DROP POLICY IF EXISTS "Superadmins can manage all recordings" ON recordings;
DROP POLICY IF EXISTS "Superadmins can view all daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Superadmins can manage all daily usage" ON daily_usage;

-- Create comprehensive superadmin policies for all tables

-- User subscriptions
CREATE POLICY "Superadmins can view all subscriptions"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (is_superadmin());

CREATE POLICY "Superadmins can manage all subscriptions"
  ON user_subscriptions
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Recordings
CREATE POLICY "Superadmins can view all recordings"
  ON recordings
  FOR SELECT
  TO authenticated
  USING (is_superadmin());

CREATE POLICY "Superadmins can manage all recordings"
  ON recordings
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Daily usage
CREATE POLICY "Superadmins can view all daily usage"
  ON daily_usage
  FOR SELECT
  TO authenticated
  USING (is_superadmin());

CREATE POLICY "Superadmins can manage all daily usage"
  ON daily_usage
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Add superadmin access to profiles table
CREATE POLICY "Superadmins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_superadmin());

CREATE POLICY "Superadmins can manage all profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Verify the setup by checking if everything was created correctly
DO $$
DECLARE
  role_count integer;
  permission_count integer;
  link_count integer;
BEGIN
  -- Check if superadmin role exists
  SELECT COUNT(*) INTO role_count FROM roles WHERE name = 'superadmin';
  IF role_count = 0 THEN
    RAISE NOTICE 'ERROR: Superadmin role was not created';
  ELSE
    RAISE NOTICE 'SUCCESS: Superadmin role exists';
  END IF;
  
  -- Check if permissions exist
  SELECT COUNT(*) INTO permission_count FROM permissions WHERE name LIKE 'manage_%' OR name LIKE 'view_%';
  IF permission_count < 6 THEN
    RAISE NOTICE 'WARNING: Not all permissions were created (found: %)', permission_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All % permissions created', permission_count;
  END IF;
  
  -- Check if role-permission links exist
  SELECT COUNT(*) INTO link_count 
  FROM role_permissions rp 
  JOIN roles r ON rp.role_id = r.id 
  WHERE r.name = 'superadmin';
  
  IF link_count < 6 THEN
    RAISE NOTICE 'WARNING: Not all permissions linked to superadmin (found: %)', link_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All % permissions linked to superadmin', link_count;
  END IF;
END $$;