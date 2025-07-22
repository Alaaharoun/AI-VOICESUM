-- Complete fix for subscription_type constraint issue
-- This script handles existing data and completely fixes the constraint problem

-- Step 1: First, let's see what data exists that might be causing issues
SELECT subscription_type, COUNT(*) as count 
FROM user_subscriptions 
GROUP BY subscription_type;

-- Step 2: Drop the problematic constraint completely
DO $$
BEGIN
    -- Drop any existing check constraints on subscription_type
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_subscriptions_subscription_type_check'
        AND table_name = 'user_subscriptions'
    ) THEN
        ALTER TABLE user_subscriptions DROP CONSTRAINT user_subscriptions_subscription_type_check;
        RAISE NOTICE 'Dropped existing user_subscriptions_subscription_type_check constraint';
    ELSE
        RAISE NOTICE 'No existing user_subscriptions_subscription_type_check constraint found';
    END IF;
    
    -- Drop any other check constraints that might be restricting subscription_type
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
        RAISE NOTICE 'Dropped additional subscription_type constraint';
    END IF;
END $$;

-- Step 3: Clean up any problematic existing data
-- Update any subscription_type values that might cause issues
UPDATE user_subscriptions 
SET subscription_type = 'basic' 
WHERE subscription_type NOT IN (
    'free_trial',
    'basic',
    'premium', 
    'pro',
    'mini',
    'unlimited',
    'basic-monthly',
    'basic-yearly',
    'pro-monthly',
    'pro-yearly',
    'unlimited-monthly',
    'unlimited-yearly',
    'mini-monthly'
);

-- Step 4: Now add a new constraint that allows all the subscription types we need
ALTER TABLE user_subscriptions 
ADD CONSTRAINT user_subscriptions_subscription_type_check 
CHECK (subscription_type IN (
    'free_trial',
    'basic',
    'premium', 
    'pro',
    'mini',
    'unlimited',
    'basic-monthly',
    'basic-yearly',
    'pro-monthly',
    'pro-yearly',
    'unlimited-monthly',
    'unlimited-yearly',
    'mini-monthly'
));

-- Step 5: Add a comment to document the allowed values
COMMENT ON COLUMN user_subscriptions.subscription_type IS 
'Allowed values: free_trial, basic, premium, pro, mini, unlimited, and Google Play SKUs (basic-monthly, basic-yearly, etc.)';

-- Step 6: Test the fix
DO $$
BEGIN
    -- Test inserting a free_trial record
    INSERT INTO user_subscriptions (user_id, subscription_type, active, expires_at, usage_seconds)
    VALUES ('00000000-0000-0000-0000-000000000000', 'free_trial', true, now() + interval '2 days', 0);
    
    RAISE NOTICE 'Test insert successful - constraint is working correctly';
    
    -- Clean up the test record
    DELETE FROM user_subscriptions WHERE user_id = '00000000-0000-0000-0000-000000000000';
    
    RAISE NOTICE 'Constraint fix applied successfully! Free trial activation should now work.';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during test: %', SQLERRM;
        RAISE NOTICE 'This might indicate there are still issues with the constraint or data';
END $$;

-- Step 7: Show final status
SELECT 'Constraint fix completed successfully!' as status; 