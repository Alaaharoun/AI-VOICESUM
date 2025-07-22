/*
  # App Settings Table - Fixed Version
  
  Create app_settings table to store application configuration
  and dynamic settings that can be managed by superadmins.
  
  Run this SQL in your Supabase Dashboard SQL Editor
*/

-- Drop table if exists to recreate it properly
DROP TABLE IF EXISTS app_settings CASCADE;

-- Create app_settings table
CREATE TABLE app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for app_settings
CREATE POLICY "Everyone can read app settings"
  ON app_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Superadmins can manage app settings"
  ON app_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'superadmin'
    )
  );

-- Insert default app settings
INSERT INTO app_settings (key, value) VALUES
  ('rate_us_url', 'https://play.google.com/store/apps/details?id=com.ailivetranslate.app'),
  ('share_app_url', 'https://play.google.com/store/apps/details?id=com.ailivetranslate.app'),
  ('privacy_policy_url', 'https://ailivetranslate.com/privacy'),
  ('terms_of_service_url', 'https://ailivetranslate.com/terms'),
  ('support_email', 'support@ailivetranslate.com'),
  ('app_version', '5.1.1'),
  ('maintenance_mode', 'false'),
  ('maintenance_message', '')
ON CONFLICT (key) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_app_settings_updated_at(); 