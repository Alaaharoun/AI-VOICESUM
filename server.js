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
const AZURE_SPEECH_ENDPOINT = 'https://westeurope.api.cognitive.microsoft.com/';

console.log('Server starting with Azure Speech API configuration:');
console.log('- Key:', AZURE_SPEECH_KEY ? 'Present' : 'Missing');
console.log('- Region:', AZURE_SPEECH_REGION || 'Not set');
console.log('- Endpoint:', AZURE_SPEECH_ENDPOINT);

// Helper function to convert MIME type to file extension
function mimeToExtension(mimeType) {
  if (mimeType.includes('webm')) return '.webm';
  if (mimeType.includes('ogg')) return '.ogg';
  if (mimeType.includes('mp3')) return '.mp3';
  if (mimeType.includes('wav')) return '.wav';
  if (mimeType.includes('m4a')) return '.m4a';
  if (mimeType.includes('pcm')) return '.raw';
  if (mimeType.includes('audio/pcm')) return '.raw';
  return '.bin'; // fallback
}

// Helper function to validate WebM file before FFmpeg processing
async function validateWebMFile(filePath) {
  try {
    console.log('🔍 Validating WebM file with ffprobe...');
    
    // Use ffprobe to check file validity
    const ffprobeCommand = `${ffmpegPath.replace('ffmpeg', 'ffprobe')} -v quiet -print_format json -show_format -show_streams "${filePath}"`;
    
    const result = await execAsync(ffprobeCommand);
    const probeData = JSON.parse(result.stdout);
    
    if (!probeData.format || !probeData.streams || probeData.streams.length === 0) {
      return { isValid: false, reason: 'No valid streams found' };
    }
    
    // Check for audio stream
    const audioStream = probeData.streams.find(stream => stream.codec_type === 'audio');
    if (!audioStream) {
      return { isValid: false, reason: 'No audio stream found' };
    }
    
    console.log('✅ WebM file validation passed:', {
      duration: probeData.format.duration,
      codec: audioStream.codec_name,
      sampleRate: audioStream.sample_rate
      });

    return { isValid: true, probeData };

  } catch (error) {
    console.error('❌ ffprobe validation failed:', error.message);
    return { isValid: false, reason: `ffprobe failed: ${error.message}` };
  }
}

// ✅ Enhanced WebM validation function
function isValidWebMHeader(buffer) {
  try {
    if (buffer.length < 4) {
      return false;
    }
    
    // EBML magic number: 0x1A, 0x45, 0xDF, 0xA3
    const headerHex = buffer.slice(0, 4).toString('hex').toLowerCase();
    const isValidEBML = headerHex === '1a45dfa3';
    
    if (isValidEBML) {
      console.log('✅ Valid EBML header detected:', headerHex);
    } else {
      console.warn('❌ Invalid EBML header:', headerHex, 'expected: 1a45dfa3');
    }
    
    return isValidEBML;
  } catch (error) {
    console.error('❌ EBML header validation error:', error.message);
    return false;
  }
}

// Helper function to validate EBML header for WebM
function validateEBMLHeader(buffer) {
  try {
    if (buffer.length < 4) {
      return { isValid: false, reason: 'Buffer too small for EBML header' };
    }
    
    const hasValidHeader = isValidWebMHeader(buffer);
    
    if (!hasValidHeader) {
      const headerHex = buffer.slice(0, 4).toString('hex');
      return { isValid: false, reason: `Invalid EBML header signature: ${headerHex} (expected: 1a45dfa3)` };
    }
    
    console.log('✅ Valid EBML header detected');
    return { isValid: true };
    
  } catch (error) {
    return { isValid: false, reason: `EBML validation error: ${error.message}` };
  }
}

async function convertAudioFormat(audioBuffer, inputFormat, outputFormat = 'wav') {
  try {
    console.log(`🔄 Converting audio from ${inputFormat} to PCM WAV 16kHz...`);
    
    // ✅ Enhanced validation for WebM/Opus files
    if (inputFormat.includes('webm') || inputFormat.includes('opus')) {
      console.log('🔍 Enhanced WebM validation starting...');
      
      // 1. Size validation - increased minimum size
      if (audioBuffer.length < 1024) { // 1KB minimum instead of 500 bytes
        console.warn(`⚠️ WebM chunk too small: ${audioBuffer.length} bytes (minimum 1KB required)`);
        throw new Error(`WebM chunk too small: ${audioBuffer.length} bytes - likely corrupted`);
      }
      
      // 2. EBML header validation
      const ebmlValidation = validateEBMLHeader(audioBuffer);
      if (!ebmlValidation.isValid) {
        console.warn(`⚠️ EBML header validation failed: ${ebmlValidation.reason}`);
        
        // If the chunk is reasonably large but missing header, it might be a middle chunk
        if (audioBuffer.length >= 5120) { // 5KB - probably a middle chunk
          console.log('📦 Large chunk without header detected - treating as middle chunk');
          // Continue processing for middle chunks
        } else {
          throw new Error(`Invalid EBML header: ${ebmlValidation.reason}`);
        }
      }
    }
    
    // First try ffmpeg conversion
    try {
      // Create temporary files with proper extensions
      const inputExtension = mimeToExtension(inputFormat);
      const inputFile = `/tmp/input_${Date.now()}${inputExtension}`;
      const outputFile = `/tmp/output_${Date.now()}.wav`;
      
      // Write input buffer to file
      fs.writeFileSync(inputFile, audioBuffer);
      
      // ✅ Enhanced validation for WebM files before FFmpeg
      if (inputFormat.includes('webm') || inputFormat.includes('opus')) {
        const validation = await validateWebMFile(inputFile);
        if (!validation.isValid) {
          console.error(`❌ WebM file validation failed: ${validation.reason}`);
          
          // Clean up the invalid file
          try {
            fs.unlinkSync(inputFile);
          } catch (cleanupError) {
            console.warn('⚠️ Could not clean up invalid input file:', cleanupError.message);
          }
          
          throw new Error(`Corrupted WebM file: ${validation.reason}`);
        }
      }
      
      // Build ffmpeg command based on input format
      let ffmpegCommand;
      
      if (inputFormat === 'audio/pcm' || inputFormat.includes('pcm')) {
        // For raw PCM data, specify format explicitly
        ffmpegCommand = `${ffmpegPath} -f s16le -ar 16000 -ac 1 -i "${inputFile}" -acodec pcm_s16le -ar 16000 -ac 1 "${outputFile}" -y`;
        console.log(`🔧 FFmpeg command (PCM raw): ${ffmpegCommand}`);
      } else {
        // ✅ Enhanced FFmpeg command with error tolerance for WebM
        ffmpegCommand = `${ffmpegPath} -err_detect ignore_err -i "${inputFile}" -acodec pcm_s16le -ar 16000 -ac 1 "${outputFile}" -y`;
        console.log(`🔧 FFmpeg command (error-tolerant): ${ffmpegCommand}`);
      }
      
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
      
      // ✅ Enhanced error handling for WebM corruption
      if (inputFormat.includes('webm') || inputFormat.includes('opus')) {
        console.warn('⚠️ WebM/Opus conversion failed - likely corrupted chunk');
        console.warn('📊 FFmpeg error details:', ffmpegError.message);
        
        // Check for specific corruption indicators
        if (ffmpegError.message.includes('EBML header parsing failed') || 
            ffmpegError.message.includes('Invalid data found') ||
            ffmpegError.message.includes('moov atom not found') ||
            ffmpegError.message.includes('truncated data')) {
          console.error('❌ WebM file is corrupted, cannot process');
          throw new Error('Corrupted WebM file - EBML header invalid or truncated data');
        }
        
        // For other WebM errors, provide more context
        throw new Error(`WebM processing failed: ${ffmpegError.message}`);
      }
      
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

// Helper function to analyze audio quality
function analyzeAudioQuality(audioBuffer, audioFormat) {
  console.log(`🔍 analyzeAudioQuality called with format: ${audioFormat}, buffer size: ${audioBuffer.length}`);
  
  // For WebM/Opus, we can't analyze raw buffer directly
  // We need to convert it first or skip analysis
  if (audioFormat && (audioFormat.includes('webm') || audioFormat.includes('opus'))) {
    console.log(`🔍 Audio format is ${audioFormat}, skipping raw analysis (will analyze after conversion)`);
    return {
      hasSpeech: true, // Assume speech for now, will be checked after conversion
      duration: 0,
      averageAmplitude: 0,
      dynamicRange: 0,
      zeroCrossingRate: 0,
      skipAnalysis: true
    };
  }
  
  // For PCM data, we can analyze directly
  const samples = new Int16Array(audioBuffer);
  const sampleCount = samples.length;
  
  // Calculate RMS (Root Mean Square) for volume
  let sum = 0;
  let maxAmplitude = 0;
  let zeroCrossings = 0;
  
  for (let i = 0; i < sampleCount; i++) {
    const sample = samples[i];
    sum += sample * sample;
    maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));
    
    // Count zero crossings (indicates speech activity)
    if (i > 0 && ((samples[i] >= 0 && samples[i-1] < 0) || (samples[i] < 0 && samples[i-1] >= 0))) {
      zeroCrossings++;
    }
  }
  
  const rms = Math.sqrt(sum / sampleCount);
  const averageAmplitude = rms;
  const dynamicRange = maxAmplitude;
  const zeroCrossingRate = zeroCrossings / sampleCount;
  
  // Speech typically has (very lenient criteria for real-world audio):
  // - RMS > 10 (very low threshold for quiet speech)
  // - Dynamic range > 10 (very low threshold for compressed audio)
  // - Zero crossing rate > 0.0001 (very low threshold for speech activity)
  // - Duration > 0.2 seconds (minimum speech duration)
  
  // Ultra-lenient criteria for PCM data to match real-world microphone levels
  const hasSpeech = averageAmplitude > 10 && dynamicRange > 10 && zeroCrossingRate > 0.0001 && (sampleCount / 16000) > 0.2;
  
  console.log(`🔍 Audio Analysis (PCM):
    - Duration: ${(sampleCount / 16000).toFixed(2)} seconds
    - Average Amplitude: ${averageAmplitude.toFixed(0)}
    - Dynamic Range: ${dynamicRange.toFixed(0)}
    - Zero Crossing Rate: ${(zeroCrossingRate * 100).toFixed(1)}%
    - Has Speech: ${hasSpeech ? 'YES' : 'NO'}`);
  
  return {
    hasSpeech,
    duration: sampleCount / 16000,
    averageAmplitude,
    dynamicRange,
    zeroCrossingRate,
    skipAnalysis: false
  };
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
  'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'audio/m4a', 'audio/x-m4a', 'audio/ogg', 'audio/webm', 'audio/flac', 'audio/mp4', 'audio/pcm'
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

    let recognizer, pushStream, speechConfig, audioConfig, pcmStreamHandler;
    let language = 'en-US'; // Default to English for better compatibility
    let initialized = false;
    let pendingAudioChunks = []; // Store audio chunks until initialization is complete
    
    // ✅ Azure Speech Service supported languages for auto-detection (ChatGPT recommendation)
    const AZURE_AUTO_DETECT_LANGUAGES = [
      "en-US", "en-GB", "en-AU", "en-CA", "en-IN",
      "ar-SA", "ar-EG", "ar-MA", "ar-AE", "ar-DZ", "ar-TN", "ar-JO", "ar-LB", "ar-KW", "ar-QA", "ar-BH", "ar-OM", "ar-YE", "ar-SY", "ar-IQ", "ar-LY", "ar-PS",
      "fr-FR", "fr-CA", "fr-BE", "fr-CH",
      "es-ES", "es-MX", "es-AR", "es-CO", "es-PE", "es-VE", "es-EC", "es-GT", "es-CR", "es-PA", "es-CU", "es-BO", "es-DO", "es-HN", "es-PY", "es-SV", "es-NI", "es-PR", "es-UY", "es-CL",
      "de-DE", "de-AT", "de-CH",
      "it-IT", "it-CH",
      "pt-BR", "pt-PT",
      "ru-RU",
      "zh-CN", "zh-TW", "zh-HK",
      "ja-JP",
      "ko-KR",
      "hi-IN", "bn-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "gu-IN", "mr-IN", "pa-IN",
      "tr-TR",
      "nl-NL", "nl-BE",
      "sv-SE", "da-DK", "nb-NO", "fi-FI",
      "pl-PL", "cs-CZ", "hu-HU", "ro-RO", "bg-BG", "hr-HR", "sk-SK", "sl-SI", "et-EE", "lv-LV", "lt-LT", "uk-UA",
      "el-GR", "mt-MT", "is-IS", "ga-IE", "cy-GB",
      "he-IL", "fa-IR", "ur-PK",
      "th-TH", "vi-VN", "id-ID", "ms-MY", "fil-PH",
      "sw-KE", "am-ET", "zu-ZA", "af-ZA",
      "ka-GE", "hy-AM", "az-AZ", "kk-KZ", "ky-KG", "uz-UZ", "mn-MN", "my-MM", "km-KH", "lo-LA", "si-LK"
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
            try {
              const sourceLanguage = msg.language || msg.sourceLanguage || 'en-US';
              const autoDetection = sourceLanguage === 'auto' || msg.autoDetection || false;
              const realTime = msg.realTime || true;
              
              console.log('🔧 Initialization parameters:', { sourceLanguage, autoDetection, realTime });
              
              // ✅ Apply ChatGPT's instructions for auto-detection vs manual language
              if (autoDetection) {
                console.log('🧠 Auto Language Detection Enabled');
                console.log('🌍 Auto-detecting from', AZURE_AUTO_DETECT_LANGUAGES.length, 'supported languages');
                language = null; // Auto-detect mode
              } else {
                // Check if language is supported
                if (!AZURE_AUTO_DETECT_LANGUAGES.includes(sourceLanguage)) {
                  console.warn(`⚠️ Language ${sourceLanguage} might not be supported, falling back to en-US`);
                  language = 'en-US';
                } else {
                  language = sourceLanguage;
                }
                console.log(`🎯 Source Language set to: ${language}`);
              }
              
              console.log(`🌐 Initializing Azure Speech SDK with:
                - Source Language: ${language || 'AUTO-DETECT'}
                - Auto Detection: ${autoDetection}
                - Real-time Mode: ${realTime}`);
              
              // ✅ Initialize Azure Speech SDK following ChatGPT's instructions
              // Create push stream with specific audio format for Raw PCM
              console.log('🔧 Creating Azure Speech audio configuration...');
              const audioFormat = speechsdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1); // 16kHz, 16-bit, mono
              pushStream = speechsdk.AudioInputStream.createPushStream(audioFormat);
              
              // ✅ Enhanced audio config creation with error handling
              try {
                audioConfig = speechsdk.AudioConfig.fromStreamInput(pushStream);
                console.log('✅ AudioConfig created successfully');
              } catch (audioConfigError) {
                console.error('❌ AudioConfig creation failed:', audioConfigError);
                throw new Error(`Failed to create AudioConfig: ${audioConfigError.message}`);
              }
              
              // Create Azure Speech Config
              speechConfig = speechsdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
              
              // Set custom endpoint for West Europe if available
              if (AZURE_SPEECH_ENDPOINT) {
                speechConfig.endpointId = AZURE_SPEECH_ENDPOINT;
              }
              
              // Enable continuous recognition for better results
              speechConfig.enableDictation();
              
              // ✅ Apply ChatGPT's AutoDetectSourceLanguageConfig vs manual language selection
              if (autoDetection) {
                console.log('🔧 Creating recognizer with AutoDetectSourceLanguageConfig...');
                
                try {
                  // ✅ Use AutoDetectSourceLanguageConfig.fromLanguages() as recommended by ChatGPT
                  const autoDetectSourceLanguageConfig = speechsdk.AutoDetectSourceLanguageConfig.fromLanguages(AZURE_AUTO_DETECT_LANGUAGES);
                  console.log('✅ AutoDetectSourceLanguageConfig created for', AZURE_AUTO_DETECT_LANGUAGES.length, 'languages');
                  
                  // ✅ Create recognizer with proper error handling
                  recognizer = new speechsdk.SpeechRecognizer(speechConfig, autoDetectSourceLanguageConfig, audioConfig);
                  console.log('✅ Recognizer created with AutoDetectSourceLanguageConfig successfully');
                  
                } catch (recognizerError) {
                  console.error('❌ Failed to create AutoDetect recognizer:', recognizerError);
                  throw new Error(`AutoDetect recognizer creation failed: ${recognizerError.message}`);
                }
                
              } else {
                console.log('🔧 Creating recognizer with specific language:', language);
                
                try {
                  // ✅ Use normal SpeechRecognizer without auto-detect for specific language
                  speechConfig.speechRecognitionLanguage = language;
                  recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
                  console.log('✅ Recognizer created with specific language:', language);
                  
                } catch (recognizerError) {
                  console.error('❌ Failed to create specific language recognizer:', recognizerError);
                  throw new Error(`Specific language recognizer creation failed: ${recognizerError.message}`);
                }
              }

              // ✅ Create PCM stream handler for continuous audio processing
              try {
                pcmStreamHandler = handleContinuousPCMStream(ws, language, pushStream);
                console.log(`🔧 [${language}] PCM stream handler created for continuous audio processing`);
              } catch (pcmHandlerError) {
                console.error('❌ Failed to create PCM stream handler:', pcmHandlerError);
                pcmStreamHandler = null; // Ensure it's null if creation fails
              }
              
              // ✅ Enhanced event handlers with proper language detection support
              recognizer.recognizing = (s, e) => {
                // ✅ Extract detected language following ChatGPT's recommendation
                let detectedLanguage = null;
                if (autoDetection && e.result.properties) {
                  detectedLanguage = e.result.properties.getProperty(speechsdk.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguageResult);
                }
                const displayLanguage = detectedLanguage || language || 'auto';
                
                console.log(`🎤 [${displayLanguage}] RECOGNIZING:`, {
                  text: e.result.text,
                  reason: e.result.reason,
                  resultId: e.result.resultId,
                  detectedLanguage: detectedLanguage,
                  autoDetection: autoDetection
                });
                
                if (e.result.text && e.result.text.trim()) {
                  const logMsg = autoDetection 
                    ? `🎤 [AUTO→${detectedLanguage || 'detecting...'}] Recognizing: "${e.result.text}"`
                    : `🎤 [${language}] Recognizing: "${e.result.text}"`;
                  console.log(logMsg);
                  
                  ws.send(JSON.stringify({ 
                    type: 'transcription', 
                    text: e.result.text,
                    isPartial: true,
                    detectedLanguage: detectedLanguage
                  }));
                }
              };
              
              recognizer.recognized = (s, e) => {
                // ✅ Extract detected language for final result
                let detectedLanguage = null;
                if (autoDetection && e.result.properties) {
                  detectedLanguage = e.result.properties.getProperty(speechsdk.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguageResult);
                }
                const displayLanguage = detectedLanguage || language || 'auto';
                
                console.log(`✅ [${displayLanguage}] RECOGNIZED:`, {
                  text: e.result.text,
                  reason: e.result.reason,
                  reasonText: speechsdk.ResultReason[e.result.reason],
                  detectedLanguage: detectedLanguage,
                  autoDetection: autoDetection
                });
                
                if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
                  if (e.result.text && e.result.text.trim()) {
                    const logMsg = autoDetection 
                      ? `✅ [AUTO→${detectedLanguage}] Final result: "${e.result.text}"`
                      : `✅ [${language}] Final result: "${e.result.text}"`;
                    console.log(logMsg);
                    
                    ws.send(JSON.stringify({ 
                      type: 'final', 
                      text: e.result.text,
                      isPartial: false,
                      detectedLanguage: detectedLanguage
                    }));
                  } else {
                    console.log(`✅ [${displayLanguage}] Recognized speech but no text content`);
                    ws.send(JSON.stringify({ 
                      type: 'final', 
                      text: '',
                      reason: 'EmptyRecognition',
                      detectedLanguage: detectedLanguage
                    }));
                  }
                } else if (e.result.reason === speechsdk.ResultReason.NoMatch) {
                  console.log(`⚪ [${displayLanguage}] No speech could be recognized`);
                  const noMatchDetails = speechsdk.NoMatchDetails.fromResult(e.result);
                  console.log(`No match reason: ${noMatchDetails.reason}`);
                  ws.send(JSON.stringify({ 
                    type: 'final', 
                    text: '',
                    reason: 'NoMatch',
                    details: noMatchDetails.reason,
                    detectedLanguage: detectedLanguage
                  }));
                } else {
                  console.log(` [${displayLanguage}] Other recognition result: ${speechsdk.ResultReason[e.result.reason]}`);
                  ws.send(JSON.stringify({ 
                    type: 'final', 
                    text: e.result.text || '',
                    reason: speechsdk.ResultReason[e.result.reason],
                    detectedLanguage: detectedLanguage
                  }));
                }
              };
              
              recognizer.canceled = (s, e) => {
                const displayLanguage = autoDetection ? 'AUTO-DETECT' : language;
                console.error(`❌ [${displayLanguage}] Recognition canceled:`, {
                  errorDetails: e.errorDetails,
                  reason: e.reason,
                  reasonText: speechsdk.CancellationReason[e.reason],
                  errorCode: e.errorCode,
                  autoDetection: autoDetection
                });
                console.error(`Cancel reason: ${e.reason}`);
                
                // Send error to client
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
                  console.log(`✅ [${language}] Continuous recognition started successfully`);
                  ws.send(JSON.stringify({ type: 'init_ack', message: 'Initialization successful' }));
                  ws.send(JSON.stringify({ type: 'status', message: 'Ready for audio input' }));
                  console.log(`📤 [${language}] Sent ready status to client`);
                  
                  // Process any pending audio chunks
                  if (pendingAudioChunks.length > 0) {
                    console.log(`🎵 [${language}] Processing ${pendingAudioChunks.length} stored audio chunks...`);
                    pendingAudioChunks.forEach((chunk, index) => {
                      console.log(`🎵 [${language}] Processing stored audio data: ${chunk.length} bytes, format: audio/pcm`);
                      
                      // Parse the stored chunk
                      let jsonData = null;
                      try {
                        jsonData = JSON.parse(chunk.toString());
                      } catch (parseError) {
                        // Not JSON, treat as raw PCM data
                        const audioBuffer = chunk;
                        const audioSize = chunk.length;
                        console.log(`✅ [${language}] Using stored PCM data directly: ${audioSize} bytes`);
                        
                        // Skip audio quality analysis for new app (client handles it)
                        console.log(`✅ [${language}] Skipping server-side audio quality analysis (client handles it)`);
                        
                        // More lenient criteria for PCM with longer chunks (~1 second optimal)
                        if (audioSize >= 16000) { // At least 1 second of audio (optimal)
                          console.log(`✅ [${language}] PCM chunk duration optimal (${(audioSize / 32000).toFixed(2)}s)`);
                          
                          // Write PCM data directly to Azure Speech SDK if available
                          if (pushStream) {
                            pushStream.write(audioBuffer);
                            console.log(`✅ [${language}] Stored PCM audio chunk written to Azure Speech SDK`);
                          } else {
                            console.log(`⚠️ [${language}] Push stream not available yet, skipping audio processing`);
                          }
                        }
                      }
                    });
                    pendingAudioChunks = []; // Clear the pending chunks
                  }
                  
                  // Also send a separate ready message to ensure client receives it
                  setTimeout(() => {
                    ws.send(JSON.stringify({ type: 'ready', message: 'Ready for audio input' }));
                    console.log(`📤 [${language}] Sent additional ready message`);
                  }, 50); // Reduced timeout for faster response
                },
                (err) => {
                  console.error(`❌ [${language}] Failed to start recognition:`, err);
                  ws.send(JSON.stringify({ type: 'error', error: `Failed to start recognition: ${err}` }));
                  console.log(`📤 [${language}] Sent error status to client:`, err);
                }
              );
              
              // Set initialized to true after successful initialization
              initialized = true;
              ws.send(JSON.stringify({ type: 'init_ack', message: 'Initialization successful' }));
              ws.send(JSON.stringify({ type: 'status', message: 'Ready for audio input' }));
              return;
            } catch (initError) {
              console.error('❌ Initialization failed:', initError);
              ws.send(JSON.stringify({ type: 'error', error: `Initialization failed: ${initError.message}` }));
              return;
            }
          }
          
          // Handle ping messages
          if (msg && msg.type === 'ping') {
            console.log('🏓 Ping received, sending pong');
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }
          
          // Handle language updates
          if (!initialized && msg.type === 'language_update') {
            // Handle language update
            console.log('🔄 Language update requested:', msg);
            if (msg.sourceLanguage && AZURE_AUTO_DETECT_LANGUAGES.includes(msg.sourceLanguage)) {
              language = msg.sourceLanguage;
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
          }
          
          // Handle audio data from new app
          if (msg.type === 'audio') {
            console.log('🎵 Received audio data from new app');
            
            // If not initialized yet, store the audio chunk for later processing
            if (!initialized) {
              console.log('⚠️ Received audio data before initialization. Data size:', data.length, 'bytes');
              console.log('📦 [en-US] Storing audio data for later processing...');
              pendingAudioChunks.push(data);
              return;
            }
            
            // Continue to audio processing below
          }
          
          if (msg.type !== 'ping' && msg.type !== 'language_update' && msg.type !== 'audio') {
            // Unknown JSON message type
            console.log('📦 Received unknown JSON message type:', msg.type);
            return;
          }
        } catch (jsonParseError) {
          // Handle JSON parse error gracefully
          console.warn('⚠️ Failed to parse JSON message:', jsonParseError.message);
          // Optionally, continue to process as raw audio or ignore
        }
        
        // Process audio data if not handled by JSON messages
        try {
          // Enhanced audio handling with continuous streaming support
          if (initialized && pushStream && pcmStreamHandler) {
            let audioBuffer;
            let audioSize;
            let audioFormat;
            
            // Always try to parse as JSON first (new app format)
            let jsonData = null;
            try {
              jsonData = JSON.parse(data.toString());
            } catch (parseError) {
              // Not JSON, treat as raw PCM data (streaming format)
              audioBuffer = data;
              audioSize = data.length;
              audioFormat = 'audio/pcm';
              console.log(`🎵 [${language}] Received streaming PCM data: ${audioSize} bytes`);
              
              // Process with continuous streaming handler
              try {
                pcmStreamHandler.processStreamingPCM(audioBuffer);
                return; // Handle streaming data immediately
              } catch (pcmProcessError) {
                console.error('❌ Error processing PCM stream:', pcmProcessError);
                ws.send(JSON.stringify({ 
                  type: 'error', 
                  error: `PCM processing failed: ${pcmProcessError.message}`,
                  details: { phase: 'pcm_processing', errorType: pcmProcessError.name }
                }));
                return;
              }
            }
            
            if (jsonData) {
              // JSON data with base64 (from new app)
              if (jsonData.type === 'audio' && jsonData.data) {
                // Convert base64 to buffer
                audioBuffer = Buffer.from(jsonData.data, 'base64');
                audioSize = audioBuffer.length;
                // Use the actual format from the client
                audioFormat = jsonData.format || 'audio/webm;codecs=opus';
                console.log(`🎵 [${language}] Received base64 audio chunk: ${audioSize} bytes, format: ${audioFormat}`);
              } else {
                console.log(`📦 Received JSON message:`, jsonData);
                return;
              }
            }
            
            // Convert audio to PCM WAV 16kHz 16-bit mono using ffmpeg
            if (audioSize > 0 && audioSize < 1000000) { // Max 1MB per chunk
              try {
                console.log(`🔄 [${language}] Processing audio format: ${audioFormat}`);
                
                // Strict WebM validation - reject files < 10KB without valid EBML header
                if (audioFormat.includes('webm') || audioFormat.includes('opus')) {
                  console.log(`🔍 [${language}] Validating WebM chunk: ${audioSize} bytes`);
                  
                  // 1. Strict size validation - minimum 10KB for WebM files
                  if (audioSize < 10240) { // 10KB minimum
                    console.warn(`⚠️ [${language}] WebM chunk too small (${audioSize} bytes), minimum 10KB required`);
                    ws.send(JSON.stringify({ 
                      type: 'warning', 
                      message: 'WebM audio chunk too small. Please speak for at least 2-3 seconds.',
                      audioStats: { size: audioSize, format: audioFormat, reason: 'webm_chunk_too_small', minimumRequired: '10KB' }
                    }));
                    return; // Skip processing small WebM chunks
                  }
                  
                  // 2. Mandatory EBML header validation for WebM
                  if (!isValidWebMHeader(audioBuffer)) {
                    console.error(`❌ [${language}] WebM chunk lacks valid EBML header (${audioSize} bytes)`);
                    ws.send(JSON.stringify({ 
                      type: 'error', 
                      message: 'Invalid WebM format detected. Please restart recording.',
                      audioStats: { size: audioSize, format: audioFormat, reason: 'invalid_webm_header' }
                    }));
                    return; // Reject all WebM chunks without valid headers
                  }
                  
                  console.log(`✅ [${language}] WebM validation passed: ${audioSize} bytes with valid EBML header`);
                }
                
                // For PCM data, we can use it directly without conversion
                if (audioFormat === 'audio/pcm' || audioFormat === 'audio/raw') {
                  console.log(`✅ [${language}] Using PCM data directly: ${audioSize} bytes`);
                  
                  // Skip audio quality analysis for new app (client handles it)
                  console.log(`✅ [${language}] Skipping server-side audio quality analysis (client handles it)`);
                  
                  // More lenient criteria for PCM with longer chunks (~1 second optimal)
                  if (audioSize >= 16000) { // At least 1 second of audio (optimal)
                    console.log(`✅ [${language}] PCM chunk duration optimal (${(audioSize / 32000).toFixed(2)}s)`);
                    
                    // Write PCM data directly to Azure Speech SDK
                    pushStream.write(audioBuffer);
                    console.log(`✅ [${language}] PCM audio chunk written to Azure Speech SDK`);
                    return;
                  } else if (audioSize >= 8000) { // At least 0.5 seconds (acceptable)
                    console.log(`✅ [${language}] PCM chunk duration acceptable (${(audioSize / 32000).toFixed(2)}s)`);
                    
                    // Write PCM data directly to Azure Speech SDK
                    pushStream.write(audioBuffer);
                    console.log(`✅ [${language}] PCM audio chunk written to Azure Speech SDK`);
                    return;
                  } else {
                    console.log(`⚠️ [${language}] PCM chunk too short (${(audioSize / 32000).toFixed(2)}s), accumulating...`);
                    // For short chunks, accumulate them or send anyway for testing
                    pushStream.write(audioBuffer);
                    console.log(`✅ [${language}] Short PCM chunk sent to Azure for testing`);
                    return;
                  }
                }
                
                // For other formats, convert using ffmpeg
                console.log(`🔄 [${language}] Converting audio from ${audioFormat} to PCM WAV 16kHz...`);
                
                // Enhanced audio quality analysis before conversion
                console.log(`🔍 Analyzing audio quality for format: ${audioFormat}`);
                const audioQuality = analyzeAudioQuality(audioBuffer, audioFormat);
                console.log(`🔍 Audio quality result:`, audioQuality);
                
                // Strict speech detection filtering - reject ANY audio without speech
                if (!audioQuality.hasSpeech) {
                  console.warn(`❌ [${language}] No speech detected in audio chunk (${audioSize} bytes)`);
                  console.warn(`📊 [${language}] Audio stats:`, {
                    duration: audioQuality.duration,
                    averageAmplitude: audioQuality.averageAmplitude,
                    dynamicRange: audioQuality.dynamicRange,
                    zeroCrossingRate: audioQuality.zeroCrossingRate
                  });
                  
                  // Save problematic audio for debugging
                  try {
                    const debugFileName = `/tmp/no_speech_audio_${Date.now()}.raw`;
                    fs.writeFileSync(debugFileName, audioBuffer);
                    console.log(`🔍 [${language}] Saved silent audio for debugging: ${debugFileName}`);
                  } catch (debugError) {
                    console.warn(`⚠️ [${language}] Could not save debug audio:`, debugError.message);
                  }
                  
                  // Send informative warning to client
                  ws.send(JSON.stringify({ 
                    type: 'warning', 
                    message: 'No speech detected. Please speak louder and closer to your microphone.',
                    audioStats: {
                      size: audioSize,
                      format: audioFormat,
                      duration: audioQuality.duration,
                      amplitude: audioQuality.averageAmplitude,
                      reason: 'no_speech_detected'
                    }
                  }));
                  
                  return; // Reject all audio without speech
                }
                
                console.log(`✅ [${language}] Speech detected, proceeding with audio conversion`);
                
                // Convert to PCM WAV using ffmpeg
                convertAudioFormat(audioBuffer, audioFormat, 'wav')
                  .then(pcmBuffer => {
                    console.log(`✅ [${language}] Audio converted successfully: ${audioSize} bytes → ${pcmBuffer.length} bytes`);
                    
                    // For WebM/Opus, analyze quality after conversion
                    if (audioQuality.skipAnalysis) {
                      const convertedQuality = analyzeAudioQuality(pcmBuffer, 'audio/pcm');
                      console.log(`🔍 Post-conversion analysis for ${audioFormat}:`, convertedQuality);
                      
                      if (!convertedQuality.hasSpeech) {
                        console.warn(`⚠️ [${language}] Converted audio still appears to contain no speech`);
                        ws.send(JSON.stringify({ 
                          type: 'warning', 
                          message: 'No clear speech detected after conversion. Please speak louder or check your microphone.',
                          audioStats: convertedQuality
                        }));
                        return; // Skip sending to Azure
                      }
                    }
                    
                    // Write converted PCM data to Azure Speech SDK
                    pushStream.write(pcmBuffer);
                    console.log(`✅ [${language}] PCM audio chunk written to Azure Speech SDK`);
                    
                    // Save successful audio for debugging (occasionally)
                    if (Math.random() < 0.1) { // Save 10% of successful audio for debugging
                      try {
                        const debugFileName = `/tmp/success_audio_${Date.now()}.wav`;
                        fs.writeFileSync(debugFileName, pcmBuffer);
                        console.log(`🔍 [${language}] Saved successful audio for debugging: ${debugFileName}`);
                      } catch (debugError) {
                        console.warn(`⚠️ [${language}] Could not save debug audio:`, debugError.message);
                      }
                    }
                  })
                  .catch(conversionError => {
                    console.error(`❌ [${language}] Audio conversion failed:`, conversionError.message);
                    
                    // Graceful error handling - don't crash the connection
                    if (conversionError.message.includes('Corrupted WebM file') || 
                        conversionError.message.includes('EBML header invalid') ||
                        conversionError.message.includes('WebM chunk too small')) {
                      console.warn(`⚠️ [${language}] Skipping corrupted chunk gracefully`);
                      ws.send(JSON.stringify({ 
                        type: 'warning', 
                        message: 'Corrupted audio chunk skipped. Recording continues normally.',
                        details: { error: conversionError.message, format: audioFormat }
                      }));
                    } else {
                      // For other errors, send more detailed feedback
                      ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: 'Audio processing failed. Please check your microphone or try a different format.',
                        details: { error: conversionError.message, format: audioFormat }
                      }));
                    }
                  });
                
              } catch (processingError) {
                console.error(`❌ [${language}] Audio processing error:`, processingError);
                
                // Graceful error handling for any processing errors
                ws.send(JSON.stringify({ 
                  type: 'warning', 
                  message: 'Audio chunk processing failed, continuing with next chunk.',
                  details: { error: processingError.message, format: audioFormat }
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
            // Store the data temporarily and process it once initialized
            if (data instanceof Buffer) {
              console.log(`📦 [${language}] Storing audio data for later processing...`);
              // Process the audio data anyway, even if not fully initialized
              try {
                // Parse the data as JSON
                const jsonData = JSON.parse(data.toString());
                if (jsonData.type === 'audio' && jsonData.data) {
                  const audioBuffer = Buffer.from(jsonData.data, 'base64');
                  const audioSize = audioBuffer.length;
                  const audioFormat = jsonData.format || 'audio/pcm';
                  
                  console.log(`🎵 [${language}] Processing stored audio data: ${audioSize} bytes, format: ${audioFormat}`);
                  
                  // Process the audio data
                  if (audioSize > 0 && audioSize < 1000000) {
                    // For PCM data, we can use it directly without conversion
                    if (audioFormat === 'audio/pcm' || audioFormat === 'audio/raw') {
                      console.log(`✅ [${language}] Using stored PCM data directly: ${audioSize} bytes`);
                      
                      // Skip audio quality analysis for new app (client handles it)
                      console.log(`✅ [${language}] Skipping server-side audio quality analysis (client handles it)`);
                      
                      // More lenient criteria for PCM with longer chunks (~1 second optimal)
                      if (audioSize >= 16000) { // At least 1 second of audio (optimal)
                        console.log(`✅ [${language}] PCM chunk duration optimal (${(audioSize / 32000).toFixed(2)}s)`);
                        
                        // Write PCM data directly to Azure Speech SDK if available
                        if (pushStream) {
                          pushStream.write(audioBuffer);
                          console.log(`✅ [${language}] Stored PCM audio chunk written to Azure Speech SDK`);
                        } else {
                          console.log(`⚠️ [${language}] Push stream not available yet, skipping audio processing`);
                        }
                        return;
                      } else if (audioSize >= 8000) { // At least 0.5 seconds (acceptable)
                        console.log(`✅ [${language}] PCM chunk duration acceptable (${(audioSize / 32000).toFixed(2)}s)`);
                        
                        // Write PCM data directly to Azure Speech SDK if available
                        if (pushStream) {
                          pushStream.write(audioBuffer);
                          console.log(`✅ [${language}] Stored PCM audio chunk written to Azure Speech SDK`);
                        } else {
                          console.log(`⚠️ [${language}] Push stream not available yet, skipping audio processing`);
                        }
                        return;
                      } else {
                        console.log(`⚠️ [${language}] Stored PCM chunk too short (${(audioSize / 32000).toFixed(2)}s), accumulating...`);
                        // For short chunks, accumulate them or send anyway for testing
                        if (pushStream) {
                          pushStream.write(audioBuffer);
                          console.log(`✅ [${language}] Short stored PCM chunk sent to Azure for testing`);
                        } else {
                          console.log(`⚠️ [${language}] Push stream not available yet, skipping audio processing`);
                        }
                        return;
                      }
                    }
                  }
                }
              } catch (parseError) {
                console.warn(`⚠️ [${language}] Could not parse stored audio data:`, parseError.message);
              }
            }
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

    ws.on('close', () => {
      console.log(`🔌 [${language}] WebSocket connection closed`);
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

// Helper function to handle continuous PCM streaming
function handleContinuousPCMStream(ws, language, pushStream) {
  // Buffer for accumulating streaming PCM data
  let pcmBuffer = Buffer.alloc(0);
  const TARGET_CHUNK_SIZE = 32000; // 1 second at 16kHz = 32KB of PCM data

  return {
    // Process incoming streaming PCM data
    processStreamingPCM: (pcmData) => {
      try {
        // Accumulate PCM data
        pcmBuffer = Buffer.concat([pcmBuffer, pcmData]);
        
        console.log(`📥 [${language}] Streaming PCM data: ${pcmData.length} bytes, Buffer: ${pcmBuffer.length} bytes`);
        
        // Process when we have enough data
        while (pcmBuffer.length >= TARGET_CHUNK_SIZE) {
          const chunk = pcmBuffer.slice(0, TARGET_CHUNK_SIZE);
          pcmBuffer = pcmBuffer.slice(TARGET_CHUNK_SIZE);
          
          console.log(`🎵 [${language}] Processing PCM chunk: ${chunk.length} bytes`);
          
          // Quick quality check for continuous streaming
          const quality = analyzeAudioQuality(chunk, 'audio/pcm');
          
          if (quality.hasSpeech) {
            console.log(`✅ [${language}] Speech detected in stream, sending to Azure`);
            
            // Send directly to Azure Speech SDK
            pushStream.write(chunk);
          } else {
            console.log(`🔕 [${language}] No speech in stream chunk, skipping`);
          }
        }
        
      } catch (error) {
        console.error(`❌ [${language}] Error processing streaming PCM:`, error);
      }
    },

    // Flush remaining buffer when stream ends
    flushBuffer: () => {
      if (pcmBuffer.length > 0) {
        console.log(`🔄 [${language}] Flushing remaining PCM buffer: ${pcmBuffer.length} bytes`);
        
        const quality = analyzeAudioQuality(pcmBuffer, 'audio/pcm');
        if (quality.hasSpeech) {
          pushStream.write(pcmBuffer);
        }
        
        pcmBuffer = Buffer.alloc(0);
      }
    },

    // Get buffer status
    getBufferStatus: () => ({
      bufferSize: pcmBuffer.length,
      targetSize: TARGET_CHUNK_SIZE,
      bufferUtilization: (pcmBuffer.length / TARGET_CHUNK_SIZE * 100).toFixed(1)
    })
  };
}

const server = http.createServer(app);

// شغل WebSocket على نفس السيرفر
startWebSocketServer(server);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});