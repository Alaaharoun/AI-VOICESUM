// Database table names and structures for the admin panel
// This is an example file - create your own database.ts with real values

export const ADMIN_TABLES = {
  PROFILES: 'profiles',
  USER_SUBSCRIPTIONS: 'user_subscriptions',
  TRANSCRIPTION_CREDITS: 'transcription_credits',
  USER_ROLES: 'user_roles',
  ROLES: 'roles',
  PERMISSIONS: 'permissions',
  ROLE_PERMISSIONS: 'role_permissions',
  RECORDINGS: 'recordings',
  APP_SETTINGS: 'app_settings',
} as const;

export const ALLOWED_TABLES: string[] = Object.values(ADMIN_TABLES);

export interface DatabaseTable {
  name: string;
  displayName: string;
  description: string;
  columns: TableColumn[];
}

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
}

export const TABLE_SCHEMAS: Record<string, DatabaseTable> = {
  [ADMIN_TABLES.PROFILES]: {
    name: ADMIN_TABLES.PROFILES,
    displayName: 'User Profiles',
    description: 'User profile information and metadata',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, description: 'Primary key' },
      { name: 'user_id', type: 'uuid', nullable: false, description: 'Reference to auth.users' },
      { name: 'email', type: 'text', nullable: true, description: 'User email address' },
      { name: 'full_name', type: 'text', nullable: true, description: 'User full name' },
      { name: 'avatar_url', type: 'text', nullable: true, description: 'Profile picture URL' },
      { name: 'created_at', type: 'timestamptz', nullable: false, description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: false, description: 'Last update timestamp' },
    ],
  },
  
  [ADMIN_TABLES.USER_SUBSCRIPTIONS]: {
    name: ADMIN_TABLES.USER_SUBSCRIPTIONS,
    displayName: 'User Subscriptions',
    description: 'User subscription plans and status',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, description: 'Primary key' },
      { name: 'user_id', type: 'uuid', nullable: false, description: 'Reference to auth.users' },
      { name: 'subscription_type', type: 'text', nullable: false, description: 'Type: trial, monthly, yearly' },
      { name: 'active', type: 'boolean', nullable: false, description: 'Subscription active status' },
      { name: 'created_at', type: 'timestamptz', nullable: false, description: 'Creation timestamp' },
      { name: 'expires_at', type: 'timestamptz', nullable: true, description: 'Expiration timestamp' },
      { name: 'usage_seconds', type: 'integer', nullable: true, description: 'Total usage in seconds' },
    ],
  },

  [ADMIN_TABLES.TRANSCRIPTION_CREDITS]: {
    name: ADMIN_TABLES.TRANSCRIPTION_CREDITS,
    displayName: 'Transcription Credits',
    description: 'User transcription minutes and usage tracking',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, description: 'Primary key' },
      { name: 'user_id', type: 'uuid', nullable: false, description: 'Reference to auth.users' },
      { name: 'total_minutes', type: 'integer', nullable: true, description: 'Total available minutes' },
      { name: 'used_minutes', type: 'integer', nullable: true, description: 'Minutes already used' },
      { name: 'created_at', type: 'timestamptz', nullable: false, description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: false, description: 'Last update timestamp' },
    ],
  },

  [ADMIN_TABLES.USER_ROLES]: {
    name: ADMIN_TABLES.USER_ROLES,
    displayName: 'User Roles',
    description: 'User role assignments',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, description: 'Primary key' },
      { name: 'user_id', type: 'uuid', nullable: false, description: 'Reference to auth.users' },
      { name: 'role_id', type: 'uuid', nullable: false, description: 'Reference to roles table' },
      { name: 'created_at', type: 'timestamptz', nullable: false, description: 'Creation timestamp' },
      { name: 'created_by', type: 'uuid', nullable: true, description: 'User who assigned the role' },
    ],
  },

  [ADMIN_TABLES.ROLES]: {
    name: ADMIN_TABLES.ROLES,
    displayName: 'Roles',
    description: 'System roles and permissions',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, description: 'Primary key' },
      { name: 'name', type: 'text', nullable: false, description: 'Role name (user, admin, super_admin)' },
      { name: 'description', type: 'text', nullable: true, description: 'Role description' },
      { name: 'created_at', type: 'timestamptz', nullable: false, description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: false, description: 'Last update timestamp' },
    ],
  },

  [ADMIN_TABLES.RECORDINGS]: {
    name: ADMIN_TABLES.RECORDINGS,
    displayName: 'Recordings',
    description: 'User audio recordings and transcriptions',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, description: 'Primary key' },
      { name: 'user_id', type: 'uuid', nullable: false, description: 'Reference to auth.users' },
      { name: 'transcription', type: 'text', nullable: false, description: 'Transcribed text' },
      { name: 'summary', type: 'text', nullable: true, description: 'AI-generated summary' },
      { name: 'duration', type: 'integer', nullable: true, description: 'Recording duration in seconds' },
      { name: 'created_at', type: 'timestamptz', nullable: false, description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: false, description: 'Last update timestamp' },
    ],
  },

  [ADMIN_TABLES.APP_SETTINGS]: {
    name: ADMIN_TABLES.APP_SETTINGS,
    displayName: 'App Settings',
    description: 'Application configuration settings',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, description: 'Primary key' },
      { name: 'key', type: 'text', nullable: false, description: 'Setting key name' },
      { name: 'value', type: 'text', nullable: true, description: 'Setting value' },
      { name: 'created_at', type: 'timestamptz', nullable: false, description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: false, description: 'Last update timestamp' },
    ],
  },
};

// Admin access levels
export const ACCESS_LEVELS = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user',
} as const;

// Subscription types
export const SUBSCRIPTION_TYPES = {
  TRIAL: 'trial',
  BASIC: 'basic',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  SUP_PRO: 'sup_pro',
  UNLIMITED: 'unlimited',
} as const;

// Test configuration
export const TEST_CONFIG = {
  WEBSOCKET_URL: 'wss://ai-voicesum.onrender.com/ws',
  QWEN_API_URL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
  DEFAULT_TIMEOUT: 15000,
  AUDIO_SAMPLE_RATE: 16000,
  AUDIO_CHANNELS: 1,
  AUDIO_BITS_PER_SAMPLE: 16,
} as const;

// Default PIN for admin access - CHANGE THIS TO YOUR OWN PIN!
export const ADMIN_PIN = 'YOUR_ADMIN_PIN_HERE';

// Default trial settings
export const TRIAL_SETTINGS = {
  DEFAULT_DAYS: 3,
  DEFAULT_MINUTES: 60,
  EXTENDED_DAYS: 7,
  EXTENDED_MINUTES: 120,
} as const;

// Security settings for admin panel
export const SECURITY_SETTINGS = {
  HIDE_SENSITIVE_INFO: true, // Set to true for production/review
  MASK_API_RESPONSES: true,  // Mask detailed API responses
  SHOW_ENV_VARIABLES: false, // Never show environment variables
  PRODUCTION_MODE: true,     // Enable production security mode
} as const;

// Safe display messages for production
export const SAFE_MESSAGES = {
  API_CONFIGURED: 'Service configured and active',
  API_NOT_CONFIGURED: 'Service configuration required',
  CONNECTION_SUCCESS: 'Service is responding correctly',
  CONNECTION_FAILED: 'Service connection failed',
  SECURITY_PROTECTED: '🔒 All sensitive information is protected',
  KEYS_SECURED: 'keys secured and encrypted',
} as const; 