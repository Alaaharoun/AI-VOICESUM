const https = require('https');
const WebSocket = require('ws');

async function quickRenderStatusCheck() {
  console.log('🔍 === فحص سريع لحالة Render ===\n');
  
  const results = {
    httpHealth: false,
    websocketConnection: false,
    pingPong: false,
    serverStatus: 'unknown'
  };
  
  // اختبار HTTP Health
  console.log('📡 فحص HTTP Health...');
  try {
    const healthResponse = await new Promise((resolve, reject) => {
      const req = https.get('https://ai-voicesum.onrender.com/health', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const healthData = JSON.parse(data);
            console.log('✅ HTTP Health:', healthData);
            results.httpHealth = true;
            results.serverStatus = healthData.status;
            resolve(healthData);
          } catch (e) {
            console.log('⚠️ HTTP response not JSON:', data);
            results.httpHealth = true;
            resolve({ status: 'ok', response: data });
          }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('HTTP timeout'));
      });
    });
    
    console.log('✅ HTTP Health Check: PASS\n');
  } catch (error) {
    console.log('❌ HTTP Health Check: FAIL -', error.message);
  }
  
  // اختبار WebSocket Connection
  console.log('🔌 فحص WebSocket Connection...');
  try {
    const wsTest = await new Promise((resolve) => {
      const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
      
      const timeout = setTimeout(() => {
        console.log('⏰ WebSocket timeout');
        ws.close();
        resolve({ connected: false });
      }, 10000);
      
      ws.on('open', () => {
        console.log('✅ WebSocket connected');
        results.websocketConnection = true;
        
        // اختبار ping/pong
        setTimeout(() => {
          ws.send(JSON.stringify({ type: 'ping' }));
          console.log('📤 Sent ping message');
        }, 1000);
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'pong') {
            console.log('✅ Pong received');
            results.pingPong = true;
            clearTimeout(timeout);
            ws.close();
            resolve({ connected: true, pingPong: true });
          }
        } catch (e) {
          // Ignore non-JSON messages
        }
      });
      
      ws.on('error', (error) => {
        console.log('❌ WebSocket error:', error.message);
        clearTimeout(timeout);
        resolve({ connected: false, error: error.message });
      });
      
      ws.on('close', () => {
        clearTimeout(timeout);
        resolve({ connected: true, pingPong: results.pingPong });
      });
    });
    
    if (wsTest.connected) {
      console.log('✅ WebSocket Connection: PASS');
      if (wsTest.pingPong) {
        console.log('✅ Ping/Pong: PASS\n');
      } else {
        console.log('⚠️ Ping/Pong: FAIL\n');
      }
    } else {
      console.log('❌ WebSocket Connection: FAIL\n');
    }
  } catch (error) {
    console.log('❌ WebSocket test failed:', error.message);
  }
  
  // عرض النتائج النهائية
  console.log('📊 === النتائج النهائية ===');
  console.log(`🌐 Server Status: ${results.serverStatus}`);
  console.log(`📡 HTTP Health: ${results.httpHealth ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🔌 WebSocket: ${results.websocketConnection ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`🏓 Ping/Pong: ${results.pingPong ? '✅ PASS' : '❌ FAIL'}`);
  
  const overallStatus = results.httpHealth && results.websocketConnection;
  console.log(`\n🎯 Overall: ${overallStatus ? '✅ CONNECTED' : '❌ DISCONNECTED'}`);
  
  if (overallStatus) {
    console.log('✅ السيرفر على Render يعمل بشكل صحيح');
    console.log('💡 يمكنك الآن استخدام التطبيق');
  } else {
    console.log('❌ هناك مشاكل في السيرفر');
    console.log('💡 تحقق من:');
    console.log('  - حالة السيرفر على Render');
    console.log('  - متغيرات البيئة');
    console.log('  - سجلات الأخطاء');
  }
  
  return results;
}

// تشغيل الاختبار
if (require.main === module) {
  quickRenderStatusCheck()
    .then(results => {
      process.exit(results.httpHealth && results.websocketConnection ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ اختبار فشل:', error);
      process.exit(1);
    });
}

module.exports = { quickRenderStatusCheck }; 