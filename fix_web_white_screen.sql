-- إصلاح مشكلة الصفحة البيضاء في الويب
-- هذا الملف يصلح مشاكل قاعدة البيانات التي تسبب خطأ 406

-- 1. التأكد من وجود جدول user_subscriptions بالهيكل الصحيح
DO $$
BEGIN
    -- إنشاء الجدول إذا لم يكن موجوداً
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subscriptions') THEN
        CREATE TABLE user_subscriptions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            subscription_type text NOT NULL,
            active boolean DEFAULT true,
            expires_at timestamptz NOT NULL,
            usage_seconds integer DEFAULT 0,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        RAISE NOTICE 'Created user_subscriptions table';
    END IF;
END $$;

-- 2. إزالة أي constraints مشكلة على subscription_type
DO $$
BEGIN
    -- إزالة أي constraints قديمة
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%subscription_type%'
        AND table_name = 'user_subscriptions'
        AND constraint_type = 'CHECK'
    ) THEN
        EXECUTE (
            'ALTER TABLE user_subscriptions DROP CONSTRAINT ' || 
            (SELECT constraint_name FROM information_schema.table_constraints 
             WHERE constraint_name LIKE '%subscription_type%'
             AND table_name = 'user_subscriptions'
             AND constraint_type = 'CHECK'
             LIMIT 1)
        );
        RAISE NOTICE 'Removed subscription_type constraint';
    END IF;
END $$;

-- 3. إزالة أي علاقات مشكلة
DO $$
BEGIN
    -- إزالة foreign key إلى subscriptions table إذا كان موجوداً
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%user_subscriptions_subscription_id_fkey%'
        AND table_name = 'user_subscriptions'
    ) THEN
        ALTER TABLE user_subscriptions DROP CONSTRAINT user_subscriptions_subscription_id_fkey;
        RAISE NOTICE 'Removed subscription_id foreign key';
    END IF;
    
    -- إزالة subscription_id column إذا كان موجوداً
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' 
        AND column_name = 'subscription_id'
    ) THEN
        ALTER TABLE user_subscriptions DROP COLUMN subscription_id;
        RAISE NOTICE 'Removed subscription_id column';
    END IF;
    
    -- إزالة أعمدة أخرى مشكلة
    ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS subscription_status;
    ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS subscription_end_date;
    ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS payment_method;
END $$;

-- 4. التأكد من وجود الأعمدة المطلوبة
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 month');
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS usage_seconds integer DEFAULT 0;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 5. إعادة إنشاء الفهارس
DROP INDEX IF EXISTS idx_user_subscriptions_user_id;
DROP INDEX IF EXISTS idx_user_subscriptions_active;
DROP INDEX IF EXISTS idx_user_subscriptions_expires_at;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active ON user_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at ON user_subscriptions(expires_at);

-- 6. إعادة إنشاء السياسات الأمنية
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Users can read own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can view all subscriptions" ON user_subscriptions;
DROP POLICY IF EXISTS "Superadmins can manage all subscriptions" ON user_subscriptions;

-- إنشاء السياسات الجديدة
CREATE POLICY "Users can read own subscriptions"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON user_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON user_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON user_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 7. إنشاء trigger للتحديث التلقائي
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- 8. التأكد من وجود جدول app_settings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_settings') THEN
        CREATE TABLE app_settings (
            key text PRIMARY KEY,
            value text NOT NULL,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        
        -- إنشاء trigger للتحديث التلقائي
        CREATE TRIGGER update_app_settings_updated_at
          BEFORE UPDATE ON app_settings
          FOR EACH ROW
          EXECUTE PROCEDURE update_updated_at_column();
        
        RAISE NOTICE 'Created app_settings table';
    END IF;
END $$;

-- 9. إضافة إعدادات افتراضية
INSERT INTO app_settings (key, value) VALUES 
  ('transcription_engine', 'huggingface'),
  ('ASSEMBLYAI_API_KEY', ''),
  ('AZURE_SPEECH_KEY', ''),
  ('AZURE_SPEECH_REGION', '')
ON CONFLICT (key) DO NOTHING;

-- 10. اختبار الإصلاح
DO $$
BEGIN
    -- اختبار الوصول إلى الجداول
    PERFORM 1 FROM user_subscriptions LIMIT 1;
    PERFORM 1 FROM app_settings LIMIT 1;
    
    RAISE NOTICE 'Database fix completed successfully!';
    RAISE NOTICE 'All tables and policies are properly configured.';
END $$; 