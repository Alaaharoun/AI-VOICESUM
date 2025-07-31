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

// Complete language mapping from the app
const AZURE_LANGUAGE_MAP = {
  'ar': 'ar-SA', 'en': 'en-US', 'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE',
  'it': 'it-IT', 'pt': 'pt-BR', 'ru': 'ru-RU', 'ja': 'ja-JP', 'ko': 'ko-KR',
  'zh': 'zh-CN', 'tr': 'tr-TR', 'nl': 'nl-NL', 'pl': 'pl-PL', 'sv': 'sv-SE',
  'da': 'da-DK', 'no': 'no-NO', 'fi': 'fi-FI', 'cs': 'cs-CZ', 'sk': 'sk-SK',
  'hu': 'hu-HU', 'ro': 'ro-RO', 'bg': 'bg-BG', 'hr': 'hr-HR', 'sl': 'sl-SI',
  'et': 'et-EE', 'lv': 'lv-LV', 'lt': 'lt-LT', 'el': 'el-GR', 'he': 'he-IL',
  'th': 'th-TH', 'vi': 'vi-VN', 'id': 'id-ID', 'ms': 'ms-MY', 'fil': 'fil-PH',
  'hi': 'hi-IN', 'bn': 'bn-IN', 'ur': 'ur-PK', 'fa': 'fa-IR', 'uk': 'uk-UA'
};

// All supported languages for auto-detection (Azure Speech Service supported)
const AZURE_AUTO_DETECT_LANGUAGES = [
  // English variants
  "en-US", "en-GB", "en-AU", "en-CA", "en-IN",
  
  // Arabic variants
  "ar-SA", "ar-EG", "ar-MA", "ar-AE", "ar-DZ", "ar-TN", "ar-JO", "ar-LB", 
  "ar-KW", "ar-QA", "ar-BH", "ar-OM", "ar-YE", "ar-SY", "ar-IQ", "ar-LY", "ar-PS",
  
  // French variants
  "fr-FR", "fr-CA", "fr-BE", "fr-CH",
  
  // Spanish variants
  "es-ES", "es-MX", "es-AR", "es-CO", "es-PE", "es-VE", "es-EC", "es-GT", 
  "es-CR", "es-PA", "es-CU", "es-BO", "es-DO", "es-HN", "es-PY", "es-SV", 
  "es-NI", "es-PR", "es-UY", "es-CL",
  
  // German variants
  "de-DE", "de-AT", "de-CH",
  
  // Italian variants
  "it-IT", "it-CH",
  
  // Portuguese variants
  "pt-BR", "pt-PT",
  
  // Russian
  "ru-RU",
  
  // Chinese variants
  "zh-CN", "zh-TW", "zh-HK",
  
  // Japanese
  "ja-JP",
  
  // Korean
  "ko-KR",
  
  // Indian languages
  "hi-IN", "bn-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "gu-IN", "mr-IN", "pa-IN",
  
  // Turkish
  "tr-TR",
  
  // Dutch variants
  "nl-NL", "nl-BE",
  
  // Scandinavian languages
  "sv-SE", "da-DK", "nb-NO", "fi-FI",
  
  // Eastern European languages
  "pl-PL", "cs-CZ", "hu-HU", "ro-RO", "bg-BG", "hr-HR", "sk-SK", "sl-SI", 
  "et-EE", "lv-LV", "lt-LT", "uk-UA",
  
  // Other European languages
  "el-GR", "mt-MT", "is-IS", "ga-IE", "cy-GB",
  
  // Middle Eastern languages
  "he-IL", "fa-IR", "ur-PK",
  
  // Asian languages
  "th-TH", "vi-VN", "id-ID", "ms-MY", "fil-PH",
  
  // African languages
  "sw-KE", "am-ET", "zu-ZA", "af-ZA",
  
  // Other languages
  "ka-GE", "hy-AM", "az-AZ", "kk-KZ", "ky-KG", "uz-UZ", "mn-MN", "my-MM", 
  "km-KH", "lo-LA", "si-LK"
];

// Convert language code to Azure format
function convertToAzureLanguage(langCode) {
  const azureCode = AZURE_LANGUAGE_MAP[langCode];
  if (!azureCode) {
    console.warn(`⚠️ Unsupported language code: ${langCode}, defaulting to en-US`);
    return 'en-US';
  }
  console.log(`🌐 Language conversion: ${langCode} → ${azureCode}`);
  return azureCode;
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
    supportedLanguages: Object.keys(AZURE_LANGUAGE_MAP).length,
    autoDetectLanguages: AZURE_AUTO_DETECT_LANGUAGES.length
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
// WEBSOCKET REAL-TIME STREAMING WITH AUTO-DETECTION
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
            const sourceLanguage = msg.language || 'auto';
            autoDetection = sourceLanguage === 'auto' || msg.autoDetection || false;
            
            console.log(`🌐 Initializing with language: ${sourceLanguage}, auto-detection: ${autoDetection}`);
            
            // Create Azure Speech configuration
            const audioFormat = speechsdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
            pushStream = speechsdk.AudioInputStream.createPushStream(audioFormat);
            audioConfig = speechsdk.AudioConfig.fromStreamInput(pushStream);
            
            speechConfig = speechsdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
            speechConfig.enableDictation();
            
            // Enhanced auto-detection setup
            if (autoDetection) {
              console.log('🧠 Auto Language Detection Enabled');
              console.log(`🌍 Auto-detecting from ${AZURE_AUTO_DETECT_LANGUAGES.length} supported languages`);
              
              try {
                // Use AutoDetectSourceLanguageConfig for better auto-detection
                const autoDetectConfig = speechsdk.AutoDetectSourceLanguageConfig.fromLanguages(AZURE_AUTO_DETECT_LANGUAGES);
                recognizer = new speechsdk.SpeechRecognizer(speechConfig, autoDetectConfig, audioConfig);
                console.log('✅ AutoDetect recognizer created successfully');
              } catch (error) {
                console.error('❌ Failed to create AutoDetect recognizer:', error);
                // Fallback to specific language
                speechConfig.speechRecognitionLanguage = 'en-US';
                recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
                console.log('🔄 Fallback to en-US recognizer');
              }
            } else {
              // Specific language mode
              const azureLanguage = convertToAzureLanguage(sourceLanguage);
              speechConfig.speechRecognitionLanguage = azureLanguage;
              recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
              console.log(`✅ Specific language recognizer created: ${azureLanguage}`);
            }
            
            // Enhanced event handlers with auto-detection support
            recognizer.recognizing = (s, e) => {
              if (e.result.text && e.result.text.trim()) {
                // Extract detected language for auto-detection mode
                if (autoDetection && e.result.properties) {
                  detectedLanguage = e.result.properties.getProperty(speechsdk.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguageResult);
                  console.log(`🎤 [AUTO→${detectedLanguage || 'detecting...'}] Recognizing: "${e.result.text}"`);
                } else {
                  console.log(`🎤 [${language}] Recognizing: "${e.result.text}"`);
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
                  console.log(`✅ [${language}] Final: "${e.result.text}"`);
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
              ws.send(JSON.stringify({ 
                type: 'error', 
                error: `Recognition canceled: ${e.errorDetails}`,
                reason: e.reason,
                errorCode: e.errorCode
              }));
            };
            
            // Start recognition
            recognizer.startContinuousRecognitionAsync(
              () => {
                console.log('✅ Continuous recognition started');
                initialized = true;
                ws.send(JSON.stringify({ 
                  type: 'ready', 
                  message: 'Ready for audio',
                  autoDetection: autoDetection,
                  supportedLanguages: AZURE_AUTO_DETECT_LANGUAGES.length
                }));
              },
              (err) => {
                console.error('❌ Failed to start recognition:', err);
                ws.send(JSON.stringify({ type: 'error', error: `Failed to start: ${err}` }));
              }
            );
            return;
          }
          
          if (msg.type === 'audio' && initialized) {
            // Handle audio data
            const audioBuffer = Buffer.from(msg.data, 'base64');
            const audioFormat = msg.format || 'audio/webm';
            
            console.log(`🎵 Received audio: ${audioBuffer.length} bytes, ${audioFormat}`);
            
            if (audioFormat === 'audio/pcm') {
              pushStream.write(audioBuffer);
            } else {
              convertAudioFormat(audioBuffer, audioFormat)
                .then(wavBuffer => {
                  pushStream.write(wavBuffer);
                })
                .catch(error => {
                  console.error('❌ Audio processing error:', error);
                  ws.send(JSON.stringify({ 
                    type: 'error', 
                    error: 'Audio processing failed' 
                  }));
                });
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
  console.log(`🧠 Auto-detection languages: ${AZURE_AUTO_DETECT_LANGUAGES.length}`);
  console.log('✨ Server ready for connections!');
});