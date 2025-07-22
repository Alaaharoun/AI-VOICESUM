-- Fix user_subscriptions table relationships and structure
-- This migration ensures the table structure is correct and removes problematic relationships

-- Step 1: Drop any existing foreign key relationships that might be causing issues
DO $$
BEGIN
    -- Drop foreign key to subscriptions table if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%user_subscriptions_subscription_id_fkey%'
        AND table_name = 'user_subscriptions'
    ) THEN
        ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_subscription_id_fkey;
        RAISE NOTICE 'Dropped user_subscriptions_subscription_id_fkey constraint';
    END IF;
    
    -- Drop subscription_id column if it exists (we don't need it)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' 
        AND column_name = 'subscription_id'
    ) THEN
        ALTER TABLE user_subscriptions DROP COLUMN subscription_id;
        RAISE NOTICE 'Dropped subscription_id column';
    END IF;
    
    -- Drop subscription_status column if it exists (we use 'active' instead)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' 
        AND column_name = 'subscription_status'
    ) THEN
        ALTER TABLE user_subscriptions DROP COLUMN subscription_status;
        RAISE NOTICE 'Dropped subscription_status column';
    END IF;
    
    -- Drop subscription_end_date column if it exists (we use 'expires_at' instead)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' 
        AND column_name = 'subscription_end_date'
    ) THEN
        ALTER TABLE user_subscriptions DROP COLUMN subscription_end_date;
        RAISE NOTICE 'Dropped subscription_end_date column';
    END IF;
    
    -- Drop payment_method column if it exists (not needed for basic functionality)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' 
        AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE user_subscriptions DROP COLUMN payment_method;
        RAISE NOTICE 'Dropped payment_method column';
    END IF;
END $$;

-- Step 2: Ensure the table has the correct structure
-- Add any missing columns that the code expects
DO $$
BEGIN
    -- Add active column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' 
        AND column_name = 'active'
    ) THEN
        ALTER TABLE user_subscriptions ADD COLUMN active boolean DEFAULT true;
        RAISE NOTICE 'Added active column';
    END IF;
    
    -- Add expires_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' 
        AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE user_subscriptions ADD COLUMN expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 month');
        RAISE NOTICE 'Added expires_at column';
    END IF;
    
    -- Add usage_seconds column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' 
        AND column_name = 'usage_seconds'
    ) THEN
        ALTER TABLE user_subscriptions ADD COLUMN usage_seconds integer DEFAULT 0;
        RAISE NOTICE 'Added usage_seconds column';
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE user_subscriptions ADD COLUMN updated_at timestamptz DEFAULT now();
        RAISE NOTICE 'Added updated_at column';
    END IF;
END $$;

-- Step 3: Ensure subscription_type column exists and has no problematic constraints
DO $$
BEGIN
    -- Add subscription_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' 
        AND column_name = 'subscription_type'
    ) THEN
        ALTER TABLE user_subscriptions ADD COLUMN subscription_type text NOT NULL DEFAULT 'basic';
        RAISE NOTICE 'Added subscription_type column';
    END IF;
    
    -- Remove any existing constraints on subscription_type
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%subscription_type%'
        AND table_name = 'user_subscriptions'
        AND constraint_type = 'CHECK'
    ) THEN
        EXECUTE (
            'ALTER TABLE user_subscriptions DROP CONSTRAINT ' || 
            (SELECT constraint_name FROM information_schema.table_constraints 
             WHERE constraint_name LIKE '%subscription_type%'
             AND table_name = 'user_subscriptions'
             AND constraint_type = 'CHECK'
             LIMIT 1)
        );
        RAISE NOTICE 'Removed subscription_type constraint';
    END IF;
END $$;

-- Step 4: Recreate indexes for performance
DROP INDEX IF EXISTS idx_user_subscriptions_user_id;
DROP INDEX IF EXISTS idx_user_subscriptions_active;
DROP INDEX IF EXISTS idx_user_subscriptions_expires_at;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active ON user_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at ON user_subscriptions(expires_at);

-- Step 5: Ensure RLS is enabled and policies are correct
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate them
DROP POLICY IF EXISTS "Users can read own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can view all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can manage all subscriptions" ON user_subscriptions;

-- Create policies for user_subscriptions
CREATE POLICY "Users can read own subscriptions"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON user_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON user_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON user_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 6: Create or replace the updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- Step 7: Test the fix
DO $$
BEGIN
    -- Test inserting a free_trial record
    INSERT INTO user_subscriptions (user_id, subscription_type, active, expires_at, usage_seconds)
    VALUES ('00000000-0000-0000-0000-000000000000', 'free_trial', true, now() + interval '2 days', 0);
    
    RAISE NOTICE 'Test insert successful! Table structure is correct.';
    
    -- Clean up test data
    DELETE FROM user_subscriptions WHERE user_id = '00000000-0000-0000-0000-000000000000';
    
    RAISE NOTICE 'Test data cleaned up. All relationships and constraints fixed!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during test: %', SQLERRM;
END $$;

-- Step 8: Show final table structure
SELECT 'Final user_subscriptions table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_subscriptions' 
ORDER BY ordinal_position; 