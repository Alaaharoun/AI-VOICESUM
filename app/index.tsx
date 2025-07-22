declare global {
  interface Window {
    __LT_AUDIO_READY?: boolean;
    __LT_WS?: WebSocket | null;
    __LT_WS_READY?: boolean;
  }
}

import { useEffect, useState, useRef } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, Text, ActivityIndicator } from 'react-native';
import { ensureMicPermission } from '@/utils/permissionHelper';
import AudioRecord from 'react-native-audio-record';
import { checkEnvironmentVariables } from '@/utils/envChecker';

export default function Index() {
  const { user, loading } = useAuth();
  const [fallback, setFallback] = useState(false);
  const routedRef = useRef(false);

  // تهيئة عامة (AudioRecord + WebSocket) عند أول دخول
  useEffect(() => {
    // تحقق من متغيرات البيئة عند بدء الصفحة
    checkEnvironmentVariables();
    (async () => {
      try {
        const mic = await ensureMicPermission();
        if (!mic) {
          console.warn('[Index] Microphone permission not granted');
          window.__LT_AUDIO_READY = false;
        } else {
          // تهيئة AudioRecord
          try {
            AudioRecord.init({
              sampleRate: 16000,
              channels: 1,
              bitsPerSample: 16,
              wavFile: '',
            });
            window.__LT_AUDIO_READY = true;
          } catch (e) {
            window.__LT_AUDIO_READY = false;
            console.warn('[Index] AudioRecord init failed', e);
          }

          // فتح WebSocket
          try {
            if (!window.__LT_WS || window.__LT_WS.readyState !== 1) {
              const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
              window.__LT_WS = ws;
              ws.onopen = () => {
                console.log('[Index] WebSocket ready!');
                window.__LT_WS_READY = true;
              };
              ws.onerror = (e) => {
                console.warn('[Index] WebSocket error', e);
                window.__LT_WS_READY = false;
              };
              ws.onclose = () => {
                window.__LT_WS_READY = false;
              };
            }
          } catch (e) {
            window.__LT_WS = null;
            window.__LT_WS_READY = false;
            console.warn('[Index] WebSocket init failed', e);
          }
        }
      } catch (err) {
        window.__LT_AUDIO_READY = false;
        window.__LT_WS_READY = false;
        console.warn('[Index] Mic permission or pre-connection failed', err);
      }
    })();
    return () => {
      if (window.__LT_WS) {
        window.__LT_WS.close();
        window.__LT_WS = null;
        window.__LT_WS_READY = false;
      }
    };
  }, []);

  useEffect(() => {
    console.log('[Index] user:', user, 'loading:', loading);
    if (!loading && !routedRef.current) {
      routedRef.current = true;
      if (user) {
        console.log('[Index] Routing to /tabs');
        router.replace('/(tabs)');
      } else {
        console.log('[Index] Routing to /auth/sign-in');
        router.replace('/(auth)/sign-in');
      }
      // إذا لم يتم التوجيه خلال 3 ثواني، أظهر شاشة fallback
      const timer = setTimeout(() => setFallback(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  if (fallback) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 20, color: 'red', marginBottom: 16 }}>⚠️ لم يتم التوجيه لأي شاشة!</Text>
        <Text style={{ fontSize: 16, color: '#333', marginBottom: 8 }}>user: {String(user)}</Text>
        <Text style={{ fontSize: 16, color: '#333', marginBottom: 8 }}>loading: {String(loading)}</Text>
        <Text style={{ fontSize: 14, color: '#666' }}>إذا رأيت هذه الشاشة، هناك مشكلة في التوجيه أو في Expo Router.</Text>
      </View>
    );
  }

  // Show loading screen while checking authentication
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={{ marginTop: 16, fontSize: 16, color: '#6B7280' }}>Loading...</Text>
    </View>
  );
} 