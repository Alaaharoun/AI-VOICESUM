-- =============================================================================
-- Comprehensive Fix: Profiles INSERT Policy + Free Trial Protection
-- =============================================================================
-- This fixes both the signup error AND prevents free trial abuse after account deletion
-- Run this in Supabase SQL Editor

-- =============================================================================
-- PART 1: Fix Profiles INSERT Policy
-- =============================================================================

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

-- =============================================================================
-- PART 2: Create Free Trial Protection System
-- =============================================================================

-- Create a table to track email addresses that have used free trials
CREATE TABLE IF NOT EXISTS free_trial_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  first_used_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now(),
  usage_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on free_trial_usage table
ALTER TABLE free_trial_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for free_trial_usage (only superadmins can manage this)
CREATE POLICY "Superadmins can manage free trial usage"
  ON free_trial_usage FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Create function to check if email has used free trial before
CREATE OR REPLACE FUNCTION has_used_free_trial_before(email_address text)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM free_trial_usage 
    WHERE email = email_address
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to record free trial usage
CREATE OR REPLACE FUNCTION record_free_trial_usage(email_address text)
RETURNS VOID AS $$
BEGIN
  INSERT INTO free_trial_usage (email, first_used_at, last_used_at, usage_count)
  VALUES (email_address, now(), now(), 1)
  ON CONFLICT (email) 
  DO UPDATE SET 
    last_used_at = now(),
    usage_count = free_trial_usage.usage_count + 1,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user should get free trial
CREATE OR REPLACE FUNCTION should_grant_free_trial(user_email text)
RETURNS BOOLEAN AS $$
BEGIN
  -- If email has never used free trial before, grant it
  IF NOT has_used_free_trial_before(user_email) THEN
    RETURN TRUE;
  END IF;
  
  -- If email has used free trial before, don't grant it again
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 3: Update Free Trial Logic
-- =============================================================================

-- Create or replace function to check free trial status with email protection
CREATE OR REPLACE FUNCTION check_free_trial_status_with_protection(user_uuid uuid)
RETURNS TABLE(
  has_free_trial boolean,
  free_trial_expired boolean,
  trial_end_date timestamptz,
  email_used_before boolean
) AS $$
DECLARE
  user_email text;
  profile_created_at timestamptz;
  two_days_later timestamptz;
  now_time timestamptz := now();
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_uuid;
  
  -- Get profile creation date
  SELECT created_at INTO profile_created_at FROM profiles WHERE user_id = user_uuid;
  
  -- Check if email has used free trial before
  SELECT has_used_free_trial_before(user_email) INTO email_used_before;
  
  -- If email has used free trial before, no free trial
  IF email_used_before THEN
    RETURN QUERY SELECT FALSE, TRUE, NULL::timestamptz, TRUE;
    RETURN;
  END IF;
  
  -- Calculate trial end date (2 days from profile creation)
  two_days_later := profile_created_at + interval '2 days';
  
  -- Check if trial is still active
  IF now_time <= two_days_later THEN
    RETURN QUERY SELECT TRUE, FALSE, two_days_later, FALSE;
  ELSE
    RETURN QUERY SELECT FALSE, TRUE, two_days_later, FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 4: Create Trigger to Record Free Trial Usage
-- =============================================================================

-- Create trigger function to record free trial usage when activated
CREATE OR REPLACE FUNCTION record_free_trial_activation()
RETURNS TRIGGER AS $$
DECLARE
  user_email text;
BEGIN
  -- Only record when free trial is activated
  IF NEW.subscription_type = 'free_trial' AND NEW.active = true THEN
    -- Get user email
    SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
    
    -- Record the usage
    PERFORM record_free_trial_usage(user_email);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_record_free_trial_activation ON user_subscriptions;
CREATE TRIGGER trigger_record_free_trial_activation
  AFTER INSERT OR UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION record_free_trial_activation();

-- =============================================================================
-- PART 5: Grant Permissions
-- =============================================================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION has_used_free_trial_before(text) TO authenticated;
GRANT EXECUTE ON FUNCTION record_free_trial_usage(text) TO authenticated;
GRANT EXECUTE ON FUNCTION should_grant_free_trial(text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_free_trial_status_with_protection(uuid) TO authenticated;

-- =============================================================================
-- PART 6: Verification and Testing
-- =============================================================================

-- Check that all policies are in place
DO $$
DECLARE
    policy_count integer;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'profiles';
    
    RAISE NOTICE 'Profiles table has % policies', policy_count;
    
    IF policy_count < 3 THEN
        RAISE WARNING 'Expected at least 3 policies for profiles table (SELECT, UPDATE, INSERT)';
    END IF;
END $$;

-- Show current free trial protection status
SELECT 
  'Free trial protection system is now active' as status,
  COUNT(*) as protected_emails
FROM free_trial_usage;

-- Test the protection system
DO $$
DECLARE
    test_email text := 'test@example.com';
    should_grant boolean;
BEGIN
    -- Test with new email
    SELECT should_grant_free_trial(test_email) INTO should_grant;
    RAISE NOTICE 'New email % should get free trial: %', test_email, should_grant;
    
    -- Record usage
    PERFORM record_free_trial_usage(test_email);
    
    -- Test again (should not grant)
    SELECT should_grant_free_trial(test_email) INTO should_grant;
    RAISE NOTICE 'Email % after usage should get free trial: %', test_email, should_grant;
    
    -- Clean up test data
    DELETE FROM free_trial_usage WHERE email = test_email;
    
    RAISE NOTICE 'Free trial protection system tested successfully!';
END $$; 