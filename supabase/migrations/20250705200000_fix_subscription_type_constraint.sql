-- Fix subscription_type constraint to allow all subscription types including free_trial
-- This migration removes any existing constraints and allows the subscription_type to accept any value

-- First, let's check if there are any existing constraints and drop them
DO $$
BEGIN
    -- Drop any existing check constraints on subscription_type
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_subscriptions_subscription_type_check'
        AND table_name = 'user_subscriptions'
    ) THEN
        ALTER TABLE user_subscriptions DROP CONSTRAINT user_subscriptions_subscription_type_check;
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
    END IF;
END $$;

-- Now let's add a new constraint that allows all the subscription types we need
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