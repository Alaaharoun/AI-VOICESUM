/*
  # Add translation fields to recordings table

  1. New Columns
    - `translation` (text, nullable) - Stores the translated text
    - `target_language` (text, nullable) - Stores the target language code

  2. Changes
    - Add columns to support translation feature
    - Maintain backward compatibility with existing records
*/

DO $$
BEGIN
  -- Add translation column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recordings' AND column_name = 'translation'
  ) THEN
    ALTER TABLE recordings ADD COLUMN translation text;
  END IF;

  -- Add target_language column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recordings' AND column_name = 'target_language'
  ) THEN
    ALTER TABLE recordings ADD COLUMN target_language text;
  END IF;
END $$;