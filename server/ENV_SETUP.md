# Server Environment Setup

## Required Environment Variables

Create a `.env` file in the server directory with the following variables:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://ai-voicesum.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Azure Speech Configuration
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=your_azure_speech_region_here

# AssemblyAI Configuration
EXPO_PUBLIC_ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# Server Configuration
PORT=10000
```

## How to Get Supabase Service Role Key

1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the "service_role" key (not the anon key)
4. Replace `your_service_role_key_here` with the actual key

## Important Notes

- The `SUPABASE_SERVICE_ROLE_KEY` is required for account deletion functionality
- This key has admin privileges, so keep it secure
- Never expose this key in client-side code
- The server will use this key to delete user accounts and data

## Testing the Setup

After setting up the environment variables:

1. Start the server: `npm start`
2. Test the health endpoint: `http://localhost:10000/health`
3. Test the delete account page: `http://localhost:10000/simple-delete-account.html` 