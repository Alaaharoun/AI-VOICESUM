const fetch = require('node-fetch');

console.log('🔍 Testing Hugging Face Health Endpoint Timeout...');

async function testHuggingFaceHealth() {
  const url = 'https://alaaharoun-faster-whisper-api.hf.space/health';
  
  console.log(`\n📡 Testing: ${url}`);
  console.log('⏱️  Starting request with 10-second timeout...');
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Response received in ${duration}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.text();
      console.log(`📄 Response data: ${data.substring(0, 100)}...`);
      console.log('✅ Health check successful');
    } else {
      console.log('❌ Health check failed');
    }
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`❌ Request failed after ${duration}ms`);
    console.log(`🚨 Error: ${error.message}`);
    
    if (error.name === 'AbortError') {
      console.log('⏰ Request timed out after 10 seconds');
    }
  }
}

async function testMultipleRequests() {
  console.log('\n🔄 Testing multiple requests to check consistency...');
  
  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- Test ${i}/3 ---`);
    await testHuggingFaceHealth();
    
    if (i < 3) {
      console.log('⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

async function testWithDifferentTimeouts() {
  console.log('\n⏱️  Testing with different timeout values...');
  
  const timeouts = [5000, 10000, 15000]; // 5s, 10s, 15s
  
  for (const timeout of timeouts) {
    console.log(`\n--- Testing with ${timeout}ms timeout ---`);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://alaaharoun-faster-whisper-api.hf.space/health', {
        method: 'GET',
        signal: AbortSignal.timeout(timeout),
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ Success in ${duration}ms (${response.status})`);
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`❌ Failed after ${duration}ms: ${error.message}`);
    }
  }
}

// Main test runner
async function runTimeoutTests() {
  console.log('🚀 Starting Hugging Face Health Endpoint Timeout Tests...\n');
  
  try {
    await testHuggingFaceHealth();
    await testMultipleRequests();
    await testWithDifferentTimeouts();
    
    console.log('\n🎉 Timeout tests completed!');
    console.log('\n💡 Recommendations:');
    console.log('1. If requests are consistently slow (>5s), consider reducing timeout');
    console.log('2. If requests timeout frequently, check Hugging Face service status');
    console.log('3. Consider caching health check results to avoid repeated API calls');
    
  } catch (error) {
    console.error('❌ Test runner error:', error);
  }
}

// Run the tests
runTimeoutTests(); 