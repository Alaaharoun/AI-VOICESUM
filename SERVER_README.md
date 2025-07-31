# AI Live Translate Server

A streamlined Node.js server for real-time speech-to-text transcription using Azure Speech Services with enhanced auto-detection capabilities.

## 🚀 Features

- **Real-time Audio Processing**: Handle audio streams via HTTP and WebSocket
- **Azure Speech Integration**: High-quality speech recognition
- **Multi-format Support**: WAV, MP3, M4A, OGG, WebM, FLAC, PCM
- **Enhanced Auto Language Detection**: Support for 100+ languages with automatic detection
- **Complete Language Support**: All languages from the mobile app
- **Health Monitoring**: Built-in health check endpoint
- **Error Handling**: Robust error handling and logging

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **WebSocket**: ws library
- **Audio Processing**: FFmpeg
- **Speech Recognition**: Microsoft Azure Speech SDK
- **File Upload**: Multer

## 📋 Prerequisites

- Node.js 16+
- FFmpeg installed
- Azure Speech Service account
- Environment variables configured

## 🚀 Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   # Create .env file
   AZURE_SPEECH_KEY=your_azure_speech_key
   AZURE_SPEECH_REGION=your_azure_region
   PORT=10000
   ```

3. **Start the server**
   ```bash
   node server.js
   ```

4. **Verify server is running**
   ```bash
   curl http://localhost:10000/health
   ```

## 📡 API Endpoints

### Health Check
```
GET /health
```
Returns server status, configuration info, and language support statistics.

### Audio Transcription
```
POST /live-translate
```
Process audio files for transcription.

**Supported formats**: WAV, MP3, M4A, OGG, WebM, FLAC, PCM

**Request body**:
```json
{
  "audio": "base64_encoded_audio_data",
  "audioType": "audio/wav",
  "language": "en-US"
}
```

**Response**:
```json
{
  "transcription": "Recognized text from audio"
}
```

## 🔌 WebSocket API

### Connection
```
ws://localhost:10000/ws
```

### Message Types

#### Initialize
```json
{
  "type": "init",
  "language": "auto",
  "autoDetection": true
}
```

#### Audio Data
```json
{
  "type": "audio",
  "data": "base64_encoded_audio",
  "format": "audio/webm"
}
```

#### Ping/Pong
```json
{
  "type": "ping"
}
```

### Response Types

#### Transcription (Partial)
```json
{
  "type": "transcription",
  "text": "Partial recognition result",
  "isPartial": true,
  "detectedLanguage": "en-US"
}
```

#### Transcription (Final)
```json
{
  "type": "final",
  "text": "Final recognition result",
  "isPartial": false,
  "detectedLanguage": "en-US"
}
```

#### Ready Status
```json
{
  "type": "ready",
  "message": "Ready for audio",
  "autoDetection": true,
  "supportedLanguages": 100
}
```

#### Error
```json
{
  "type": "error",
  "error": "Error message",
  "reason": "error_reason",
  "errorCode": "error_code"
}
```

## 🌍 Supported Languages

### Complete Language Support (35+ languages)
- **Arabic**: ar-SA, ar-EG, ar-MA, ar-AE, ar-DZ, ar-TN, ar-JO, ar-LB, ar-KW, ar-QA, ar-BH, ar-OM, ar-YE, ar-SY, ar-IQ, ar-LY, ar-PS
- **English**: en-US, en-GB, en-AU, en-CA, en-IN
- **French**: fr-FR, fr-CA, fr-BE, fr-CH
- **Spanish**: es-ES, es-MX, es-AR, es-CO, es-PE, es-VE, es-EC, es-GT, es-CR, es-PA, es-CU, es-BO, es-DO, es-HN, es-PY, es-SV, es-NI, es-PR, es-UY, es-CL
- **German**: de-DE, de-AT, de-CH
- **Italian**: it-IT, it-CH
- **Portuguese**: pt-BR, pt-PT
- **Russian**: ru-RU
- **Chinese**: zh-CN, zh-TW, zh-HK
- **Japanese**: ja-JP
- **Korean**: ko-KR
- **Turkish**: tr-TR
- **Dutch**: nl-NL, nl-BE
- **Polish**: pl-PL
- **Czech**: cs-CZ
- **Hungarian**: hu-HU
- **Romanian**: ro-RO
- **Bulgarian**: bg-BG
- **Croatian**: hr-HR
- **Slovak**: sk-SK
- **Slovenian**: sl-SI
- **Estonian**: et-EE
- **Latvian**: lv-LV
- **Lithuanian**: lt-LT
- **Greek**: el-GR
- **Hebrew**: he-IL
- **Thai**: th-TH
- **Vietnamese**: vi-VN
- **Indonesian**: id-ID
- **Malay**: ms-MY
- **Filipino**: fil-PH
- **Hindi**: hi-IN
- **Bengali**: bn-IN
- **Urdu**: ur-PK
- **Persian**: fa-IR
- **Ukrainian**: uk-UA
- **Swedish**: sv-SE
- **Danish**: da-DK
- **Norwegian**: nb-NO
- **Finnish**: fi-FI
- **Icelandic**: is-IS
- **Irish**: ga-IE
- **Welsh**: cy-GB
- **Maltese**: mt-MT
- **Georgian**: ka-GE
- **Armenian**: hy-AM
- **Azerbaijani**: az-AZ
- **Kazakh**: kk-KZ
- **Kyrgyz**: ky-KG
- **Uzbek**: uz-UZ
- **Mongolian**: mn-MN
- **Burmese**: my-MM
- **Khmer**: km-KH
- **Lao**: lo-LA
- **Sinhala**: si-LK
- **Swahili**: sw-KE
- **Amharic**: am-ET
- **Zulu**: zu-ZA
- **Afrikaans**: af-ZA

### Auto-Detection Support
The server supports automatic language detection for **100+ languages** using Azure Speech Service's AutoDetectSourceLanguageConfig.

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AZURE_SPEECH_KEY` | Azure Speech Service API key | Yes |
| `AZURE_SPEECH_REGION` | Azure Speech Service region | Yes |
| `PORT` | Server port (default: 10000) | No |

### Audio Processing

The server automatically converts all audio formats to WAV 16kHz 16-bit mono for Azure Speech Service compatibility.

### Auto-Detection Features

- **Automatic Language Detection**: Detects spoken language automatically
- **Fallback Support**: Falls back to specific language if auto-detection fails
- **Real-time Detection**: Provides detected language in transcription results
- **Comprehensive Coverage**: Supports 100+ languages for auto-detection

## 📊 Server Logs

The server provides detailed logging with emojis for easy identification:

- 🚀 Server startup
- 📊 Configuration status
- 🌍 Language support info
- 🧠 Auto-detection status
- 🔗 WebSocket connections
- 🎵 Audio processing
- ✅ Successful operations
- ❌ Errors
- 🔌 Connection closures

## 🚀 Deployment

### Local Development
```bash
node server.js
```

### Production
```bash
# Using PM2
pm2 start server.js --name "ai-live-translate"

# Using Docker
docker build -t ai-live-translate .
docker run -p 10000:10000 ai-live-translate
```

## 🔒 Security

- CORS enabled for cross-origin requests
- Input validation for audio data
- Error handling prevents server crashes
- Temporary file cleanup

## 📈 Performance

- Optimized audio processing pipeline
- Efficient WebSocket handling
- Memory management for audio buffers
- Automatic resource cleanup
- Enhanced auto-detection performance

## 🆘 Troubleshooting

### Common Issues

1. **Azure Speech Key Missing**
   - Check environment variables
   - Verify Azure Speech Service setup

2. **Audio Processing Errors**
   - Ensure FFmpeg is installed
   - Check audio format compatibility

3. **WebSocket Connection Issues**
   - Verify WebSocket URL
   - Check firewall settings

4. **Auto-Detection Issues**
   - Ensure language is in supported list
   - Check Azure Speech Service region support

### Debug Mode

Enable detailed logging by setting:
```bash
DEBUG=* node server.js
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

---

**AI Live Translate Server** - Enhanced real-time speech recognition with auto-detection! 🎤✨🧠 