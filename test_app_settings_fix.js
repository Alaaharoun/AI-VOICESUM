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

async function testAppSettingsFix() {
  try {
    console.log('🧪 Testing app_settings RLS fix...');
    
    // Test 1: Check if we can read app_settings
    console.log('\n📋 Test 1: Reading app_settings...');
    const { data: readData, error: readError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'transcription_engine');
    
    if (readError) {
      console.log('❌ Read error:', readError.message);
    } else {
      console.log('✅ Read successful:', readData);
    }
    
    // Test 2: Check if we can update app_settings (this should fail for non-superadmin)
    console.log('\n📋 Test 2: Testing update (should fail for non-superadmin)...');
    const { data: updateData, error: updateError } = await supabase
      .from('app_settings')
      .update({ value: 'huggingface' })
      .eq('key', 'transcription_engine')
      .select();
    
    if (updateError) {
      console.log('⚠️ Update failed (expected for non-superadmin):', updateError.message);
    } else {
      console.log('✅ Update successful (user is superadmin):', updateData);
    }
    
    // Test 3: Check if we can insert new setting (this should fail for non-superadmin)
    console.log('\n📋 Test 3: Testing insert (should fail for non-superadmin)...');
    const { data: insertData, error: insertError } = await supabase
      .from('app_settings')
      .insert({ key: 'test_setting', value: 'test_value' })
      .select();
    
    if (insertError) {
      console.log('⚠️ Insert failed (expected for non-superadmin):', insertError.message);
    } else {
      console.log('✅ Insert successful (user is superadmin):', insertData);
    }
    
    // Test 4: Check current user role
    console.log('\n📋 Test 4: Checking current user role...');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      console.log('✅ User authenticated:', user.email);
      
      // Check if user is superadmin
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select(`
          roles (
            name
          )
        `)
        .eq('user_id', user.id);
      
      if (roleError) {
        console.log('❌ Role check error:', roleError.message);
      } else {
        const isSuperadmin = roleData.some(role => role.roles?.name === 'superadmin');
        console.log('👤 User role:', isSuperadmin ? 'superadmin' : 'regular user');
        console.log('📊 Role data:', roleData);
      }
    } else {
      console.log('❌ No authenticated user');
    }
    
    console.log('\n🎉 App settings RLS test completed!');
    console.log('\n📝 Summary:');
    console.log('- Read operations should work for all authenticated users');
    console.log('- Write operations should only work for superadmins');
    console.log('- If you see update/insert errors, that means RLS is working correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAppSettingsFix(); 