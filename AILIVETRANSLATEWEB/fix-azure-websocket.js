// Fix for Azure Speech SDK WebSocket Connection Issues
// This script addresses the "this.privAudioSource.id is not a function" error

import WebSocket from 'ws';
import speechsdk from 'microsoft-cognitiveservices-speech-sdk';

// Enhanced WebSocket server with better error handling
function createFixedWebSocketServer(server) {
  const wsServer = new WebSocket.Server({ server, path: '/ws' });
  console.log('🔧 Fixed WebSocket server attached to main HTTP server');

  wsServer.on('connection', (ws) => {
    console.log('[WebSocket] 🔗 New client connected');
    
    let recognizer = null;
    let pushStream = null;
    let audioConfig = null;
    let speechConfig = null;
    let isInitialized = false;
    
    // Enhanced error handling for Azure Speech SDK
    const initializeAzureSpeech = async (language = 'ar-SA') => {
      try {
        console.log('[WebSocket] 🔧 Initializing Azure Speech SDK...');
        
        const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
        const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;
        
        if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
          throw new Error('Azure Speech credentials missing!');
        }
        
        // Create audio format with explicit parameters
        const audioFormat = speechsdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
        console.log('[WebSocket] ✅ Audio format created');
        
        // Create push stream with proper error handling
        try {
          pushStream = speechsdk.AudioInputStream.createPushStream(audioFormat);
          console.log('[WebSocket] ✅ Push stream created');
        } catch (streamError) {
          console.error('[WebSocket] ❌ Push stream creation failed:', streamError);
          throw new Error(`Push stream creation failed: ${streamError.message}`);
        }
        
        // Create audio config with enhanced error handling
        try {
          audioConfig = speechsdk.AudioConfig.fromStreamInput(pushStream);
          console.log('[WebSocket] ✅ Audio config created');
        } catch (audioError) {
          console.error('[WebSocket] ❌ Audio config creation failed:', audioError);
          throw new Error(`Audio config creation failed: ${audioError.message}`);
        }
        
        // Create speech config
        try {
          speechConfig = speechsdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
          console.log('[WebSocket] ✅ Speech config created');
        } catch (speechError) {
          console.error('[WebSocket] ❌ Speech config creation failed:', speechError);
          throw new Error(`Speech config creation failed: ${speechError.message}`);
        }
        
        // Configure speech settings
        speechConfig.speechRecognitionLanguage = language;
        speechConfig.enableDictation();
        speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "15000");
        speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "10000");
        speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceResponse_RequestDetailedResultTrueFalse, "true");
        
        // Create recognizer with proper error handling
        try {
          recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
          console.log('[WebSocket] ✅ Speech recognizer created');
        } catch (recognizerError) {
          console.error('[WebSocket] ❌ Speech recognizer creation failed:', recognizerError);
          throw new Error(`Speech recognizer creation failed: ${recognizerError.message}`);
        }
        
        // Set up event handlers
        recognizer.recognized = (s, e) => {
          if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
            console.log('[WebSocket] 📝 Recognized:', e.result.text);
            ws.send(JSON.stringify({
              type: 'transcription',
              text: e.result.text,
              language: language
            }));
          }
        };
        
        recognizer.recognizing = (s, e) => {
          console.log('[WebSocket] 🔄 Recognizing:', e.result.text);
          ws.send(JSON.stringify({
            type: 'interim',
            text: e.result.text,
            language: language
          }));
        };
        
        recognizer.canceled = (s, e) => {
          console.log('[WebSocket] ❌ Recognition canceled:', e.reason);
          if (e.reason === speechsdk.CancellationReason.Error) {
            console.error('[WebSocket] ❌ Recognition error:', e.errorDetails);
          }
        };
        
        recognizer.sessionStopped = (s, e) => {
          console.log('[WebSocket] 🛑 Recognition session stopped');
        };
        
        // Start continuous recognition
        try {
          recognizer.startContinuousRecognitionAsync(
            () => {
              console.log('[WebSocket] ✅ Continuous recognition started');
              isInitialized = true;
              ws.send(JSON.stringify({
                type: 'status',
                message: 'Azure Speech SDK initialized successfully'
              }));
            },
            (error) => {
              console.error('[WebSocket] ❌ Failed to start continuous recognition:', error);
              ws.send(JSON.stringify({
                type: 'error',
                error: `Failed to start recognition: ${error}`
              }));
            }
          );
        } catch (startError) {
          console.error('[WebSocket] ❌ Start recognition error:', startError);
          throw new Error(`Start recognition failed: ${startError.message}`);
        }
        
      } catch (error) {
        console.error('[WebSocket] ❌ Azure Speech SDK initialization failed:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: `Azure Speech SDK initialization failed: ${error.message}`,
          details: {
            phase: 'azure_initialization',
            errorType: error.name || 'UnknownError',
            language: language
          }
        }));
        
        // Clean up resources
        cleanup();
      }
    };
    
    // Cleanup function
    const cleanup = () => {
      try {
        if (recognizer) {
          recognizer.stopContinuousRecognitionAsync(
            () => {
              console.log('[WebSocket] ✅ Recognition stopped');
              recognizer.close();
              recognizer = null;
            },
            (error) => {
              console.error('[WebSocket] ❌ Error stopping recognition:', error);
            }
          );
        }
        
        if (pushStream) {
          pushStream.close();
          pushStream = null;
        }
        
        isInitialized = false;
      } catch (error) {
        console.error('[WebSocket] ❌ Cleanup error:', error);
      }
    };
    
    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('[WebSocket] 📥 Received message:', message.type);
        
        switch (message.type) {
          case 'init':
            console.log('[WebSocket] 🔧 Initializing with config:', message);
            initializeAzureSpeech(message.language || 'ar-SA');
            break;
            
          case 'audio':
            if (isInitialized && pushStream) {
              try {
                // Convert base64 audio to buffer
                const audioBuffer = Buffer.from(message.data, 'base64');
                pushStream.write(audioBuffer);
                console.log('[WebSocket] 📤 Audio data sent:', audioBuffer.length, 'bytes');
              } catch (audioError) {
                console.error('[WebSocket] ❌ Audio processing error:', audioError);
              }
            } else {
              console.warn('[WebSocket] ⚠️ Audio received but not initialized');
            }
            break;
            
          case 'stop':
            console.log('[WebSocket] 🛑 Stopping recognition');
            cleanup();
            break;
            
          default:
            console.log('[WebSocket] 📥 Unknown message type:', message.type);
        }
        
      } catch (error) {
        console.error('[WebSocket] ❌ Message processing error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: `Message processing failed: ${error.message}`
        }));
      }
    });
    
    // Handle connection close
    ws.on('close', () => {
      console.log('[WebSocket] 🔌 Client disconnected');
      cleanup();
    });
    
    // Handle connection errors
    ws.on('error', (error) => {
      console.error('[WebSocket] ❌ WebSocket error:', error);
      cleanup();
    });
  });
  
  return wsServer;
}

// Export the fixed WebSocket server
export { createFixedWebSocketServer }; 