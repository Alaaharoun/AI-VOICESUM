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
  const [selectedSourceLanguage, setSelectedSourceLanguage] = useState<Language | null>(null);
  const [selectedTargetLanguage, setSelectedTargetLanguage] = useState<Language | null>(null);
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  // Real-time translation state (always enabled now)
  const isRealTimeMode = true; // Always enabled
  const [realTimeTranscription, setRealTimeTranscription] = useState<string>('');
  const [realTimeTranslation, setRealTimeTranslation] = useState<string>('');
  const [showSummaryButton, setShowSummaryButton] = useState(false);

  // Refs
  const audioServiceRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const translationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChunksRef = useRef<Uint8Array[]>([]); // قائمة مؤقتة للـchunks
  const wsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // timeout للـWebSocket
  const lastActivityRef = useRef<number>(Date.now()); // آخر نشاط للـWebSocket
  const chunkBufferRef = useRef<Uint8Array[]>([]); // buffer لتجميع الـchunks
  const chunkBufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // timeout لتجميع الـchunks
  const maxBufferTimeRef = useRef<number>(10000); // أقصى وقت للتجميع (10 ثوانٍ للاختبار)

  // Initialize languages
  useEffect(() => {
    const languages = SpeechService.getAvailableLanguages();
    
    // Initialize target language
    const targetLang = languages.find(lang => lang.code === targetLanguage) || languages[0];
    setSelectedTargetLanguage(targetLang);
    
    // Initialize source language (default to auto-detect)
    const sourceLang = languages.find(lang => lang.code === sourceLanguage) || { code: 'auto', name: 'Auto Detect', flag: '🌐' };
    setSelectedSourceLanguage(sourceLang);
  }, [targetLanguage, sourceLanguage]);

  // Helper function to convert language codes to Azure format
  const convertToAzureLanguage = (langCode: string): string => {
    // فقط اللغات المدعومة من Azure Speech Service
    const azureLanguageMap: { [key: string]: string } = {
      'ar': 'ar-SA', 'en': 'en-US', 'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE',
      'it': 'it-IT', 'pt': 'pt-BR', 'ru': 'ru-RU', 'ja': 'ja-JP', 'ko': 'ko-KR',
      'zh': 'zh-CN', 'tr': 'tr-TR', 'nl': 'nl-NL', 'pl': 'pl-PL', 'sv': 'sv-SE',
      'da': 'da-DK', 'no': 'no-NO', 'fi': 'fi-FI', 'cs': 'cs-CZ', 'sk': 'sk-SK',
      'hu': 'hu-HU', 'ro': 'ro-RO', 'bg': 'bg-BG', 'hr': 'hr-HR', 'sl': 'sl-SI',
      'et': 'et-EE', 'lv': 'lv-LV', 'lt': 'lt-LT', 'el': 'el-GR', 'he': 'he-IL',
      'th': 'th-TH', 'vi': 'vi-VN', 'id': 'id-ID', 'ms': 'ms-MY', 'fil': 'fil-PH',
      'hi': 'hi-IN', 'bn': 'bn-IN', 'ur': 'ur-PK', 'fa': 'fa-IR', 'uk': 'uk-UA'
    };
    
    const azureCode = azureLanguageMap[langCode];
    if (!azureCode) {
      Logger.warn(`Unsupported language code: ${langCode}, defaulting to ar-SA`);
      return 'ar-SA';
    }
    
    Logger.info(`Language conversion: ${langCode} → ${azureCode}`);
    return azureCode;
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
      
      // Configure audio service for Azure Speech SDK compatibility
      const audioConfig = {
        sampleRate: 16000, // Azure Speech SDK expects 16kHz
        channels: 1, // Mono
        bitsPerSample: 16, // 16-bit
        encoding: 'pcm_s16le' // Linear PCM 16-bit little-endian
      };
      
      await audioService.init(audioConfig);
      audioServiceRef.current = audioService;
      
      setIsReady(true);
      Logger.info('Audio service initialized successfully with Azure-compatible settings:', audioConfig);
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
    if (chunkBufferTimeoutRef.current) {
      clearTimeout(chunkBufferTimeoutRef.current);
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
    
    // تعيين timeout جديد (5 دقائق)
    wsTimeoutRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        Logger.info('WebSocket timeout reached, closing connection');
        wsRef.current.close(1000, 'Timeout - no activity');
      }
    }, 300000); // 5 دقائق
  };

  // دالة لتجميع وإرسال الـchunks
  const sendBufferedChunks = () => {
    Logger.info(`[sendBufferedChunks] Called with ${chunkBufferRef.current.length} chunks in buffer`);
    
    if (chunkBufferRef.current.length === 0) {
      Logger.warn(`[sendBufferedChunks] No chunks to send`);
      return;
    }
    
    // دمج جميع الـchunks في chunk واحد كبير
    const totalSize = chunkBufferRef.current.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combinedChunk = new Uint8Array(totalSize);
    
    let offset = 0;
    chunkBufferRef.current.forEach((chunk, index) => {
      Logger.info(`[sendBufferedChunks] Combining chunk ${index + 1}: ${chunk.byteLength} bytes at offset ${offset}`);
      combinedChunk.set(chunk, offset);
      offset += chunk.byteLength;
    });
    
    // Validate the combined chunk for Azure Speech SDK
    const durationSeconds = totalSize / (16000 * 2); // 16kHz, 16-bit = 2 bytes per sample
    Logger.info(`[sendBufferedChunks] 🚀 SENDING COMBINED CHUNK:
      - Total size: ${combinedChunk.byteLength} bytes
      - From ${chunkBufferRef.current.length} chunks
      - Estimated duration: ${durationSeconds.toFixed(2)}s
      - Sample rate validation: ${totalSize % 2 === 0 ? '✅ Valid' : '❌ Invalid (not 16-bit aligned)'}`);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(combinedChunk);
        manageWebSocketTimeout();
        Logger.info(`[sendBufferedChunks] ✅ Combined chunk sent successfully to Azure Speech SDK`);
      } catch (sendError) {
        Logger.error(`[sendBufferedChunks] ❌ Failed to send chunk:`, sendError);
        pendingChunksRef.current.push(combinedChunk);
        Logger.warn(`[sendBufferedChunks] ⚠️ Chunk stored in pending queue due to send error`);
      }
    } else {
      pendingChunksRef.current.push(combinedChunk);
      const wsState = wsRef.current?.readyState;
      const wsStateText = wsState === 0 ? 'CONNECTING' : wsState === 1 ? 'OPEN' : wsState === 2 ? 'CLOSING' : wsState === 3 ? 'CLOSED' : 'UNKNOWN';
      Logger.warn(`[sendBufferedChunks] ⚠️ WebSocket not ready (state: ${wsState}/${wsStateText}), combined chunk stored in pending queue`);
    }
    
    // تفريغ الـbuffer
    chunkBufferRef.current = [];
    Logger.info(`[sendBufferedChunks] Buffer cleared`);
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
        
        // Get source and target languages
        const sourceLang = selectedSourceLanguage?.code || 'auto';
        const targetLang = selectedTargetLanguage?.code || 'en';
        
        // For Azure, convert to Azure format or use default for auto detection
        const azureSourceLang = sourceLang === 'auto' ? 'en-US' : convertToAzureLanguage(sourceLang);
        const azureTargetLang = convertToAzureLanguage(targetLang);
        
        // Validate target language only (source is auto)
        if (!supportedLanguages.includes(targetLang)) {
          Logger.error('Unsupported target language:', targetLang);
          setError(`Unsupported target language: ${targetLang}`);
          return;
        }
        
        Logger.info('Language configuration - Source:', sourceLang, '→', azureSourceLang, 'Target:', targetLang, '→', azureTargetLang);
        
        // Send initialization message with simplified configuration
        const initMessage = {
          type: 'init',
          language: azureSourceLang, // Use default English for Azure when auto is selected
          targetLanguage: azureTargetLang,
          clientSideTranslation: true,
          realTimeMode: isRealTimeMode,
          autoDetection: sourceLang === 'auto', // True only when auto detection is selected
          audioConfig: {
            sampleRate: 16000,
            channels: 1,
            bitsPerSample: 16,
            encoding: 'pcm_s16le'
          }
        };
        
        ws.send(JSON.stringify(initMessage));
        Logger.info('Init message sent with auto detection:', initMessage);
        
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
                    selectedSourceLanguage?.code
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
                    selectedSourceLanguage?.code
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
      setShowSummaryButton(false); // Hide summary button when starting new recording
      
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
        
        // Calculate expected chunk size for 16kHz, 16-bit, mono PCM
        // For 100ms chunks: 16000 samples/sec * 0.1 sec * 2 bytes/sample = 3200 bytes
        const expectedChunkSize = Math.floor(16000 * 0.1 * 2); // ~3200 bytes for 100ms
        
        Logger.info(`[onData] 🎵 Audio chunk received - Size: ${chunkSize} bytes, Time: ${timestamp}, Expected: ~${expectedChunkSize} bytes (100ms @ 16kHz)`);
        
        // تجاهل الـchunks الصغيرة جداً (صمت) - عتبة محدثة للـ16kHz
        if (chunkSize < 1600) { // ~50ms worth of audio at 16kHz
          Logger.warn(`[onData] ⏭️ Skipping small chunk (${chunkSize} bytes) - likely silence`);
          return;
        }
        
        // تحويل البيانات إلى binary
        let raw: Uint8Array;
        try {
          raw = base64ToUint8Array(chunk.data);
          Logger.info(`[onData] ✅ Successfully converted chunk to Uint8Array: ${raw.byteLength} bytes`);
          
          // Validate audio data format (basic check)
          if (raw.byteLength % 2 !== 0) {
            Logger.warn(`[onData] ⚠️ Audio chunk size not aligned to 16-bit samples: ${raw.byteLength} bytes`);
          }
          
        } catch (error) {
          Logger.error('[onData] ❌ Failed to convert chunk to binary:', error);
          return;
        }
        
        // إضافة الـchunk إلى الـbuffer
        chunkBufferRef.current.push(raw);
        Logger.info(`[onData] 📦 Added chunk to buffer. Buffer now has ${chunkBufferRef.current.length} chunks`);
        
        // تحديد استراتيجية الإرسال بناءً على حجم البيانات - إرسال مستمر بدون timeout
        const bufferSize = chunkBufferRef.current.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const targetBufferSize = 32000; // ~1 second of 16kHz 16-bit mono audio (تقليل الحجم للاستجابة الأسرع)
        
        // إرسال البيانات فوراً عند الوصول للحجم المطلوب (بدون timeout)
        if (bufferSize >= targetBufferSize) {
          Logger.info(`[onData] 🚀 Buffer size reached target (${bufferSize}/${targetBufferSize} bytes), sending immediately`);
          sendBufferedChunks();
          return;
        }
        
        // إلغاء الـtimeout السابق للتجميع
        if (chunkBufferTimeoutRef.current) {
          clearTimeout(chunkBufferTimeoutRef.current);
          Logger.info(`[onData] ⏰ Cleared previous buffer timeout`);
        }
        
        // لا نستخدم timeout في الترجمة الفورية - فقط إرسال مباشر أو عند الإيقاف
        if (!isRealTimeMode) {
          // للتسجيل العادي فقط - استخدام timeout
          const bufferTimeout = 2000; // 2 seconds for regular recording
          chunkBufferTimeoutRef.current = setTimeout(() => {
            Logger.info(`[onData] ⏰ Buffer timeout reached (${bufferTimeout}ms), calling sendBufferedChunks`);
            sendBufferedChunks();
          }, bufferTimeout);
          
          Logger.info(`[onData] ⏰ Set buffer timeout for regular mode: ${bufferTimeout}ms (buffer size: ${bufferSize}/${targetBufferSize} bytes)`);
        } else {
          Logger.info(`[onData] 🔴 Real-time mode: No timeout, buffer will be sent only on size target or stop (buffer size: ${bufferSize}/${targetBufferSize} bytes)`);
        }
        
        // تنظيف AsyncStorage عند إرسال بيانات صوتية - فقط في الموبايل
        if (Platform.OS !== 'web') {
          AsyncStorage.removeItem('audio_cache').catch(() => {});
          AsyncStorage.removeItem('transcription_cache').catch(() => {});
          AsyncStorage.removeItem('translation_cache').catch(() => {});
        }
      });
      
      setIsRecording(true);
      setError(null);
      
      // تنظيف الـbuffer عند بدء التسجيل
      chunkBufferRef.current = [];
      Logger.info('[startStreaming] 🧹 Cleared chunk buffer for new recording session');
      
      // إلغاء أي timeout موجود من جلسة سابقة
      if (chunkBufferTimeoutRef.current) {
        clearTimeout(chunkBufferTimeoutRef.current);
        chunkBufferTimeoutRef.current = null;
        Logger.info('[startStreaming] ⏰ Cleared any existing buffer timeout');
      }
      
      // NEW: Clear real-time data when starting
      if (isRealTimeMode) {
        setRealTimeTranscription('');
        setRealTimeTranslation('');
        Logger.info('[startStreaming] 🔴 Real-time mode: Cleared real-time data for new recording');
      }
      
      Logger.info(`[startStreaming] ✅ Live streaming started successfully (Real-time mode: ${isRealTimeMode})`);
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
      
      // إرسال أي chunks متبقية في الـbuffer قبل الإيقاف
      if (chunkBufferRef.current.length > 0) {
        Logger.info(`[stopStreaming] 📤 Sending remaining ${chunkBufferRef.current.length} chunks before stopping`);
        sendBufferedChunks();
      }
      
      if (audioServiceRef.current && isReady) {
        await audioServiceRef.current.stop();
        Logger.info('Audio service stopped');
      }
      
      // تنظيف الـbuffer بعد الإرسال
      chunkBufferRef.current = [];
      Logger.info('[stopStreaming] 🧹 Buffer cleared after sending remaining chunks');
      
      // تنظيف القائمة المؤقتة
      pendingChunksRef.current = [];
      Logger.info('Pending chunks cleared');
      
      // إلغاء أي timeout موجود
      if (chunkBufferTimeoutRef.current) {
        clearTimeout(chunkBufferTimeoutRef.current);
        chunkBufferTimeoutRef.current = null;
        Logger.info('Buffer timeout cleared');
      }
      
      // إلغاء الـtimeout الحالي
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
      
      setIsRecording(false);
      
      // إبقاء الاتصال مفتوحًا لمدة دقيقة إضافية للحصول على النتائج النهائية
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        Logger.info('Keeping WebSocket connection open for 1 minute to receive final results');
        
        // تعيين timeout جديد لإغلاق الاتصال بعد دقيقة
        wsTimeoutRef.current = setTimeout(() => {
          if (wsRef.current) {
            Logger.info('Closing WebSocket connection after 1 minute timeout');
            wsRef.current.close();
            setConnectionStatus('disconnected');
          }
        }, 60000); // دقيقة واحدة
      } else {
        setConnectionStatus('disconnected');
      }
      
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
      
      Logger.info('Audio streaming stopped successfully. Final buffer cleared only once at stop.');
      
      // Show summary button if we have transcriptions
      setTimeout(() => {
        if (transcriptions.length > 0 || realTimeTranscription) {
          Logger.info('Showing AI Summary button');
          setShowSummaryButton(true);
        }
      }, 1000); // Wait 1 second for any final transcriptions
      
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
            selectedSourceLanguage?.code
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
           selectedSourceLanguage?.code
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
      const sourceLang = selectedSourceLanguage && selectedSourceLanguage.code !== 'auto' ? selectedSourceLanguage.code : 'ar';
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

  // Real-time mode is now always enabled, no toggle needed
  
  const navigateToSummary = () => {
    Logger.info('User chose to navigate to summary page');
    router.push('/summary-view');
  };

  const dismissSummaryButton = () => {
    setShowSummaryButton(false);
    Logger.info('Summary button dismissed by user');
  };

  const clearTranscriptions = () => {
    setTranscriptions([]);
    setRealTimeTranscription('');
    setRealTimeTranslation('');
    setShowSummaryButton(false); // Hide summary button when clearing
    
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
      
      {/* Source Language selector */}
      <View style={styles.languageSelector}>
                 <Text style={styles.sectionLabel}>From (Source Language):</Text>
        <LanguageSelector
          selectedLanguage={selectedSourceLanguage}
          onSelectLanguage={setSelectedSourceLanguage}
          disabled={false}
        />
      </View>

             {/* Target Language selector */}
       <View style={styles.languageSelector}>
         <Text style={styles.sectionLabel}>To (Target Language):</Text>
        <LanguageSelector
          selectedLanguage={selectedTargetLanguage}
           onSelectLanguage={handleTargetLanguageChange}
           disabled={false}
        />
      </View>
      
      {/* Live Translation Display - Old Style Design */}
      <View style={styles.translationDisplay}>
        <View style={styles.translationCard}>
          {/* Live real-time section when recording */}
          {isRecording && (
            <View style={styles.liveSection}>
              <View style={styles.originalBox}>
                <Text style={styles.boxTitle}>Original</Text>
                <Text style={styles.liveText}>{realTimeTranscription || 'Listening...'}</Text>
              </View>
              <View style={styles.translationBox}>
                <Text style={styles.boxTitle}>Translation</Text>
                <Text style={styles.liveText}>{realTimeTranslation || 'Translating...'}</Text>
              </View>
            </View>
          )}
          
          {/* Historical transcriptions */}
          <ScrollView style={styles.historyContainer}>
            {transcriptions.length === 0 && !isRecording ? (
              <Text style={styles.emptyText}>
                Start recording to see live translation!
              </Text>
            ) : (
              transcriptions.map((item) => (
                <View key={item.id} style={styles.historyItem}>
                  <View style={styles.originalBox}>
                    <Text style={styles.boxTitle}>Original</Text>
                    <Text style={styles.historyText}>{item.originalText}</Text>
                  </View>
                  <View style={styles.translationBox}>
                    <Text style={styles.boxTitle}>Translation</Text>
                    <Text style={styles.historyText}>{item.translatedText}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
      
      {/* Error display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
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
              {isRecording ? 'Stop Live Streaming' : 'Start Live Streaming'}
            </Text>
          </TouchableOpacity>
          
          {transcriptions.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={clearTranscriptions}>
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          )}
      </View>
      
      {/* AI Summary button - shows after recording ends */}
      {showSummaryButton && !isRecording && (
        <View style={styles.summaryButtonContainer}>
          <TouchableOpacity style={styles.summaryButton} onPress={navigateToSummary}>
            <Text style={styles.summaryButtonText}>🤖 AI Summary</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dismissButton} onPress={dismissSummaryButton}>
            <Text style={styles.dismissButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Reconnect button */}
      {connectionStatus === 'disconnected' && !isRecording && (
        <View style={styles.reconnectContainer}>
          <TouchableOpacity 
            style={styles.reconnectButton} 
            onPress={initializeWebSocket}
          >
            <Text style={styles.reconnectButtonText}>
              {Platform.OS === 'web' ? 'Reconnect' : 'إعادة الاتصال'}
            </Text>
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
      
      {/* Status message for connection kept open */}
      {!isRecording && connectionStatus === 'connected' && (
        <View style={[styles.statusContainer, { backgroundColor: '#e8f5e8', borderLeftColor: '#4caf50' }]}>
          <Text style={[styles.statusText, { color: '#2e7d32' }]}>
            {Platform.OS === 'web' 
              ? 'Connection kept open for 1 minute...' 
              : 'الاتصال مفتوح لمدة دقيقة...'
            }
          </Text>
        </View>
      )}
      
      {/* Removed chunks status message as requested by user */}
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
  // New styles for improved design
  translationDisplay: {
    flex: 1,
    marginVertical: 10,
  },
  translationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    margin: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 200,
  },
  liveSection: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  originalBox: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  translationBox: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  boxTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  liveText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    fontWeight: '500',
  },
  historyContainer: {
    maxHeight: 300,
  },
  historyItem: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  // AI Summary button styles
  summaryButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
    paddingHorizontal: 20,
  },
  summaryButton: {
    backgroundColor: '#4caf50',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  summaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dismissButton: {
    backgroundColor: '#ff9800',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 