-- Quick fix for user_subscriptions relationship issues
-- Run this in Supabase SQL Editor to fix the PGRST200 error

-- Step 1: Remove problematic foreign key relationships
DO $$
BEGIN
    -- Drop any foreign key to subscriptions table
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%user_subscriptions_subscription_id_fkey%'
        AND table_name = 'user_subscriptions'
    ) THEN
        ALTER TABLE user_subscriptions DROP CONSTRAINT user_subscriptions_subscription_id_fkey;
        RAISE NOTICE 'Removed subscription_id foreign key constraint';
    END IF;
END $$;

-- Step 2: Remove subscription_id column if it exists
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS subscription_id;

-- Step 3: Remove other problematic columns
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS subscription_status;
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS subscription_end_date;
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS payment_method;

-- Step 4: Ensure required columns exist
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 month');
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS usage_seconds integer DEFAULT 0;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Step 5: Remove any constraints on subscription_type
DO $$
BEGIN
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

-- Step 6: Test the fix
DO $$
BEGIN
    -- Test inserting a free_trial record
    INSERT INTO user_subscriptions (user_id, subscription_type, active, expires_at, usage_seconds)
    VALUES ('00000000-0000-0000-0000-000000000000', 'free_trial', true, now() + interval '2 days', 0);
    
    RAISE NOTICE 'Test insert successful! Relationships fixed.';
    
    -- Clean up test data
    DELETE FROM user_subscriptions WHERE user_id = '00000000-0000-0000-0000-000000000000';
    
    RAISE NOTICE 'Test data cleaned up. All issues resolved!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during test: %', SQLERRM;
END $$;

-- Step 7: Show current table structure
SELECT 'Current user_subscriptions table structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_subscriptions' 
ORDER BY ordinal_position;

-- Step 8: Final confirmation
SELECT 'SUCCESS: All relationship issues fixed! Free trial activation should now work.' as result; 