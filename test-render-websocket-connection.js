const WebSocket = require('ws');
const https = require('https');

// اختبار شامل للاتصال بين WebSocket والسيرفر على Render
async function testRenderWebSocketConnection() {
  console.log('🔍 === اختبار الاتصال الشامل مع Render WebSocket ===\n');
  
  const SERVER_URL = 'wss://ai-voicesum.onrender.com/ws';
  const HTTP_URL = 'https://ai-voicesum.onrender.com/health';
  
  let testResults = {
    httpHealth: false,
    websocketConnection: false,
    websocketInit: false,
    websocketAudio: false,
    messagesReceived: 0,
    errors: [],
    warnings: []
  };

  // اختبار 1: فحص صحة السيرفر HTTP
  console.log('📡 اختبار 1: فحص صحة السيرفر HTTP...');
  try {
    const healthCheck = await new Promise((resolve, reject) => {
      const req = https.get(HTTP_URL, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const healthData = JSON.parse(data);
            console.log('✅ HTTP Health Check:', healthData);
            testResults.httpHealth = true;
            resolve(healthData);
          } catch (e) {
            console.log('⚠️ HTTP response not JSON:', data);
            testResults.httpHealth = true; // Still consider healthy if server responds
            resolve({ status: 'ok', response: data });
          }
        });
      });
      
      req.on('error', (err) => {
        console.error('❌ HTTP Health Check failed:', err.message);
        testResults.errors.push(`HTTP Health Check: ${err.message}`);
        reject(err);
      });
      
      req.setTimeout(10000, () => {
        console.error('⏰ HTTP Health Check timeout');
        testResults.errors.push('HTTP Health Check timeout');
        req.destroy();
        reject(new Error('HTTP Health Check timeout'));
      });
    });
    
    console.log('✅ HTTP Health Check successful\n');
  } catch (error) {
    console.error('❌ HTTP Health Check failed:', error.message);
    testResults.errors.push(`HTTP Health Check: ${error.message}`);
  }

  // اختبار 2: فحص الاتصال WebSocket
  console.log('🔌 اختبار 2: فحص الاتصال WebSocket...');
  try {
    const wsTest = await new Promise((resolve, reject) => {
      const ws = new WebSocket(SERVER_URL);
      let initSent = false;
      let audioSent = false;
      let messagesReceived = 0;
      
      const timeout = setTimeout(() => {
        console.log('⏰ WebSocket test timeout');
        ws.close();
        resolve({ connected: false, reason: 'timeout' });
      }, 15000);
      
      ws.on('open', () => {
        console.log('✅ WebSocket connected successfully');
        testResults.websocketConnection = true;
        
        // إرسال رسالة init
        setTimeout(() => {
          const initMessage = {
            type: 'init',
            language: 'ar-SA',
            autoDetection: false,
            realTime: true
          };
          
          console.log('📤 Sending init message:', initMessage);
          ws.send(JSON.stringify(initMessage));
          initSent = true;
        }, 1000);
      });
      
      ws.on('message', (data) => {
        messagesReceived++;
        testResults.messagesReceived = messagesReceived;
        
        try {
          const message = JSON.parse(data.toString());
          console.log(`📥 Message ${messagesReceived}:`, message);
          
          // التحقق من استجابة init
          if (message.type === 'status' && initSent && !audioSent) {
            console.log('✅ Init message acknowledged');
            testResults.websocketInit = true;
            
            // إرسال اختبار صوتي
            setTimeout(() => {
              const audioTest = {
                type: 'audio',
                data: Buffer.alloc(32000, 0).toString('base64'), // 1 second of silence
                format: 'audio/pcm'
              };
              
              console.log('📤 Sending audio test (32KB PCM silence)');
              ws.send(JSON.stringify(audioTest));
              audioSent = true;
            }, 1000);
          }
          
          // التحقق من استجابة الصوت
          if (message.type === 'transcription' || message.type === 'final' || message.type === 'warning') {
            console.log('✅ Audio processing acknowledged');
            testResults.websocketAudio = true;
          }
          
        } catch (parseError) {
          console.log(`📥 Raw message ${messagesReceived}:`, data.toString().substring(0, 100));
        }
      });
      
      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        testResults.errors.push(`WebSocket Error: ${error.message}`);
        clearTimeout(timeout);
        reject(error);
      });
      
      ws.on('close', (code, reason) => {
        console.log(`🔒 WebSocket closed: ${code} - ${reason}`);
        clearTimeout(timeout);
        resolve({ 
          connected: true, 
          messagesReceived,
          initSent,
          audioSent,
          code,
          reason: reason.toString()
        });
      });
    });
    
    console.log('✅ WebSocket test completed\n');
  } catch (error) {
    console.error('❌ WebSocket test failed:', error.message);
    testResults.errors.push(`WebSocket Test: ${error.message}`);
  }

  // اختبار 3: اختبار ping/pong
  console.log('🏓 اختبار 3: اختبار ping/pong...');
  try {
    const pingTest = await new Promise((resolve, reject) => {
      const ws = new WebSocket(SERVER_URL);
      let pongReceived = false;
      
      const timeout = setTimeout(() => {
        console.log('⏰ Ping test timeout');
        ws.close();
        resolve({ pingSuccess: false, reason: 'timeout' });
      }, 10000);
      
      ws.on('open', () => {
        console.log('✅ WebSocket connected for ping test');
        
        setTimeout(() => {
          const pingMessage = { type: 'ping' };
          console.log('📤 Sending ping message');
          ws.send(JSON.stringify(pingMessage));
        }, 1000);
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'pong') {
            console.log('✅ Pong received');
            pongReceived = true;
            clearTimeout(timeout);
            ws.close();
            resolve({ pingSuccess: true });
          }
        } catch (e) {
          // Ignore non-JSON messages
        }
      });
      
      ws.on('error', (error) => {
        console.error('❌ Ping test error:', error.message);
        clearTimeout(timeout);
        reject(error);
      });
      
      ws.on('close', () => {
        if (!pongReceived) {
          console.log('⚠️ No pong received');
          resolve({ pingSuccess: false, reason: 'no_pong' });
        }
      });
    });
    
    if (pingTest.pingSuccess) {
      console.log('✅ Ping/pong test successful\n');
    } else {
      console.log('⚠️ Ping/pong test failed:', pingTest.reason);
      testResults.warnings.push(`Ping/Pong: ${pingTest.reason}`);
    }
  } catch (error) {
    console.error('❌ Ping test failed:', error.message);
    testResults.errors.push(`Ping Test: ${error.message}`);
  }

  // عرض النتائج النهائية
  console.log('📊 === نتائج الاختبار الشامل ===');
  console.log(`✅ HTTP Health: ${testResults.httpHealth ? 'PASS' : 'FAIL'}`);
  console.log(`✅ WebSocket Connection: ${testResults.websocketConnection ? 'PASS' : 'FAIL'}`);
  console.log(`✅ WebSocket Init: ${testResults.websocketInit ? 'PASS' : 'FAIL'}`);
  console.log(`✅ WebSocket Audio: ${testResults.websocketAudio ? 'PASS' : 'FAIL'}`);
  console.log(`📨 Messages Received: ${testResults.messagesReceived}`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Errors:');
    testResults.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  if (testResults.warnings.length > 0) {
    console.log('\n⚠️ Warnings:');
    testResults.warnings.forEach(warning => console.log(`  - ${warning}`));
  }
  
  // تقييم عام
  const overallStatus = testResults.httpHealth && testResults.websocketConnection;
  console.log(`\n🎯 Overall Status: ${overallStatus ? '✅ CONNECTED' : '❌ DISCONNECTED'}`);
  
  if (overallStatus) {
    console.log('✅ الاتصال مع Render WebSocket يعمل بشكل صحيح');
  } else {
    console.log('❌ هناك مشاكل في الاتصال مع Render WebSocket');
    console.log('💡 اقتراحات للتصحيح:');
    console.log('  1. تأكد من أن السيرفر يعمل على Render');
    console.log('  2. تحقق من متغيرات البيئة (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION)');
    console.log('  3. تحقق من سجلات Render للبحث عن أخطاء');
    console.log('  4. تأكد من أن WebSocket endpoint صحيح (/ws)');
  }
  
  return testResults;
}

// تشغيل الاختبار
if (require.main === module) {
  testRenderWebSocketConnection()
    .then(results => {
      console.log('\n🏁 اختبار الاتصال مكتمل');
      process.exit(results.httpHealth && results.websocketConnection ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ اختبار الاتصال فشل:', error);
      process.exit(1);
    });
}

module.exports = { testRenderWebSocketConnection }; 