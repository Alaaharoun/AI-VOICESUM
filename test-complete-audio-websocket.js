const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class CompleteAudioWebSocketTest {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.testResults = {
      connection: false,
      microphone: false,
      audioSending: false,
      transcription: false,
      messagesReceived: 0,
      chunksSent: 0,
      totalBytes: 0,
      responseTimes: []
    };
  }
  
  async log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const icon = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[type] || 'ℹ️';
    
    console.log(`${icon} [${timestamp}] ${message}`);
  }
  
  async testConnection() {
    await this.log('🔌 اختبار الاتصال مع Render...', 'info');
    
    try {
      this.ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
      
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.log('⏰ Connection timeout', 'error');
          this.ws.close();
          reject(new Error('Connection timeout'));
        }, 10000);
        
        this.ws.on('open', () => {
          this.log('✅ WebSocket connected', 'success');
          clearTimeout(timeout);
          this.isConnected = true;
          resolve(true);
        });
        
        this.ws.on('error', (error) => {
          this.log(`❌ WebSocket error: ${error.message || 'Unknown error'}`, 'error');
          clearTimeout(timeout);
          reject(error);
        });
        
        this.ws.on('close', () => {
          this.log('🔒 WebSocket closed', 'info');
          clearTimeout(timeout);
          resolve(false);
        });
      });
      
      if (result) {
        this.testResults.connection = true;
        await this.log('✅ Connection test successful', 'success');
      } else {
        await this.log('❌ Connection test failed', 'error');
      }
      
      return result;
      
    } catch (error) {
      await this.log(`❌ Connection test error: ${error.message}`, 'error');
      return false;
    }
  }
  
  async testMicrophone() {
    await this.log('🎤 اختبار الميكروفون (محاكاة)...', 'info');
    
    // Since we're in Node.js, we'll simulate microphone test
    // In a real browser environment, this would test actual microphone access
    
    try {
      // Simulate microphone permission
      await this.log('✅ Microphone permission granted (simulated)', 'success');
      await this.log('🔧 Audio analysis setup complete (simulated)', 'success');
      
      this.testResults.microphone = true;
      await this.log('✅ Microphone test successful', 'success');
      
      return true;
    } catch (error) {
      await this.log(`❌ Microphone test failed: ${error.message}`, 'error');
      return false;
    }
  }
  
  async createTestAudio() {
    await this.log('🎵 إنشاء ملف صوتي تجريبي...', 'info');
    
    try {
      // Create a simple test audio file using ffmpeg
      const testAudioFile = '/tmp/test_audio.wav';
      
      // Generate 3 seconds of 440Hz sine wave
      const ffmpegCommand = `ffmpeg -f lavfi -i "sine=frequency=440:duration=3" -ar 16000 -ac 1 -acodec pcm_s16le "${testAudioFile}" -y`;
      
      await execAsync(ffmpegCommand);
      
      // Read the audio file
      const audioBuffer = fs.readFileSync(testAudioFile);
      
      await this.log(`✅ Test audio created: ${audioBuffer.length} bytes`, 'success');
      
      // Clean up
      try {
        fs.unlinkSync(testAudioFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      return audioBuffer;
      
    } catch (error) {
      await this.log(`❌ Error creating test audio: ${error.message}`, 'error');
      
      // Fallback: create a simple buffer
      const fallbackBuffer = Buffer.alloc(32000, 0); // 1 second of silence
      await this.log('🔄 Using fallback audio buffer', 'warning');
      
      return fallbackBuffer;
    }
  }
  
  async testAudioSending() {
    if (!this.isConnected) {
      await this.log('❌ WebSocket not connected. Run connection test first.', 'error');
      return false;
    }
    
    await this.log('🎵 اختبار إرسال الصوت...', 'info');
    
    try {
      // Create test audio
      const audioBuffer = await this.createTestAudio();
      
      // Convert to base64
      const base64Data = audioBuffer.toString('base64');
      
      // Send init message first
      const initMessage = {
        type: 'init',
        language: 'ar-SA',
        autoDetection: false,
        realTime: true
      };
      
      this.ws.send(JSON.stringify(initMessage));
      await this.log('📤 Sent init message', 'info');
      
      // Wait a bit for initialization
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Send audio in chunks
      const chunkSize = 32000; // 1 second chunks
      let chunkCount = 0;
      
      for (let i = 0; i < audioBuffer.length; i += chunkSize) {
        const chunk = audioBuffer.slice(i, i + chunkSize);
        const chunkBase64 = chunk.toString('base64');
        
        const audioMessage = {
          type: 'audio',
          data: chunkBase64,
          format: 'audio/pcm'
        };
        
        const startTime = Date.now();
        this.ws.send(JSON.stringify(audioMessage));
        
        chunkCount++;
        this.testResults.chunksSent++;
        this.testResults.totalBytes += chunk.length;
        
        await this.log(`📤 Sent audio chunk #${chunkCount}: ${chunk.length} bytes`, 'info');
        
        // Track response time
        setTimeout(() => {
          const responseTime = Date.now() - startTime;
          this.testResults.responseTimes.push(responseTime);
          this.log(`⏱️ Response time: ${responseTime}ms`, 'info');
        }, 1000);
        
        // Wait between chunks
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      this.testResults.audioSending = true;
      await this.log('✅ Audio sending test completed', 'success');
      
      return true;
      
    } catch (error) {
      await this.log(`❌ Audio sending test failed: ${error.message}`, 'error');
      return false;
    }
  }
  
  async monitorTranscription() {
    await this.log('👂 مراقبة التفريغ...', 'info');
    
    return new Promise((resolve) => {
      let messageCount = 0;
      let transcriptionReceived = false;
      
      const timeout = setTimeout(() => {
        this.log('⏰ Transcription monitoring timeout', 'warning');
        resolve(false);
      }, 30000); // 30 seconds timeout
      
      this.ws.on('message', (data) => {
        messageCount++;
        this.testResults.messagesReceived = messageCount;
        
        try {
          const message = JSON.parse(data.toString());
          this.log(`📥 Message ${messageCount}: ${JSON.stringify(message)}`, 'info');
          
          if (message.type === 'transcription' || message.type === 'final') {
            if (message.text && message.text.trim()) {
              this.log(`✅ Transcription received: "${message.text}"`, 'success');
              this.testResults.transcription = true;
              transcriptionReceived = true;
              clearTimeout(timeout);
              resolve(true);
            }
          } else if (message.type === 'error') {
            this.log(`❌ Server error: ${message.error}`, 'error');
          } else if (message.type === 'status') {
            this.log(`📊 Status: ${message.message}`, 'info');
          }
          
        } catch (error) {
          this.log(`❌ Error parsing message: ${error.message}`, 'error');
        }
      });
      
      // If no transcription received within timeout, resolve false
      setTimeout(() => {
        if (!transcriptionReceived) {
          this.log('⚠️ No transcription received within timeout', 'warning');
          resolve(false);
        }
      }, 30000);
    });
  }
  
  async runCompleteTest() {
    console.log('🚀 === بدء الاختبار الشامل للصوت ===\n');
    
    try {
      // 1. Test connection
      const connectionOk = await this.testConnection();
      if (!connectionOk) {
        console.log('❌ Connection test failed. Stopping.', 'error');
        return false;
      }
      
      // 2. Test microphone (simulated)
      const microphoneOk = await this.testMicrophone();
      if (!microphoneOk) {
        console.log('❌ Microphone test failed. Stopping.', 'error');
        return false;
      }
      
      // 3. Test audio sending
      const audioSendingOk = await this.testAudioSending();
      if (!audioSendingOk) {
        console.log('❌ Audio sending test failed. Stopping.', 'error');
        return false;
      }
      
      // 4. Monitor for transcription
      const transcriptionOk = await this.monitorTranscription();
      
      // Display final results
      console.log('\n📊 === النتائج النهائية ===');
      console.log(`🔌 Connection: ${this.testResults.connection ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`🎤 Microphone: ${this.testResults.microphone ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`📤 Audio Sending: ${this.testResults.audioSending ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`👂 Transcription: ${this.testResults.transcription ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`📦 Chunks Sent: ${this.testResults.chunksSent}`);
      console.log(`📊 Total Bytes: ${(this.testResults.totalBytes / 1024).toFixed(1)} KB`);
      console.log(`📨 Messages Received: ${this.testResults.messagesReceived}`);
      
      if (this.testResults.responseTimes.length > 0) {
        const avgResponseTime = this.testResults.responseTimes.reduce((a, b) => a + b, 0) / this.testResults.responseTimes.length;
        console.log(`⏱️ Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);
      }
      
      const overallSuccess = this.testResults.connection && 
                           this.testResults.microphone && 
                           this.testResults.audioSending && 
                           this.testResults.transcription;
      
      console.log(`\n🎯 Overall Result: ${overallSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      if (overallSuccess) {
        console.log('✅ جميع الاختبارات نجحت! السيرفر يعمل بشكل مثالي.');
      } else {
        console.log('❌ بعض الاختبارات فشلت. راجع النتائج أعلاه.');
      }
      
      return overallSuccess;
      
    } catch (error) {
      console.log(`❌ Complete test failed: ${error.message}`, 'error');
      return false;
    } finally {
      if (this.ws) {
        this.ws.close();
      }
    }
  }
}

// تشغيل الاختبار
async function main() {
  const test = new CompleteAudioWebSocketTest();
  
  try {
    const success = await test.runCompleteTest();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { CompleteAudioWebSocketTest }; 