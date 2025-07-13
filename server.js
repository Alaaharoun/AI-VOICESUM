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
    apiKey: AZURE_SPEECH_KEY ? 'Present' : 'Missing',
    timestamp: new Date().toISOString()
  });
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
    console.log('New WS client connected');
    const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
    const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;
    if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
      ws.send(JSON.stringify({ type: 'error', error: 'Azure Speech credentials missing!' }));
      ws.close();
      return;
    }
    let recognizer, pushStream, speechConfig;
    let language = 'ar-SA'; // الافتراضي
    let initialized = false;
    ws.on('message', (data) => {
      // إذا لم يتم التهيئة بعد، نتوقع أول رسالة تكون JSON فيها اللغة
      if (!initialized) {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'init' && msg.language) {
            language = msg.language;
            console.log('[WS] Using language:', language);
          }
        } catch (e) {
          // إذا لم تكن JSON، تجاهل
        }
        // الآن نبدأ التهيئة
        pushStream = speechsdk.AudioInputStream.createPushStream();
        const audioConfig = speechsdk.AudioConfig.fromStreamInput(pushStream);
        speechConfig = speechsdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
        speechConfig.speechRecognitionLanguage = language;
        recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
        recognizer.recognizing = (s, e) => {
          console.log('[WS] Partial result:', e.result.text);
          ws.send(JSON.stringify({ type: 'partial', text: e.result.text }));
        };
        recognizer.recognized = (s, e) => {
          if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
            console.log('[WS] Final result:', e.result.text);
            ws.send(JSON.stringify({ type: 'final', text: e.result.text }));
          }
        };
        recognizer.canceled = (s, e) => {
          console.log('[WS] Recognition canceled:', e.errorDetails);
          ws.send(JSON.stringify({ type: 'error', error: e.errorDetails }));
          recognizer.close();
          pushStream.close();
          speechConfig.close && speechConfig.close();
        };
        recognizer.sessionStopped = (s, e) => {
          console.log('[WS] Session stopped');
          ws.send(JSON.stringify({ type: 'done' }));
          recognizer.close();
          pushStream.close();
          speechConfig.close && speechConfig.close();
        };
        recognizer.startContinuousRecognitionAsync();
        initialized = true;
        return;
      }
      // بعد التهيئة: كل رسالة هي بيانات صوتية
      if (pushStream) {
        if (data instanceof Buffer) {
          pushStream.write(data);
        } else if (data instanceof ArrayBuffer) {
          pushStream.write(Buffer.from(data));
        } else {
          pushStream.write(Buffer.from(data));
        }
      }
    });
    ws.on('close', () => {
      console.log('[WS] Client disconnected');
      pushStream && pushStream.close();
      recognizer && recognizer.stopContinuousRecognitionAsync();
      recognizer && recognizer.close();
      speechConfig && speechConfig.close && speechConfig.close();
    });
    ws.on('error', (err) => {
      console.log('[WS] WebSocket error:', err);
      ws.close();
      pushStream && pushStream.close();
      recognizer && recognizer.close();
      speechConfig && speechConfig.close && speechConfig.close();
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
