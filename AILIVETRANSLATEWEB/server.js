const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const ffmpegPath = require('ffmpeg-static');
const WebSocket = require('ws');
const speechsdk = require('microsoft-cognitiveservices-speech-sdk');
const http = require('http');
require('dotenv').config();

const execAsync = promisify(exec);
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
const upload = multer();

// Environment variables
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;

// Server startup logging
console.log('🚀 AI Live Translate Server Starting...');
console.log('📊 Configuration:');
console.log('- Azure Speech Key:', AZURE_SPEECH_KEY ? '✅ Present' : '❌ Missing');
console.log('- Azure Speech Region:', AZURE_SPEECH_REGION || '❌ Not set');
console.log('- Server Port:', process.env.PORT || 10000);

// ============================================================================
// LANGUAGE SUPPORT - All languages from the app
// ============================================================================

// Complete language mapping from the app - Updated for full compatibility
const AZURE_LANGUAGE_MAP = {
  // Arabic variants
  'ar': 'ar-SA', 'ar-SA': 'ar-SA', 'ar-EG': 'ar-EG', 'ar-AE': 'ar-AE',
  'ar-MA': 'ar-MA', 'ar-DZ': 'ar-DZ', 'ar-TN': 'ar-TN', 'ar-JO': 'ar-JO',
  'ar-LB': 'ar-LB', 'ar-KW': 'ar-KW', 'ar-QA': 'ar-QA', 'ar-BH': 'ar-BH',
  'ar-OM': 'ar-OM', 'ar-YE': 'ar-YE', 'ar-SY': 'ar-SY', 'ar-IQ': 'ar-IQ',
  'ar-PS': 'ar-PS',
  
  // English variants
  'en': 'en-US', 'en-US': 'en-US', 'en-GB': 'en-GB', 'en-AU': 'en-AU',
  'en-CA': 'en-CA', 'en-IN': 'en-IN', 'en-IE': 'en-IE', 'en-NZ': 'en-NZ',
  'en-ZA': 'en-ZA', 'en-PH': 'en-PH',
  
  // French variants
  'fr': 'fr-FR', 'fr-FR': 'fr-FR', 'fr-CA': 'fr-CA', 'fr-BE': 'fr-BE',
  'fr-CH': 'fr-CH',
  
  // Spanish variants
  'es': 'es-ES', 'es-ES': 'es-ES', 'es-MX': 'es-MX', 'es-AR': 'es-AR',
  'es-CO': 'es-CO', 'es-PE': 'es-PE', 'es-VE': 'es-VE', 'es-CL': 'es-CL',
  
  // German variants
  'de': 'de-DE', 'de-DE': 'de-DE', 'de-AT': 'de-AT', 'de-CH': 'de-CH',
  
  // Italian variants
  'it': 'it-IT', 'it-IT': 'it-IT', 'it-CH': 'it-CH',
  
  // Portuguese variants
  'pt': 'pt-BR', 'pt-BR': 'pt-BR', 'pt-PT': 'pt-PT',
  
  // Other languages
  'ru': 'ru-RU', 'ru-RU': 'ru-RU',
  'ja': 'ja-JP', 'ja-JP': 'ja-JP',
  'ko': 'ko-KR', 'ko-KR': 'ko-KR',
  'zh': 'zh-CN', 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', 'zh-HK': 'zh-HK',
  'hi': 'hi-IN', 'hi-IN': 'hi-IN',
  'tr': 'tr-TR', 'tr-TR': 'tr-TR',
  'nl': 'nl-NL', 'nl-NL': 'nl-NL', 'nl-BE': 'nl-BE',
  'sv': 'sv-SE', 'sv-SE': 'sv-SE',
  'da': 'da-DK', 'da-DK': 'da-DK',
  'no': 'nb-NO', 'nb-NO': 'nb-NO', 'nn-NO': 'nn-NO',
  'fi': 'fi-FI', 'fi-FI': 'fi-FI',
  'pl': 'pl-PL', 'pl-PL': 'pl-PL',
  'cs': 'cs-CZ', 'cs-CZ': 'cs-CZ',
  'hu': 'hu-HU', 'hu-HU': 'hu-HU',
  'ro': 'ro-RO', 'ro-RO': 'ro-RO',
  'bg': 'bg-BG', 'bg-BG': 'bg-BG',
  'hr': 'hr-HR', 'hr-HR': 'hr-HR',
  'sk': 'sk-SK', 'sk-SK': 'sk-SK',
  'sl': 'sl-SI', 'sl-SI': 'sl-SI',
  'et': 'et-EE', 'et-EE': 'et-EE',
  'lv': 'lv-LV', 'lv-LV': 'lv-LV',
  'lt': 'lt-LT', 'lt-LT': 'lt-LT',
  'el': 'el-GR', 'el-GR': 'el-GR',
  'he': 'he-IL', 'he-IL': 'he-IL',
  'th': 'th-TH', 'th-TH': 'th-TH',
  'vi': 'vi-VN', 'vi-VN': 'vi-VN',
  'id': 'id-ID', 'id-ID': 'id-ID',
  'ms': 'ms-MY', 'ms-MY': 'ms-MY',
  'fil': 'fil-PH', 'fil-PH': 'fil-PH',
  'bn': 'bn-IN', 'bn-IN': 'bn-IN',
  'ur': 'ur-PK', 'ur-PK': 'ur-PK',
  'fa': 'fa-IR', 'fa-IR': 'fa-IR',
  'uk': 'uk-UA', 'uk-UA': 'uk-UA'
};

// Convert language code to Azure format with improved compatibility
function convertToAzureLanguage(langCode) {
  // Direct mapping for full language codes
  if (AZURE_LANGUAGE_MAP[langCode]) {
    console.log(`🌐 Direct language mapping: ${langCode} → ${AZURE_LANGUAGE_MAP[langCode]}`);
    return AZURE_LANGUAGE_MAP[langCode];
  }
  
  // Fallback for short codes (e.g., 'ar' → 'ar-SA')
  const shortCode = langCode.split('-')[0];
  const fallbackCode = AZURE_LANGUAGE_MAP[shortCode];
  
  if (fallbackCode) {
    console.log(`🌐 Fallback language mapping: ${langCode} → ${fallbackCode}`);
    return fallbackCode;
  }
  
  console.warn(`⚠️ Unsupported language code: ${langCode}, defaulting to en-US`);
  return 'en-US';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Convert MIME type to file extension
function mimeToExtension(mimeType) {
  if (mimeType.includes('webm')) return '.webm';
  if (mimeType.includes('ogg')) return '.ogg';
  if (mimeType.includes('mp3')) return '.mp3';
  if (mimeType.includes('wav')) return '.wav';
  if (mimeType.includes('m4a')) return '.m4a';
  if (mimeType.includes('pcm')) return '.raw';
  return '.bin';
}

// Convert audio format to WAV
async function convertAudioFormat(audioBuffer, inputFormat) {
  try {
    console.log(`🔄 Converting ${inputFormat} to WAV...`);
    
    const inputExtension = mimeToExtension(inputFormat);
    const inputFile = `/tmp/input_${Date.now()}${inputExtension}`;
    const outputFile = `/tmp/output_${Date.now()}.wav`;
    
    fs.writeFileSync(inputFile, audioBuffer);
    
    const ffmpegCommand = `${ffmpegPath} -i "${inputFile}" -acodec pcm_s16le -ar 16000 -ac 1 "${outputFile}" -y`;
    await execAsync(ffmpegCommand);
    
    const convertedBuffer = fs.readFileSync(outputFile);
    
    // Cleanup
    try {
      fs.unlinkSync(inputFile);
      fs.unlinkSync(outputFile);
    } catch (cleanupError) {
      console.warn('⚠️ Could not clean up temp files:', cleanupError.message);
    }
    
    console.log(`✅ Conversion successful: ${audioBuffer.length} → ${convertedBuffer.length} bytes`);
    return convertedBuffer;
    
  } catch (error) {
    console.error('❌ Audio conversion failed:', error.message);
    return audioBuffer; // Return original if conversion fails
  }
}

// ============================================================================
// HTTP ENDPOINTS
// ============================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    azureKey: AZURE_SPEECH_KEY ? 'Present' : 'Missing',
    supportedLanguages: Object.keys(AZURE_LANGUAGE_MAP).length
  });
});

// Audio transcription endpoint
const SUPPORTED_AUDIO_TYPES = [
  'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 
  'audio/m4a', 'audio/x-m4a', 'audio/ogg', 'audio/webm', 'audio/flac', 
  'audio/mp4', 'audio/pcm'
];

app.post('/live-translate', upload.single('audio'), async (req, res) => {
  try {
    let audioBuffer, audioType;
    
    if (req.file) {
      audioBuffer = req.file.buffer;
      audioType = req.file.mimetype;
    } else if (req.body && req.body.audio && req.body.audioType) {
      audioBuffer = Buffer.from(req.body.audio, 'base64');
      audioType = req.body.audioType;
    } else {
      return res.status(400).json({ error: 'Missing audio data' });
    }
    
    if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
      return res.status(500).json({ error: 'Azure Speech API not configured' });
    }
    
    if (!SUPPORTED_AUDIO_TYPES.includes(audioType)) {
      return res.status(400).json({ error: 'Unsupported audio format' });
    }
    
    console.log(`🎵 Processing audio: ${audioType}, ${audioBuffer.length} bytes`);
    
    const wavBuffer = await convertAudioFormat(audioBuffer, audioType);
    const language = req.body.language || req.query.language || 'en-US';
    
    const azureEndpoint = `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}`;
    
    const azureRes = await fetch(azureEndpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Type': 'audio/wav',
        'Accept': 'application/json'
      },
      body: wavBuffer
    });
    
    const azureData = await azureRes.json();
    const transcriptText = azureData.DisplayText || '';
    
    console.log(`✅ Transcription: "${transcriptText}"`);
    res.json({ transcription: transcriptText });
    
  } catch (error) {
    console.error('❌ Live-translate error:', error);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// ============================================================================
// WEBSOCKET REAL-TIME STREAMING
// ============================================================================

let wsServer;

function startWebSocketServer(server) {
  wsServer = new WebSocket.Server({ server, path: '/ws' });
  console.log('🔌 WebSocket server started on /ws');

  wsServer.on('connection', (ws) => {
    console.log('🔗 New WebSocket client connected');
    
    if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
      console.error('❌ Azure Speech credentials missing');
      ws.send(JSON.stringify({ type: 'error', error: 'Azure Speech credentials missing' }));
      ws.close();
      return;
    }

    let recognizer, pushStream, speechConfig, audioConfig;
    let language = 'en-US';
    let initialized = false;
    let autoDetection = false;
    let detectedLanguage = null;

    ws.on('message', (data) => {
      try {
        // Handle JSON messages (ping, init, etc.)
        try {
          const msg = JSON.parse(data.toString());
          
          if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }
          
          if (!initialized && msg.type === 'init') {
            // Support both 'language' and 'sourceLanguage' fields for compatibility
            const sourceLanguage = msg.language || msg.sourceLanguage || 'auto';
            // Only enable auto-detection if explicitly requested or if language is 'auto'
            autoDetection = (sourceLanguage === 'auto') || (msg.autoDetection === true);
            
            console.log(`🌐 Initializing with language: ${sourceLanguage}, auto-detection: ${autoDetection}`);
            
            // Create Azure Speech configuration
            const audioFormat = speechsdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
            pushStream = speechsdk.AudioInputStream.createPushStream(audioFormat);
            audioConfig = speechsdk.AudioConfig.fromStreamInput(pushStream);
            
            speechConfig = speechsdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
            speechConfig.enableDictation();
            
            // Improved auto-detection setup with proper Azure Speech SDK implementation
            if (autoDetection) {
              console.log('🧠 Auto Language Detection Enabled');
              
              try {
                // Use a very minimal set of languages for better compatibility
                const autoDetectLanguages = ["en-US", "ar-SA"];
                
                // Create auto-detect config using the correct Azure Speech SDK method
                const autoDetectConfig = speechsdk.AutoDetectSourceLanguageConfig.fromLanguages(autoDetectLanguages);
                
                // Create recognizer with the correct parameter order
                recognizer = new speechsdk.SpeechRecognizer(speechConfig, autoDetectConfig, audioConfig);
                console.log('✅ AutoDetect recognizer created successfully');
                
              } catch (error) {
                console.error('❌ Failed to create AutoDetect recognizer:', error);
                
                // Fallback to specific language mode
                console.log('🔄 Fallback to specific language mode');
                speechConfig.speechRecognitionLanguage = 'en-US';
                recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
                autoDetection = false;
                console.log('✅ Fallback recognizer created successfully');
              }
            } else {
              // Specific language mode
              const azureLanguage = convertToAzureLanguage(sourceLanguage);
              speechConfig.speechRecognitionLanguage = azureLanguage;
              recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
              console.log(`✅ Specific language recognizer created: ${azureLanguage}`);
              console.log(`🎯 Using specific language: ${sourceLanguage} → ${azureLanguage}`);
              console.log(`🎯 Using specific language: ${sourceLanguage} → ${azureLanguage}`);
            }
            
            // Event handlers
            recognizer.recognizing = (s, e) => {
              if (e.result.text && e.result.text.trim()) {
                // Extract detected language for auto-detection mode
                if (autoDetection && e.result.properties) {
                  detectedLanguage = e.result.properties.getProperty(speechsdk.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguageResult);
                  console.log(`🎤 [AUTO→${detectedLanguage || 'detecting...'}] Recognizing: "${e.result.text}"`);
                } else {
                  console.log(`🎤 [${sourceLanguage}] Recognizing: "${e.result.text}"`);
                }
                
                ws.send(JSON.stringify({ 
                  type: 'transcription', 
                  text: e.result.text,
                  isPartial: true,
                  detectedLanguage: detectedLanguage
                }));
              }
            };
            
            recognizer.recognized = (s, e) => {
              if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech && e.result.text) {
                // Extract detected language for final result
                if (autoDetection && e.result.properties) {
                  detectedLanguage = e.result.properties.getProperty(speechsdk.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguageResult);
                  console.log(`✅ [AUTO→${detectedLanguage}] Final: "${e.result.text}"`);
                } else {
                  console.log(`✅ [${sourceLanguage}] Final: "${e.result.text}"`);
                }
                
                ws.send(JSON.stringify({ 
                  type: 'final', 
                  text: e.result.text,
                  isPartial: false,
                  detectedLanguage: detectedLanguage
                }));
              } else if (e.result.reason === speechsdk.ResultReason.NoMatch) {
                console.log('⚪ No speech could be recognized');
                ws.send(JSON.stringify({ 
                  type: 'final', 
                  text: '',
                  reason: 'NoMatch',
                  detectedLanguage: detectedLanguage
                }));
              }
            };
            
            recognizer.canceled = (s, e) => {
              console.error('❌ Recognition canceled:', e.errorDetails);
              
              // Check if it's a network-related error
              const isNetworkError = e.errorDetails && (
                e.errorDetails.includes('network') || 
                e.errorDetails.includes('Unable to contact server') ||
                e.errorDetails.includes('StatusCode: 1002') ||
                e.errorDetails.includes('StatusCode: 0')
              );
              
              if (isNetworkError) {
                console.log('🌐 Network error detected, attempting to reconnect...');
                // Try to restart recognition after a short delay
                setTimeout(() => {
                  if (recognizer && ws.readyState === ws.OPEN) {
                    try {
                      recognizer.startContinuousRecognitionAsync(
                        () => console.log('✅ Recognition restarted after network error'),
                        (err) => console.error('❌ Failed to restart recognition:', err)
                      );
                    } catch (restartError) {
                      console.error('❌ Error restarting recognition:', restartError);
                    }
                  }
                }, 2000);
              }
              
              ws.send(JSON.stringify({ 
                type: 'error', 
                error: `Recognition canceled: ${e.errorDetails}`,
                reason: e.reason,
                errorCode: e.errorCode,
                isNetworkError: isNetworkError
              }));
            };
            
            // Start recognition with better error handling
            recognizer.startContinuousRecognitionAsync(
              () => {
                console.log('✅ Continuous recognition started');
                initialized = true;
                ws.send(JSON.stringify({ 
                  type: 'ready', 
                  message: 'Ready for audio',
                  autoDetection: autoDetection
                }));
              },
              (err) => {
                console.error('❌ Failed to start recognition:', err);
                
                // Try to restart with specific language if auto-detection fails
                if (autoDetection) {
                  console.log('🔄 Attempting to restart with specific language...');
                  try {
                    speechConfig.speechRecognitionLanguage = 'en-US';
                    recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
                    
                    recognizer.startContinuousRecognitionAsync(
                      () => {
                        console.log('✅ Recognition restarted with specific language');
                        initialized = true;
                        autoDetection = false;
                        ws.send(JSON.stringify({ 
                          type: 'ready', 
                          message: 'Ready for audio (fallback mode)',
                          autoDetection: false
                        }));
                      },
                      (fallbackErr) => {
                        console.error('❌ Fallback recognition also failed:', fallbackErr);
                        ws.send(JSON.stringify({ type: 'error', error: `Recognition failed: ${fallbackErr}` }));
                      }
                    );
                  } catch (fallbackError) {
                    console.error('❌ Failed to create fallback recognizer:', fallbackError);
                    ws.send(JSON.stringify({ type: 'error', error: `Recognition setup failed: ${fallbackError}` }));
                  }
                } else {
                  ws.send(JSON.stringify({ type: 'error', error: `Failed to start: ${err}` }));
                }
              }
            );
            return;
          }
          
          if (msg.type === 'audio' && initialized) {
            // Handle audio data
            const audioBuffer = Buffer.from(msg.data, 'base64');
            const audioFormat = msg.format || 'audio/webm';
            
            console.log(`🎵 Received audio: ${audioBuffer.length} bytes, ${audioFormat}`);
            
            try {
              if (audioFormat === 'audio/pcm') {
                // Direct PCM data - ensure it's in the correct format
                if (audioBuffer.length > 0) {
                  pushStream.write(audioBuffer);
                }
              } else {
                // Convert other formats to WAV
                convertAudioFormat(audioBuffer, audioFormat)
                  .then(wavBuffer => {
                    if (wavBuffer && wavBuffer.length > 0) {
                      pushStream.write(wavBuffer);
                    }
                  })
                  .catch(error => {
                    console.error('❌ Audio processing error:', error);
                    ws.send(JSON.stringify({ 
                      type: 'error', 
                      error: 'Audio processing failed' 
                    }));
                  });
              }
            } catch (audioError) {
              console.error('❌ Audio write error:', audioError);
              ws.send(JSON.stringify({ 
                type: 'error', 
                error: 'Audio write failed' 
              }));
            }
          }
          
        } catch (jsonError) {
          // Handle raw audio data
          if (initialized && pushStream) {
            console.log(`🎵 Received raw audio: ${data.length} bytes`);
            pushStream.write(data);
          }
        }
        
      } catch (error) {
        console.error('❌ WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', error: 'Message handling failed' }));
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
      if (recognizer) {
        recognizer.stopContinuousRecognitionAsync(() => {
          recognizer.close();
        });
      }
      if (pushStream) pushStream.close();
      if (speechConfig) speechConfig.close();
    });

    ws.on('error', (err) => {
      console.error('❌ WebSocket error:', err.message);
      if (recognizer) recognizer.close();
      if (pushStream) pushStream.close();
      if (speechConfig) speechConfig.close();
      ws.close();
    });

    // Add connection timeout
    const connectionTimeout = setTimeout(() => {
      if (!initialized) {
        console.log('⏰ Connection timeout - closing inactive connection');
        ws.close();
      }
    }, 30000); // 30 seconds timeout

    ws.on('close', () => {
      clearTimeout(connectionTimeout);
      console.log('🔌 WebSocket connection closed');
      if (recognizer) {
        recognizer.stopContinuousRecognitionAsync(() => {
          recognizer.close();
        });
      }
      if (pushStream) pushStream.close();
      if (speechConfig) speechConfig.close();
    });
  });
}

// ============================================================================
// SERVER STARTUP
// ============================================================================

const server = http.createServer(app);
startWebSocketServer(server);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 AI Live Translate Server running on port ${PORT}`);
  console.log(`📡 HTTP endpoints: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Supported languages: ${Object.keys(AZURE_LANGUAGE_MAP).length}`);
  console.log('✨ Server ready for connections!');
});