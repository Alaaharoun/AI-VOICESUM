const fs = require('fs');
const WebSocket = require('ws');

// Test audio file path
const audioFilePath = './AILIVETRANSLATEWEB/audiotest/test-audio.wav';

async function sendAudioChunks() {
  try {
    console.log('🔍 Sending audio file in chunks:', audioFilePath);
    
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
    
    // Connect to WebSocket server
    console.log('🔌 Connecting to WebSocket server...');
    const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
    
    let messageCount = 0;
    let chunkCount = 0;
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      // Split audio into smaller chunks (50KB each)
      const chunkSize = 50 * 1024; // 50KB
      const totalChunks = Math.ceil(audioBuffer.length / chunkSize);
      
      console.log(`📦 Splitting audio into ${totalChunks} chunks of ${chunkSize} bytes each`);
      
      // Send chunks with delay
      const sendChunk = (index) => {
        if (index >= totalChunks) {
          console.log('✅ All chunks sent');
          return;
        }
        
        const start = index * chunkSize;
        const end = Math.min(start + chunkSize, audioBuffer.length);
        const chunk = audioBuffer.slice(start, end);
        
        // Convert chunk to base64
        const base64Chunk = chunk.toString('base64');
        
        const message = {
          type: 'audio',
          data: base64Chunk,
          format: 'audio/wav',
          language: 'en-US'
        };
        
        console.log(`📤 Sending chunk ${index + 1}/${totalChunks} (${chunk.length} bytes)`);
        ws.send(JSON.stringify(message));
        
        chunkCount++;
        
        // Send next chunk after 500ms delay
        setTimeout(() => sendChunk(index + 1), 500);
      };
      
      // Start sending chunks
      sendChunk(0);
    });
    
    ws.on('message', (data) => {
      messageCount++;
      console.log(`📨 Message #${messageCount}:`, data.toString());
      
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'warning') {
          console.log('⚠️ WARNING:', message.message);
          if (message.audioStats) {
            console.log('📊 Audio Stats:', message.audioStats);
          }
        } else if (message.type === 'transcription') {
          console.log('🎤 TRANSCRIPTION:', message.text);
        } else if (message.type === 'translation') {
          console.log('🌐 TRANSLATION:', message.text);
        } else if (message.type === 'error') {
          console.log('❌ ERROR:', message.error);
        } else {
          console.log('📝 Other message:', message);
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
      console.log(`📊 Summary: Sent ${chunkCount} chunks, received ${messageCount} messages`);
    });
    
    // Close connection after 30 seconds
    setTimeout(() => {
      console.log('⏰ Closing connection...');
      ws.close();
    }, 30000);
    
  } catch (error) {
    console.error('❌ Error sending audio file:', error);
  }
}

// Run the test
sendAudioChunks(); 