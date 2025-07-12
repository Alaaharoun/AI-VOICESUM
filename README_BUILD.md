# Build Troubleshooting Guide - Expo Go vs EAS Build

## Why does Expo Go work but EAS Build doesn't?

## 🚨 Common Splash Screen Issue

### **The Problem:**
- ✅ New splash screen appears
- ❌ App "hangs" on white screen
- ❌ Doesn't navigate to login screen

### **The Cause:**
```typescript
// Problem in app/_layout.tsx
SplashScreen.preventAutoHideAsync(); // Prevents hiding the original splash
// But no SplashScreen.hideAsync() to hide it!
```

### **The Solution:**
```typescript
// In app/_layout.tsx
useEffect(() => {
  async function prepare() {
    try {
      // ... app setup
      
      // Wait 2 seconds to show splash
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (e) {
      console.error('Error during app preparation:', e);
    } finally {
      setAppIsReady(true);
      setShowSplash(false);
      // ⭐ Key: Hide the original splash screen
      await SplashScreen.hideAsync();
    }
  }
  prepare();
}, []);
```

### **Required Improvements:**
1. **Add `appIsReady` state**
2. **Add error boundary**
3. **Detailed error logging**
4. **Ensure splash is hidden before showing content**

---

### 1. **Basic Differences:**

#### Expo Go (Development):
- ✅ **Limited Environment** - Only supports basic APIs
- ✅ **No Complex Native Setup** required
- ✅ **Limited Libraries** - Doesn't support all libraries
- ✅ **Fast Build** - No Native code compilation needed

#### EAS Build (Production):
- ❌ **Full Build** with all Native Modules
- ❌ **Requires Proper Android Setup**
- ❌ **Supports All Libraries** (including complex ones)
- ❌ **More Compatibility Issues**

### 2. **Potential Issues and Solutions:**

#### a) Native Library Issues:
```bash
# Libraries that might cause problems:
- react-native-audio-recorder-player
- @react-native-community/voice
- ffmpeg-static
```

**Solution:**
- Ensure `react-native.config.js` exists
- Check `android/app/build.gradle`
- Add excludes for old libraries

#### b) Compatibility Issues:
```bash
# Versions that might cause problems:
- React Native 0.79.5
- Expo SDK 53
- Android SDK 34
```

**Solution:**
- Update `app.config.js` with correct Android settings
- Improve `eas.json` with appropriate buildTypes
- Add `metro.config.js` and `babel.config.js`

### 3. **Solution Steps:**

#### Step 1: Clean the Project
```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install

# Clear cache
npx expo start --clear
```

#### Step 2: Build Development Build
```bash
# Build development build first
eas build --platform android --profile development
```

#### Step 3: Build Preview Build
```bash
# Build preview build for testing
eas build --platform android --profile preview
```

#### Step 4: Build Production Build
```bash
# Build production build
eas build --platform android --profile production
```

### 4. **Important Configuration Files:**

#### `app.config.js`:
- Add `compileSdkVersion: 34`
- Add `targetSdkVersion: 34`
- Add complete permissions

#### `eas.json`:
- Set `buildType: "apk"` for testing
- Set `buildType: "aab"` for production

#### `android/app/build.gradle`:
- Add excludes for old libraries
- Optimize configurations

### 5. **Additional Tips:**

#### a) Memory Optimization:
```bash
# In android/gradle.properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m
```

#### b) Speed Optimization:
```bash
# In android/gradle.properties
org.gradle.parallel=true
org.gradle.daemon=true
```

#### c) Network Issues:
```bash
# Use VPN or change DNS
# Or try building at a different time
```

### 6. **Diagnostic Commands:**

```bash
# Check configuration
npx expo doctor

# Check libraries
npx expo install --fix

# Check Android
cd android && ./gradlew clean

# Local build for testing
npx expo run:android
```

### 7. **When to Use Each Type:**

#### Expo Go:
- ✅ Fast development
- ✅ Test basic APIs
- ✅ No complex setup needed

#### EAS Build:
- ✅ Production builds
- ✅ Support all libraries
- ✅ Publish to Google Play
- ✅ Test real performance

### 8. **Recommended Development Strategy:**

1. **Start with Expo Go** for fast development
2. **Move to Development Build** when Native libraries are needed
3. **Use Preview Build** for comprehensive testing
4. **Use Production Build** for final release

### 9. **Common Issues and Solutions:**

#### Issue: "Duplicate class found"
**Solution:** Add excludes in `build.gradle`

#### Issue: "Network timeout"
**Solution:** Use VPN or try at a different time

#### Issue: "Memory limit exceeded"
**Solution:** Increase `org.gradle.jvmargs`

#### Issue: "Permission denied"
**Solution:** Add permissions in `app.config.js`

#### Issue: "Splash screen hangs"
**Solution:** Add `SplashScreen.hideAsync()` in `app/_layout.tsx`

---

## 🏗️ Local APK Build

### **Method 1: Direct Local Build**
```bash
cd android && ./gradlew assembleRelease
```

### **Method 2: Build with Expo**
```bash
npx expo run:android --variant release
```

### **Method 3: Build with EAS**
```bash
eas build --platform android --profile preview --local
```

### **APK File Location:**
```
android/app/build/outputs/apk/release/app-release.apk
```

### **Tips for Successful APK Build:**
1. ✅ Ensure splash screen issue is resolved first
2. ✅ Test the app in Expo Go
3. ✅ Verify Android settings are correct
4. ✅ Ensure all images are in `drawable-*dpi/`

---

**Note:** If problems persist, try building a Development Build first before moving to Production Build. 