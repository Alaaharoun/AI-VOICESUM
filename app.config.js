import 'dotenv/config';

console.log("SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log("SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
console.log("ASSEMBLYAI_API_KEY", process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY);
console.log("QWEN_API_KEY", process.env.EXPO_PUBLIC_QWEN_API_KEY);

export default ({ config }) => ({
  ...config,
  expo: {
    name: "AI Live Translate",
    displayName: "AI Live Translate",
    slug: "live-translate",
    description: "AI Live Translate: Real-time and offline voice translation app powered by AI.",
    version: '6.6.0',
    orientation: "portrait",
    icon: "./assets/images/logo.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSFaceIDUsageDescription: "This app uses Face ID to securely sign you in"
      }
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-font",
      [
        "expo-av",
        {
          microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone to record audio for transcription and voice-to-text conversion."
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    permissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_EXTERNAL_STORAGE"
    ],
    android: {
      permissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS"
      ],
      package: "com.anonymous.boltexponativewind",
      allowBackup: true,
      usesCleartextTraffic: false,
      versionCode: 66,
      versionName: '6.6.0'
    },
    extra: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_ASSEMBLYAI_API_KEY: process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY,
      EXPO_PUBLIC_QWEN_API_KEY: process.env.EXPO_PUBLIC_QWEN_API_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      AZURE_SPEECH_KEY: process.env.AZURE_SPEECH_KEY,
      AZURE_SPEECH_REGION: process.env.AZURE_SPEECH_REGION,
      router: {},
      eas: {
        projectId: "f68d0e9d-f7b0-4932-a814-fd446ed5eb45"
      }
    },
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    }
  }
}); 