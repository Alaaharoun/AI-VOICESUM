const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
const upload = multer();

const ASSEMBLYAI_API_KEY = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY || process.env.ASSEMBLYAI_API_KEY;

console.log('Server starting with API key:', ASSEMBLYAI_API_KEY ? 'Present' : 'Missing');
console.log('Environment variables:', {
  EXPO_PUBLIC_ASSEMBLYAI_API_KEY: process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY ? 'Present' : 'Missing',
  ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY ? 'Present' : 'Missing'
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKey: ASSEMBLYAI_API_KEY ? 'Present' : 'Missing',
    timestamp: new Date().toISOString()
  });
});

app.post('/live-translate', upload.single('audio'), async (req, res) => {
  try {
    console.log('=== Live Translation Request ===');
    console.log('Headers:', req.headers);
    console.log('Body keys:', Object.keys(req.body || {}));
    
    let audioBuffer, audioMimeType;
    
    // تحقق من نوع الطلب
    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
      // طلب JSON (base64)
      console.log('Processing JSON request with base64 audio...');
      const jsonData = req.body;
      
      if (!jsonData.audio) {
        console.error('No audio data in JSON request');
        return res.status(400).json({ error: 'No audio data provided.' });
      }
      
      // تحويل base64 إلى buffer
      audioBuffer = Buffer.from(jsonData.audio, 'base64');
      audioMimeType = jsonData.audioType || 'audio/mpeg';
      
      console.log('Received base64 audio:', {
        size: audioBuffer.length,
        type: audioMimeType
      });
    } else {
      // طلب FormData (الطريقة الأصلية)
      if (!req.file) {
        console.error('No file uploaded');
        return res.status(400).json({ error: 'No audio file uploaded.' });
      }
      
      audioBuffer = req.file.buffer;
      audioMimeType = req.file.mimetype;
      
      console.log('Received FormData audio file:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        fieldname: req.file.fieldname
      });
    }

    // تحقق من أن الملف صوتي
    if (!audioMimeType.startsWith('audio/')) {
      console.error('Invalid file type:', audioMimeType);
      return res.status(400).json({ error: 'Invalid file type. Only audio files are allowed.' });
    }

    // تحقق من حجم الملف
    if (audioBuffer.length < 1000) {
      console.error('File too small:', audioBuffer.length);
      return res.status(400).json({ error: 'Audio file too small. Please record longer audio.' });
    }

    if (!ASSEMBLYAI_API_KEY) {
      console.error('AssemblyAI API key is missing');
      return res.status(500).json({ error: 'Server configuration error: API key missing.' });
    }

    // 1. Upload audio to AssemblyAI
    console.log('Uploading to AssemblyAI...');
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': audioMimeType,
      },
      body: audioBuffer,
    });
    
    console.log('Upload response status:', uploadResponse.status);
    console.log('Upload response headers:', uploadResponse.headers);
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Upload to AssemblyAI failed:', errorText);
      return res.status(500).json({ error: 'Failed to upload audio to AssemblyAI.' });
    }
    
    const uploadData = await uploadResponse.json();
    const audioUrl = uploadData.upload_url;
    console.log('Audio uploaded to AssemblyAI:', audioUrl);

    // 2. Request transcription with language_detection: true
    console.log('Requesting transcription...');
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_detection: true,
        punctuate: true,
        format_text: true,
        filter_profanity: false,
        dual_channel: false,
        speaker_labels: false
      }),
    });
    
    console.log('Transcription request status:', transcriptResponse.status);
    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      console.error('Transcription request failed:', errorText);
      return res.status(500).json({ error: 'Failed to request transcription from AssemblyAI.' });
    }
    
    const transcriptData = await transcriptResponse.json();
    const transcriptId = transcriptData.id;
    console.log('Transcription requested, id:', transcriptId);

    // 3. Poll for results
    let attempts = 0;
    let transcriptText = '';
    while (attempts < 60) { // 3 دقائق كحد أقصى
      await new Promise(r => setTimeout(r, 3000));
      console.log(`Polling attempt ${attempts + 1}, status: processing`);
      
      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { 'authorization': ASSEMBLYAI_API_KEY },
      });
      
      if (!pollRes.ok) {
        console.error('Poll request failed:', pollRes.status);
        break;
      }
      
      const pollData = await pollRes.json();
      console.log('Poll response status:', pollData.status);
      
      if (pollData.status === 'completed') {
        transcriptText = pollData.text;
        console.log('Transcription completed:', transcriptText);
        break;
      } else if (pollData.status === 'error') {
        console.error('Transcription error:', pollData.error);
        return res.status(500).json({ error: pollData.error || 'Transcription failed.' });
      }
      attempts++;
    }
    
    if (!transcriptText) {
      console.error('Transcription timeout');
      return res.status(500).json({ error: 'Transcription timeout.' });
    }
    
    console.log('Sending response:', { translatedText: transcriptText });
    res.json({ translatedText: transcriptText });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Server running on port', PORT));
