const fs = require('fs');
const path = require('path');

console.log('🚀 Deploying Azure Speech Service to Render...');

// Create package.json for Azure server
const azurePackageJson = {
  "name": "azure-speech-server",
  "version": "1.0.0",
  "description": "Azure Speech Service WebSocket Server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "node-fetch": "^2.6.7",
    "ffmpeg-static": "^5.1.0",
    "ws": "^8.13.0",
    "microsoft-cognitiveservices-speech-sdk": "^1.34.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=16.0.0"
  },
  "keywords": ["azure", "speech", "websocket", "transcription"],
  "author": "AI LIVE TRANSLATE Team",
  "license": "MIT"
};

// Copy server.js to root for deployment
const serverPath = path.join(__dirname, 'server', 'server.js');
const targetPath = path.join(__dirname, 'azure-server.js');

try {
  // Read the server file
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  
  // Write to root directory
  fs.writeFileSync(targetPath, serverContent);
  console.log('✅ Copied server.js to azure-server.js');
  
  // Write package.json
  fs.writeFileSync('azure-package.json', JSON.stringify(azurePackageJson, null, 2));
  console.log('✅ Created azure-package.json');
  
  // Create deployment instructions
  const deploymentInstructions = `# Azure Speech Service Deployment

## Deploy to Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the following environment variables:
   - AZURE_SPEECH_KEY: Your Azure Speech Service key
   - AZURE_SPEECH_REGION: Your Azure Speech Service region (e.g., eastus)
   - PORT: 10000 (or let Render set it automatically)

4. Set the build command:
   \`\`\`bash
   npm install
   \`\`\`

5. Set the start command:
   \`\`\`bash
   npm start
   \`\`\`

6. Deploy!

## Local Testing

1. Copy azure-server.js to your server directory
2. Copy azure-package.json to package.json
3. Run: npm install
4. Set environment variables
5. Run: npm start

The server will be available at:
- WebSocket: ws://localhost:10000/ws
- Health: http://localhost:10000/health
- Transcribe: http://localhost:10000/transcribe

## Environment Variables Required

- AZURE_SPEECH_KEY: Your Azure Speech Service subscription key
- AZURE_SPEECH_REGION: Your Azure Speech Service region

## Features

- Real-time WebSocket transcription
- Azure Speech Service integration
- Audio format conversion
- Language detection
- Continuous recognition
- Error handling and reconnection

## WebSocket Protocol

The server expects:
1. Init message: { type: 'init', language: 'en-US', targetLanguage: 'ar-SA', ... }
2. Audio data: Binary audio chunks or base64 encoded audio
3. Language updates: { type: 'language_update', sourceLanguage: 'en-US', targetLanguage: 'ar-SA' }

The server responds with:
1. Status messages: { type: 'status', message: 'Ready for audio input' }
2. Transcription: { type: 'transcription', text: 'recognized text' }
3. Final results: { type: 'final', text: 'final text' }
4. Errors: { type: 'error', error: 'error message' }
`;

  fs.writeFileSync('AZURE_DEPLOYMENT_GUIDE.md', deploymentInstructions);
  console.log('✅ Created AZURE_DEPLOYMENT_GUIDE.md');
  
  console.log('\n🎯 Next steps:');
  console.log('1. Deploy azure-server.js to Render');
  console.log('2. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables');
  console.log('3. Update the client to use the new Azure server URL');
  console.log('4. Test the WebSocket connection');
  
} catch (error) {
  console.error('❌ Error creating deployment files:', error);
} 