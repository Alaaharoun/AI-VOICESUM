-- =============================================================================
-- Fix Duplicate Policies - Quick Fix
-- =============================================================================
-- This script removes duplicate policies and recreates them cleanly
-- Run this in Supabase SQL Editor

-- =============================================================================
-- PART 1: Drop All Existing Policies
-- =============================================================================

-- Drop policies for free_trial_usage
DROP POLICY IF EXISTS "Superadmins can manage free trial usage" ON free_trial_usage;

-- Drop policies for free_minutes_usage
DROP POLICY IF EXISTS "Superadmins can manage free minutes usage" ON free_minutes_usage;

-- Drop policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Drop policies for transcription_credits
DROP POLICY IF EXISTS "Users can view own credits" ON transcription_credits;
DROP POLICY IF EXISTS "Users can update own credits" ON transcription_credits;
DROP POLICY IF EXISTS "Admins can view all credits" ON transcription_credits;

-- =============================================================================
-- PART 2: Recreate All Policies Cleanly
-- =============================================================================

-- Create policies for free_trial_usage table
CREATE POLICY "Superadmins can manage free trial usage"
  ON free_trial_usage FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Create policies for free_minutes_usage table
CREATE POLICY "Superadmins can manage free minutes usage"
  ON free_minutes_usage FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Create policies for profiles table
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create policies for transcription_credits table
CREATE POLICY "Users can view own credits"
  ON transcription_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own credits"
  ON transcription_credits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all credits"
  ON transcription_credits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- =============================================================================
-- PART 3: Verification
-- =============================================================================

-- Show current status
SELECT 
  'Policies fixed successfully' as status,
  COUNT(*) as protected_trial_emails,
  (SELECT COUNT(*) FROM free_minutes_usage) as protected_minutes_emails,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'INSERT') as profiles_insert_policy_count,
  (SELECT COUNT(*) FROM transcription_credits) as total_transcription_credits
FROM free_trial_usage;

-- Show all policies for verification
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('free_trial_usage', 'free_minutes_usage', 'profiles', 'transcription_credits')
ORDER BY tablename, policyname; 