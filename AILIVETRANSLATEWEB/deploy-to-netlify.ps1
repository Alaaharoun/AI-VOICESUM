# سكريبت النشر على Netlify - الخطوات الكاملة
Write-Host "🚀 بدء عملية النشر على Netlify..." -ForegroundColor Green

# الخطوة 1: التحقق من وجود الملفات المطلوبة
Write-Host "📋 التحقق من الملفات المطلوبة..." -ForegroundColor Yellow

if (Test-Path "netlify.toml") {
    Write-Host "✅ ملف netlify.toml موجود" -ForegroundColor Green
} else {
    Write-Host "❌ ملف netlify.toml غير موجود" -ForegroundColor Red
    exit 1
}

if (Test-Path "public/_redirects") {
    Write-Host "✅ ملف public/_redirects موجود" -ForegroundColor Green
} else {
    Write-Host "❌ ملف public/_redirects غير موجود" -ForegroundColor Red
    exit 1
}

# الخطوة 2: بناء المشروع
Write-Host "🔨 بناء المشروع..." -ForegroundColor Yellow
try {
    npm run build
    Write-Host "✅ تم بناء المشروع بنجاح" -ForegroundColor Green
} catch {
    Write-Host "❌ فشل في بناء المشروع" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

# الخطوة 3: التحقق من وجود مجلد dist
if (Test-Path "dist") {
    Write-Host "✅ مجلد dist موجود" -ForegroundColor Green
} else {
    Write-Host "❌ مجلد dist غير موجود" -ForegroundColor Red
    exit 1
}

# الخطوة 4: إعداد Git (إذا لم يكن موجود)
if (-not (Test-Path ".git")) {
    Write-Host "🔧 إعداد Git..." -ForegroundColor Yellow
    git init
    Write-Host "✅ تم إعداد Git" -ForegroundColor Green
}

# الخطوة 5: إضافة الملفات إلى Git
Write-Host "📁 إضافة الملفات إلى Git..." -ForegroundColor Yellow
git add .
git commit -m "Deploy to Netlify - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "✅ تم إضافة الملفات إلى Git" -ForegroundColor Green

# الخطوة 6: التحقق من وجود remote repository
$remoteUrl = git remote get-url origin 2>$null
if ($remoteUrl) {
    Write-Host "✅ Remote repository موجود: $remoteUrl" -ForegroundColor Green
} else {
    Write-Host "⚠️  لا يوجد remote repository" -ForegroundColor Yellow
    Write-Host "📝 يرجى إضافة remote repository يدوياً:" -ForegroundColor Cyan
    Write-Host "git remote add origin YOUR_REPOSITORY_URL" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "🎉 تم إكمال الخطوات المحلية!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 الخطوات التالية:" -ForegroundColor Cyan
Write-Host "1. ارفع الكود إلى GitHub/GitLab" -ForegroundColor White
Write-Host "2. اربط المشروع بـ Netlify" -ForegroundColor White
Write-Host "3. اضبط متغيرات البيئة في Netlify" -ForegroundColor White
Write-Host ""
Write-Host "🔗 رابط النشر: https://app.netlify.com/" -ForegroundColor Magenta 