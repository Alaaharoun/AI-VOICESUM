-- Quick fix for subscription_type constraint issue
-- Run this in Supabase SQL Editor to fix the free trial activation problem

-- Drop any existing check constraints on subscription_type
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

-- Now add a new constraint that allows all the subscription types we need
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

-- Add a comment to document the allowed values
COMMENT ON COLUMN user_subscriptions.subscription_type IS 
'Allowed values: free_trial, basic, premium, pro, mini, unlimited, and Google Play SKUs (basic-monthly, basic-yearly, etc.)';

-- Test the fix by trying to insert a free_trial record (this will be rolled back)
DO $$
BEGIN
    -- This is just a test - it will be rolled back
    INSERT INTO user_subscriptions (user_id, subscription_type, active, expires_at, usage_seconds)
    VALUES ('00000000-0000-0000-0000-000000000000', 'free_trial', true, now() + interval '2 days', 0);
    
    RAISE NOTICE 'Test insert successful - constraint is working correctly';
    
    -- Rollback the test insert
    RAISE EXCEPTION 'Test completed successfully - this exception will rollback the test insert';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLERRM LIKE '%Test completed successfully%' THEN
            RAISE NOTICE 'Constraint fix applied successfully! Free trial activation should now work.';
        ELSE
            RAISE NOTICE 'Error during test: %', SQLERRM;
        END IF;
END $$; 