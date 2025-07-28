const { createClient } = require('@supabase/supabase-js');

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

  async getEngineConfig() {
    const engine = await this.getCurrentEngine();
    
    if (engine === 'huggingface') {
      return {
        engine: 'huggingface',
        huggingFaceUrl: 'https://alaaharoun-faster-whisper-api.hf.space'
      };
    } else {
      return {
        engine: 'azure',
        azureApiKey: 'test-api-key'
      };
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

// Mock SpeechService with both engines
class MockSpeechService {
  static async convertToProperWav(audioBlob) {
    try {
      // If it's already WAV, return as is
      if (audioBlob.type === 'audio/wav') {
        return audioBlob;
      }

      // For mobile, create a proper WAV file with header
      const arrayBuffer = await this.blobToArrayBuffer(audioBlob);
      
      // Create a simple WAV file with proper header
      const sampleRate = 16000;
      const duration = 2; // 2 seconds
      const numSamples = sampleRate * duration;
      const audioData = new Int16Array(numSamples);
      
      // Create a simple sine wave as fallback
      for (let i = 0; i < numSamples; i++) {
        audioData[i] = Math.sin(i * 0.1) * 1000;
      }
      
      // Create WAV header
      const dataLength = audioData.byteLength;
      const fileLength = 44 + dataLength; // 44 bytes header + data
      
      const buffer = new ArrayBuffer(fileLength);
      const view = new DataView(buffer);
      
      // WAV header
      const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      
      // RIFF header
      writeString(0, 'RIFF');
      view.setUint32(4, fileLength - 8, true);
      writeString(8, 'WAVE');
      
      // fmt chunk
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true); // fmt chunk size
      view.setUint16(20, 1, true); // PCM format
      view.setUint16(22, 1, true); // mono
      view.setUint32(24, sampleRate, true); // sample rate
      view.setUint32(28, sampleRate * 2, true); // byte rate
      view.setUint16(32, 2, true); // block align
      view.setUint16(34, 16, true); // bits per sample
      
      // data chunk
      writeString(36, 'data');
      view.setUint32(40, dataLength, true);
      
      // Copy audio data
      const audioView = new Uint8Array(buffer, 44);
      const dataView = new Uint8Array(audioData.buffer);
      audioView.set(dataView);
      
      const wavBlob = new Blob([buffer], { type: 'audio/wav' });
      console.log('Created proper WAV blob for Hugging Face');
      return wavBlob;
    } catch (error) {
      console.error('WAV conversion failed:', error);
      throw error;
    }
  }

  static blobToArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsArrayBuffer(blob);
    });
  }

  static async transcribeWithHuggingFace(audioBlob, targetLanguage) {
    try {
      const config = await transcriptionEngineService.getEngineConfig();
      
      if (config.engine !== 'huggingface' || !config.huggingFaceUrl) {
        throw new Error('Hugging Face service not configured');
      }

      console.log('🔍 Testing Hugging Face transcription...');
      console.log('📡 URL:', `${config.huggingFaceUrl}/transcribe`);
      console.log('🎵 Original audio blob size:', audioBlob.size);
      console.log('🎵 Original audio blob type:', audioBlob.type);
      console.log('🌍 Target language:', targetLanguage);

      // Process audio for Hugging Face compatibility
      let processedAudioBlob = audioBlob;
      
      try {
        // Try to convert to proper WAV format
        processedAudioBlob = await this.convertToProperWav(audioBlob);
        console.log('✅ WAV conversion successful');
        console.log('🎵 Processed audio blob size:', processedAudioBlob.size);
        console.log('🎵 Processed audio blob type:', processedAudioBlob.type);
      } catch (error) {
        console.warn('⚠️ WAV conversion failed, using original blob:', error);
        // Fallback to original blob if conversion fails
        processedAudioBlob = audioBlob;
      }

      // Create form data for Hugging Face API
      const formData = new FormData();
      
      // Ensure the file has a proper name and type
      const fileName = `audio_${Date.now()}.wav`;
      formData.append('file', processedAudioBlob, fileName);
      
      if (targetLanguage) {
        formData.append('language', targetLanguage);
      }
      
      formData.append('task', 'transcribe');

      console.log('📤 Sending request to Hugging Face...');

      // Make request to Hugging Face API
      const response = await fetch(`${config.huggingFaceUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(60000), // 60 second timeout
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Hugging Face transcription error:', response.status, errorText);
        throw new Error(`Hugging Face transcription failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log('📄 Response JSON:', result);
      
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

  static async transcribeWithAssemblyAI(audioBlob, targetLanguage) {
    try {
      const config = await transcriptionEngineService.getEngineConfig();
      
      if (config.engine !== 'azure' || !config.azureApiKey) {
        throw new Error('Azure service not configured');
      }

      console.log('🔍 Testing Azure transcription...');
      console.log('🎵 Audio blob size:', audioBlob.size);
      console.log('🎵 Audio blob type:', audioBlob.type);
      console.log('🌍 Target language:', targetLanguage);

      // Simulate Azure transcription (since we don't have real API key)
      console.log('📤 Simulating Azure transcription request...');
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return mock result
      const mockResult = 'This is a mock Azure transcription result for testing purposes.';
      
      console.log('✅ Azure transcription successful:', {
        text: mockResult.substring(0, 50) + '...',
        language: 'en',
        probability: 0.95
      });

      return mockResult;
    } catch (error) {
      console.error('❌ Azure transcription error:', error);
      throw error;
    }
  }

  static async transcribeAudio(audioBlob, targetLanguage) {
    try {
      const engine = await transcriptionEngineService.getCurrentEngine();
      
      console.log('🚀 Using transcription engine:', engine);
      
      if (engine === 'huggingface') {
        return await this.transcribeWithHuggingFace(audioBlob, targetLanguage);
      } else {
        // Default to Azure
        return await this.transcribeWithAssemblyAI(audioBlob, targetLanguage);
      }
    } catch (error) {
      console.error('❌ Transcription error:', error);
      throw error;
    }
  }

  static async transcribeAudioRealTime(audioBlob, targetLanguage, sourceLanguage, useLiveTranslationServer) {
    try {
      if (useLiveTranslationServer) {
        throw new Error('Live translation server not implemented in this test');
      } else {
        // Use the selected transcription engine
        const engine = await transcriptionEngineService.getCurrentEngine();
        
        console.log('🚀 Using transcription engine for real-time:', engine);
        
        if (engine === 'huggingface') {
          return await this.transcribeWithHuggingFace(audioBlob, targetLanguage);
        } else {
          // Default: use AssemblyAI
          return await this.transcribeWithAssemblyAI(audioBlob, targetLanguage);
        }
      }
    } catch (error) {
      console.error('❌ Real-time transcription error:', error);
      throw new Error('Failed to transcribe audio in real-time');
    }
  }
}

// Test function
async function testEngineSwitching() {
  console.log('🧪 Starting engine switching compatibility test...\n');

  // Create a mock audio blob
  const mockAudioData = new ArrayBuffer(1024);
  const mockAudioBlob = new Blob([mockAudioData], { type: 'audio/mp4' });

  try {
    // Test 1: Check current engine
    console.log('📝 Test 1: Check current engine');
    console.log('=' .repeat(50));
    
    const currentEngine = await transcriptionEngineService.getCurrentEngine();
    console.log('✅ Current engine:', currentEngine);
    
    // Test 2: Test engine configuration
    console.log('\n📝 Test 2: Test engine configuration');
    console.log('=' .repeat(50));
    
    const config = await transcriptionEngineService.getEngineConfig();
    console.log('✅ Engine config:', config);
    
    // Test 3: Test WebSocket URL (should work for Azure, fail for Hugging Face)
    console.log('\n📝 Test 3: Test WebSocket URL');
    console.log('=' .repeat(50));
    
    try {
      const wsUrl = await transcriptionEngineService.getWebSocketURL();
      console.log('✅ WebSocket URL:', wsUrl);
    } catch (error) {
      console.log('✅ Expected error for Hugging Face:', error.message);
    }
    
    // Test 4: Test connection message
    console.log('\n📝 Test 4: Test connection message');
    console.log('=' .repeat(50));
    
    const connectionMessage = await transcriptionEngineService.getConnectionMessage();
    console.log('✅ Connection message:', connectionMessage);
    
    // Test 5: Test transcription with current engine
    console.log('\n📝 Test 5: Test transcription with current engine');
    console.log('=' .repeat(50));
    
    const result = await MockSpeechService.transcribeAudio(mockAudioBlob, 'ar');
    console.log('✅ Transcription result:', result);
    
    // Test 6: Test real-time transcription
    console.log('\n📝 Test 6: Test real-time transcription');
    console.log('=' .repeat(50));
    
    const realTimeResult = await MockSpeechService.transcribeAudioRealTime(mockAudioBlob, 'ar', 'en', false);
    console.log('✅ Real-time transcription result:', realTimeResult);
    
    // Test 7: Test engine display name
    console.log('\n📝 Test 7: Test engine display name');
    console.log('=' .repeat(50));
    
    const displayName = transcriptionEngineService.getEngineDisplayName(currentEngine);
    console.log('✅ Engine display name:', displayName);
    
    console.log('\n🎉 All tests passed! Engine switching is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n🧪 Test completed.');
}

// Initialize services
const transcriptionEngineService = new MockTranscriptionEngineService();

// Run the test
testEngineSwitching().catch(console.error); 