const fetch = require('node-fetch');

// Configuration
const HUGGING_FACE_URL = 'https://alaaharoun-faster-whisper-api.hf.space';
const ENDPOINTS = {
  HEALTH: '/health',
  TRANSCRIBE: '/transcribe',
  ROOT: '/'
};

// Test functions
async function testHealthEndpoint() {
  console.log('🔍 Testing Health Endpoint...');
  console.log(`URL: ${HUGGING_FACE_URL}${ENDPOINTS.HEALTH}`);
  
  try {
    const response = await fetch(`${HUGGING_FACE_URL}${ENDPOINTS.HEALTH}`, {
      method: 'GET',
      timeout: 10000, // 10 seconds
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Health check successful:');
      console.log(JSON.stringify(data, null, 2));
      return true;
    } else {
      const errorText = await response.text();
      console.log('❌ Health check failed:');
      console.log(errorText);
      return false;
    }
  } catch (error) {
    console.log('❌ Health check error:');
    console.log(error.message);
    return false;
  }
}

async function testRootEndpoint() {
  console.log('\n🔍 Testing Root Endpoint...');
  console.log(`URL: ${HUGGING_FACE_URL}${ENDPOINTS.ROOT}`);
  
  try {
    const response = await fetch(`${HUGGING_FACE_URL}${ENDPOINTS.ROOT}`, {
      method: 'GET',
      timeout: 10000,
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.text();
      console.log('✅ Root endpoint accessible');
      console.log('Response preview:', data.substring(0, 200) + '...');
      return true;
    } else {
      console.log('❌ Root endpoint failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Root endpoint error:');
    console.log(error.message);
    return false;
  }
}

async function testTranscribeEndpoint() {
  console.log('\n🔍 Testing Transcribe Endpoint (without file)...');
  console.log(`URL: ${HUGGING_FACE_URL}${ENDPOINTS.TRANSCRIBE}`);
  
  try {
    const response = await fetch(`${HUGGING_FACE_URL}${ENDPOINTS.TRANSCRIBE}`, {
      method: 'POST',
      timeout: 10000,
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 422) {
      console.log('✅ Transcribe endpoint accessible (expected 422 for missing file)');
      return true;
    } else if (response.ok) {
      console.log('✅ Transcribe endpoint accessible');
      return true;
    } else {
      const errorText = await response.text();
      console.log('❌ Transcribe endpoint failed:');
      console.log(errorText);
      return false;
    }
  } catch (error) {
    console.log('❌ Transcribe endpoint error:');
    console.log(error.message);
    return false;
  }
}

async function testNetworkConnectivity() {
  console.log('\n🔍 Testing Network Connectivity...');
  
  // Test DNS resolution
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    const hostname = new URL(HUGGING_FACE_URL).hostname;
    console.log(`Testing DNS resolution for: ${hostname}`);
    
    const { stdout, stderr } = await execAsync(`nslookup ${hostname}`);
    
    if (stderr) {
      console.log('❌ DNS resolution failed:');
      console.log(stderr);
      return false;
    } else {
      console.log('✅ DNS resolution successful:');
      console.log(stdout);
      return true;
    }
  } catch (error) {
    console.log('❌ DNS test error:');
    console.log(error.message);
    return false;
  }
}

async function testCORSHeaders() {
  console.log('\n🔍 Testing CORS Headers...');
  
  try {
    const response = await fetch(`${HUGGING_FACE_URL}${ENDPOINTS.HEALTH}`, {
      method: 'OPTIONS',
      timeout: 10000,
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
    };
    
    console.log('CORS Headers:');
    console.log(JSON.stringify(corsHeaders, null, 2));
    
    return true;
  } catch (error) {
    console.log('❌ CORS test error:');
    console.log(error.message);
    return false;
  }
}

// Main test function
async function runAllTests() {
  console.log('🚀 Starting Hugging Face API Connection Tests...\n');
  console.log(`Target URL: ${HUGGING_FACE_URL}\n`);
  
  const results = {
    network: await testNetworkConnectivity(),
    health: await testHealthEndpoint(),
    root: await testRootEndpoint(),
    transcribe: await testTranscribeEndpoint(),
    cors: await testCORSHeaders(),
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! The Hugging Face API is accessible.');
  } else {
    console.log('⚠️  Some tests failed. Check the details above.');
  }
  
  return results;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testHealthEndpoint,
  testRootEndpoint,
  testTranscribeEndpoint,
  testNetworkConnectivity,
  testCORSHeaders
}; 