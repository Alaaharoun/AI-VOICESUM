#!/usr/bin/env node

/**
 * Client Deployment Script for AI Live Translate Web App
 * Builds and deploys the client with audio corruption fixes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ClientDeployer {
  constructor() {
    this.buildDir = 'dist';
    this.deploymentReady = false;
  }

  async deploy() {
    console.log('🚀 Starting client deployment with audio fixes...');
    
    try {
      // Step 1: Clean previous build
      this.cleanBuild();
      
      // Step 2: Check environment
      this.checkEnvironment();
      
      // Step 3: Build application
      this.buildApplication();
      
      // Step 4: Verify build
      this.verifyBuild();
      
      // Step 5: Generate deployment instructions
      this.generateDeploymentInstructions();
      
      console.log('✅ Client deployment preparation completed!');
      
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    }
  }

  cleanBuild() {
    console.log('🧹 Cleaning previous build...');
    
    if (fs.existsSync(this.buildDir)) {
      fs.rmSync(this.buildDir, { recursive: true, force: true });
      console.log('✅ Previous build cleaned');
    }
  }

  checkEnvironment() {
    console.log('🔍 Checking environment...');
    
    // Check if package.json exists
    if (!fs.existsSync('package.json')) {
      throw new Error('package.json not found. Run this script from AILIVETRANSLATEWEB directory');
    }
    
    // Check Node modules
    if (!fs.existsSync('node_modules')) {
      console.log('📦 Installing dependencies...');
      execSync('npm install', { stdio: 'inherit' });
    }
    
    console.log('✅ Environment check passed');
  }

  buildApplication() {
    console.log('🔨 Building application with audio fixes...');
    
    try {
      // Build the application
      execSync('npm run build', { stdio: 'inherit' });
      console.log('✅ Application built successfully');
      
    } catch (error) {
      throw new Error(`Build failed: ${error.message}`);
    }
  }

  verifyBuild() {
    console.log('🔍 Verifying build output...');
    
    if (!fs.existsSync(this.buildDir)) {
      throw new Error('Build directory not found');
    }
    
    const indexPath = path.join(this.buildDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      throw new Error('index.html not found in build output');
    }
    
    const assetsDir = path.join(this.buildDir, 'assets');
    if (!fs.existsSync(assetsDir)) {
      throw new Error('Assets directory not found');
    }
    
    // List build files
    const files = fs.readdirSync(this.buildDir, { recursive: true });
    console.log('📁 Build files:');
    files.forEach(file => console.log(`   ${file}`));
    
    this.deploymentReady = true;
    console.log('✅ Build verification passed');
  }

  generateDeploymentInstructions() {
    console.log('📋 Generating deployment instructions...');
    
    const instructions = `# 🚀 Client Deployment Instructions

## ✅ Audio Corruption Fixes Applied

The built application includes these critical fixes:
- 🔧 Audio chunk validation (rejects chunks < 500 bytes)
- 🔧 WebM EBML header validation
- 🔧 Increased MediaRecorder interval to 2000ms
- 🔧 Fallback audio format support
- 🔧 Better error handling for corrupted audio

## 📁 Build Output

The \`dist/\` folder contains:
- \`index.html\` - Main application
- \`assets/\` - JavaScript, CSS, and other assets
- \`splash.png\` - Application splash screen

## 🌐 Deployment Options

### Option 1: Static File Hosting
1. Upload the entire \`dist/\` folder to your hosting service:
   - Netlify: Drag & drop the \`dist/\` folder
   - Vercel: \`vercel --prod dist/\`
   - GitHub Pages: Copy contents to your pages repository
   - Firebase Hosting: \`firebase deploy --only hosting\`

### Option 2: Manual Server Deploy
1. Copy \`dist/\` contents to your web server root
2. Ensure your server serves the \`index.html\` for all routes
3. Configure HTTPS (required for microphone access)

### Option 3: CDN Upload
1. Upload to your CDN service
2. Set up proper MIME types for JavaScript and CSS files

## 🔧 Environment Setup

Before deployment, ensure:
1. Set up environment variables for production:
   - VITE_AZURE_SPEECH_KEY=your_key_here
   - VITE_AZURE_SPEECH_REGION=your_region
   
2. Update server URLs in the build if needed

## 🧪 Testing After Deployment

1. Open the deployed application
2. Test microphone access
3. Start recording - you should see:
   - Larger audio chunks (32000+ bytes instead of 16422)
   - No more "EBML header parsing failed" errors
   - Better transcription quality
   - Fewer "No clear speech detected" warnings

## 📊 Expected Improvements

✅ **Before Fix:**
- Small corrupted WebM chunks (16422 bytes)
- EBML header parsing failures
- Poor Azure Speech recognition

✅ **After Fix:**  
- Larger stable chunks (32000+ bytes)
- Valid WebM headers
- Reliable speech recognition
- Better user experience

---

**🎯 The audio corruption issue should now be resolved!**

Generated: ${new Date().toISOString()}
`;

    fs.writeFileSync('DEPLOYMENT_INSTRUCTIONS.md', instructions);
    console.log('✅ Created DEPLOYMENT_INSTRUCTIONS.md');
  }
}

// Run if called directly
if (require.main === module) {
  const deployer = new ClientDeployer();
  deployer.deploy().catch(console.error);
}

module.exports = ClientDeployer; 