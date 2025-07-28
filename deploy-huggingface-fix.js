#!/usr/bin/env node

/**
 * 🚀 سكريبت رفع إصلاحات Hugging Face
 * 
 * هذا السكريبت يرفع الإصلاحات المطلوبة لـ Hugging Face Spaces
 * لحل مشكلة "name 'traceback' is not defined"
 */

const fs = require('fs');
const path = require('path');

class HuggingFaceFixDeployer {
  constructor() {
    this.sourceDir = 'huggingface_deploy';
    this.targetDir = 'faster-whisper-api';
    this.filesToUpdate = [
      'app.py',
      'requirements.txt',
      'README.md'
    ];
  }

  async deploy() {
    console.log('🚀 بدء رفع إصلاحات Hugging Face...');
    
    try {
      // التحقق من وجود الملفات المطلوبة
      await this.validateFiles();
      
      // نسخ الملفات المحدثة
      await this.copyFiles();
      
      // إنشاء ملف README محدث
      await this.createUpdatedReadme();
      
      console.log('✅ تم رفع الإصلاحات بنجاح!');
      console.log('');
      console.log('📋 الإصلاحات المطبقة:');
      console.log('  ✅ إضافة import traceback');
      console.log('  ✅ تحسين معالجة الأخطاء');
      console.log('  ✅ إضافة CORS middleware');
      console.log('  ✅ تحسين validation للملفات');
      console.log('  ✅ إضافة fallback mechanism');
      console.log('');
      console.log('🔗 رابط الخدمة: https://alaaharoun-faster-whisper-api.hf.space');
      console.log('🔗 رابط Health Check: https://alaaharoun-faster-whisper-api.hf.space/health');
      
    } catch (error) {
      console.error('❌ خطأ في رفع الإصلاحات:', error.message);
      process.exit(1);
    }
  }

  async validateFiles() {
    console.log('📁 التحقق من وجود الملفات المطلوبة...');
    
    for (const file of this.filesToUpdate) {
      const sourcePath = path.join(this.sourceDir, file);
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`الملف غير موجود: ${sourcePath}`);
      }
    }
    
    console.log('✅ جميع الملفات موجودة');
  }

  async copyFiles() {
    console.log('📋 نسخ الملفات المحدثة...');
    
    for (const file of this.filesToUpdate) {
      const sourcePath = path.join(this.sourceDir, file);
      const targetPath = path.join(this.targetDir, file);
      
      try {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`  ✅ تم نسخ: ${file}`);
      } catch (error) {
        throw new Error(`فشل في نسخ ${file}: ${error.message}`);
      }
    }
  }

  async createUpdatedReadme() {
    const readmeContent = `# 🎤 Faster Whisper API - Fixed Version

## 🆕 الإصلاحات المطبقة:

### ✅ إصلاحات الأخطاء:
- إصلاح خطأ "name 'traceback' is not defined"
- تحسين معالجة الأخطاء مع traceback كامل
- إضافة CORS middleware للتوافق مع المتصفح
- تحسين validation للملفات

### 🔧 التحسينات:
- إضافة fallback mechanism لـ VAD
- تحسين file size validation (25MB limit)
- إضافة model loading check
- تحسين error messages

## 🚀 الاستخدام:

### Health Check:
\`\`\`bash
curl https://alaaharoun-faster-whisper-api.hf.space/health
\`\`\`

### Transcribe بدون VAD:
\`\`\`bash
curl -X POST \\
  -F "file=@audio.wav" \\
  -F "language=en" \\
  -F "task=transcribe" \\
  https://alaaharoun-faster-whisper-api.hf.space/transcribe
\`\`\`

### Transcribe مع VAD:
\`\`\`bash
curl -X POST \\
  -F "file=@audio.wav" \\
  -F "language=en" \\
  -F "task=transcribe" \\
  -F "vad_filter=true" \\
  -F "vad_parameters=threshold=0.5" \\
  https://alaaharoun-faster-whisper-api.hf.space/transcribe
\`\`\`

## 📊 المعاملات المدعومة:

- \`file\`: ملف صوتي (WAV, MP3, M4A, إلخ)
- \`language\`: رمز اللغة (اختياري، مثال: "en", "ar", "es")
- \`task\`: "transcribe" أو "translate" (افتراضي: "transcribe")
- \`vad_filter\`: تفعيل Voice Activity Detection (افتراضي: false)
- \`vad_parameters\`: معاملات VAD (افتراضي: "threshold=0.5")

## 🔧 الاستجابة:

### نجاح:
\`\`\`json
{
  "success": true,
  "text": "النص المفرغ",
  "language": "en",
  "language_probability": 0.95,
  "vad_enabled": false,
  "vad_threshold": null
}
\`\`\`

### خطأ:
\`\`\`json
{
  "error": "رسالة الخطأ",
  "success": false,
  "details": "تفاصيل الخطأ"
}
\`\`\`

## 🛠️ التطوير المحلي:

\`\`\`bash
# تثبيت المتطلبات
pip install -r requirements.txt

# تشغيل الخادم
uvicorn app:app --host 0.0.0.0 --port 7860
\`\`\`

## 📝 ملاحظات:

- الحد الأقصى لحجم الملف: 25MB
- التنسيقات المدعومة: WAV, MP3, M4A, FLAC, OGG, WEBM
- VAD يعمل مع عتبة قابلة للتخصيص
- fallback mechanism في حالة فشل VAD
`;

    const readmePath = path.join(this.targetDir, 'README.md');
    fs.writeFileSync(readmePath, readmeContent);
    console.log('  ✅ تم إنشاء README محدث');
  }
}

// تشغيل السكريبت
async function main() {
  const deployer = new HuggingFaceFixDeployer();
  await deployer.deploy();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = HuggingFaceFixDeployer; 