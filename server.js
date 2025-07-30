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

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;

console.log('Server starting with Azure Speech API key:', AZURE_SPEECH_KEY ? 'Present' : 'Missing');
console.log('Environment variables:', {
  AZURE_SPEECH_KEY: process.env.AZURE_SPEECH_KEY ? 'Present' : 'Missing',
  AZURE_SPEECH_REGION: process.env.AZURE_SPEECH_REGION ? 'Present' : 'Missing'
});

// Helper function to convert audio format using ffmpeg
async function convertAudioFormat(audioBuffer, inputFormat, outputFormat = 'wav') {
  try {
    console.log(`🔄 Converting audio from ${inputFormat} to PCM WAV 16kHz...`);
    
    // First try ffmpeg conversion
    try {
      // Create temporary files with proper extensions
      let inputExtension = 'mp3'; // default
      if (inputFormat.includes('webm')) inputExtension = 'webm';
      else if (inputFormat.includes('ogg')) inputExtension = 'ogg';
      else if (inputFormat.includes('wav')) inputExtension = 'wav';
      else if (inputFormat.includes('mp3')) inputExtension = 'mp3';
      else if (inputFormat.includes('m4a')) inputExtension = 'm4a';
      
      const inputFile = `/tmp/input_${Date.now()}.${inputExtension}`;
      const outputFile = `/tmp/output_${Date.now()}.wav`;
      
      // Write input buffer to file
      fs.writeFileSync(inputFile, audioBuffer);
      
      // Convert using ffmpeg to PCM WAV 16kHz 16-bit mono
      const ffmpegCommand = `${ffmpegPath} -i "${inputFile}" -acodec pcm_s16le -ar 16000 -ac 1 "${outputFile}" -y`;
      console.log(`🔧 FFmpeg command: ${ffmpegCommand}`);
      
      await execAsync(ffmpegCommand);
      
      // Read converted file
      const convertedBuffer = fs.readFileSync(outputFile);
      
      // Clean up temporary files
      try {
        fs.unlinkSync(inputFile);
        fs.unlinkSync(outputFile);
      } catch (cleanupError) {
        console.warn('⚠️ Could not clean up temporary files:', cleanupError.message);
      }
      
      console.log(`✅ FFmpeg conversion successful: ${audioBuffer.length} bytes → ${convertedBuffer.length} bytes`);
      return convertedBuffer;
      
    } catch (ffmpegError) {
      console.error('❌ FFmpeg conversion failed:', ffmpegError.message);
      
      // If the input is already PCM data, try to create WAV header
      if (inputFormat === 'audio/pcm' || inputFormat.includes('pcm')) {
        console.log('🔄 Creating WAV header for PCM data...');
        
        const sampleRate = 16000;
        const channels = 1;
        const bitsPerSample = 16;
        
        // Create WAV header
        const headerSize = 44;
        const dataSize = audioBuffer.length;
        const fileSize = headerSize + dataSize - 8;
        
        const header = Buffer.alloc(headerSize);
        
        // RIFF header
        header.write('RIFF', 0);
        header.writeUInt32LE(fileSize, 4);
        header.write('WAVE', 8);
        
        // fmt chunk
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16); // fmt chunk size
        header.writeUInt16LE(1, 20); // audio format (PCM)
        header.writeUInt16LE(channels, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28); // byte rate
        header.writeUInt16LE(channels * bitsPerSample / 8, 32); // block align
        header.writeUInt16LE(bitsPerSample, 34);
        
        // data chunk
        header.write('data', 36);
        header.writeUInt32LE(dataSize, 40);
        
        // Combine header with original data
        const wavBuffer = Buffer.concat([header, audioBuffer]);
        console.log(`✅ Created WAV header for PCM data: ${audioBuffer.length} bytes → ${wavBuffer.length} bytes`);
        return wavBuffer;
      }
      
      // For other formats, return original buffer as fallback
      console.warn('⚠️ Using original audio buffer as fallback');
      return audioBuffer;
    }
  } catch (error) {
    console.error('❌ Audio conversion failed:', error);
    // Return original buffer if conversion fails
    return audioBuffer;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKey: AZURE_SPEECH_KEY ? 'Present' : 'Missing',
    timestamp: new Date().toISOString()
  });
});

// Serve delete account page
app.get('/simple-delete-account.html', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Delete Account - AI LIVE TRANSLATE</title>
    <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #F8FAFC;
            color: #1F2937;
            line-height: 1.6;
            padding: 20px;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .logo-icon {
            font-size: 40px;
            margin-bottom: 8px;
        }
        
        .logo {
            font-size: 32px;
            font-weight: bold;
            color: #2563EB;
            margin-bottom: 16px;
        }
        
        .title {
            font-size: 28px;
            font-weight: bold;
            color: #1F2937;
            margin-bottom: 8px;
        }
        
        .subtitle {
            font-size: 16px;
            color: #6B7280;
        }
        
        .warning {
            background-color: #FEE2E2;
            border: 1px solid #DC2626;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 24px;
        }
        
        .warning-title {
            font-size: 18px;
            font-weight: bold;
            color: #DC2626;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
        }
        
        .warning-icon {
            margin-right: 8px;
            font-size: 20px;
        }
        
        .warning-text {
            font-size: 14px;
            color: #DC2626;
            line-height: 1.6;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-label {
            display: block;
            font-size: 14px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
        }
        
        .form-input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid #D1D5DB;
            border-radius: 8px;
            font-size: 14px;
        }
        
        .form-input:focus {
            outline: none;
            border-color: #2563EB;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        
        .delete-button {
            width: 100%;
            background-color: #DC2626;
            color: white;
            border: none;
            border-radius: 16px;
            padding: 16px 24px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            margin-bottom: 16px;
            transition: background-color 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .delete-button:hover {
            background-color: #B91C1C;
        }
        
        .delete-button:disabled {
            background-color: #9CA3AF;
            cursor: not-allowed;
        }
        
        .delete-icon {
            margin-right: 8px;
            font-size: 18px;
        }
        
        .message {
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 16px;
        }
        
        .message.success {
            background-color: #ECFDF5;
            border: 1px solid #10B981;
            color: #047857;
        }
        
        .message.error {
            background-color: #FEE2E2;
            border: 1px solid #EF4444;
            color: #DC2626;
        }
        
        .loading {
            text-align: center;
            color: #6B7280;
        }
        
        .back-link {
            text-align: center;
            margin-top: 24px;
        }
        
        .back-link a {
            color: #2563EB;
            text-decoration: none;
            font-weight: 500;
        }
        
        .back-link a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo-icon">🎤</div>
            <div class="logo">AI LIVE TRANSLATE</div>
            <h1 class="title">Delete Account</h1>
            <p class="subtitle">Permanently remove your account and all associated data</p>
        </div>

        <div class="warning">
            <div class="warning-title">
                <span class="warning-icon">🗑️</span>
                Warning
            </div>
            <div class="warning-text">
                This action will permanently delete your account and all associated data including:
                <br>• All your voice recordings and transcriptions
                <br>• Translation history
                <br>• AI summaries
                <br>• Subscription information
                <br><br>
                <strong>This action cannot be undone.</strong>
            </div>
        </div>

        <div id="deleteForm">
            <div class="form-group">
                <label class="form-label" for="email">Email Address:</label>
                <input type="email" id="email" class="form-input" placeholder="Enter your email address" required>
            </div>

            <div class="form-group">
                <label class="form-label" for="password">Password:</label>
                <input type="password" id="password" class="form-input" placeholder="Enter your password" required>
            </div>

            <div class="form-group">
                <label class="form-label" for="confirmText">Type "DELETE" to confirm:</label>
                <input type="text" id="confirmText" class="form-input" placeholder="Type DELETE" required>
            </div>

            <button id="deleteBtn" class="delete-button" onclick="deleteAccount()">
                <span class="delete-icon">🗑️</span>
                Delete My Account
            </button>
        </div>

        <div id="message"></div>
        
        <div class="back-link">
            <a href="javascript:history.back()">← Back to App</a>
        </div>
    </div>

    <script>
        async function deleteAccount() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmText = document.getElementById('confirmText').value;
            const deleteBtn = document.getElementById('deleteBtn');
            const messageDiv = document.getElementById('message');

            // Validate inputs
            if (!email || !password || !confirmText) {
                showMessage('Please fill in all fields.', 'error');
                return;
            }

            if (confirmText !== 'DELETE') {
                showMessage('Please type "DELETE" to confirm.', 'error');
                return;
            }

            // Show loading
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = '<span class="delete-icon">⏳</span>Deleting Account...';
            showMessage('Processing your request...', 'loading');

            try {
                // Call server API to delete account
                const response = await fetch('/api/delete-account', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Failed to delete account');
                }

                showMessage('Account deleted successfully!', 'success');
                document.getElementById('deleteForm').style.display = 'none';

            } catch (error) {
                console.error('Delete account error:', error);
                showMessage(error.message || 'Failed to delete account. Please try again.', 'error');
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = '<span class="delete-icon">🗑️</span>Delete My Account';
            }
        }

        function showMessage(text, type) {
            const messageDiv = document.getElementById('message');
            messageDiv.className = 'message ' + type;
            messageDiv.textContent = text;
        }
    </script>
</body>
</html>
  `);
});

// Account deletion endpoint
app.post('/api/delete-account', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Import Supabase client
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ai-voicesum.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Sign in to verify credentials
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (signInError) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = signInData.user;

    // Delete user data from all tables
    const tables = ['recordings', 'user_subscriptions', 'free_trials'];
    
    for (const table of tables) {
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        console.error(`Error deleting from ${table}:`, deleteError);
      }
    }

    // Delete the user account
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      return res.status(500).json({ error: 'Failed to delete user account' });
    }

    res.json({ success: true, message: 'Account deleted successfully' });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper: صيغة مدعومة من Azure
const SUPPORTED_AUDIO_TYPES = [
  'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'audio/m4a', 'audio/x-m4a', 'audio/ogg', 'audio/webm', 'audio/flac', 'audio/mp4'
];

// دعم استقبال الصوت عبر form-data أو JSON
app.post('/live-translate', upload.single('audio'), async (req, res) => {
  try {
    let audioBuffer, audioType;
    // إذا كان الطلب form-data
    if (req.file) {
      audioBuffer = req.file.buffer;
      audioType = req.file.mimetype;
    } else if (req.body && req.body.audio && req.body.audioType) {
      // إذا كان JSON
      audioBuffer = Buffer.from(req.body.audio, 'base64');
      audioType = req.body.audioType;
    } else {
      return res.status(400).json({ error: 'Missing audio or audioType in request.' });
    }
    if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
      return res.status(500).json({ error: 'Azure Speech API key or region missing.' });
    }
    if (!SUPPORTED_AUDIO_TYPES.includes(audioType)) {
      return res.status(400).json({ error: 'Unsupported audio format. Please use wav, mp3, m4a, ogg, or other Azure-supported formats.' });
    }
    // طباعة نوع الملف في السجلات
    console.log('Received audio type:', audioType);
    // تحويل الملف إلى wav دائماً قبل الإرسال إلى Azure
    const wavBuffer = await convertAudioFormat(audioBuffer, audioType, 'wav');
    // === دعم اختيار اللغة ===
    const language = req.body.language || req.query.language || 'en-US';
    // إرسال إلى Azure مع تحديد اللغة المطلوبة
    const azureEndpoint = `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}`;
    const azureRes = await fetch(azureEndpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Type': 'audio/wav',
        'Accept': 'application/json',
        'Transfer-Encoding': 'chunked',
      },
      body: wavBuffer,
    });
    const azureData = await azureRes.json();
    const transcriptText = azureData.DisplayText || '';
    res.json({ transcription: transcriptText });
  } catch (err) {
    console.error('Live-translate error:', err);
    res.status(500).json({ error: 'Live-translate failed.' });
  }
});

// === WebSocket Real-Time Streaming with Azure Speech SDK ===
let wsServer;

function startWebSocketServer(server) {
  wsServer = new WebSocket.Server({ server, path: '/ws' });
  console.log('WebSocket server attached to main HTTP server');

  wsServer.on('connection', (ws) => {
    console.log('🔗 New WS client connected');
    
    const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
    const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;
    
    console.log('🔍 Azure Speech credentials check:', {
      hasKey: !!AZURE_SPEECH_KEY,
      keyPrefix: AZURE_SPEECH_KEY ? AZURE_SPEECH_KEY.substring(0, 8) + '...' : 'missing',
      region: AZURE_SPEECH_REGION || 'missing'
    });
    
    if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
      console.error('❌ Azure Speech credentials missing!');
      const errorMsg = JSON.stringify({ type: 'error', error: 'Azure Speech credentials missing!' });
      console.log('📤 Sending credentials error to client:', errorMsg);
      ws.send(errorMsg);
      ws.close();
      return;
    }

    let recognizer, pushStream, speechConfig, audioConfig;
    let language = 'en-US'; // Default to English for better compatibility
    let targetLanguage = 'ar-SA';
    let clientSideTranslation = false;
    let realTimeMode = false;
    let initialized = false;
    
    // Supported languages for Azure Speech real-time streaming
    const supportedStreamingLanguages = [
      'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN',
      'ar-SA', 'ar-EG', 'ar-AE',
      'es-ES', 'es-MX', 'es-AR',
      'fr-FR', 'fr-CA',
      'de-DE', 'it-IT', 'pt-BR', 'pt-PT',
      'ru-RU', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW'
    ];

    ws.on('message', (data) => {
      try {
        console.log('📥 WebSocket received data:', {
          type: typeof data,
          size: data.length,
          isBuffer: data instanceof Buffer,
          initialized: initialized
        });
        
        // First, try to parse as JSON to handle control messages (ping, init, etc.)
        try {
          const msg = JSON.parse(data.toString());
          console.log('📥 Received JSON message:', msg.type);
          
          // Handle ping messages (always, regardless of initialization state)
          if (msg.type === 'ping') {
            console.log('🏓 Ping received, sending pong');
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }
          
          // Handle initialization messages (only if not initialized)
          if (!initialized && msg.type === 'init') {
            language = msg.language || 'en-US';
            targetLanguage = msg.targetLanguage || 'ar-SA';
            clientSideTranslation = msg.clientSideTranslation || false;
            realTimeMode = msg.realTimeMode || false;
            const autoDetection = msg.autoDetection || false;
            
            // Check if language is supported
            if (!supportedStreamingLanguages.includes(language)) {
              console.warn(`⚠️ Language ${language} might not be supported for streaming, falling back to en-US`);
              language = 'en-US';
            }
            
            console.log(`🌐 Initializing Azure Speech SDK with:
              - Source Language: ${language} ${autoDetection ? '(Auto Detection Mode)' : ''}
              - Target Language: ${targetLanguage}
              - Client-side Translation: ${clientSideTranslation}
              - Real-time Mode: ${realTimeMode}
              - Auto Detection: ${autoDetection}`);
            
            // Initialize Azure Speech SDK with simplified configuration
            try {
              // Create push stream with specific audio format
              const audioFormat = speechsdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1); // 16kHz, 16-bit, mono
              pushStream = speechsdk.AudioInputStream.createPushStream(audioFormat);
              audioConfig = speechsdk.AudioConfig.fromStreamInput(pushStream);
              
              speechConfig = speechsdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
              speechConfig.speechRecognitionLanguage = language;
              
              // Enable continuous recognition for better results
              speechConfig.enableDictation();
              
              // If auto detection is requested, try to enable auto language detection
              if (autoDetection) {
                console.log(`🔍 [${language}] Auto detection mode enabled - using ${language} as primary language`);
                // Note: Azure requires a specific language to start, but will adapt
              }
              
              recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
              
              // Set up event handlers with simplified logging
              recognizer.recognizing = (s, e) => {
                console.log(`🎤 [${language}] RECOGNIZING:`, {
                  text: e.result.text,
                  reason: e.result.reason,
                  resultId: e.result.resultId
                });
                
                if (e.result.text && e.result.text.trim()) {
                  console.log(`🎤 [${language}] Recognizing: "${e.result.text}"`);
                  ws.send(JSON.stringify({ 
                    type: 'transcription', 
                    text: e.result.text
                  }));
                }
              };
              
              recognizer.recognized = (s, e) => {
                console.log(`✅ [${language}] RECOGNIZED:`, {
                  text: e.result.text,
                  reason: e.result.reason,
                  reasonText: speechsdk.ResultReason[e.result.reason]
                });
                
                if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
                  if (e.result.text && e.result.text.trim()) {
                    console.log(`✅ [${language}] Final result: "${e.result.text}"`);
                    ws.send(JSON.stringify({ 
                      type: 'final', 
                      text: e.result.text
                    }));
                  } else {
                    console.log(`✅ [${language}] Recognized speech but no text content`);
                    ws.send(JSON.stringify({ 
                      type: 'final', 
                      text: '',
                      reason: 'EmptyRecognition'
                    }));
                  }
                } else if (e.result.reason === speechsdk.ResultReason.NoMatch) {
                  console.log(`⚪ [${language}] No speech could be recognized`);
                  const noMatchDetails = speechsdk.NoMatchDetails.fromResult(e.result);
                  console.log(`No match reason: ${noMatchDetails.reason}`);
                  ws.send(JSON.stringify({ 
                    type: 'final', 
                    text: '',
                    reason: 'NoMatch',
                    details: noMatchDetails.reason
                  }));
                } else {
                  console.log(`🔍 [${language}] Other recognition result: ${speechsdk.ResultReason[e.result.reason]}`);
                  ws.send(JSON.stringify({ 
                    type: 'final', 
                    text: e.result.text || '',
                    reason: speechsdk.ResultReason[e.result.reason]
                  }));
                }
              };
              
              recognizer.canceled = (s, e) => {
                console.error(`❌ [${language}] Recognition canceled:`, {
                  errorDetails: e.errorDetails,
                  reason: e.reason,
                  reasonText: speechsdk.CancellationReason[e.reason],
                  errorCode: e.errorCode
                });
                console.error(`Cancel reason: ${e.reason}`);
                
                // Send error to client
                ws.send(JSON.stringify({ 
                  type: 'error', 
                  error: `Recognition canceled: ${e.errorDetails}`,
                  reason: e.reason,
                  errorCode: e.errorCode
                }));
                
                // For quota exceeded, try to restart recognition instead of cleanup
                if (e.errorDetails && e.errorDetails.includes('Quota exceeded')) {
                  console.log(`🔄 [${language}] Quota exceeded, attempting to restart recognition...`);
                  
                  // Clean up old recognizer
                  if (recognizer) {
                    recognizer.close();
                    recognizer = null;
                  }
                  if (pushStream) {
                    pushStream.close();
                    pushStream = null;
                  }
                  
                  // Try to reinitialize after a delay
                  setTimeout(() => {
                    try {
                      // Recreate push stream
                      const audioFormat = speechsdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
                      pushStream = speechsdk.AudioInputStream.createPushStream(audioFormat);
                      audioConfig = speechsdk.AudioConfig.fromStreamInput(pushStream);
                      
                      // Recreate speech config
                      speechConfig = speechsdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
                      speechConfig.speechRecognitionLanguage = language;
                      speechConfig.enableDictation();
                      
                      // Recreate recognizer
                      recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
                      
                      // Set up event handlers (reuse the same handlers)
                      recognizer.recognizing = (s, e) => {
                        if (e.result.text && e.result.text.trim()) {
                          ws.send(JSON.stringify({ type: 'transcription', text: e.result.text }));
                        }
                      };
                      
                      recognizer.recognized = (s, e) => {
                        if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech && e.result.text && e.result.text.trim()) {
                          ws.send(JSON.stringify({ type: 'final', text: e.result.text }));
                        }
                      };
                      
                      // Start recognition
                      recognizer.startContinuousRecognitionAsync(
                        () => {
                          console.log(`✅ [${language}] Recognition restarted successfully after quota error`);
                          ws.send(JSON.stringify({ type: 'status', message: 'Recognition restarted after quota error' }));
                        },
                        (err) => {
                          console.error(`❌ [${language}] Failed to restart recognition:`, err);
                        }
                      );
                    } catch (error) {
                      console.error(`❌ [${language}] Error restarting recognition:`, error);
                    }
                  }, 3000); // Wait 3 seconds before retry
                } else {
                  // For other errors, do normal cleanup
                  if (recognizer) {
                    recognizer.close();
                    recognizer = null;
                  }
                  if (pushStream) {
                    pushStream.close();
                    pushStream = null;
                  }
                }
              };
              
              recognizer.sessionStarted = (s, e) => {
                console.log(`🚀 [${language}] Session started:`, {
                  sessionId: e.sessionId,
                  timestamp: new Date().toISOString()
                });
                ws.send(JSON.stringify({ type: 'status', message: 'Recognition session started' }));
              };
              
              recognizer.sessionStopped = (s, e) => {
                console.log(`🛑 [${language}] Session stopped:`, {
                  sessionId: e.sessionId,
                  timestamp: new Date().toISOString()
                });
                ws.send(JSON.stringify({ type: 'status', message: 'Recognition session stopped' }));
              };
              
              // Add speech start/end detection
              recognizer.speechStartDetected = (s, e) => {
                console.log(`🗣️ [${language}] Speech start detected:`, {
                  sessionId: e.sessionId,
                  offset: e.offset,
                  timestamp: new Date().toISOString()
                });
              };
              
              recognizer.speechEndDetected = (s, e) => {
                console.log(`🤐 [${language}] Speech end detected:`, {
                  sessionId: e.sessionId,
                  offset: e.offset,
                  timestamp: new Date().toISOString()
                });
              };
              
              // Start continuous recognition
              recognizer.startContinuousRecognitionAsync(
                () => {
                  console.log(`✅ [${language}] Continuous recognition started successfully`);
                  initialized = true;
                  ws.send(JSON.stringify({ type: 'status', message: 'Ready for audio input' }));
                  console.log(`📤 [${language}] Sent ready status to client`);
                },
                (err) => {
                  console.error(`❌ [${language}] Failed to start recognition:`, err);
                  ws.send(JSON.stringify({ type: 'error', error: `Failed to start recognition: ${err}` }));
                  console.log(`📤 [${language}] Sent error status to client:`, err);
                }
              );
              
            } catch (initError) {
              console.error('❌ Azure Speech SDK initialization error:', initError);
              ws.send(JSON.stringify({ type: 'error', error: `Initialization failed: ${initError.message}` }));
            }
            
            return;
          } else if (!initialized && msg.type === 'language_update') {
            // Handle language update
            console.log('🔄 Language update requested:', msg);
            if (msg.sourceLanguage && supportedStreamingLanguages.includes(msg.sourceLanguage)) {
              language = msg.sourceLanguage;
              targetLanguage = msg.targetLanguage || targetLanguage;
              
              // Restart recognition with new language
              if (recognizer) {
                recognizer.stopContinuousRecognitionAsync(() => {
                  speechConfig.speechRecognitionLanguage = language;
                  recognizer.startContinuousRecognitionAsync();
                  console.log(`🔄 Language updated to: ${language}`);
                  ws.send(JSON.stringify({ type: 'status', message: `Language updated to ${language}` }));
                });
              }
            }
            return;
          } else if (msg.type === 'audio') {
            // Handle audio data from new app
            console.log('🎵 Received audio data from new app');
            // Continue to audio processing below
          } else {
            // Unknown JSON message type
            console.log('📦 Received unknown JSON message type:', msg.type);
            return;
          }
        } catch (parseError) {
          // Not JSON, treat as audio data
          console.log('📦 Received non-JSON data, treating as audio');
        }
        
        // Handle audio data (support both raw PCM and JSON with base64)
        if (initialized && pushStream) {
          let audioBuffer;
          let audioSize;
          let audioFormat;
          
          if (data instanceof Buffer) {
            // Raw PCM data (from old app)
            audioBuffer = data;
            audioSize = data.length;
            audioFormat = 'audio/pcm';
            console.log(`🎵 [${language}] Received raw PCM audio chunk: ${audioSize} bytes`);
          } else {
            // JSON data with base64 (from new app)
            try {
              const jsonData = JSON.parse(data.toString());
              if (jsonData.type === 'audio' && jsonData.data) {
                // Convert base64 to buffer
                audioBuffer = Buffer.from(jsonData.data, 'base64');
                audioSize = audioBuffer.length;
                audioFormat = jsonData.format || 'audio/webm;codecs=opus';
                console.log(`🎵 [${language}] Received base64 audio chunk: ${audioSize} bytes, format: ${audioFormat}`);
              } else {
                console.log(`📦 Received JSON message:`, jsonData);
                return;
              }
            } catch (parseError) {
              console.log('📦 Received non-JSON data, treating as audio');
              audioBuffer = data;
              audioSize = data.length;
              audioFormat = 'audio/pcm';
            }
          }
          
          // Convert audio to PCM WAV 16kHz 16-bit mono using ffmpeg
          if (audioSize > 0 && audioSize < 1000000) { // Max 1MB per chunk
            try {
              console.log(`🔄 [${language}] Converting audio from ${audioFormat} to PCM WAV 16kHz...`);
              
              // Convert to PCM WAV using ffmpeg
              convertAudioFormat(audioBuffer, audioFormat, 'wav')
                .then(pcmBuffer => {
                  console.log(`✅ [${language}] Audio converted successfully: ${audioSize} bytes → ${pcmBuffer.length} bytes`);
                  
                  // Write converted PCM data to Azure Speech SDK
                  pushStream.write(pcmBuffer);
                  console.log(`✅ [${language}] PCM audio chunk written to Azure Speech SDK`);
                })
                .catch(conversionError => {
                  console.error(`❌ [${language}] Audio conversion failed:`, conversionError);
                  ws.send(JSON.stringify({ 
                    type: 'error', 
                    error: `Audio conversion failed: ${conversionError.message}` 
                  }));
                });
              
            } catch (conversionError) {
              console.error(`❌ [${language}] Audio conversion failed:`, conversionError);
              ws.send(JSON.stringify({ 
                type: 'error', 
                error: `Audio conversion failed: ${conversionError.message}` 
              }));
            }
          } else {
            console.warn(`⚠️ [${language}] Invalid audio chunk size: ${audioSize} bytes`);
            ws.send(JSON.stringify({ 
              type: 'error', 
              error: `Invalid audio chunk size: ${audioSize} bytes` 
            }));
          }
        } else if (!initialized) {
          console.warn(`⚠️ Received audio data before initialization. Data size: ${data instanceof Buffer ? data.length : 'not buffer'} bytes`);
        } else if (!pushStream) {
          console.warn(`⚠️ Push stream not available. Initialized: ${initialized}, Data: ${data instanceof Buffer ? data.length : 'not buffer'} bytes`);
        } else {
          console.warn(`⚠️ Unexpected audio data format. Type: ${typeof data}, Instance: ${data.constructor.name}`);
        }
        
      } catch (error) {
        console.error('❌ WebSocket message handling error:', error);
        ws.send(JSON.stringify({ type: 'error', error: `Message handling failed: ${error.message}` }));
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`🔒 [${language}] Client disconnected: ${code} - ${reason}`);
      
      // Clean up Azure Speech SDK resources
      if (recognizer) {
        recognizer.stopContinuousRecognitionAsync(() => {
          recognizer.close();
          console.log(`🧹 [${language}] Recognizer cleaned up`);
        });
      }
      if (pushStream) {
        pushStream.close();
        console.log(`🧹 [${language}] Push stream cleaned up`);
      }
      if (speechConfig) {
        speechConfig.close();
        console.log(`🧹 [${language}] Speech config cleaned up`);
      }
    });

    ws.on('error', (err) => {
      console.error(`❌ [${language}] WebSocket error:`, err.message);
      
      // Clean up on error
      if (recognizer) {
        recognizer.stopContinuousRecognitionAsync(() => {
          recognizer.close();
        });
      }
      if (pushStream) {
        pushStream.close();
      }
      if (speechConfig) {
        speechConfig.close();
      }
      
      ws.close();
    });
  });
}

const server = http.createServer(app);

// شغل WebSocket على نفس السيرفر
startWebSocketServer(server);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
