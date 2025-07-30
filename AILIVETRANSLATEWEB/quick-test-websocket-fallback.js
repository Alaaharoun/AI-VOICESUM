// Quick Test Script for WebSocket Fallback
// Run this in browser console to test the fallback mechanism

console.log('🧪 Testing WebSocket Fallback Mechanism...');

// Test configuration
const TEST_CONFIG = {
  RENDER_WS: 'wss://ai-voicesum.onrender.com/ws',
  HUGGING_FACE_HTTP: 'https://alaaharoun-faster-whisper-api.hf.space/health',
  LOCAL_WS: 'ws://localhost:7860/ws'
};

// Test WebSocket connection
async function testWebSocket(url, name) {
  console.log(`🔌 Testing ${name}: ${url}`);
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    const ws = new WebSocket(url);
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve({ success: false, error: 'Timeout', duration: Date.now() - startTime });
    }, 5000);
    
    ws.onopen = () => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      console.log(`  ✅ ${name} connected in ${duration}ms`);
      
      // Send test message
      ws.send(JSON.stringify({ type: 'ping', test: true }));
      
      setTimeout(() => {
        ws.close();
        resolve({ success: true, duration });
      }, 1000);
    };
    
    ws.onerror = (error) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      console.log(`  ❌ ${name} failed in ${duration}ms:`, error.type);
      resolve({ success: false, error: error.type, duration });
    };
    
    ws.onclose = (event) => {
      console.log(`  🔌 ${name} closed: Code ${event.code}`);
    };
    
    ws.onmessage = (event) => {
      console.log(`  📨 ${name} message:`, event.data);
    };
  });
}

// Test HTTP endpoint
async function testHTTP(url, name) {
  console.log(`📡 Testing ${name}: ${url}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(url);
    const duration = Date.now() - startTime;
    
    if (response.ok) {
      console.log(`  ✅ ${name} HTTP OK in ${duration}ms`);
      return { success: true, duration, status: response.status };
    } else {
      console.log(`  ⚠️ ${name} HTTP returned ${response.status} in ${duration}ms`);
      return { success: false, duration, status: response.status };
    }
  } catch (error) {
    console.log(`  ❌ ${name} HTTP failed:`, error.message);
    return { success: false, error: error.message };
  }
}

// Test fallback logic simulation
async function simulateFallbackLogic() {
  console.log('\n🔄 Simulating Fallback Logic...');
  
  // Step 1: Try WebSocket
  const wsResult = await testWebSocket(TEST_CONFIG.RENDER_WS, 'Render WebSocket');
  
  if (wsResult.success) {
    console.log('✅ WebSocket successful - would use WebSocket mode');
    return 'websocket';
  }
  
  console.log('⚠️ WebSocket failed - trying REST API fallback...');
  
  // Step 2: Try REST API
  const httpResult = await testHTTP(TEST_CONFIG.HUGGING_FACE_HTTP, 'Hugging Face REST API');
  
  if (httpResult.success) {
    console.log('✅ REST API successful - would use REST API mode');
    return 'rest';
  }
  
  console.log('❌ Both WebSocket and REST API failed');
  return 'failed';
}

// Main test function
async function runFallbackTest() {
  console.log('🚀 Starting Comprehensive Fallback Test...\n');
  
  // Test all endpoints
  const results = {
    renderWS: await testWebSocket(TEST_CONFIG.RENDER_WS, 'Render WebSocket'),
    huggingFaceHTTP: await testHTTP(TEST_CONFIG.HUGGING_FACE_HTTP, 'Hugging Face HTTP'),
    localWS: await testWebSocket(TEST_CONFIG.LOCAL_WS, 'Local WebSocket (if running)')
  };
  
  // Simulate the actual fallback logic
  const fallbackResult = await simulateFallbackLogic();
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  Object.entries(results).forEach(([key, result]) => {
    const status = result.success ? '✅ Working' : '❌ Failed';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${key}: ${status}${duration}`);
  });
  
  console.log(`\nRecommended Mode: ${fallbackResult.toUpperCase()}`);
  
  // Provide recommendations
  console.log('\n💡 Recommendations:');
  if (fallbackResult === 'websocket') {
    console.log('- Use WebSocket for real-time transcription');
    console.log('- Expect fast, live updates');
  } else if (fallbackResult === 'rest') {
    console.log('- Use REST API for reliable transcription');
    console.log('- Expect batch processing every ~3 seconds');
    console.log('- More stable but slower than WebSocket');
  } else {
    console.log('- Check internet connection');
    console.log('- Try again later');
    console.log('- Consider local server setup');
  }
  
  return results;
}

// Auto-run test
runFallbackTest().then((results) => {
  console.log('\n🎯 Test completed! Check the results above.');
  console.log('💡 You can now start recording in the app - it will use the best available service.');
  
  // Store results globally for inspection
  window.fallbackTestResults = results;
}).catch((error) => {
  console.error('❌ Test failed:', error);
});

// Export for manual testing
window.testWebSocketFallback = {
  testWebSocket,
  testHTTP,
  runFallbackTest,
  simulateFallbackLogic
};

console.log('🔧 Fallback test functions loaded. Check window.testWebSocketFallback for manual testing.'); 