import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      recordings: {
        Row: {
          id: string;
          user_id: string;
          transcription: string;
          translation: string | null;
          summary: string | null;
          duration: number | null;
          target_language: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          transcription: string;
          translation?: string | null;
          summary?: string | null;
          duration?: number | null;
          target_language?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          transcription?: string;
          translation?: string | null;
          summary?: string | null;
          duration?: number | null;
          target_language?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          subscription_type: string;
          active: boolean;
          expires_at: string;
          usage_seconds: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription_type: string;
          active?: boolean;
          expires_at: string;
          usage_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subscription_type?: string;
          active?: boolean;
          expires_at?: string;
          usage_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      transcription_credits: {
        Row: {
          id: string;
          user_id: string;
          total_minutes: number;
          used_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          total_minutes?: number;
          used_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          total_minutes?: number;
          used_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}; 