#!/bin/bash

echo "========================================"
echo "   إصلاح مشاكل الويب - Live Translate"
echo "========================================"
echo

echo "[1/4] فحص متغيرات البيئة..."
if [ ! -f ".env" ]; then
    echo "❌ ملف .env غير موجود"
    echo "يرجى إنشاء ملف .env مع متغيرات Supabase"
    exit 1
fi

echo "✅ ملف .env موجود"

echo
echo "[2/4] اختبار الاتصال بقاعدة البيانات..."
node fix_web_connection.js
if [ $? -ne 0 ]; then
    echo "❌ فشل اختبار الاتصال"
    echo "يرجى تطبيق SQL fix في Supabase Dashboard"
    exit 1
fi

echo "✅ اختبار الاتصال نجح"

echo
echo "[3/4] تنظيف الكاش..."
npx expo start --clear --web --port 8081
if [ $? -ne 0 ]; then
    echo "❌ فشل في تشغيل التطبيق"
    exit 1
fi

echo
echo "[4/4] إعادة تشغيل التطبيق..."
echo "✅ التطبيق يعمل على http://localhost:8081"
echo
echo "📋 للتحقق من الإصلاح:"
echo "1. افتح المتصفح على http://localhost:8081"
echo "2. تأكد من ظهور صفحة التسجيل"
echo "3. تحقق من Console (F12) للتأكد من عدم وجود أخطاء"
echo
echo "🎯 إذا استمرت المشكلة:"
echo "- اذهب إلى Supabase Dashboard > SQL Editor"
echo "- انسخ محتوى fix_web_white_screen.sql"
echo "- الصق الكود واضغط Run"
echo 