const fs = require('fs');
const path = require('path');

console.log('🔧 === إصلاح دقيق لاستجابة السيرفر لرسائل init ===');

// التحقق من وجود ملف السيرفر
const serverPath = path.join(__dirname, 'server.js');
if (!fs.existsSync(serverPath)) {
    console.error('❌ ملف server.js غير موجود في:', serverPath);
    process.exit(1);
}

console.log('📖 قراءة ملف server.js من:', serverPath);

// قراءة ملف السيرفر
let serverContent = fs.readFileSync(serverPath, 'utf8');
console.log('✅ تم قراءة ملف server.js بنجاح');

// البحث عن النمط الدقيق لإضافة init_ack
const startRecognitionPattern = /recognizer\.startContinuousRecognitionAsync\(\s*\(\) => \{[\s\S]*?console\.log\(\`✅ \[.*?\] Continuous recognition started successfully\`\);/;

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
} else {
    console.log('❌ لم أجد النمط المطلوب في startContinuousRecognitionAsync');
    
    // البحث عن نمط بديل
    const alternativePattern = /console\.log\(\`✅ \[.*?\] Continuous recognition started successfully\`\);/;
    
    if (alternativePattern.test(serverContent)) {
        console.log('✅ وجدت نمط بديل');
        
        const replacement = `console.log(\`✅ [\${language}] Continuous recognition started successfully\`);
                  ws.send(JSON.stringify({ type: 'init_ack', message: 'Initialization successful' }));
                  ws.send(JSON.stringify({ type: 'status', message: 'Ready for audio input' }));`;
        
        serverContent = serverContent.replace(alternativePattern, replacement);
        
        console.log('🔧 إضافة init_ack باستخدام النمط البديل...');
    } else {
        console.log('❌ لم أجد أي نمط مناسب لإضافة init_ack');
        console.log('🔍 البحث عن أنماط أخرى...');
        
        // البحث عن أي مكان يرسل رسائل status
        const statusPattern = /ws\.send\(JSON\.stringify\(\{ type: 'status'/g;
        const statusMatches = serverContent.match(statusPattern);
        
        if (statusMatches) {
            console.log(`✅ وجدت ${statusMatches.length} مكان يرسل رسائل status`);
            console.log('🔧 سيتم إضافة init_ack في أول مكان مناسب...');
            
            // إضافة init_ack في أول مكان يرسل status
            const firstStatusPattern = /ws\.send\(JSON\.stringify\(\{ type: 'status', message: 'Ready for audio input' \}\)\);/;
            if (firstStatusPattern.test(serverContent)) {
                const replacement = `ws.send(JSON.stringify({ type: 'init_ack', message: 'Initialization successful' }));
                  ws.send(JSON.stringify({ type: 'status', message: 'Ready for audio input' }));`;
                
                serverContent = serverContent.replace(firstStatusPattern, replacement);
                console.log('🔧 إضافة init_ack قبل رسالة Ready for audio input...');
            }
        } else {
            console.log('❌ لم أجد أي مكان يرسل رسائل status');
        }
    }
}

// البحث عن مكان آخر لإرسال init_ack في sessionStarted
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

// حفظ الملف المعدل
fs.writeFileSync(serverPath, serverContent, 'utf8');

console.log('✅ تم حفظ التعديلات في server.js');
console.log('🔄 يرجى إعادة تشغيل السيرفر على Render');
console.log('📋 التعديلات المضافة:');
console.log('   - إضافة init_ack message عند بدء التعرف');
console.log('   - إضافة init_ack message في sessionStarted');

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
        }, 15000);
        
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

fs.writeFileSync('test-init-fix-precise.js', testScript);
console.log('📝 تم إنشاء test-init-fix-precise.js لاختبار الإصلاح');
console.log('💡 لتشغيل الاختبار: node test-init-fix-precise.js'); 