// اختبار سريع لإصلاح AuthGuard الجديد
console.log('🔧 اختبار سريع لإصلاح AuthGuard الجديد...');

// محاكاة السيناريو الحالي
const currentScenario = {
  user: { id: '1881823d-1a1d-4946-9c7a-e296067dbca8' }, // مستخدم مسجل
  pathname: '/', // الصفحة الرئيسية
  loading: false
};

console.log('\n📋 السيناريو الحالي:');
console.log(`- المستخدم: ${currentScenario.user ? 'مسجل' : 'غير مسجل'}`);
console.log(`- الصفحة: ${currentScenario.pathname}`);
console.log(`- التحميل: ${currentScenario.loading}`);

// محاكاة منطق AuthGuard الجديد
function simulateAuthGuard(user, pathname, loading) {
  if (loading) {
    return 'loading';
  }
  
  console.log('[AuthGuard] Checking auth state:', { user: !!user, pathname });
  
  // إذا كان المستخدم موجود وليس في صفحة auth، السماح بالوصول إلى التطبيق
  if (user && !pathname.startsWith('/(auth)')) {
    console.log('[AuthGuard] User authenticated and on app pages, allowing access...');
    return 'allow_app_access';
  }
  
  // إذا كان المستخدم موجود وفي صفحة auth، توجيه إلى التطبيق
  if (user && pathname.startsWith('/(auth)')) {
    console.log('[AuthGuard] User authenticated, redirecting to tabs...');
    return 'redirect_to_tabs';
  }
  
  // إذا كان المستخدم غير موجود وليس في صفحة auth، توجيه إلى التسجيل
  if (!user && !pathname.startsWith('/(auth)')) {
    console.log('[AuthGuard] No user found, redirecting to sign-up...');
    return 'redirect_to_signup';
  }
  
  // إذا كان المستخدم غير موجود وفي صفحة auth، السماح بالوصول
  if (!user && pathname.startsWith('/(auth)')) {
    console.log('[AuthGuard] No user and on auth pages, allowing access...');
    return 'allow_auth_access';
  }
  
  return 'unknown';
}

const result = simulateAuthGuard(currentScenario.user, currentScenario.pathname, currentScenario.loading);

console.log('\n✅ النتيجة المتوقعة:');
console.log(`- الإجراء: ${result}`);
console.log(`- التفسير: المستخدم مسجل وفي الصفحة الرئيسية، يجب السماح بالوصول`);

console.log('\n📋 التغييرات المطبقة:');
console.log('1. إضافة logging مفصل لـ AuthGuard');
console.log('2. تحسين منطق التوجيه');
console.log('3. السماح بالوصول في جميع الحالات');
console.log('4. التوجيه يتم في useEffect فقط');

console.log('\n🚀 جرب الآن:');
console.log('1. أعد تشغيل التطبيق');
console.log('2. افتح http://localhost:8081');
console.log('3. تحقق من Console لرؤية رسائل AuthGuard'); 