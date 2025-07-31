const WebSocket = require('ws');

class AudioTranscriptionDebugTest {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.testResults = {
      connection: false,
      init: false,
      audioSent: false,
      messagesReceived: 0,
      transcriptionReceived: false,
      errors: []
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
    await this.log('🔌 اختبار الاتصال...', 'info');
    
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
  
  async testInitMessage() {
    if (!this.isConnected) {
      await this.log('❌ WebSocket not connected', 'error');
      return false;
    }
    
    await this.log('📤 اختبار رسالة التهيئة...', 'info');
    
    try {
      const initMessage = {
        type: 'init',
        language: 'ar-SA',
        autoDetection: false,
        realTime: true
      };
      
      this.ws.send(JSON.stringify(initMessage));
      await this.log('📤 Sent init message', 'info');
      
      // Wait for response
      const response = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.log('⏰ No init response received', 'warning');
          resolve(null);
        }, 5000);
        
        this.ws.once('message', (data) => {
          clearTimeout(timeout);
          try {
            const message = JSON.parse(data.toString());
            this.log(`📥 Init response: ${JSON.stringify(message)}`, 'info');
            resolve(message);
          } catch (error) {
            this.log(`❌ Error parsing init response: ${error.message}`, 'error');
            resolve(null);
          }
        });
      });
      
      if (response && (response.type === 'status' || response.type === 'ready')) {
        this.testResults.init = true;
        await this.log('✅ Init message acknowledged', 'success');
        return true;
      } else {
        await this.log('⚠️ No proper init response received', 'warning');
        return false;
      }
      
    } catch (error) {
      await this.log(`❌ Init test error: ${error.message}`, 'error');
      return false;
    }
  }
  
  async testAudioSending() {
    if (!this.isConnected) {
      await this.log('❌ WebSocket not connected', 'error');
      return false;
    }
    
    await this.log('🎵 اختبار إرسال الصوت...', 'info');
    
    try {
      // Create a simple audio buffer (1 second of silence)
      const audioBuffer = Buffer.alloc(32000, 0);
      const base64Data = audioBuffer.toString('base64');
      
      const audioMessage = {
        type: 'audio',
        data: base64Data,
        format: 'audio/pcm'
      };
      
      this.ws.send(JSON.stringify(audioMessage));
      await this.log(`📤 Sent audio chunk: ${audioBuffer.length} bytes`, 'info');
      
      this.testResults.audioSent = true;
      await this.log('✅ Audio sending test completed', 'success');
      
      return true;
      
    } catch (error) {
      await this.log(`❌ Audio sending test error: ${error.message}`, 'error');
      return false;
    }
  }
  
  async monitorMessages() {
    await this.log('👂 مراقبة الرسائل من السيرفر...', 'info');
    
    return new Promise((resolve) => {
      let messageCount = 0;
      let transcriptionReceived = false;
      let errorReceived = false;
      
      const timeout = setTimeout(() => {
        this.log('⏰ Message monitoring timeout', 'warning');
        resolve({
          messagesReceived: messageCount,
          transcriptionReceived,
          errorReceived
        });
      }, 30000); // 30 seconds
      
      this.ws.on('message', (data) => {
        messageCount++;
        this.testResults.messagesReceived = messageCount;
        
        try {
          const message = JSON.parse(data.toString());
          this.log(`📥 Message ${messageCount}: ${JSON.stringify(message)}`, 'info');
          
          if (message.type === 'transcription' || message.type === 'final') {
            if (message.text && message.text.trim()) {
              this.log(`✅ Transcription received: "${message.text}"`, 'success');
              transcriptionReceived = true;
              this.testResults.transcriptionReceived = true;
            } else {
              this.log(`⚠️ Empty transcription received`, 'warning');
            }
          } else if (message.type === 'error') {
            this.log(`❌ Server error: ${message.error}`, 'error');
            errorReceived = true;
            this.testResults.errors.push(message.error);
          } else if (message.type === 'status') {
            this.log(`📊 Status: ${message.message}`, 'info');
          } else if (message.type === 'warning') {
            this.log(`⚠️ Warning: ${message.message}`, 'warning');
          } else {
            this.log(`📦 Unknown message type: ${message.type}`, 'info');
          }
          
        } catch (error) {
          this.log(`❌ Error parsing message: ${error.message}`, 'error');
        }
      });
      
      // Also check for raw messages
      this.ws.on('message', (data) => {
        const rawData = data.toString();
        if (rawData.length < 100) { // Only log short raw messages
          this.log(`📦 Raw message: ${rawData}`, 'info');
        }
      });
    });
  }
  
  async testPingPong() {
    await this.log('🏓 اختبار Ping/Pong...', 'info');
    
    try {
      const pingMessage = { type: 'ping' };
      this.ws.send(JSON.stringify(pingMessage));
      await this.log('📤 Sent ping message', 'info');
      
      const response = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.log('⏰ No pong response', 'warning');
          resolve(null);
        }, 5000);
        
        this.ws.once('message', (data) => {
          clearTimeout(timeout);
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'pong') {
              this.log('✅ Pong received', 'success');
              resolve(message);
            } else {
              this.log(`📥 Non-pong response: ${JSON.stringify(message)}`, 'info');
              resolve(null);
            }
          } catch (error) {
            this.log(`❌ Error parsing pong response: ${error.message}`, 'error');
            resolve(null);
          }
        });
      });
      
      return response !== null;
      
    } catch (error) {
      await this.log(`❌ Ping/Pong test error: ${error.message}`, 'error');
      return false;
    }
  }
  
  async runDebugTest() {
    console.log('🔍 === اختبار تصحيح مشكلة التفريغ ===\n');
    
    try {
      // 1. Test connection
      const connectionOk = await this.testConnection();
      if (!connectionOk) {
        console.log('❌ Connection test failed. Stopping.', 'error');
        return false;
      }
      
      // 2. Test ping/pong
      const pingOk = await this.testPingPong();
      if (!pingOk) {
        console.log('⚠️ Ping/Pong test failed, but continuing...', 'warning');
      }
      
      // 3. Test init message
      const initOk = await this.testInitMessage();
      if (!initOk) {
        console.log('⚠️ Init test failed, but continuing...', 'warning');
      }
      
      // 4. Test audio sending
      const audioOk = await this.testAudioSending();
      if (!audioOk) {
        console.log('❌ Audio sending test failed. Stopping.', 'error');
        return false;
      }
      
      // 5. Monitor messages
      const messageResults = await this.monitorMessages();
      
      // Display final results
      console.log('\n📊 === النتائج النهائية ===');
      console.log(`🔌 Connection: ${this.testResults.connection ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`📤 Init: ${this.testResults.init ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`🎵 Audio Sending: ${this.testResults.audioSent ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`👂 Transcription: ${this.testResults.transcriptionReceived ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`📨 Messages Received: ${this.testResults.messagesReceived}`);
      console.log(`🏓 Ping/Pong: ${pingOk ? '✅ PASS' : '❌ FAIL'}`);
      
      if (this.testResults.errors.length > 0) {
        console.log('\n❌ Server Errors:');
        this.testResults.errors.forEach(error => {
          console.log(`  - ${error}`);
        });
      }
      
      // Analysis
      console.log('\n🔍 === تحليل المشكلة ===');
      
      if (this.testResults.connection && this.testResults.audioSent) {
        if (this.testResults.transcriptionReceived) {
          console.log('✅ كل شيء يعمل بشكل صحيح!');
        } else if (this.testResults.messagesReceived === 0) {
          console.log('❌ المشكلة: السيرفر لا يرسل أي رسائل');
          console.log('💡 الأسباب المحتملة:');
          console.log('  1. مشكلة في Azure Speech Service');
          console.log('  2. مشكلة في معالجة الصوت على السيرفر');
          console.log('  3. مشكلة في إعدادات اللغة');
          console.log('  4. مشكلة في متغيرات البيئة');
        } else {
          console.log('⚠️ المشكلة: السيرفر يرسل رسائل لكن لا يوجد تفريغ');
          console.log('💡 الأسباب المحتملة:');
          console.log('  1. الصوت لا يحتوي على كلام واضح');
          console.log('  2. مشكلة في إعدادات اللغة');
          console.log('  3. مشكلة في Azure Speech Service');
        }
      } else {
        console.log('❌ مشكلة في الاتصال أو إرسال الصوت');
      }
      
      return this.testResults.transcriptionReceived;
      
    } catch (error) {
      console.log(`❌ Debug test failed: ${error.message}`, 'error');
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
  const test = new AudioTranscriptionDebugTest();
  
  try {
    const success = await test.runDebugTest();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { AudioTranscriptionDebugTest }; 