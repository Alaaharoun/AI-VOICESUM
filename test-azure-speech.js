const WebSocket = require('ws');

console.log('🔍 Testing Azure Speech Service directly...');

// إنشاء صوت تجريبي أكثر واقعية (PCM 16-bit 48kHz mono)
function createTestAudio() {
  const sampleRate = 48000;
  const duration = 1; // ثانية واحدة
  const samples = sampleRate * duration;
  const buffer = Buffer.alloc(samples * 2); // 16-bit = 2 bytes per sample
  
  // إنشاء sine wave بتردد 440Hz (نغمة A)
  for (let i = 0; i < samples; i++) {
    const value = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.8 * 32767;
    buffer.writeInt16LE(Math.round(value), i * 2);
  }
  
  return buffer;
}

const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');

ws.on('open', () => {
  console.log('✅ WebSocket connected');
  
  // إرسال init message
  ws.send(JSON.stringify({
    type: 'init',
    language: 'ar-SA'
  }));
  console.log('📤 Sent init message with Arabic language');
  
  // انتظار قليل ثم إرسال audio
  setTimeout(() => {
    const testAudio = createTestAudio();
    console.log(`📤 Sending realistic test audio: ${testAudio.length} bytes (1 second 48kHz PCM)`);
    ws.send(testAudio);
  }, 1000);
  
  // إرسال المزيد من الصوت
  setTimeout(() => {
    const testAudio2 = createTestAudio();
    console.log(`📤 Sending second audio chunk: ${testAudio2.length} bytes`);
    ws.send(testAudio2);
  }, 2000);
  
  // إغلاق بعد 10 ثوانٍ
  setTimeout(() => {
    console.log('⏰ Closing connection');
    ws.close();
  }, 10000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📥 Azure Response:', message);
  } catch (e) {
    console.log('📥 Raw message:', data.toString());
  }
});

ws.on('error', (err) => {
  console.log('❌ WebSocket error:', err.message);
});

ws.on('close', (code, reason) => {
  console.log(`🔒 WebSocket closed: ${code} - ${reason || 'No reason'}`);
}); 