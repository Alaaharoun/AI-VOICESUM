# Transcription Engine Admin Guide

## 🎯 Overview

The admin panel now includes a functional transcription engine selector that allows administrators to switch between Azure Speech and Faster Whisper services.

## 🔧 Features Added

### 1. Interactive Engine Selector
- **Azure Speech**: Traditional AssemblyAI service (default)
- **Faster Whisper**: Hugging Face-based service
- Visual feedback showing which engine is currently selected
- Real-time status indicators

### 2. Database Integration
- Settings are stored in the `app_settings` table
- Automatic loading of current engine setting
- Persistent configuration across app restarts

### 3. Status Monitoring
- Real-time engine status checking
- Configuration validation
- Error reporting for connectivity issues

## 📋 Setup Instructions

### Step 1: Database Setup
Run the following SQL in your Supabase SQL Editor:

```sql
-- Add transcription engine setting to app_settings table
INSERT INTO app_settings (key, value, description, created_at, updated_at)
VALUES (
  'transcription_engine',
  'azure',
  'Transcription engine to use: azure or huggingface',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
```

### Step 2: Verify Installation
Check that the setting was added:
```sql
SELECT * FROM app_settings WHERE key = 'transcription_engine';
```

## 🎮 How to Use

### Accessing the Engine Selector
1. Navigate to the Admin Panel
2. Enter your admin PIN
3. Go to the "Settings" tab
4. Find the "Transcription Engine" section

### Switching Engines
1. **Select Engine**: Click on either "Azure Speech" or "Faster Whisper"
2. **Save Setting**: Click "Save Engine Setting" button
3. **Verify Status**: Check the status indicator below the buttons

### Status Indicators
- 🟢 **Green**: Engine is ready and configured
- 🟡 **Yellow**: Engine is not properly configured
- 🔴 **Red**: Engine has connectivity issues

## 🔍 Engine Details

### Azure Speech (Default)
- **Service**: AssemblyAI API
- **Features**: High accuracy, language detection, punctuation
- **Requirements**: Valid API key in app settings
- **Status**: Ready if API key is configured

### Faster Whisper
- **Service**: Hugging Face Spaces
- **URL**: `https://alaaharoun-faster-whisper-api.hf.space`
- **Features**: Free, open-source, potentially faster
- **Requirements**: Internet connectivity to Hugging Face
- **Status**: Ready if service is accessible

## 🛠️ Troubleshooting

### Engine Not Switching
1. **Check Database**: Verify the setting exists in `app_settings`
2. **Clear Cache**: Restart the app
3. **Check Permissions**: Ensure you have admin access

### Status Shows Error
1. **Azure**: Check if API key is configured
2. **Faster Whisper**: Check internet connectivity
3. **Both**: Verify app_settings table permissions

### Save Button Not Working
1. **Check Network**: Ensure internet connection
2. **Verify Permissions**: Confirm admin role
3. **Check Console**: Look for error messages

## 📊 Monitoring

### What Gets Logged
- Engine selection changes
- Status check results
- Configuration errors
- Save operation results

### Performance Impact
- Status checks happen when settings tab is opened
- Minimal database queries
- No impact on transcription performance

## 🔒 Security

### Access Control
- Only superadmins can change engine settings
- Settings are stored securely in database
- No sensitive data exposed in UI

### Validation
- Engine values are validated before saving
- Status checks prevent invalid configurations
- Error handling prevents crashes

## 🚀 Future Enhancements

### Planned Features
1. **Automatic Fallback**: Switch to backup engine on failure
2. **Performance Metrics**: Track response times and accuracy
3. **Batch Testing**: Test both engines simultaneously
4. **Custom Models**: Support for custom Hugging Face models

### Monitoring Improvements
1. **Usage Analytics**: Track which engine is used more
2. **Error Tracking**: Monitor and alert on engine failures
3. **Performance Dashboard**: Real-time metrics display

## 📞 Support

If you encounter issues:
1. Check the console for error messages
2. Verify database connectivity
3. Test engine endpoints manually
4. Contact support with error details

---

**Note**: The transcription engine selector is now fully functional in the admin panel. Changes take effect immediately and are persistent across app restarts. 