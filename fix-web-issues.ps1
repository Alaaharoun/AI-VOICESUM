# إصلاح مشاكل الويب - Live Translate
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   إصلاح مشاكل الويب - Live Translate" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] فحص متغيرات البيئة..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "❌ ملف .env غير موجود" -ForegroundColor Red
    Write-Host "يرجى إنشاء ملف .env مع متغيرات Supabase" -ForegroundColor Red
    Read-Host "اضغط Enter للخروج"
    exit 1
}

Write-Host "✅ ملف .env موجود" -ForegroundColor Green

Write-Host ""
Write-Host "[2/4] اختبار الاتصال بقاعدة البيانات..." -ForegroundColor Yellow
node fix_web_connection.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ فشل اختبار الاتصال" -ForegroundColor Red
    Write-Host "يرجى تطبيق SQL fix في Supabase Dashboard" -ForegroundColor Red
    Read-Host "اضغط Enter للخروج"
    exit 1
}

Write-Host "✅ اختبار الاتصال نجح" -ForegroundColor Green

Write-Host ""
Write-Host "[3/4] تنظيف الكاش..." -ForegroundColor Yellow
npx expo start --clear --web --port 8081
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ فشل في تشغيل التطبيق" -ForegroundColor Red
    Read-Host "اضغط Enter للخروج"
    exit 1
}

Write-Host ""
Write-Host "[4/4] إعادة تشغيل التطبيق..." -ForegroundColor Yellow
Write-Host "✅ التطبيق يعمل على http://localhost:8081" -ForegroundColor Green
Write-Host ""
Write-Host "📋 للتحقق من الإصلاح:" -ForegroundColor Cyan
Write-Host "1. افتح المتصفح على http://localhost:8081" -ForegroundColor White
Write-Host "2. تأكد من ظهور صفحة التسجيل" -ForegroundColor White
Write-Host "3. تحقق من Console (F12) للتأكد من عدم وجود أخطاء" -ForegroundColor White
Write-Host ""
Write-Host "🎯 إذا استمرت المشكلة:" -ForegroundColor Cyan
Write-Host "- اذهب إلى Supabase Dashboard > SQL Editor" -ForegroundColor White
Write-Host "- انسخ محتوى fix_web_white_screen.sql" -ForegroundColor White
Write-Host "- الصق الكود واضغط Run" -ForegroundColor White
Write-Host ""
Read-Host "اضغط Enter للخروج" 