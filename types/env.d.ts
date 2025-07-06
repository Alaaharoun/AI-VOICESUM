declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_SUPABASE_URL: string;
      EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
      EXPO_PUBLIC_QWEN_API_KEY: string;
      EXPO_PUBLIC_ASSEMBLYAI_API_KEY: string;
    }
  }
}

export {};