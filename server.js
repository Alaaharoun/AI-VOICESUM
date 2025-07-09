const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
const upload = multer();

const ASSEMBLYAI_API_KEY = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY || process.env.ASSEMBLYAI_API_KEY;

app.post('/live-translate', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }
    console.log('Received audio file:', req.file.originalname, req.file.mimetype, req.file.size);

    // 1. Upload audio to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
      },
      body: req.file.buffer,
    });
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Upload to AssemblyAI failed:', errorText);
      return res.status(500).json({ error: 'Failed to upload audio to AssemblyAI.' });
    }
    const uploadData = await uploadResponse.json();
    const audioUrl = uploadData.upload_url;
    console.log('Audio uploaded to AssemblyAI:', audioUrl);

    // 2. Request transcription with language_detection: true
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
      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { 'authorization': ASSEMBLYAI_API_KEY },
      });
      const pollData = await pollRes.json();
      if (pollData.status === 'completed') {
        transcriptText = pollData.text;
        break;
      } else if (pollData.status === 'error') {
        return res.status(500).json({ error: pollData.error || 'Transcription failed.' });
      }
      attempts++;
    }
    if (!transcriptText) {
      return res.status(500).json({ error: 'Transcription timeout.' });
    }
    console.log('Transcription completed:', transcriptText);
    res.json({ translatedText: transcriptText });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Server running on port', PORT));
