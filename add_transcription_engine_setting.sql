-- Add transcription engine setting to app_settings table
-- Run this in Supabase SQL Editor

INSERT INTO app_settings (key, value, description, created_at, updated_at)
VALUES (
  'transcription_engine',
  'azure',
  'Transcription engine to use: azure or huggingface',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Verify the setting was added
SELECT * FROM app_settings WHERE key = 'transcription_engine'; 