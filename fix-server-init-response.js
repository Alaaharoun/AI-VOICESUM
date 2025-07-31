const fs = require('fs');
const path = require('path');

console.log('🔧 === إصلاح استجابة السيرفر لرسائل init ===');

// قراءة ملف السيرفر
const serverPath = path.join(__dirname, 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

console.log('📖 قراءة ملف server.js...');

// البحث عن مكان إرسال init_ack
const initAckPattern = /ws\.send\(JSON\.stringify\(\{ type: 'status', message: 'Ready for audio input' \}\)\);/;

if (initAckPattern.test(serverContent)) {
    console.log('✅ وجدت مكان إرسال رسالة Ready');
    
    // إضافة init_ack قبل رسالة Ready
    const replacement = `ws.send(JSON.stringify({ type: 'init_ack', message: 'Initialization successful' }));
                  ws.send(JSON.stringify({ type: 'status', message: 'Ready for audio input' }));`;
    
    serverContent = serverContent.replace(initAckPattern, replacement);
    
    console.log('🔧 إضافة init_ack message...');
} else {
    console.log('❌ لم أجد مكان إرسال رسالة Ready');
}

// البحث عن مكان آخر لإرسال init_ack
const sessionStartedPattern = /recognizer\.sessionStarted = \(s, e\) => \{[\s\S]*?ws\.send\(JSON\.stringify\(\{ type: 'status', message: 'Recognition session started' \}\)\);/;

if (sessionStartedPattern.test(serverContent)) {
    console.log('✅ وجدت مكان sessionStarted');
    
    // إضافة init_ack في sessionStarted
    const replacement = `recognizer.sessionStarted = (s, e) => {
                console.log(\`🚀 [\${language}] Session started:\`, {
                  sessionId: e.sessionId,
                  timestamp: new Date().toISOString()
                });
                ws.send(JSON.stringify({ type: 'init_ack', message: 'Initialization successful' }));
                ws.send(JSON.stringify({ type: 'status', message: 'Recognition session started' }));`;
    
    serverContent = serverContent.replace(sessionStartedPattern, replacement);
    
    console.log('🔧 إضافة init_ack في sessionStarted...');
}

// البحث عن مكان آخر لإرسال init_ack في startContinuousRecognitionAsync
const startRecognitionPattern = /recognizer\.startContinuousRecognitionAsync\([\s\S]*?\(\) => \{[\s\S]*?console\.log\(\`✅ \[.*?\] Continuous recognition started successfully\`\);/;

if (startRecognitionPattern.test(serverContent)) {
    console.log('✅ وجدت مكان startContinuousRecognitionAsync');
    
    // إضافة init_ack في startContinuousRecognitionAsync
    const replacement = `recognizer.startContinuousRecognitionAsync(
                () => {
                  console.log(\`✅ [\${language}] Continuous recognition started successfully\`);
                  // initialized is already true from above
                  ws.send(JSON.stringify({ type: 'init_ack', message: 'Initialization successful' }));
                  ws.send(JSON.stringify({ type: 'status', message: 'Ready for audio input' }));`;
    
    serverContent = serverContent.replace(startRecognitionPattern, replacement);
    
    console.log('🔧 إضافة init_ack في startContinuousRecognitionAsync...');
}

// حفظ الملف المعدل
fs.writeFileSync(serverPath, serverContent, 'utf8');

console.log('✅ تم حفظ التعديلات في server.js');
console.log('🔄 يرجى إعادة تشغيل السيرفر على Render');
console.log('📋 التعديلات المضافة:');
console.log('   - إضافة init_ack message عند بدء التعرف');
console.log('   - إضافة init_ack message في sessionStarted');
console.log('   - إضافة init_ack message في startContinuousRecognitionAsync');

// إنشاء ملف اختبار سريع
const testScript = `
const WebSocket = require('ws');

async function testInitResponse() {
    console.log('🧪 اختبار استجابة init بعد الإصلاح...');
    
    const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
    
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.log('⏰ اختبار timeout');
            ws.close();
            resolve(false);
        }, 10000);
        
        ws.onopen = () => {
            console.log('✅ WebSocket connected');
            
            setTimeout(() => {
                const initMessage = {
                    type: 'init',
                    language: 'ar-SA',
                    autoDetection: false,
                    realTime: true
                };
                
                console.log('📤 Sending init message:', initMessage);
                ws.send(JSON.stringify(initMessage));
            }, 1000);
        };
        
        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('📥 Received:', message);
                
                if (message.type === 'init_ack') {
                    console.log('✅ SUCCESS: Received init_ack!');
                    clearTimeout(timeout);
                    ws.close();
                    resolve(true);
                }
            } catch (error) {
                console.log('📥 Raw message:', event.data);
            }
        };
        
        ws.onerror = (error) => {
            console.log('❌ WebSocket error:', error.message);
            clearTimeout(timeout);
            resolve(false);
        };
        
        ws.onclose = () => {
            console.log('🔒 WebSocket closed');
            clearTimeout(timeout);
            resolve(false);
        };
    });
}

testInitResponse().then(success => {
    if (success) {
        console.log('🎉 الإصلاح نجح! السيرفر يستجيب لرسائل init');
    } else {
        console.log('❌ الإصلاح لم ينجح بعد. تحقق من سجلات Render');
    }
});
`;

fs.writeFileSync('test-init-fix.js', testScript);
console.log('📝 تم إنشاء test-init-fix.js لاختبار الإصلاح');
console.log('💡 لتشغيل الاختبار: node test-init-fix.js'); 