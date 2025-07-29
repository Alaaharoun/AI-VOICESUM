// إصلاح مشكلة تسجيل الدخول في الويب
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

async function fixWebLogin() {
  console.log('🔧 إصلاح مشكلة تسجيل الدخول في الويب...\n');

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
      console.log('✅ المستخدم مسجل دخول بالفعل');
      console.log(`   - User ID: ${session.user.id}`);
      console.log(`   - Email: ${session.user.email}`);
      return;
    } else {
      console.log('❌ لا يوجد مستخدم مسجل دخول');
    }

    // محاولة تسجيل الدخول كضيف أو إنشاء حساب تجريبي
    console.log('\n2️⃣ محاولة تسجيل الدخول...');
    
    // إنشاء حساب تجريبي
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    
    console.log(`   - إنشاء حساب تجريبي: ${testEmail}`);
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (signUpError) {
      console.error('❌ خطأ في إنشاء الحساب:', signUpError.message);
      
      // محاولة تسجيل الدخول بحساب موجود
      console.log('\n3️⃣ محاولة تسجيل الدخول بحساب موجود...');
      
      // البحث عن مستخدم موجود
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, email')
        .limit(1);

      if (usersError) {
        console.error('❌ خطأ في البحث عن المستخدمين:', usersError.message);
      } else if (users && users.length > 0) {
        console.log(`   - العثور على مستخدم: ${users[0].email}`);
        console.log('   - يرجى تسجيل الدخول يدوياً في التطبيق');
      } else {
        console.log('   - لا يوجد مستخدمين في قاعدة البيانات');
      }
    } else {
      console.log('✅ تم إنشاء الحساب التجريبي بنجاح');
      console.log(`   - User ID: ${signUpData.user?.id}`);
      console.log(`   - Email: ${signUpData.user?.email}`);
      
      // إضافة اشتراك تجريبي
      console.log('\n4️⃣ إضافة اشتراك تجريبي...');
      
      const { error: subError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: signUpData.user?.id,
          subscription_type: 'free_trial',
          active: true,
          expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // يومين
          usage_seconds: 0
        });

      if (subError) {
        console.error('❌ خطأ في إضافة الاشتراك:', subError.message);
      } else {
        console.log('✅ تم إضافة الاشتراك التجريبي بنجاح');
      }
    }

  } catch (error) {
    console.error('❌ خطأ عام:', error.message);
  }
}

// تشغيل الإصلاح
if (require.main === module) {
  fixWebLogin();
}

module.exports = { fixWebLogin }; 