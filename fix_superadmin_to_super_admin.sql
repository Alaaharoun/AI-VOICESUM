-- Fix Superadmin to Super_Admin Role Name Mismatch
-- This script updates all references from 'superadmin' to 'super_admin' to match the actual role name

-- 1. Update the is_superadmin function to look for 'super_admin'
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

-- 2. Update the is_superadmin_direct function
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

-- 3. Update the assign_superadmin_to_emails function
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
    SELECT id INTO superadmin_role_id FROM roles WHERE name = 'super_admin';
    
    IF superadmin_role_id IS NULL THEN
        RETURN QUERY SELECT ''::text, 'ERROR'::text, 'Super_admin role not found'::text;
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
            
            RETURN QUERY SELECT email_addr, 'SUCCESS'::text, 'Assigned super_admin role'::text;
        ELSE
            RETURN QUERY SELECT email_addr, 'WARNING'::text, 'User not found - will be assigned when they sign up'::text;
        END IF;
    END LOOP;
END;
$$;

-- 4. Update the auto_assign_superadmin function
CREATE OR REPLACE FUNCTION auto_assign_superadmin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    superadmin_role_id uuid;
BEGIN
    -- Check if this is one of our target superadmin emails
    IF NEW.email IN ('alaa_zekroum@hotmail.com', 'alaa.kotbi@gmail.com') THEN
        -- Get superadmin role ID
        SELECT id INTO superadmin_role_id FROM roles WHERE name = 'super_admin';
        
        IF superadmin_role_id IS NOT NULL THEN
            -- Assign superadmin role
            INSERT INTO user_roles (user_id, role_id, created_by)
            VALUES (NEW.id, superadmin_role_id, NEW.id)
            ON CONFLICT (user_id, role_id) DO NOTHING;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_superadmin_direct(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_superadmin_to_emails() TO authenticated;

-- 6. Test the function
SELECT 'Testing is_superadmin function...' as test_message;
SELECT is_superadmin() as current_user_is_superadmin;

-- 7. Assign super_admin role to target emails
SELECT 'Assigning super_admin roles...' as assignment_message;
SELECT * FROM assign_superadmin_to_emails(); 