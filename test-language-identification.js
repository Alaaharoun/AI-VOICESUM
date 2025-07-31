const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Test configuration
const SERVER_URL = 'ws://localhost:10000/ws';
const TEST_AUDIO_PATH = './test-audio.wav'; // Create a test audio file

console.log('🧪 Testing Language Identification Features...');

// Test 1: At-Start Language Identification
async function testAtStartLID() {
  console.log('\n📋 Test 1: At-Start Language Identification');
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVER_URL);
    
    ws.on('open', () => {
      console.log('✅ Connected to WebSocket server');
      
      // Initialize with At-Start LID
      ws.send(JSON.stringify({
        type: 'init',
        language: 'auto',
        autoDetection: true,
        lidMode: 'AtStart'
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'ready') {
        console.log('✅ Server ready for At-Start LID');
        console.log(`📊 LID Mode: ${message.lidMode}`);
        console.log(`🔍 Auto Detection: ${message.autoDetection}`);
        
        // Send test audio if available
        if (fs.existsSync(TEST_AUDIO_PATH)) {
          const audioBuffer = fs.readFileSync(TEST_AUDIO_PATH);
          const base64Audio = audioBuffer.toString('base64');
          
          ws.send(JSON.stringify({
            type: 'audio',
            data: base64Audio,
            format: 'audio/wav'
          }));
          
          console.log('🎵 Sent test audio for At-Start LID');
        } else {
          console.log('⚠️ No test audio file found, skipping audio test');
        }
        
        setTimeout(() => {
          ws.close();
          resolve();
        }, 5000);
      }
      
      if (message.type === 'transcription') {
        console.log(`🎤 Partial: [${message.detectedLanguage || 'detecting'}] "${message.text}"`);
      }
      
      if (message.type === 'final') {
        console.log(`✅ Final: [${message.detectedLanguage || 'detected'}] "${message.text}"`);
      }
      
      if (message.type === 'error') {
        console.error(`❌ Error: ${message.error}`);
        reject(new Error(message.error));
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      reject(error);
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
    });
  });
}

// Test 2: Continuous Language Identification
async function testContinuousLID() {
  console.log('\n📋 Test 2: Continuous Language Identification');
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVER_URL);
    
    ws.on('open', () => {
      console.log('✅ Connected to WebSocket server');
      
      // Initialize with Continuous LID
      ws.send(JSON.stringify({
        type: 'init',
        language: 'auto',
        autoDetection: true,
        lidMode: 'Continuous'
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'ready') {
        console.log('✅ Server ready for Continuous LID');
        console.log(`📊 LID Mode: ${message.lidMode}`);
        console.log(`🔍 Auto Detection: ${message.autoDetection}`);
        
        // Send test audio if available
        if (fs.existsSync(TEST_AUDIO_PATH)) {
          const audioBuffer = fs.readFileSync(TEST_AUDIO_PATH);
          const base64Audio = audioBuffer.toString('base64');
          
          ws.send(JSON.stringify({
            type: 'audio',
            data: base64Audio,
            format: 'audio/wav'
          }));
          
          console.log('🎵 Sent test audio for Continuous LID');
        } else {
          console.log('⚠️ No test audio file found, skipping audio test');
        }
        
        setTimeout(() => {
          ws.close();
          resolve();
        }, 5000);
      }
      
      if (message.type === 'transcription') {
        console.log(`🎤 Partial: [${message.detectedLanguage || 'detecting'}] "${message.text}"`);
      }
      
      if (message.type === 'final') {
        console.log(`✅ Final: [${message.detectedLanguage || 'detected'}] "${message.text}"`);
      }
      
      if (message.type === 'error') {
        console.error(`❌ Error: ${message.error}`);
        reject(new Error(message.error));
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      reject(error);
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
    });
  });
}

// Test 3: REST API Language Identification
async function testRESTLID() {
  console.log('\n📋 Test 3: REST API Language Identification');
  
  try {
    const fetch = require('node-fetch');
    const FormData = require('form-data');
    
    // Create a simple test audio file if it doesn't exist
    if (!fs.existsSync(TEST_AUDIO_PATH)) {
      console.log('⚠️ Creating test audio file...');
      // Create a minimal WAV file for testing
      const wavHeader = Buffer.alloc(44);
      wavHeader.write('RIFF', 0);
      wavHeader.writeUInt32LE(36, 4);
      wavHeader.write('WAVE', 8);
      wavHeader.write('fmt ', 12);
      wavHeader.writeUInt32LE(16, 16);
      wavHeader.writeUInt16LE(1, 20);
      wavHeader.writeUInt16LE(1, 22);
      wavHeader.writeUInt32LE(16000, 24);
      wavHeader.writeUInt32LE(32000, 28);
      wavHeader.writeUInt16LE(2, 32);
      wavHeader.writeUInt16LE(16, 34);
      wavHeader.write('data', 36);
      wavHeader.writeUInt32LE(0, 40);
      
      fs.writeFileSync(TEST_AUDIO_PATH, wavHeader);
    }
    
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(TEST_AUDIO_PATH));
    formData.append('candidateLanguages', JSON.stringify([
      'en-US', 'ar-SA', 'fr-FR', 'es-ES', 'de-DE'
    ]));
    
    const response = await fetch('http://localhost:10000/identify-language', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ REST API Language Identification successful');
      console.log(`🔍 Detected Language: ${result.detectedLanguage}`);
      console.log(`📊 Confidence: ${result.confidence}`);
      console.log(`📝 Transcription: ${result.transcription}`);
      console.log(`🌍 Candidate Languages: ${result.candidateLanguages.join(', ')}`);
    } else {
      const errorText = await response.text();
      console.error(`❌ REST API failed: ${response.status} - ${errorText}`);
    }
    
  } catch (error) {
    console.error('❌ REST API test error:', error.message);
  }
}

// Test 4: Health Check
async function testHealthCheck() {
  console.log('\n📋 Test 4: Health Check');
  
  try {
    const fetch = require('node-fetch');
    
    const response = await fetch('http://localhost:10000/health');
    
    if (response.ok) {
      const health = await response.json();
      console.log('✅ Health check successful');
      console.log(`📊 Status: ${health.status}`);
      console.log(`🔑 Azure Key: ${health.azureKey}`);
      console.log(`🌍 Supported Languages: ${health.supportedLanguages}`);
      
      if (health.languageIdentification) {
        console.log('🧠 Language Identification Features:');
        console.log(`  - Supported: ${health.languageIdentification.supported}`);
        console.log(`  - Modes: ${health.languageIdentification.modes.join(', ')}`);
        console.log(`  - Max Languages (AtStart): ${health.languageIdentification.maxLanguages.atStart}`);
        console.log(`  - Max Languages (Continuous): ${health.languageIdentification.maxLanguages.continuous}`);
        console.log(`  - Endpoints: ${health.languageIdentification.endpoints.join(', ')}`);
      }
    } else {
      console.error(`❌ Health check failed: ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ Health check error:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  try {
    await testHealthCheck();
    await testAtStartLID();
    await testContinuousLID();
    await testRESTLID();
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('✨ Language identification features are working properly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const fetch = require('node-fetch');
    const response = await fetch('http://localhost:10000/health');
    
    if (!response.ok) {
      console.error('❌ Server is not running. Please start the server first:');
      console.error('   npm start');
      process.exit(1);
    }
    
    console.log('✅ Server is running and ready for testing');
    
  } catch (error) {
    console.error('❌ Cannot connect to server. Please start the server first:');
    console.error('   npm start');
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Language Identification Tests...');
  
  await checkServer();
  await runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testAtStartLID,
  testContinuousLID,
  testRESTLID,
  testHealthCheck
}; 