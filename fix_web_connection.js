// إصلاح مشاكل الاتصال في الويب
// هذا الملف يصلح مشاكل Supabase و WebSocket في الويب

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// قراءة ملف .env
function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envVars = {};
      
      envContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            envVars[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
      
      return envVars;
    }
  } catch (error) {
    console.error('Error loading .env file:', error);
  }
  return {};
}

// إعدادات Supabase المحسنة للويب
function createWebSupabaseClient() {
  const envVars = loadEnvFile();
  const supabaseUrl = envVars.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = envVars.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase configuration');
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
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
      }
    });

    console.log('Web Supabase client created successfully');
    return supabase;
  } catch (error) {
    console.error('Failed to create Web Supabase client:', error);
    return null;
  }
}

// اختبار الاتصال بقاعدة البيانات
async function testDatabaseConnection() {
  const supabase = createWebSupabaseClient();
  if (!supabase) {
    console.error('Cannot test connection: Supabase client not available');
    return false;
  }

  try {
    // اختبار الوصول إلى جدول user_subscriptions
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Database connection test failed:', error);
      return false;
    }

    console.log('Database connection test successful');
    return true;
  } catch (error) {
    console.error('Database connection test error:', error);
    return false;
  }
}

// اختبار الوصول إلى app_settings
async function testAppSettings() {
  const supabase = createWebSupabaseClient();
  if (!supabase) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('key', 'transcription_engine')
      .single();

    if (error) {
      console.error('App settings test failed:', error);
      return false;
    }

    console.log('App settings test successful:', data);
    return true;
  } catch (error) {
    console.error('App settings test error:', error);
    return false;
  }
}

// إصلاح إعدادات المحرك الافتراضي
async function fixTranscriptionEngine() {
  const supabase = createWebSupabaseClient();
  if (!supabase) {
    return false;
  }

  try {
    // تحديث المحرك الافتراضي إلى Hugging Face
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'transcription_engine',
        value: 'huggingface'
      }, { onConflict: 'key' });

    if (error) {
      console.error('Failed to update transcription engine:', error);
      return false;
    }

    console.log('Transcription engine updated to Hugging Face');
    return true;
  } catch (error) {
    console.error('Error updating transcription engine:', error);
    return false;
  }
}

// دالة رئيسية لاختبار وإصلاح جميع المشاكل
async function fixWebIssues() {
  console.log('Starting web issues fix...');

  // اختبار الاتصال بقاعدة البيانات
  const dbTest = await testDatabaseConnection();
  if (!dbTest) {
    console.error('Database connection test failed');
    return false;
  }

  // اختبار إعدادات التطبيق
  const settingsTest = await testAppSettings();
  if (!settingsTest) {
    console.error('App settings test failed');
    return false;
  }

  // إصلاح المحرك الافتراضي
  const engineFix = await fixTranscriptionEngine();
  if (!engineFix) {
    console.error('Transcription engine fix failed');
    return false;
  }

  console.log('All web issues fixed successfully!');
  return true;
}

// تصدير الدوال للاستخدام
module.exports = {
  createWebSupabaseClient,
  testDatabaseConnection,
  testAppSettings,
  fixTranscriptionEngine,
  fixWebIssues
};

// تشغيل الإصلاح إذا تم استدعاء الملف مباشرة
if (require.main === module) {
  fixWebIssues().then(success => {
    if (success) {
      console.log('✅ Web issues fixed successfully');
      process.exit(0);
    } else {
      console.error('❌ Failed to fix web issues');
      process.exit(1);
    }
  });
} 