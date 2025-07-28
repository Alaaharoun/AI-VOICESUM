require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Get Supabase configuration from environment
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder_key";

if (supabaseUrl === "https://placeholder.supabase.co" || supabaseAnonKey === "placeholder_key") {
  console.error('❌ Supabase configuration not found. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAdminButtonFix() {
  try {
    console.log('🧪 Testing admin button fix...');
    
    // Test 1: Check current transcription engine setting
    console.log('\n📋 Test 1: Reading current transcription engine...');
    const { data: currentData, error: currentError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'transcription_engine')
      .single();
    
    if (currentError) {
      console.log('❌ Read error:', currentError.message);
    } else {
      console.log('✅ Current engine:', currentData.value);
    }
    
    // Test 2: Test switching to huggingface
    console.log('\n📋 Test 2: Testing switch to huggingface...');
    const { data: updateData, error: updateError } = await supabase
      .from('app_settings')
      .upsert([
        { key: 'transcription_engine', value: 'huggingface' }
      ], { onConflict: 'key' })
      .select();
    
    if (updateError) {
      console.log('❌ Update error:', updateError.message);
    } else {
      console.log('✅ Switch to huggingface successful:', updateData);
    }
    
    // Test 3: Test switching back to azure
    console.log('\n📋 Test 3: Testing switch back to azure...');
    const { data: revertData, error: revertError } = await supabase
      .from('app_settings')
      .upsert([
        { key: 'transcription_engine', value: 'azure' }
      ], { onConflict: 'key' })
      .select();
    
    if (revertError) {
      console.log('❌ Revert error:', revertError.message);
    } else {
      console.log('✅ Switch back to azure successful:', revertData);
    }
    
    // Test 4: Verify final state
    console.log('\n📋 Test 4: Verifying final state...');
    const { data: finalData, error: finalError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'transcription_engine')
      .single();
    
    if (finalError) {
      console.log('❌ Final read error:', finalError.message);
    } else {
      console.log('✅ Final engine setting:', finalData.value);
    }
    
    console.log('\n🎉 Admin button fix test completed!');
    console.log('\n📝 Summary:');
    console.log('- Database operations should work without RLS errors');
    console.log('- Engine switching should be successful');
    console.log('- The button should return to normal state after save');
    
    console.log('\n🔧 Next steps:');
    console.log('1. Test the button in the admin panel');
    console.log('2. Check that the loading state clears properly');
    console.log('3. Verify that engine status updates correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAdminButtonFix(); 