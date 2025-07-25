import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
} from 'react-native';
import { router, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useAuth';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { RecordButton } from '@/components/RecordButton';
import { TranscriptionCard } from '@/components/TranscriptionCard';
import { LanguageSelector } from '@/components/LanguageSelector';
import { supabase } from '@/lib/supabase';
import { Crown, Sparkles, Settings, Clock, Timer, CircleAlert as AlertCircle, Languages, Save } from 'lucide-react-native';
import { ensureMicPermission } from '@/utils/permissionHelper';
import AudioRecord from 'react-native-audio-record';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 24,
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
    marginLeft: 8,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#DC2626',
    marginLeft: 8,
    textAlign: 'center',
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    marginHorizontal: 24,
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  trialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  trialText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#047857',
    marginLeft: 8,
  },
  progressContainer: {
    width: '100%',
    marginTop: 8,
  },
  progressBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#DC2626',
    marginTop: 4,
    textAlign: 'center',
  },
  expiredBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#EF4444',
  },
  expiredText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#DC2626',
    marginLeft: 8,
  },
  realTimeToggleContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  realTimeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  realTimeToggleActive: {
    backgroundColor: '#EFF6FF',
  },
  realTimeToggleText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginLeft: 8,
  },
  realTimeToggleTextActive: {
    color: '#2563EB',
  },
  realTimeHint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 8,
  },
  recordingSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  recordingStatus: {
    alignItems: 'center',
    marginTop: 24,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingTextContainer: {
    alignItems: 'center',
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginBottom: 4,
  },
  recordingText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#DC2626',
  },
  recordingHint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#DC2626',
    opacity: 0.8,
    marginTop: 2,
  },
  remainingText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#DC2626',
    marginTop: 2,
  },
  processingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  processingText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#2563EB',
    marginLeft: 8,
  },
  instructions: {
    backgroundColor: 'white',
    margin: 24,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  instructionsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
  },
  instructionsText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  instructionsHint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  settingsSection: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  settingsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsToggleText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginLeft: 8,
  },
  languageSelectorContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  languageSelectorLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 12,
  },
  languageHint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  freeTrialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    marginTop: 16,
    justifyContent: 'center',
  },
  freeTrialButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  text: {
    color: '#1F2937',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  remainingTimeBanner: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 24,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  remainingTimeText: {
    color: '#059669',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    flexWrap: 'wrap',
  },
  remainingTimeUsage: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'right',
    flex: 1,
    flexWrap: 'wrap',
  },
  miniBanner: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'center',
    marginTop: 24,
    marginBottom: 16,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 350,
  },
});

export default function RecordScreen() {
  const { user } = useAuth();
  const { 
    isSubscribed, 
    hasFreeTrial, 
    freeTrialExpired, 
    hasRemainingTrialTime,
    dailyUsageSeconds,
    dailyLimitSeconds,
    updateDailyUsage,
    getRemainingTrialTime,
    loading: subscriptionLoading 
  } = useSubscription();
  const { isSuperadmin, hasRole, loading: permissionsLoading } = useUserPermissions();
  const { 
    isRecording, 
    isProcessing, 
    startRecording, 
    stopRecording, 
    processAudio, 
    generateSummary,
    startRealTimeTranscription,
    stopRealTimeTranscription
  } = useAudioRecorder();
  
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [currentSummary, setCurrentSummary] = useState('');
  const [currentTranslation, setCurrentTranslation] = useState('');
  const [currentTranslationSummary, setCurrentTranslationSummary] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [durationTimer, setDurationTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<{ code: string; name: string; flag: string } | null>(null);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingTranslationSummary, setIsGeneratingTranslationSummary] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ready' | 'error'>('checking');
  const [apiError, setApiError] = useState<string>('');
  const [isRealTimeMode, setIsRealTimeMode] = useState(false);
  const [liveTranslateEnabled, setLiveTranslateEnabled] = useState(false);
  const [isInitializingLiveTranslation, setIsInitializingLiveTranslation] = useState(false);
  const [liveTranslationReady, setLiveTranslationReady] = useState(false);
  const [showSourceLangSelector, setShowSourceLangSelector] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState<{ code: string; name: string; flag: string } | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedSourceLanguage, setSelectedSourceLanguage] = useState<{ code: string; name: string; flag: string } | null>({ code: 'auto', name: 'Autodetect', flag: '🌐' });



  // مراقبة تغييرات isSaved
  useEffect(() => {
    console.log('🔄 isSaved changed to:', isSaved);
  }, [isSaved]);

  // إعادة تعيين isSaved عند تغيير البيانات (فقط إذا لم تكن البيانات محفوظة بالفعل)
  useEffect(() => {
    if ((currentTranscription || currentTranslation || currentSummary || currentTranslationSummary) && !isSaved) {
      console.log('🔄 Data changed and not saved, resetting isSaved to false');
      setIsSaved(false);
    }
  }, [currentTranscription, currentTranslation, currentSummary, currentTranslationSummary, isSaved]);

  const router = useRouter();

  // تعديل منطق hasAccess ليشمل الأدمن دائماً
  const hasAccess = isSubscribed || hasRemainingTrialTime || isSuperadmin || hasRole('admin');

  // Helper to check if user has exhausted their daily minutes
  const hasNoMinutesLeft = (!isSubscribed && hasFreeTrial && !hasRemainingTrialTime) || (isSubscribed && dailyUsageSeconds >= dailyLimitSeconds);

  // استدعِ فحص إعدادات الـ API مرة واحدة فقط عند تحميل الصفحة
  useEffect(() => {
    checkApiConfiguration();
  }, []);

  useEffect(() => {
    if (isRecording) {
      const timer = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      setDurationTimer(timer);
    } else {
      if (durationTimer) {
        clearInterval(durationTimer);
        setDurationTimer(null);
      }
    }

    return () => {
      if (durationTimer) {
        clearInterval(durationTimer);
      }
    };
  }, [isRecording]);

  const checkApiConfiguration = () => {
    setApiStatus('checking');
    
    const assemblyAiKey = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY;
    const qwenKey = process.env.EXPO_PUBLIC_QWEN_API_KEY;
    
    if (!assemblyAiKey || assemblyAiKey === 'your_assemblyai_api_key') {
      setApiError('AssemblyAI API key is missing or not configured properly. Please check your environment variables.');
      setApiStatus('error');
      return;
    }
    
    if (!qwenKey || qwenKey === 'your_qwen_api_key') {
      setApiError('Qwen API key is missing or not configured properly. Summary generation will not work.');
      setApiStatus('error');
      return;
    }
    
    setApiStatus('ready');
    setApiError('');
  };

  // دالة تهيئة الترجمة المباشرة
  const initializeLiveTranslation = async (): Promise<boolean> => {
    setIsInitializingLiveTranslation(true);
    
    try {
      // طلب إذن المايك باستخدام الدالة المشتركة
      const hasMicPermission = await ensureMicPermission();
      if (!hasMicPermission) {
        throw new Error('Microphone permission denied.');
      }

      // تهيئة AudioRecord
      try {
        if (!AudioRecord || typeof AudioRecord.init !== 'function') {
          throw new Error('AudioRecord is not available.');
        }
        const audioOptions = {
          sampleRate: 16000,
          channels: 1,
          bitsPerSample: 16,
          wavFile: '',
        };
        AudioRecord.init(audioOptions);
      } catch (audioError) {
        console.error('AudioRecord initialization error:', audioError);
        throw new Error('Failed to initialize audio recording. Please make sure the app has proper permissions.');
      }

      // اختبار الاتصال بالسيرفر
      return new Promise<boolean>((resolve, reject) => {
        try {
          if (typeof WebSocket === 'undefined') {
            reject(new Error('WebSocket is not available in this environment.'));
            return;
          }
          
          const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
          const timeoutId = setTimeout(() => {
            reject(new Error('Connection timeout. Please check your internet connection.'));
          }, 5000);

          ws.onopen = () => {
            clearTimeout(timeoutId);
            ws.close();
            resolve(true);
          };

          ws.onerror = (error) => {
            clearTimeout(timeoutId);
            console.error('WebSocket error:', error);
            reject(new Error('Failed to connect to server.'));
          };

          ws.onclose = (event) => {
            clearTimeout(timeoutId);
            console.error('WebSocket closed:', event);
            reject(new Error('Connection closed unexpectedly.'));
          };
        } catch (wsError) {
          console.error('WebSocket creation error:', wsError);
          reject(new Error('Failed to create connection.'));
        }
      });
    } catch (error) {
      console.error('Live translation initialization error:', error);
      throw error;
    } finally {
      setIsInitializingLiveTranslation(false);
    }
  };

  const handleStartRecording = async () => {
    if (apiStatus !== 'ready') {
      Alert.alert('Configuration Error', apiError);
      return;
    }

    if (!hasAccess && !subscriptionLoading) {
      Alert.alert(
        'Subscription Required',
        'Your free trial has expired. Please subscribe to continue using voice transcription.'
      );
      return;
    }

    // طلب إذن المايك أولاً
    const hasMicPermission = await ensureMicPermission();
    if (!hasMicPermission) {
      Alert.alert(
        'Microphone Permission Required',
        'Please grant microphone permission to record audio. You can enable it in your device settings.'
      );
      return;
    }

    // إذا كانت الترجمة الفورية مفعلة، انتقل إلى صفحة الترجمة الفورية مع تمرير source وtarget
    if (liveTranslateEnabled && selectedLanguage) {
      const targetLang = selectedLanguage.code === 'auto' ? 'en' : selectedLanguage.code;
      const langName = selectedLanguage.code === 'auto' ? 'English (Auto-detect)' : selectedLanguage.name;
      const sourceLang = selectedSourceLanguage?.code || 'auto';
      const sourceLangName = selectedSourceLanguage?.name || 'Autodetect';
      
      // إضافة console.log مؤقت للتأكد من تمرير البيانات
      console.log('🚀 Navigation Debug:', {
        sourceLang,
        sourceLangName,
        selectedSourceLanguage,
        targetLang,
        langName
      });
      
      router.push({
        pathname: '/(tabs)/live-translation',
        params: {
          targetLanguage: targetLang,
          languageName: langName,
          sourceLanguage: sourceLang,
          sourceLanguageName: sourceLangName,
          autoStart: 'true',
        },
      } as any);
      return;
    }

    // Check if user has enough time remaining for a meaningful recording (at least 30 seconds)
    if (hasFreeTrial && !isSubscribed) {
      const remainingTime = getRemainingTrialTime();
      if (remainingTime < 30) {
        Alert.alert(
          'Daily Limit Almost Reached',
          `You have less than 30 seconds remaining today. Your trial resets tomorrow with a fresh hour.`,
          [
            { text: 'OK', style: 'default' },
            { text: 'Upgrade Now', style: 'default', onPress: () => router.push('/subscription') }
          ]
        );
        return;
      }
    }

    try {
      setCurrentTranscription('');
      setCurrentSummary('');
      setCurrentTranslation('');
      setCurrentTranslationSummary('');
      setRecordingDuration(0);
      await startRecording();
    } catch (error) {
      console.error('Recording start error:', error);
      Alert.alert('Recording Error', error instanceof Error ? error.message : 'Failed to start recording. Please try again.');
    }
  };

  const handleStopRecording = async () => {
    if (!isRecording) return;
    
    try {
      const audioBlob = await stopRecording();
      
      if (audioBlob) {
        console.log('Processing recorded audio...');
        await processAudio(
          audioBlob,
            async (transcription) => {
              setCurrentTranscription(transcription);
              console.log('Transcription completed:', transcription);
              // ترجمة النص تلقائياً إذا تم اختيار لغة هدف
              if (selectedLanguage && transcription) {
                try {
                  const { SpeechService } = await import('@/services/speechService');
                  let translation;
                  
                  if (selectedLanguage.code === 'auto') {
                    // إذا تم اختيار الكشف التلقائي، ترجم إلى الإنجليزية
                    translation = await SpeechService.translateText(transcription, 'en');
                  } else {
                    // إذا تم اختيار لغة محددة، ترجم إلى تلك اللغة
                    translation = await SpeechService.translateText(transcription, selectedLanguage.code);
                  }
                  
                  setCurrentTranslation(translation);
                  console.log('Translation completed:', translation);
                                // حفظ النتائج بعد الترجمة
              console.log('🔄 Auto-saving transcription with translation...');
              await addToHistory({
                transcription,
                translation,
                summary: '',
                translationSummary: '',
                created_at: new Date().toISOString(),
              });
              // تعيين isSaved إلى true بعد الحفظ التلقائي
              setIsSaved(true);
                } catch (error) {
                  console.error('Translation error:', error);
                }
              } else {
                // إذا لم توجد ترجمة، احفظ فقط النص
                console.log('🔄 Auto-saving transcription without translation...');
                await addToHistory({
                  transcription,
                  translation: '',
                  summary: '',
                  translationSummary: '',
                  created_at: new Date().toISOString(),
                });
                // تعيين isSaved إلى true بعد الحفظ التلقائي
                setIsSaved(true);
              }
            },
          () => {}, // لا تلخيص تلقائي
          selectedLanguage?.code
        );
      }
    } catch (error) {
      console.error('Recording stop error:', error);
      Alert.alert('Recording Error', error instanceof Error ? error.message : 'Failed to process recording. Please try again.');
    }
  };

  const handleGenerateSummary = async () => {
    if (!currentTranscription) return;
    setIsGeneratingSummary(true);
    try {
      await generateSummary(currentTranscription, async (summary) => {
        if (!summary || summary.trim() === '') {
          Alert.alert('Summary Error', 'AI did not return a summary. Try again with a longer or clearer recording.');
          setCurrentSummary('');
        } else {
          setCurrentSummary(summary);
          // حفظ التلخيص تلقائياً في history
          console.log('🔄 Auto-saving summary...');
          await addToHistory({
            transcription: currentTranscription,
            translation: currentTranslation,
            summary,
            translationSummary: currentTranslationSummary,
            created_at: new Date().toISOString(),
          });
          // تعيين isSaved إلى true بعد الحفظ التلقائي
          setIsSaved(true);
          // انتقل إلى صفحة الملخص مع تمرير النصوص المطلوبة
          router.navigate({
            pathname: '/(tabs)/summary-view',
            params: {
              summary,
              transcription: currentTranscription,
              translation: currentTranslation,
              targetLanguage: selectedLanguage ? selectedLanguage.name : '',
            }
          } as any);
        }
      }, selectedLanguage?.code);
    } catch (error) {
      console.error('Summary generation error:', error);
      Alert.alert('Summary Error', error instanceof Error ? error.message : 'Failed to generate summary. Please try again.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleGenerateTranslationSummary = async () => {
    if (!currentTranslation) return;
    setIsGeneratingTranslationSummary(true);
    try {
      const { SpeechService } = await import('@/services/speechService');
      const summaryTranslation = await SpeechService.summarizeText(currentTranslation, selectedLanguage?.code);
      setCurrentTranslationSummary(summaryTranslation);
      // حفظ ملخص الترجمة تلقائياً في history
      console.log('🔄 Auto-saving translation summary...');
      await addToHistory({
        transcription: currentTranscription,
        translation: currentTranslation,
        summary: currentSummary,
        translationSummary: summaryTranslation,
        created_at: new Date().toISOString(),
      });
      // تعيين isSaved إلى true بعد الحفظ التلقائي
      setIsSaved(true);
    } catch (error) {
      console.error('Translation summary generation error:', error);
      Alert.alert('Summary Error', error instanceof Error ? error.message : 'Failed to generate translation summary. Please try again.');
    } finally {
      setIsGeneratingTranslationSummary(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const renderApiStatusBanner = () => {
    if (apiStatus === 'checking') {
      return (
        <View style={styles.statusBanner}>
          <AlertCircle size={20} color="#F59E0B" />
          <Text style={styles.statusText}>Checking API configuration...</Text>
        </View>
      );
    }

    if (apiStatus === 'error') {
      return (
        <View style={[styles.statusBanner, styles.errorBanner]}>
          <AlertCircle size={20} color="#EF4444" />
          <Text style={styles.errorText}>{apiError}</Text>
        </View>
      );
    }

    return null;
  };

  const renderRealTimeModeToggle = () => {
    // Comment out or remove the UI for starting live translation (real-time mode)
    // For example, if there is a toggle or button for real-time mode, hide it:
    // {renderRealTimeModeToggle()}
    // Or if there is a button:
    // <TouchableOpacity onPress={...}>Start Live Translation</TouchableOpacity>
    // Simply do not render it for now.
    return null;
  };

  // دالة لحفظ النتائج في history (جدول recordings)
  const addToHistory = async (record: {
    transcription?: string;
    translation?: string;
    summary?: string;
    translationSummary?: string;
    created_at: string;
  }) => {
    try {
      console.log('📝 addToHistory called with:', { user_id: user?.id, ...record });
      const { error } = await supabase.from('recordings').insert([
        {
          user_id: user?.id,
          ...record
        }
      ]);
      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }
      console.log('✅ Successfully saved to history');
    } catch (e) {
      console.warn('❌ Failed to save to history', e);
      throw e;
    }
  };

  // عدل onGenerateSummary أو زر Back to Home ليكون:
  const handleBackToHome = async () => {
    if (currentTranscription || currentTranslation || currentSummary || currentTranslationSummary) {
      console.log('🔄 Auto-saving on back to home...');
      await addToHistory({
        transcription: currentTranscription,
        translation: currentTranslation,
        summary: currentSummary,
        translationSummary: currentTranslationSummary,
        created_at: new Date().toISOString(),
      });
      // تعيين isSaved إلى true بعد الحفظ التلقائي
      setIsSaved(true);
    }
    setCurrentTranscription('');
    setCurrentTranslation('');
    setCurrentSummary('');
    setCurrentTranslationSummary('');
    router.replace('/');
  };

  // وظيفة جديدة لفتح صفحة التلخيص
  const handleOpenSummaryView = () => {
    router.push({
      pathname: '/(tabs)/summary-view',
      params: {
        transcription: currentTranscription,
        translation: currentTranslation,
        summary: currentSummary,
        targetLanguage: selectedLanguage?.name || '',
      },
    });
  };

  const handleSaveToHistory = async () => {
    console.log('🔄 handleSaveToHistory called, isSaved before:', isSaved);
    try {
      await addToHistory({
        transcription: currentTranscription,
        translation: currentTranslation,
        summary: currentSummary,
        translationSummary: currentTranslationSummary,
        created_at: new Date().toISOString(),
      });
      setIsSaved(true);
      console.log('✅ handleSaveToHistory success, isSaved after:', true);
      Alert.alert('Success', 'Content saved to history!');
    } catch (e) {
      setIsSaved(false);
      console.warn('❌ handleSaveToHistory failed:', e);
      Alert.alert('Error', 'Failed to save to history');
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      // Re-fetch subscription data when the page is focused
      // You may need to expose a refetch function from useSubscription or reload the page
      // For now, just reload the window (web) or trigger a state update
      // If you have a refetch function, call it here
      // Example: refetchSubscription();
    }, [])
  );

  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <Text style={{ fontSize: 16, color: '#6B7280' }}>Please sign in to use the app.</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Voice Transcriber</Text>
          <Text style={styles.subtitle}>
            {apiStatus === 'error' 
              ? 'Please configure API keys to continue'
              : hasAccess 
                ? 'Tap to record your voice' 
                : freeTrialExpired 
                  ? 'Free trial expired - Upgrade to continue'
                  : hasFreeTrial && getRemainingTrialTime() <= 0
                    ? 'Daily limit reached - Try again tomorrow'
                    : 'Start your free trial to begin recording'
            }
          </Text>
        </View>

        {/* Free Trial Banner/Button */}
        {!isSubscribed && !hasRemainingTrialTime && !subscriptionLoading && (
          <TouchableOpacity
            style={[styles.freeTrialButton, { backgroundColor: '#2563EB' }]}
            onPress={() => router.push('/subscription')}
          >
            <Crown size={20} color="#FACC15" style={{ marginRight: 8 }} />
            <Text style={[styles.freeTrialButtonText, { color: 'white' }]}>Choose a plan to enjoy unlimited voice transcription</Text>
          </TouchableOpacity>
        )}

        {renderApiStatusBanner()}
        {renderRealTimeModeToggle()}

        <View style={styles.recordingSection}>
          <RecordButton
            isRecording={isRecording}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            disabled={
              isProcessing ||
              (!hasAccess && !subscriptionLoading && !(isSuperadmin || hasRole('admin')))
              || apiStatus !== 'ready'
            }
          />
          {/* Hint above the button */}
          <Text style={{ textAlign: 'center', color: '#F59E0B', fontSize: 13, marginBottom: 4 }}>
            Tap to enable live translation
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            style={{
              backgroundColor: liveTranslateEnabled ? '#2563EB' : '#FEF3C7',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: liveTranslateEnabled ? '#2563EB' : '#F59E0B',
              paddingVertical: 12,
              paddingHorizontal: 28,
              alignItems: 'center',
              alignSelf: 'center',
              width: '90%',
              marginTop: 4,
              marginBottom: 18,
              flexDirection: 'row',
              shadowColor: liveTranslateEnabled ? '#2563EB' : '#F59E0B',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.18,
              shadowRadius: 6,
              elevation: 4,
            }}
            onPress={async () => {
              // تحقق من إذن المايك أولاً
              const hasMicPermission = await ensureMicPermission();
              if (!hasMicPermission) {
                Alert.alert('Microphone Permission Required', 'Please grant microphone permission to use live translation.');
                return;
              }
              if (liveTranslateEnabled) {
                // إلغاء التفعيل
                setLiveTranslateEnabled(false);
                setLiveTranslationReady(false);
              } else {
                // تفعيل الترجمة الفورية
                setLiveTranslateEnabled(true);
                setLiveTranslationReady(true);
              }
            }}
          >
            <>
              <Crown size={22} color={liveTranslateEnabled ? '#fff' : '#F59E0B'} style={{ marginRight: 10 }} />
              <Text style={{ color: liveTranslateEnabled ? '#fff' : '#F59E0B', fontWeight: 'bold', fontSize: 16, textAlign: 'center', flex: 1 }}>
                {liveTranslateEnabled ? 'Live Translation to World Languages Enabled' : 'Enable Live Translation to World Languages'}
              </Text>
            </>
          </TouchableOpacity>
          {/* Language Selector for Source Language - Always visible */}
          <View style={{ width: '90%', alignSelf: 'center', marginBottom: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Languages size={16} color="#6B7280" style={{ marginRight: 6 }} />
                <Text style={{ color: '#374151', fontWeight: 'bold', fontSize: 15 }}>
                  Source Language (What you will speak)
                </Text>
              </View>
              <LanguageSelector
                selectedLanguage={selectedSourceLanguage}
                onSelectLanguage={setSelectedSourceLanguage}
                disabled={isRecording || isProcessing}
              />
              {/* إضافة مؤشر للغة المصدر المحددة */}
              {selectedSourceLanguage && selectedSourceLanguage.code !== 'auto' && (
                <View style={{ 
                  backgroundColor: '#E0F2FE', 
                  padding: 8, 
                  borderRadius: 6, 
                  marginTop: 6,
                  borderWidth: 1,
                  borderColor: '#06B6D4'
                }}>
                  <Text style={{ color: '#0E7490', fontSize: 12, textAlign: 'center', fontWeight: '500' }}>
                    ✅ Source language set to: {selectedSourceLanguage.name} ({selectedSourceLanguage.code})
                  </Text>
                </View>
              )}
            </View>
          {/* Language Selector يظهر دائمًا مع نص توضيحي مختلف */}
          <View style={{ width: '90%', alignSelf: 'center', marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Languages size={16} color="#6B7280" style={{ marginRight: 6 }} />
              <Text style={{ color: '#374151', fontWeight: 'bold', fontSize: 15 }}>
              {liveTranslateEnabled ? 'Target Language for Live Translation' : 'Select Target Language'}
            </Text>
            </View>
            <LanguageSelector
              selectedLanguage={selectedLanguage}
              onSelectLanguage={setSelectedLanguage}
              disabled={isRecording || isProcessing}
            />
            {liveTranslateEnabled && selectedLanguage && (
              <View style={{ 
                backgroundColor: '#F0F9FF', 
                padding: 12, 
                borderRadius: 8, 
                marginTop: 8,
                borderWidth: 1,
                borderColor: '#BFDBFE'
              }}>
                <Text style={{ color: '#1E40AF', fontSize: 13, textAlign: 'center', fontWeight: '500' }}>
                  {selectedLanguage.code === 'auto' 
                    ? '🌐 Live translation will automatically detect your speech language and translate to English'
                    : selectedSourceLanguage && selectedSourceLanguage.code !== 'auto'
                      ? `🌐 Live translation will translate from ${selectedSourceLanguage.name} to ${selectedLanguage.name}`
                    : `🌐 Live translation will translate your speech to ${selectedLanguage.name}`
                  }
              </Text>
              </View>
            )}
            {liveTranslateEnabled && !selectedLanguage && (
              <View style={{ 
                backgroundColor: '#FEF3C7', 
                padding: 12, 
                borderRadius: 8, 
                marginTop: 8,
                borderWidth: 1,
                borderColor: '#F59E0B'
              }}>
                <Text style={{ color: '#92400E', fontSize: 13, textAlign: 'center', fontWeight: '500' }}>
                  ⚠️ Please select a target language for live translation
                </Text>
              </View>
            )}
          </View>
          {!hasAccess && !subscriptionLoading && (
            <Text style={{ color: '#DC2626', textAlign: 'center', marginTop: 12 }}>
              Your free trial has expired. Please choose a subscription plan to enable recording.
            </Text>
          )}
          
          {isRecording && (
            <View style={styles.recordingStatus}>
              <View style={styles.recordingIndicator} />
              <View style={styles.recordingTextContainer}>
                <Text style={styles.recordingText}>
                  Recording: {formatDuration(recordingDuration)}
                </Text>
                <Text style={styles.recordingHint}>
                  {isRealTimeMode 
                    ? 'Speak and see translation live!'
                    : Platform.OS === 'web' 
                      ? 'Speak into your microphone' 
                      : 'Speak clearly into your device'
                  }
                </Text>
              </View>
            </View>
          )}

          {isProcessing && (
            <View style={styles.processingStatus}>
              <Sparkles size={20} color="#2563EB" />
              <Text style={styles.processingText}>Processing your audio...</Text>
            </View>
          )}
        </View>

        {(currentTranscription || isProcessing || isRealTimeMode) && (
          <TranscriptionCard
            transcription={currentTranscription}
            summary={currentSummary}
            translation={currentTranslation}
            translationSummary={currentTranslationSummary}
            targetLanguage={selectedLanguage}
            isProcessing={isProcessing || isGeneratingSummary || isGeneratingTranslationSummary}
            onGenerateSummary={handleOpenSummaryView}
            isRealTime={isRealTimeMode}
          />
        )}

        {hasAccess && !currentTranscription && !isProcessing && apiStatus === 'ready' && (
          <View style={styles.instructions}>
            <Text style={styles.instructionsTitle}>How to use:</Text>
            <Text style={styles.instructionsText}>
              1. Tap the microphone button to start recording
            </Text>
            <Text style={styles.instructionsText}>
              2. Speak clearly into your device
            </Text>
            <Text style={styles.instructionsText}>
              3. Tap again to stop and get your transcription
            </Text>
            <Text style={styles.instructionsText}>
              4. Download your transcription or generate an AI summary
            </Text>
            {isRealTimeMode && (
              <Text style={styles.instructionsText}>
                5. Enable real-time translation to see translations as you speak!
              </Text>
            )}
          </View>
        )}

        {(currentTranscription || currentTranslation || currentSummary || currentTranslationSummary) && !isSaved && (
          <>
            {console.log('🔄 Showing save button - data exists and not saved')}
            <TouchableOpacity
              style={{ position: 'absolute', bottom: 24, right: 24, backgroundColor: '#2563EB', borderRadius: 24, padding: 10, elevation: 4 }}
              onPress={handleSaveToHistory}
              accessibilityLabel="Save to history"
            >
              <Save size={22} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </>
  );
}