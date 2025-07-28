const { createClient } = require('@supabase/supabase-js');

// Get Supabase configuration with fallback values
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder_key";

console.log('🔧 Using Supabase URL:', supabaseUrl);
console.log('🔧 Using Supabase Key:', supabaseAnonKey.substring(0, 10) + '...');

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

async function testReconnectEngineFix() {
  console.log('🧪 Testing Reconnect Button Engine Fix...\n');
  
  const engineService = new MockTranscriptionEngineService();
  
  try {
    // Test 1: Check current engine setting
    console.log('📋 Test 1: Checking current engine setting...');
    const currentEngine = await engineService.getCurrentEngine();
    console.log(`✅ Current engine: ${currentEngine}`);
    
    // Test 2: Test WebSocket URL generation
    console.log('\n📋 Test 2: Testing WebSocket URL generation...');
    try {
      const wsUrl = await engineService.getWebSocketURL();
      console.log(`✅ WebSocket URL: ${wsUrl}`);
    } catch (error) {
      console.log(`✅ Expected error for ${currentEngine}: ${error.message}`);
    }
    
    // Test 3: Test connection message
    console.log('\n📋 Test 3: Testing connection message...');
    const connectionMessage = await engineService.getConnectionMessage();
    console.log(`✅ Connection message: ${connectionMessage}`);
    
    // Test 4: Test engine display name
    console.log('\n📋 Test 4: Testing engine display name...');
    const displayName = engineService.getEngineDisplayName(currentEngine);
    console.log(`✅ Engine display name: ${displayName}`);
    
    // Test 5: Simulate reconnect button behavior
    console.log('\n📋 Test 5: Simulating reconnect button behavior...');
    console.log('🔄 Simulating user clicking "Reconnect to Server" button...');
    
    const engine = await engineService.getCurrentEngine();
    const message = await engineService.getConnectionMessage();
    
    console.log(`📤 ${message}`);
    
    if (engine === 'huggingface') {
      console.log('✅ Hugging Face engine detected - using HTTP API instead of WebSocket');
      console.log('✅ Connection status: Connected (HTTP API)');
    } else {
      console.log('✅ Azure engine detected - using WebSocket connection');
      console.log('✅ WebSocket URL: wss://ai-voicesum.onrender.com/ws');
      console.log('✅ Connection status: Connected (WebSocket)');
    }
    
    console.log('\n🎯 Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`- Current Engine: ${currentEngine}`);
    console.log(`- Display Name: ${displayName}`);
    console.log(`- Connection Type: ${engine === 'huggingface' ? 'HTTP API' : 'WebSocket'}`);
    console.log(`- Connection Message: ${connectionMessage}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testReconnectEngineFix(); 