/*
# Create daily usage RPC function

1. New Functions
  - `get_or_create_daily_usage` function that retrieves or creates daily usage records
  
2. Functionality
  - Takes a user_uuid parameter
  - Returns daily usage record for today
  - Creates a new record if one doesn't exist for today
  - Ensures data integrity with proper error handling
*/

-- Create the get_or_create_daily_usage RPC function
CREATE OR REPLACE FUNCTION get_or_create_daily_usage(user_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  usage_date DATE,
  seconds_used INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try to get existing record for today
  RETURN QUERY
  SELECT 
    du.user_id,
    du.usage_date,
    du.seconds_used
  FROM daily_usage du
  WHERE du.user_id = user_uuid 
    AND du.usage_date = CURRENT_DATE;

  -- If no record found, create one
  IF NOT FOUND THEN
    INSERT INTO daily_usage (user_id, usage_date, seconds_used)
    VALUES (user_uuid, CURRENT_DATE, 0)
    RETURNING 
      daily_usage.user_id,
      daily_usage.usage_date,
      daily_usage.seconds_used
    INTO user_id, usage_date, seconds_used;
    
    RETURN NEXT;
  END IF;
END;
$$;