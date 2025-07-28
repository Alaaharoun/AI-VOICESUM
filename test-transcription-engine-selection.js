const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🔍 Testing Transcription Engine Selection...');

// Get Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder_key";

if (supabaseUrl === "https://placeholder.supabase.co" || supabaseAnonKey === "placeholder_key") {
  console.error('❌ Supabase configuration not found. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Mock TranscriptionEngineService for testing
class MockTranscriptionEngineService {
  async getCurrentEngine() {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'transcription_engine')
        .single();
      
      if (error) {
        console.warn('Error fetching transcription engine setting:', error);
        return 'azure'; // Default to Azure
      }
      
      if (data && data.value) {
        return data.value;
      }
      
      return 'azure'; // Default to Azure
    } catch (error) {
      console.error('Error getting transcription engine:', error);
      return 'azure'; // Default to Azure
    }
  }

  async setEngine(engine) {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'transcription_engine', value: engine }, { onConflict: 'key' });
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ Engine set to: ${engine}`);
    } catch (error) {
      console.error('Error setting transcription engine:', error);
      throw error;
    }
  }
}

// Test functions
async function testEngineConfiguration() {
  console.log('\n📋 Test 1: Engine Configuration');
  
  const engineService = new MockTranscriptionEngineService();
  
  try {
    // Get current engine
    const currentEngine = await engineService.getCurrentEngine();
    console.log('Current engine:', currentEngine);
    
    // Test setting to Hugging Face
    console.log('\n🔄 Setting engine to Hugging Face...');
    await engineService.setEngine('huggingface');
    const newEngine = await engineService.getCurrentEngine();
    console.log('New engine:', newEngine);
    
    // Test setting back to Azure
    console.log('\n🔄 Setting engine back to Azure...');
    await engineService.setEngine('azure');
    const resetEngine = await engineService.getCurrentEngine();
    console.log('Reset engine:', resetEngine);
    
    return { success: true, currentEngine, newEngine, resetEngine };
  } catch (error) {
    console.error('❌ Engine configuration test failed:', error);
    return { success: false, error: error.message };
  }
}

async function testEnginePersistence() {
  console.log('\n📋 Test 2: Engine Persistence');
  
  const engineService = new MockTranscriptionEngineService();
  
  try {
    // Set to Hugging Face
    await engineService.setEngine('huggingface');
    
    // Create a new instance to test persistence
    const newEngineService = new MockTranscriptionEngineService();
    const persistedEngine = await newEngineService.getCurrentEngine();
    
    console.log('Persisted engine:', persistedEngine);
    
    if (persistedEngine === 'huggingface') {
      console.log('✅ Engine setting persisted correctly');
      return { success: true, persistedEngine };
    } else {
      console.log('❌ Engine setting not persisted correctly');
      return { success: false, persistedEngine };
    }
  } catch (error) {
    console.error('❌ Engine persistence test failed:', error);
    return { success: false, error: error.message };
  }
}

async function testEngineSwitching() {
  console.log('\n📋 Test 3: Engine Switching');
  
  const engineService = new MockTranscriptionEngineService();
  
  try {
    const engines = ['azure', 'huggingface', 'azure', 'huggingface'];
    const results = [];
    
    for (let i = 0; i < engines.length; i++) {
      const engine = engines[i];
      console.log(`\n🔄 Switching to ${engine} (${i + 1}/${engines.length})...`);
      
      await engineService.setEngine(engine);
      const currentEngine = await engineService.getCurrentEngine();
      
      console.log(`Current engine after switch: ${currentEngine}`);
      
      if (currentEngine === engine) {
        console.log(`✅ Successfully switched to ${engine}`);
        results.push({ engine, success: true });
      } else {
        console.log(`❌ Failed to switch to ${engine}`);
        results.push({ engine, success: false, expected: engine, actual: currentEngine });
      }
      
      // Wait a bit between switches
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`\n📊 Engine switching results: ${successCount}/${results.length} successful`);
    
    return { success: successCount === results.length, results };
  } catch (error) {
    console.error('❌ Engine switching test failed:', error);
    return { success: false, error: error.message };
  }
}

async function testDatabaseConnection() {
  console.log('\n📋 Test 4: Database Connection');
  
  try {
    // Test basic database connection
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('key', 'transcription_engine')
      .single();
    
    if (error) {
      console.log('❌ Database connection test failed:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ Database connection successful');
    console.log('Current transcription_engine setting:', data);
    
    return { success: true, data };
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runEngineSelectionTests() {
  console.log('🚀 Starting Transcription Engine Selection Tests...\n');
  
  const results = {
    databaseConnection: await testDatabaseConnection(),
    engineConfiguration: await testEngineConfiguration(),
    enginePersistence: await testEnginePersistence(),
    engineSwitching: await testEngineSwitching()
  };
  
  // Summary
  console.log('\n📊 Engine Selection Test Results Summary:');
  console.log('==========================================');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  // Detailed results
  console.log('\n📋 Detailed Results:');
  Object.entries(results).forEach(([testName, result]) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${testName}: ${result.success ? 'PASSED' : 'FAILED'}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    if (testName === 'engineSwitching' && result.results) {
      result.results.forEach((switchResult, index) => {
        const switchStatus = switchResult.success ? '✅' : '❌';
        console.log(`   ${switchStatus} Switch ${index + 1}: ${switchResult.engine}`);
      });
    }
  });
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (results.databaseConnection.success) {
    console.log('✅ Database connection is working properly');
  } else {
    console.log('❌ Database connection has issues');
  }
  
  if (results.engineConfiguration.success) {
    console.log('✅ Engine configuration is working properly');
  } else {
    console.log('❌ Engine configuration has issues');
  }
  
  if (results.enginePersistence.success) {
    console.log('✅ Engine settings are being persisted correctly');
  } else {
    console.log('❌ Engine settings are not being persisted');
  }
  
  if (results.engineSwitching.success) {
    console.log('✅ Engine switching is working properly');
  } else {
    console.log('❌ Engine switching has issues');
  }
  
  console.log('\n🎉 Transcription Engine Selection testing completed!');
  console.log('\n📝 Next Steps:');
  console.log('1. Check the admin panel to see if the engine selector is working');
  console.log('2. Test live translation with different engines selected');
  console.log('3. Verify that the correct engine is being used for transcription');
}

// Run the tests
runEngineSelectionTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
}); 