const WebSocket = require('ws');

async function testInitResponse() {
    console.log('🧪 اختبار استجابة init بعد الإصلاح...');
    console.log('⚠️  هذا الاختبار سيتصل بالسيرفر. تأكد من أنك جاهز للاختبار.');
    console.log('📋 للبدء، اكتب: node test-init-fix-precise-safe.js --run');
    
    // التحقق من وجود flag للتنفيذ
    if (!process.argv.includes('--run')) {
        console.log('❌ لم يتم تمرير --run flag. الاختبار لن يعمل.');
        console.log('💡 للتنفيذ: node test-init-fix-precise-safe.js --run');
        return false;
    }
    
    console.log('🚀 بدء الاختبار...');
    
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

// التحقق من وجود flag للتنفيذ
if (process.argv.includes('--run')) {
    testInitResponse().then(success => {
        if (success) {
            console.log('🎉 الإصلاح نجح! السيرفر يستجيب لرسائل init');
        } else {
            console.log('❌ الإصلاح لم ينجح بعد. تحقق من سجلات Render');
        }
    });
} else {
    console.log('🔒 الاختبار محمي من التشغيل التلقائي');
    console.log('💡 للتنفيذ: node test-init-fix-precise-safe.js --run');
} 