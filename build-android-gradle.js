// Build script for Android APK using Gradle with Expo
// This script will help you build the APK directly using Gradle

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class AndroidGradleBuilder {
  constructor() {
    this.projectRoot = process.cwd();
    this.androidPath = path.join(this.projectRoot, 'android');
  }

  async buildAPK() {
    console.log('🚀 Building Android APK with Gradle...\n');
    
    try {
      // Step 1: Check if we're in an Expo project
      await this.checkExpoProject();
      
      // Step 2: Prebuild Android
      await this.prebuildAndroid();
      
      // Step 3: Build APK with Gradle
      await this.buildWithGradle();
      
      // Step 4: Show results
      await this.showResults();
      
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      this.showTroubleshooting();
    }
  }

  async checkExpoProject() {
    console.log('📋 1. Checking Expo project setup...');
    
    const appConfigPath = path.join(this.projectRoot, 'app.config.js');
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    
    if (!fs.existsSync(appConfigPath)) {
      throw new Error('app.config.js not found. This doesn\'t appear to be an Expo project.');
    }
    
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found.');
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (!packageJson.dependencies || !packageJson.dependencies.expo) {
      throw new Error('Expo dependency not found in package.json.');
    }
    
    console.log('  ✅ Expo project detected');
    console.log(`  ✅ Expo version: ${packageJson.dependencies.expo}`);
  }

  async prebuildAndroid() {
    console.log('\n📋 2. Prebuilding Android project...');
    
    try {
      // Run expo prebuild for Android
      console.log('  🔧 Running: npx expo prebuild --platform android');
      execSync('npx expo prebuild --platform android', { 
        stdio: 'inherit',
        cwd: this.projectRoot 
      });
      
      console.log('  ✅ Android project prebuilt successfully');
      
    } catch (error) {
      console.log('  ⚠️ Prebuild failed, trying to continue...');
      console.log('  ℹ️ This might be normal if Android folder already exists');
    }
  }

  async buildWithGradle() {
    console.log('\n📋 3. Building APK with Gradle...');
    
    // Check if android folder exists
    if (!fs.existsSync(this.androidPath)) {
      throw new Error('Android folder not found. Run "npx expo prebuild --platform android" first.');
    }
    
    // Navigate to android folder and run gradle
    console.log('  🔧 Running: cd android && ./gradlew assembleRelease');
    
    try {
      execSync('./gradlew assembleRelease', {
        stdio: 'inherit',
        cwd: this.androidPath
      });
      
      console.log('  ✅ APK built successfully!');
      
    } catch (error) {
      // Try with gradlew.bat for Windows
      console.log('  🔧 Trying with gradlew.bat for Windows...');
      
      try {
        execSync('gradlew.bat assembleRelease', {
          stdio: 'inherit',
          cwd: this.androidPath
        });
        
        console.log('  ✅ APK built successfully with gradlew.bat!');
        
      } catch (error2) {
        throw new Error(`Gradle build failed: ${error2.message}`);
      }
    }
  }

  async showResults() {
    console.log('\n📋 4. Build Results:');
    
    // Look for the APK file
    const apkPaths = [
      path.join(this.androidPath, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
      path.join(this.androidPath, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
    ];
    
    let apkFound = false;
    
    for (const apkPath of apkPaths) {
      if (fs.existsSync(apkPath)) {
        const stats = fs.statSync(apkPath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`  ✅ APK found: ${apkPath}`);
        console.log(`  📦 Size: ${sizeInMB} MB`);
        console.log(`  📅 Created: ${stats.mtime.toLocaleString()}`);
        
        apkFound = true;
        break;
      }
    }
    
    if (!apkFound) {
      console.log('  ⚠️ APK not found in expected locations');
      console.log('  🔍 Searching for APK files...');
      
      // Search recursively for APK files
      const apkFiles = this.findAPKFiles(this.androidPath);
      
      if (apkFiles.length > 0) {
        console.log('  📦 Found APK files:');
        apkFiles.forEach(file => {
          const stats = fs.statSync(file);
          const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
          console.log(`    - ${file} (${sizeInMB} MB)`);
        });
      } else {
        console.log('  ❌ No APK files found');
      }
    }
  }

  findAPKFiles(dir) {
    const apkFiles = [];
    
    try {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          apkFiles.push(...this.findAPKFiles(fullPath));
        } else if (file.endsWith('.apk')) {
          apkFiles.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
    
    return apkFiles;
  }

  showTroubleshooting() {
    console.log('\n🔧 Troubleshooting Guide:');
    console.log('========================');
    console.log('');
    console.log('1. Make sure you have the following installed:');
    console.log('   - Node.js (v16 or higher)');
    console.log('   - Java JDK (v11 or higher)');
    console.log('   - Android Studio with Android SDK');
    console.log('   - ANDROID_HOME environment variable set');
    console.log('');
    console.log('2. Try these commands in order:');
    console.log('   npm install');
    console.log('   npx expo install');
    console.log('   npx expo prebuild --platform android --clean');
    console.log('   cd android && ./gradlew clean');
    console.log('   cd android && ./gradlew assembleRelease');
    console.log('');
    console.log('3. Alternative build methods:');
    console.log('   npx expo run:android --variant release');
    console.log('   eas build --platform android --local');
    console.log('');
    console.log('4. Check Android folder permissions');
    console.log('   Make sure you have write permissions to the android folder');
  }

  async createBuildScript() {
    console.log('\n📋 Creating build script...');
    
    const buildScript = `@echo off
echo 🚀 Building Android APK with Gradle...

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ package.json not found. Please run this from the project root.
    exit /b 1
)

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

REM Prebuild Android
echo 🔧 Prebuilding Android project...
call npx expo prebuild --platform android

REM Build APK
echo 🏗️ Building APK with Gradle...
cd android
call gradlew.bat assembleRelease

REM Show results
echo 📋 Build completed!
echo 📦 APK should be in: android\\app\\build\\outputs\\apk\\release\\app-release.apk

pause
`;

    const scriptPath = path.join(this.projectRoot, 'build-android.bat');
    fs.writeFileSync(scriptPath, buildScript, 'utf8');
    console.log('  ✅ Build script created: build-android.bat');
    console.log('  💡 Run: build-android.bat');
  }
}

// Run the build
async function runAndroidBuild() {
  const builder = new AndroidGradleBuilder();
  
  try {
    await builder.buildAPK();
    await builder.createBuildScript();
    
    console.log('\n🎯 Build Summary:');
    console.log('================');
    console.log('✅ Android APK build process completed');
    console.log('✅ Build script created: build-android.bat');
    console.log('');
    console.log('📱 Next steps:');
    console.log('1. Install the APK on your device');
    console.log('2. Test Hugging Face functionality');
    console.log('3. Check console logs for any errors');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
  }
}

if (require.main === module) {
  runAndroidBuild().catch(console.error);
}

module.exports = {
  AndroidGradleBuilder,
  runAndroidBuild
}; 