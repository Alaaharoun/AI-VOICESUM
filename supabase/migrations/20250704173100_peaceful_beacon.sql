/*
  # Fix infinite recursion in user_roles table RLS policy

  ## Problem
  The "Superadmins can manage all user roles" policy on the user_roles table was causing 
  infinite recursion because it was querying the user_roles table from within its own policy.

  ## Solution
  Replace the recursive policy with one that uses the existing is_superadmin() function,
  which is already successfully used in other tables like recordings and user_subscriptions.

  ## Changes
  1. Drop the problematic recursive policy
  2. Create a new simplified policy using is_superadmin() function
*/

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Superadmins can manage all user roles" ON user_roles;

-- Create a new non-recursive policy using the is_superadmin() function
CREATE POLICY "Superadmins can manage all user roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());