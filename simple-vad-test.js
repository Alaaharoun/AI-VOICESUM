#!/usr/bin/env node

/**
 * 🧪 اختبار مبسط لـ Voice Activity Detection (VAD)
 * 
 * هذا الاختبار يستخدم fetch API لاختبار VAD بشكل مباشر
 */

const https = require('https');

// إعدادات الاختبار
const HF_URL = 'https://alaaharoun-faster-whisper-api.hf.space';

// Mock Audio Data
const mockAudioData = Buffer.alloc(1024);

// HTTP Request Helper
async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Test Functions
async function testHealthCheck() {
  console.log('🔍 Testing Health Check...');
  
  try {
    const response = await makeRequest(`${HF_URL}/health`);
    
    if (response.status === 200) {
      console.log('✅ Health Check: PASSED');
      console.log(`   Status: ${response.data.status}`);
      console.log(`   Model Loaded: ${response.data.model_loaded}`);
      console.log(`   Service: ${response.data.service}`);
      return true;
    } else {
      console.log('❌ Health Check: FAILED');
      console.log(`   Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Health Check Error: ${error.message}`);
    return false;
  }
}

async function testTranscribeWithoutVAD() {
  console.log('\n🔍 Testing Transcription without VAD...');
  
  try {
    // Create simple form data
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
    const formData = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test.wav"',
      'Content-Type: audio/wav',
      '',
      mockAudioData.toString('base64'),
      `--${boundary}`,
      'Content-Disposition: form-data; name="language"',
      '',
      'en',
      `--${boundary}`,
      'Content-Disposition: form-data; name="task"',
      '',
      'transcribe',
      `--${boundary}--`
    ].join('\r\n');
    
    const response = await makeRequest(`${HF_URL}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(formData)
      },
      body: formData
    });
    
    if (response.status === 200) {
      console.log('✅ Transcription without VAD: PASSED');
      console.log(`   Text: "${response.data.text}"`);
      console.log(`   Language: ${response.data.language}`);
      return true;
    } else {
      console.log(`❌ Transcription without VAD: FAILED (${response.status})`);
      console.log(`   Response: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Transcription Error: ${error.message}`);
    return false;
  }
}

async function testTranscribeWithVAD() {
  console.log('\n🔍 Testing Transcription with VAD...');
  
  try {
    // Create simple form data with VAD
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
    const formData = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test.wav"',
      'Content-Type: audio/wav',
      '',
      mockAudioData.toString('base64'),
      `--${boundary}`,
      'Content-Disposition: form-data; name="language"',
      '',
      'en',
      `--${boundary}`,
      'Content-Disposition: form-data; name="task"',
      '',
      'transcribe',
      `--${boundary}`,
      'Content-Disposition: form-data; name="vad_filter"',
      '',
      'true',
      `--${boundary}`,
      'Content-Disposition: form-data; name="vad_parameters"',
      '',
      'threshold=0.5',
      `--${boundary}--`
    ].join('\r\n');
    
    const response = await makeRequest(`${HF_URL}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(formData)
      },
      body: formData
    });
    
    if (response.status === 200) {
      console.log('✅ Transcription with VAD: PASSED');
      console.log(`   Text: "${response.data.text}"`);
      console.log(`   VAD Enabled: ${response.data.vad_enabled}`);
      console.log(`   VAD Threshold: ${response.data.vad_threshold}`);
      return true;
    } else {
      console.log(`❌ Transcription with VAD: FAILED (${response.status})`);
      console.log(`   Response: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ VAD Transcription Error: ${error.message}`);
    return false;
  }
}

async function testVADThresholds() {
  console.log('\n🔍 Testing VAD Thresholds...');
  
  const thresholds = ['0.3', '0.5', '0.7'];
  let successCount = 0;
  
  for (const threshold of thresholds) {
    try {
      const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
      const formData = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="test.wav"',
        'Content-Type: audio/wav',
        '',
        mockAudioData.toString('base64'),
        `--${boundary}`,
        'Content-Disposition: form-data; name="vad_filter"',
        '',
        'true',
        `--${boundary}`,
        'Content-Disposition: form-data; name="vad_parameters"',
        '',
        `threshold=${threshold}`,
        `--${boundary}--`
      ].join('\r\n');
      
      const response = await makeRequest(`${HF_URL}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(formData)
        },
        body: formData
      });
      
      if (response.status === 200) {
        console.log(`✅ VAD Threshold ${threshold}: PASSED`);
        console.log(`   VAD Threshold: ${response.data.vad_threshold}`);
        successCount++;
      } else {
        console.log(`❌ VAD Threshold ${threshold}: FAILED`);
      }
    } catch (error) {
      console.log(`❌ VAD Threshold Error (${threshold}): ${error.message}`);
    }
  }
  
  return successCount === thresholds.length;
}

// Main test function
async function runSimpleTest() {
  console.log('🚀 Starting Simple VAD Test...');
  console.log('=' .repeat(50));
  
  const results = {
    healthCheck: false,
    transcribeWithoutVAD: false,
    transcribeWithVAD: false,
    vadThresholds: false
  };
  
  // Test 1: Health Check
  results.healthCheck = await testHealthCheck();
  
  // Test 2: Transcribe without VAD
  if (results.healthCheck) {
    results.transcribeWithoutVAD = await testTranscribeWithoutVAD();
  }
  
  // Test 3: Transcribe with VAD
  if (results.healthCheck) {
    results.transcribeWithVAD = await testTranscribeWithVAD();
  }
  
  // Test 4: VAD Thresholds
  if (results.healthCheck) {
    results.vadThresholds = await testVADThresholds();
  }
  
  // Summary
  console.log('\n📊 Test Summary:');
  console.log('=' .repeat(50));
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  const successRate = (passedTests / totalTests) * 100;
  
  console.log(`✅ Passed Tests: ${passedTests}`);
  console.log(`❌ Failed Tests: ${totalTests - passedTests}`);
  console.log(`📋 Total Tests: ${totalTests}`);
  console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);
  
  if (successRate >= 80) {
    console.log('🎉 VAD is working excellently!');
  } else if (successRate >= 60) {
    console.log('⚠️ VAD is working well with some issues');
  } else {
    console.log('❌ VAD needs fixing');
  }
  
  console.log('\n🎯 Simple VAD Test Complete!');
  console.log('=' .repeat(50));
  
  return results;
}

// Run the test
if (require.main === module) {
  runSimpleTest().catch(console.error);
}

module.exports = { runSimpleTest }; 