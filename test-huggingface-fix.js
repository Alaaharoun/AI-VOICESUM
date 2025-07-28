#!/usr/bin/env node

/**
 * 🧪 سكريبت اختبار إصلاحات Hugging Face
 * 
 * هذا السكريبت يختبر الإصلاحات المطبقة على Hugging Face
 */

const fs = require('fs');
const path = require('path');

class HuggingFaceFixTester {
  constructor() {
    this.baseUrl = 'https://alaaharoun-faster-whisper-api.hf.space';
    this.testResults = [];
  }

  async testAll() {
    console.log('🧪 بدء اختبار إصلاحات Hugging Face...');
    console.log('');

    try {
      // اختبار Health Check
      await this.testHealthCheck();
      
      // اختبار Root Endpoint
      await this.testRootEndpoint();
      
      // اختبار Transcribe (بدون ملف)
      await this.testTranscribeWithoutFile();
      
      // اختبار Error Handling
      await this.testErrorHandling();
      
      // عرض النتائج
      this.displayResults();
      
    } catch (error) {
      console.error('❌ خطأ في الاختبار:', error.message);
      process.exit(1);
    }
  }

  async testHealthCheck() {
    console.log('🔍 اختبار Health Check...');
    
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      
      if (response.ok && data.status === 'healthy') {
        console.log('  ✅ Health Check نجح');
        this.testResults.push({
          test: 'Health Check',
          status: 'PASS',
          details: data
        });
      } else {
        console.log('  ❌ Health Check فشل');
        this.testResults.push({
          test: 'Health Check',
          status: 'FAIL',
          details: data
        });
      }
    } catch (error) {
      console.log('  ❌ Health Check فشل:', error.message);
      this.testResults.push({
        test: 'Health Check',
        status: 'ERROR',
        details: error.message
      });
    }
  }

  async testRootEndpoint() {
    console.log('🔍 اختبار Root Endpoint...');
    
    try {
      const response = await fetch(`${this.baseUrl}/`);
      const data = await response.json();
      
      if (response.ok && data.message) {
        console.log('  ✅ Root Endpoint نجح');
        this.testResults.push({
          test: 'Root Endpoint',
          status: 'PASS',
          details: data
        });
      } else {
        console.log('  ❌ Root Endpoint فشل');
        this.testResults.push({
          test: 'Root Endpoint',
          status: 'FAIL',
          details: data
        });
      }
    } catch (error) {
      console.log('  ❌ Root Endpoint فشل:', error.message);
      this.testResults.push({
        test: 'Root Endpoint',
        status: 'ERROR',
        details: error.message
      });
    }
  }

  async testTranscribeWithoutFile() {
    console.log('🔍 اختبار Transcribe بدون ملف...');
    
    try {
      const formData = new FormData();
      // إرسال طلب بدون ملف لاختبار معالجة الخطأ
      
      const response = await fetch(`${this.baseUrl}/transcribe`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (response.status === 400 && data.error && data.success === false) {
        console.log('  ✅ معالجة الخطأ نجحت');
        this.testResults.push({
          test: 'Error Handling',
          status: 'PASS',
          details: data
        });
      } else {
        console.log('  ❌ معالجة الخطأ فشلت');
        this.testResults.push({
          test: 'Error Handling',
          status: 'FAIL',
          details: data
        });
      }
    } catch (error) {
      console.log('  ❌ اختبار معالجة الخطأ فشل:', error.message);
      this.testResults.push({
        test: 'Error Handling',
        status: 'ERROR',
        details: error.message
      });
    }
  }

  async testErrorHandling() {
    console.log('🔍 اختبار معالجة الأخطاء...');
    
    try {
      // اختبار إرسال طلب POST فارغ
      const response = await fetch(`${this.baseUrl}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      
      if (response.status === 500 && data.error && data.success === false) {
        console.log('  ✅ معالجة الأخطاء تعمل');
        this.testResults.push({
          test: 'Error Handling',
          status: 'PASS',
          details: 'Proper error handling detected'
        });
      } else {
        console.log('  ❌ معالجة الأخطاء لا تعمل');
        this.testResults.push({
          test: 'Error Handling',
          status: 'FAIL',
          details: data
        });
      }
    } catch (error) {
      console.log('  ❌ اختبار معالجة الأخطاء فشل:', error.message);
      this.testResults.push({
        test: 'Error Handling',
        status: 'ERROR',
        details: error.message
      });
    }
  }

  displayResults() {
    console.log('');
    console.log('📊 نتائج الاختبارات:');
    console.log('');

    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const errors = this.testResults.filter(r => r.status === 'ERROR').length;

    this.testResults.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${status} ${result.test}: ${result.status}`);
    });

    console.log('');
    console.log(`📈 الإحصائيات:`);
    console.log(`  ✅ نجح: ${passed}`);
    console.log(`  ❌ فشل: ${failed}`);
    console.log(`  ⚠️ أخطاء: ${errors}`);
    console.log(`  📊 المجموع: ${this.testResults.length}`);

    if (passed === this.testResults.length) {
      console.log('');
      console.log('🎉 جميع الاختبارات نجحت! الإصلاحات تعمل بشكل صحيح.');
    } else {
      console.log('');
      console.log('⚠️ بعض الاختبارات فشلت. يرجى التحقق من الإصلاحات.');
    }
  }
}

// تشغيل الاختبارات
async function main() {
  const tester = new HuggingFaceFixTester();
  await tester.testAll();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = HuggingFaceFixTester;
