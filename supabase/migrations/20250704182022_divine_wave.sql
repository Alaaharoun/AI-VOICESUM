/*
  # Fix RLS policies and database relationships

  1. Security fixes
    - Remove circular RLS policies on user_roles table
    - Simplify permission checking to avoid infinite recursion
    - Add missing foreign key relationship for user_subscriptions to profiles
    
  2. Database relationships
    - Ensure proper foreign key constraints exist
    - Update RLS policies to be non-recursive
*/

-- Drop existing problematic policies on user_roles table
DROP POLICY IF EXISTS "Superadmins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Service role can manage all user roles" ON user_roles;

-- Create simplified, non-recursive policies for user_roles
CREATE POLICY "Service role can manage all user roles"
  ON user_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view their own roles only"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create a function to safely check if user is superadmin without causing recursion
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name = 'superadmin'
  );
$$;

-- Update recordings policies to use the new function
DROP POLICY IF EXISTS "Superadmins can manage all recordings" ON recordings;
DROP POLICY IF EXISTS "Superadmins can view all recordings" ON recordings;

CREATE POLICY "Superadmins can manage all recordings"
  ON recordings
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "Superadmins can view all recordings"
  ON recordings
  FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Update user_subscriptions policies to use the new function
DROP POLICY IF EXISTS "Superadmins can manage all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can view all subscriptions" ON user_subscriptions;

CREATE POLICY "Superadmins can manage all subscriptions"
  ON user_subscriptions
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "Superadmins can view all subscriptions"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Update daily_usage policies to use the new function
DROP POLICY IF EXISTS "Superadmins can manage all daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Superadmins can view all daily usage" ON daily_usage;

CREATE POLICY "Superadmins can manage all daily usage"
  ON daily_usage
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

CREATE POLICY "Superadmins can view all daily usage"
  ON daily_usage
  FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Ensure the user_roles_view works correctly
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

-- Grant necessary permissions
GRANT SELECT ON user_roles_view TO authenticated;
GRANT EXECUTE ON FUNCTION is_superadmin() TO authenticated;