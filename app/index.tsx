declare global {
  interface Window {
    __LT_AUDIO_READY?: boolean;
    __LT_WS?: WebSocket | null;
    __LT_WS_READY?: boolean;
  }
}

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { transcriptionEngineService } from '../services/transcriptionEngineService';
import { EarlyConnectionService } from '../services/earlyConnectionService';

// استيراد AudioRecord فقط في React Native
let AudioRecord: any = null;
if (Platform.OS !== 'web') {
  try {
    AudioRecord = require('react-native-audio-record').default;
  } catch (e) {
    console.warn('[Index] AudioRecord not available:', e);
  }
}

export default function Index() {
  useEffect(() => {
    (async () => {
      try {
        // تهيئة AudioRecord (فقط في React Native)
        if (Platform.OS === 'web') {
          // في الويب، نستخدم Web Audio API بدلاً من AudioRecord
          window.__LT_AUDIO_READY = true;
          console.log('[Index] Web platform detected - using Web Audio API');
        } else if (AudioRecord) {
          try {
            AudioRecord.init({
              sampleRate: 16000,
              channels: 1,
              bitsPerSample: 16,
              wavFile: '',
            });
            window.__LT_AUDIO_READY = true;
            console.log('[Index] ✅ AudioRecord initialized successfully');
          } catch (e) {
            window.__LT_AUDIO_READY = false;
            console.warn('[Index] AudioRecord init failed', e);
          }
        } else {
          window.__LT_AUDIO_READY = false;
          console.warn('[Index] AudioRecord not available on this platform');
        }

        // تهيئة الاتصال المبكر لجميع المحركات
        try {
          const earlyConnectionService = EarlyConnectionService.getInstance();
          await earlyConnectionService.initializeEarlyConnections();
          console.log('[Index] ✅ Early connections initialized successfully');
        } catch (e) {
          console.warn('[Index] Early connection initialization failed', e);
        }

        // فتح WebSocket حسب المحرك المحدد (فقط عند الحاجة)
        try {
          if (!window.__LT_WS || window.__LT_WS.readyState !== 1) {
            // الحصول على المحرك الحالي
            const engine = await transcriptionEngineService.getCurrentEngine();
            
            if (engine === 'huggingface') {
              // Hugging Face لا يستخدم WebSocket، لذا نعتبره جاهز
              console.log('[Index] Hugging Face engine detected - WebSocket not needed');
              window.__LT_WS_READY = true;
              window.__LT_WS = null; // لا نحتاج WebSocket
            } else {
              // Azure يستخدم WebSocket - لكن لا نفتحه تلقائياً
              console.log('[Index] Azure engine detected - WebSocket will be opened when needed');
              window.__LT_WS_READY = false; // سيتم فتحه عند الحاجة
              window.__LT_WS = null;
            }
          }
        } catch (e) {
          window.__LT_WS = null;
          window.__LT_WS_READY = false;
          console.warn('[Index] Engine check failed', e);
        }
      } catch (err) {
        window.__LT_AUDIO_READY = false;
        window.__LT_WS_READY = false;
        console.warn('[Index] Mic permission or pre-connection failed', err);
      }
    })();
  }, []);

  return null;
} 