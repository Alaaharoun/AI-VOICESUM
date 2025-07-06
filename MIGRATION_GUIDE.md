# Superadmin System Fix - Migration Guide

## Overview
This guide will help you apply the superadmin system fix to resolve the infinite recursion issues and ensure proper role management.

## Prerequisites
1. Access to your Supabase project dashboard
2. Service role key (found in Settings > API)
3. Target email addresses for superadmin access:
   - alaa_zekroum@hotmail.com
   - alaa.kotbi@gmail.com

## Step 1: Access Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor

## Step 2: Apply the Main Migration
Copy and paste the following SQL into the SQL Editor and execute:

```sql
/*
  # Complete Superadmin System Fix

  This migration completely fixes the superadmin role system by:
  1. Dropping all problematic functions and recreating them properly
  2. Fixing infinite recursion in RLS policies
  3. Ensuring proper function signatures and return types
  4. Creating a complete, working superadmin system

  Target emails for superadmin access:
  - alaa_zekroum@hotmail.com
  - alaa.kotbi@gmail.com
*/

-- =============================================================================
-- 1. CLEANUP - Drop all problematic functions and policies
-- =============================================================================

-- Drop all existing functions that might cause conflicts
DROP FUNCTION IF EXISTS assign_superadmin_to_emails() CASCADE;
DROP FUNCTION IF EXISTS auto_assign_superadmin_on_signup() CASCADE;
DROP FUNCTION IF EXISTS auto_assign_superadmin() CASCADE;
DROP FUNCTION IF EXISTS is_superadmin() CASCADE;
DROP FUNCTION IF EXISTS is_superadmin_direct(uuid) CASCADE;
DROP FUNCTION IF EXISTS has_permission(text, uuid) CASCADE;

-- Drop all existing policies to start clean
DROP POLICY IF EXISTS "Superadmins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles only" ON user_roles;
DROP POLICY IF EXISTS "Service role can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Allow superadmin full access to roles" ON roles;
DROP POLICY IF EXISTS "Allow superadmin full access to permissions" ON permissions;
DROP POLICY IF EXISTS "Allow superadmin full access to role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON roles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON permissions;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON role_permissions;

-- Drop triggers
DROP TRIGGER IF EXISTS auto_assign_superadmin_trigger ON auth.users;

-- Drop views
DROP VIEW IF EXISTS user_roles_view;

-- =============================================================================
-- 2. DISABLE RLS TEMPORARILY FOR CLEANUP
-- =============================================================================

ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. ENSURE BASIC STRUCTURE EXISTS
-- =============================================================================

-- Ensure superadmin role exists
INSERT INTO roles (name, description) 
VALUES ('superadmin', 'Super Administrator with full system access')
ON CONFLICT (name) DO NOTHING;

-- Ensure comprehensive admin permissions exist
INSERT INTO permissions (name, description, resource, action) VALUES
    ('system.admin', 'Full system administration access', 'system', 'admin'),
    ('users.manage', 'Manage all users', 'users', 'manage'),
    ('users.view', 'View all users', 'users', 'view'),
    ('recordings.manage', 'Manage all recordings', 'recordings', 'manage'),
    ('recordings.view', 'View all recordings', 'recordings', 'view'),
    ('subscriptions.manage', 'Manage all subscriptions', 'subscriptions', 'manage'),
    ('subscriptions.view', 'View all subscriptions', 'subscriptions', 'view'),
    ('profiles.manage', 'Manage all profiles', 'profiles', 'manage'),
    ('profiles.view', 'View all profiles', 'profiles', 'view'),
    ('daily_usage.manage', 'Manage all daily usage', 'daily_usage', 'manage'),
    ('daily_usage.view', 'View all daily usage', 'daily_usage', 'view')
ON CONFLICT (name) DO NOTHING;

-- Link all permissions to superadmin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'superadmin'),
    p.id
FROM permissions p
WHERE p.name IN (
    'system.admin', 'users.manage', 'users.view', 'recordings.manage', 
    'recordings.view', 'subscriptions.manage', 'subscriptions.view',
    'profiles.manage', 'profiles.view', 'daily_usage.manage', 'daily_usage.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================================================
-- 4. CREATE SAFE HELPER FUNCTIONS
-- =============================================================================

-- Create a simple, safe function to check superadmin status
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
        AND r.name = 'superadmin'
    );
$$;

-- Create function to check if a specific user is superadmin
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
        AND r.name = 'superadmin'
    );
$$;

-- Create function to check if user has a specific permission
CREATE OR REPLACE FUNCTION has_permission(permission_name text, user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_uuid AND p.name = permission_name
    );
END;
$$;

-- Create function to assign superadmin role to specific emails
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
$$;

-- Create function to auto-assign superadmin role when target users sign up
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
        SELECT id INTO superadmin_role_id FROM roles WHERE name = 'superadmin';
        
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

-- =============================================================================
-- 5. ASSIGN SUPERADMIN ROLES TO TARGET EMAILS
-- =============================================================================

-- Execute the assignment function for existing users
SELECT * FROM assign_superadmin_to_emails();

-- =============================================================================
-- 6. CREATE TRIGGER FOR AUTO-ASSIGNMENT
-- =============================================================================

-- Create trigger to auto-assign superadmin role
CREATE TRIGGER auto_assign_superadmin_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_superadmin();

-- =============================================================================
-- 7. CREATE VIEW FOR EASY ROLE CHECKING
-- =============================================================================

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

-- =============================================================================
-- 8. CREATE SAFE RLS POLICIES
-- =============================================================================

-- Re-enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Simple policies for roles table
CREATE POLICY "Allow superadmin full access to roles"
    ON roles FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Simple policies for permissions table
CREATE POLICY "Allow superadmin full access to permissions"
    ON permissions FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Simple policies for role_permissions table
CREATE POLICY "Allow superadmin full access to role_permissions"
    ON role_permissions FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Simple policies for user_roles table (non-recursive)
CREATE POLICY "Users can view their own roles"
    ON user_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Superadmins can manage all user_roles"
    ON user_roles FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Service role policies for administrative operations
CREATE POLICY "Service role can manage all user roles"
    ON user_roles FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role can manage all roles"
    ON roles FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role can manage all permissions"
    ON permissions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role can manage all role_permissions"
    ON role_permissions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- 9. CREATE COMPREHENSIVE SUPERADMIN POLICIES FOR ALL TABLES
-- =============================================================================

-- User subscriptions
DROP POLICY IF EXISTS "Superadmins can view all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can manage all subscriptions" ON user_subscriptions;

CREATE POLICY "Superadmins can view all subscriptions"
    ON user_subscriptions FOR SELECT
    TO authenticated
    USING (is_superadmin());

CREATE POLICY "Superadmins can manage all subscriptions"
    ON user_subscriptions FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Recordings
DROP POLICY IF EXISTS "Superadmins can view all recordings" ON recordings;
DROP POLICY IF EXISTS "Superadmins can manage all recordings" ON recordings;

CREATE POLICY "Superadmins can view all recordings"
    ON recordings FOR SELECT
    TO authenticated
    USING (is_superadmin());

CREATE POLICY "Superadmins can manage all recordings"
    ON recordings FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Daily usage
DROP POLICY IF EXISTS "Superadmins can view all daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Superadmins can manage all daily usage" ON daily_usage;

CREATE POLICY "Superadmins can view all daily usage"
    ON daily_usage FOR SELECT
    TO authenticated
    USING (is_superadmin());

CREATE POLICY "Superadmins can manage all daily usage"
    ON daily_usage FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Profiles
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Superadmins can manage all profiles" ON profiles;

CREATE POLICY "Superadmins can view all profiles"
    ON profiles FOR SELECT
    TO authenticated
    USING (is_superadmin());

CREATE POLICY "Superadmins can manage all profiles"
    ON profiles FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- =============================================================================
-- 10. GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT ON user_roles_view TO authenticated;
GRANT EXECUTE ON FUNCTION is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_superadmin_direct(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION has_permission(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_superadmin_to_emails() TO authenticated;

-- =============================================================================
-- 11. VERIFICATION
-- =============================================================================

-- Check the results
DO $$
DECLARE
    superadmin_count integer;
    role_count integer;
    permission_count integer;
    assignment_count integer;
BEGIN
    -- Count superadmin users
    SELECT COUNT(*) INTO superadmin_count
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE r.name = 'superadmin';
    
    -- Count roles
    SELECT COUNT(*) INTO role_count FROM roles;
    
    -- Count permissions
    SELECT COUNT(*) INTO permission_count FROM permissions;
    
    -- Count role-permission assignments for superadmin
    SELECT COUNT(*) INTO assignment_count
    FROM role_permissions rp
    JOIN roles r ON rp.role_id = r.id
    WHERE r.name = 'superadmin';
    
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Superadmin users: %', superadmin_count;
    RAISE NOTICE 'Total roles: %', role_count;
    RAISE NOTICE 'Total permissions: %', permission_count;
    RAISE NOTICE 'Superadmin permissions: %', assignment_count;
    
    IF superadmin_count = 0 THEN
        RAISE WARNING 'No superadmin users found! Check if the target email addresses exist in auth.users';
    END IF;
    
    IF assignment_count < 10 THEN
        RAISE WARNING 'Not all permissions assigned to superadmin role!';
    END IF;
END $$;
```

## Step 3: Apply Daily Usage Function Migration
After the main migration completes successfully, run this additional migration:

```sql
/*
  # Add Daily Usage RPC Function

  This migration adds the get_or_create_daily_usage function that:
  1. Takes a user_uuid parameter
  2. Returns daily usage record for today
  3. Creates a new record if one doesn't exist for today
  4. Ensures data integrity with proper error handling
*/

-- Create the daily usage RPC function
CREATE OR REPLACE FUNCTION get_or_create_daily_usage(user_uuid uuid)
RETURNS TABLE(
    id uuid,
    user_id uuid,
    usage_date date,
    recordings_count integer,
    total_duration integer,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    today_date date := CURRENT_DATE;
    existing_record daily_usage%ROWTYPE;
BEGIN
    -- Check if a record exists for today
    SELECT * INTO existing_record
    FROM daily_usage
    WHERE user_id = user_uuid AND usage_date = today_date;
    
    -- If record exists, return it
    IF existing_record.id IS NOT NULL THEN
        RETURN QUERY SELECT 
            existing_record.id,
            existing_record.user_id,
            existing_record.usage_date,
            existing_record.recordings_count,
            existing_record.total_duration,
            existing_record.created_at,
            existing_record.updated_at
        FROM daily_usage
        WHERE id = existing_record.id;
    ELSE
        -- Create a new record for today
        INSERT INTO daily_usage (user_id, usage_date, recordings_count, total_duration)
        VALUES (user_uuid, today_date, 0, 0)
        RETURNING 
            id, user_id, usage_date, recordings_count, total_duration, created_at, updated_at
        INTO existing_record;
        
        -- Return the newly created record
        RETURN QUERY SELECT 
            existing_record.id,
            existing_record.user_id,
            existing_record.usage_date,
            existing_record.recordings_count,
            existing_record.total_duration,
            existing_record.created_at,
            existing_record.updated_at;
    END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_or_create_daily_usage(uuid) TO authenticated;

-- Create a function to update daily usage when recordings are created
CREATE OR REPLACE FUNCTION update_daily_usage_on_recording()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    today_date date := CURRENT_DATE;
    duration_seconds integer;
BEGIN
    -- Get the duration of the new recording (assuming it's stored in seconds)
    duration_seconds := COALESCE(NEW.duration, 0);
    
    -- Update or create daily usage record
    INSERT INTO daily_usage (user_id, usage_date, recordings_count, total_duration)
    VALUES (NEW.user_id, today_date, 1, duration_seconds)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET
        recordings_count = daily_usage.recordings_count + 1,
        total_duration = daily_usage.total_duration + EXCLUDED.total_duration,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$;

-- Create trigger to automatically update daily usage when recordings are created
DROP TRIGGER IF EXISTS update_daily_usage_trigger ON recordings;
CREATE TRIGGER update_daily_usage_trigger
    AFTER INSERT ON recordings
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_usage_on_recording();

-- Create a function to get daily usage statistics for superadmins
CREATE OR REPLACE FUNCTION get_daily_usage_stats(start_date date DEFAULT CURRENT_DATE - INTERVAL '30 days', end_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(
    usage_date date,
    total_users integer,
    total_recordings integer,
    total_duration integer,
    avg_recordings_per_user numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow superadmins to access this function
    IF NOT is_superadmin() THEN
        RAISE EXCEPTION 'Access denied: Superadmin privileges required';
    END IF;
    
    RETURN QUERY
    SELECT 
        du.usage_date,
        COUNT(DISTINCT du.user_id) as total_users,
        SUM(du.recordings_count) as total_recordings,
        SUM(du.total_duration) as total_duration,
        CASE 
            WHEN COUNT(DISTINCT du.user_id) > 0 
            THEN ROUND(SUM(du.recordings_count)::numeric / COUNT(DISTINCT du.user_id), 2)
            ELSE 0 
        END as avg_recordings_per_user
    FROM daily_usage du
    WHERE du.usage_date BETWEEN start_date AND end_date
    GROUP BY du.usage_date
    ORDER BY du.usage_date DESC;
END;
$$;

-- Grant execute permission to authenticated users (superadmin check is built-in)
GRANT EXECUTE ON FUNCTION get_daily_usage_stats(date, date) TO authenticated;

-- Create RLS policies for daily_usage table if they don't exist
DROP POLICY IF EXISTS "Users can view their own daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Superadmins can view all daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Superadmins can manage all daily usage" ON daily_usage;

CREATE POLICY "Users can view their own daily usage"
    ON daily_usage FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Superadmins can view all daily usage"
    ON daily_usage FOR SELECT
    TO authenticated
    USING (is_superadmin());

CREATE POLICY "Superadmins can manage all daily usage"
    ON daily_usage FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Service role policy for administrative operations
CREATE POLICY "Service role can manage all daily usage"
    ON daily_usage FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Verification
DO $$
DECLARE
    function_count integer;
BEGIN
    -- Check if functions were created successfully
    SELECT COUNT(*) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname IN ('get_or_create_daily_usage', 'update_daily_usage_on_recording', 'get_daily_usage_stats');
    
    RAISE NOTICE 'Daily usage functions created: %', function_count;
    
    IF function_count = 3 THEN
        RAISE NOTICE 'SUCCESS: All daily usage functions created successfully';
    ELSE
        RAISE WARNING 'WARNING: Not all functions were created (expected 3, got %)', function_count;
    END IF;
END $$;
```

## Step 4: Verify the Setup
After running both migrations, verify the setup by running these queries:

### Check Superadmin Users
```sql
SELECT * FROM user_roles_view WHERE role_name = 'superadmin';
```

### Check Functions
```sql
SELECT proname FROM pg_proc WHERE proname IN ('is_superadmin', 'has_permission', 'get_or_create_daily_usage');
```

### Check Policies
```sql
SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename IN ('user_roles', 'roles', 'permissions');
```

## Troubleshooting

### If you get function signature errors:
The migration includes `DROP FUNCTION IF EXISTS ... CASCADE` statements to handle this. If you still get errors, run this first:

```sql
-- Drop all functions with CASCADE
DROP FUNCTION IF EXISTS assign_superadmin_to_emails() CASCADE;
DROP FUNCTION IF EXISTS auto_assign_superadmin_on_signup() CASCADE;
DROP FUNCTION IF EXISTS auto_assign_superadmin() CASCADE;
DROP FUNCTION IF EXISTS is_superadmin() CASCADE;
DROP FUNCTION IF EXISTS is_superadmin_direct(uuid) CASCADE;
DROP FUNCTION IF EXISTS has_permission(text, uuid) CASCADE;
```

### If RLS policies cause issues:
The migration disables RLS temporarily during the process. If you encounter RLS-related errors, ensure the migration completes fully before checking policies.

### If target users don't exist:
The migration will show warnings for users that don't exist yet. They will be automatically assigned the superadmin role when they sign up.

## Expected Results
After successful migration:
- ✅ Superadmin role exists with all permissions
- ✅ Target email addresses have superadmin access
- ✅ No infinite recursion in RLS policies
- ✅ All helper functions work correctly
- ✅ Daily usage tracking functions available
- ✅ Auto-assignment trigger for future signups

## Security Notes
- The `is_superadmin()` function is SECURITY DEFINER to avoid recursion
- All functions use proper search_path settings
- Service role policies allow administrative operations
- RLS policies are non-recursive and secure 