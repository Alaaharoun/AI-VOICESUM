const fs = require('fs');
const path = require('path');

console.log('🔍 فحص إعداد Netlify...\n');

// التحقق من الملفات المطلوبة
const requiredFiles = [
    'netlify.toml',
    'public/_redirects',
    'package.json'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} موجود`);
    } else {
        console.log(`❌ ${file} غير موجود`);
        allFilesExist = false;
    }
});

console.log('');

// التحقق من محتوى netlify.toml
if (fs.existsSync('netlify.toml')) {
    const netlifyContent = fs.readFileSync('netlify.toml', 'utf8');
    const hasBuildCommand = netlifyContent.includes('npm run build');
    const hasPublishDir = netlifyContent.includes('dist');
    const hasRedirects = netlifyContent.includes('redirects');
    
    console.log('📋 فحص محتوى netlify.toml:');
    console.log(`  - Build command: ${hasBuildCommand ? '✅' : '❌'}`);
    console.log(`  - Publish directory: ${hasPublishDir ? '✅' : '❌'}`);
    console.log(`  - Redirects: ${hasRedirects ? '✅' : '❌'}`);
}

console.log('');

// التحقق من محتوى _redirects
if (fs.existsSync('public/_redirects')) {
    const redirectsContent = fs.readFileSync('public/_redirects', 'utf8');
    const hasSPARedirect = redirectsContent.includes('/*') && redirectsContent.includes('/index.html');
    
    console.log('📋 فحص محتوى _redirects:');
    console.log(`  - SPA redirect: ${hasSPARedirect ? '✅' : '❌'}`);
}

console.log('');

// التحقق من package.json
if (fs.existsSync('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const hasBuildScript = packageJson.scripts && packageJson.scripts.build;
    
    console.log('📋 فحص package.json:');
    console.log(`  - Build script: ${hasBuildScript ? '✅' : '❌'}`);
    if (hasBuildScript) {
        console.log(`  - Build command: ${packageJson.scripts.build}`);
    }
}

console.log('');

// التحقق من وجود node_modules
if (fs.existsSync('node_modules')) {
    console.log('✅ node_modules موجود');
} else {
    console.log('⚠️  node_modules غير موجود - قم بتشغيل npm install');
}

console.log('');

// محاولة بناء المشروع
console.log('🔨 اختبار البناء...');
const { execSync } = require('child_process');

try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ البناء نجح!');
    
    if (fs.existsSync('dist')) {
        const distFiles = fs.readdirSync('dist');
        console.log(`📁 مجلد dist يحتوي على ${distFiles.length} ملف/ملفات`);
    }
} catch (error) {
    console.log('❌ فشل في البناء');
    console.log('💡 تأكد من تشغيل npm install أولاً');
}

console.log('\n🎯 ملخص الإعداد:');
if (allFilesExist) {
    console.log('✅ جميع الملفات المطلوبة موجودة');
    console.log('✅ جاهز للنشر على Netlify');
} else {
    console.log('❌ بعض الملفات مفقودة');
    console.log('💡 راجع الملفات المفقودة أعلاه');
} 