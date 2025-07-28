#!/usr/bin/env node

/**
 * 🚀 اختبار سريع لـ Voice Activity Detection (VAD)
 * 
 * هذا السكريبت يختبر VAD بشكل سريع ومباشر
 */

const https = require('https');

// إعدادات الاختبار
const HF_URL = 'https://alaaharoun-faster-whisper-api.hf.space';

// Mock Audio Data
const mockAudioData = Buffer.alloc(1024);

// HTTP Request Helper
async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
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
    } else {
      console.log('❌ Health Check: FAILED');
      console.log(`   Status: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Health Check Error: ${error.message}`);
  }
}

async function testTranscriptionWithoutVAD() {
  console.log('\n🔍 Testing Transcription without VAD...');
  
  try {
    // Create form data
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
    } else {
      console.log(`❌ Transcription without VAD: FAILED (${response.status})`);
    }
  } catch (error) {
    console.log(`❌ Transcription Error: ${error.message}`);
  }
}

async function testTranscriptionWithVAD() {
  console.log('\n🔍 Testing Transcription with VAD...');
  
  try {
    // Create form data with VAD
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
    } else {
      console.log(`❌ Transcription with VAD: FAILED (${response.status})`);
    }
  } catch (error) {
    console.log(`❌ VAD Transcription Error: ${error.message}`);
  }
}

async function testVADThresholds() {
  console.log('\n🔍 Testing VAD Thresholds...');
  
  const thresholds = ['0.3', '0.5', '0.7'];
  
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
      } else {
        console.log(`❌ VAD Threshold ${threshold}: FAILED`);
      }
    } catch (error) {
      console.log(`❌ VAD Threshold Error (${threshold}): ${error.message}`);
    }
  }
}

// Main test function
async function runQuickTest() {
  console.log('🚀 Starting Quick VAD Test...');
  console.log('=' .repeat(50));
  
  await testHealthCheck();
  await testTranscriptionWithoutVAD();
  await testTranscriptionWithVAD();
  await testVADThresholds();
  
  console.log('\n🎯 Quick VAD Test Complete!');
  console.log('=' .repeat(50));
}

// Run the test
if (require.main === module) {
  runQuickTest().catch(console.error);
}

module.exports = { runQuickTest }; 