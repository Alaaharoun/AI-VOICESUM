/*
  # Add daily usage tracking for free trial limits

  1. New Tables
    - `daily_usage`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `usage_date` (date)
      - `seconds_used` (integer, default 0)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on daily_usage table
    - Add policies for users to access their own usage data
    - Add unique constraint on user_id + usage_date

  3. Changes
    - Track daily usage in seconds for each user
    - Allow users to query and update their own usage
*/

CREATE TABLE IF NOT EXISTS daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  seconds_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint to prevent duplicate entries per user per day
ALTER TABLE daily_usage ADD CONSTRAINT unique_user_date UNIQUE (user_id, usage_date);

-- Enable RLS
ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for daily_usage
CREATE POLICY "Users can read own usage"
  ON daily_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON daily_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON daily_usage
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger for daily_usage table
CREATE TRIGGER update_daily_usage_updated_at
  BEFORE UPDATE ON daily_usage
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- Function to get or create today's usage record
CREATE OR REPLACE FUNCTION get_or_create_daily_usage(user_uuid uuid)
RETURNS TABLE(user_id uuid, usage_date date, seconds_used integer) AS $$
DECLARE
  usage_record daily_usage%ROWTYPE;
BEGIN
  -- Try to get existing record for today
  SELECT * INTO usage_record
  FROM daily_usage
  WHERE user_id = user_uuid AND usage_date = CURRENT_DATE;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO daily_usage (user_id, usage_date, seconds_used)
    VALUES (user_uuid, CURRENT_DATE, 0)
    RETURNING * INTO usage_record;
  END IF;
  
  -- Return the record
  RETURN QUERY SELECT usage_record.user_id, usage_record.usage_date, usage_record.seconds_used;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;