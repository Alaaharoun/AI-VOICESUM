const { createClient } = require('@supabase/supabase-js');

console.log('🔧 Testing WebSocket Fix for Hugging Face');

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

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
        console.warn('Error fetching transcription engine setting:', error.message);
        return 'azure'; // Default to Azure
      }
      
      if (data && data.value) {
        return data.value;
      }
      
      return 'azure'; // Default to Azure
    } catch (error) {
      console.error('Error getting transcription engine:', error.message);
      return 'azure'; // Default to Azure
    }
  }

  async getWebSocketURL() {
    const engine = await this.getCurrentEngine();
    
    if (engine === 'huggingface') {
      throw new Error('Hugging Face engine does not use WebSocket connections');
    } else {
      return 'wss://ai-voicesum.onrender.com/ws';
    }
  }

  async getConnectionMessage() {
    const engine = await this.getCurrentEngine();
    
    if (engine === 'huggingface') {
      return 'Connecting to Faster Whisper...';
    } else {
      return 'Connecting to Azure Speech...';
    }
  }

  getEngineDisplayName(engine) {
    switch (engine) {
      case 'azure':
        return 'Azure Speech';
      case 'huggingface':
        return 'Faster Whisper';
      default:
        return 'Unknown Engine';
    }
  }
}

// Simulate the app's WebSocket initialization logic
async function simulateWebSocketInitialization() {
  console.log('\n🧪 Simulating WebSocket initialization...');
  
  const transcriptionEngineService = new MockTranscriptionEngineService();
  
  try {
    // Get current engine
    const engine = await transcriptionEngineService.getCurrentEngine();
    console.log(`✅ Current engine: ${engine}`);
    
    if (engine === 'huggingface') {
      console.log('🔄 Hugging Face engine detected - using HTTP API instead of WebSocket');
      console.log('✅ No WebSocket connection needed for Hugging Face');
      return { success: true, message: 'HTTP API mode' };
    } else {
      // Azure uses WebSocket
      const wsUrl = await transcriptionEngineService.getWebSocketURL();
      console.log(`✅ WebSocket URL: ${wsUrl}`);
      console.log('✅ Azure engine detected - WebSocket connection would be created');
      return { success: true, message: 'WebSocket mode' };
    }
    
  } catch (error) {
    console.warn('⚠️ Error getting engine config:', error.message);
    
    // Fallback: check engine again
    try {
      const fallbackEngine = await transcriptionEngineService.getCurrentEngine();
      if (fallbackEngine === 'huggingface') {
        console.log('🔄 Fallback: Hugging Face engine detected - using HTTP API instead of WebSocket');
        return { success: true, message: 'HTTP API mode (fallback)' };
      }
    } catch (fallbackError) {
      console.warn('⚠️ Fallback engine check failed:', fallbackError.message);
    }
    
    // Only if not Hugging Face, use default WebSocket
    console.log('⚠️ Using default WebSocket as fallback');
    return { success: true, message: 'WebSocket mode (fallback)' };
  }
}

// Test different scenarios
async function testDifferentScenarios() {
  console.log('\n🌍 Testing different scenarios...');
  
  // Test 1: Current engine setting
  console.log('\n1️⃣ Testing current engine setting...');
  const result1 = await simulateWebSocketInitialization();
  console.log(`   Result: ${result1.message}`);
  
  // Test 2: Simulate error scenario
  console.log('\n2️⃣ Testing error scenario...');
  const originalGetCurrentEngine = MockTranscriptionEngineService.prototype.getCurrentEngine;
  MockTranscriptionEngineService.prototype.getCurrentEngine = async () => {
    throw new Error('Simulated error');
  };
  
  const result2 = await simulateWebSocketInitialization();
  console.log(`   Result: ${result2.message}`);
  
  // Restore original function
  MockTranscriptionEngineService.prototype.getCurrentEngine = originalGetCurrentEngine;
  
  // Test 3: Test with different engine settings
  console.log('\n3️⃣ Testing with different engine settings...');
  
  // Temporarily override to test Hugging Face
  const originalGetCurrentEngine2 = MockTranscriptionEngineService.prototype.getCurrentEngine;
  MockTranscriptionEngineService.prototype.getCurrentEngine = async () => 'huggingface';
  
  const result3 = await simulateWebSocketInitialization();
  console.log(`   Result: ${result3.message}`);
  
  // Restore original function
  MockTranscriptionEngineService.prototype.getCurrentEngine = originalGetCurrentEngine2;
}

// Main execution
async function runTests() {
  console.log('🚀 Starting WebSocket Fix Tests...\n');
  
  try {
    await simulateWebSocketInitialization();
    await testDifferentScenarios();
    
    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log('✅ All tests completed');
    console.log('📝 Check results above for WebSocket behavior');
    console.log('🔧 If tests pass, the fix should work correctly');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests(); 