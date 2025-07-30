const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Deploying improved Azure server with enhanced logging...');

// Check if the improved server file exists
const improvedServerPath = path.join(__dirname, '..', 'azure-server-improved.js');
if (!fs.existsSync(improvedServerPath)) {
  console.log('❌ Improved server file not found. Running improvement script first...');
  
  // Run the improvement script
  const improveScript = path.join(__dirname, 'improve-server-logging.js');
  if (fs.existsSync(improveScript)) {
    require(improveScript);
  } else {
    console.log('❌ Improvement script not found');
    process.exit(1);
  }
}

// Copy the improved server to the main server file
const mainServerPath = path.join(__dirname, '..', 'azure-server.js');
const improvedContent = fs.readFileSync(improvedServerPath, 'utf8');
fs.writeFileSync(mainServerPath, improvedContent);

console.log('✅ Improved server deployed to azure-server.js');

// Start the server
console.log('🚀 Starting improved server...');
console.log('📋 Enhanced logging features:');
console.log('   - Detailed WebSocket message logging');
console.log('   - Audio data processing logs');
console.log('   - Connection information');
console.log('   - Error handling with stack traces');
console.log('');

const serverProcess = exec('node azure-server.js', {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, NODE_ENV: 'production' }
});

serverProcess.stdout.on('data', (data) => {
  console.log(data.toString());
});

serverProcess.stderr.on('data', (data) => {
  console.error(data.toString());
});

serverProcess.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

serverProcess.on('error', (error) => {
  console.error('Failed to start server:', error);
});

console.log('🔧 Server started with enhanced logging');
console.log('📊 Monitor the logs above for detailed information');
console.log('🌐 Test the connection using the diagnostic tool');
console.log('📱 Open test-server-connection.html in your browser'); 