// Test script to verify the admin panel connection to Hugging Face API
// This simulates the exact same code used in the admin panel

const fetch = require('node-fetch');

// Simulate the TranscriptionEngineService logic
class MockTranscriptionEngineService {
  constructor() {
    this.currentEngine = 'huggingface';
  }

  async getEngineConfig() {
    return {
      engine: 'huggingface',
      huggingFaceUrl: 'https://alaaharoun-faster-whisper-api.hf.space'
    };
  }

  async isEngineConfigured() {
    const config = await this.getEngineConfig();
    return !!(config.huggingFaceUrl && config.huggingFaceUrl.trim() !== '');
  }

  async getEngineStatus() {
    const config = await this.getEngineConfig();
    const configured = await this.isEngineConfigured();
    
    if (!configured) {
      return {
        engine: config.engine,
        configured: false,
        status: 'not_configured',
        message: 'Hugging Face URL not configured'
      };
    }

    // Test the engine connectivity - EXACT SAME CODE AS IN THE APP
    try {
      console.log('🔍 Testing Hugging Face connectivity...');
      console.log(`URL: ${config.huggingFaceUrl}/health`);
      
      const response = await fetch(`${config.huggingFaceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      console.log(`Response Status: ${response.status} ${response.statusText}`);
      console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('Response Data:', JSON.stringify(data, null, 2));
        
        return {
          engine: config.engine,
          configured: true,
          status: 'ready',
          message: 'Hugging Face service is ready'
        };
      } else {
        const errorText = await response.text();
        console.log('Error Response:', errorText);
        
        return {
          engine: config.engine,
          configured: true,
          status: 'error',
          message: `Hugging Face service error: ${response.status}`
        };
      }
    } catch (error) {
      console.log('Fetch Error:', error.message);
      console.log('Error Type:', error.constructor.name);
      
      return {
        engine: config.engine,
        configured: true,
        status: 'error',
        message: `Service error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Test function
async function testAdminConnection() {
  console.log('🚀 Testing Admin Panel Connection to Hugging Face API...\n');
  
  const service = new MockTranscriptionEngineService();
  
  try {
    // Test 1: Check if engine is configured
    console.log('📋 Test 1: Engine Configuration');
    const configured = await service.isEngineConfigured();
    console.log(`Engine configured: ${configured ? '✅ Yes' : '❌ No'}\n`);
    
    // Test 2: Get engine status (this is what the admin panel calls)
    console.log('📋 Test 2: Engine Status Check');
    const status = await service.getEngineStatus();
    console.log('Status Result:');
    console.log(JSON.stringify(status, null, 2));
    console.log();
    
    // Test 3: Simulate the exact admin panel logic
    console.log('📋 Test 3: Simulating Admin Panel Logic');
    console.log('This is exactly what happens when you click "Faster Whisper" in admin panel:');
    
    const config = await service.getEngineConfig();
    console.log(`Selected Engine: ${config.engine}`);
    console.log(`Hugging Face URL: ${config.huggingFaceUrl}`);
    
    if (config.engine === 'huggingface') {
      console.log('✅ Engine is set to Hugging Face');
      console.log('🔄 Checking service health...');
      
      const healthResponse = await fetch(`${config.huggingFaceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      
      console.log(`Health Check Status: ${healthResponse.status}`);
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log('✅ Health check successful:');
        console.log(JSON.stringify(healthData, null, 2));
        console.log('\n🎉 The admin panel should show: "Faster Whisper: Hugging Face service is ready"');
      } else {
        console.log('❌ Health check failed');
        console.log('\n⚠️ The admin panel should show an error status');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Test with different scenarios
async function testDifferentScenarios() {
  console.log('\n🔬 Testing Different Scenarios...\n');
  
  // Scenario 1: Normal connection
  console.log('📋 Scenario 1: Normal Connection');
  await testAdminConnection();
  
  // Scenario 2: Test with wrong URL
  console.log('\n📋 Scenario 2: Wrong URL Test');
  const wrongService = new MockTranscriptionEngineService();
  wrongService.getEngineConfig = async () => ({
    engine: 'huggingface',
    huggingFaceUrl: 'https://wrong-url-that-does-not-exist.com'
  });
  
  try {
    const status = await wrongService.getEngineStatus();
    console.log('Status with wrong URL:');
    console.log(JSON.stringify(status, null, 2));
  } catch (error) {
    console.log('Error with wrong URL:', error.message);
  }
  
  // Scenario 3: Test timeout
  console.log('\n📋 Scenario 3: Timeout Test');
  try {
    const response = await fetch('https://alaaharoun-faster-whisper-api.hf.space/health', {
      method: 'GET',
      signal: AbortSignal.timeout(1000), // 1 second timeout
    });
    console.log('Timeout test result:', response.status);
  } catch (error) {
    console.log('Timeout test error:', error.message);
  }
}

// Run tests
if (require.main === module) {
  testDifferentScenarios().catch(console.error);
}

module.exports = {
  testAdminConnection,
  testDifferentScenarios,
  MockTranscriptionEngineService
}; 