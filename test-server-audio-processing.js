const WebSocket = require('ws');
const https = require('https');

class ServerAudioProcessingTest {
  constructor() {
    this.testResults = {
      serverHealth: false,
      websocketConnection: false,
      audioProcessing: false,
      azureSpeechService: false,
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
  
  async testServerHealth() {
    await this.log('📡 فحص صحة السيرفر...', 'info');
    
    try {
      const healthResponse = await new Promise((resolve, reject) => {
        const req = https.get('https://ai-voicesum.onrender.com/health', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const healthData = JSON.parse(data);
              this.log('✅ Server Health:', 'success');
              console.log('   Status:', healthData.status);
              console.log('   API Key:', healthData.apiKey);
              console.log('   Timestamp:', healthData.timestamp);
              
              this.testResults.serverHealth = true;
              this.testResults.azureSpeechService = healthData.apiKey === 'Present';
              
              resolve(healthData);
            } catch (e) {
              this.log('⚠️ Health response not JSON:', 'warning');
              console.log('   Raw response:', data);
              this.testResults.serverHealth = true;
              resolve({ status: 'ok', response: data });
            }
          });
        });
        
        req.on('error', reject);
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Health check timeout'));
        });
      });
      
      return true;
      
    } catch (error) {
      this.log(`❌ Server health check failed: ${error.message}`, 'error');
      return false;
    }
  }
  
  async testWebSocketWithDetailedLogging() {
    await this.log('🔌 اختبار WebSocket مع تسجيل مفصل...', 'info');
    
    try {
      const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
      
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.log('⏰ WebSocket connection timeout', 'error');
          ws.close();
          reject(new Error('WebSocket timeout'));
        }, 15000);
        
        ws.on('open', () => {
          this.log('✅ WebSocket connected', 'success');
          clearTimeout(timeout);
          this.testResults.websocketConnection = true;
          
          // Send init message
          setTimeout(() => {
            const initMessage = {
              type: 'init',
              language: 'ar-SA',
              autoDetection: false,
              realTime: true
            };
            
            this.log('📤 Sending init message...', 'info');
            ws.send(JSON.stringify(initMessage));
            
            // Send test audio after 2 seconds
            setTimeout(() => {
              this.log('🎵 Sending test audio...', 'info');
              
              // Create test audio (1 second of silence)
              const audioBuffer = Buffer.alloc(32000, 0);
              const base64Data = audioBuffer.toString('base64');
              
              const audioMessage = {
                type: 'audio',
                data: base64Data,
                format: 'audio/pcm'
              };
              
              ws.send(JSON.stringify(audioMessage));
              this.log(`📤 Sent audio: ${audioBuffer.length} bytes`, 'info');
              
              // Monitor for responses
              let messageCount = 0;
              ws.on('message', (data) => {
                messageCount++;
                this.log(`📥 Message ${messageCount} received`, 'info');
                
                try {
                  const message = JSON.parse(data.toString());
                  this.log(`   Type: ${message.type}`, 'info');
                  
                  if (message.type === 'transcription' || message.type === 'final') {
                    this.log(`   Text: "${message.text}"`, 'success');
                    this.testResults.audioProcessing = true;
                  } else if (message.type === 'error') {
                    this.log(`   Error: ${message.error}`, 'error');
                    this.testResults.errors.push(message.error);
                  } else if (message.type === 'status') {
                    this.log(`   Status: ${message.message}`, 'info');
                  } else {
                    this.log(`   Content: ${JSON.stringify(message)}`, 'info');
                  }
                  
                } catch (parseError) {
                  this.log(`   Raw data: ${data.toString().substring(0, 100)}`, 'info');
                }
              });
              
              // Close after 10 seconds
              setTimeout(() => {
                this.log('🔄 Closing connection...', 'info');
                ws.close();
                resolve(true);
              }, 10000);
              
            }, 2000);
            
          }, 1000);
        });
        
        ws.on('error', (error) => {
          this.log(`❌ WebSocket error: ${error.message}`, 'error');
          clearTimeout(timeout);
          reject(error);
        });
        
        ws.on('close', (code, reason) => {
          this.log(`🔒 WebSocket closed: ${code} - ${reason}`, 'info');
          clearTimeout(timeout);
          resolve(false);
        });
      });
      
      return result;
      
    } catch (error) {
      this.log(`❌ WebSocket test failed: ${error.message}`, 'error');
      return false;
    }
  }
  
  async testDifferentAudioFormats() {
    await this.log('🎵 اختبار تنسيقات صوتية مختلفة...', 'info');
    
    const formats = [
      { name: 'PCM Silence', data: Buffer.alloc(32000, 0), format: 'audio/pcm' },
      { name: 'PCM Noise', data: Buffer.alloc(32000, 65), format: 'audio/pcm' }, // 'A' character
      { name: 'PCM Sine Wave', data: this.generateSineWave(440, 1), format: 'audio/pcm' }
    ];
    
    for (const format of formats) {
      await this.log(`🎵 اختبار ${format.name}...`, 'info');
      
      try {
        const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
        
        const result = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            this.log(`⏰ ${format.name} test timeout`, 'warning');
            ws.close();
            resolve(false);
          }, 10000);
          
          ws.on('open', () => {
            this.log(`✅ Connected for ${format.name} test`, 'success');
            
            setTimeout(() => {
              const initMessage = {
                type: 'init',
                language: 'ar-SA',
                autoDetection: false,
                realTime: true
              };
              
              ws.send(JSON.stringify(initMessage));
              this.log(`📤 Sent init for ${format.name}`, 'info');
              
              setTimeout(() => {
                const base64Data = format.data.toString('base64');
                const audioMessage = {
                  type: 'audio',
                  data: base64Data,
                  format: format.format
                };
                
                ws.send(JSON.stringify(audioMessage));
                this.log(`📤 Sent ${format.name}: ${format.data.length} bytes`, 'info');
                
                let responseReceived = false;
                ws.on('message', (data) => {
                  try {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'transcription' || message.type === 'final') {
                      this.log(`✅ ${format.name} transcription: "${message.text}"`, 'success');
                      responseReceived = true;
                    } else if (message.type === 'error') {
                      this.log(`❌ ${format.name} error: ${message.error}`, 'error');
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                });
                
                setTimeout(() => {
                  clearTimeout(timeout);
                  ws.close();
                  resolve(responseReceived);
                }, 5000);
                
              }, 2000);
            }, 1000);
          });
          
          ws.on('error', (error) => {
            this.log(`❌ ${format.name} WebSocket error: ${error.message}`, 'error');
            clearTimeout(timeout);
            resolve(false);
          });
          
          ws.on('close', () => {
            clearTimeout(timeout);
            resolve(false);
          });
        });
        
        if (result) {
          this.log(`✅ ${format.name} test successful`, 'success');
        } else {
          this.log(`❌ ${format.name} test failed`, 'error');
        }
        
      } catch (error) {
        this.log(`❌ ${format.name} test error: ${error.message}`, 'error');
      }
    }
  }
  
  generateSineWave(frequency, duration) {
    const sampleRate = 16000;
    const samples = duration * sampleRate;
    const buffer = Buffer.alloc(samples * 2); // 16-bit samples
    
    for (let i = 0; i < samples; i++) {
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate);
      const value = Math.floor(sample * 32767); // Convert to 16-bit
      buffer.writeInt16LE(value, i * 2);
    }
    
    return buffer;
  }
  
  async runServerTest() {
    console.log('🔍 === اختبار معالجة الصوت على السيرفر ===\n');
    
    try {
      // 1. Test server health
      const healthOk = await this.testServerHealth();
      if (!healthOk) {
        console.log('❌ Server health check failed. Stopping.', 'error');
        return false;
      }
      
      // 2. Test WebSocket with detailed logging
      const wsOk = await this.testWebSocketWithDetailedLogging();
      
      // 3. Test different audio formats
      await this.testDifferentAudioFormats();
      
      // Display final results
      console.log('\n📊 === النتائج النهائية ===');
      console.log(`📡 Server Health: ${this.testResults.serverHealth ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`🔌 WebSocket: ${this.testResults.websocketConnection ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`🎵 Audio Processing: ${this.testResults.audioProcessing ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`🔑 Azure Speech Service: ${this.testResults.azureSpeechService ? '✅ Present' : '❌ Missing'}`);
      
      if (this.testResults.errors.length > 0) {
        console.log('\n❌ Server Errors:');
        this.testResults.errors.forEach(error => {
          console.log(`  - ${error}`);
        });
      }
      
      // Analysis
      console.log('\n🔍 === تحليل المشكلة ===');
      
      if (!this.testResults.azureSpeechService) {
        console.log('❌ المشكلة الرئيسية: Azure Speech Service غير مُفعّل');
        console.log('💡 الحل: تأكد من تعيين متغيرات البيئة AZURE_SPEECH_KEY و AZURE_SPEECH_REGION');
      } else if (!this.testResults.audioProcessing) {
        console.log('❌ المشكلة: Azure Speech Service مُفعّل لكن لا يعالج الصوت');
        console.log('💡 الأسباب المحتملة:');
        console.log('  1. مشكلة في تنسيق الصوت المرسل');
        console.log('  2. مشكلة في إعدادات اللغة');
        console.log('  3. مشكلة في Azure Speech Service نفسه');
        console.log('  4. مشكلة في معالجة الصوت على السيرفر');
      } else {
        console.log('✅ كل شيء يعمل بشكل صحيح!');
      }
      
      return this.testResults.audioProcessing;
      
    } catch (error) {
      console.log(`❌ Server test failed: ${error.message}`, 'error');
      return false;
    }
  }
}

// تشغيل الاختبار
async function main() {
  const test = new ServerAudioProcessingTest();
  
  try {
    const success = await test.runServerTest();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ServerAudioProcessingTest }; 