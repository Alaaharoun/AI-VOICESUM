// إصلاح محسن لـ Supabase في الويب
// هذا الملف يحل مشاكل الاتصال والـ WebSocket في الويب

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// إعدادات محسنة للويب
function createWebSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase configuration for web');
    throw new Error('Supabase configuration not found');
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
      },
      global: {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      },
      db: {
        schema: 'public'
      }
    });

    console.log('✅ Web Supabase client created successfully with enhanced headers');
    return supabase;
  } catch (error) {
    console.error('❌ Failed to create Web Supabase client:', error);
    throw error;
  }
}

// دالة لاختبار الاتصال
export async function testWebConnection(): Promise<boolean> {
  try {
    const supabase = createWebSupabaseClient();
    
    // اختبار الوصول إلى جدول user_subscriptions
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Database connection test failed:', error);
      return false;
    }

    console.log('✅ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test error:', error);
    return false;
  }
}

// دالة لاختبار إعدادات التطبيق
export async function testAppSettings(): Promise<boolean> {
  try {
    const supabase = createWebSupabaseClient();
    
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('key', 'transcription_engine')
      .single();

    if (error) {
      console.error('❌ App settings test failed:', error);
      return false;
    }

    console.log('✅ App settings test successful:', data);
    return true;
  } catch (error) {
    console.error('❌ App settings test error:', error);
    return false;
  }
}

// دالة لإصلاح المحرك الافتراضي
export async function fixTranscriptionEngine(): Promise<boolean> {
  try {
    const supabase = createWebSupabaseClient();
    
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'transcription_engine',
        value: 'huggingface'
      }, { onConflict: 'key' });

    if (error) {
      console.error('❌ Failed to update transcription engine:', error);
      return false;
    }

    console.log('✅ Transcription engine updated to Hugging Face');
    return true;
  } catch (error) {
    console.error('❌ Error updating transcription engine:', error);
    return false;
  }
}

// دالة رئيسية لاختبار وإصلاح جميع المشاكل
export async function fixWebIssues(): Promise<boolean> {
  console.log('🚀 Starting web issues fix...');

  try {
    // اختبار الاتصال بقاعدة البيانات
    const dbTest = await testWebConnection();
    if (!dbTest) {
      console.error('❌ Database connection test failed');
      return false;
    }

    // اختبار إعدادات التطبيق
    const settingsTest = await testAppSettings();
    if (!settingsTest) {
      console.error('❌ App settings test failed');
      return false;
    }

    // إصلاح المحرك الافتراضي
    const engineFix = await fixTranscriptionEngine();
    if (!engineFix) {
      console.error('❌ Transcription engine fix failed');
      return false;
    }

    console.log('✅ All web issues fixed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error during web issues fix:', error);
    return false;
  }
}

// تصدير العميل المحسن
export const webSupabase = createWebSupabaseClient(); 