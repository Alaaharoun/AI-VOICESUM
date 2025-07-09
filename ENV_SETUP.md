# Environment Variables Setup

## Required Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# API Keys
EXPO_PUBLIC_ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
EXPO_PUBLIC_QWEN_API_KEY=your_qwen_api_key_here

# Service Role Key (for admin functions)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## How to Get These Values

### Supabase Configuration
1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the Project URL and anon/public key

### AssemblyAI API Key
1. Sign up at https://www.assemblyai.com/
2. Get your API key from the dashboard

### Qwen API Key
1. Sign up for Alibaba Cloud
2. Get your Qwen API key

## Troubleshooting

If you're experiencing issues:

1. **Check if .env file exists** in the root directory
2. **Verify all variables are set** and not empty
3. **Restart the development server** after adding the .env file
4. **Check console logs** for any missing environment variable errors

## Notes

- All variables starting with `EXPO_PUBLIC_` are accessible in the client-side code
- The `SUPABASE_SERVICE_ROLE_KEY` is only used for admin functions
- Make sure to add `.env` to your `.gitignore` file to keep your keys secure 