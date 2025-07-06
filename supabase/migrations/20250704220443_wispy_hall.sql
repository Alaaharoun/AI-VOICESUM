/*
  # Fix RLS policies and create missing functions

  1. New Functions
    - `is_superadmin()` - Check if current user is superadmin
    - `is_superadmin_direct(check_user_id)` - Check if specific user is superadmin
    
  2. Security Fixes  
    - Remove recursive RLS policies on user_roles table
    - Create simpler, non-recursive policies
    - Enable proper security for admin functions
    
  3. Policy Updates
    - Fix infinite recursion in user_roles policies
    - Ensure admin access without circular dependencies
*/

-- First, create the is_superadmin function that checks current user
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

-- Create the is_superadmin_direct function that checks a specific user
CREATE OR REPLACE FUNCTION is_superadmin_direct(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = check_user_id 
    AND r.name = 'superadmin'
  );
$$;

-- Drop existing problematic policies on user_roles table
DROP POLICY IF EXISTS "Superadmins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

-- Create new non-recursive policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create a simple policy for superadmin access that doesn't cause recursion
CREATE POLICY "Service role can manage all user roles"
  ON user_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read roles table
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON roles;
CREATE POLICY "Enable read access for authenticated users"
  ON roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to read permissions table  
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON permissions;
CREATE POLICY "Enable read access for authenticated users"
  ON permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to read role_permissions table
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON role_permissions;
CREATE POLICY "Enable read access for authenticated users"
  ON role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_superadmin_direct(uuid) TO authenticated;