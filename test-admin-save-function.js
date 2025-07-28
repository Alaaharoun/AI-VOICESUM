const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🔍 Testing Admin Save Function...');

// Get Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder_key";

if (supabaseUrl === "https://placeholder.supabase.co" || supabaseAnonKey === "placeholder_key") {
  console.error('❌ Supabase configuration not found. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Mock the save function from admin panel
async function mockSaveTranscriptionEngine(engine) {
  console.log(`🔄 Starting to save transcription engine: ${engine}`);
  
  try {
    console.log('📝 Attempting to save to database...');
    const { data, error } = await supabase
      .from('app_settings')
      .upsert([
        { key: 'transcription_engine', value: engine }
      ], { onConflict: 'key' });
    
    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }
    
    console.log('✅ Database save successful:', data);
    
    // Simulate updating local engine status
    console.log('🔄 Updating local engine status...');
    const status = {
      engine: engine,
      configured: true,
      status: 'ready',
      message: `Engine switched to ${engine === 'azure' ? 'Azure Speech' : 'Faster Whisper'}`
    };
    
    console.log('✅ Save operation completed successfully');
    console.log('📊 Final status:', status);
    
    return { success: true, data, status };
    
  } catch (err) {
    console.error('❌ Save operation failed:', err);
    return { success: false, error: err.message };
  }
}

// Test functions
async function testSaveToAzure() {
  console.log('\n📋 Test 1: Save to Azure');
  
  const result = await mockSaveTranscriptionEngine('azure');
  
  if (result.success) {
    console.log('✅ Azure save test PASSED');
    return true;
  } else {
    console.log('❌ Azure save test FAILED:', result.error);
    return false;
  }
}

async function testSaveToHuggingFace() {
  console.log('\n📋 Test 2: Save to Hugging Face');
  
  const result = await mockSaveTranscriptionEngine('huggingface');
  
  if (result.success) {
    console.log('✅ Hugging Face save test PASSED');
    return true;
  } else {
    console.log('❌ Hugging Face save test FAILED:', result.error);
    return false;
  }
}

async function testSaveBackToAzure() {
  console.log('\n📋 Test 3: Save back to Azure');
  
  const result = await mockSaveTranscriptionEngine('azure');
  
  if (result.success) {
    console.log('✅ Azure save back test PASSED');
    return true;
  } else {
    console.log('❌ Azure save back test FAILED:', result.error);
    return false;
  }
}

async function testDatabaseVerification() {
  console.log('\n📋 Test 4: Database Verification');
  
  try {
    // Check current setting in database
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'transcription_engine')
      .single();
    
    if (error) {
      console.log('❌ Database verification failed:', error.message);
      return false;
    }
    
    console.log('✅ Database verification successful');
    console.log('📊 Current engine setting:', data.value);
    
    return true;
  } catch (error) {
    console.log('❌ Database verification error:', error.message);
    return false;
  }
}

async function testPerformance() {
  console.log('\n📋 Test 5: Performance Test');
  
  const startTime = Date.now();
  
  try {
    const result = await mockSaveTranscriptionEngine('huggingface');
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`⏱️  Save operation took ${duration}ms`);
    
    if (duration < 2000) {
      console.log('✅ Performance test PASSED (under 2 seconds)');
      return true;
    } else {
      console.log('⚠️ Performance test SLOW (over 2 seconds)');
      return false;
    }
  } catch (error) {
    console.log('❌ Performance test FAILED:', error.message);
    return false;
  }
}

// Main test runner
async function runAdminSaveTests() {
  console.log('🚀 Starting Admin Save Function Tests...\n');
  
  const results = {
    saveToAzure: await testSaveToAzure(),
    saveToHuggingFace: await testSaveToHuggingFace(),
    saveBackToAzure: await testSaveBackToAzure(),
    databaseVerification: await testDatabaseVerification(),
    performance: await testPerformance()
  };
  
  // Summary
  console.log('\n📊 Admin Save Function Test Results Summary:');
  console.log('=============================================');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  // Detailed results
  console.log('\n📋 Detailed Results:');
  Object.entries(results).forEach(([testName, result]) => {
    const status = result ? '✅' : '❌';
    console.log(`${status} ${testName}: ${result ? 'PASSED' : 'FAILED'}`);
  });
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (results.saveToAzure && results.saveToHuggingFace && results.saveBackToAzure) {
    console.log('✅ Save function is working correctly for all engines');
  } else {
    console.log('❌ Save function has issues with some engines');
  }
  
  if (results.databaseVerification) {
    console.log('✅ Database operations are working correctly');
  } else {
    console.log('❌ Database operations have issues');
  }
  
  if (results.performance) {
    console.log('✅ Save operations are fast enough');
  } else {
    console.log('⚠️ Save operations are slower than expected');
  }
  
  console.log('\n🎉 Admin Save Function testing completed!');
  console.log('\n📝 Next Steps:');
  console.log('1. Test the actual admin panel UI');
  console.log('2. Check if the loading state resets properly');
  console.log('3. Verify that success messages appear');
  console.log('4. Test with different network conditions');
}

// Run the tests
runAdminSaveTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
}); 