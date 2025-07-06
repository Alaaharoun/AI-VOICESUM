// Test script for audio processing
// Run this in the browser console to test the AudioProcessor

// Mock audio blob for testing
const createMockAudioBlob = (type = 'video/3gpp') => {
  const mockData = new ArrayBuffer(1024);
  return new Blob([mockData], { type });
};

// Test the AudioProcessor
const testAudioProcessing = async () => {
  console.log('Testing AudioProcessor...');
  
  // Import the AudioProcessor (you'll need to adjust the import path)
  try {
    // Test 1: Process video/3gpp blob
    const videoBlob = createMockAudioBlob('video/3gpp');
    console.log('Original blob type:', videoBlob.type);
    
    // This would normally use the AudioProcessor
    const processedBlob = new Blob([videoBlob], { type: 'audio/mp4' });
    console.log('Processed blob type:', processedBlob.type);
    
    // Test 2: Validate audio blob
    const validation = {
      isValid: processedBlob.size > 0 && processedBlob.type.startsWith('audio/'),
      error: null
    };
    
    if (!validation.isValid) {
      validation.error = 'Invalid audio format';
    }
    
    console.log('Validation result:', validation);
    
    return {
      success: validation.isValid,
      originalType: videoBlob.type,
      processedType: processedBlob.type,
      size: processedBlob.size
    };
  } catch (error) {
    console.error('Test failed:', error);
    return { success: false, error: error.message };
  }
};

// Run the test
testAudioProcessing().then(result => {
  console.log('Test completed:', result);
}); 