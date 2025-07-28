require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Get Supabase configuration from environment
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder_service_key";

if (!supabaseUrl || !supabaseServiceKey || supabaseUrl === "https://placeholder.supabase.co" || supabaseServiceKey === "placeholder_service_key") {
  console.error('❌ Supabase configuration not found. Please set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.log('📁 Current working directory:', process.cwd());
  console.log('🔍 Looking for .env file in:', process.cwd());
  console.log('📋 Supabase URL:', supabaseUrl ? 'Found' : 'Missing');
  console.log('📋 Supabase Service Key:', supabaseServiceKey ? 'Found' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('🔄 Applying transcription engine migration...');
    
    // Add transcription engine setting
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'transcription_engine',
        value: 'azure',
        created_at: new Date().toISOString()
      }, { onConflict: 'key' });
    
    if (error) {
      console.error('❌ Error applying migration:', error);
      process.exit(1);
    }
    
    console.log('✅ Transcription engine migration applied successfully!');
    console.log('📝 Added transcription_engine setting with default value: azure');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration(); 