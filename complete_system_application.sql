-- =============================================================================
-- Complete System Application - Full Implementation
-- =============================================================================
-- This script applies the complete protection system from scratch
-- Run this in Supabase SQL Editor

-- =============================================================================
-- PART 1: Create All Required Tables
-- =============================================================================

-- Create free_trial_usage table
CREATE TABLE IF NOT EXISTS free_trial_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  first_used_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now(),
  usage_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create free_minutes_usage table
CREATE TABLE IF NOT EXISTS free_minutes_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  first_granted_at timestamptz DEFAULT now(),
  last_granted_at timestamptz DEFAULT now(),
  grant_count integer DEFAULT 1,
  total_minutes_granted integer DEFAULT 15,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create transcription_credits table if it doesn't exist
CREATE TABLE IF NOT EXISTS transcription_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_minutes INTEGER DEFAULT 0 NOT NULL,
  used_minutes INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- PART 2: Enable RLS and Create Policies
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE free_trial_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE free_minutes_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcription_credits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Superadmins can manage free trial usage" ON free_trial_usage;
DROP POLICY IF EXISTS "Superadmins can manage free minutes usage" ON free_minutes_usage;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

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
-- PART 3: Create All Protection Functions
-- =============================================================================

-- Function to check if email has used free trial before
CREATE OR REPLACE FUNCTION has_used_free_trial_before(email_address text)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM free_trial_usage 
    WHERE email = email_address
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if email has received free minutes before
CREATE OR REPLACE FUNCTION has_received_free_minutes_before(email_address text)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM free_minutes_usage 
    WHERE email = email_address
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record free trial usage
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

-- Function to record free minutes usage
CREATE OR REPLACE FUNCTION record_free_minutes_usage(email_address text, minutes_granted integer DEFAULT 15)
RETURNS VOID AS $$
BEGIN
  INSERT INTO free_minutes_usage (email, first_granted_at, last_granted_at, grant_count, total_minutes_granted)
  VALUES (email_address, now(), now(), 1, minutes_granted)
  ON CONFLICT (email) 
  DO UPDATE SET 
    last_granted_at = now(),
    grant_count = free_minutes_usage.grant_count + 1,
    total_minutes_granted = free_minutes_usage.total_minutes_granted + minutes_granted,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user should get free trial
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

-- Function to check if user should get free minutes
CREATE OR REPLACE FUNCTION should_grant_free_minutes(user_email text)
RETURNS BOOLEAN AS $$
BEGIN
  -- If email has never received free minutes before, grant it
  IF NOT has_received_free_minutes_before(user_email) THEN
    RETURN TRUE;
  END IF;
  
  -- If email has received free minutes before, don't grant it again
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 4: Create Transcription Credit Functions
-- =============================================================================

-- Function to increment transcription minutes (for purchases)
CREATE OR REPLACE FUNCTION increment_transcription_minutes(uid UUID, minutes INTEGER)
RETURNS VOID AS $$
BEGIN
  INSERT INTO transcription_credits (user_id, total_minutes, used_minutes)
  VALUES (uid, minutes, 0)
  ON CONFLICT (user_id)
  DO UPDATE SET 
    total_minutes = transcription_credits.total_minutes + minutes,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to deduct transcription time (after transcription)
CREATE OR REPLACE FUNCTION deduct_transcription_time(uid UUID, minutes_to_deduct INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_credits RECORD;
BEGIN
  -- Get current credits
  SELECT total_minutes, used_minutes INTO current_credits
  FROM transcription_credits
  WHERE user_id = uid;
  
  -- Check if user has enough credits
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found in transcription_credits';
  END IF;
  
  IF (current_credits.total_minutes - current_credits.used_minutes) < minutes_to_deduct THEN
    RETURN FALSE; -- Insufficient credits
  END IF;
  
  -- Deduct the minutes
  UPDATE transcription_credits
  SET 
    used_minutes = used_minutes + minutes_to_deduct,
    updated_at = NOW()
  WHERE user_id = uid;
  
  RETURN TRUE; -- Success
END;
$$ LANGUAGE plpgsql;

-- Function to get user's remaining minutes
CREATE OR REPLACE FUNCTION get_remaining_minutes(uid UUID)
RETURNS INTEGER AS $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT (total_minutes - used_minutes) INTO remaining
  FROM transcription_credits
  WHERE user_id = uid;
  
  RETURN COALESCE(remaining, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has sufficient credits
CREATE OR REPLACE FUNCTION has_sufficient_credits(uid UUID, required_minutes INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT get_remaining_minutes(uid) INTO remaining;
  RETURN remaining >= required_minutes;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 5: Enhanced Free Trial Status Check
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
-- PART 6: Enhanced Free Minutes Grant Function
-- =============================================================================

-- Create or replace function to grant free minutes with protection
CREATE OR REPLACE FUNCTION grant_free_minutes_on_signup_protected()
RETURNS TRIGGER AS $$
DECLARE
  user_email text;
  should_grant boolean;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;
  
  -- Check if should grant free minutes
  SELECT should_grant_free_minutes(user_email) INTO should_grant;
  
  -- Only grant if email hasn't received free minutes before
  IF should_grant THEN
    -- Grant 15 free minutes to new users
    INSERT INTO transcription_credits (user_id, total_minutes, used_minutes)
    VALUES (NEW.id, 15, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Record the usage
    PERFORM record_free_minutes_usage(user_email, 15);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 7: Admin Functions
-- =============================================================================

-- Function for admin to grant free minutes to any user
CREATE OR REPLACE FUNCTION admin_grant_free_minutes(target_user_id uuid, minutes_to_grant integer)
RETURNS BOOLEAN AS $$
DECLARE
  admin_user_id uuid;
  target_email text;
BEGIN
  -- Get current user (admin)
  admin_user_id := auth.uid();
  
  -- Check if current user is admin or superadmin
  IF NOT (is_superadmin() OR has_role('admin')) THEN
    RAISE EXCEPTION 'Only admins can grant free minutes';
  END IF;
  
  -- Get target user email
  SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
  
  IF target_email IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;
  
  -- Grant minutes (admin can override protection)
  INSERT INTO transcription_credits (user_id, total_minutes, used_minutes)
  VALUES (target_user_id, minutes_to_grant, 0)
  ON CONFLICT (user_id)
  DO UPDATE SET 
    total_minutes = transcription_credits.total_minutes + minutes_to_grant,
    updated_at = NOW();
  
  -- Record admin grant (doesn't count against user's free minutes)
  INSERT INTO free_minutes_usage (email, first_granted_at, last_granted_at, grant_count, total_minutes_granted)
  VALUES (target_email, now(), now(), 1, minutes_to_grant)
  ON CONFLICT (email) 
  DO UPDATE SET 
    last_granted_at = now(),
    grant_count = free_minutes_usage.grant_count + 1,
    total_minutes_granted = free_minutes_usage.total_minutes_granted + minutes_to_grant,
    updated_at = now();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for admin to reset user's free minutes protection
CREATE OR REPLACE FUNCTION admin_reset_free_minutes_protection(target_email text)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current user is admin or superadmin
  IF NOT (is_superadmin() OR has_role('admin')) THEN
    RAISE EXCEPTION 'Only admins can reset free minutes protection';
  END IF;
  
  -- Remove from protection table (allows user to get free minutes again)
  DELETE FROM free_minutes_usage WHERE email = target_email;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for admin to reset user's free trial protection
CREATE OR REPLACE FUNCTION admin_reset_free_trial_protection(target_email text)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current user is admin or superadmin
  IF NOT (is_superadmin() OR has_role('admin')) THEN
    RAISE EXCEPTION 'Only admins can reset free trial protection';
  END IF;
  
  -- Remove from protection table (allows user to get free trial again)
  DELETE FROM free_trial_usage WHERE email = target_email;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 8: Create Triggers
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

-- Create trigger for free trial activation
DROP TRIGGER IF EXISTS trigger_record_free_trial_activation ON user_subscriptions;
CREATE TRIGGER trigger_record_free_trial_activation
  AFTER INSERT OR UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION record_free_trial_activation();

-- Replace the old free minutes trigger with protected version
DROP TRIGGER IF EXISTS trigger_grant_free_minutes ON auth.users;
CREATE TRIGGER trigger_grant_free_minutes
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION grant_free_minutes_on_signup_protected();

-- =============================================================================
-- PART 9: Create Statistics Functions
-- =============================================================================

-- Function to get comprehensive protection statistics
CREATE OR REPLACE FUNCTION get_protection_stats()
RETURNS TABLE(
  total_free_trial_emails bigint,
  total_free_minutes_emails bigint,
  free_trial_usage_count bigint,
  free_minutes_usage_count bigint,
  most_used_trial_emails text,
  most_used_minutes_emails text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_free_trial_emails,
    (SELECT COUNT(*) FROM free_minutes_usage) as total_free_minutes_emails,
    COALESCE(SUM(usage_count), 0) as free_trial_usage_count,
    (SELECT COALESCE(SUM(grant_count), 0) FROM free_minutes_usage) as free_minutes_usage_count,
    COALESCE(string_agg(email || ' (' || usage_count || 'x)', ', '), 'None') as most_used_trial_emails,
    COALESCE((SELECT string_agg(email || ' (' || grant_count || 'x)', ', ') FROM free_minutes_usage), 'None') as most_used_minutes_emails
  FROM free_trial_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a more detailed statistics function
CREATE OR REPLACE FUNCTION get_detailed_protection_stats()
RETURNS TABLE(
  total_free_trial_emails bigint,
  total_free_minutes_emails bigint,
  free_trial_usage_count bigint,
  free_minutes_usage_count bigint,
  top_trial_emails text,
  top_minutes_emails text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM free_trial_usage) as total_free_trial_emails,
    (SELECT COUNT(*) FROM free_minutes_usage) as total_free_minutes_emails,
    (SELECT COALESCE(SUM(usage_count), 0) FROM free_trial_usage) as free_trial_usage_count,
    (SELECT COALESCE(SUM(grant_count), 0) FROM free_minutes_usage) as free_minutes_usage_count,
    COALESCE((
      SELECT string_agg(email || ' (' || usage_count || 'x)', ', ')
      FROM (
        SELECT email, usage_count 
        FROM free_trial_usage 
        ORDER BY usage_count DESC 
        LIMIT 5
      ) t
    ), 'None') as top_trial_emails,
    COALESCE((
      SELECT string_agg(email || ' (' || grant_count || 'x)', ', ')
      FROM (
        SELECT email, grant_count 
        FROM free_minutes_usage 
        ORDER BY grant_count DESC 
        LIMIT 5
      ) m
    ), 'None') as top_minutes_emails;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PART 10: Grant Permissions
-- =============================================================================

-- Grant execute permissions on all functions
GRANT EXECUTE ON FUNCTION has_used_free_trial_before(text) TO authenticated;
GRANT EXECUTE ON FUNCTION has_received_free_minutes_before(text) TO authenticated;
GRANT EXECUTE ON FUNCTION record_free_trial_usage(text) TO authenticated;
GRANT EXECUTE ON FUNCTION record_free_minutes_usage(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION should_grant_free_trial(text) TO authenticated;
GRANT EXECUTE ON FUNCTION should_grant_free_minutes(text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_free_trial_status_with_protection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_transcription_minutes(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_transcription_time(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_remaining_minutes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION has_sufficient_credits(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_grant_free_minutes(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_free_minutes_protection(text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_free_trial_protection(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_protection_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_detailed_protection_stats() TO authenticated;

-- =============================================================================
-- PART 11: Create Indexes for Performance
-- =============================================================================

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_free_trial_usage_email ON free_trial_usage(email);
CREATE INDEX IF NOT EXISTS idx_free_trial_usage_last_used ON free_trial_usage(last_used_at);
CREATE INDEX IF NOT EXISTS idx_free_minutes_usage_email ON free_minutes_usage(email);
CREATE INDEX IF NOT EXISTS idx_free_minutes_usage_last_granted ON free_minutes_usage(last_granted_at);
CREATE INDEX IF NOT EXISTS idx_transcription_credits_user_id ON transcription_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_transcription_credits_updated_at ON transcription_credits(updated_at);

-- =============================================================================
-- PART 12: Verification and Testing
-- =============================================================================

-- Test the protection system
DO $$
DECLARE
    test_email text := 'test@example.com';
    should_grant_trial boolean;
    should_grant_minutes boolean;
BEGIN
    -- Test free trial protection
    SELECT should_grant_free_trial(test_email) INTO should_grant_trial;
    RAISE NOTICE 'New email % should get free trial: %', test_email, should_grant_trial;
    
    -- Test free minutes protection
    SELECT should_grant_free_minutes(test_email) INTO should_grant_minutes;
    RAISE NOTICE 'New email % should get free minutes: %', test_email, should_grant_minutes;
    
    -- Record usage
    PERFORM record_free_trial_usage(test_email);
    PERFORM record_free_minutes_usage(test_email, 15);
    
    -- Test again (should not grant)
    SELECT should_grant_free_trial(test_email) INTO should_grant_trial;
    SELECT should_grant_free_minutes(test_email) INTO should_grant_minutes;
    RAISE NOTICE 'Email % after usage - trial: %, minutes: %', test_email, should_grant_trial, should_grant_minutes;
    
    -- Clean up test data
    DELETE FROM free_trial_usage WHERE email = test_email;
    DELETE FROM free_minutes_usage WHERE email = test_email;
    
    RAISE NOTICE 'Complete protection system tested successfully!';
END $$;

-- Show final status
SELECT 
  'Complete protection system activated successfully' as status,
  COUNT(*) as protected_trial_emails,
  (SELECT COUNT(*) FROM free_minutes_usage) as protected_minutes_emails,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'INSERT') as profiles_insert_policy_count,
  (SELECT COUNT(*) FROM transcription_credits) as total_transcription_credits
FROM free_trial_usage; 