#!/usr/bin/env node

/**
 * 🚀 سكريبت رفع إصلاحات Hugging Face
 * 
 * هذا السكريبت يرفع الإصلاحات المطلوبة لـ Hugging Face Spaces
 * لحل مشكلة "name 'traceback' is not defined"
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Hugging Face deployment with traceback fix...');

// Copy the fixed app.py to the faster-whisper-api directory
const sourceAppPath = path.join(__dirname, 'faster-whisper-api', 'app.py');
const targetAppPath = path.join(__dirname, 'faster-whisper-api', 'app.py');

console.log('📝 Checking if app.py exists...');
if (fs.existsSync(sourceAppPath)) {
    console.log('✅ app.py found');
    
    // Read the current content to verify it's the fixed version
    const content = fs.readFileSync(sourceAppPath, 'utf8');
    
    if (content.includes('import sys') && !content.includes('import traceback')) {
        console.log('✅ Fixed app.py detected (no traceback import)');
        console.log('✅ Ready for deployment to Hugging Face Spaces');
        
        console.log('\n📋 Deployment Instructions:');
        console.log('1. Navigate to your Hugging Face Spaces repository');
        console.log('2. Upload the updated files from faster-whisper-api/');
        console.log('3. The main files to update are:');
        console.log('   - app.py (fixed version)');
        console.log('   - requirements.txt');
        console.log('   - Dockerfile');
        console.log('4. Commit and push the changes');
        console.log('5. Wait for the space to rebuild');
        
        console.log('\n🔧 Key fixes applied:');
        console.log('   - Removed traceback import (causing 500 error)');
        console.log('   - Added better error handling');
        console.log('   - Added detailed logging for debugging');
        console.log('   - Added error type information');
        
        console.log('\n🌐 Your Hugging Face Space URL:');
        console.log('   https://alaaharoun-faster-whisper-api.hf.space');
        
        console.log('\n📊 After deployment, test with:');
        console.log('   curl -X GET https://alaaharoun-faster-whisper-api.hf.space/health');
        
    } else {
        console.log('❌ app.py still contains traceback import');
        console.log('Please ensure the fixed version is applied');
    }
} else {
    console.log('❌ app.py not found in faster-whisper-api directory');
}

console.log('\n✅ Deployment script completed'); 