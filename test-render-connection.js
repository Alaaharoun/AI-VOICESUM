const https = require('https');

// اختبار 1: Health Check
console.log('🔍 Testing Render server health...');
https.get('https://ai-voicesum.onrender.com/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('✅ Health Check:', JSON.parse(data));
    testLiveTranslate();
  });
}).on('error', err => {
  console.log('❌ Health Check Error:', err.message);
});

// اختبار 2: Live Translate API
function testLiveTranslate() {
  console.log('\n🔍 Testing Live Translate API...');
  
  const postData = JSON.stringify({
    audio: 'dGVzdA==', // "test" in base64
    audioType: 'audio/wav',
    language: 'ar-SA'
  });

  const options = {
    hostname: 'ai-voicesum.onrender.com',
    port: 443,
    path: '/live-translate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('✅ Live Translate Success:', response);
      } catch (e) {
        console.log('✅ Live Translate Response:', data);
      }
      testWebSocket();
    });
  });

  req.on('error', (err) => {
    console.log('❌ Live Translate Error:', err.message);
    testWebSocket();
  });

  req.write(postData);
  req.end();
}

// اختبار 3: WebSocket
function testWebSocket() {
  console.log('\n🔍 Testing WebSocket connection...');
  
  const WebSocket = require('ws');
  const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
  
  let messageCount = 0;
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected successfully');
    
    // إرسال init message
    ws.send(JSON.stringify({
      type: 'init',
      language: 'ar-SA'
    }));
    console.log('📤 Sent init message');
    
    // إرسال test audio بعد ثانية
    setTimeout(() => {
      const testAudio = Buffer.alloc(1000, 65); // Buffer مليء بـ 'A'
      ws.send(testAudio);
      console.log('📤 Sent test audio (1000 bytes)');
    }, 1000);
    
    // إغلاق بعد 5 ثوانٍ
    setTimeout(() => {
      console.log('⏰ Timeout - closing connection');
      ws.close();
    }, 5000);
  });
  
  ws.on('message', (data) => {
    messageCount++;
    try {
      const message = JSON.parse(data.toString());
      console.log(`📥 Message ${messageCount}:`, message);
    } catch (e) {
      console.log(`📥 Raw message ${messageCount}:`, data.toString());
    }
  });
  
  ws.on('error', (err) => {
    console.log('❌ WebSocket error:', err.message);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔒 WebSocket closed: ${code} - ${reason}`);
    console.log(`\n📊 Total messages received: ${messageCount}`);
    
    if (messageCount === 0) {
      console.log('\n⚠️ No messages received from Azure Speech Service');
      console.log('This could indicate:');
      console.log('1. Azure Speech credentials missing on Render');
      console.log('2. Audio format not recognized by Azure');
      console.log('3. Server-side Azure Speech configuration issue');
    }
  });
} 