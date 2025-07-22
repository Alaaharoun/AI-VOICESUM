-- Final Fix for user_roles RLS Policy (Updated)
-- Run this in Supabase SQL Editor

-- First, let's see what policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_roles';

-- Drop ALL existing policies on user_roles to start completely fresh
DROP POLICY IF EXISTS "Enable read access for all users" ON user_roles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_roles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON user_roles;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON user_roles;
DROP POLICY IF EXISTS "Allow users to read their own roles" ON user_roles;
DROP POLICY IF EXISTS "Allow superadmins to manage all roles" ON user_roles;
DROP POLICY IF EXISTS "Allow authenticated users to read user_roles" ON user_roles;
DROP POLICY IF EXISTS "Allow users to manage their own roles" ON user_roles;

-- Temporarily disable RLS to fix the issue
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS with simple policies
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies with unique names
CREATE POLICY "user_roles_read_policy"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "user_roles_manage_policy"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Test the fix
SELECT 'user_roles' as table_name, COUNT(*) as count FROM user_roles
UNION ALL
SELECT 'app_settings' as table_name, COUNT(*) as count FROM app_settings;

-- Show the final policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_roles'; 