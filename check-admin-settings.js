// Script to check admin settings in the database
const { createClient } = require('@supabase/supabase-js');

// Configuration - you'll need to add your Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL || 'your-supabase-url';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAdminSettings() {
  console.log('🔍 Checking Admin Settings in Database...\n');
  
  try {
    // Check transcription engine setting
    console.log('📋 Checking transcription_engine setting...');
    const { data: engineData, error: engineError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'transcription_engine')
      .single();
    
    if (engineError) {
      console.log('❌ Error fetching transcription_engine:', engineError);
    } else if (engineData) {
      console.log('✅ transcription_engine setting found:');
      console.log(JSON.stringify(engineData, null, 2));
    } else {
      console.log('⚠️  No transcription_engine setting found');
    }
    
    // Check Azure API key setting
    console.log('\n📋 Checking ASSEMBLYAI_API_KEY setting...');
    const { data: azureData, error: azureError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'ASSEMBLYAI_API_KEY')
      .single();
    
    if (azureError) {
      console.log('❌ Error fetching ASSEMBLYAI_API_KEY:', azureError);
    } else if (azureData) {
      console.log('✅ ASSEMBLYAI_API_KEY setting found:');
      console.log({
        key: azureData.key,
        value: azureData.value ? `${azureData.value.substring(0, 8)}...` : 'empty',
        description: azureData.description,
        created_at: azureData.created_at,
        updated_at: azureData.updated_at
      });
    } else {
      console.log('⚠️  No ASSEMBLYAI_API_KEY setting found');
    }
    
    // Check all app_settings
    console.log('\n📋 Checking all app_settings...');
    const { data: allSettings, error: allError } = await supabase
      .from('app_settings')
      .select('*')
      .order('key');
    
    if (allError) {
      console.log('❌ Error fetching all settings:', allError);
    } else if (allSettings && allSettings.length > 0) {
      console.log(`✅ Found ${allSettings.length} app settings:`);
      allSettings.forEach(setting => {
        console.log(`  - ${setting.key}: ${setting.value ? setting.value.substring(0, 20) + '...' : 'empty'}`);
      });
    } else {
      console.log('⚠️  No app_settings found');
    }
    
  } catch (error) {
    console.error('❌ Database connection error:', error);
  }
}

async function testEngineStatus() {
  console.log('\n🔍 Testing Engine Status Logic...\n');
  
  try {
    // Get current engine setting
    const { data: engineData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'transcription_engine')
      .single();
    
    const currentEngine = engineData?.value || 'azure';
    console.log(`Current engine setting: ${currentEngine}`);
    
    // Simulate the engine status check
    if (currentEngine === 'huggingface') {
      console.log('🔄 Testing Hugging Face connectivity...');
      
      const response = await fetch('https://alaaharoun-faster-whisper-api.hf.space/health', {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      
      console.log(`Health check status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Hugging Face is ready:', data);
      } else {
        console.log('❌ Hugging Face health check failed');
      }
    } else {
      console.log('🔄 Testing Azure configuration...');
      
      const { data: azureData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'ASSEMBLYAI_API_KEY')
        .single();
      
      if (azureData && azureData.value) {
        console.log('✅ Azure API key is configured');
      } else {
        console.log('❌ Azure API key is not configured');
      }
    }
    
  } catch (error) {
    console.error('❌ Engine status test error:', error);
  }
}

async function fixEngineSetting() {
  console.log('\n🔧 Fixing Engine Setting...\n');
  
  try {
    // Set engine to huggingface
    const { data, error } = await supabase
      .from('app_settings')
      .upsert([
        { 
          key: 'transcription_engine', 
          value: 'huggingface',
          description: 'Transcription engine to use: azure or huggingface',
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'key' });
    
    if (error) {
      console.log('❌ Error updating engine setting:', error);
    } else {
      console.log('✅ Engine setting updated to huggingface');
      console.log('Data:', data);
    }
    
  } catch (error) {
    console.error('❌ Fix error:', error);
  }
}

// Main function
async function main() {
  console.log('🚀 Admin Settings Checker\n');
  
  // Check if Supabase credentials are configured
  if (SUPABASE_URL === 'your-supabase-url' || SUPABASE_ANON_KEY === 'your-supabase-anon-key') {
    console.log('❌ Please configure your Supabase credentials:');
    console.log('   Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
    console.log('   Or update the constants in this file');
    return;
  }
  
  await checkAdminSettings();
  await testEngineStatus();
  
  // Ask if user wants to fix the setting
  console.log('\n🔧 Would you like to set the engine to huggingface? (y/n)');
  // In a real scenario, you'd read user input here
  // For now, we'll just show the command
  console.log('   Run: node -e "require(\'./check-admin-settings.js\').fixEngineSetting()"');
}

// Export functions for individual testing
module.exports = {
  checkAdminSettings,
  testEngineStatus,
  fixEngineSetting
};

// Run main function if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
} 