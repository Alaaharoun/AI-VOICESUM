import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "placeholder_key";

// Check if we have valid Supabase configuration
const isSupabaseConfigured = supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== "https://placeholder.supabase.co" && 
  supabaseAnonKey !== "placeholder_key" &&
  supabaseUrl !== '' && 
  supabaseAnonKey !== '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export { isSupabaseConfigured };