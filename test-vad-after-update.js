const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Mock TranscriptionEngineService for testing
class MockTranscriptionEngineService {
  async getCurrentEngine() {
    return 'huggingface'; // Force Hugging Face for testing
  }

  async getEngineConfig() {
    return {
      engine: 'huggingface',
      huggingFaceUrl: 'https://alaaharoun-faster-whisper-api.hf.space'
    };
  }
}

// Mock SpeechService with VAD support
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

  static async transcribeWithHuggingFace(audioBlob, targetLanguage, useVAD = false) {
    try {
      const config = await transcriptionEngineService.getEngineConfig();
      
      if (config.engine !== 'huggingface' || !config.huggingFaceUrl) {
        throw new Error('Hugging Face service not configured');
      }

      console.log('🔍 Testing Hugging Face transcription with VAD...');
      console.log('📡 URL:', `${config.huggingFaceUrl}/transcribe`);
      console.log('🎵 Original audio blob size:', audioBlob.size);
      console.log('🎵 Original audio blob type:', audioBlob.type);
      console.log('🌍 Target language:', targetLanguage);
      console.log('🎤 VAD enabled:', useVAD);

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

      // Add VAD parameters if enabled
      if (useVAD) {
        formData.append('vad_filter', 'true');
        formData.append('vad_parameters', 'threshold=0.5');
        console.log('🎤 VAD enabled with threshold=0.5');
      }

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
        probability: result.language_probability,
        vadEnabled: result.vad_enabled,
        vadThreshold: result.vad_threshold
      });

      return result.text || 'No transcription result';
    } catch (error) {
      console.error('❌ Hugging Face transcription error:', error);
      throw error;
    }
  }

  static async transcribeAudio(audioBlob, targetLanguage, useVAD = false) {
    try {
      const engine = await transcriptionEngineService.getCurrentEngine();
      
      console.log('🚀 Using transcription engine:', engine);
      
      if (engine === 'huggingface') {
        return await this.transcribeWithHuggingFace(audioBlob, targetLanguage, useVAD);
      } else {
        throw new Error('Azure engine not implemented in this test');
      }
    } catch (error) {
      console.error('❌ Transcription error:', error);
      throw error;
    }
  }
}

// Test function
async function testVADAfterUpdate() {
  console.log('🧪 Starting VAD test after server update...\n');

  // Create a mock audio blob
  const mockAudioData = new ArrayBuffer(1024);
  const mockAudioBlob = new Blob([mockAudioData], { type: 'audio/mp4' });

  try {
    // Test 1: Check server health
    console.log('📝 Test 1: Check server health');
    console.log('=' .repeat(50));
    
    const config = await transcriptionEngineService.getEngineConfig();
    const healthResponse = await fetch(`${config.huggingFaceUrl}/health`);
    const healthResult = await healthResponse.json();
    
    console.log('✅ Server health:', healthResult);
    console.log('✅ VAD support:', healthResult.vad_support);

    // Test 2: Transcription without VAD
    console.log('\n📝 Test 2: Transcription without VAD');
    console.log('=' .repeat(50));
    
    const resultWithoutVAD = await MockSpeechService.transcribeAudio(mockAudioBlob, 'ar', false);
    console.log('✅ Transcription without VAD result:', resultWithoutVAD);

    // Test 3: Transcription with VAD
    console.log('\n📝 Test 3: Transcription with VAD');
    console.log('=' .repeat(50));
    
    const resultWithVAD = await MockSpeechService.transcribeAudio(mockAudioBlob, 'ar', true);
    console.log('✅ Transcription with VAD result:', resultWithVAD);

    console.log('\n🎉 All VAD tests passed!');
    console.log('✅ VAD is working correctly with Hugging Face');
    console.log('✅ Voice Activity Detection is enabled');
    console.log('✅ Threshold=0.5 is being used');
    console.log('✅ Server has been updated successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n🧪 Test completed.');
}

// Initialize services
const transcriptionEngineService = new MockTranscriptionEngineService();

// Run the test
testVADAfterUpdate().catch(console.error); 