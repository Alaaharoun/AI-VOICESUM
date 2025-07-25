-- =============================================================================
-- Check and Create Missing Tables - Quick Fix
-- =============================================================================
-- This script checks if tables exist and creates them if missing
-- Run this in Supabase SQL Editor

-- =============================================================================
-- PART 1: Check Current Tables
-- =============================================================================

-- Check which tables exist
SELECT 
  'Current table status:' as status,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'free_trial_usage') as free_trial_usage_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'free_minutes_usage') as free_minutes_usage_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transcription_credits') as transcription_credits_exists;

-- =============================================================================
-- PART 2: Create Missing Tables
-- =============================================================================

-- Create free_trial_usage table if it doesn't exist
CREATE TABLE IF NOT EXISTS free_trial_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  first_used_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now(),
  usage_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create free_minutes_usage table if it doesn't exist
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
-- PART 3: Enable RLS
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE free_trial_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE free_minutes_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcription_credits ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PART 4: Create Basic Functions
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
-- PART 5: Grant Permissions
-- =============================================================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION has_used_free_trial_before(text) TO authenticated;
GRANT EXECUTE ON FUNCTION has_received_free_minutes_before(text) TO authenticated;
GRANT EXECUTE ON FUNCTION record_free_trial_usage(text) TO authenticated;
GRANT EXECUTE ON FUNCTION record_free_minutes_usage(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION should_grant_free_trial(text) TO authenticated;
GRANT EXECUTE ON FUNCTION should_grant_free_minutes(text) TO authenticated;

-- =============================================================================
-- PART 6: Verification
-- =============================================================================

-- Check tables after creation
SELECT 
  'Tables created successfully' as status,
  COUNT(*) as free_trial_usage_count,
  (SELECT COUNT(*) FROM free_minutes_usage) as free_minutes_usage_count,
  (SELECT COUNT(*) FROM transcription_credits) as transcription_credits_count
FROM free_trial_usage;

-- Test basic functions
SELECT 
  'Function test results:' as test_type,
  should_grant_free_trial('test@example.com') as can_get_trial,
  should_grant_free_minutes('test@example.com') as can_get_minutes;

-- Show table structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name IN ('free_trial_usage', 'free_minutes_usage', 'transcription_credits')
ORDER BY table_name, ordinal_position; 