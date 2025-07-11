import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  expo: {
    name: "Live Translate",
    slug: "live-translate",
    version: "1.0.0",
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
      "expo-web-browser",
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
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_EXTERNAL_STORAGE"
      ],
      package: "com.anonymous.boltexponativewind",
      allowBackup: true,
      usesCleartextTraffic: false,
      compileSdkVersion: 34,
      targetSdkVersion: 34,
      buildToolsVersion: "34.0.0",
      minSdkVersion: 21,
      kotlinVersion: "1.8.0",
      enableProguardInReleaseBuilds: false,
      enableSeparateBuildPerCPUArchitecture: false,
      bundleInDebug: false,
      bundleInRelease: true
    },
    extra: {
      ...(config.extra || {}),
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_ASSEMBLYAI_API_KEY: process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY,
      EXPO_PUBLIC_QWEN_API_KEY: process.env.EXPO_PUBLIC_QWEN_API_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      eas: {
        projectId: "c41aa9d8-ee2d-4758-9ed5-06c87a3170fd"
      }
    },
  },
}); 