
// Simple test for local server
const http = require('http');

function testHTTP() {
  console.log('🔍 Testing HTTP connection to local server...');
  
  const options = {
    hostname: 'localhost',
    port: 7860,
    path: '/health',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`✅ HTTP Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('📨 Response:', data);
    });
  });

  req.on('error', (error) => {
    console.log('❌ HTTP Error:', error.message);
  });

  req.end();
}

testHTTP();
