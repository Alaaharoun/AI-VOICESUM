// Enhanced Server Logging Script
const fs = require('fs');
const path = require('path');

console.log('🔧 Enhancing server logging...');

// Read the current server file
const serverPath = path.join(__dirname, '..', 'azure-server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Add enhanced logging to WebSocket message handling
const enhancedLogging = `
    ws.on('message', (data) => {
      try {
        console.log('[WebSocket] 📥 Received message from client');
        console.log('[WebSocket] 📊 Message type:', typeof data);
        console.log('[WebSocket] 📏 Message size:', data.length || data.byteLength || 'unknown');
        
        // Check if it's a JSON message (init, language_update, etc.)
        if (typeof data === 'string') {
          const message = JSON.parse(data);
          console.log('[WebSocket] 📋 Parsed JSON message:', message.type);
          console.log('[WebSocket] 🔍 Message details:', JSON.stringify(message, null, 2));
          
          if (message.type === 'init') {
            console.log('[WebSocket] 🔧 Processing init message...');
            console.log('[WebSocket] 🌐 Source language:', message.language);
            console.log('[WebSocket] 🎯 Target language:', message.targetLanguage);
            console.log('[WebSocket] 🔄 Auto detection:', message.autoDetection);
            
            // تنظيف الجلسة السابقة قبل إعادة التهيئة
            try {
              recognizer.stopContinuousRecognitionAsync();
              recognizer.close();
              pushStream.close();
              console.log('[Azure] 🧹 Cleaned up previous session before reinitialization');
            } catch (error) {
              console.log('[Azure] ⚠️ No previous session to cleanup:', error.message);
            }
            
            // Handle auto detection or specific language
            const rawLanguage = message.language;
            const autoDetection = message.autoDetection || false;
            
            let language;
            if (autoDetection || !rawLanguage) {
              // Use auto detection - Azure will automatically detect from 10+ languages
              language = null;
              console.log('[Azure] 🔧 Initializing with AUTO DETECTION (no specific language)');
            } else {
              // Use specific language
              language = validateAzureLanguage(rawLanguage);
              console.log('[Azure] 🔧 Initializing with specific language:', rawLanguage, '→', language);
            }
            
            // إنشاء جلسة جديدة مع اللغة الصحيحة
            // استخدام 16kHz بدلاً من 48kHz لتجنب مشاكل التنسيق
            pushStream = speechsdk.AudioInputStream.createPushStream(speechsdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1));
            audioConfig = speechsdk.AudioConfig.fromStreamInput(pushStream);
            speechConfig = speechsdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
            
            // Set language only if not using auto detection
            if (language) {
              speechConfig.speechRecognitionLanguage = language;
            } else {
              // For auto detection, don't set a specific language
              // Azure will automatically detect from supported languages
              console.log('[Azure] 🎯 Auto detection enabled - Azure will detect language automatically');
            }
            
            // تحسينات Azure لاستقبال chunks كبيرة
            speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "15000");
            speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "10000");
            speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceResponse_RequestDetailedResultTrueFalse, "true");
            
            recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
            
            // إعداد المستمعين الجدد
            recognizer.recognizing = (s, e) => {
              console.log(\`[Azure Speech] 🔄 Partial result: "\${e.result.text}"\`);
              if (e.result.text && e.result.text.trim()) {
                console.log(\`[Azure Speech] 📤 Sending partial transcription: "\${e.result.text}"\`);
                ws.send(JSON.stringify({ type: 'transcription', text: e.result.text }));
              }
            };
            
            recognizer.recognized = (s, e) => {
              if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
                console.log(\`[Azure Speech] ✅ Final result: "\${e.result.text}"\`);
                if (e.result.text && e.result.text.trim()) {
                  console.log(\`[Azure Speech] 📤 Sending final transcription: "\${e.result.text}"\`);
                  ws.send(JSON.stringify({ type: 'final', text: e.result.text }));
                } else {
                  console.log('[Azure Speech] Empty final result, not sending');
                }
              }
            };
            
            recognizer.canceled = (s, e) => {
              console.log('[Azure Speech] ❌ Recognition canceled:', e.errorDetails);
              ws.send(JSON.stringify({ type: 'error', error: e.errorDetails }));
            };
            
            recognizer.sessionStopped = (s, e) => {
              console.log('[Azure Speech] 🛑 Session stopped');
              ws.send(JSON.stringify({ type: 'done' }));
            };
            
            // بدء التعرف الجديد
            recognizer.startContinuousRecognitionAsync(
              () => {
                if (language) {
                  console.log('[Azure Speech] ✅ Recognition started successfully with language:', language);
                  ws.send(JSON.stringify({ type: 'status', message: 'Initialized with language: ' + language }));
                } else {
                  console.log('[Azure Speech] ✅ Recognition started successfully with AUTO DETECTION');
                  ws.send(JSON.stringify({ type: 'status', message: 'Initialized with AUTO DETECTION - Azure will detect language automatically' }));
                }
              },
              (error) => {
                console.log('[Azure Speech] ❌ Failed to start recognition:', error);
                ws.send(JSON.stringify({ type: 'error', error: 'Failed to start recognition: ' + error }));
              }
            );
          } else if (message.type === 'audio') {
            // Handle audio data
            console.log('[WebSocket] 🎵 Processing audio message...');
            console.log('[WebSocket] 📊 Audio format:', message.format);
            console.log('[WebSocket] 📏 Audio data length:', message.data ? message.data.length : 'undefined');
            
            const audioData = message.data;
            if (audioData) {
              const audioBuffer = Buffer.from(audioData, 'base64');
              console.log('[WebSocket] ✅ Audio data decoded successfully');
              console.log('[WebSocket] 📏 Decoded audio buffer size:', audioBuffer.length, 'bytes');
              console.log('[WebSocket] 🎵 Audio format from client:', message.format);
              console.log('[WebSocket] 🌐 Source language:', message.sourceLanguage || 'not specified');
              console.log('[WebSocket] 🎯 Target language:', message.targetLanguage || 'not specified');
              
              // التحقق من أن البيانات ليست فارغة أو قديمة جداً
              if (audioBuffer.length > 0) {
                console.log('[WebSocket] 📤 Writing audio buffer to Azure push stream...');
                pushStream.write(audioBuffer);
                console.log('[WebSocket] ✅ Audio buffer written to Azure stream');
              } else {
                console.log('[WebSocket] ⚠️ Skipping empty audio buffer');
              }
            } else {
              console.log('[WebSocket] ❌ No audio data in message');
            }
          } else {
            console.log('[WebSocket] ❓ Unknown message type:', message.type);
          }
        } else {
          // Handle raw audio data (fallback)
          console.log('[WebSocket] 📥 Received raw audio data (fallback)');
          console.log('[WebSocket] 📊 Data type:', typeof data);
          console.log('[WebSocket] 📏 Data size:', data.length || data.byteLength || 'unknown');
          
          // التحقق من أن البيانات ليست فارغة
          if (data && (data.length > 0 || data.byteLength > 0)) {
            console.log('[WebSocket] 📤 Writing raw audio data to Azure push stream...');
            if (data instanceof Buffer) {
              pushStream.write(data);
            } else if (data instanceof ArrayBuffer) {
              pushStream.write(Buffer.from(data));
            } else {
              pushStream.write(Buffer.from(data));
            }
            console.log('[WebSocket] ✅ Raw audio data written to Azure stream');
          } else {
            console.log('[WebSocket] ⚠️ Skipping empty raw audio data');
          }
        }
      } catch (error) {
        console.error('[WebSocket] ❌ Error processing message:', error);
        console.error('[WebSocket] ❌ Error details:', error.message);
        console.error('[WebSocket] ❌ Error stack:', error.stack);
      }
    });
`;

// Replace the existing message handler with enhanced logging
const messageHandlerPattern = /ws\.on\('message', \(data\) => \{[\s\S]*?\}\);[\s\S]*?\} else \{[\s\S]*?\}[\s\S]*?\} catch \(error\) \{[\s\S]*?\}/;
const replacement = enhancedLogging;

if (messageHandlerPattern.test(serverContent)) {
  serverContent = serverContent.replace(messageHandlerPattern, replacement);
  console.log('✅ Enhanced logging added to server');
} else {
  console.log('❌ Could not find message handler pattern in server file');
}

// Add connection logging
const connectionLogging = `
    wsServer.on('connection', (ws) => {
      console.log('[WebSocket] 🔗 New client connected');
      console.log('[WebSocket] 📊 Client IP:', ws._socket.remoteAddress);
      console.log('[WebSocket] 📊 Client port:', ws._socket.remotePort);
      console.log('[WebSocket] 📊 User agent:', ws._socket.remoteAddress ? 'Unknown' : 'Direct connection');
      
      try {
        const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
        const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;
        
        console.log('[WebSocket] 🔑 Checking Azure credentials...');
        console.log('[WebSocket] Key present:', !!AZURE_SPEECH_KEY);
        console.log('[WebSocket] Region present:', !!AZURE_SPEECH_REGION);
        
        if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
          console.log('[WebSocket] ❌ Azure credentials missing!');
          ws.send(JSON.stringify({ type: 'error', error: 'Azure Speech credentials missing!' }));
          ws.close();
          return;
        }
        
        console.log('[WebSocket] ✅ Azure credentials OK, proceeding...');
`;

// Replace the connection handler
const connectionPattern = /wsServer\.on\('connection', \(ws\) => \{[\s\S]*?console\.log\('\[WebSocket\] 🔗 New client connected'\);[\s\S]*?try \{[\s\S]*?const AZURE_SPEECH_KEY = process\.env\.AZURE_SPEECH_KEY;[\s\S]*?console\.log\('\[WebSocket\] ✅ Azure credentials OK, proceeding\.\.\.'\);/;
const connectionReplacement = connectionLogging;

if (connectionPattern.test(serverContent)) {
  serverContent = serverContent.replace(connectionPattern, connectionReplacement);
  console.log('✅ Enhanced connection logging added to server');
} else {
  console.log('❌ Could not find connection handler pattern in server file');
}

// Write the improved server file
const improvedServerPath = path.join(__dirname, '..', 'azure-server-enhanced.js');
fs.writeFileSync(improvedServerPath, serverContent);

console.log('✅ Enhanced server file created:', improvedServerPath);
console.log('📋 Changes made:');
console.log('   - Enhanced WebSocket message logging');
console.log('   - Added detailed audio data processing logs');
console.log('   - Added connection information logging');
console.log('   - Added error handling with detailed stack traces');
console.log('');
console.log('🚀 To use the enhanced server:');
console.log('   1. Stop the current server');
console.log('   2. Replace azure-server.js with azure-server-enhanced.js');
console.log('   3. Restart the server');
console.log('   4. Test with the diagnostic tool'); 