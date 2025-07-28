-- Add Azure API key to app_settings table
-- Run this in Supabase SQL Editor

-- First, check if the key exists
SELECT * FROM app_settings WHERE key = 'ASSEMBLYAI_API_KEY';

-- If it doesn't exist, add it (replace 'YOUR_API_KEY_HERE' with your actual API key)
INSERT INTO app_settings (key, value, description, created_at, updated_at)
VALUES (
  'ASSEMBLYAI_API_KEY',
  'YOUR_API_KEY_HERE', -- Replace this with your actual Azure API key
  'Azure AssemblyAI API key for speech-to-text service',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Verify the key was added
SELECT key, 
       CASE 
         WHEN LENGTH(value) > 10 THEN CONCAT(LEFT(value, 5), '...', RIGHT(value, 5))
         ELSE '***SHORT***'
       END as masked_value,
       description 
FROM app_settings 
WHERE key = 'ASSEMBLYAI_API_KEY'; 