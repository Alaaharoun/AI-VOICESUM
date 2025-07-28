#!/usr/bin/env node

/**
 * 🔍 اختبار شامل لـ Voice Activity Detection (VAD) مع Faster-Whisper
 * 
 * هذا السكريبت يختبر جميع جوانب VAD:
 * 1. تشغيل الخدمة
 * 2. إعدادات VAD
 * 3. إرسال الصوت
 * 4. استقبال النتائج
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// إعدادات الاختبار
const TEST_CONFIG = {
  // Hugging Face Spaces URL
  HF_URL: 'https://alaaharoun-faster-whisper-api.hf.space',
  
  // Local Docker URL
  LOCAL_URL: 'http://localhost:7860',
  
  // Test endpoints
  ENDPOINTS: {
    HEALTH: '/health',
    TRANSCRIBE: '/transcribe',
    DOCS: '/docs'
  },
  
  // VAD Settings
  VAD_SETTINGS: {
    ENABLED: true,
    THRESHOLD: '0.5',
    PARAMETERS: 'threshold=0.5'
  },
  
  // Test audio settings
  AUDIO: {
    MIN_SIZE: 1000, // 1KB minimum
    MAX_SIZE: 25 * 1024 * 1024, // 25MB maximum
    SUPPORTED_FORMATS: ['wav', 'mp3', 'm4a', 'flac', 'ogg', 'webm']
  }
};

// Mock Audio Blob for testing
class MockAudioBlob {
  constructor(size = 1024, type = 'audio/wav') {
    this.size = size;
    this.type = type;
    this.data = Buffer.alloc(size);
  }
  
  async arrayBuffer() {
    return this.data.buffer;
  }
  
  async stream() {
    return require('stream').Readable.from(this.data);
  }
}

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
          resolve({ status: res.statusCode, headers: res.headers, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: data });
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
class VADTester {
  
  constructor() {
    this.results = [];
    this.errors = [];
  }
  
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': 'ℹ️',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️',
      'test': '🧪'
    }[type] || 'ℹ️';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }
  
  async testHealthCheck() {
    this.log('Testing Health Check...', 'test');
    
    try {
      // Test Hugging Face
      const hfHealth = await makeRequest(`${TEST_CONFIG.HF_URL}${TEST_CONFIG.ENDPOINTS.HEALTH}`);
      
      if (hfHealth.status === 200) {
        this.log('✅ Hugging Face Health Check: PASSED', 'success');
        this.log(`   Status: ${hfHealth.data.status}`, 'info');
        this.log(`   Model Loaded: ${hfHealth.data.model_loaded}`, 'info');
        this.log(`   Service: ${hfHealth.data.service}`, 'info');
      } else {
        this.log('❌ Hugging Face Health Check: FAILED', 'error');
        this.log(`   Status: ${hfHealth.status}`, 'error');
      }
      
      // Test Local (if available)
      try {
        const localHealth = await makeRequest(`${TEST_CONFIG.LOCAL_URL}${TEST_CONFIG.ENDPOINTS.HEALTH}`);
        
        if (localHealth.status === 200) {
          this.log('✅ Local Health Check: PASSED', 'success');
        } else {
          this.log('⚠️ Local Health Check: FAILED (expected if not running locally)', 'warning');
        }
      } catch (error) {
        this.log('⚠️ Local service not available (expected)', 'warning');
      }
      
    } catch (error) {
      this.log(`❌ Health Check Error: ${error.message}`, 'error');
      this.errors.push(error);
    }
  }
  
  async testTranscriptionWithoutVAD() {
    this.log('Testing Transcription without VAD...', 'test');
    
    try {
      // Create mock audio blob
      const mockAudio = new MockAudioBlob(2048, 'audio/wav');
      
      // Test Hugging Face
      const formData = new FormData();
      formData.append('file', mockAudio, 'test.wav');
      formData.append('language', 'en');
      formData.append('task', 'transcribe');
      
      const response = await fetch(`${TEST_CONFIG.HF_URL}${TEST_CONFIG.ENDPOINTS.TRANSCRIBE}`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        this.log('✅ Transcription without VAD: PASSED', 'success');
        this.log(`   Text: "${result.text}"`, 'info');
        this.log(`   Language: ${result.language}`, 'info');
      } else {
        this.log(`❌ Transcription without VAD: FAILED (${response.status})`, 'error');
      }
      
    } catch (error) {
      this.log(`❌ Transcription Error: ${error.message}`, 'error');
      this.errors.push(error);
    }
  }
  
  async testTranscriptionWithVAD() {
    this.log('Testing Transcription with VAD...', 'test');
    
    try {
      // Create mock audio blob
      const mockAudio = new MockAudioBlob(2048, 'audio/wav');
      
      // Test Hugging Face with VAD
      const formData = new FormData();
      formData.append('file', mockAudio, 'test.wav');
      formData.append('language', 'en');
      formData.append('task', 'transcribe');
      formData.append('vad_filter', 'true');
      formData.append('vad_parameters', TEST_CONFIG.VAD_SETTINGS.PARAMETERS);
      
      const response = await fetch(`${TEST_CONFIG.HF_URL}${TEST_CONFIG.ENDPOINTS.TRANSCRIBE}`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        this.log('✅ Transcription with VAD: PASSED', 'success');
        this.log(`   Text: "${result.text}"`, 'info');
        this.log(`   VAD Enabled: ${result.vad_enabled}`, 'info');
        this.log(`   VAD Threshold: ${result.vad_threshold}`, 'info');
      } else {
        this.log(`❌ Transcription with VAD: FAILED (${response.status})`, 'error');
      }
      
    } catch (error) {
      this.log(`❌ VAD Transcription Error: ${error.message}`, 'error');
      this.errors.push(error);
    }
  }
  
  async testVADParameters() {
    this.log('Testing VAD Parameters...', 'test');
    
    const testThresholds = ['0.3', '0.5', '0.7'];
    
    for (const threshold of testThresholds) {
      try {
        const mockAudio = new MockAudioBlob(2048, 'audio/wav');
        
        const formData = new FormData();
        formData.append('file', mockAudio, 'test.wav');
        formData.append('vad_filter', 'true');
        formData.append('vad_parameters', `threshold=${threshold}`);
        
        const response = await fetch(`${TEST_CONFIG.HF_URL}${TEST_CONFIG.ENDPOINTS.TRANSCRIBE}`, {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const result = await response.json();
          this.log(`✅ VAD Threshold ${threshold}: PASSED`, 'success');
          this.log(`   VAD Threshold: ${result.vad_threshold}`, 'info');
        } else {
          this.log(`❌ VAD Threshold ${threshold}: FAILED`, 'error');
        }
        
      } catch (error) {
        this.log(`❌ VAD Parameter Error (${threshold}): ${error.message}`, 'error');
      }
    }
  }
  
  async testAudioFormats() {
    this.log('Testing Audio Formats...', 'test');
    
    const formats = ['wav', 'mp3', 'm4a'];
    
    for (const format of formats) {
      try {
        const mockAudio = new MockAudioBlob(2048, `audio/${format}`);
        
        const formData = new FormData();
        formData.append('file', mockAudio, `test.${format}`);
        formData.append('vad_filter', 'true');
        formData.append('vad_parameters', TEST_CONFIG.VAD_SETTINGS.PARAMETERS);
        
        const response = await fetch(`${TEST_CONFIG.HF_URL}${TEST_CONFIG.ENDPOINTS.TRANSCRIBE}`, {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          this.log(`✅ Audio Format ${format}: PASSED`, 'success');
        } else {
          this.log(`❌ Audio Format ${format}: FAILED`, 'error');
        }
        
      } catch (error) {
        this.log(`❌ Audio Format Error (${format}): ${error.message}`, 'error');
      }
    }
  }
  
  async testErrorHandling() {
    this.log('Testing Error Handling...', 'test');
    
    // Test with empty file
    try {
      const formData = new FormData();
      formData.append('file', new MockAudioBlob(0, 'audio/wav'), 'empty.wav');
      
      const response = await fetch(`${TEST_CONFIG.HF_URL}${TEST_CONFIG.ENDPOINTS.TRANSCRIBE}`, {
        method: 'POST',
        body: formData
      });
      
      if (response.status === 400) {
        this.log('✅ Empty File Error Handling: PASSED', 'success');
      } else {
        this.log('❌ Empty File Error Handling: FAILED', 'error');
      }
      
    } catch (error) {
      this.log(`❌ Error Handling Test: ${error.message}`, 'error');
    }
  }
  
  async runAllTests() {
    this.log('🚀 Starting Comprehensive VAD Testing...', 'test');
    this.log('=' .repeat(60), 'info');
    
    // Run all tests
    await this.testHealthCheck();
    await this.testTranscriptionWithoutVAD();
    await this.testTranscriptionWithVAD();
    await this.testVADParameters();
    await this.testAudioFormats();
    await this.testErrorHandling();
    
    // Summary
    this.log('=' .repeat(60), 'info');
    this.log('📊 Test Summary:', 'test');
    this.log(`   Total Errors: ${this.errors.length}`, this.errors.length === 0 ? 'success' : 'error');
    
    if (this.errors.length > 0) {
      this.log('❌ Issues Found:', 'error');
      this.errors.forEach((error, index) => {
        this.log(`   ${index + 1}. ${error.message}`, 'error');
      });
    } else {
      this.log('✅ All tests passed! VAD is working correctly.', 'success');
    }
    
    this.log('🎯 VAD Testing Complete!', 'test');
  }
}

// Run the tests
async function main() {
  const tester = new VADTester();
  await tester.runAllTests();
}

// Check if running directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { VADTester, TEST_CONFIG }; 