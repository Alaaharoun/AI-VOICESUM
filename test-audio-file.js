const fs = require('fs');
const WebSocket = require('ws');

// Test audio file path
const audioFilePath = './AILIVETRANSLATEWEB/audiotest/Recording (2).wav';

async function testAudioFile() {
  try {
    console.log('🔍 Testing audio file:', audioFilePath);
    
    // Check if file exists
    if (!fs.existsSync(audioFilePath)) {
      console.error('❌ Audio file not found:', audioFilePath);
      return;
    }
    
    // Read audio file
    const audioBuffer = fs.readFileSync(audioFilePath);
    console.log('📁 Audio file loaded:', {
      size: audioBuffer.length,
      sizeKB: (audioBuffer.length / 1024).toFixed(2) + ' KB',
      sizeMB: (audioBuffer.length / (1024 * 1024)).toFixed(2) + ' MB'
    });
    
    // Convert to base64
    const base64Data = audioBuffer.toString('base64');
    console.log('📊 Base64 data size:', base64Data.length, 'characters');
    
    // Connect to WebSocket server
    console.log('🔌 Connecting to WebSocket server...');
    const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      // Send audio data
      const message = {
        type: 'audio',
        data: base64Data,
        format: 'audio/wav',
        language: 'en-US'
      };
      
      console.log('📤 Sending audio data...');
      ws.send(JSON.stringify(message));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 Received message:', message);
        
        if (message.type === 'warning') {
          console.log('⚠️ Warning:', message.message);
          if (message.audioStats) {
            console.log('📊 Audio stats:', message.audioStats);
          }
        } else if (message.type === 'transcription') {
          console.log('🎤 Transcription:', message.text);
        } else if (message.type === 'translation') {
          console.log('🌐 Translation:', message.text);
        }
      } catch (error) {
        console.log('📥 Raw message:', data.toString());
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
    
    ws.on('close', (code, reason) => {
      console.log('🔒 WebSocket closed:', code, reason.toString());
    });
    
    // Close connection after 10 seconds
    setTimeout(() => {
      console.log('⏰ Closing connection...');
      ws.close();
    }, 10000);
    
  } catch (error) {
    console.error('❌ Error testing audio file:', error);
  }
}

// Run the test
testAudioFile(); 