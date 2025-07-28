require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Get Supabase configuration from environment
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder_service_key";
const azureApiKey = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY || process.env.ASSEMBLYAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || supabaseUrl === "https://placeholder.supabase.co" || supabaseServiceKey === "placeholder_service_key") {
  console.error('❌ Supabase configuration not found. Please set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

if (!azureApiKey) {
  console.error('❌ Azure API key not found. Please set EXPO_PUBLIC_ASSEMBLYAI_API_KEY or ASSEMBLYAI_API_KEY environment variable.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addAzureApiKey() {
  try {
    console.log('🔄 Adding Azure API key to database...');
    
    // Add Azure API key to app_settings
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'ASSEMBLYAI_API_KEY',
        value: azureApiKey,
        created_at: new Date().toISOString()
      }, { onConflict: 'key' });
    
    if (error) {
      console.error('❌ Error adding Azure API key:', error);
      process.exit(1);
    }
    
    console.log('✅ Azure API key added successfully!');
    console.log('📝 Key length:', azureApiKey.length);
    console.log('🔑 Key preview:', azureApiKey.substring(0, 5) + '...' + azureApiKey.substring(azureApiKey.length - 5));
    
    // Verify the key was added
    const { data, error: fetchError } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('key', 'ASSEMBLYAI_API_KEY')
      .single();
    
    if (fetchError) {
      console.error('❌ Error verifying API key:', fetchError);
    } else {
      console.log('✅ Verification successful!');
      console.log('📋 Key stored in database:', data.key);
      console.log('📝 Key length:', data.value ? data.value.length : 0);
    }
    
  } catch (error) {
    console.error('❌ Failed to add Azure API key:', error);
    process.exit(1);
  }
}

addAzureApiKey(); 