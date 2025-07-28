@echo off
echo ========================================
echo Building Android App with New Splash
echo ========================================

echo.
echo 1. Cleaning previous build...
cd android
if exist app\build rmdir /s /q app\build
if exist build rmdir /s /q build

echo.
echo 2. Building release APK...
call gradlew assembleRelease

echo.
echo 3. Build completed!
echo APK location: android\app\build\outputs\apk\release\app-release.apk
echo.
echo ========================================
pause 