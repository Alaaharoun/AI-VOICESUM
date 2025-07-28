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
        return 'huggingface'; // Default to Hugging Face for testing
      }
      
      if (data && data.value) {
        return data.value;
      }
      
      return 'huggingface'; // Default to Hugging Face for testing
    } catch (error) {
      console.error('Error getting transcription engine:', error.message);
      return 'huggingface'; // Default to Hugging Face for testing
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
        webSocketUrl: 'wss://ai-voicesum.onrender.com/ws'
      };
    }
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

// Test function
async function testHuggingFaceTranscription() {
  console.log('🧪 Starting Hugging Face transcription test...\n');

  try {
    // Create a mock audio blob (simulating real audio data)
    const mockAudioData = new ArrayBuffer(1024); // 1KB of mock data
    const mockAudioBlob = new Blob([mockAudioData], { type: 'audio/wav' });

    console.log('📝 Test 1: Basic transcription test');
    console.log('=' .repeat(50));
    
    const result = await MockSpeechService.transcribeAudio(mockAudioBlob, 'ar');
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