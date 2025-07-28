# Transcription Engine Selector

This feature allows administrators to choose between two transcription engines for speech-to-text processing:

## 🚀 Features

### Engine Options
- **Azure (Default)**: Uses AssemblyAI API for transcription
- **Hugging Face**: Uses the deployed Faster Whisper API on Hugging Face Spaces

### Admin Panel Integration
- Engine selector in the admin panel
- Real-time status indicators
- Easy switching between engines
- Configuration validation

## 📋 Implementation Details

### Database Changes
- Added `transcription_engine` setting to `app_settings` table
- Default value: `azure`
- Possible values: `azure`, `huggingface`

### New Files Created
1. **`services/transcriptionEngineService.ts`**: Manages engine selection and configuration
2. **`supabase/migrations/20250705250000_add_transcription_engine_setting.sql`**: Database migration
3. **`apply_transcription_engine_migration.js`**: Manual migration script
4. **`test-transcription-engine.js`**: Test script for verification

### Modified Files
1. **`components/AdminPanel.tsx`**: Added engine selector UI
2. **`services/speechService.ts`**: Added Hugging Face transcription support

## 🔧 Configuration

### Hugging Face Service
- **URL**: `https://alaaharoun-faster-whisper-api.hf.space`
- **Health Check**: `/health`
- **Transcription Endpoint**: `/transcribe`
- **Supported Formats**: WAV, MP3, M4A, FLAC, OGG, WEBM
- **Max File Size**: 25MB

### Azure Service
- **API**: AssemblyAI
- **Configuration**: Requires `ASSEMBLYAI_API_KEY` in app settings
- **Features**: Language detection, punctuation, text formatting

## 🎯 Usage

### For Administrators
1. Navigate to the Admin Panel
2. Find the "Transcription Engine Settings" section
3. Select your preferred engine:
   - **Azure (Default)**: Traditional AssemblyAI service
   - **Hugging Face**: Experimental Faster Whisper service
4. Click "Save Engine" to apply changes
5. Monitor the engine status indicator

### For Developers
The system automatically routes transcription requests based on the selected engine:

```typescript
// The SpeechService automatically uses the selected engine
const transcription = await SpeechService.transcribeAudio(audioBlob, targetLanguage);
```

## 🔍 Status Monitoring

The admin panel displays real-time engine status:

- **🟢 Ready**: Engine is properly configured and responding
- **🟡 Not Configured**: Engine is selected but not properly configured
- **🔴 Error**: Engine is experiencing issues

## 🧪 Testing

### Manual Testing
Run the test script to verify the implementation:

```bash
node test-transcription-engine.js
```

### Migration Application
If Supabase CLI is not configured, apply the migration manually:

```bash
node apply_transcription_engine_migration.js
```

## 📊 API Endpoints

### Hugging Face Service Endpoints

#### Health Check
```
GET https://alaaharoun-faster-whisper-api.hf.space/health
```

Response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "service": "faster-whisper",
  "auth_required": false,
  "auth_configured": false
}
```

#### Transcription
```
POST https://alaaharoun-faster-whisper-api.hf.space/transcribe
```

Request (FormData):
- `file`: Audio file (WAV, MP3, M4A, etc.)
- `language`: Language code (optional, e.g., "en", "ar", "es")
- `task`: "transcribe" or "translate" (default: "transcribe")

Response:
```json
{
  "success": true,
  "text": "Transcribed text here",
  "language": "en",
  "language_probability": 0.95
}
```

## 🔄 Engine Switching

### Automatic Routing
The system automatically routes requests based on the current engine setting:

1. **Azure Engine**: Uses `transcribeWithAssemblyAI()` method
2. **Hugging Face Engine**: Uses `transcribeWithHuggingFace()` method

### Fallback Behavior
- If the selected engine fails, the system will not automatically fallback to the other engine
- This prevents unexpected behavior and ensures predictable results
- Administrators can manually switch engines if needed

## 🛡️ Security Considerations

### API Keys
- Azure API key is stored in the `app_settings` table
- Hugging Face service currently doesn't require authentication
- All API communications use HTTPS

### Error Handling
- Network timeouts are set to prevent hanging requests
- Detailed error logging for debugging
- User-friendly error messages

## 📈 Performance Considerations

### Azure (AssemblyAI)
- **Pros**: High accuracy, reliable, well-established
- **Cons**: Cost per request, dependency on external service

### Hugging Face (Faster Whisper)
- **Pros**: Free, open-source, potentially faster
- **Cons**: Experimental, depends on Hugging Face Spaces availability

## 🔮 Future Enhancements

### Potential Improvements
1. **Automatic Fallback**: Switch to backup engine on failure
2. **Engine Comparison**: Side-by-side accuracy testing
3. **Custom Models**: Support for custom Hugging Face models
4. **Batch Processing**: Support for multiple audio files
5. **Real-time Streaming**: WebSocket support for live transcription

### Monitoring
1. **Usage Analytics**: Track which engine is used more
2. **Performance Metrics**: Response times and accuracy rates
3. **Error Tracking**: Monitor and alert on engine failures

## 🐛 Troubleshooting

### Common Issues

#### Hugging Face Service Unavailable
- Check if the Hugging Face Space is running
- Verify the URL is correct
- Check network connectivity

#### Azure API Key Issues
- Verify the API key is correctly set in admin panel
- Check if the key has sufficient credits
- Ensure the key has proper permissions

#### Engine Not Switching
- Clear app cache and restart
- Verify the setting was saved in the database
- Check for any JavaScript errors in the console

### Debug Information
The system provides detailed logging for debugging:

```javascript
console.log('Using transcription engine:', engine);
console.log('Transcribing with Hugging Face...', { size, type, targetLanguage });
console.log('Hugging Face transcription successful:', { text, language, probability });
```

## 📝 Notes

- The Hugging Face service is experimental and may have downtime
- Azure remains the default and recommended engine for production use
- Both engines support the same audio formats and language codes
- The feature is designed to be non-disruptive to existing functionality 