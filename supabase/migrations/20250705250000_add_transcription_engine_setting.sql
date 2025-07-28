-- Add transcription engine setting
INSERT INTO app_settings (key, value, description, created_at, updated_at)
VALUES (
  'transcription_engine',
  'azure',
  'Transcription engine to use: azure or huggingface',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING; 