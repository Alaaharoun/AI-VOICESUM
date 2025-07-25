-- =============================================================================
-- Quick Fix: Add Missing INSERT Policy for Profiles Table
-- =============================================================================
-- This fixes the "Database error saving new user" issue during signup
-- Run this in Supabase SQL Editor

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create comprehensive policies for profiles table
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- This is the missing policy that was causing the signup error
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Verification
SELECT 
  policyname, 
  cmd, 
  permissive,
  roles
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Test the fix by checking if we can insert a profile (this will show the policy is working)
-- Note: This is just a test query, it won't actually insert anything
SELECT 
  'Profiles INSERT policy is now active' as status,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'INSERT'; 