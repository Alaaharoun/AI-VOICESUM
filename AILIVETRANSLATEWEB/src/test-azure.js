// Test script for Azure Speech SDK
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

console.log('🧪 Testing Azure Speech SDK...');

// Test SDK availability
try {
  if (typeof SpeechSDK !== 'undefined' && SpeechSDK.SpeechConfig) {
    console.log('✅ Azure Speech SDK is available');
    
    // Test configuration
    const subscriptionKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
    const region = import.meta.env.VITE_AZURE_SPEECH_REGION;
    
    if (subscriptionKey && region) {
      console.log('✅ Azure configuration found');
      console.log('📍 Region:', region);
      console.log('🔑 Key:', subscriptionKey.substring(0, 10) + '...');
      
      // Test speech config creation
      try {
        const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, region);
        console.log('✅ Speech config created successfully');
        
        // Test audio config
        const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
        console.log('✅ Audio config created successfully');
        
        console.log('🎉 Azure Speech SDK is ready to use!');
        
      } catch (error) {
        console.error('❌ Error creating speech config:', error);
      }
    } else {
      console.error('❌ Azure configuration not found in environment variables');
    }
  } else {
    console.error('❌ Azure Speech SDK is not available');
  }
} catch (error) {
  console.error('❌ Error testing Azure Speech SDK:', error);
} 