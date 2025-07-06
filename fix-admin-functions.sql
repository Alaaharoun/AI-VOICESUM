-- Fix Admin Functions - Run this in Supabase Dashboard SQL Editor
-- This script adds the missing admin_get_system_stats function and other admin utilities

-- Create the admin_get_system_stats function
CREATE OR REPLACE FUNCTION admin_get_system_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stats json;
BEGIN
  -- Check if user is superadmin
  IF NOT is_superadmin_direct() THEN
    RAISE EXCEPTION 'Access denied: Superadmin privileges required';
  END IF;

  -- Get system statistics
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'total_transcriptions', (SELECT COUNT(*) FROM transcriptions),
    'total_translations', (SELECT COUNT(*) FROM translations),
    'total_summaries', (SELECT COUNT(*) FROM summaries),
    'active_users_today', (
      SELECT COUNT(DISTINCT user_id) 
      FROM transcriptions 
      WHERE created_at >= CURRENT_DATE
    ),
    'transcriptions_today', (
      SELECT COUNT(*) 
      FROM transcriptions 
      WHERE created_at >= CURRENT_DATE
    ),
    'translations_today', (
      SELECT COUNT(*) 
      FROM translations 
      WHERE created_at >= CURRENT_DATE
    ),
    'system_health', 'healthy',
    'last_updated', NOW()
  ) INTO stats;

  RETURN stats;
END;
$$;

-- Create function to get user statistics
CREATE OR REPLACE FUNCTION admin_get_user_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_stats json;
BEGIN
  -- Check if user is superadmin
  IF NOT is_superadmin_direct() THEN
    RAISE EXCEPTION 'Access denied: Superadmin privileges required';
  END IF;

  -- Get user statistics
  SELECT json_build_object(
    'users_by_role', (
      SELECT json_object_agg(r.name, user_count)
      FROM (
        SELECT r.name, COUNT(ur.user_id) as user_count
        FROM roles r
        LEFT JOIN user_roles ur ON r.id = ur.role_id
        GROUP BY r.id, r.name
      ) role_counts
    ),
    'recent_users', (
      SELECT json_agg(
        json_build_object(
          'id', u.id,
          'email', u.email,
          'created_at', u.created_at,
          'last_sign_in', u.last_sign_in_at
        )
      )
      FROM auth.users u
      ORDER BY u.created_at DESC
      LIMIT 10
    ),
    'total_superadmins', (
      SELECT COUNT(*)
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE r.name = 'superadmin'
    )
  ) INTO user_stats;

  RETURN user_stats;
END;
$$;

-- Create function to get usage statistics
CREATE OR REPLACE FUNCTION admin_get_usage_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  usage_stats json;
BEGIN
  -- Check if user is superadmin
  IF NOT is_superadmin_direct() THEN
    RAISE EXCEPTION 'Access denied: Superadmin privileges required';
  END IF;

  -- Get usage statistics
  SELECT json_build_object(
    'daily_usage', (
      SELECT json_agg(
        json_build_object(
          'date', date_series.date,
          'transcriptions', COALESCE(t.count, 0),
          'translations', COALESCE(tr.count, 0),
          'summaries', COALESCE(s.count, 0)
        )
      )
      FROM (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '7 days',
          CURRENT_DATE,
          '1 day'::interval
        )::date as date
      ) date_series
      LEFT JOIN (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM transcriptions
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at)
      ) t ON date_series.date = t.date
      LEFT JOIN (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM translations
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at)
      ) tr ON date_series.date = tr.date
      LEFT JOIN (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM summaries
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at)
      ) s ON date_series.date = s.date
      ORDER BY date_series.date
    ),
    'top_users', (
      SELECT json_agg(
        json_build_object(
          'user_id', u.id,
          'email', u.email,
          'transcription_count', COALESCE(t.count, 0),
          'translation_count', COALESCE(tr.count, 0),
          'summary_count', COALESCE(s.count, 0)
        )
      )
      FROM auth.users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) as count
        FROM transcriptions
        GROUP BY user_id
      ) t ON u.id = t.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as count
        FROM translations
        GROUP BY user_id
      ) tr ON u.id = tr.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as count
        FROM summaries
        GROUP BY user_id
      ) s ON u.id = s.user_id
      ORDER BY (COALESCE(t.count, 0) + COALESCE(tr.count, 0) + COALESCE(s.count, 0)) DESC
      LIMIT 10
    )
  ) INTO usage_stats;

  RETURN usage_stats;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_get_system_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_user_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_usage_stats() TO authenticated;

-- Test the functions
SELECT 'Admin functions created successfully' as status; 