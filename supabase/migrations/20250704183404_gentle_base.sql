/*
  # Fix infinite recursion in user_roles RLS policy

  1. Security Policy Fix
    - Drop the problematic "Superadmins can manage all user roles" policy that causes infinite recursion
    - Recreate it using the existing is_superadmin() function to avoid circular dependency
    
  2. Issue Resolution
    - The original policy was querying user_roles table within the policy for user_roles table
    - This created infinite recursion when trying to check permissions
    - Using is_superadmin() function breaks the recursion cycle
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Superadmins can manage all user roles" ON user_roles;

-- Recreate the policy using the is_superadmin() function to avoid recursion
CREATE POLICY "Superadmins can manage all user roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());