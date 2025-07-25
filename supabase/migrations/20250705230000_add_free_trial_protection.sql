-- =============================================================================
-- Add Free Trial Protection System
-- =============================================================================
-- This migration prevents users from reusing free trials after account deletion
-- by tracking email addresses that have used free trials

-- =============================================================================
-- PART 1: Create Free Trial Usage Tracking Table
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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_free_trial_usage_email ON free_trial_usage(email);
CREATE INDEX IF NOT EXISTS idx_free_trial_usage_created_at ON free_trial_usage(created_at);

-- Enable RLS on free_trial_usage table
ALTER TABLE free_trial_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for free_trial_usage (only superadmins can manage this)
CREATE POLICY "Superadmins can manage free trial usage"
  ON free_trial_usage FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- =============================================================================
-- PART 2: Create Protection Functions
-- =============================================================================

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
-- PART 3: Enhanced Free Trial Status Check
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
-- PART 4: Automatic Usage Recording
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
-- PART 6: Admin Functions for Monitoring
-- =============================================================================

-- Function to get free trial usage statistics
CREATE OR REPLACE FUNCTION get_free_trial_stats()
RETURNS TABLE(
  total_emails bigint,
  total_usage_count bigint,
  average_usage_per_email numeric,
  emails_this_month bigint,
  most_used_emails text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_emails,
    COALESCE(SUM(usage_count), 0) as total_usage_count,
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND(SUM(usage_count)::numeric / COUNT(*), 2)
      ELSE 0 
    END as average_usage_per_email,
    COUNT(CASE WHEN created_at >= date_trunc('month', now()) THEN 1 END) as emails_this_month,
    string_agg(email || ' (' || usage_count || 'x)', ', ' ORDER BY usage_count DESC LIMIT 5) as most_used_emails
  FROM free_trial_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission for admin function
GRANT EXECUTE ON FUNCTION get_free_trial_stats() TO authenticated;

-- =============================================================================
-- PART 7: Verification and Testing
-- =============================================================================

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

-- Show initial statistics
SELECT 
  'Free trial protection system activated' as status,
  COUNT(*) as protected_emails
FROM free_trial_usage; 