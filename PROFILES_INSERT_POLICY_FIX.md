# 🔧 إصلاح مشكلة تسجيل المستخدمين الجدد

## 🚨 المشكلة
بعد حذف المستخدم من التطبيق، لا يمكن إعادة التسجيل بنفس البريد الإلكتروني أو أي بريد إلكتروني جديد، ويظهر خطأ:
```
"Database error saving new user"
```

## 🔍 سبب المشكلة
المشكلة في **سياسة INSERT** لجدول `profiles` في Supabase. عند تسجيل مستخدم جديد:

1. يتم إنشاء الحساب في `auth.users`
2. يحاول الكود إنشاء profile في جدول `profiles`
3. **لا توجد سياسة INSERT** تسمح للمستخدمين بإنشاء profile لأنفسهم
4. يفشل التسجيل مع رسالة خطأ عامة

## ✅ الحل المطبق

### 1. إنشاء Migration جديد
تم إنشاء ملف `supabase/migrations/20250705220000_fix_profiles_insert_policy.sql` يحتوي على:

```sql
-- السياسة المفقودة التي كانت تسبب الخطأ
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
```

### 2. السياسات المطلوبة لجدول profiles
- ✅ **SELECT**: عرض profile المستخدم
- ✅ **UPDATE**: تحديث profile المستخدم  
- ✅ **INSERT**: إنشاء profile جديد (كانت مفقودة)

## 🚀 خطوات التطبيق

### 1. تطبيق Migration
```bash
# في Supabase Dashboard
# اذهب إلى SQL Editor
# نفذ الملف: 20250705220000_fix_profiles_insert_policy.sql
```

### 2. اختبار التسجيل
```bash
# جرب تسجيل مستخدم جديد
# يجب أن يعمل بدون أخطاء
```

## 📊 التحقق من الإصلاح

### 1. فحص السياسات
```sql
-- تحقق من وجود جميع السياسات المطلوبة
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'profiles';
```

### 2. اختبار التسجيل
- ✅ تسجيل مستخدم جديد
- ✅ إنشاء profile تلقائياً
- ✅ تسجيل الدخول بنجاح

## 🔧 الكود المتأثر

### في `contexts/AuthContext.tsx`:
```typescript
const signUp = async (email: string, password: string) => {
  // ... إنشاء الحساب
  if (!result.error && result.data?.user) {
    const user = result.data.user;
    try {
      // هذا السطر كان يفشل بسبب عدم وجود سياسة INSERT
      const { error: profileError } = await supabase.from('profiles').insert([
        {
          id: user.id,
          full_name: '',
          avatar_url: ''
        }
      ]);
      // الآن سيعمل بنجاح
    } catch (profileInsertError) {
      console.error('[AuthContext] Exception creating profile after sign up:', profileInsertError);
    }
  }
};
```

## 🎯 النتيجة المتوقعة

بعد تطبيق الإصلاح:
- ✅ **تسجيل مستخدمين جدد** يعمل بدون أخطاء
- ✅ **إعادة التسجيل** بعد حذف الحساب يعمل
- ✅ **إنشاء profile** تلقائياً لكل مستخدم جديد
- ✅ **تسجيل الدخول** يعمل بشكل طبيعي

## 📝 ملاحظات مهمة

1. **RLS (Row Level Security)** مفعل على جدول `profiles`
2. **السياسات مطلوبة** لجميع العمليات (SELECT, INSERT, UPDATE)
3. **المستخدمين الجدد** يحتاجون صلاحية إنشاء profile لأنفسهم
4. **Superadmin** لديه صلاحيات كاملة على جميع profiles

## 🔍 استكشاف الأخطاء

إذا استمرت المشكلة:
1. تحقق من تطبيق Migration بنجاح
2. تحقق من وجود السياسات في Supabase Dashboard
3. راجع سجلات الأخطاء في Supabase
4. تأكد من أن RLS مفعل على جدول `profiles` 