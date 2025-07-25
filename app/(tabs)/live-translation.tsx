// ملاحظة هامة: أي كود متعلق بمكتبات الصوت Native مثل expo-av يجب أن يبقى محصوراى في هذه الصفحة فقط.
// لا تقم بتصدير أو مشاركة أي دوال أو كائنات من هذه المكتبة إلى صفحات أو مكونات أخرى لتفادي الكراش في باقي التطبيق.

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LanguageSelector, Language } from '../../components/LanguageSelector';
import { SpeechService } from '../../services/speechService';
import { getAudioService } from '../../services/audioService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TranscriptionItem {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: Date;
}

const Logger = {
  info: (message: string, ...args: any[]) => console.log(`[LiveTranslation] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[LiveTranslation] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[LiveTranslation] ${message}`, ...args)
};

// دالة تحويل Base64 إلى Uint8Array للمتصفح
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export default function LiveTranslationScreen() {
  const { targetLanguage, languageName, sourceLanguage, sourceLanguageName } = useLocalSearchParams<{
    targetLanguage: string;
    languageName: string;
    sourceLanguage: string;
    sourceLanguageName: string;
  }>();

  // State management
  const [selectedSourceLanguage, setSelectedSourceLanguage] = useState<string>(sourceLanguage || 'auto');
  const [selectedTargetLanguage, setSelectedTargetLanguage] = useState<Language | null>(null);
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  // NEW: Real-time translation state
  const [isRealTimeMode, setIsRealTimeMode] = useState(false);
  const [realTimeTranscription, setRealTimeTranscription] = useState<string>('');
  const [realTimeTranslation, setRealTimeTranslation] = useState<string>('');

  // Refs
  const audioServiceRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const translationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChunksRef = useRef<Uint8Array[]>([]); // قائمة مؤقتة للـchunks
  const wsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // timeout للـWebSocket
  const lastActivityRef = useRef<number>(Date.now()); // آخر نشاط للـWebSocket

  // Initialize target language
  useEffect(() => {
    const languages = SpeechService.getAvailableLanguages();
    const targetLang = languages.find(lang => lang.code === targetLanguage) || languages[0];
    setSelectedTargetLanguage(targetLang);
  }, [targetLanguage]);

  // Helper function to convert language codes to Azure format
  const convertToAzureLanguage = (langCode: string): string => {
    const azureLanguageMap: { [key: string]: string } = {
      'ar': 'ar-SA', 'en': 'en-US', 'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE',
      'it': 'it-IT', 'pt': 'pt-BR', 'ru': 'ru-RU', 'ja': 'ja-JP', 'ko': 'ko-KR',
      'zh': 'zh-CN', 'tr': 'tr-TR', 'nl': 'nl-NL', 'pl': 'pl-PL', 'sv': 'sv-SE',
      'da': 'da-DK', 'no': 'no-NO', 'fi': 'fi-FI', 'cs': 'cs-CZ', 'sk': 'sk-SK',
      'hu': 'hu-HU', 'ro': 'ro-RO', 'bg': 'bg-BG', 'hr': 'hr-HR', 'sl': 'sl-SI',
      'et': 'et-EE', 'lv': 'lv-LV', 'lt': 'lt-LT', 'el': 'el-GR', 'he': 'he-IL',
      'th': 'th-TH', 'vi': 'vi-VN', 'id': 'id-ID', 'ms': 'ms-MY', 'fil': 'fil-PH',
      'hi': 'hi-IN', 'bn': 'bn-IN', 'ur': 'ur-PK', 'fa': 'fa-IR', 'uk': 'uk-UA',
      'ca': 'ca-ES', 'eu': 'eu-ES', 'gl': 'gl-ES', 'cy': 'cy-GB', 'ga': 'ga-IE',
      'mt': 'mt-MT', 'sq': 'sq-AL', 'mk': 'mk-MK', 'sr': 'sr-RS', 'bs': 'bs-BA',
      'me': 'me-ME', 'az': 'az-AZ', 'ka': 'ka-GE', 'hy': 'hy-AM', 'kk': 'kk-KZ',
      'ky': 'ky-KG', 'uz': 'uz-UZ', 'tg': 'tg-TJ', 'mn': 'mn-MN', 'ne': 'ne-NP',
      'si': 'si-LK', 'my': 'my-MM', 'km': 'km-KH', 'lo': 'lo-LA', 'am': 'am-ET',
      'sw': 'sw-KE', 'zu': 'zu-ZA', 'af': 'af-ZA', 'is': 'is-IS', 'fo': 'fo-FO',
      'lb': 'lb-LU', 'fy': 'fy-NL', 'gd': 'gd-GB', 'kw': 'kw-GB', 'br': 'br-FR',
      'oc': 'oc-FR', 'co': 'co-FR'
    };
    return azureLanguageMap[langCode] || 'ar-SA';
  };

  // Initialize audio service
  useEffect(() => {
    const clearOldData = async () => {
      // تنظيف AsyncStorage من أي بيانات قديمة - فقط في الموبايل
      if (Platform.OS !== 'web') {
        try {
          await AsyncStorage.removeItem('audio_cache');
          await AsyncStorage.removeItem('transcription_cache');
          await AsyncStorage.removeItem('translation_cache');
          Logger.info('Cleared AsyncStorage cache');
        } catch (error) {
          Logger.error('Failed to clear AsyncStorage:', error);
        }
      }
    };
    
    // تنظيف شامل للبيانات القديمة عند بدء التطبيق
    setTranscriptions([]);
    setRealTimeTranscription('');
    setRealTimeTranslation('');
    
    // لا نقوم بتنظيف خدمة الصوت هنا لتجنب مشاكل التهيئة
    Logger.info('App started without audio service cleanup');
    
    // تنظيف AsyncStorage - فقط في الموبايل
    clearOldData();
    
    Logger.info('Cleared all old data on app start');
    
    // تهيئة الصوت تلقائياً عند تحميل الصفحة للجميع
    initAll();
    
    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, []);

  // NEW: Real-time translation effect - REMOVED to avoid conflicts
  // Translation is now handled directly in the WebSocket message handler

  const initAll = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      // تنظيف AsyncStorage قبل التهيئة - فقط في الموبايل
      if (Platform.OS !== 'web') {
        try {
          await AsyncStorage.removeItem('audio_cache');
          await AsyncStorage.removeItem('transcription_cache');
          await AsyncStorage.removeItem('translation_cache');
          Logger.info('Cleared AsyncStorage before initialization');
        } catch (error) {
          Logger.error('Failed to clear AsyncStorage before initialization:', error);
        }
      }
      
      // إنشاء خدمة صوت جديدة بدون تنظيف سابق
      const audioService = getAudioService();
      await audioService.init();
      audioServiceRef.current = audioService;
      
      setIsReady(true);
      Logger.info('Audio service initialized successfully with fresh data');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Failed to initialize audio service:', errorMessage);
      setError(`فشل في تهيئة الصوت: ${errorMessage}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const cleanup = () => {
    if (audioServiceRef.current && isReady) {
      audioServiceRef.current.stop();
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (translationTimeoutRef.current) {
      clearTimeout(translationTimeoutRef.current);
    }
    if (wsTimeoutRef.current) {
      clearTimeout(wsTimeoutRef.current);
    }
    // تنظيف البيانات المؤقتة
    setTranscriptions([]);
    setRealTimeTranscription('');
    setRealTimeTranslation('');
    
    // تنظيف AsyncStorage - فقط في الموبايل
    if (Platform.OS !== 'web') {
      AsyncStorage.removeItem('audio_cache').catch(() => {});
      AsyncStorage.removeItem('transcription_cache').catch(() => {});
      AsyncStorage.removeItem('translation_cache').catch(() => {});
    }
    
    Logger.info('Complete cleanup performed');
  };

  // دالة لإدارة timeout الـWebSocket
  const manageWebSocketTimeout = () => {
    // إلغاء الـtimeout السابق
    if (wsTimeoutRef.current) {
      clearTimeout(wsTimeoutRef.current);
    }
    
    // تحديث آخر نشاط
    lastActivityRef.current = Date.now();
    
    // تعيين timeout جديد (دقيقة واحدة)
    wsTimeoutRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        Logger.info('WebSocket timeout reached, closing connection');
        wsRef.current.close(1000, 'Timeout - no activity');
      }
    }, 60000); // دقيقة واحدة
  };

  // Initialize WebSocket connection
  const initializeWebSocket = async () => {
    try {
      setConnectionStatus('connecting');
      
      // تنظيف AsyncStorage قبل الاتصال - فقط في الموبايل
      if (Platform.OS !== 'web') {
        try {
          await AsyncStorage.removeItem('audio_cache');
          await AsyncStorage.removeItem('transcription_cache');
          await AsyncStorage.removeItem('translation_cache');
          Logger.info('Cleared AsyncStorage before WebSocket connection');
        } catch (error) {
          Logger.error('Failed to clear AsyncStorage before WebSocket connection:', error);
        }
      }
      
      // استخدام السيرفر على Render
      const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
      
      ws.onopen = () => {
        Logger.info('WebSocket connected');
        setConnectionStatus('connected');
        setError(null);
        
        // بدء إدارة الـtimeout
        manageWebSocketTimeout();
        
        // إرسال الـchunks المؤقتة إذا وجدت
        if (pendingChunksRef.current.length > 0) {
          Logger.info(`Sending ${pendingChunksRef.current.length} pending chunks`);
          pendingChunksRef.current.forEach((chunk, index) => {
            ws.send(chunk);
            Logger.info(`Sent pending chunk ${index + 1}/${pendingChunksRef.current.length} (${chunk.byteLength} bytes)`);
          });
          pendingChunksRef.current = []; // تفريغ القائمة
        }
        
        // تنظيف AsyncStorage عند فتح الاتصال - فقط في الموبايل
        if (Platform.OS !== 'web') {
          AsyncStorage.removeItem('audio_cache').catch(() => {});
          AsyncStorage.removeItem('transcription_cache').catch(() => {});
          AsyncStorage.removeItem('translation_cache').catch(() => {});
          
          Logger.info('WebSocket opened and cache cleared');
          
          // تنظيف إضافي بعد فتح الاتصال
          AsyncStorage.removeItem('audio_cache').catch(() => {});
          AsyncStorage.removeItem('transcription_cache').catch(() => {});
          AsyncStorage.removeItem('translation_cache').catch(() => {});
          
          Logger.info('Additional cleanup after WebSocket opened');
        }
        
        // Validate and prepare language codes
        const supportedLanguages = SpeechService.getAvailableLanguages().map(lang => lang.code);
        const sourceLang = selectedSourceLanguage && selectedSourceLanguage !== 'auto' ? selectedSourceLanguage : 'ar';
        const targetLang = selectedTargetLanguage?.code || 'en';
        
        const azureSourceLang = convertToAzureLanguage(sourceLang);
        const azureTargetLang = convertToAzureLanguage(targetLang);
        
        // Validate source language
        if (!supportedLanguages.includes(sourceLang)) {
          Logger.error('Unsupported source language:', sourceLang);
          setError(`Unsupported source language: ${sourceLang}`);
          return;
        }
        
        // Validate target language
        if (!supportedLanguages.includes(targetLang)) {
          Logger.error('Unsupported target language:', targetLang);
          setError(`Unsupported target language: ${targetLang}`);
          return;
        }
        
        Logger.info('Using validated languages - Source:', sourceLang, 'Target:', targetLang);
        
        // Send initialization message
        const initMessage = {
          type: 'init',
          language: azureSourceLang,
          targetLanguage: azureTargetLang,
          clientSideTranslation: true,
          realTimeMode: isRealTimeMode // NEW: Send real-time mode to server
        };
        ws.send(JSON.stringify(initMessage));
        Logger.info('Init message sent with language:', initMessage.language, 'and targetLanguage:', initMessage.targetLanguage);
        
        // تنظيف AsyncStorage بعد إرسال رسالة التهيئة - فقط في الموبايل
        if (Platform.OS !== 'web') {
          AsyncStorage.removeItem('audio_cache').catch(() => {});
          AsyncStorage.removeItem('transcription_cache').catch(() => {});
          AsyncStorage.removeItem('translation_cache').catch(() => {});
          
          Logger.info('Init message sent and cache cleared');
          
          // تنظيف إضافي بعد إرسال رسالة التهيئة
          AsyncStorage.removeItem('audio_cache').catch(() => {});
          AsyncStorage.removeItem('transcription_cache').catch(() => {});
          AsyncStorage.removeItem('translation_cache').catch(() => {});
          
          Logger.info('Additional cleanup after init message');
        }
      };
      
      ws.onmessage = async (event) => {
        try {
          // تحديث الـtimeout عند استقبال رسائل
          manageWebSocketTimeout();
          
          Logger.info('Raw server reply:', event.data);
          const data = JSON.parse(event.data);
          Logger.info('Parsed message:', data.type, data);
          
          // تنظيف AsyncStorage عند استقبال رسائل جديدة - فقط في الموبايل
          if (Platform.OS !== 'web') {
            AsyncStorage.removeItem('audio_cache').catch(() => {});
            AsyncStorage.removeItem('transcription_cache').catch(() => {});
            AsyncStorage.removeItem('translation_cache').catch(() => {});
            
            Logger.info('WebSocket message received and cache cleared');
            
            // تنظيف إضافي بعد استقبال رسائل جديدة
            AsyncStorage.removeItem('audio_cache').catch(() => {});
            AsyncStorage.removeItem('transcription_cache').catch(() => {});
            AsyncStorage.removeItem('translation_cache').catch(() => {});
            
            Logger.info('Additional cleanup after WebSocket message received');
          }
          
          if (data.type === 'transcription' || data.type === 'final') {
            if (data.text && data.text.trim()) {
              // تنظيف AsyncStorage عند استقبال نصوص جديدة
              AsyncStorage.removeItem('audio_cache').catch(() => {});
              AsyncStorage.removeItem('transcription_cache').catch(() => {});
              AsyncStorage.removeItem('translation_cache').catch(() => {});
              
              Logger.info('New transcription received and cache cleared');
              
              // تنظيف إضافي بعد استقبال نصوص جديدة
              AsyncStorage.removeItem('audio_cache').catch(() => {});
              AsyncStorage.removeItem('transcription_cache').catch(() => {});
              AsyncStorage.removeItem('translation_cache').catch(() => {});
              
              // تجنب إضافة نفس النص مرتين
              const isDuplicate = transcriptions.some(item => 
                item.originalText === data.text
              );
              
              if (isDuplicate) {
                Logger.warn('Skipping duplicate transcription:', data.text);
                
                // تنظيف AsyncStorage عند استقبال نصوص مكررة
                AsyncStorage.removeItem('audio_cache').catch(() => {});
                AsyncStorage.removeItem('transcription_cache').catch(() => {});
                AsyncStorage.removeItem('translation_cache').catch(() => {});
                
                Logger.info('Duplicate transcription received and cache cleared');
                
                // تنظيف إضافي بعد استقبال نصوص مكررة
                AsyncStorage.removeItem('audio_cache').catch(() => {});
                AsyncStorage.removeItem('transcription_cache').catch(() => {});
                AsyncStorage.removeItem('translation_cache').catch(() => {});
                return;
              }
              
              Logger.info('Processing transcription:', data.text);
              
              if (isRealTimeMode) {
                // تنظيف AsyncStorage عند استقبال نصوص في الوضع المباشر
                AsyncStorage.removeItem('audio_cache').catch(() => {});
                AsyncStorage.removeItem('transcription_cache').catch(() => {});
                AsyncStorage.removeItem('translation_cache').catch(() => {});
                
                Logger.info('Real-time transcription received and cache cleared');
                
                // تنظيف إضافي بعد استقبال نصوص في الوضع المباشر
                AsyncStorage.removeItem('audio_cache').catch(() => {});
                AsyncStorage.removeItem('transcription_cache').catch(() => {});
                AsyncStorage.removeItem('translation_cache').catch(() => {});
                
                // NEW: Update real-time transcription
                setRealTimeTranscription(data.text);
                
                // تجنب إضافة نفس النص في التاريخ إذا كان موجوداً
                const isDuplicate = transcriptions.some(item => 
                  item.originalText === data.text
                );
                
                if (!isDuplicate) {
                  // تنظيف AsyncStorage قبل إضافة نص جديد
                  AsyncStorage.removeItem('audio_cache').catch(() => {});
                  AsyncStorage.removeItem('transcription_cache').catch(() => {});
                  AsyncStorage.removeItem('translation_cache').catch(() => {});
                  
                  Logger.info('New text added to history and cache cleared');
                  
                  // تنظيف إضافي قبل إضافة نصوص جديدة
                  AsyncStorage.removeItem('audio_cache').catch(() => {});
                  AsyncStorage.removeItem('transcription_cache').catch(() => {});
                  AsyncStorage.removeItem('translation_cache').catch(() => {});
                  
                  // إضافة النص الجديد إلى التاريخ
                  const newItem: TranscriptionItem = {
                    id: Date.now().toString(),
                    originalText: data.text,
                    translatedText: '',
                    timestamp: new Date()
                  };
                  setTranscriptions(prev => [...prev, newItem]);
                }
                
                // Also translate in real-time mode
                try {
                  // تنظيف AsyncStorage قبل الترجمة
                  AsyncStorage.removeItem('audio_cache').catch(() => {});
                  AsyncStorage.removeItem('transcription_cache').catch(() => {});
                  AsyncStorage.removeItem('translation_cache').catch(() => {});
                  
                  Logger.info('Real-time translation started and cache cleared');
                  
                  // تنظيف إضافي قبل الترجمة المباشرة
                  AsyncStorage.removeItem('audio_cache').catch(() => {});
                  AsyncStorage.removeItem('transcription_cache').catch(() => {});
                  AsyncStorage.removeItem('translation_cache').catch(() => {});
                  Logger.info('Real-time translating:', data.text, 'to:', selectedTargetLanguage?.code);
                  const translatedText = await SpeechService.translateText(
                    data.text, 
                    selectedTargetLanguage?.code || 'ar',
                    selectedSourceLanguage
                  );
                  
                  Logger.info('Real-time translation result:', translatedText);
                  setRealTimeTranslation(translatedText);
                } catch (translationError) {
                  Logger.error('Real-time translation failed:', translationError);
                  
                  // تنظيف AsyncStorage عند حدوث خطأ في الترجمة المباشرة
                  AsyncStorage.removeItem('audio_cache').catch(() => {});
                  AsyncStorage.removeItem('transcription_cache').catch(() => {});
                  AsyncStorage.removeItem('translation_cache').catch(() => {});
                  
                  setRealTimeTranslation(data.text); // Fallback to original
                }
              } else {
                // تنظيف AsyncStorage عند استقبال نصوص في الوضع التقليدي
                AsyncStorage.removeItem('audio_cache').catch(() => {});
                AsyncStorage.removeItem('transcription_cache').catch(() => {});
                AsyncStorage.removeItem('translation_cache').catch(() => {});
                
                Logger.info('Traditional transcription received and cache cleared');
                
                // تنظيف إضافي بعد استقبال نصوص في الوضع التقليدي
                AsyncStorage.removeItem('audio_cache').catch(() => {});
                AsyncStorage.removeItem('transcription_cache').catch(() => {});
                AsyncStorage.removeItem('translation_cache').catch(() => {});
                
                // Traditional mode: add to transcriptions list
                const newItem: TranscriptionItem = {
                  id: Date.now().toString(),
                  originalText: data.text,
                  translatedText: '',
                  timestamp: new Date()
                };
                
                setTranscriptions(prev => [...prev, newItem]);
                
                // Translate the text
                try {
                  // تنظيف AsyncStorage قبل الترجمة
                  AsyncStorage.removeItem('audio_cache').catch(() => {});
                  AsyncStorage.removeItem('transcription_cache').catch(() => {});
                  AsyncStorage.removeItem('translation_cache').catch(() => {});
                  
                  Logger.info('Traditional translation started and cache cleared');
                  
                  // تنظيف إضافي قبل الترجمة التقليدية
                  AsyncStorage.removeItem('audio_cache').catch(() => {});
                  AsyncStorage.removeItem('transcription_cache').catch(() => {});
                  AsyncStorage.removeItem('translation_cache').catch(() => {});
                  Logger.info('Translating text:', data.text, 'to:', selectedTargetLanguage?.code);
                  const translatedText = await SpeechService.translateText(
                    data.text, 
                    selectedTargetLanguage?.code || 'ar',
                    selectedSourceLanguage
                  );
                  
                  Logger.info('Translation result:', translatedText);
                  
                  setTranscriptions(prev => 
                    prev.map(item => 
                      item.id === newItem.id 
                        ? { ...item, translatedText } 
                        : item
                    )
                  );
                  
                  // تنظيف AsyncStorage بعد تحديث النص المترجم
                  AsyncStorage.removeItem('audio_cache').catch(() => {});
                  AsyncStorage.removeItem('transcription_cache').catch(() => {});
                  AsyncStorage.removeItem('translation_cache').catch(() => {});
                  
                  Logger.info('Translation updated and cache cleared');
                  
                  // تنظيف إضافي بعد تحديث النصوص المترجمة
                  AsyncStorage.removeItem('audio_cache').catch(() => {});
                  AsyncStorage.removeItem('transcription_cache').catch(() => {});
                  AsyncStorage.removeItem('translation_cache').catch(() => {});
                } catch (translationError) {
                  Logger.error('Translation failed:', translationError);
                  
                  // تنظيف AsyncStorage عند حدوث خطأ في الترجمة
                  AsyncStorage.removeItem('audio_cache').catch(() => {});
                  AsyncStorage.removeItem('transcription_cache').catch(() => {});
                  AsyncStorage.removeItem('translation_cache').catch(() => {});
                  
                  // Set original text as fallback
                  setTranscriptions(prev => 
                    prev.map(item => 
                      item.id === newItem.id 
                        ? { ...item, translatedText: data.text } 
                        : item
                    )
                  );
                  
                  // تنظيف AsyncStorage بعد تحديث النص المترجم في حالة الخطأ
                  AsyncStorage.removeItem('audio_cache').catch(() => {});
                  AsyncStorage.removeItem('transcription_cache').catch(() => {});
                  AsyncStorage.removeItem('translation_cache').catch(() => {});
                  
                  Logger.info('Translation fallback updated and cache cleared');
                  
                  // تنظيف إضافي بعد تحديث النصوص المترجمة في حالة الخطأ
                  AsyncStorage.removeItem('audio_cache').catch(() => {});
                  AsyncStorage.removeItem('transcription_cache').catch(() => {});
                  AsyncStorage.removeItem('translation_cache').catch(() => {});
                }
              }
            } else {
              Logger.warn('Received empty transcription text');
              
              // تنظيف AsyncStorage عند استقبال نصوص فارغة
              AsyncStorage.removeItem('audio_cache').catch(() => {});
              AsyncStorage.removeItem('transcription_cache').catch(() => {});
              AsyncStorage.removeItem('translation_cache').catch(() => {});
              
              Logger.info('Empty transcription received and cache cleared');
              
              // تنظيف إضافي بعد استقبال نصوص فارغة
              AsyncStorage.removeItem('audio_cache').catch(() => {});
              AsyncStorage.removeItem('transcription_cache').catch(() => {});
              AsyncStorage.removeItem('translation_cache').catch(() => {});
            }
          } else if (data.type === 'status') {
            Logger.info('Server status:', data.message);
            // تنظيف AsyncStorage عند استقبال رسالة حالة
            AsyncStorage.removeItem('audio_cache').catch(() => {});
            AsyncStorage.removeItem('transcription_cache').catch(() => {});
            AsyncStorage.removeItem('translation_cache').catch(() => {});
            
            Logger.info('Status message received and cache cleared');
            // يمكن إضافة مؤشر حالة هنا إذا لزم الأمر
          } else if (data.type === 'error') {
            Logger.error('Server error:', data.error);
            Logger.error('Full error details:', data);
            setError(`خطأ في السيرفر: ${data.error}`);
            
            // تنظيف AsyncStorage عند استقبال رسالة خطأ
            AsyncStorage.removeItem('audio_cache').catch(() => {});
            AsyncStorage.removeItem('transcription_cache').catch(() => {});
            AsyncStorage.removeItem('translation_cache').catch(() => {});
            
            Logger.info('Error message received and cache cleared');
          }
        } catch (error) {
          Logger.error('Failed to parse WebSocket message:', error);
          
          // تنظيف AsyncStorage عند حدوث خطأ في parsing
          AsyncStorage.removeItem('audio_cache').catch(() => {});
          AsyncStorage.removeItem('transcription_cache').catch(() => {});
          AsyncStorage.removeItem('translation_cache').catch(() => {});
          
          Logger.info('Parsing error occurred and cache cleared');
        }
      };
      
      ws.onerror = (error) => {
        Logger.error('WebSocket error event:', error);
        Logger.error('WebSocket error details:', {
          readyState: ws.readyState,
          url: ws.url,
          protocol: ws.protocol
        });
        setConnectionStatus('disconnected');
        setError('فشل في الاتصال بالخادم');
        
        // تنظيف AsyncStorage عند حدوث خطأ
        AsyncStorage.removeItem('audio_cache').catch(() => {});
        AsyncStorage.removeItem('transcription_cache').catch(() => {});
        AsyncStorage.removeItem('translation_cache').catch(() => {});
        
        Logger.info('WebSocket error occurred and cache cleared');
        
        // تنظيف إضافي بعد حدوث خطأ
        AsyncStorage.removeItem('audio_cache').catch(() => {});
        AsyncStorage.removeItem('transcription_cache').catch(() => {});
        AsyncStorage.removeItem('translation_cache').catch(() => {});
        
        Logger.info('Additional cleanup after WebSocket error');
      };
      
      ws.onclose = (event) => {
        Logger.info('WebSocket disconnected', event.code, event.reason);
        setConnectionStatus('disconnected');
        
        // تنظيف AsyncStorage عند إغلاق الاتصال
        AsyncStorage.removeItem('audio_cache').catch(() => {});
        AsyncStorage.removeItem('transcription_cache').catch(() => {});
        AsyncStorage.removeItem('translation_cache').catch(() => {});
        
        Logger.info('WebSocket closed and cache cleared');
        
        // تنظيف إضافي بعد إغلاق الاتصال
        AsyncStorage.removeItem('audio_cache').catch(() => {});
        AsyncStorage.removeItem('transcription_cache').catch(() => {});
        AsyncStorage.removeItem('translation_cache').catch(() => {});
        
        Logger.info('Additional cleanup after WebSocket closed');
        
        // إذا كان الانقطاع غير متوقع، أعد الاتصال
        if (event.code !== 1000 && isRecording) {
          Logger.info('Attempting to reconnect...');
          setTimeout(() => {
            if (isRecording) {
              initializeWebSocket();
            }
          }, 2000);
        }
      };
      
      wsRef.current = ws;
    } catch (error) {
      Logger.error('Failed to initialize WebSocket:', error);
      setConnectionStatus('disconnected');
      throw error;
    }
  };

  const startStreaming = async () => {
    if (isRecording) {
      Logger.warn('Already recording');
      return;
    }
    
    try {
      Logger.info('Starting audio streaming...');
      
      // التحقق من جاهزية خدمة الصوت
      if (!isReady) {
        Logger.warn('Audio service not ready, waiting for initialization...');
        setError('جاري تهيئة الصوت، يرجى الانتظار...');
        return;
      }
      
      // لا نقوم بتنظيف خدمة الصوت هنا لتجنب مشاكل التهيئة
      Logger.info('Starting audio streaming without cleanup');
      
      // تنظيف AsyncStorage أيضاً - فقط في الموبايل أو بعد التهيئة
      if (Platform.OS !== 'web' || isReady) {
        try {
          await AsyncStorage.removeItem('audio_cache');
          await AsyncStorage.removeItem('transcription_cache');
          await AsyncStorage.removeItem('translation_cache');
          Logger.info('Cleared AsyncStorage before starting new recording');
        } catch (error) {
          Logger.error('Failed to clear AsyncStorage:', error);
        }
      }
      
      // Initialize WebSocket connection
      await initializeWebSocket();
      
      // إزالة المستمعين القديمة لتجنب التراكم
      audioServiceRef.current.removeAllListeners();
      
      // Start audio recording with fresh data
      await audioServiceRef.current.start();
      
      // Set up audio data callback
      audioServiceRef.current.onData((chunk: any) => {
        // طباعة معلومات الـchunk للتشخيص
        const chunkSize = chunk.size || 0;
        const timestamp = Date.now();
        Logger.info(`Audio chunk received - Size: ${chunkSize} bytes, Time: ${timestamp}`);
        
        // تجاهل الـchunks الصغيرة جداً (صمت)
        if (chunkSize < 1000) {
          Logger.warn(`Skipping small chunk (${chunkSize} bytes) - likely silence`);
          return;
        }
        
        // تحويل البيانات إلى binary
        let raw: Uint8Array;
        try {
          raw = base64ToUint8Array(chunk.data);
        } catch (error) {
          Logger.error('Failed to convert chunk to binary:', error);
          return;
        }
        
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          // تنظيف AsyncStorage عند إرسال بيانات صوتية - فقط في الموبايل
          if (Platform.OS !== 'web') {
            AsyncStorage.removeItem('audio_cache').catch(() => {});
            AsyncStorage.removeItem('transcription_cache').catch(() => {});
            AsyncStorage.removeItem('translation_cache').catch(() => {});
          }
          
          // إرسال البيانات كـbinary
          wsRef.current.send(raw);
          Logger.info(`Audio chunk sent as binary - Size: ${raw.byteLength} bytes, Time: ${timestamp}`);
          
          // تحديث الـtimeout عند كل نشاط
          manageWebSocketTimeout();
        } else {
          // تخزين في القائمة المؤقتة إذا لم يكن WebSocket جاهز
          pendingChunksRef.current.push(raw);
          Logger.warn(`WebSocket not ready, chunk stored in pending queue (${pendingChunksRef.current.length} chunks)`);
        }
      });
      
    setIsRecording(true);
      setError(null);
      
      // NEW: Clear real-time data when starting
      if (isRealTimeMode) {
        setRealTimeTranscription('');
        setRealTimeTranslation('');
        Logger.info('Cleared real-time data for new recording');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Failed to start streaming:', errorMessage);
      setError(`فشل في بدء التسجيل: ${errorMessage}`);
      setIsRecording(false);
      setConnectionStatus('disconnected');
    }
  };

  const stopStreaming = async () => {
    try {
      Logger.info('Stopping audio streaming...');
      
      if (audioServiceRef.current && isReady) {
        await audioServiceRef.current.stop();
        Logger.info('Audio service stopped');
      }
      
      // تنظيف القائمة المؤقتة
      pendingChunksRef.current = [];
      Logger.info('Pending chunks cleared');
      
      // إلغاء الـtimeout
      if (wsTimeoutRef.current) {
        clearTimeout(wsTimeoutRef.current);
        Logger.info('WebSocket timeout cleared');
      }
      
      // تنظيف AsyncStorage بعد الإيقاف - فقط في الموبايل
      if (Platform.OS !== 'web') {
        try {
          await AsyncStorage.removeItem('audio_cache');
          await AsyncStorage.removeItem('transcription_cache');
          await AsyncStorage.removeItem('translation_cache');
          Logger.info('Cleared AsyncStorage after stopping');
        } catch (error) {
          Logger.error('Failed to clear AsyncStorage after stopping:', error);
        }
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      setIsRecording(false);
      setConnectionStatus('disconnected');
      
      // NEW: Save real-time transcription to history if exists
      if (isRealTimeMode && realTimeTranscription) {
        // تجنب إضافة نفس النص مرتين
        const isDuplicate = transcriptions.some(item => 
          item.originalText === realTimeTranscription
        );
        
        if (!isDuplicate) {
          // تنظيف AsyncStorage قبل حفظ النص المباشر في التاريخ
          AsyncStorage.removeItem('audio_cache').catch(() => {});
          AsyncStorage.removeItem('transcription_cache').catch(() => {});
          AsyncStorage.removeItem('translation_cache').catch(() => {});
          
          Logger.info('Real-time text saved to history and cache cleared');
          
          // تنظيف إضافي قبل حفظ النصوص المباشرة في التاريخ
          AsyncStorage.removeItem('audio_cache').catch(() => {});
          AsyncStorage.removeItem('transcription_cache').catch(() => {});
          AsyncStorage.removeItem('translation_cache').catch(() => {});
          
          Logger.info('Saving real-time transcription to history:', realTimeTranscription);
          const newItem: TranscriptionItem = {
            id: Date.now().toString(),
            originalText: realTimeTranscription,
            translatedText: realTimeTranslation,
            timestamp: new Date()
          };
          setTranscriptions(prev => [...prev, newItem]);
        }
        setRealTimeTranscription('');
        setRealTimeTranslation('');
      }
      
      Logger.info('Audio streaming stopped');
    } catch (error) {
      Logger.error('Failed to stop streaming:', error);
    }
  };

  const handleTargetLanguageChange = async (newTargetLanguage: Language) => {
    setSelectedTargetLanguage(newTargetLanguage);
    
    // تنظيف AsyncStorage عند تغيير اللغة - فقط في الموبايل
    if (Platform.OS !== 'web') {
      try {
        await AsyncStorage.removeItem('audio_cache');
        await AsyncStorage.removeItem('transcription_cache');
        await AsyncStorage.removeItem('translation_cache');
        Logger.info('Cleared AsyncStorage on language change');
      } catch (error) {
        Logger.error('Failed to clear AsyncStorage on language change:', error);
      }
    }
    
    // Retranslate existing transcriptions
    const retranslated = await Promise.all(
      transcriptions.map(async (item) => {
        try {
          // تنظيف AsyncStorage قبل إعادة الترجمة
          AsyncStorage.removeItem('audio_cache').catch(() => {});
          AsyncStorage.removeItem('transcription_cache').catch(() => {});
          AsyncStorage.removeItem('translation_cache').catch(() => {});
          
          const newTranslatedText = await SpeechService.translateText(
            item.originalText,
            newTargetLanguage.code,
            selectedSourceLanguage
          );
          return { ...item, translatedText: newTranslatedText };
        } catch (error) {
          Logger.error('Failed to retranslate item:', error);
          
          // تنظيف AsyncStorage عند حدوث خطأ في إعادة ترجمة النص
          AsyncStorage.removeItem('audio_cache').catch(() => {});
          AsyncStorage.removeItem('transcription_cache').catch(() => {});
          AsyncStorage.removeItem('translation_cache').catch(() => {});
          
          Logger.info('Retranslation error and cache cleared');
          
          // تنظيف إضافي بعد حدوث خطأ في إعادة ترجمة النصوص
          AsyncStorage.removeItem('audio_cache').catch(() => {});
          AsyncStorage.removeItem('transcription_cache').catch(() => {});
          AsyncStorage.removeItem('translation_cache').catch(() => {});
          
          return item;
        }
      })
    );
    setTranscriptions(retranslated);
    
    // تنظيف AsyncStorage بعد إعادة ترجمة جميع النصوص
    AsyncStorage.removeItem('audio_cache').catch(() => {});
    AsyncStorage.removeItem('transcription_cache').catch(() => {});
    AsyncStorage.removeItem('translation_cache').catch(() => {});
    
    Logger.info('All transcriptions retranslated and cache cleared');
    
    // تنظيف إضافي بعد إعادة ترجمة جميع النصوص
    AsyncStorage.removeItem('audio_cache').catch(() => {});
    AsyncStorage.removeItem('transcription_cache').catch(() => {});
    AsyncStorage.removeItem('translation_cache').catch(() => {});
    
         // NEW: Retranslate real-time content
     if (isRealTimeMode && realTimeTranscription) {
       try {
         // تنظيف AsyncStorage قبل إعادة ترجمة النص المباشر
         AsyncStorage.removeItem('audio_cache').catch(() => {});
         AsyncStorage.removeItem('transcription_cache').catch(() => {});
         AsyncStorage.removeItem('translation_cache').catch(() => {});
         
         Logger.info('Retranslating real-time content to:', newTargetLanguage.code);
         const newTranslatedText = await SpeechService.translateText(
           realTimeTranscription,
           newTargetLanguage.code,
           selectedSourceLanguage
         );
         Logger.info('Real-time retranslation result:', newTranslatedText);
         setRealTimeTranslation(newTranslatedText);
         
         // تنظيف AsyncStorage بعد تحديث النص المترجم المباشر
         AsyncStorage.removeItem('audio_cache').catch(() => {});
         AsyncStorage.removeItem('transcription_cache').catch(() => {});
         AsyncStorage.removeItem('translation_cache').catch(() => {});
         
         Logger.info('Real-time translation updated and cache cleared');
         
         // تنظيف إضافي بعد تحديث النصوص المترجمة في الوضع المباشر
         AsyncStorage.removeItem('audio_cache').catch(() => {});
         AsyncStorage.removeItem('transcription_cache').catch(() => {});
         AsyncStorage.removeItem('translation_cache').catch(() => {});
    } catch (error) {
         Logger.error('Failed to retranslate real-time content:', error);
         
         // تنظيف AsyncStorage عند حدوث خطأ في إعادة ترجمة النص المباشر
         AsyncStorage.removeItem('audio_cache').catch(() => {});
         AsyncStorage.removeItem('transcription_cache').catch(() => {});
         AsyncStorage.removeItem('translation_cache').catch(() => {});
         
         Logger.info('Real-time retranslation error and cache cleared');
         
         // تنظيف إضافي بعد حدوث خطأ في إعادة ترجمة النصوص المباشرة
         AsyncStorage.removeItem('audio_cache').catch(() => {});
         AsyncStorage.removeItem('transcription_cache').catch(() => {});
         AsyncStorage.removeItem('translation_cache').catch(() => {});
       }
     }
    
    // Notify server of language update
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const sourceLang = selectedSourceLanguage && selectedSourceLanguage !== 'auto' ? selectedSourceLanguage : 'ar';
      const azureSourceLang = convertToAzureLanguage(sourceLang);
      const azureTargetLang = convertToAzureLanguage(newTargetLanguage.code);
      
      const languageUpdateMessage = {
        type: 'language_update',
        sourceLanguage: azureSourceLang,
        targetLanguage: azureTargetLang,
        clientSideTranslation: true
      };
      wsRef.current.send(JSON.stringify(languageUpdateMessage));
      
      // تنظيف AsyncStorage بعد إرسال رسالة تحديث اللغة
      AsyncStorage.removeItem('audio_cache').catch(() => {});
      AsyncStorage.removeItem('transcription_cache').catch(() => {});
      AsyncStorage.removeItem('translation_cache').catch(() => {});
      
      Logger.info('Language update message sent and cache cleared');
      
             // تنظيف إضافي بعد إرسال رسالة تحديث اللغة
       AsyncStorage.removeItem('audio_cache').catch(() => {});
       AsyncStorage.removeItem('transcription_cache').catch(() => {});
       AsyncStorage.removeItem('translation_cache').catch(() => {});
       
       Logger.info('Additional cleanup after language update message');
    }
  };

  // NEW: Toggle real-time mode
  const toggleRealTimeMode = () => {
    setIsRealTimeMode(!isRealTimeMode);
    if (isRealTimeMode) {
      // Switching from real-time to traditional mode
      if (realTimeTranscription) {
        // تجنب إضافة نفس النص مرتين
        const isDuplicate = transcriptions.some(item => 
          item.originalText === realTimeTranscription
        );
        
        if (!isDuplicate) {
          // تنظيف AsyncStorage قبل إضافة نص مكرر في الوضع التقليدي
          AsyncStorage.removeItem('audio_cache').catch(() => {});
          AsyncStorage.removeItem('transcription_cache').catch(() => {});
          AsyncStorage.removeItem('translation_cache').catch(() => {});
          
          Logger.info('Traditional duplicate text added and cache cleared');
          
          // تنظيف إضافي قبل إضافة نصوص مكررة في الوضع التقليدي
          AsyncStorage.removeItem('audio_cache').catch(() => {});
          AsyncStorage.removeItem('transcription_cache').catch(() => {});
          AsyncStorage.removeItem('translation_cache').catch(() => {});
          
          const newItem: TranscriptionItem = {
            id: Date.now().toString(),
            originalText: realTimeTranscription,
            translatedText: realTimeTranslation,
            timestamp: new Date()
          };
          setTranscriptions(prev => [...prev, newItem]);
        }
      }
      setRealTimeTranscription('');
      setRealTimeTranslation('');
      
      // تنظيف AsyncStorage عند تغيير الوضع - فقط في الموبايل
      if (Platform.OS !== 'web') {
        AsyncStorage.removeItem('audio_cache').catch(() => {});
        AsyncStorage.removeItem('transcription_cache').catch(() => {});
        AsyncStorage.removeItem('translation_cache').catch(() => {});
      }
    }
    Logger.info('Real-time mode toggled to:', !isRealTimeMode);
  };

  const clearTranscriptions = () => {
    setTranscriptions([]);
    setRealTimeTranscription('');
    setRealTimeTranslation('');
    
    // تنظيف AsyncStorage أيضاً - فقط في الموبايل
    if (Platform.OS !== 'web') {
      AsyncStorage.removeItem('audio_cache').catch(() => {});
      AsyncStorage.removeItem('transcription_cache').catch(() => {});
      AsyncStorage.removeItem('translation_cache').catch(() => {});
    }
    
    Logger.info('Cleared all transcriptions and cache');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Translation</Text>
      
      {/* NEW: Real-time mode toggle */}
      <View style={styles.realTimeToggle}>
        <Text style={styles.toggleLabel}>Real-time Translation</Text>
        <TouchableOpacity
          style={[styles.toggleButton, isRealTimeMode && styles.toggleButtonActive]}
          onPress={toggleRealTimeMode}
        >
          <Text style={[styles.toggleText, isRealTimeMode && styles.toggleTextActive]}>
            {isRealTimeMode ? 'ON' : 'OFF'}
        </Text>
        </TouchableOpacity>
      </View>

             {/* Language selector */}
       <View style={styles.languageSelector}>
        <LanguageSelector
          selectedLanguage={selectedTargetLanguage}
           onSelectLanguage={handleTargetLanguageChange}
           disabled={isRecording}
        />
      </View>
      
      {/* NEW: Real-time display */}
      {isRealTimeMode && isRecording && (
        <View style={styles.realTimeContainer}>
          <View style={styles.realTimeSection}>
            <Text style={styles.realTimeLabel}>LIVE Original</Text>
            <Text style={styles.realTimeText}>{realTimeTranscription || 'Listening...'}</Text>
          </View>
          <View style={styles.realTimeSection}>
            <Text style={styles.realTimeLabel}>LIVE Translation</Text>
            <Text style={styles.realTimeText}>{realTimeTranslation || 'Translating...'}</Text>
          </View>
        </View>
      )}
      
      {/* Error display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

             {/* Traditional transcriptions list */}
       {(!isRealTimeMode || !isRecording) && (
         <ScrollView style={styles.transcriptionContainer}>
          {transcriptions.length === 0 ? (
            <Text style={styles.emptyText}>
              {isRealTimeMode ? 'Start recording to see real-time translation!' : 'No transcriptions yet'}
          </Text>
          ) : (
            transcriptions.map((item) => (
              <View key={item.id} style={styles.transcriptionItem}>
                <View style={styles.originalSection}>
                  <Text style={styles.sectionLabel}>Original</Text>
                  <Text style={styles.transcriptionText}>{item.originalText}</Text>
                    </View>
                <View style={styles.translationSection}>
                  <Text style={styles.sectionLabel}>Translation</Text>
                  <Text style={styles.transcriptionText}>{item.translatedText}</Text>
                  </View>
              </View>
            ))
            )}
          </ScrollView>
      )}

      {/* Action buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
              styles.recordButton,
              (isInitializing || !selectedTargetLanguage || !isReady) && styles.disabledButton
          ]}
          onPress={isRecording ? stopStreaming : startStreaming}
          disabled={isInitializing || !selectedTargetLanguage || !isReady}
          >
            <Text style={styles.recordButtonText}>
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </Text>
          </TouchableOpacity>
          
          {transcriptions.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={clearTranscriptions}>
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          )}
      </View>
      
      {/* Reconnect button */}
      {connectionStatus === 'disconnected' && !isRecording && (
        <View style={styles.reconnectContainer}>
          <TouchableOpacity 
            style={styles.reconnectButton} 
            onPress={initializeWebSocket}
          >
            <Text style={styles.reconnectButtonText}>Reconnect</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Status message for initialization */}
      {!isReady && !isInitializing && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {Platform.OS === 'web' 
              ? 'Initializing microphone access...' 
              : 'جاري تهيئة الصوت...'
            }
          </Text>
        </View>
      )}
      
      {/* Status message while initializing */}
      {isInitializing && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {Platform.OS === 'web' 
              ? 'Setting up audio service...' 
              : 'جاري إعداد خدمة الصوت...'
            }
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  realTimeToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  toggleButton: {
    backgroundColor: '#fff',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  toggleButtonActive: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  toggleText: {
    color: '#333',
    fontSize: 14,
    fontWeight: 'bold',
  },
  toggleTextActive: {
    color: '#fff',
  },
  languageSelector: {
    marginBottom: 20,
  },
  realTimeContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  realTimeSection: {
    marginBottom: 10,
  },
  realTimeLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  realTimeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  transcriptionContainer: {
    flex: 1,
    padding: 10,
  },
  transcriptionItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 8,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  originalSection: {
    flex: 1,
    marginRight: 10,
  },
  translationSection: {
    flex: 1,
    marginLeft: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  transcriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    margin: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  recordButton: {
    backgroundColor: '#4caf50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusContainer: {
    backgroundColor: '#e3f2fd',
    padding: 10,
    marginTop: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  statusText: {
    color: '#1976d2',
    fontSize: 14,
    textAlign: 'center',
  },
  reconnectContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  reconnectButton: {
    backgroundColor: '#ff9800',
    padding: 10,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  reconnectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
}); 