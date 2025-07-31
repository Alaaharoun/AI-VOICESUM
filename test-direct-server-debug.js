const WebSocket = require('ws');

class DirectServerDebugTest {
  constructor() {
    this.testResults = {
      connection: false,
      initResponse: false,
      audioProcessing: false,
      transcriptionReceived: false,
      serverErrors: []
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
  
  async testDirectServerCommunication() {
    console.log('🔍 === اختبار مباشر للتواصل مع السيرفر ===\n');
    
    try {
      const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
      
      const result = await new Promise((resolve) => {
        let initSent = false;
        let audioSent = false;
        let messagesReceived = 0;
        let transcriptionReceived = false;
        
        const timeout = setTimeout(() => {
          this.log('⏰ Test timeout', 'warning');
          ws.close();
          resolve({
            connection: true,
            initResponse: this.testResults.initResponse,
            audioProcessing: this.testResults.audioProcessing,
            transcriptionReceived,
            messagesReceived
          });
        }, 20000);
        
        ws.on('open', () => {
          this.log('✅ WebSocket connected', 'success');
          this.testResults.connection = true;
          
          // Send init message
          setTimeout(() => {
            const initMessage = {
              type: 'init',
              language: 'en-US', // Try English first
              autoDetection: false,
              realTime: true
            };
            
            this.log('📤 Sending init message (English)...', 'info');
            ws.send(JSON.stringify(initMessage));
            initSent = true;
            
            // Send audio after 3 seconds
            setTimeout(() => {
              this.log('🎵 Sending test audio...', 'info');
              
              // Create a simple audio buffer with some variation
              const audioBuffer = Buffer.alloc(32000);
              for (let i = 0; i < audioBuffer.length; i += 2) {
                // Create a simple sine wave pattern
                const value = Math.floor(Math.sin(i / 100) * 1000);
                audioBuffer.writeInt16LE(value, i);
              }
              
              const base64Data = audioBuffer.toString('base64');
              const audioMessage = {
                type: 'audio',
                data: base64Data,
                format: 'audio/pcm'
              };
              
              ws.send(JSON.stringify(audioMessage));
              this.log(`📤 Sent audio: ${audioBuffer.length} bytes`, 'info');
              audioSent = true;
              
            }, 3000);
          }, 1000);
        });
        
        ws.on('message', (data) => {
          messagesReceived++;
          this.log(`📥 Message ${messagesReceived} received`, 'info');
          
          try {
            const message = JSON.parse(data.toString());
            this.log(`   Type: ${message.type}`, 'info');
            
            if (message.type === 'status' && !initSent) {
              this.log(`   Status: ${message.message}`, 'success');
              this.testResults.initResponse = true;
            } else if (message.type === 'transcription' || message.type === 'final') {
              this.log(`   Transcription: "${message.text}"`, 'success');
              transcriptionReceived = true;
              this.testResults.transcriptionReceived = true;
            } else if (message.type === 'error') {
              this.log(`   Error: ${message.error}`, 'error');
              this.testResults.serverErrors.push(message.error);
            } else if (message.type === 'warning') {
              this.log(`   Warning: ${message.message}`, 'warning');
            } else {
              this.log(`   Content: ${JSON.stringify(message)}`, 'info');
            }
            
          } catch (parseError) {
            this.log(`   Raw data: ${data.toString().substring(0, 100)}`, 'info');
          }
        });
        
        ws.on('error', (error) => {
          this.log(`❌ WebSocket error: ${error.message}`, 'error');
          clearTimeout(timeout);
          resolve({
            connection: false,
            initResponse: false,
            audioProcessing: false,
            transcriptionReceived: false,
            messagesReceived: 0
          });
        });
        
        ws.on('close', (code, reason) => {
          this.log(`🔒 WebSocket closed: ${code} - ${reason}`, 'info');
          clearTimeout(timeout);
          resolve({
            connection: this.testResults.connection,
            initResponse: this.testResults.initResponse,
            audioProcessing: audioSent,
            transcriptionReceived,
            messagesReceived
          });
        });
      });
      
      return result;
      
    } catch (error) {
      this.log(`❌ Test failed: ${error.message}`, 'error');
      return {
        connection: false,
        initResponse: false,
        audioProcessing: false,
        transcriptionReceived: false,
        messagesReceived: 0
      };
    }
  }
  
  async testWithDifferentLanguages() {
    console.log('\n🌍 === اختبار لغات مختلفة ===\n');
    
    const languages = [
      { code: 'en-US', name: 'English (US)' },
      { code: 'ar-SA', name: 'Arabic (Saudi Arabia)' },
      { code: 'auto', name: 'Auto Detection' }
    ];
    
    for (const lang of languages) {
      this.log(`🌍 اختبار اللغة: ${lang.name} (${lang.code})`, 'info');
      
      try {
        const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
        
        const result = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            this.log(`⏰ ${lang.name} test timeout`, 'warning');
            ws.close();
            resolve(false);
          }, 10000);
          
          ws.on('open', () => {
            this.log(`✅ Connected for ${lang.name}`, 'success');
            
            setTimeout(() => {
              const initMessage = {
                type: 'init',
                language: lang.code,
                autoDetection: lang.code === 'auto',
                realTime: true
              };
              
              this.log(`📤 Sending init for ${lang.name}`, 'info');
              ws.send(JSON.stringify(initMessage));
              
              setTimeout(() => {
                // Create test audio
                const audioBuffer = Buffer.alloc(32000);
                for (let i = 0; i < audioBuffer.length; i += 2) {
                  const value = Math.floor(Math.sin(i / 50) * 2000);
                  audioBuffer.writeInt16LE(value, i);
                }
                
                const base64Data = audioBuffer.toString('base64');
                const audioMessage = {
                  type: 'audio',
                  data: base64Data,
                  format: 'audio/pcm'
                };
                
                ws.send(JSON.stringify(audioMessage));
                this.log(`📤 Sent audio for ${lang.name}`, 'info');
                
                let transcriptionReceived = false;
                ws.on('message', (data) => {
                  try {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'transcription' || message.type === 'final') {
                      this.log(`✅ ${lang.name} transcription: "${message.text}"`, 'success');
                      transcriptionReceived = true;
                    } else if (message.type === 'error') {
                      this.log(`❌ ${lang.name} error: ${message.error}`, 'error');
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                });
                
                setTimeout(() => {
                  clearTimeout(timeout);
                  ws.close();
                  resolve(transcriptionReceived);
                }, 5000);
                
              }, 2000);
            }, 1000);
          });
          
          ws.on('error', (error) => {
            this.log(`❌ ${lang.name} WebSocket error: ${error.message}`, 'error');
            clearTimeout(timeout);
            resolve(false);
          });
          
          ws.on('close', () => {
            clearTimeout(timeout);
            resolve(false);
          });
        });
        
        if (result) {
          this.log(`✅ ${lang.name} test successful`, 'success');
        } else {
          this.log(`❌ ${lang.name} test failed`, 'error');
        }
        
      } catch (error) {
        this.log(`❌ ${lang.name} test error: ${error.message}`, 'error');
      }
    }
  }
  
  async runCompleteDebug() {
    console.log('🚀 === بدء الاختبار الشامل للتصحيح ===\n');
    
    try {
      // 1. Test direct server communication
      const directResult = await this.testDirectServerCommunication();
      
      // 2. Test with different languages
      await this.testWithDifferentLanguages();
      
      // Display final results
      console.log('\n📊 === النتائج النهائية ===');
      console.log(`🔌 Connection: ${directResult.connection ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`📤 Init Response: ${directResult.initResponse ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`🎵 Audio Processing: ${directResult.audioProcessing ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`👂 Transcription: ${directResult.transcriptionReceived ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`📨 Messages Received: ${directResult.messagesReceived}`);
      
      if (this.testResults.serverErrors.length > 0) {
        console.log('\n❌ Server Errors:');
        this.testResults.serverErrors.forEach(error => {
          console.log(`  - ${error}`);
        });
      }
      
      // Final analysis
      console.log('\n🔍 === التحليل النهائي ===');
      
      if (!directResult.connection) {
        console.log('❌ المشكلة: لا يمكن الاتصال بالسيرفر');
        console.log('💡 الحل: تحقق من حالة السيرفر على Render');
      } else if (!directResult.initResponse) {
        console.log('❌ المشكلة: السيرفر لا يستجيب لرسائل التهيئة');
        console.log('💡 الحل: تحقق من كود السيرفر');
      } else if (!directResult.audioProcessing) {
        console.log('❌ المشكلة: السيرفر لا يعالج الصوت');
        console.log('💡 الحل: تحقق من معالجة الصوت في الكود');
      } else if (!directResult.transcriptionReceived) {
        console.log('❌ المشكلة: السيرفر يعالج الصوت لكن لا يرسل التفريغ');
        console.log('💡 الأسباب المحتملة:');
        console.log('  1. مشكلة في Azure Speech Service');
        console.log('  2. مشكلة في إعدادات اللغة');
        console.log('  3. مشكلة في معالجة الصوت');
        console.log('  4. الصوت لا يحتوي على كلام واضح');
      } else {
        console.log('✅ كل شيء يعمل بشكل صحيح!');
      }
      
      return directResult.transcriptionReceived;
      
    } catch (error) {
      console.log(`❌ Complete debug failed: ${error.message}`, 'error');
      return false;
    }
  }
}

// تشغيل الاختبار
async function main() {
  const test = new DirectServerDebugTest();
  
  try {
    const success = await test.runCompleteDebug();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { DirectServerDebugTest }; 