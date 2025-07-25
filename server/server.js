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

// Serve static files from the public directory
app.use(express.static('public'));

const upload = multer();

const ASSEMBLYAI_API_KEY = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY || process.env.ASSEMBLYAI_API_KEY;
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;

console.log('Server starting with API key:', ASSEMBLYAI_API_KEY ? 'Present' : 'Missing');
console.log('Environment variables:', {
  EXPO_PUBLIC_ASSEMBLYAI_API_KEY: process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY ? 'Present' : 'Missing',
  ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY ? 'Present' : 'Missing',
  AZURE_SPEECH_KEY: process.env.AZURE_SPEECH_KEY ? 'Present' : 'Missing',
  AZURE_SPEECH_REGION: process.env.AZURE_SPEECH_REGION ? 'Present' : 'Missing'
});

// Helper function to convert audio format using ffmpeg
async function convertAudioFormat(audioBuffer, inputFormat, outputFormat = 'wav') {
  try {
    // First try ffmpeg conversion
    try {
      // Create temporary files
      const inputFile = `/tmp/input_${Date.now()}.${inputFormat.split('/')[1] || 'mp3'}`;
      const outputFile = `/tmp/output_${Date.now()}.${outputFormat}`;
      
      // Write input buffer to file
      fs.writeFileSync(inputFile, audioBuffer);
      
      // Convert using ffmpeg
      const ffmpegCommand = `${ffmpegPath} -i "${inputFile}" -acodec pcm_s16le -ar 16000 -ac 1 "${outputFile}" -y`;
      await execAsync(ffmpegCommand);
      
      // Read converted file
      const convertedBuffer = fs.readFileSync(outputFile);
      
      // Clean up temporary files
      fs.unlinkSync(inputFile);
      fs.unlinkSync(outputFile);
      
      return convertedBuffer;
    } catch (ffmpegError) {
      console.log('FFmpeg conversion failed, trying fallback method:', ffmpegError.message);
      
      // Fallback: Create a simple WAV file from the original data
      // This is a basic approach that might work for some cases
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
      return wavBuffer;
    }
  } catch (error) {
    console.error('Audio conversion failed:', error);
    // Return original buffer if conversion fails
    return audioBuffer;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKey: ASSEMBLYAI_API_KEY ? 'Present' : 'Missing',
    timestamp: new Date().toISOString()
  });
});

// Serve delete account page directly
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
            deleteBtn.textContent = 'Deleting Account...';
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
                deleteBtn.textContent = 'Delete My Account';
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

app.post('/live-translate', async (req, res) => {
  try {
    const { audio, audioType } = req.body;
    if (!audio || !audioType) {
      return res.status(400).json({ error: 'Missing audio or audioType in request.' });
    }
    if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
      return res.status(500).json({ error: 'Azure Speech API key or region missing.' });
    }
    // Decode base64 audio
    const audioBuffer = Buffer.from(audio, 'base64');
    // Send to Azure Speech-to-Text
    const azureEndpoint = `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=auto`;
    const azureRes = await fetch(azureEndpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Type': audioType,
        'Accept': 'application/json',
        'Transfer-Encoding': 'chunked',
      },
      body: audioBuffer,
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

// دالة للتحقق من صحة اللغة
function validateAzureLanguage(language) {
  const supportedLanguages = [
    'ar-SA', 'en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ru-RU',
    'ja-JP', 'ko-KR', 'zh-CN', 'tr-TR', 'nl-NL', 'pl-PL', 'sv-SE', 'da-DK',
    'no-NO', 'fi-FI', 'cs-CZ', 'sk-SK', 'hu-HU', 'ro-RO', 'bg-BG', 'hr-HR',
    'sl-SI', 'et-EE', 'lv-LV', 'lt-LT', 'el-GR', 'he-IL', 'th-TH', 'vi-VN',
    'id-ID', 'ms-MY', 'fil-PH', 'hi-IN', 'bn-IN', 'ur-PK', 'fa-IR', 'uk-UA'
  ];
  
  if (!supportedLanguages.includes(language)) {
    console.log(`[Azure] ⚠️ Unsupported language: ${language}, defaulting to ar-SA`);
    return 'ar-SA';
  }
  return language;
}

function startWebSocketServer(server) {
  wsServer = new WebSocket.Server({ server, path: '/ws' });
  console.log('WebSocket server attached to main HTTP server');

  wsServer.on('connection', (ws) => {
    console.log('[WebSocket] 🔗 New client connected');
    
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
    
    // إعداد جلسة Azure Speech جديدة لكل عميل
    let pushStream = speechsdk.AudioInputStream.createPushStream(speechsdk.AudioStreamFormat.getWaveFormatPCM(48000, 16, 1));
    let audioConfig = speechsdk.AudioConfig.fromStreamInput(pushStream);
    let speechConfig = speechsdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
    speechConfig.speechRecognitionLanguage = 'ar-SA'; // Default language
    
    // تحسينات Azure لاستقبال chunks كبيرة
    speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "15000");
    speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "10000");
    speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceResponse_RequestDetailedResultTrueFalse, "true");
    
    let recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
    recognizer.recognizing = (s, e) => {
      console.log(`[Azure Speech] 🔄 Partial result: "${e.result.text}"`);
      if (e.result.text && e.result.text.trim()) {
        console.log(`[Azure Speech] 📤 Sending partial transcription: "${e.result.text}"`);
        ws.send(JSON.stringify({ type: 'transcription', text: e.result.text }));
      }
    };
    recognizer.recognized = (s, e) => {
      if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
        console.log(`[Azure Speech] ✅ Final result: "${e.result.text}"`);
        if (e.result.text && e.result.text.trim()) {
          console.log(`[Azure Speech] 📤 Sending final transcription: "${e.result.text}"`);
          ws.send(JSON.stringify({ type: 'final', text: e.result.text }));
        } else {
          console.log('Empty final result, not sending');
        }
      }
    };
    recognizer.canceled = (s, e) => {
      ws.send(JSON.stringify({ type: 'error', error: e.errorDetails }));
      recognizer.close();
    };
    recognizer.sessionStopped = (s, e) => {
      ws.send(JSON.stringify({ type: 'done' }));
      recognizer.close();
    };
    recognizer.startContinuousRecognitionAsync();
    ws.on('message', (data) => {
      try {
        // Check if it's a JSON message (init, language_update, etc.)
        if (typeof data === 'string') {
          const message = JSON.parse(data);
          console.log('Received JSON message:', message.type, message);
          
          if (message.type === 'init') {
            // تنظيف الجلسة السابقة قبل إعادة التهيئة
            try {
              recognizer.stopContinuousRecognitionAsync();
              recognizer.close();
              pushStream.close();
              console.log('[Azure] 🧹 Cleaned up previous session before reinitialization');
            } catch (error) {
              console.log('[Azure] ⚠️ No previous session to cleanup:', error.message);
            }
            
            // Update speech recognition language based on client request
            const rawLanguage = message.language || 'ar-SA';
            const language = validateAzureLanguage(rawLanguage);
            console.log('[Azure] 🔧 Initializing with language:', rawLanguage, '→', language);
            
            // إنشاء جلسة جديدة مع اللغة الصحيحة
            pushStream = speechsdk.AudioInputStream.createPushStream(speechsdk.AudioStreamFormat.getWaveFormatPCM(48000, 16, 1));
            audioConfig = speechsdk.AudioConfig.fromStreamInput(pushStream);
            speechConfig = speechsdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
            speechConfig.speechRecognitionLanguage = language;
            
            // تحسينات Azure لاستقبال chunks كبيرة
            speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "15000");
            speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "10000");
            speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceResponse_RequestDetailedResultTrueFalse, "true");
            
            recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
            
            // إعداد المستمعين الجدد
            recognizer.recognizing = (s, e) => {
              console.log(`[Azure Speech] 🔄 Partial result: "${e.result.text}"`);
              if (e.result.text && e.result.text.trim()) {
                console.log(`[Azure Speech] 📤 Sending partial transcription: "${e.result.text}"`);
                ws.send(JSON.stringify({ type: 'transcription', text: e.result.text }));
              }
            };
            
            recognizer.recognized = (s, e) => {
              if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
                console.log(`[Azure Speech] ✅ Final result: "${e.result.text}"`);
                if (e.result.text && e.result.text.trim()) {
                  console.log(`[Azure Speech] 📤 Sending final transcription: "${e.result.text}"`);
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
                console.log('[Azure Speech] ✅ Recognition started successfully with language:', language);
                ws.send(JSON.stringify({ type: 'status', message: 'Initialized with language: ' + language }));
              },
              (error) => {
                console.log('[Azure Speech] ❌ Failed to start recognition:', error);
                ws.send(JSON.stringify({ type: 'error', error: 'Failed to start recognition: ' + error }));
              }
            );
          } else if (message.type === 'language_update') {
            // تنظيف الجلسة الحالية قبل تحديث اللغة
            try {
              recognizer.stopContinuousRecognitionAsync();
              recognizer.close();
              pushStream.close();
              console.log('[Azure] 🔄 Cleaned up session before language update');
            } catch (error) {
              console.log('[Azure] ⚠️ No session to cleanup for language update:', error.message);
            }
            
            // Update language during session
            const rawLanguage = message.sourceLanguage || 'ar-SA';
            const language = validateAzureLanguage(rawLanguage);
            console.log('[Azure] 🔧 Updating language from:', rawLanguage, '→', language);
            
            // إنشاء جلسة جديدة مع اللغة المحدثة
            pushStream = speechsdk.AudioInputStream.createPushStream(speechsdk.AudioStreamFormat.getWaveFormatPCM(48000, 16, 1));
            audioConfig = speechsdk.AudioConfig.fromStreamInput(pushStream);
            speechConfig = speechsdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
            speechConfig.speechRecognitionLanguage = language;
            
            // تحسينات Azure لاستقبال chunks كبيرة
            speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "15000");
            speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "10000");
            speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceResponse_RequestDetailedResultTrueFalse, "true");
            
            recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
            
            // إعداد المستمعين الجدد
            recognizer.recognizing = (s, e) => {
              console.log(`[Azure Speech] 🔄 Partial result: "${e.result.text}"`);
              if (e.result.text && e.result.text.trim()) {
                console.log(`[Azure Speech] 📤 Sending partial transcription: "${e.result.text}"`);
                ws.send(JSON.stringify({ type: 'transcription', text: e.result.text }));
              }
            };
            
            recognizer.recognized = (s, e) => {
              if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
                console.log(`[Azure Speech] ✅ Final result: "${e.result.text}"`);
                if (e.result.text && e.result.text.trim()) {
                  console.log(`[Azure Speech] 📤 Sending final transcription: "${e.result.text}"`);
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
                console.log('[Azure Speech] ✅ Language updated successfully to:', language);
                ws.send(JSON.stringify({ type: 'status', message: 'Language updated to: ' + language }));
              },
              (error) => {
                console.log('[Azure Speech] ❌ Failed to update language:', error);
                ws.send(JSON.stringify({ type: 'error', error: 'Failed to update language: ' + error }));
              }
            );
          } else if (message.type === 'audio') {
            // Handle audio data
            const audioData = message.data;
            if (audioData) {
              const audioBuffer = Buffer.from(audioData, 'base64');
              console.log('Received audio chunk from client. Size:', audioBuffer.length, 'SourceLang:', message.sourceLanguage, 'TargetLang:', message.targetLanguage);
              
              // التحقق من أن البيانات ليست فارغة أو قديمة جداً
              if (audioBuffer.length > 0) {
                pushStream.write(audioBuffer);
              } else {
                console.log('Skipping empty audio buffer');
              }
            }
          }
        } else {
          // Handle raw audio data (fallback)
          console.log('Received raw audio chunk from client. Size:', data.length || data.byteLength);
          
          // التحقق من أن البيانات ليست فارغة
          if (data && (data.length > 0 || data.byteLength > 0)) {
            if (data instanceof Buffer) {
              pushStream.write(data);
            } else if (data instanceof ArrayBuffer) {
              pushStream.write(Buffer.from(data));
            } else {
              pushStream.write(Buffer.from(data));
            }
          } else {
            console.log('Skipping empty raw audio data');
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        // Fallback to raw audio processing
        if (data && (data.length > 0 || data.byteLength > 0)) {
          const dataSize = data.length || data.byteLength || 0;
          console.log(`[Azure Speech] 📥 Receiving audio chunk: ${dataSize} bytes (${dataSize > 100000 ? 'LARGE' : 'normal'} chunk)`);
          
          if (data instanceof Buffer) {
            pushStream.write(data);
          } else if (data instanceof ArrayBuffer) {
            pushStream.write(Buffer.from(data));
          } else {
            pushStream.write(Buffer.from(data));
          }
        } else {
          console.log('[Azure Speech] ⚠️ Skipping empty data in fallback processing');
        }
      }
    });
    ws.on('close', () => {
      console.log('WS client disconnected');
      
      // تنظيف شامل للجلسة
      try {
        pushStream.close();
        recognizer.stopContinuousRecognitionAsync();
        recognizer.close();
        console.log('[WebSocket] 🧹 Session cleaned up completely');
      } catch (error) {
        console.error('[WebSocket] ❌ Error during session cleanup:', error);
      }
    });
    
    } catch (error) {
      console.error('[WebSocket] 💥 Fatal error in WebSocket handler:', error);
      try {
        ws.send(JSON.stringify({ type: 'error', error: 'Server error: ' + error.message }));
        ws.close();
      } catch (sendError) {
        console.error('[WebSocket] ❌ Failed to send error message:', sendError);
      }
    }
  });
}

const server = http.createServer(app);

// شغل WebSocket على نفس السيرفر
startWebSocketServer(server);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
