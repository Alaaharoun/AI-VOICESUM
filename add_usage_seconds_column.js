const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('يرجى ضبط EXPO_PUBLIC_SUPABASE_URL أو SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في متغيرات البيئة');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function addUsageSecondsColumn() {
  try {
    // تنفيذ أمر SQL لإضافة العمود إذا لم يكن موجودًا
    const { error } = await supabase.rpc('execute_sql', {
      sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='usage_seconds') THEN ALTER TABLE user_subscriptions ADD COLUMN usage_seconds integer DEFAULT 0; END IF; END $$;`
    });
    if (error) {
      console.error('حدث خطأ أثناء تنفيذ أمر ALTER TABLE:', error);
    } else {
      console.log('تمت إضافة العمود usage_seconds بنجاح (أو هو موجود بالفعل)');
    }
  } catch (err) {
    console.error('خطأ غير متوقع:', err);
  }
}

addUsageSecondsColumn(); 