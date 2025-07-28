const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🔍 Testing Hugging Face Integration with Transcription Engine Service...');

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

  async getEngineStatus() {
    const engine = await this.getCurrentEngine();
    
    if (engine === 'huggingface') {
      try {
        const response = await fetch('https://alaaharoun-faster-whisper-api.hf.space/health', {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });
        
        if (response.ok) {
          return {
            engine: 'huggingface',
            configured: true,
            status: 'ready',
            message: 'Hugging Face service is ready'
          };
        } else {
          return {
            engine: 'huggingface',
            configured: true,
            status: 'error',
            message: `Hugging Face service error: ${response.status}`
          };
        }
      } catch (error) {
        return {
          engine: 'huggingface',
          configured: true,
          status: 'error',
          message: `Service error: ${error.message}`
        };
      }
    } else {
      return {
        engine: 'azure',
        configured: true,
        status: 'ready',
        message: 'Azure service is ready'
      };
    }
  }
}

// Create test audio data
function createTestWavAudio() {
  const sampleRate = 16000;
  const duration = 1; // 1 second
  const samples = sampleRate * duration;
  
  // WAV header (44 bytes)
  const header = Buffer.alloc(44);
  
  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + samples * 2, 4); // File size
  header.write('WAVE', 8);
  
  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // Audio format (PCM)
  header.writeUInt16LE(1, 22); // Number of channels (mono)
  header.writeUInt32LE(sampleRate, 24); // Sample rate
  header.writeUInt32LE(sampleRate * 2, 28); // Byte rate
  header.writeUInt16LE(2, 32); // Block align
  header.writeUInt16LE(16, 34); // Bits per sample
  
  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(samples * 2, 40); // Data size
  
  // Create audio data (sine wave at 440Hz)
  const audioData = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const value = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5 * 32767;
    audioData.writeInt16LE(Math.round(value), i * 2);
  }
  
  return Buffer.concat([header, audioData]);
}

// Mock SpeechService for testing
class MockSpeechService {
  static async transcribeWithHuggingFace(audioBlob, targetLanguage) {
    try {
      console.log('🎵 Transcribing with Hugging Face...', {
        size: audioBlob.length,
        targetLanguage
      });

      // Create form data for Hugging Face API
      const formData = new FormData();
      formData.append('file', new Blob([audioBlob], { type: 'audio/wav' }), 'audio.wav');
      
      if (targetLanguage) {
        formData.append('language', targetLanguage);
      }
      
      formData.append('task', 'transcribe');

      // Make request to Hugging Face API
      const response = await fetch('https://alaaharoun-faster-whisper-api.hf.space/transcribe', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(60000), // 60 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Hugging Face transcription error:', response.status, errorText);
        throw new Error(`Hugging Face transcription failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Hugging Face transcription failed');
      }

      console.log('✅ Hugging Face transcription successful:', {
        text: result.text?.substring(0, 100) + '...',
        language: result.language,
        probability: result.language_probability
      });

      return result.text || 'No transcription result';
    } catch (error) {
      console.error('❌ Hugging Face transcription error:', error);
      throw error;
    }
  }

  static async transcribeAudio(audioBlob, targetLanguage) {
    const engineService = new MockTranscriptionEngineService();
    const engine = await engineService.getCurrentEngine();
    
    console.log('🔧 Using transcription engine:', engine);
    
    if (engine === 'huggingface') {
      return await this.transcribeWithHuggingFace(audioBlob, targetLanguage);
    } else {
      throw new Error('Azure transcription not implemented in this test');
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
    
    // Set to Hugging Face
    await engineService.setEngine('huggingface');
    const newEngine = await engineService.getCurrentEngine();
    console.log('New engine:', newEngine);
    
    // Reset to Azure
    await engineService.setEngine('azure');
    const resetEngine = await engineService.getCurrentEngine();
    console.log('Reset engine:', resetEngine);
    
    return { success: true, currentEngine, newEngine, resetEngine };
  } catch (error) {
    console.error('❌ Engine configuration test failed:', error);
    return { success: false, error: error.message };
  }
}

async function testEngineStatus() {
  console.log('\n📋 Test 2: Engine Status');
  
  const engineService = new MockTranscriptionEngineService();
  
  try {
    // Test Azure status
    await engineService.setEngine('azure');
    const azureStatus = await engineService.getEngineStatus();
    console.log('Azure status:', azureStatus);
    
    // Test Hugging Face status
    await engineService.setEngine('huggingface');
    const hfStatus = await engineService.getEngineStatus();
    console.log('Hugging Face status:', hfStatus);
    
    return { success: true, azureStatus, hfStatus };
  } catch (error) {
    console.error('❌ Engine status test failed:', error);
    return { success: false, error: error.message };
  }
}

async function testHuggingFaceTranscription() {
  console.log('\n📋 Test 3: Hugging Face Transcription');
  
  try {
    const testAudio = createTestWavAudio();
    
    // Set engine to Hugging Face
    const engineService = new MockTranscriptionEngineService();
    await engineService.setEngine('huggingface');
    
    // Test transcription
    const startTime = Date.now();
    const transcription = await MockSpeechService.transcribeAudio(testAudio, 'en');
    const duration = Date.now() - startTime;
    
    console.log(`✅ Transcription completed in ${duration}ms:`, transcription);
    
    return { success: true, transcription, duration };
  } catch (error) {
    console.error('❌ Hugging Face transcription test failed:', error);
    return { success: false, error: error.message };
  }
}

async function testLanguageSpecificTranscription() {
  console.log('\n📋 Test 4: Language-Specific Transcription');
  
  const engineService = new MockTranscriptionEngineService();
  await engineService.setEngine('huggingface');
  
  const languages = ['en', 'ar', 'es', 'fr'];
  const results = {};
  
  for (const language of languages) {
    try {
      console.log(`Testing ${language} transcription...`);
      const testAudio = createTestWavAudio();
      
      const startTime = Date.now();
      const transcription = await MockSpeechService.transcribeAudio(testAudio, language);
      const duration = Date.now() - startTime;
      
      results[language] = { success: true, transcription, duration };
      console.log(`✅ ${language}: ${duration}ms - ${transcription.substring(0, 50)}...`);
    } catch (error) {
      results[language] = { success: false, error: error.message };
      console.log(`❌ ${language}: ${error.message}`);
    }
  }
  
  return results;
}

async function testPerformanceComparison() {
  console.log('\n📋 Test 5: Performance Comparison');
  
  const engineService = new MockTranscriptionEngineService();
  await engineService.setEngine('huggingface');
  
  const testRuns = 3;
  const durations = [];
  
  for (let i = 0; i < testRuns; i++) {
    try {
      console.log(`Performance test run ${i + 1}/${testRuns}...`);
      const testAudio = createTestWavAudio();
      
      const startTime = Date.now();
      await MockSpeechService.transcribeAudio(testAudio, 'en');
      const duration = Date.now() - startTime;
      
      durations.push(duration);
      console.log(`Run ${i + 1}: ${duration}ms`);
    } catch (error) {
      console.log(`Run ${i + 1}: Failed - ${error.message}`);
    }
  }
  
  if (durations.length > 0) {
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    console.log(`📊 Performance Summary:`);
    console.log(`  Average: ${avgDuration.toFixed(0)}ms`);
    console.log(`  Min: ${minDuration}ms`);
    console.log(`  Max: ${maxDuration}ms`);
    
    return { success: true, durations, avgDuration, minDuration, maxDuration };
  } else {
    return { success: false, error: 'All performance tests failed' };
  }
}

// Main test runner
async function runIntegrationTests() {
  console.log('🚀 Starting Hugging Face Integration Tests...\n');
  
  const results = {
    engineConfiguration: await testEngineConfiguration(),
    engineStatus: await testEngineStatus(),
    huggingFaceTranscription: await testHuggingFaceTranscription(),
    languageSpecificTranscription: await testLanguageSpecificTranscription(),
    performanceComparison: await testPerformanceComparison()
  };
  
  // Summary
  console.log('\n📊 Integration Test Results Summary:');
  console.log('====================================');
  
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
    
    if (testName === 'languageSpecificTranscription' && result.success) {
      Object.entries(result).forEach(([lang, langResult]) => {
        if (lang !== 'success') {
          const langStatus = langResult.success ? '✅' : '❌';
          console.log(`   ${langStatus} ${lang}: ${langResult.success ? 'PASSED' : 'FAILED'}`);
        }
      });
    }
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  // Recommendations
  console.log('\n💡 Integration Recommendations:');
  
  if (results.engineConfiguration.success) {
    console.log('✅ Engine configuration is working properly');
  } else {
    console.log('❌ Engine configuration has issues');
  }
  
  if (results.huggingFaceTranscription.success) {
    console.log('✅ Hugging Face transcription integration is working');
  } else {
    console.log('❌ Hugging Face transcription integration has issues');
  }
  
  if (results.performanceComparison.success) {
    const avgDuration = results.performanceComparison.avgDuration;
    if (avgDuration < 10000) {
      console.log('✅ Performance is acceptable (< 10 seconds average)');
    } else {
      console.log('⚠️ Performance is slow (> 10 seconds average)');
    }
  } else {
    console.log('❌ Performance testing failed');
  }
  
  console.log('\n🎉 Hugging Face Integration testing completed!');
}

// Run the tests
runIntegrationTests().catch(error => {
  console.error('❌ Integration test runner error:', error);
  process.exit(1);
}); 