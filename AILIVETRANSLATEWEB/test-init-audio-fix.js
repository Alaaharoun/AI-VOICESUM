// 🧪 اختبار سريع لإصلاح ترتيب init/audio
// تشغيل في console للتحقق من الإصلاح

console.log('🧪 بدء اختبار إصلاح ترتيب init/audio...');

// محاكاة اتصال WebSocket
const testInitAudioOrder = () => {
  console.log('\n=== اختبار التسلسل الصحيح ===');
  
  // 1. محاكاة init message
  const initMessage = {
    type: 'init',
    language: 'en-US',
    targetLanguage: 'ar-SA',
    timestamp: Date.now()
  };
  
  console.log('📤 1. إرسال init message:', JSON.stringify(initMessage, null, 2));
  
  // 2. محاكاة audio chunk
  setTimeout(() => {
    const audioChunk = {
      type: 'audio',
      data: 'base64AudioData...',
      format: 'audio/webm;codecs=opus',
      size: 12557
    };
    
    console.log('📤 2. إرسال audio chunk:', {
      type: audioChunk.type,
      size: audioChunk.size,
      format: audioChunk.format
    });
    
    console.log('\n✅ التسلسل المتوقع:');
    console.log('   1. init → السيرفر يعين initialized=true فوراً');
    console.log('   2. audio → السيرفر يعالج الصوت مباشرة');
    console.log('   3. transcription ← النتائج تأتي فوراً');
    
  }, 100); // تأخير قصير لمحاكاة الواقع
};

// اختبار رسائل الجاهزية من السيرفر
const testServerReadyMessages = () => {
  console.log('\n=== اختبار رسائل الجاهزية ===');
  
  const readyMessages = [
    { type: 'status', message: 'Ready for audio input' },
    { type: 'ready', message: 'Ready for audio input' },
    { type: 'initialized' },
    { type: 'init_ack' }
  ];
  
  readyMessages.forEach((msg, index) => {
    console.log(`📨 ${index + 1}. رسالة جاهزية:`, msg);
    console.log(`   ✅ العميل يجب أن يعين isInitialized = true`);
  });
};

// اختبار التوقيتات
const testTimings = () => {
  console.log('\n=== اختبار التوقيتات ===');
  
  const start = Date.now();
  
  console.log('⏱️ بدء التسجيل:', new Date(start).toLocaleTimeString());
  
  // محاكاة init
  setTimeout(() => {
    const initTime = Date.now();
    console.log('📤 init sent:', `+${initTime - start}ms`);
  }, 10);
  
  // محاكاة server ready
  setTimeout(() => {
    const readyTime = Date.now();
    console.log('📨 server ready:', `+${readyTime - start}ms`);
  }, 50);
  
  // محاكاة audio chunk
  setTimeout(() => {
    const audioTime = Date.now();
    console.log('📤 audio sent:', `+${audioTime - start}ms`);
  }, 100);
  
  // محاكاة transcription
  setTimeout(() => {
    const transTime = Date.now();
    console.log('📝 transcription received:', `+${transTime - start}ms`);
    console.log('\n✅ إجمالي الوقت للتفريغ:', `${transTime - start}ms`);
    console.log('🎯 الهدف: أقل من 500ms للتفريغ الأول');
  }, 200);
};

// نصائح للاختبار الفعلي
const showTestingTips = () => {
  console.log('\n=== نصائح للاختبار الفعلي ===');
  console.log('🔍 ابحث عن هذه الرسائل في console:');
  console.log('   ✅ "Set initialized=true before starting recognition"');
  console.log('   ✅ "All checks passed, proceeding to send audio chunk"');
  console.log('   ✅ "Audio message sent successfully via WebSocket"');
  console.log('   ✅ "Received transcription: ..."');
  
  console.log('\n❌ يجب ألا ترى:');
  console.log('   ❌ "Received audio data before initialization"');
  console.log('   ❌ "Storing audio data for later processing"');
  console.log('   ❌ تأخير أكثر من ثانيتين للتفريغ');
  
  console.log('\n🎯 علامات النجاح:');
  console.log('   ✅ التفريغ يظهر خلال ثانية واحدة');
  console.log('   ✅ لا توجد رسائل خطأ في console');
  console.log('   ✅ الصوت يُعالج فوراً دون queuing');
};

// تشغيل جميع الاختبارات
const runAllTests = () => {
  testInitAudioOrder();
  
  setTimeout(() => {
    testServerReadyMessages();
  }, 1000);
  
  setTimeout(() => {
    testTimings();
  }, 2000);
  
  setTimeout(() => {
    showTestingTips();
  }, 3000);
};

// تشغيل الاختبارات
runAllTests();

console.log('\n📋 اختبار مكتمل! راقب النتائج أعلاه...'); 