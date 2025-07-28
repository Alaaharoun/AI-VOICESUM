// Test script to identify the state update issue in admin panel
// This simulates the exact timing issue that might be happening

const fetch = require('node-fetch');

// Simulate the exact admin panel logic
class MockAdminPanel {
  constructor() {
    this.transcriptionEngine = 'azure'; // Initial state
    this.engineStatus = null;
  }

  setTranscriptionEngine(engine) {
    console.log(`🔄 Setting transcription engine to: ${engine}`);
    this.transcriptionEngine = engine;
  }

  setEngineStatus(status) {
    console.log(`🔄 Setting engine status:`, status);
    this.engineStatus = status;
  }

  async fetchTranscriptionEngine() {
    console.log('📋 fetchTranscriptionEngine called');
    
    try {
      // Simulate database fetch
      const mockData = { value: 'huggingface' }; // Assume it's set to huggingface
      
      if (mockData && mockData.value) {
        this.setTranscriptionEngine(mockData.value);
        console.log(`✅ Engine set to: ${this.transcriptionEngine}`);
      }
      
      // Fetch engine status - THIS IS WHERE THE ISSUE MIGHT BE
      console.log('🔄 About to call fetchEngineStatus...');
      await this.fetchEngineStatus();
      
    } catch (error) {
      console.error('❌ Error in fetchTranscriptionEngine:', error);
    }
  }

  async fetchEngineStatus() {
    console.log('📋 fetchEngineStatus called');
    console.log(`Current transcriptionEngine state: ${this.transcriptionEngine}`);
    
    try {
      const status = await this.transcriptionEngineServiceGetEngineStatus();
      this.setEngineStatus(status);
    } catch (error) {
      console.error('❌ Error fetching engine status:', error);
      this.setEngineStatus({
        engine: this.transcriptionEngine,
        configured: false,
        status: 'error',
        message: 'Failed to check engine status'
      });
    }
  }

  async transcriptionEngineServiceGetEngineStatus() {
    console.log('📋 transcriptionEngineService.getEngineStatus called');
    console.log(`Current engine in service: ${this.transcriptionEngine}`);
    
    // Simulate the exact service logic
    const config = {
      engine: this.transcriptionEngine,
      huggingFaceUrl: 'https://alaaharoun-faster-whisper-api.hf.space'
    };
    
    const configured = !!(config.huggingFaceUrl && config.huggingFaceUrl.trim() !== '');
    
    if (!configured) {
      return {
        engine: config.engine,
        configured: false,
        status: 'not_configured',
        message: 'Hugging Face URL not configured'
      };
    }

    // Test the engine connectivity
    try {
      console.log(`🔍 Testing ${config.engine} connectivity...`);
      console.log(`URL: ${config.huggingFaceUrl}/health`);
      
      const response = await fetch(`${config.huggingFaceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      
      console.log(`Response Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Health check successful:', data);
        
        return {
          engine: config.engine,
          configured: true,
          status: 'ready',
          message: 'Hugging Face service is ready'
        };
      } else {
        const errorText = await response.text();
        console.log('❌ Health check failed:', errorText);
        
        return {
          engine: config.engine,
          configured: true,
          status: 'error',
          message: `Hugging Face service error: ${response.status}`
        };
      }
    } catch (error) {
      console.log('❌ Fetch error:', error.message);
      
      return {
        engine: config.engine,
        configured: true,
        status: 'error',
        message: `Service error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Simulate the button click
  async handleSaveTranscriptionEngine() {
    console.log('🔄 handleSaveTranscriptionEngine called');
    console.log(`Current engine: ${this.transcriptionEngine}`);
    
    try {
      // Simulate database save
      console.log('✅ Database save successful');
      
      // Update engine status immediately without external API call
      console.log('🔄 Updating local engine status...');
      this.setEngineStatus({
        engine: this.transcriptionEngine,
        configured: true,
        status: 'ready',
        message: `Engine switched to ${this.transcriptionEngine === 'azure' ? 'Azure Speech' : 'Faster Whisper'}`
      });
      
      console.log('✅ Save operation completed successfully');
      
    } catch (err) {
      console.error('❌ Save operation failed:', err);
    }
  }
}

// Test scenarios
async function testScenario1() {
  console.log('\n🔬 Scenario 1: Normal Flow (as it should work)');
  console.log('==============================================');
  
  const admin = new MockAdminPanel();
  
  // Simulate the exact flow
  console.log('1. Initial state:', admin.transcriptionEngine);
  
  console.log('\n2. Calling fetchTranscriptionEngine...');
  await admin.fetchTranscriptionEngine();
  
  console.log('\n3. Final state:');
  console.log('Engine:', admin.transcriptionEngine);
  console.log('Status:', admin.engineStatus);
}

async function testScenario2() {
  console.log('\n🔬 Scenario 2: State Update Issue (potential problem)');
  console.log('=====================================================');
  
  const admin = new MockAdminPanel();
  
  // Simulate the problem: fetchEngineStatus is called before state is updated
  console.log('1. Initial state:', admin.transcriptionEngine);
  
  console.log('\n2. Setting engine to huggingface...');
  admin.setTranscriptionEngine('huggingface');
  
  console.log('\n3. Calling fetchEngineStatus directly...');
  await admin.fetchEngineStatus();
  
  console.log('\n4. Final state:');
  console.log('Engine:', admin.transcriptionEngine);
  console.log('Status:', admin.engineStatus);
}

async function testScenario3() {
  console.log('\n🔬 Scenario 3: Async State Update Issue');
  console.log('=======================================');
  
  const admin = new MockAdminPanel();
  
  console.log('1. Initial state:', admin.transcriptionEngine);
  
  // Simulate async state update issue
  console.log('\n2. Starting async operations...');
  
  // This simulates the potential race condition
  const promises = [
    (async () => {
      console.log('   - Setting engine to huggingface...');
      admin.setTranscriptionEngine('huggingface');
    })(),
    (async () => {
      console.log('   - Calling fetchEngineStatus...');
      await admin.fetchEngineStatus();
    })()
  ];
  
  await Promise.all(promises);
  
  console.log('\n3. Final state:');
  console.log('Engine:', admin.transcriptionEngine);
  console.log('Status:', admin.engineStatus);
}

// Run all scenarios
async function runAllScenarios() {
  console.log('🚀 Testing Admin Panel State Management...\n');
  
  await testScenario1();
  await testScenario2();
  await testScenario3();
  
  console.log('\n📊 Analysis:');
  console.log('============');
  console.log('If Scenario 1 shows "huggingface" but Scenario 2/3 show "azure",');
  console.log('then there is a state update timing issue in the admin panel.');
}

if (require.main === module) {
  runAllScenarios().catch(console.error);
}

module.exports = {
  MockAdminPanel,
  testScenario1,
  testScenario2,
  testScenario3,
  runAllScenarios
}; 