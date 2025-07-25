-- Apply Super_Admin Fix
-- This script updates the is_superadmin function to work with the existing 'super_admin' role

-- Update the is_superadmin function to look for 'super_admin'
CREATE OR REPLACE FUNCTION is_superadmin()
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
        WHERE ur.user_id = auth.uid() 
        AND r.name = 'super_admin'
    );
$$;

-- Update the is_superadmin_direct function
CREATE OR REPLACE FUNCTION is_superadmin_direct(check_user_id uuid)
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
        WHERE ur.user_id = check_user_id 
        AND r.name = 'super_admin'
    );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_superadmin_direct(uuid) TO authenticated;

-- Test the function
SELECT 'Testing is_superadmin function...' as test_message;
SELECT is_superadmin() as current_user_is_superadmin;

-- Show current user roles
SELECT 'Current user roles:' as info;
SELECT ur.user_id, r.name as role_name, p.email
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
JOIN profiles p ON ur.user_id = p.id
WHERE r.name = 'super_admin'; 