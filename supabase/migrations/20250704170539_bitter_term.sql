/*
  # Fix infinite recursion in user_roles RLS policy

  1. Changes
    - Remove the recursive RLS policy on user_roles table that was causing infinite recursion
    - Add a new policy that uses the is_superadmin() function instead of querying user_roles directly
    
  2. Security
    - Maintain the same security level by using the existing is_superadmin() function
    - Ensure superadmins can still manage all user roles
    - Regular users can still view their own roles
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Superadmins can manage all user roles" ON user_roles;

-- Create a new policy that uses the is_superadmin() function to avoid recursion
CREATE POLICY "Superadmins can manage all user roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());