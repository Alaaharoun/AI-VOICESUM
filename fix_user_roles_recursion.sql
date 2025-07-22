-- Fix Infinite Recursion in user_roles RLS Policy
-- Run this in Supabase SQL Editor

-- First, let's see what policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_roles';

-- Drop all existing policies on user_roles to start fresh
DROP POLICY IF EXISTS "Enable read access for all users" ON user_roles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_roles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON user_roles;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON user_roles;
DROP POLICY IF EXISTS "Allow users to read their own roles" ON user_roles;
DROP POLICY IF EXISTS "Allow superadmins to manage all roles" ON user_roles;

-- Temporarily disable RLS to fix the issue
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS with simple policies
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
CREATE POLICY "Allow authenticated users to read user_roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow users to manage their own roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Test the fix
SELECT * FROM user_roles LIMIT 5; 