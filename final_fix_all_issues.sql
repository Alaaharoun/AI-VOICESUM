-- Final Fix for All Issues
-- Run this in Supabase SQL Editor

-- 1. Fix user_roles infinite recursion
DROP POLICY IF EXISTS "Enable read access for all users" ON user_roles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_roles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON user_roles;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON user_roles;
DROP POLICY IF EXISTS "Allow users to read their own roles" ON user_roles;
DROP POLICY IF EXISTS "Allow superadmins to manage all roles" ON user_roles;

ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read user_roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow users to manage their own roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- 2. Fix app_settings table
DROP TABLE IF EXISTS app_settings CASCADE;

CREATE TABLE app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  created_at timestamptz DEFAULT now()
);

-- Insert data
INSERT INTO app_settings (key, value) VALUES
  ('rate_us_url', 'https://play.google.com/store/apps/details?id=com.ailivetranslate.app'),
  ('share_app_url', 'https://play.google.com/store/apps/details?id=com.ailivetranslate.app'),
  ('privacy_policy_url', 'https://ailivetranslate.com/privacy'),
  ('terms_of_service_url', 'https://ailivetranslate.com/terms'),
  ('support_email', 'support@ailivetranslate.com'),
  ('app_version', '5.1.1'),
  ('maintenance_mode', 'false'),
  ('maintenance_message', '');

-- Simple RLS for app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to read app_settings"
  ON app_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Test the fixes
SELECT 'user_roles' as table_name, COUNT(*) as count FROM user_roles
UNION ALL
SELECT 'app_settings' as table_name, COUNT(*) as count FROM app_settings; 