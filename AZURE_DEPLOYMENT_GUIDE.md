# Azure Speech Service Deployment

## Deploy to Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the following environment variables:
   - AZURE_SPEECH_KEY: Your Azure Speech Service key
   - AZURE_SPEECH_REGION: Your Azure Speech Service region (e.g., eastus)
   - PORT: 10000 (or let Render set it automatically)

4. Set the build command:
   ```bash
   npm install
   ```

5. Set the start command:
   ```bash
   npm start
   ```

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
