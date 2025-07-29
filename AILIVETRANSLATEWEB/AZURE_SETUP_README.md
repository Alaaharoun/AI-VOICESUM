# Azure Speech Service Setup

This application now uses Azure Speech Service for real-time transcription and translation.

## Setup Instructions

### 1. Get Azure Speech Service Credentials

1. Go to [Azure Portal](https://portal.azure.com/)
2. Create a new Speech Service resource or use an existing one
3. Go to "Keys and Endpoint" section
4. Copy your subscription key and region

### 2. Configure the Application

#### Option A: Environment Variables (Recommended)
Create a `.env` file in the project root with:
```
VITE_AZURE_SPEECH_KEY=your_azure_speech_key_here
VITE_AZURE_SPEECH_REGION=your_azure_region_here
```

#### Option B: In-App Configuration
1. Click the "Configure" button in the Azure Speech Service Configuration section
2. Enter your Azure Speech Key and Region
3. Click "Save Configuration"

### 3. Supported Languages

The application supports the following languages for transcription and translation:

- **English** (en-US)
- **Arabic** (ar-SA)
- **Spanish** (es-ES)
- **French** (fr-FR)
- **German** (de-DE)
- **Italian** (it-IT)
- **Portuguese** (pt-PT)
- **Russian** (ru-RU)
- **Japanese** (ja-JP)
- **Korean** (ko-KR)
- **Chinese** (zh-CN)
- **Hindi** (hi-IN)
- **Turkish** (tr-TR)
- **Dutch** (nl-NL)
- **Swedish** (sv-SE)
- **Danish** (da-DK)
- **Norwegian** (nb-NO)
- **Finnish** (fi-FI)
- **Polish** (pl-PL)
- **Czech** (cs-CZ)
- **Hungarian** (hu-HU)
- **Romanian** (ro-RO)
- **Bulgarian** (bg-BG)
- **Croatian** (hr-HR)
- **Slovak** (sk-SK)
- **Slovenian** (sl-SI)
- **Estonian** (et-EE)
- **Latvian** (lv-LV)
- **Lithuanian** (lt-LT)
- **Maltese** (mt-MT)
- **Greek** (el-GR)
- **Hebrew** (he-IL)
- **Thai** (th-TH)
- **Vietnamese** (vi-VN)
- **Indonesian** (id-ID)
- **Malay** (ms-MY)
- **Filipino** (fil-PH)
- **Swahili** (sw-KE)
- **Amharic** (am-ET)
- **Yoruba** (yo-NG)
- **Zulu** (zu-ZA)

### 4. Features

- **Real-time Transcription**: Speech is transcribed in real-time as you speak
- **Real-time Translation**: Transcribed text is translated to the target language
- **Continuous Recognition**: Supports long conversations with automatic silence detection
- **Error Handling**: Automatic reconnection and error recovery
- **Mobile Compatible**: Works in WebView for mobile applications

### 5. Troubleshooting

#### Common Issues:

1. **"Azure Speech Service configuration not found"**
   - Make sure you've set the environment variables or configured in-app
   - Check that your Azure Speech Service is active

2. **"Failed to connect to Azure Speech Service"**
   - Verify your subscription key and region are correct
   - Check your internet connection
   - Ensure your Azure Speech Service is in the correct region

3. **"Microphone permission denied"**
   - Allow microphone access in your browser
   - Check browser settings for microphone permissions

4. **No transcription results**
   - Speak clearly and ensure microphone is working
   - Check browser console for error messages
   - Verify Azure Speech Service is working

### 6. Development

To run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 7. Production Deployment

For production deployment:
1. Set environment variables on your hosting platform
2. Build the application: `npm run build`
3. Deploy the `dist` folder

### 8. Azure Speech Service Pricing

Azure Speech Service is pay-as-you-go:
- First 5 hours per month are free
- After that, pay only for what you use
- Check [Azure Speech Service pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/) for current rates

### 9. Security Notes

- Never commit your Azure Speech key to version control
- Use environment variables for production deployments
- Consider using Azure Key Vault for enterprise applications 