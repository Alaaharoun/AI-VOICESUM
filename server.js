const WebSocket = require('ws');
const { StreamingClient, StreamingEvents, StreamingClientOptions, StreamingParameters } = require('assemblyai');
require('dotenv').config();

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || 'YOUR_ASSEMBLYAI_API_KEY';

const PORT = 8080;

const wss = new WebSocket.Server({ port: PORT }, () => {
  console.log(`WebSocket server listening on ws://localhost:${PORT}`);
});

wss.on('connection', (clientSocket) => {
  console.log('Mobile client connected');

  // Set up AssemblyAI streaming client
  const aaiClient = new StreamingClient(
    new StreamingClientOptions({
      apiKey: ASSEMBLYAI_API_KEY,
      apiHost: 'streaming.assemblyai.com',
    })
  );

  // Forward AssemblyAI events to the mobile client
  aaiClient.on(StreamingEvents.Transcript, (msg) => {
    if (msg.text) {
      clientSocket.send(JSON.stringify({ type: 'transcript', text: msg.text, isFinal: msg.isFinal }));
    }
  });

  aaiClient.on(StreamingEvents.Error, (err) => {
    console.error('AssemblyAI error:', err);
    clientSocket.send(JSON.stringify({ type: 'error', error: err.message || String(err) }));
  });

  aaiClient.on(StreamingEvents.Close, () => {
    console.log('AssemblyAI connection closed');
    clientSocket.close();
  });

  // Connect to AssemblyAI
  aaiClient.connect(
    new StreamingParameters({
      sampleRate: 16000, // Make sure mobile sends 16kHz PCM/WAV
    })
  );

  // Handle incoming audio chunks from mobile
  clientSocket.on('message', (data) => {
    // Expecting raw audio buffer (PCM/WAV) or base64 string
    if (Buffer.isBuffer(data)) {
      aaiClient.sendAudio(data);
    } else {
      // If mobile sends base64, decode it
      try {
        const buf = Buffer.from(data, 'base64');
        aaiClient.sendAudio(buf);
      } catch (e) {
        clientSocket.send(JSON.stringify({ type: 'error', error: 'Invalid audio chunk format' }));
      }
    }
  });

  clientSocket.on('close', () => {
    console.log('Mobile client disconnected');
    aaiClient.close();
  });

  clientSocket.on('error', (err) => {
    console.error('WebSocket error:', err);
    aaiClient.close();
  });
});
