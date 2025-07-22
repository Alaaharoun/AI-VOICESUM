-- Emergency App Settings Fix
-- Run this in Supabase SQL Editor

-- Drop everything related to app_settings
DROP TABLE IF EXISTS app_settings CASCADE;
DROP FUNCTION IF EXISTS update_app_settings_updated_at() CASCADE;

-- Create a very simple app_settings table
CREATE TABLE app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  created_at timestamptz DEFAULT now()
);

-- Disable RLS temporarily to test
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

-- Insert basic settings
INSERT INTO app_settings (key, value) VALUES
  ('rate_us_url', 'https://play.google.com/store/apps/details?id=com.ailivetranslate.app'),
  ('share_app_url', 'https://play.google.com/store/apps/details?id=com.ailivetranslate.app'),
  ('privacy_policy_url', 'https://ailivetranslate.com/privacy'),
  ('terms_of_service_url', 'https://ailivetranslate.com/terms'),
  ('support_email', 'support@ailivetranslate.com'),
  ('app_version', '5.1.1'),
  ('maintenance_mode', 'false'),
  ('maintenance_message', '');

-- Verify the table was created and has data
SELECT * FROM app_settings;

-- Now enable RLS with a simple policy
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Simple policy - allow all authenticated users to read
CREATE POLICY "Allow all authenticated users to read app_settings"
  ON app_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Simple policy - allow superadmins to manage
CREATE POLICY "Allow superadmins to manage app_settings"
  ON app_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'superadmin'
    )
  ); 