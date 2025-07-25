-- =============================================================================
-- Fix String Aggregation Syntax Error
-- =============================================================================
-- This script fixes the syntax error in the get_protection_stats function
-- Run this in Supabase SQL Editor

-- =============================================================================
-- PART 1: Fix the get_protection_stats function
-- =============================================================================

-- Drop the problematic function first
DROP FUNCTION IF EXISTS get_protection_stats();

-- Create the corrected function
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

-- =============================================================================
-- PART 2: Create a better version with proper ordering
-- =============================================================================

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
-- PART 3: Grant Permissions
-- =============================================================================

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_protection_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_detailed_protection_stats() TO authenticated;

-- =============================================================================
-- PART 4: Test the Functions
-- =============================================================================

-- Test the basic function
SELECT 'Testing get_protection_stats()' as test_name;
SELECT * FROM get_protection_stats();

-- Test the detailed function
SELECT 'Testing get_detailed_protection_stats()' as test_name;
SELECT * FROM get_detailed_protection_stats();

-- =============================================================================
-- PART 5: Show Current Status
-- =============================================================================

-- Show current protection status
SELECT 
  'Protection system status' as status,
  COUNT(*) as protected_trial_emails,
  (SELECT COUNT(*) FROM free_minutes_usage) as protected_minutes_emails,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'INSERT') as profiles_insert_policy_count
FROM free_trial_usage; 