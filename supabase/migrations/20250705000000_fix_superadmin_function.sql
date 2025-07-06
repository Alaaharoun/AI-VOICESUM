-- Fix missing is_superadmin_direct function
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS is_superadmin_direct(uuid);

-- Create the is_superadmin_direct function
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