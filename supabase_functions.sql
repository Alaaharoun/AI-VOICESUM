-- =====================================================
-- Supabase Functions and Triggers for Transcription Credits System
-- =====================================================

-- 1. Function to increment transcription minutes (for purchases)
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

-- 2. Function to deduct transcription time (after transcription)
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

-- 3. Trigger function to grant free minutes on user signup
CREATE OR REPLACE FUNCTION grant_free_minutes_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Grant 15 free minutes to new users
  INSERT INTO transcription_credits (user_id, total_minutes, used_minutes)
  VALUES (NEW.id, 15, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger for new user signup
DROP TRIGGER IF EXISTS trigger_grant_free_minutes ON auth.users;
CREATE TRIGGER trigger_grant_free_minutes
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION grant_free_minutes_on_signup();

-- 5. Function to get user's remaining minutes
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

-- 6. Function to check if user has sufficient credits
CREATE OR REPLACE FUNCTION has_sufficient_credits(uid UUID, required_minutes INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT get_remaining_minutes(uid) INTO remaining;
  RETURN remaining >= required_minutes;
END;
$$ LANGUAGE plpgsql;

-- 7. Function to get transcription statistics (for admin)
CREATE OR REPLACE FUNCTION get_transcription_stats()
RETURNS TABLE (
  total_users BIGINT,
  total_minutes_purchased BIGINT,
  total_minutes_used BIGINT,
  average_usage_per_user NUMERIC,
  active_users_today BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_users,
    COALESCE(SUM(total_minutes), 0) as total_minutes_purchased,
    COALESCE(SUM(used_minutes), 0) as total_minutes_used,
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND(SUM(used_minutes)::NUMERIC / COUNT(*), 2)
      ELSE 0 
    END as average_usage_per_user,
    COUNT(CASE WHEN updated_at >= CURRENT_DATE THEN 1 END) as active_users_today
  FROM transcription_credits;
END;
$$ LANGUAGE plpgsql;

-- 8. Create transcription_credits table if it doesn't exist
CREATE TABLE IF NOT EXISTS transcription_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_minutes INTEGER DEFAULT 0 NOT NULL,
  used_minutes INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_transcription_credits_user_id ON transcription_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_transcription_credits_updated_at ON transcription_credits(updated_at);

-- 10. Enable Row Level Security (RLS)
ALTER TABLE transcription_credits ENABLE ROW LEVEL SECURITY;

-- 11. Create RLS policies
-- Users can only see their own credits
CREATE POLICY "Users can view own credits" ON transcription_credits
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own credits (for admin functions)
CREATE POLICY "Users can update own credits" ON transcription_credits
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view all credits
CREATE POLICY "Admins can view all credits" ON transcription_credits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- 12. Function to handle one-time purchase of transcription hours
CREATE OR REPLACE FUNCTION handle_transcription_hour_purchase(uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Add 60 minutes for transcription_1_hour purchase
  PERFORM increment_transcription_minutes(uid, 60);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Usage Examples:
-- =====================================================

-- Grant free minutes to existing user (if needed)
-- SELECT increment_transcription_minutes('user-uuid-here', 15);

-- Check remaining minutes
-- SELECT get_remaining_minutes('user-uuid-here');

-- Check if user has enough credits for 30 minutes
-- SELECT has_sufficient_credits('user-uuid-here', 30);

-- Deduct 15 minutes after transcription
-- SELECT deduct_transcription_time('user-uuid-here', 15);

-- Get admin statistics
-- SELECT * FROM get_transcription_stats();

-- Handle one-time purchase
-- SELECT handle_transcription_hour_purchase('user-uuid-here'); 