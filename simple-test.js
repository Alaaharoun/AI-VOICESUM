
// Simple test to verify Hugging Face functionality
console.log('🧪 Testing Hugging Face setup...');

// Test 1: Check if SpeechService exists
try {
  const { SpeechService } = require('./services/speechService');
  console.log('✅ SpeechService imported successfully');
  
  // Test 2: Check if methods exist
  if (typeof SpeechService.transcribeAudio === 'function') {
    console.log('✅ transcribeAudio method exists');
  } else {
    console.log('❌ transcribeAudio method missing');
  }
  
  // Test 3: Check if transcribeWithHuggingFace exists (private method)
  console.log('ℹ️ transcribeWithHuggingFace is a private method (not directly accessible)');
  
} catch (error) {
  console.error('❌ Import error:', error.message);
}

// Test 4: Check transcriptionEngineService
try {
  const { transcriptionEngineService } = require('./services/transcriptionEngineService');
  console.log('✅ transcriptionEngineService imported successfully');
  
  if (typeof transcriptionEngineService.getCurrentEngine === 'function') {
    console.log('✅ getCurrentEngine method exists');
  } else {
    console.log('❌ getCurrentEngine method missing');
  }
  
} catch (error) {
  console.error('❌ Import error:', error.message);
}

console.log('\n🎯 Test completed!');
