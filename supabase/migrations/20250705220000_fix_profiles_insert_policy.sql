-- =============================================================================
-- Fix Profiles INSERT Policy for New User Registration
-- =============================================================================

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create comprehensive policies for profiles table
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- This is the missing policy that was causing the signup error
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Keep existing superadmin policies
-- (These should already exist from previous migrations)

-- =============================================================================
-- Verification
-- =============================================================================

-- Check that all policies are in place
DO $$
DECLARE
    policy_count integer;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'profiles';
    
    RAISE NOTICE 'Profiles table has % policies', policy_count;
    
    IF policy_count < 3 THEN
        RAISE WARNING 'Expected at least 3 policies for profiles table (SELECT, UPDATE, INSERT)';
    END IF;
END $$; 