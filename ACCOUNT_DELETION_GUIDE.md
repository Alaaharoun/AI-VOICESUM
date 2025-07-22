# Account Deletion Guide - AI VoiceSum

## For Google Play Console

### Account Creation Methods
Select all that apply:
- ✅ **Username and password** (Email/Password sign-in)
- ✅ **OAuth** (Google Sign-In)

### Account Deletion Link
Provide this link to Google Play:
```
https://ai-voicesum.onrender.com/delete-account.html
```

## Implementation Details

### 1. In-App Deletion
- **File:** `app/delete-account.tsx`
- **Access:** Profile screen → "Delete Account" button
- **Features:** 
  - Confirmation dialog
  - Data cleanup
  - Account removal

### 2. Web Deletion Page
- **File:** `public/delete-account.html`
- **URL:** `https://ai-voicesum.onrender.com/delete-account.html`
- **Features:**
  - Email confirmation
  - Text confirmation ("DELETE")
  - Token validation

### 3. API Endpoint
- **File:** `server/delete-account.js`
- **Endpoint:** `POST /api/delete-account`
- **Features:**
  - Secure token validation
  - Complete data cleanup
  - User account deletion

## Data Deletion Process

When a user requests account deletion:

1. **Validation:** Email and token verification
2. **Data Cleanup:** Delete from all tables:
   - `recordings` (voice recordings, transcriptions)
   - `user_subscriptions` (subscription data)
   - `free_trials` (trial usage data)
3. **Account Removal:** Delete from Supabase Auth
4. **Confirmation:** Send success message

## Security Features

- **Time-based tokens** for deletion links
- **Email confirmation** required
- **Text confirmation** ("DELETE" typing)
- **Service role authentication** for API

## Testing

### Test Web Page
Visit: `https://ai-voicesum.onrender.com/delete-account.html`

### Test In-App
1. Open app → Profile → "Delete Account"
2. Follow confirmation steps

## Compliance Status

✅ **Google Play Requirements Met:**
- Account creation methods disclosed
- Account deletion functionality provided
- Deletion link available
- Data removal confirmed

## Files Created/Modified

- ✅ `app/delete-account.tsx` - In-app deletion screen
- ✅ `app/(tabs)/profile.tsx` - Added delete button
- ✅ `public/delete-account.html` - Web deletion page
- ✅ `server/delete-account.js` - API endpoint
- ✅ `contexts/AuthContext.tsx` - Added deleteAccount function
- ✅ `DELETE_ACCOUNT_README.md` - Detailed documentation
- ✅ `ACCOUNT_DELETION_GUIDE.md` - This guide

## Quick Setup

1. **Deploy web page** to your hosting service
2. **Deploy API server** to your backend
3. **Update Google Play Console** with the deletion link
4. **Test both in-app and web deletion** flows

## Support

The account deletion system is now fully implemented and ready for Google Play submission! 🎉 