-- Update superadmin emails and fix function issues
-- Replace the old emails with your current email

-- First, let's ensure the function exists with correct signature
DROP FUNCTION IF EXISTS is_superadmin_direct(uuid);

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

-- Update the auto-assign function to use your email
CREATE OR REPLACE FUNCTION auto_assign_superadmin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_emails text[] := ARRAY['iskanour.ra3@gmail.com'];
  user_role_id uuid;
  superadmin_role_id uuid;
BEGIN
  -- Get the superadmin role ID
  SELECT id INTO superadmin_role_id FROM roles WHERE name = 'superadmin';
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Superadmin role not found';
    RETURN NEW;
  END IF;
  
  -- Check if the new user's email is in the target list
  IF NEW.email = ANY(target_emails) THEN
    -- Check if user role already exists
    SELECT id INTO user_role_id 
    FROM user_roles 
    WHERE user_id = NEW.id AND role_id = superadmin_role_id;
    
    IF NOT FOUND THEN
      -- Insert the superadmin role for this user
      INSERT INTO user_roles (user_id, role_id, created_at, updated_at)
      VALUES (NEW.id, superadmin_role_id, NOW(), NOW());
      
      RAISE NOTICE 'Assigned superadmin role to user: %', NEW.email;
    ELSE
      RAISE NOTICE 'User % already has superadmin role', NEW.email;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS auto_assign_superadmin_trigger ON auth.users;
CREATE TRIGGER auto_assign_superadmin_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_superadmin();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION is_superadmin_direct(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_assign_superadmin() TO service_role;

-- Test the function
SELECT 'Function created successfully' as status; 