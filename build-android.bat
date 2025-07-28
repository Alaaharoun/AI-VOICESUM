@echo off
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
echo 📦 APK should be in: android\app\build\outputs\apk\release\app-release.apk

pause
