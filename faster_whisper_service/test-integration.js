#!/usr/bin/env node

/**
 * Quick test script for Faster Whisper Service integration
 * Run with: node test-integration.js
 */

const https = require('https');
const http = require('http');

const SERVICE_URL = 'https://alaaharoun-faster-whisper-api.hf.space';

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Test functions
async function testHealthCheck() {
  console.log('🔍 Testing health check...');
  try {
    const response = await makeRequest(`${SERVICE_URL}/health`);
    console.log('✅ Health check response:', response);
    return response.status === 200;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testRootEndpoint() {
  console.log('🔍 Testing root endpoint...');
  try {
    const response = await makeRequest(`${SERVICE_URL}/`);
    console.log('✅ Root endpoint response:', response);
    return response.status === 200;
  } catch (error) {
    console.error('❌ Root endpoint failed:', error.message);
    return false;
  }
}

async function testServiceAvailability() {
  console.log('🔍 Testing service availability...');
  try {
    const response = await makeRequest(`${SERVICE_URL}/docs`);
    console.log('✅ Service is available (docs endpoint):', response.status);
    return response.status === 200;
  } catch (error) {
    console.error('❌ Service availability check failed:', error.message);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Faster Whisper Service Integration Tests');
  console.log('📍 Service URL:', SERVICE_URL);
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('─'.repeat(60));
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Root Endpoint', fn: testRootEndpoint },
    { name: 'Service Availability', fn: testServiceAvailability }
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    console.log(`\n🧪 Running: ${test.name}`);
    const passed = await test.fn();
    
    if (passed) {
      console.log(`✅ ${test.name}: PASSED`);
      passedTests++;
    } else {
      console.log(`❌ ${test.name}: FAILED`);
    }
  }
  
  console.log('\n' + '─'.repeat(60));
  console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Service is ready for integration.');
    console.log('\n📋 Next steps:');
    console.log('1. Copy config.ts and fasterWhisperService.ts to your services folder');
    console.log('2. Update your SpeechService to use Faster Whisper');
    console.log('3. Test with actual audio files');
  } else {
    console.log('⚠️ Some tests failed. Please check the service status.');
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Verify the service URL is correct');
    console.log('2. Check if the Hugging Face Space is running');
    console.log('3. Ensure the service has been deployed successfully');
  }
  
  console.log('\n📞 For support, check the INTEGRATION_GUIDE.md file');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testHealthCheck,
  testRootEndpoint,
  testServiceAvailability,
  runTests
}; 