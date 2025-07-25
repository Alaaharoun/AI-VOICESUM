const speechsdk = require('microsoft-cognitiveservices-speech-sdk');
require('dotenv').config();

console.log('🔍 Testing Azure Speech SDK Server-side');

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;

console.log('Azure Speech Key available:', !!AZURE_SPEECH_KEY);
console.log('Azure Speech Region:', AZURE_SPEECH_REGION);

if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
  console.error('❌ Azure Speech credentials missing!');
  process.exit(1);
}

// Test 1: Basic Speech SDK initialization
console.log('\n📋 Test 1: Basic Speech SDK Configuration');
try {
  const speechConfig = speechsdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
  speechConfig.speechRecognitionLanguage = 'en-US';
  console.log('✅ Speech config created successfully');
  
  // Test audio format
  const audioFormat = speechsdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
  console.log('✅ Audio format created successfully');
  
  speechConfig.close();
  console.log('✅ Speech config closed successfully');
} catch (error) {
  console.error('❌ Basic Speech SDK test failed:', error.message);
}

// Test 2: Push stream creation
console.log('\n📋 Test 2: Push Stream Creation');
try {
  const audioFormat = speechsdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
  const pushStream = speechsdk.AudioInputStream.createPushStream(audioFormat);
  console.log('✅ Push stream created successfully');
  
  // Test writing data to stream
  const testData = Buffer.alloc(1600, 0); // 50ms of silence
  pushStream.write(testData);
  console.log('✅ Data written to push stream successfully');
  
  pushStream.close();
  console.log('✅ Push stream closed successfully');
} catch (error) {
  console.error('❌ Push stream test failed:', error.message);
}

// Test 3: Complete recognizer setup
console.log('\n📋 Test 3: Complete Recognizer Setup');
try {
  const speechConfig = speechsdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
  speechConfig.speechRecognitionLanguage = 'en-US';
  
  const audioFormat = speechsdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
  const pushStream = speechsdk.AudioInputStream.createPushStream(audioFormat);
  const audioConfig = speechsdk.AudioConfig.fromStreamInput(pushStream);
  
  const recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
  console.log('✅ Recognizer created successfully');
  
  // Set up event handlers
  recognizer.recognizing = (s, e) => {
    console.log('🎤 Recognizing:', e.result.text);
  };
  
  recognizer.recognized = (s, e) => {
    if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
      console.log('✅ Recognized:', e.result.text);
    } else if (e.result.reason === speechsdk.ResultReason.NoMatch) {
      console.log('⚪ No match detected');
    }
  };
  
  recognizer.canceled = (s, e) => {
    console.error('❌ Recognition canceled:', e.errorDetails);
    console.error('Cancel reason:', e.reason);
  };
  
  // Test starting recognition
  recognizer.startContinuousRecognitionAsync(
    () => {
      console.log('✅ Recognition started successfully');
      
      // Send some test audio after a delay
      setTimeout(() => {
        console.log('📤 Sending test audio data...');
        const testAudio = Buffer.alloc(32000, 0); // 1 second of silence
        pushStream.write(testAudio);
        
        // Stop after 3 seconds
        setTimeout(() => {
          console.log('🛑 Stopping recognition...');
          recognizer.stopContinuousRecognitionAsync(() => {
            console.log('✅ Recognition stopped');
            recognizer.close();
            pushStream.close();
            speechConfig.close();
            console.log('✅ All resources cleaned up');
          });
        }, 3000);
      }, 1000);
    },
    (err) => {
      console.error('❌ Failed to start recognition:', err);
      recognizer.close();
      pushStream.close();
      speechConfig.close();
    }
  );
  
} catch (error) {
  console.error('❌ Complete recognizer test failed:', error.message);
}

console.log('\n⏰ Test will complete in ~5 seconds...'); 