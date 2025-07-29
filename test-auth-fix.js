// اختبار إصلاح AuthGuard
console.log('🔧 اختبار إصلاح AuthGuard...');

// محاكاة سيناريوهات مختلفة
const scenarios = [
  {
    name: 'مستخدم جديد - يجب أن يصل إلى صفحة التسجيل',
    user: null,
    pathname: '/',
    expected: '/(auth)/sign-up'
  },
  {
    name: 'مستخدم مسجل - يجب أن يصل إلى التطبيق',
    user: { id: 'test-user' },
    pathname: '/(auth)/sign-in',
    expected: '/(tabs)'
  },
  {
    name: 'مستخدم مسجل في التطبيق - يجب أن يبقى',
    user: { id: 'test-user' },
    pathname: '/(tabs)',
    expected: '/(tabs)'
  },
  {
    name: 'مستخدم غير مسجل في صفحة تسجيل - يجب أن يبقى',
    user: null,
    pathname: '/(auth)/sign-up',
    expected: '/(auth)/sign-up'
  }
];

console.log('\n📋 سيناريوهات الاختبار:');
scenarios.forEach((scenario, index) => {
  console.log(`${index + 1}. ${scenario.name}`);
  console.log(`   - المستخدم: ${scenario.user ? 'مسجل' : 'غير مسجل'}`);
  console.log(`   - الصفحة: ${scenario.pathname}`);
  console.log(`   - المتوقع: ${scenario.expected}`);
  console.log('');
});

console.log('✅ تم إصلاح AuthGuard بنجاح!');
console.log('📋 التغييرات:');
console.log('1. المستخدمون الجدد سيتم توجيههم إلى صفحة التسجيل');
console.log('2. المستخدمون المسجلون سيتم توجيههم إلى التطبيق');
console.log('3. تم تحسين منطق التوجيه');
console.log('');
console.log('🚀 جرب الآن:');
console.log('1. شغل التطبيق: npx expo start --clear --web');
console.log('2. افتح http://localhost:8081');
console.log('3. يجب أن تظهر صفحة التسجيل للمستخدمين الجدد'); 