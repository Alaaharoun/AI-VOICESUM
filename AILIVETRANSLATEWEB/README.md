# AI Live Translate Server

A real-time speech-to-text and translation server with advanced language identification capabilities using Azure Speech Services.

## 🌟 Features

### Language Identification (LID)
- **At-Start LID**: Identifies language once within the first few seconds of audio
- **Continuous LID**: Identifies multiple languages during audio streaming
- **Up to 10 candidate languages** for continuous mode
- **Up to 4 candidate languages** for at-start mode
- **Real-time language detection** with confidence scores

### Supported Languages
- **English (en-US)**
- **Arabic (ar-SA)**
- **French (fr-FR)**
- **Spanish (es-ES)**
- **German (de-DE)**
- **Italian (it-IT)**
- **Portuguese (pt-BR)**
- **Russian (ru-RU)**
- **Japanese (ja-JP)**
- **Korean (ko-KR)**
- And many more...

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- Azure Speech Services subscription
- FFmpeg (for audio conversion)

### Environment Variables
```bash
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_azure_region
PORT=10000
```

### Installation
```bash
npm install
npm start
```

## 📡 API Endpoints

### 1. Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-25T10:30:00.000Z",
  "azureKey": "Present",
  "supportedLanguages": 40,
  "languageIdentification": {
    "supported": true,
    "modes": ["AtStart", "Continuous"],
    "maxLanguages": {
      "atStart": 4,
      "continuous": 10
    },
    "endpoints": [
      "/live-translate",
      "/identify-language",
      "/batch-transcribe"
    ]
  }
}
```

### 2. Real-time Translation (WebSocket)
```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:10000/ws');

// Initialize with language identification
ws.send(JSON.stringify({
  type: 'init',
  language: 'auto', // or specific language code
  autoDetection: true,
  lidMode: 'Continuous' // or 'AtStart'
}));

// Send audio data
ws.send(JSON.stringify({
  type: 'audio',
  data: base64AudioData,
  format: 'audio/webm'
}));
```

**WebSocket Messages:**
- `transcription`: Partial transcription with detected language
- `final`: Final transcription with detected language
- `ready`: Server ready for audio
- `error`: Error messages

### 3. Language Identification (REST)
```http
POST /identify-language
Content-Type: multipart/form-data

audio: [audio_file]
candidateLanguages: ["en-US", "ar-SA", "fr-FR"]
```

**Response:**
```json
{
  "detectedLanguage": "ar-SA",
  "confidence": 0.95,
  "transcription": "مرحبا بالعالم",
  "candidateLanguages": ["en-US", "ar-SA", "fr-FR"]
}
```

### 4. Batch Transcription with LID
```http
POST /batch-transcribe
Content-Type: multipart/form-data

audio: [audio_file]
candidateLanguages: ["en-US", "ar-SA", "fr-FR", "es-ES", "de-DE"]
```

**Response:**
```json
{
  "transcriptionId": "uuid",
  "status": "started",
  "message": "Batch transcription with language identification started"
}
```

## 🔧 Configuration

### Language Identification Modes

#### At-Start LID
- Identifies language once within first 5 seconds
- Use when language doesn't change during audio
- Supports up to 4 candidate languages
- Lower latency for single-language audio

#### Continuous LID
- Identifies multiple languages during audio
- Use when language might change
- Supports up to 10 candidate languages
- Higher initial latency but better for multilingual audio

### Candidate Languages
```javascript
// At-Start LID (max 4 languages)
const atStartLanguages = ["en-US", "ar-SA", "fr-FR", "es-ES"];

// Continuous LID (max 10 languages)
const continuousLanguages = [
  "en-US", "ar-SA", "fr-FR", "es-ES", "de-DE",
  "it-IT", "pt-BR", "ru-RU", "ja-JP", "ko-KR"
];
```

## 🎯 Usage Examples

### WebSocket with Continuous LID
```javascript
const ws = new WebSocket('ws://localhost:10000/ws');

ws.onopen = () => {
  // Initialize with continuous language identification
  ws.send(JSON.stringify({
    type: 'init',
    language: 'auto',
    autoDetection: true,
    lidMode: 'Continuous'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'transcription') {
    console.log(`[${data.detectedLanguage}] ${data.text}`);
  }
  
  if (data.type === 'final') {
    console.log(`Final: [${data.detectedLanguage}] ${data.text}`);
  }
};
```

### REST API for Language Identification
```javascript
const formData = new FormData();
formData.append('audio', audioBlob);
formData.append('candidateLanguages', JSON.stringify([
  'en-US', 'ar-SA', 'fr-FR', 'es-ES'
]));

const response = await fetch('/identify-language', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(`Detected: ${result.detectedLanguage}`);
console.log(`Confidence: ${result.confidence}`);
```

## 🔍 Error Handling

### Common Errors
- **Network errors**: Automatic retry with exponential backoff
- **Language detection failures**: Fallback to default language
- **Audio format issues**: Automatic conversion to WAV format
- **Azure API limits**: Rate limiting and quota management

### Error Response Format
```json
{
  "type": "error",
  "error": "Error description",
  "reason": "Error reason",
  "errorCode": "Error code",
  "isNetworkError": true,
  "lidMode": "Continuous"
}
```

## 🚀 Deployment

### Render.com
```yaml
# render.yaml
services:
  - type: web
    name: ai-live-translate
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: AZURE_SPEECH_KEY
        sync: false
      - key: AZURE_SPEECH_REGION
        sync: false
      - key: PORT
        value: 10000
```

### Environment Variables
```bash
# Required
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_azure_region

# Optional
PORT=10000
NODE_ENV=production
```

## 📊 Performance

### Latency
- **At-Start LID**: < 5 seconds for language detection
- **Continuous LID**: Higher initial latency, real-time updates
- **WebSocket**: Real-time streaming with minimal latency
- **REST API**: Batch processing for longer audio files

### Throughput
- **WebSocket**: Real-time streaming
- **REST API**: Up to 100MB audio files
- **Batch API**: Large file processing

## 🔧 Troubleshooting

### Common Issues

1. **Language not detected**
   - Check candidate languages list
   - Ensure audio quality (16kHz, 16-bit, mono)
   - Try different LID mode

2. **WebSocket connection issues**
   - Check Azure credentials
   - Verify network connectivity
   - Check server logs

3. **Audio format problems**
   - Server automatically converts to WAV
   - Supported formats: WAV, MP3, M4A, OGG, WebM

### Debug Mode
```bash
DEBUG=* npm start
```

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review Azure Speech Services documentation 