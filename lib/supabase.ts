import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Check if we have valid Supabase configuration
const isSupabaseConfigured = supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== '' && 
  supabaseAnonKey !== '' &&
  supabaseUrl !== 'undefined' && 
  supabaseAnonKey !== 'undefined';

// Create client based on configuration
let supabase: SupabaseClient;
if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    });
    console.log('Supabase client created successfully with proper headers');
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    supabase = createMockClient() as any;
  }
} else {
  console.warn('Supabase not configured. Using mock client.');
  supabase = createMockClient() as any;
}

// Helper function to create a complete mock client
function createMockClient() {
  return {
    auth: {
      signInWithPassword: ({ email, password }: { email: string; password: string }) => 
        Promise.resolve({ 
          data: { user: null, session: null }, 
          error: { message: 'Demo Mode: Sign in is disabled. Please configure Supabase to enable authentication.' } 
        }),
      signUp: ({ email, password, options }: { email: string; password: string; options?: any }) => 
        Promise.resolve({ 
          data: { user: null, session: null }, 
          error: { message: 'Demo Mode: Sign up is disabled. Please configure Supabase to enable authentication.' } 
        }),
      signOut: () => Promise.resolve({ error: { message: 'Demo Mode: Sign out not available' } }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: (callback: any) => ({ 
        data: { 
          subscription: { 
            unsubscribe: () => {} 
          } 
        } 
      })
    },
    from: (table: string) => ({
      select: (columns?: string) => Promise.resolve({ 
        data: [], 
        error: { message: 'Demo Mode: Database access disabled' } 
      }),
      insert: (data: any) => Promise.resolve({ 
        data: null, 
        error: { message: 'Demo Mode: Database access disabled' } 
      }),
      update: (data: any) => Promise.resolve({ 
        data: null, 
        error: { message: 'Demo Mode: Database access disabled' } 
      }),
      delete: () => Promise.resolve({ 
        data: null, 
        error: { message: 'Demo Mode: Database access disabled' } 
      })
    })
  };
}

export { supabase, isSupabaseConfigured };