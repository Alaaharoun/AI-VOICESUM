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
    languageIdentification: {
      supported: true,
      modes: ['AtStart', 'Continuous'],
      maxLanguages: {
        atStart: 4,
        continuous: 10
      },
      endpoints: [
        '/live-translate',
        '/identify-language', 
        '/batch-transcribe'
      ]
    }
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

// Language identification endpoint using Azure REST API
app.post('/identify-language', upload.single('audio'), async (req, res) => {
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
    
    console.log(`🔍 Language identification: ${audioType}, ${audioBuffer.length} bytes`);
    
    const wavBuffer = await convertAudioFormat(audioBuffer, audioType);
    
    // Get candidate languages from request or use defaults
    const candidateLanguages = req.body.candidateLanguages || [
      'en-US', 'ar-SA', 'fr-FR', 'es-ES', 'de-DE'
    ];
    
    // Use Azure's language identification endpoint
    const lidEndpoint = `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=auto`;
    
    const azureRes = await fetch(lidEndpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Type': 'audio/wav',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: wavBuffer
    });
    
    if (!azureRes.ok) {
      const errorText = await azureRes.text();
      console.error('❌ Azure LID error:', azureRes.status, errorText);
      return res.status(azureRes.status).json({ 
        error: 'Language identification failed',
        details: errorText
      });
    }
    
    const azureData = await azureRes.json();
    
    // Extract detected language from response headers or body
    const detectedLanguage = azureRes.headers.get('X-Detected-Language') || 
                           azureData.Language || 
                           azureData.language ||
                           'unknown';
    
    console.log(`✅ Language identified: ${detectedLanguage}`);
    
    res.json({ 
      detectedLanguage: detectedLanguage,
      confidence: azureData.Confidence || 0.0,
      transcription: azureData.DisplayText || '',
      candidateLanguages: candidateLanguages
    });
    
  } catch (error) {
    console.error('❌ Language identification error:', error);
    res.status(500).json({ error: 'Language identification failed' });
  }
});

// Batch transcription with language identification
app.post('/batch-transcribe', upload.single('audio'), async (req, res) => {
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
    
    console.log(`📝 Batch transcription: ${audioType}, ${audioBuffer.length} bytes`);
    
    // Get candidate languages from request
    const candidateLanguages = req.body.candidateLanguages || [
      'en-US', 'ar-SA', 'fr-FR', 'es-ES', 'de-DE'
    ];
    
    // Create batch transcription request with language identification
    const batchEndpoint = `https://${AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions`;
    
    // First, create the transcription
    const createResponse = await fetch(batchEndpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          languageIdentification: {
            candidateLocales: candidateLanguages
          }
        }
      })
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('❌ Batch transcription creation failed:', createResponse.status, errorText);
      return res.status(createResponse.status).json({ 
        error: 'Batch transcription creation failed',
        details: errorText
      });
    }
    
    const transcriptionData = await createResponse.json();
    const transcriptionId = transcriptionData.id;
    
    console.log(`📝 Created batch transcription: ${transcriptionId}`);
    
    // Upload audio file
    const uploadUrl = transcriptionData.links.content;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'audio/wav'
      },
      body: audioBuffer
    });
    
    if (!uploadResponse.ok) {
      console.error('❌ Audio upload failed:', uploadResponse.status);
      return res.status(uploadResponse.status).json({ error: 'Audio upload failed' });
    }
    
    console.log(`✅ Audio uploaded successfully`);
    
    // Start transcription
    const startResponse = await fetch(`${batchEndpoint}/${transcriptionId}`, {
      method: 'PATCH',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'Running'
      })
    });
    
    if (!startResponse.ok) {
      console.error('❌ Failed to start transcription:', startResponse.status);
      return res.status(startResponse.status).json({ error: 'Failed to start transcription' });
    }
    
    console.log(`✅ Batch transcription started`);
    
    res.json({ 
      transcriptionId: transcriptionId,
      status: 'started',
      message: 'Batch transcription with language identification started'
    });
    
  } catch (error) {
    console.error('❌ Batch transcription error:', error);
    res.status(500).json({ error: 'Batch transcription failed' });
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
    let lidMode = 'AtStart'; // Default to AtStart, can be 'Continuous'

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
            lidMode = msg.lidMode || 'AtStart'; // Allow client to specify LID mode
            
            console.log(`🌐 Initializing with language: ${sourceLanguage}, auto-detection: ${autoDetection}, LID mode: ${lidMode}`);
            
            // Create Azure Speech configuration
            const audioFormat = speechsdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
            pushStream = speechsdk.AudioInputStream.createPushStream(audioFormat);
            audioConfig = speechsdk.AudioConfig.fromStreamInput(pushStream);
            
            speechConfig = speechsdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
            speechConfig.enableDictation();
            
            // Set language identification mode for continuous LID
            if (lidMode === 'Continuous') {
              speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceConnection_LanguageIdMode, 'Continuous');
              console.log('🔄 Continuous Language Identification enabled');
            } else {
              speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceConnection_LanguageIdMode, 'AtStart');
              console.log('🎯 At-Start Language Identification enabled');
            }
            
            // Improved auto-detection setup with better error handling
            if (autoDetection) {
              console.log('🧠 Auto Language Detection Enabled');
              
              try {
                // Define candidate languages based on LID mode
                // For AtStart: up to 4 languages, for Continuous: up to 10 languages
                const maxLanguages = lidMode === 'Continuous' ? 10 : 4;
                const candidateLanguages = [
                  "en-US", "ar-SA", "fr-FR", "es-ES", "de-DE", 
                  "it-IT", "pt-BR", "ru-RU", "ja-JP", "ko-KR"
                ].slice(0, maxLanguages);
                
                console.log(`🎯 Using ${candidateLanguages.length} candidate languages: ${candidateLanguages.join(', ')}`);
                
                // Create auto-detect config with proper error handling
                const autoDetectConfig = speechsdk.AutoDetectSourceLanguageConfig.fromLanguages(candidateLanguages);
                
                // Create recognizer with proper configuration order
                recognizer = new speechsdk.SpeechRecognizer(speechConfig, autoDetectConfig, audioConfig);
                console.log('✅ AutoDetect recognizer created successfully');
                
              } catch (error) {
                console.error('❌ Failed to create AutoDetect recognizer:', error);
                
                // Try alternative approach with minimal language set
                try {
                  console.log('🔄 Trying alternative auto-detection setup...');
                  const alternativeLanguages = ["en-US", "ar-SA", "fr-FR"];
                  const altAutoDetectConfig = speechsdk.AutoDetectSourceLanguageConfig.fromLanguages(alternativeLanguages);
                  recognizer = new speechsdk.SpeechRecognizer(speechConfig, altAutoDetectConfig, audioConfig);
                  console.log('✅ Alternative AutoDetect recognizer created successfully');
                  
                } catch (altError) {
                  console.error('❌ Alternative auto-detection also failed:', altError);
                  
                  // Final fallback to specific language
                  console.log('🔄 Final fallback to en-US recognizer');
                  speechConfig.speechRecognitionLanguage = 'en-US';
                  recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
                  autoDetection = false;
                }
              }
            } else {
              // Specific language mode
              const azureLanguage = convertToAzureLanguage(sourceLanguage);
              speechConfig.speechRecognitionLanguage = azureLanguage;
              recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
              console.log(`✅ Specific language recognizer created: ${azureLanguage}`);
            }
            
            // Event handlers with improved language detection
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
                  detectedLanguage: detectedLanguage,
                  lidMode: lidMode
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
                  detectedLanguage: detectedLanguage,
                  lidMode: lidMode
                }));
              } else if (e.result.reason === speechsdk.ResultReason.NoMatch) {
                console.log('⚪ No speech could be recognized');
                ws.send(JSON.stringify({ 
                  type: 'final', 
                  text: '',
                  reason: 'NoMatch',
                  detectedLanguage: detectedLanguage,
                  lidMode: lidMode
                }));
              }
            };
            
            recognizer.canceled = (s, e) => {
              console.error('❌ Recognition canceled:', e.errorDetails);
              
              // Check if it's a network-related error
              const isNetworkError = e.errorDetails && (
                e.errorDetails.includes('network') || 
                e.errorDetails.includes('Unable to contact server') ||
                e.errorDetails.includes('StatusCode: 1002')
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
                isNetworkError: isNetworkError,
                lidMode: lidMode
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
                  lidMode: lidMode
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