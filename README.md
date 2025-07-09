# AI Voice Translation & Transcription App

## Overview

This project is a **full-featured cross-platform voice transcription and translation app** built with React Native (Expo), Supabase, and AssemblyAI.  
It enables users to record audio, transcribe speech, translate in real-time, and manage their usage/subscription—all with a modern, user-friendly interface and a robust admin panel.

---

## Features

### 🎤 **Audio Transcription & Translation**
- Record audio and get instant, accurate transcriptions.
- Translate transcriptions to 14+ languages.
- **Real-time translation**: See translations live as you speak (web, mobile coming soon).

### 🏆 **Premium Subscription System**
- Free and premium plans with usage limits.
- In-app subscription management (activate, deactivate, upgrade).
- Usage tracking (minutes/hours used, daily limits).

### 🕹️ **Modern UI/UX**
- Clean, mobile-first design.
- Multi-language support (Arabic & English, auto-detects device language).
- Dark/light mode support.

### 📊 **Admin Panel**
- Secret, protected admin page (PIN + Supabase role check).
- View system stats: total users, subscribers, recordings, usage hours.
- Search, view, and manage all users (with pagination for large datasets).
- Grant/revoke admin rights, manage subscriptions.
- Edit app-wide settings (e.g., Rate Us/Share App links) live from the admin panel.

### 🔗 **Dynamic App Links**
- "Rate Us" and "Share App" links are editable by admins and update instantly for all users.

### 🛡️ **Security**
- Supabase Auth for secure login and role management.
- Row-level security and custom SQL functions for admin/superadmin logic.

### 📝 **History & Summaries**
- Save and view past transcriptions.
- AI-powered summary of transcriptions.

### 📱 **Platform Support**
- Android, iOS, and Web (PWA-ready).

---

## Project Structure

```
project/
  app/                # Main app screens and navigation
    (tabs)/           # Tabbed pages (profile, history, live translation, etc.)
    (auth)/           # Auth screens (sign-in, sign-up)
    components/       # Reusable UI components (AdminPanel, RecordButton, etc.)
    contexts/         # React context providers (Auth, Subscription)
    hooks/            # Custom React hooks (audio, auth, etc.)
    lib/              # Supabase client and helpers
    locales/          # i18n translation files
    services/         # Audio and speech processing logic
    supabase/         # Database migrations and SQL functions
  assets/             # Images and icons
  package.json        # Dependencies and scripts
  ...
```

---

## Tech Stack

- **Frontend:** React Native (Expo), TypeScript, Expo Router
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions)
- **Speech/AI:** AssemblyAI (for transcription & summarization)
- **Other:** i18n-js, Lucide icons, Expo modules

---

## Setup & Installation

### 1. **Clone the Repository**
```bash
git clone <your-repo-url>
cd <project-root>
```

### 2. **Install Dependencies**
```bash
npm install
# or
yarn install
```

### 3. **Configure Environment**
- Copy your Supabase project URL and anon key.
- Set them in your `.env` or `app.json` (see `lib/supabase.ts` for usage).
- Add your AssemblyAI API key.

### 4. **Run Database Migrations**
- Go to `project/supabase/migrations/`.
- Apply all `.sql` files in order to your Supabase SQL editor.
- This will set up all tables, roles, functions, and policies.

### 5. **Start the App**
```bash
npm run dev
# or
yarn dev
```
- For Android: `npm run android`
- For iOS: `npm run ios`
- For Web: `npm run build:web`

---

## Admin Access

- The admin panel is hidden and only accessible via a secret gesture (e.g., tapping the version label 5 times).
- Admins must enter a PIN and have the correct Supabase role.
- Superadmins can manage all users, subscriptions, and app settings.

---

## Customization

- **Languages:** Add/edit translations in `locales/`.
- **App Links:** Change "Rate Us" and "Share App" links from the admin panel.
- **Subscription Plans:** Adjust logic in Supabase and the subscription UI.

---

## Real-Time Translation

See [`REAL_TIME_TRANSLATION.md`](./REAL_TIME_TRANSLATION.md) for full details on how live translation works and how to use it.

---

## Database & Security

- All sensitive actions are protected by Supabase RLS and custom SQL functions.
- See [`MIGRATION_GUIDE.md`](./MIGRATION_GUIDE.md) for advanced migration and superadmin setup.

---

## Extending & Selling

- The codebase is modular and well-documented.
- Buyers can easily:
  - Change branding, icons, and colors.
  - Add new features or integrations.
  - Deploy to their own Supabase/AssemblyAI accounts.
  - Manage users and settings without code changes.

---

## Support

For any questions or setup help, contact the original developer or open an issue.

---

**Enjoy your new AI-powered voice translation app!** 