const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Mock TranscriptionEngineService for testing
class MockTranscriptionEngineService {
  async getCurrentEngine() {
    return 'huggingface'; // Default to Hugging Face for testing
  }

  async getEngineConfig() {
    return {
      engine: 'huggingface',
      huggingFaceUrl: 'https://alaaharoun-faster-whisper-api.hf.space'
    };
  }
}

// Mock SpeechService for testing
class MockSpeechService {
  static async transcribeWithHuggingFace(audioBlob, targetLanguage) {
    try {
      const config = await transcriptionEngineService.getEngineConfig();
      
      if (config.engine !== 'huggingface' || !config.huggingFaceUrl) {
        throw new Error('Hugging Face service not configured');
      }

      console.log('🔍 Testing Hugging Face transcription...');
      console.log('📡 URL:', `${config.huggingFaceUrl}/transcribe`);
      console.log('🎵 Audio blob size:', audioBlob.size);
      console.log('🎵 Audio blob type:', audioBlob.type);
      console.log('🌍 Target language:', targetLanguage);

      // Create form data
      const formData = new FormData();
      const fileName = `audio_${Date.now()}.wav`;
      formData.append('file', audioBlob, fileName);
      
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
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

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

  static async transcribeAudio(audioBlob, targetLanguage) {
    try {
      const engine = await transcriptionEngineService.getCurrentEngine();
      
      console.log('🚀 Using transcription engine:', engine);
      
      if (engine === 'huggingface') {
        return await this.transcribeWithHuggingFace(audioBlob, targetLanguage);
      } else {
        throw new Error('Azure engine not implemented in this test');
      }
    } catch (error) {
      console.error('❌ Transcription error:', error);
      throw error;
    }
  }
}

// Function to create a proper WAV file
function createWavFile(sampleRate = 16000, duration = 2) {
  const numSamples = sampleRate * duration;
  const audioData = new Int16Array(numSamples);
  
  // Create a simple sine wave
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
  
  return new Blob([buffer], { type: 'audio/wav' });
}

// Test function
async function testHuggingFaceTranscription() {
  console.log('🧪 Starting Hugging Face transcription test with real audio...\n');

  try {
    // Create a proper WAV file
    console.log('🎵 Creating proper WAV audio file...');
    const audioBlob = createWavFile(16000, 2); // 2 seconds of audio
    
    console.log('📝 Test 1: Transcription with proper WAV file');
    console.log('=' .repeat(50));
    
    const result = await MockSpeechService.transcribeAudio(audioBlob, 'ar');
    console.log('✅ Test 1 passed! Result:', result);

  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
    
    // Additional debugging
    if (error.message.includes('fetch')) {
      console.log('🔍 Network error detected. Checking connectivity...');
      
      // Test basic connectivity
      try {
        const healthResponse = await fetch('https://alaaharoun-faster-whisper-api.hf.space/health');
        console.log('🏥 Health check status:', healthResponse.status);
        
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          console.log('🏥 Health check data:', healthData);
        }
      } catch (healthError) {
        console.error('❌ Health check failed:', healthError.message);
      }
    }
  }

  console.log('\n🧪 Test completed.');
}

// Initialize services
const transcriptionEngineService = new MockTranscriptionEngineService();

// Run the test
testHuggingFaceTranscription().catch(console.error); 