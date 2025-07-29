# LiveTranslate Web

A modern web application for real-time speech-to-text transcription and translation, built with React, TypeScript, and Supabase.

## 🚀 Features

- **Real-time Speech Recording**: Record audio directly in the browser
- **Multiple Transcription Engines**: Support for Faster Whisper and Azure Speech
- **Translation**: Translate transcriptions to 100+ languages
- **Summarization**: AI-powered text summarization
- **File Upload**: Upload audio files for processing
- **History Management**: View and manage all your recordings
- **User Authentication**: Secure login/signup with Supabase Auth
- **Subscription Plans**: Free, Pro, and Enterprise tiers
- **Responsive Design**: Works on desktop and mobile devices

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: Zustand
- **Backend**: Supabase (Auth, Database, Storage)
- **Forms**: React Hook Form
- **Routing**: React Router DOM

## 📋 Prerequisites

- Node.js 16+ 
- npm or yarn
- Supabase account
- API keys for transcription and translation services

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AILIVETRANSLATEWEB
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your API keys:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_FASTER_WHISPER_URL=your_faster_whisper_api_url
   VITE_AZURE_SPEECH_KEY=your_azure_speech_key
   VITE_AZURE_SPEECH_REGION=your_azure_region
   VITE_ASSEMBLYAI_API_KEY=your_assemblyai_key
   VITE_GOOGLE_TRANSLATE_API_KEY=your_google_translate_key
   VITE_QWEN_API_KEY=your_qwen_api_key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   └── Header.tsx     # Navigation header
├── pages/             # Page components
│   ├── Home.tsx       # Landing page
│   ├── SignIn.tsx     # Login page
│   ├── SignUp.tsx     # Registration page
│   ├── LiveTranslation.tsx  # Real-time recording
│   ├── Upload.tsx     # File upload
│   ├── History.tsx    # Recording history
│   ├── Profile.tsx    # User profile
│   └── Subscription.tsx # Subscription plans
├── services/          # API services
│   └── api.ts        # Transcription, translation, summarization
├── stores/           # State management
│   └── authStore.ts  # Authentication state
├── lib/              # Utilities and configurations
│   └── supabase.ts   # Supabase client setup
└── App.tsx           # Main application component
```

## 🔧 Configuration

### Supabase Setup

1. Create a new Supabase project
2. Set up the following tables:
   - `profiles` - User profiles
   - `recordings` - Audio recordings and transcriptions
   - `user_subscriptions` - User subscription data
   - `transcription_credits` - Usage tracking

### API Services

The application supports multiple transcription engines:

- **Faster Whisper**: Fast, accurate transcription
- **Azure Speech**: Microsoft's speech recognition
- **AssemblyAI**: File upload and async processing

Translation services:
- **LibreTranslate**: Open-source translation
- **Google Translate**: High-quality translation

## 🎯 Usage

### For Users

1. **Sign up/Login**: Create an account or sign in
2. **Choose a Plan**: Select Free, Pro, or Enterprise
3. **Record Audio**: Use the live recording feature
4. **Upload Files**: Upload audio files for processing
5. **View History**: Access all your recordings
6. **Download Results**: Export transcriptions and translations

### For Developers

1. **Environment Setup**: Configure API keys in `.env`
2. **Database Setup**: Run Supabase migrations
3. **API Integration**: Connect transcription and translation services
4. **Testing**: Test all features thoroughly
5. **Deployment**: Deploy to your preferred platform

## 🔒 Security

- User authentication via Supabase Auth
- Secure API key management
- Input validation and sanitization
- CORS protection
- Rate limiting (implement as needed)

## 📱 Responsive Design

The application is fully responsive and works on:
- Desktop browsers
- Tablets
- Mobile devices
- Progressive Web App (PWA) ready

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically

### Netlify

1. Build the project: `npm run build`
2. Upload the `dist` folder
3. Configure environment variables

### Manual Deployment

1. Build the project: `npm run build`
2. Upload files to your web server
3. Configure environment variables

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation

## 🔄 Updates

Stay updated with the latest features and improvements by:
- Following the repository
- Checking release notes
- Reading the changelog

---

**LiveTranslate Web** - Transform your voice into text and translate it instantly! 🎤✨ 