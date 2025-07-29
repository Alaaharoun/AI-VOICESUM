// فحص حالة المستخدم في Supabase
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

async function checkUserStatus() {
  console.log('🔍 فحص حالة المستخدم في Supabase...\n');

  const envVars = loadEnvFile();
  const supabaseUrl = envVars.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = envVars.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ متغيرات Supabase مفقودة');
    return;
  }

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
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    }
  });

  try {
    // فحص الجلسة الحالية
    console.log('1️⃣ فحص الجلسة الحالية...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ خطأ في فحص الجلسة:', sessionError.message);
    } else if (session) {
      console.log('✅ المستخدم مسجل دخول');
      console.log(`   - User ID: ${session.user.id}`);
      console.log(`   - Email: ${session.user.email}`);
      console.log(`   - Created: ${session.user.created_at}`);
    } else {
      console.log('❌ لا يوجد مستخدم مسجل دخول');
    }

    // فحص المستخدمين في قاعدة البيانات
    console.log('\n2️⃣ فحص المستخدمين في قاعدة البيانات...');
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .limit(5);

    if (usersError) {
      console.error('❌ خطأ في فحص المستخدمين:', usersError.message);
    } else {
      console.log(`✅ تم العثور على ${users.length} مستخدمين`);
      users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (${user.full_name || 'No name'})`);
      });
    }

    // فحص المشتركين
    console.log('\n3️⃣ فحص المشتركين...');
    const { data: subscriptions, error: subsError } = await supabase
      .from('user_subscriptions')
      .select('id, user_id, subscription_type, active, expires_at')
      .limit(5);

    if (subsError) {
      console.error('❌ خطأ في فحص المشتركين:', subsError.message);
    } else {
      console.log(`✅ تم العثور على ${subscriptions.length} مشترك`);
      subscriptions.forEach((sub, index) => {
        const status = sub.active ? '✅ نشط' : '❌ غير نشط';
        console.log(`   ${index + 1}. ${sub.subscription_type} - ${status} - ينتهي: ${sub.expires_at}`);
      });
    }

    // فحص إعدادات التطبيق
    console.log('\n4️⃣ فحص إعدادات التطبيق...');
    const { data: appSettings, error: settingsError } = await supabase
      .from('app_settings')
      .select('*');

    if (settingsError) {
      console.error('❌ خطأ في فحص إعدادات التطبيق:', settingsError.message);
    } else if (appSettings && appSettings.length > 0) {
      console.log('✅ إعدادات التطبيق موجودة');
      appSettings.forEach(setting => {
        console.log(`   - ${setting.key}: ${setting.value}`);
      });
    } else {
      console.log('❌ لا توجد إعدادات تطبيق');
    }

  } catch (error) {
    console.error('❌ خطأ عام:', error.message);
  }
}

// تشغيل الفحص
if (require.main === module) {
  checkUserStatus();
}

module.exports = { checkUserStatus }; 