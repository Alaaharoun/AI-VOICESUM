# Live Translation App

A real-time speech-to-text and translation application built with React Native and Expo.

## 🚀 Features

- **Real-time Speech Recognition**: Convert speech to text in real-time
- **Multi-language Translation**: Support for 50+ languages
- **Cross-platform**: Works on iOS, Android, and Web
- **WebSocket Communication**: Real-time audio streaming to server
- **Azure Speech Services**: Powered by Microsoft Azure Speech SDK
- **Smart Audio Management**: Optimized audio chunk handling
- **Connection Management**: Automatic WebSocket timeout and reconnect

## 🔧 Recent Fixes & Improvements

### WebSocket Connection
- ✅ Fixed WebSocket connection timing issues
- ✅ Added automatic timeout management (1 minute)
- ✅ Implemented reconnect functionality
- ✅ Optimized audio chunk handling

### Audio Processing
- ✅ Fixed "Buffer is not defined" error in browser
- ✅ Improved audio service initialization
- ✅ Added chunk size validation (skip silence)
- ✅ Enhanced MediaRecorder timing (200ms intervals)

### Platform Compatibility
- ✅ Fixed Web Audio API initialization issues
- ✅ Improved mobile vs web platform handling
- ✅ Added proper cleanup mechanisms

## 🛠️ Technical Stack

- **Frontend**: React Native, Expo
- **Backend**: Node.js, WebSocket
- **Speech Services**: Microsoft Azure Speech SDK
- **Translation**: Google Translate API
- **Deployment**: Render.com

## 📱 Supported Platforms

- ✅ iOS
- ✅ Android  
- ✅ Web Browser

## 🌐 Server Connection

The app connects to the live server at: `https://ai-voicesum.onrender.com`

- **WebSocket Endpoint**: `wss://ai-voicesum.onrender.com/ws`
- **Health Check**: `https://ai-voicesum.onrender.com/health`

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Expo CLI
- React Native development environment

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Alaaharoun/AI-VOICESUM.git
cd AI-VOICESUM
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npx expo start
```

4. Run on your preferred platform:
- **Web**: Press `w` in the terminal
- **iOS**: Press `i` in the terminal (requires iOS Simulator)
- **Android**: Press `a` in the terminal (requires Android Emulator)

## 📋 Usage

1. **Select Target Language**: Choose your desired translation language
2. **Toggle Real-time Mode**: Enable for instant translation or disable for batch processing
3. **Start Recording**: Tap the "Start Recording" button
4. **Speak**: Your speech will be transcribed and translated in real-time
5. **View Results**: See both original and translated text

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_azure_region
GOOGLE_TRANSLATE_API_KEY=your_google_translate_key
```

## 🐛 Troubleshooting

### Common Issues

1. **"Web Audio API not initialized"**
   - Solution: The app now automatically initializes audio on first interaction

2. **"Buffer is not defined"**
   - Solution: Fixed with proper Uint8Array conversion for browser compatibility

3. **WebSocket Connection Issues**
   - Solution: Added automatic reconnect and timeout management

4. **Audio Chunks Not Sending**
   - Solution: Improved chunk validation and WebSocket readiness checks

## 📊 Performance Optimizations

- **Audio Chunk Filtering**: Skip chunks smaller than 1000 bytes (silence)
- **WebSocket Timeout**: Automatic connection management
- **Memory Management**: Proper cleanup of audio resources
- **Platform-specific Logic**: Optimized for each platform's capabilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section above
- Review the console logs for detailed error information

## 🔄 Recent Updates

### Version 5.1.2 (Latest)
- ✅ Fixed WebSocket connection timing
- ✅ Added automatic timeout management
- ✅ Improved audio chunk handling
- ✅ Fixed browser compatibility issues
- ✅ Added reconnect functionality

---

**Built with ❤️ using React Native and Azure Speech Services** 