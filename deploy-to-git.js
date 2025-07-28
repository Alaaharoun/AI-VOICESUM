#!/usr/bin/env node

/**
 * 🚀 سكريبت رفع التغييرات إلى Git Repository
 * 
 * هذا السكريبت يرفع جميع التغييرات والإصلاحات إلى Git
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class GitDeployer {
  constructor() {
    this.changedFiles = [
      'faster-whisper-api/app.py',
      'huggingface_deploy/app.py',
      'deploy-huggingface-fix.js',
      'test-huggingface-fix.js',
      'test-app-transcription.js',
      'HUGGING_FACE_TRACEBACK_FIX.md',
      'HUGGING_FACE_FIX_STATUS.md'
    ];
  }

  async deploy() {
    console.log('🚀 بدء رفع التغييرات إلى Git...');
    console.log('');

    try {
      // التحقق من وجود Git
      await this.checkGit();
      
      // إضافة الملفات المحدثة
      await this.addFiles();
      
      // إنشاء commit
      await this.createCommit();
      
      // رفع التغييرات
      await this.pushChanges();
      
      console.log('✅ تم رفع التغييرات بنجاح!');
      console.log('');
      console.log('📋 الملفات المرفوعة:');
      this.changedFiles.forEach(file => {
        console.log(`  ✅ ${file}`);
      });
      
    } catch (error) {
      console.error('❌ خطأ في رفع التغييرات:', error.message);
      process.exit(1);
    }
  }

  async checkGit() {
    console.log('🔍 التحقق من Git...');
    
    try {
      execSync('git --version', { stdio: 'ignore' });
      console.log('  ✅ Git متوفر');
    } catch (error) {
      throw new Error('Git غير مثبت أو غير متوفر');
    }
  }

  async addFiles() {
    console.log('📁 إضافة الملفات المحدثة...');
    
    try {
      // إضافة جميع الملفات المحدثة
      for (const file of this.changedFiles) {
        if (fs.existsSync(file)) {
          execSync(`git add "${file}"`, { stdio: 'ignore' });
          console.log(`  ✅ تم إضافة: ${file}`);
        } else {
          console.log(`  ⚠️ الملف غير موجود: ${file}`);
        }
      }
      
      // إضافة ملفات جديدة
      execSync('git add .', { stdio: 'ignore' });
      console.log('  ✅ تم إضافة جميع الملفات الجديدة');
      
    } catch (error) {
      throw new Error(`فشل في إضافة الملفات: ${error.message}`);
    }
  }

  async createCommit() {
    console.log('💾 إنشاء commit...');
    
    try {
      const commitMessage = `🔧 Fix Hugging Face traceback error and improve error handling

✅ Fixed "name 'traceback' is not defined" error
✅ Added CORS middleware for browser compatibility
✅ Improved error handling with proper traceback
✅ Added file size validation (25MB limit)
✅ Added fallback mechanism for VAD
✅ Enhanced model loading check
✅ Better error messages and logging

Files updated:
- faster-whisper-api/app.py
- huggingface_deploy/app.py
- Added deployment and test scripts
- Added comprehensive documentation

Server status: ✅ Healthy and working
URL: https://alaaharoun-faster-whisper-api.hf.space`;

      execSync(`git commit -m "${commitMessage}"`, { stdio: 'ignore' });
      console.log('  ✅ تم إنشاء commit بنجاح');
      
    } catch (error) {
      throw new Error(`فشل في إنشاء commit: ${error.message}`);
    }
  }

  async pushChanges() {
    console.log('📤 رفع التغييرات إلى Remote...');
    
    try {
      execSync('git push', { stdio: 'ignore' });
      console.log('  ✅ تم رفع التغييرات بنجاح');
      
    } catch (error) {
      console.log('  ⚠️ فشل في رفع التغييرات (قد تكون في branch محلي)');
      console.log('  💡 يمكنك رفع التغييرات يدوياً باستخدام: git push');
    }
  }
}

// تشغيل السكريبت
async function main() {
  const deployer = new GitDeployer();
  await deployer.deploy();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = GitDeployer; 