# Language Identification (LID) Implementation Guide

## 🎯 Overview

This guide explains how to use the enhanced language identification features in the AI Live Translate Server, based on Microsoft Azure Speech Services best practices.

## 🚀 Quick Start

### 1. Start the Server
```bash
npm install
npm start
```

### 2. Test Language Identification
```bash
npm test
```

## 🔧 Configuration Options

### Language Identification Modes

#### At-Start LID (Default)
- **Use Case**: Single language audio, language doesn't change
- **Detection Time**: < 5 seconds
- **Max Languages**: 4 candidate languages
- **Latency**: Lower initial latency

#### Continuous LID
- **Use Case**: Multilingual audio, language may change
- **Detection Time**: Real-time updates
- **Max Languages**: 10 candidate languages
- **Latency**: Higher initial latency, better for multilingual

### Supported Languages

```javascript
const supportedLanguages = [
  'en-US', 'ar-SA', 'fr-FR', 'es-ES', 'de-DE',
  'it-IT', 'pt-BR', 'ru-RU', 'ja-JP', 'ko-KR',
  'zh-CN', 'tr-TR', 'nl-NL', 'pl-PL', 'sv-SE',
  'da-DK', 'no-NO', 'fi-FI', 'cs-CZ', 'sk-SK',
  'hu-HU', 'ro-RO', 'bg-BG', 'hr-HR', 'sl-SI',
  'et-EE', 'lv-LV', 'lt-LT', 'el-GR', 'he-IL',
  'th-TH', 'vi-VN', 'id-ID', 'ms-MY', 'fil-PH',
  'hi-IN', 'bn-IN', 'ur-PK', 'fa-IR', 'uk-UA'
];
```

## 📡 API Usage Examples

### WebSocket with At-Start LID

```javascript
const ws = new WebSocket('ws://localhost:10000/ws');

ws.onopen = () => {
  // Initialize with At-Start language identification
  ws.send(JSON.stringify({
    type: 'init',
    language: 'auto',
    autoDetection: true,
    lidMode: 'AtStart'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'ready') {
    console.log(`Ready for ${data.lidMode} language identification`);
  }
  
  if (data.type === 'transcription') {
    console.log(`[${data.detectedLanguage}] ${data.text}`);
  }
  
  if (data.type === 'final') {
    console.log(`Final: [${data.detectedLanguage}] ${data.text}`);
  }
};
```

### WebSocket with Continuous LID

```javascript
const ws = new WebSocket('ws://localhost:10000/ws');

ws.onopen = () => {
  // Initialize with Continuous language identification
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
};
```

### REST API for Language Identification

```javascript
const formData = new FormData();
formData.append('audio', audioBlob);
formData.append('candidateLanguages', JSON.stringify([
  'en-US', 'ar-SA', 'fr-FR', 'es-ES', 'de-DE'
]));

const response = await fetch('/identify-language', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(`Detected: ${result.detectedLanguage}`);
console.log(`Confidence: ${result.confidence}`);
```

### Batch Transcription with LID

```javascript
const formData = new FormData();
formData.append('audio', audioBlob);
formData.append('candidateLanguages', JSON.stringify([
  'en-US', 'ar-SA', 'fr-FR', 'es-ES', 'de-DE'
]));

const response = await fetch('/batch-transcribe', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(`Transcription ID: ${result.transcriptionId}`);
```

## 🎯 Best Practices

### 1. Choose the Right LID Mode

#### Use At-Start LID when:
- Audio is primarily in one language
- Language doesn't change during recording
- You need lower latency
- You have limited candidate languages (≤4)

#### Use Continuous LID when:
- Audio may contain multiple languages
- Language changes during recording
- You can accept higher initial latency
- You have more candidate languages (≤10)

### 2. Select Candidate Languages

```javascript
// For At-Start LID (max 4 languages)
const atStartLanguages = [
  'en-US', 'ar-SA', 'fr-FR', 'es-ES'
];

// For Continuous LID (max 10 languages)
const continuousLanguages = [
  'en-US', 'ar-SA', 'fr-FR', 'es-ES', 'de-DE',
  'it-IT', 'pt-BR', 'ru-RU', 'ja-JP', 'ko-KR'
];
```

### 3. Audio Quality Requirements

- **Sample Rate**: 16kHz
- **Bit Depth**: 16-bit
- **Channels**: Mono
- **Format**: WAV (automatically converted from other formats)

### 4. Error Handling

```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'error') {
    console.error('Error:', data.error);
    
    if (data.isNetworkError) {
      // Handle network errors
      console.log('Network error detected, retrying...');
    }
  }
};
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Language Not Detected
**Symptoms**: No language detected or incorrect language
**Solutions**:
- Check candidate languages list
- Ensure audio quality (16kHz, 16-bit, mono)
- Try different LID mode
- Increase audio duration (minimum 1-2 seconds)

#### 2. High Latency
**Symptoms**: Slow language detection
**Solutions**:
- Use At-Start LID for single language
- Reduce candidate languages
- Check network connectivity
- Optimize audio quality

#### 3. WebSocket Connection Issues
**Symptoms**: Connection failures or timeouts
**Solutions**:
- Check Azure credentials
- Verify server is running
- Check firewall settings
- Review server logs

#### 4. Audio Format Problems
**Symptoms**: Audio processing errors
**Solutions**:
- Server automatically converts to WAV
- Supported formats: WAV, MP3, M4A, OGG, WebM
- Ensure audio file is not corrupted

### Debug Mode

Enable detailed logging:
```bash
DEBUG=* npm start
```

## 📊 Performance Metrics

### Latency
- **At-Start LID**: < 5 seconds for language detection
- **Continuous LID**: Higher initial latency, real-time updates
- **WebSocket**: Real-time streaming with minimal latency
- **REST API**: Batch processing for longer audio files

### Throughput
- **WebSocket**: Real-time streaming
- **REST API**: Up to 100MB audio files
- **Batch API**: Large file processing

### Accuracy
- **Language Detection**: 95%+ accuracy with good audio quality
- **Transcription**: High accuracy for supported languages
- **Confidence Scores**: Available for language detection results

## 🚀 Deployment

### Environment Variables
```bash
# Required
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_azure_region

# Optional
PORT=10000
NODE_ENV=production
```

### Render.com Deployment
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

## 📝 Testing

### Run Tests
```bash
# Test all language identification features
npm test

# Test specific features
node test-language-identification.js
```

### Test Results
The test suite will verify:
- ✅ At-Start Language Identification
- ✅ Continuous Language Identification
- ✅ REST API Language Identification
- ✅ Health Check with LID features

## 🔗 API Reference

### WebSocket Messages

#### Initialize
```json
{
  "type": "init",
  "language": "auto",
  "autoDetection": true,
  "lidMode": "AtStart"
}
```

#### Audio Data
```json
{
  "type": "audio",
  "data": "base64_audio_data",
  "format": "audio/webm"
}
```

#### Response Messages
```json
{
  "type": "transcription",
  "text": "Recognized text",
  "isPartial": true,
  "detectedLanguage": "en-US",
  "lidMode": "Continuous"
}
```

### REST Endpoints

#### Health Check
```http
GET /health
```

#### Language Identification
```http
POST /identify-language
Content-Type: multipart/form-data
```

#### Batch Transcription
```http
POST /batch-transcribe
Content-Type: multipart/form-data
```

## 📞 Support

For issues and questions:
- Check the troubleshooting section
- Review Azure Speech Services documentation
- Create an issue on GitHub
- Check server logs for detailed error information

---

**Language Identification Features** - Advanced multilingual speech recognition! 🌍✨ 