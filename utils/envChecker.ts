import Constants from 'expo-constants';

export function checkEnvironmentVariables() {
  const requiredVars = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_ASSEMBLYAI_API_KEY',
    'EXPO_PUBLIC_QWEN_API_KEY'
  ];

  const missingVars: string[] = [];
  const emptyVars: string[] = [];

  requiredVars.forEach(varName => {
    const value = Constants.expoConfig?.extra?.[varName] || process.env[varName];
    
    if (!value) {
      missingVars.push(varName);
    } else if (value === 'your_api_key_here' || value === 'your_supabase_url_here') {
      emptyVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.error('Missing environment variables:', missingVars);
    return {
      isValid: false,
      error: `Missing environment variables: ${missingVars.join(', ')}. Please check your .env file.`
    };
  }

  if (emptyVars.length > 0) {
    console.error('Empty or placeholder environment variables:', emptyVars);
    return {
      isValid: false,
      error: `Please set valid values for: ${emptyVars.join(', ')}. Check ENV_SETUP.md for instructions.`
    };
  }

  console.log('All environment variables are properly configured');
  return {
    isValid: true,
    error: null
  };
}

export function getEnvironmentVariable(name: string): string | undefined {
  return Constants.expoConfig?.extra?.[name] || process.env[name];
} 