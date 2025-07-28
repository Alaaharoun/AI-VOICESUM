#!/usr/bin/env node

/**
 * 🧪 اختبار VAD مع ملف صوتي صالح
 * 
 * هذا الاختبار يستخدم ملف WAV صالح لاختبار VAD
 */

const https = require('https');
const http = require('http');
const fs = require('fs');

// إعدادات الاختبار
const HF_URL = 'https://alaaharoun-faster-whisper-api.hf.space';

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
      console.log(`   VAD Support: ${response.data.vad_support}`);
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
    // قراءة الملف الصوتي
    const audioFile = fs.readFileSync('test-audio.wav');
    
    // إنشاء form data
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
    const formData = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test-audio.wav"',
      'Content-Type: audio/wav',
      '',
      audioFile.toString('base64'),
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
      console.log(`   Language Probability: ${response.data.language_probability}`);
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
    // قراءة الملف الصوتي
    const audioFile = fs.readFileSync('test-audio.wav');
    
    // إنشاء form data مع VAD
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
    const formData = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test-audio.wav"',
      'Content-Type: audio/wav',
      '',
      audioFile.toString('base64'),
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
      console.log(`   Language: ${response.data.language}`);
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
      // قراءة الملف الصوتي
      const audioFile = fs.readFileSync('test-audio.wav');
      
      const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
      const formData = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="test-audio.wav"',
        'Content-Type: audio/wav',
        '',
        audioFile.toString('base64'),
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
        console.log(`   Text: "${response.data.text}"`);
        successCount++;
      } else {
        console.log(`❌ VAD Threshold ${threshold}: FAILED`);
        console.log(`   Response: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      console.log(`❌ VAD Threshold Error (${threshold}): ${error.message}`);
    }
  }
  
  return successCount === thresholds.length;
}

async function testErrorHandling() {
  console.log('\n🔍 Testing Error Handling...');
  
  try {
    // إرسال ملف فارغ
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2);
    const formData = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="empty.wav"',
      'Content-Type: audio/wav',
      '',
      '',
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
    
    if (response.status === 400) {
      console.log('✅ Error Handling: PASSED');
      console.log(`   Empty file correctly rejected with status: ${response.status}`);
      return true;
    } else {
      console.log(`⚠️ Error Handling: UNEXPECTED (${response.status})`);
      console.log(`   Response: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error Handling Test: ${error.message}`);
    return false;
  }
}

// Main test function
async function runRealAudioTest() {
  console.log('🚀 Starting VAD Test with Real Audio...');
  console.log('=' .repeat(50));
  
  // التحقق من وجود الملف الصوتي
  if (!fs.existsSync('test-audio.wav')) {
    console.log('❌ ملف test-audio.wav غير موجود');
    console.log('   قم بتشغيل: node create-test-audio.js');
    return;
  }
  
  const results = {
    healthCheck: false,
    transcribeWithoutVAD: false,
    transcribeWithVAD: false,
    vadThresholds: false,
    errorHandling: false
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
  
  // Test 5: Error Handling
  if (results.healthCheck) {
    results.errorHandling = await testErrorHandling();
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
  
  console.log('\n🎯 Real Audio VAD Test Complete!');
  console.log('=' .repeat(50));
  
  return results;
}

// Run the test
if (require.main === module) {
  runRealAudioTest().catch(console.error);
}

module.exports = { runRealAudioTest }; 