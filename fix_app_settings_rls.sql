-- Fix App Settings RLS Policy Issue
-- Run this in Supabase SQL Editor

-- First, let's check the current state
SELECT 'Current app_settings policies:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'app_settings';

-- Drop all existing policies on app_settings
DROP POLICY IF EXISTS "Everyone can read app settings" ON app_settings;
DROP POLICY IF EXISTS "Superadmins can manage app settings" ON app_settings;
DROP POLICY IF EXISTS "Allow all authenticated users to read app_settings" ON app_settings;
DROP POLICY IF EXISTS "Allow superadmins to manage app_settings" ON app_settings;
DROP POLICY IF EXISTS "Allow read for authenticated users" ON app_settings;
DROP POLICY IF EXISTS "Allow superadmins to manage" ON app_settings;

-- Temporarily disable RLS to fix the issue
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS with a very simple policy
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Create a simple policy that allows all authenticated users to read
CREATE POLICY "app_settings_read_policy"
  ON app_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Create a simple policy that allows superadmins to manage
CREATE POLICY "app_settings_manage_policy"
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

-- Insert transcription_engine setting if it doesn't exist
INSERT INTO app_settings (key, value) 
VALUES ('transcription_engine', 'azure')
ON CONFLICT (key) DO NOTHING;

-- Verify the fix
SELECT 'app_settings table contents:' as info;
SELECT * FROM app_settings WHERE key = 'transcription_engine';

SELECT 'New app_settings policies:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'app_settings'; 