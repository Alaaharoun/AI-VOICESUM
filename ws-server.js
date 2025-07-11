const WebSocket = require('ws');
const speechsdk = require('microsoft-cognitiveservices-speech-sdk');
require('dotenv').config();

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION;
const PORT = process.env.WS_PORT || 8081;

if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
  console.error('Azure Speech credentials missing!');
  process.exit(1);
}

const wss = new WebSocket.Server({ port: PORT });
console.log(`WebSocket server listening on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  console.log('New client connected');

  // إعداد جلسة Azure Speech لكل عميل
  const pushStream = speechsdk.AudioInputStream.createPushStream();
  const audioConfig = speechsdk.AudioConfig.fromStreamInput(pushStream);
  const speechConfig = speechsdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
  speechConfig.speechRecognitionLanguage = 'ar-SA'; // يمكنك جعلها ديناميكية

  const recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);

  recognizer.recognizing = (s, e) => {
    // partial result
    ws.send(JSON.stringify({ type: 'partial', text: e.result.text }));
  };
  recognizer.recognized = (s, e) => {
    if (e.result.reason === speechsdk.ResultReason.RecognizedSpeech) {
      ws.send(JSON.stringify({ type: 'final', text: e.result.text }));
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
    // نتوقع أن العميل يرسل Buffer صوتي (PCM/WAV/OGG)
    pushStream.write(data);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    pushStream.close();
    recognizer.stopContinuousRecognitionAsync();
  });
}); 