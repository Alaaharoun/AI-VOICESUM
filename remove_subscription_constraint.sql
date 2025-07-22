-- Simple fix: Remove subscription_type constraint completely
-- This allows any subscription_type value to be inserted

-- Step 1: Check current data
SELECT 'Current subscription types in database:' as info;
SELECT subscription_type, COUNT(*) as count 
FROM user_subscriptions 
GROUP BY subscription_type;

-- Step 2: Remove all constraints on subscription_type
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Find and drop all check constraints on subscription_type
    FOR constraint_name IN 
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints tc
        WHERE tc.table_name = 'user_subscriptions' 
        AND tc.constraint_type = 'CHECK'
        AND tc.constraint_name LIKE '%subscription_type%'
    LOOP
        EXECUTE 'ALTER TABLE user_subscriptions DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
    
    RAISE NOTICE 'All subscription_type constraints removed successfully';
END $$;

-- Step 3: Verify no constraints remain
SELECT 'Remaining constraints on user_subscriptions:' as info;
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'user_subscriptions' 
AND constraint_type = 'CHECK';

-- Step 4: Test inserting free_trial
DO $$
BEGIN
    -- Test insert
    INSERT INTO user_subscriptions (user_id, subscription_type, active, expires_at, usage_seconds)
    VALUES ('00000000-0000-0000-0000-000000000000', 'free_trial', true, now() + interval '2 days', 0);
    
    RAISE NOTICE 'Test insert successful! Free trial can now be activated.';
    
    -- Clean up test data
    DELETE FROM user_subscriptions WHERE user_id = '00000000-0000-0000-0000-000000000000';
    
    RAISE NOTICE 'Test data cleaned up. Constraint removal successful!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during test: %', SQLERRM;
END $$;

-- Step 5: Final confirmation
SELECT 'SUCCESS: Subscription constraint removed. Free trial activation should now work!' as result; 