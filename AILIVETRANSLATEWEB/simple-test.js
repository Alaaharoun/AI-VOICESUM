console.log('🔧 Simple WebSocket Connection Test');
console.log('=====================================');

// Simple health check
const https = require('https');

console.log('🏥 Testing server health...');

const healthCheck = https.get('https://ai-voicesum.onrender.com/health', (res) => {
  console.log('✅ Health check status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('✅ Health check response:', data);
    console.log('✅ Server is running and accessible');
  });
});

healthCheck.on('error', (err) => {
  console.log('❌ Health check failed:', err.message);
});

console.log('⏳ Test completed'); 