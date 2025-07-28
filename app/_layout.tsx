import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text, Image, Alert } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Audio } from 'expo-av';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthGuard } from '@/components/AuthGuard';
import { checkEnvironmentVariables } from '@/utils/envChecker';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useFrameworkReady();
  const [showSplash, setShowSplash] = useState(true);
  const [appIsReady, setAppIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('[RootLayout] Starting app preparation...');
        
        // Check environment variables on app start
        const envCheck = checkEnvironmentVariables();
        if (!envCheck.isValid) {
          console.warn('Environment variables check failed:', envCheck.error);
        }
        
        // Initialize audio system for mobile platforms
        if (Platform.OS !== 'web') {
          console.log('[RootLayout] Initializing audio...');
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: false,
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: false,
            staysActiveInBackground: false,
          });
        }
        
        // Wait for 2 seconds to show splash
        console.log('[RootLayout] Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('[RootLayout] App preparation completed successfully');
      } catch (e) {
        console.error('[RootLayout] Error during app preparation:', e);
        setError(e instanceof Error ? e.message : 'Unknown error occurred');
      } finally {
        console.log('[RootLayout] Setting app as ready...');
        setAppIsReady(true);
        setShowSplash(false);
        try {
          await SplashScreen.hideAsync();
          console.log('[RootLayout] Splash screen hidden successfully');
        } catch (e) {
          console.warn('[RootLayout] Error hiding splash screen:', e);
        }
      }
    }

    prepare();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 20 }}>
        <Text style={{ fontSize: 20, color: 'red', marginBottom: 16, textAlign: 'center' }}>⚠️ خطأ في التطبيق</Text>
        <Text style={{ fontSize: 16, color: '#333', marginBottom: 8, textAlign: 'center' }}>{error}</Text>
        <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>يرجى إعادة تشغيل التطبيق</Text>
      </View>
    );
  }

  if (!appIsReady || showSplash) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Image source={require('../assets/images/splash.png')} style={{ width: 200, height: 200, marginBottom: 32 }} />
        <Text style={{ fontSize: 20, color: '#2563EB', fontWeight: 'bold', marginBottom: 12 }}>Live Translate</Text>
        <Text style={{ fontSize: 16, color: '#6B7280' }}>جارٍ التحميل...</Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <SubscriptionProvider>
        <LanguageProvider>
          <AuthGuard>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="subscription" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
          </AuthGuard>
        </LanguageProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}