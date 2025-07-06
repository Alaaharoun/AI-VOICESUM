/*
  # Add Daily Usage RPC Function

  This migration adds the get_or_create_daily_usage function that:
  1. Takes a user_uuid parameter
  2. Returns daily usage record for today
  3. Creates a new record if one doesn't exist for today
  4. Ensures data integrity with proper error handling
*/

-- Create the daily usage RPC function
CREATE OR REPLACE FUNCTION get_or_create_daily_usage(target_user_id uuid)
RETURNS TABLE(
    id uuid,
    user_id uuid,
    usage_date date,
    seconds_used integer,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    today_date date := CURRENT_DATE;
    existing_record daily_usage%ROWTYPE;
BEGIN
    -- Check if a record exists for today
    SELECT * INTO existing_record
    FROM daily_usage
    WHERE user_id = target_user_id AND usage_date = today_date;
    
    -- If record exists, return it
    IF existing_record.id IS NOT NULL THEN
        RETURN QUERY SELECT 
            existing_record.id,
            existing_record.user_id,
            existing_record.usage_date,
            existing_record.seconds_used,
            existing_record.created_at,
            existing_record.updated_at
        FROM daily_usage
        WHERE id = existing_record.id;
    ELSE
        -- Create a new record for today
        INSERT INTO daily_usage (user_id, usage_date, seconds_used)
        VALUES (target_user_id, today_date, 0)
        RETURNING 
            id, user_id, usage_date, seconds_used, created_at, updated_at
        INTO existing_record.id, existing_record.user_id, existing_record.usage_date, existing_record.seconds_used, existing_record.created_at, existing_record.updated_at;
        
        -- Return the newly created record
        RETURN QUERY SELECT 
            existing_record.id,
            existing_record.user_id,
            existing_record.usage_date,
            existing_record.seconds_used,
            existing_record.created_at,
            existing_record.updated_at;
    END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_or_create_daily_usage(uuid) TO authenticated;

-- Create a function to update daily usage when recordings are created
CREATE OR REPLACE FUNCTION update_daily_usage_on_recording()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    today_date date := CURRENT_DATE;
    duration_seconds integer;
BEGIN
    -- Get the duration of the new recording (assuming it's stored in seconds)
    duration_seconds := COALESCE(NEW.duration, 0);
    
    -- Update or create daily usage record
    INSERT INTO daily_usage (user_id, usage_date, seconds_used)
    VALUES (NEW.user_id, today_date, duration_seconds)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET
        seconds_used = daily_usage.seconds_used + EXCLUDED.seconds_used;
    
    RETURN NEW;
END;
$$;

-- Create trigger to automatically update daily usage when recordings are created
DROP TRIGGER IF EXISTS update_daily_usage_trigger ON recordings;
CREATE TRIGGER update_daily_usage_trigger
    AFTER INSERT ON recordings
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_usage_on_recording();

-- Create a function to get daily usage statistics for superadmins
CREATE OR REPLACE FUNCTION get_daily_usage_stats(start_date date DEFAULT CURRENT_DATE - INTERVAL '30 days', end_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(
    usage_date date,
    total_users integer,
    total_recordings integer,
    total_duration integer,
    avg_recordings_per_user numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow superadmins to access this function
    IF NOT is_superadmin() THEN
        RAISE EXCEPTION 'Access denied: Superadmin privileges required';
    END IF;
    
    RETURN QUERY
    SELECT 
        du.usage_date,
        COUNT(DISTINCT du.user_id) as total_users,
        SUM(du.recordings_count) as total_recordings,
        SUM(du.total_duration) as total_duration,
        CASE 
            WHEN COUNT(DISTINCT du.user_id) > 0 
            THEN ROUND(SUM(du.recordings_count)::numeric / COUNT(DISTINCT du.user_id), 2)
            ELSE 0 
        END as avg_recordings_per_user
    FROM daily_usage du
    WHERE du.usage_date BETWEEN start_date AND end_date
    GROUP BY du.usage_date
    ORDER BY du.usage_date DESC;
END;
$$;

-- Grant execute permission to authenticated users (superadmin check is built-in)
GRANT EXECUTE ON FUNCTION get_daily_usage_stats(date, date) TO authenticated;

-- Create RLS policies for daily_usage table if they don't exist
DROP POLICY IF EXISTS "Users can view their own daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Superadmins can view all daily usage" ON daily_usage;
DROP POLICY IF EXISTS "Superadmins can manage all daily usage" ON daily_usage;

CREATE POLICY "Users can view their own daily usage"
    ON daily_usage FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Superadmins can view all daily usage"
    ON daily_usage FOR SELECT
    TO authenticated
    USING (is_superadmin());

CREATE POLICY "Superadmins can manage all daily usage"
    ON daily_usage FOR ALL
    TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Service role policy for administrative operations
CREATE POLICY "Service role can manage all daily usage"
    ON daily_usage FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Verification
DO $$
DECLARE
    function_count integer;
BEGIN
    -- Check if functions were created successfully
    SELECT COUNT(*) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname IN ('get_or_create_daily_usage', 'update_daily_usage_on_recording', 'get_daily_usage_stats');
    
    RAISE NOTICE 'Daily usage functions created: %', function_count;
    
    IF function_count = 3 THEN
        RAISE NOTICE 'SUCCESS: All daily usage functions created successfully';
    ELSE
        RAISE WARNING 'WARNING: Not all functions were created (expected 3, got %)', function_count;
    END IF;
END $$; 