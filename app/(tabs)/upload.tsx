import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { LanguageSelector, type Language } from '@/components/LanguageSelector';
import Tts from 'react-native-tts';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Audio, Video } from 'expo-av';
// Remove static import - will use dynamic import like index.tsx
import { DownloadHelper } from '@/utils/downloadHelper';
import { useRouter } from 'expo-router';

const ASSEMBLYAI_API_KEY = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY;

// نوع جديد لقائمة الملفات مع المدة
interface FileWithDuration {
  name: string;
  uri: string;
  size: number;
  duration: number; // بالثواني
}

export default function UploadScreen() {
  const { user } = useAuth();
  const { isSuperadmin, hasRole, loading: permissionsLoading } = useUserPermissions();
  const [files, setFiles] = useState<FileWithDuration[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [translation, setTranslation] = useState('');
  const [translating, setTranslating] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);
  const [transcriptionStats, setTranscriptionStats] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const router = useRouter();

  // التحقق من صلاحيات الأدمن - تحسين الأداء
  const isAdmin = React.useMemo(() => {
    return isSuperadmin || (hasRole && (hasRole('admin') || hasRole('super_admin')));
  }, [isSuperadmin, hasRole]);

  // جلب الرصيد المتبقي - تحسين الأداء
  useEffect(() => {
    const fetchCredits = async () => {
      if (!user) return;
      
      // إذا كان المستخدم أدمن، لا نحتاج لجلب الرصيد
      if (isAdmin) {
        setRemainingMinutes(999999); // قيمة عالية للأدمن
        return;
      }
      
      const { data: creditsData, error: creditsError } = await supabase
        .from('transcription_credits')
        .select('total_minutes, used_minutes')
        .eq('user_id', user.id)
        .single();
      
      if (!creditsError && creditsData) {
        const remaining = (creditsData.total_minutes || 0) - (creditsData.used_minutes || 0);
        setRemainingMinutes(remaining);
      } else {
        setRemainingMinutes(null);
      }
    };
    
    fetchCredits();
  }, [user, files, isAdmin]);

  // Reset isSaved when data changes
  useEffect(() => {
    if (transcript || translation || aiSummary) {
      setIsSaved(false);
    }
  }, [transcript, translation, aiSummary]);

  // دالة لحفظ النتائج في history (جدول recordings)
  const addToHistory = async (record: {
    transcription?: string;
    translation?: string;
    summary?: string;
    translationSummary?: string;
    created_at: string;
  }) => {
    try {
      if (!user) {
        console.warn('No user available, skipping history save');
        return;
      }
      
      console.log('📝 [Upload] addToHistory called with:', { user_id: user.id, ...record });
      const { error } = await supabase.from('recordings').insert([
        {
          user_id: user.id,
          transcription: record.transcription || '',
          translation: record.translation || '',
          summary: record.summary || '',
          translationSummary: record.translationSummary || '',
          target_language: selectedLanguage?.name || '',
          duration: files.reduce((sum, f) => sum + f.duration, 0),
          created_at: record.created_at,
        }
      ]);
      
      if (error) {
        console.error('❌ [Upload] Supabase error:', error);
        throw error;
      }
      
      console.log('✅ [Upload] Successfully saved to history');
      setIsSaved(true);
    } catch (e) {
      console.warn('❌ [Upload] Failed to save to history', e);
      setIsSaved(false);
      // Don't throw error to avoid disrupting the flow
    }
  };

  // تحديث handlePickFile لدعم عدة ملفات وحساب المدة
  const handlePickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'video/*'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (res.canceled) {
        setFiles([]);
      } else {
        const assets = res.assets || [];
        const filesWithDuration: FileWithDuration[] = [];
        for (const asset of assets) {
          let duration = 0;
          try {
            if (asset.uri.endsWith('.mp3') || asset.uri.endsWith('.wav') || asset.uri.endsWith('.m4a')) {
              const { sound } = await Audio.Sound.createAsync({ uri: asset.uri });
              const status = await sound.getStatusAsync();
              duration = status.isLoaded && status.durationMillis ? status.durationMillis / 1000 : 0;
              await sound.unloadAsync();
            } else {
              // For video files, we'll use a different approach since Video is a React component
              // We'll estimate duration based on file size or use a default value
              // Alternatively, you could use a video metadata library
              duration = Math.max((asset.size || 0) / (1024 * 1024) * 60, 30); // Rough estimate: 1MB = 1 minute, minimum 30 seconds
            }
          } catch (e) {
            duration = 0;
          }
          filesWithDuration.push({
            name: asset.name || 'file',
            uri: asset.uri,
            size: asset.size || 0,
            duration,
          });
        }
        setFiles(filesWithDuration);
        setTranscript('');
        setTranslation('');
        setAiSummary('');
        setProgress('');
        setIsSaved(false);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick files.');
    }
  };

  // حساب مجموع الدقائق المطلوبة
  const totalMinutes = files.reduce((sum, f) => sum + Math.ceil(f.duration / 60), 0);

  // تحديث handleStartTranscription للعمل على كل الملفات
  const handleStartTranscription = async () => {
    if (!files.length) {
      Alert.alert('No files selected');
      return;
    }
    if (!ASSEMBLYAI_API_KEY) {
      Alert.alert('Error', 'AssemblyAI API key is missing.');
      return;
    }
    if (!user) {
      Alert.alert('Error', 'User not found.');
      return;
    }
    // التحقق من الرصيد فقط للمستخدمين العاديين (ليس الأدمن)
    if (!isAdmin) {
      if (remainingMinutes === null) {
        Alert.alert('Error', 'Cannot fetch your credits.');
        return;
      }
      if (totalMinutes > remainingMinutes) {
        Alert.alert('Insufficient Credits', 'Total file duration exceeds your remaining credits. Please purchase additional minutes.');
        return;
      }
    } else {
      // للأدمن، تخطى فحص الرصيد تماماً
      console.log('Admin user detected - skipping credit check');
    }
    setLoading(true);
    setProgress('Uploading files...');
    setTranscript('');
    setTranslation('');
    setAiSummary('');
    setIsSaved(false);
    
    let allTranscript = '';
    try {
      for (const file of files) {
        // 1. رفع الملف إلى AssemblyAI
        const fileInfo = await fetch(file.uri);
        const fileBlob = await fileInfo.blob();
        const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
          method: 'POST',
          headers: { 'authorization': ASSEMBLYAI_API_KEY },
          body: fileBlob,
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.upload_url) throw new Error('Upload failed');
        setProgress(`File ${file.name} uploaded. Starting transcription...`);
        // 2. بدء التفريغ
        const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
          method: 'POST',
          headers: {
            'authorization': ASSEMBLYAI_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ audio_url: uploadData.upload_url }),
        });
        const transcriptData = await transcriptRes.json();
        if (!transcriptData.id) throw new Error('Transcription start failed');
        setProgress(`Transcribing ${file.name}...`);
        // 3. Polling for result
        let status = transcriptData.status;
        let resultText = '';
        while (status && status !== 'completed' && status !== 'error') {
          await new Promise(res => setTimeout(res, 4000));
          setProgress(`Transcribing ${file.name}... (${status})`);
          const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptData.id}`, {
            headers: { 'authorization': ASSEMBLYAI_API_KEY },
          });
          const pollData = await pollRes.json();
          status = pollData.status;
          if (status === 'completed') {
            resultText = pollData.text;
          } else if (status === 'error') {
            throw new Error(pollData.error || 'Transcription failed');
          }
        }
        
        allTranscript += (allTranscript ? '\n\n' : '') + resultText;
        
        // خصم الدقائق فقط للمستخدمين العاديين (ليس الأدمن)
        if (!isAdmin) {
          const fileMinutes = Math.ceil(file.duration / 60);
          await supabase.rpc('deduct_transcription_time', { uid: user.id, minutes_to_deduct: fileMinutes });
          // تحديث الرصيد بعد الخصم
          const { data, error } = await supabase
            .from('transcription_credits')
            .select('total_minutes, used_minutes')
            .eq('user_id', user.id)
            .single();
          if (!error && data) {
            setRemainingMinutes((data.total_minutes || 0) - (data.used_minutes || 0));
          }
        } else {
          // للأدمن، لا نحتاج لخصم الدقائق
          console.log('Admin user - no credit deduction needed');
        }
      }
      
      setProgress('');
      setTranscript(allTranscript);
      
      // Auto-save transcription immediately
      console.log('🔄 [Upload] Auto-saving transcription...');
      await addToHistory({
        transcription: allTranscript,
        translation: '',
        summary: '',
        translationSummary: '',
        created_at: new Date().toISOString(),
      });
      
      setFiles([]);
    } catch (err) {
      setProgress('');
      const errorMsg = err instanceof Error ? err.message : 'Transcription failed';
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 1. useEffect لمزامنة الترجمة تلقائيًا عند تحديث النص أو اللغة
  useEffect(() => {
    const translate = async () => {
      if (transcript && selectedLanguage) {
        setTranslating(true);
        try {
          let textToTranslate = transcript;
          if (transcript.length > 5000) {
            textToTranslate = transcript.substring(0, 5000) + '...';
            Alert.alert('Notice', 'Text is very long. Only the first 5000 characters will be translated.');
          }
          const { SpeechService } = await import('@/services/speechService');
          const translatedText = await SpeechService.translateText(textToTranslate, selectedLanguage.code);
          setTranslation(translatedText);
          
          // Auto-save translation immediately
          console.log('🔄 [Upload] Auto-saving translation...');
          await addToHistory({
            transcription: transcript,
            translation: translatedText,
            summary: aiSummary,
            translationSummary: '',
            created_at: new Date().toISOString(),
          });
          
        } catch (error) {
          console.error('Translation error:', error);
        } finally {
          setTranslating(false);
        }
      } else {
        setTranslation('');
      }
    };
    translate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, selectedLanguage?.code]); // Only depend on code, not the whole object

  const handleDownload = async (type: 'txt' | 'doc') => {
    if (!transcript) return;
    try {
      // Check if text is very long
      if (transcript.length > 1000000) {
        Alert.alert('Warning', 'File is very large. Download may take a moment...');
      }
      const fileName = `transcription_${Date.now()}.${type}`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, transcript, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: type === 'txt' ? 'text/plain' : 'application/msword' });
    } catch (err) {
      Alert.alert('Error', 'Failed to share file.');
    }
  };

  const handleDownloadSummary = (format: 'txt' | 'rtf' | 'doc') => {
    const textToDownload = aiSummary;
    if (!textToDownload || textToDownload.trim() === '') {
      Alert.alert('Notice', 'No summary available for download or the summary is empty.');
      return;
    }
    const filename = DownloadHelper.generateFilename('summary');
    DownloadHelper.downloadText(textToDownload, filename, format);
  };

  const handleDownloadTranslation = (format: 'txt' | 'rtf' | 'doc') => {
    const textToDownload = translation;
    if (!textToDownload || textToDownload.trim() === '') {
      Alert.alert('Notice', 'No translation available for download or the translation is empty.');
      return;
    }
    const filename = DownloadHelper.generateFilename('translation');
    DownloadHelper.downloadText(textToDownload, filename, format);
  };

  const handleCopy = async (text: string, type: string) => {
    try {
      // Check if text is too long (over 1MB)
      if (text.length > 1000000) {
        Alert.alert('Warning', 'Text is very long. Copying may take a moment...');
      }
      await Clipboard.setStringAsync(text);
      Alert.alert('Success', `${type} copied to clipboard!`);
    } catch (err) {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  const handlePaste = async (type: string) => {
    try {
      let text = await Clipboard.getStringAsync();
      if (!text || text.trim() === '') {
        Alert.alert('Notice', 'No text found in clipboard');
        return;
      }
      
      // Check if text is too long
      if (text.length > 1000000) {
        Alert.alert('Warning', 'Text from clipboard is very long. Only first 1MB will be used.');
        text = text.substring(0, 1000000);
      }
      
      // Set the text based on type
      switch (type) {
        case 'transcript':
          setTranscript(text);
          break;
        case 'translation':
          setTranslation(text);
          break;
        case 'summary':
          setAiSummary(text);
          break;
        default:
          Alert.alert('Error', 'Invalid text type');
      }
      
      Alert.alert('Success', `${type} pasted from clipboard!`);
    } catch (err) {
      Alert.alert('Error', 'Failed to paste from clipboard');
    }
  };

  const handleClear = (type: string) => {
    Alert.alert(
      'Clear Text',
      `Are you sure you want to clear the ${type}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            switch (type) {
              case 'transcript':
                setTranscript('');
                break;
              case 'translation':
                setTranslation('');
                break;
              case 'summary':
                setAiSummary('');
                break;
            }
            Alert.alert('Success', `${type} cleared!`);
          },
        },
      ]
    );
  };

  // دالة التلخيص الاختياري - تلخيص النص المترجم إذا كان موجوداً، وإلا النص الأصلي
  const handleGenerateSummary = async () => {
    // تحديد النص المراد تلخيصه - النص المترجم أولوية، وإلا النص الأصلي
    const textToSummarize = translation && translation.trim() !== '' ? translation : transcript;
    
    if (!textToSummarize || textToSummarize.trim() === '') {
      Alert.alert('Notice', 'No text available for summarization.');
      return;
    }
    
    setSummarizing(true);
    try {
      let textForSummary = textToSummarize;
      // إذا كان النص طويل جداً، استخدم أول 10000 حرف فقط للتلخيص
      if (textToSummarize.length > 10000) {
        textForSummary = textToSummarize.substring(0, 10000) + '...';
        Alert.alert('Notice', 'Text is very long. Summary will be based on the first 10000 characters.');
      }
      
      const { SpeechService } = await import('@/services/speechService');
      const summary = await SpeechService.summarizeText(textForSummary, selectedLanguage?.code);
      setAiSummary(summary);
      
      // Auto-save summary immediately
      console.log('🔄 [Upload] Auto-saving summary...');
      await addToHistory({
        transcription: transcript,
        translation: translation,
        summary: summary,
        translationSummary: '',
        created_at: new Date().toISOString(),
      });
      
    } catch (error) {
      console.error('Summarization error:', error);
      Alert.alert('Error', 'Failed to generate summary. Please try again.');
    } finally {
      setSummarizing(false);
    }
  };

  // 2. عند الضغط على زر Generate AI Summary، انتقل إلى صفحة summary-view مع النصوص
  const handleGoToSummary = () => {
    router.push({
      pathname: '/(tabs)/summary-view',
      params: {
        transcription: transcript, // <-- تعديل الاسم هنا
        translation,
        targetLanguage: selectedLanguage?.name || '',
        autoSummarize: 'true', // Auto-generate summary
      },
    });
  };

  const handleSpeakToggle = async (text: string, lang?: string) => {
    if (speakingText === text && isSpeaking) {
      Tts.stop();
      setIsSpeaking(false);
      setSpeakingText(null);
      return;
    }
    if (isSpeaking) {
      Tts.stop();
      setIsSpeaking(false);
      setSpeakingText(null);
    }
    if (!text || text.trim() === '') {
      Alert.alert('Notice', 'No text to speak');
      return;
    }
    
    // Check if text is too long for speech (over 10,000 characters)
    if (text.length > 10000) {
      Alert.alert('Warning', 'Text is very long. Only the first 10,000 characters will be spoken.');
      text = text.substring(0, 10000);
    }
    setIsSpeaking(true);
    setSpeakingText(text);
    try {
      let speechLang = lang || 'en-US';
      Tts.setDefaultLanguage(speechLang);
      Tts.speak(text);
    } catch (err) {
      Alert.alert('Error', 'Failed to speak text');
      setIsSpeaking(false);
      setSpeakingText(null);
    }
  };

  // عرض حالة التحميل للصلاحيات - تحسين الأداء
  if (permissionsLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 16, color: '#6B7280' }}>Loading permissions...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.header}>File Transcription</Text>
      <Text style={styles.subtitle}>Upload audio or video files for high-quality transcription</Text>
      
      <TouchableOpacity style={styles.uploadButton} onPress={handlePickFile} disabled={loading}>
        <Text style={styles.uploadButtonText}>{files.length > 0 ? 'Change Files' : 'Upload Audio/Video Files'}</Text>
      </TouchableOpacity>
      
      {files.length > 0 && (
        <View style={styles.filesContainer}>
          <Text style={styles.filesTitle}>Selected files:</Text>
          {files.map((f, idx) => (
            <Text key={idx} style={styles.fileItem}>
              {f.name} - {Math.ceil(f.duration/60)} min
            </Text>
          ))}
          <Text style={styles.totalMinutes}>Total: {totalMinutes} min</Text>
        </View>
      )}
      
      {/* عرض الرصيد المتبقي أو حالة الأدمن - تحسين الأداء */}
      {user && (
        <View style={[styles.creditsContainer, isAdmin && styles.adminCreditsContainer]}>
          <Text style={[styles.creditsText, isAdmin && styles.adminCreditsText]}>
            {isAdmin ? '🔧 Admin Mode - Unlimited Access' : `Remaining Credits: ${remainingMinutes !== null ? remainingMinutes + ' minutes' : '...'}`}
          </Text>
        </View>
      )}
      
      {/* زر بدء التفريغ */}
      {files.length > 0 && (
        <TouchableOpacity style={[styles.uploadButton, styles.transcribeButton]} onPress={handleStartTranscription} disabled={loading}>
          <Text style={styles.uploadButtonText}>{loading ? 'Transcribing...' : 'Start Transcription'}</Text>
        </TouchableOpacity>
      )}
      
      {progress ? (
        <View style={styles.progressContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.progressText}>{progress}</Text>
        </View>
      ) : null}
      
      {transcript ? (
        <View style={styles.resultsContainer}>
          <Text style={styles.sectionTitle}>Original Text:</Text>
          <ScrollView 
            style={styles.textContainer}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <Text selectable style={styles.transcriptText}>{transcript}</Text>
          </ScrollView>
                      <View style={styles.actionButtons}>
              <TouchableOpacity style={[styles.actionButton, styles.copyButton]} onPress={()=>handleCopy(transcript, 'Original Text')}>
                <Text style={styles.actionButtonText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.pasteButton]} onPress={()=>handlePaste('transcript')}>
                <Text style={styles.actionButtonText}>Paste</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={()=>handleClear('transcript')}>
                <Text style={styles.actionButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.speakButton]} onPress={()=>handleSpeakToggle(transcript)}>
                <Text style={styles.actionButtonText}>Listen</Text>
              </TouchableOpacity>
            </View>
          
          {translating && <Text style={styles.processingText}>Translating...</Text>}
          {translation ? (
            <View style={styles.translationContainer}>
              <Text style={styles.sectionTitle}>Translation:</Text>
              <ScrollView 
                style={styles.textContainer}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1 }}
              >
                <Text selectable style={styles.transcriptText}>{translation}</Text>
              </ScrollView>
                              <View style={styles.actionButtons}>
                  <TouchableOpacity style={[styles.actionButton, styles.copyButton]} onPress={()=>handleCopy(translation, 'Translation')}>
                    <Text style={styles.actionButtonText}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.pasteButton]} onPress={()=>handlePaste('translation')}>
                    <Text style={styles.actionButtonText}>Paste</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={()=>handleClear('translation')}>
                    <Text style={styles.actionButtonText}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.speakButton]} onPress={()=>handleSpeakToggle(translation, selectedLanguage?.code)}>
                    <Text style={styles.actionButtonText}>Listen</Text>
                  </TouchableOpacity>
                </View>
            </View>
          ) : null}
          
          {/* زر التلخيص الاختياري */}
          {transcript && !aiSummary && !summarizing && (
            <View style={styles.summaryButtonContainer}>
              <TouchableOpacity 
                style={styles.summaryButton} 
                onPress={handleGoToSummary}
                disabled={summarizing}
              >
                <Text style={styles.summaryButtonText}>
                  🤖 Generate AI Summary {translation ? '(Translated)' : '(Original)'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.summaryButtonNote}>
                Optional: Create an AI-powered summary of {translation ? 'your translation' : 'your transcript'}
              </Text>
            </View>
          )}
          
          {summarizing && <Text style={styles.processingText}>Summarizing...</Text>}
          {aiSummary ? (
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryTitle}>AI Summary:</Text>
              <ScrollView 
                style={styles.summaryTextContainer}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1 }}
              >
                <Text selectable style={styles.summaryText}>{aiSummary}</Text>
              </ScrollView>
                              <View style={styles.actionButtons}>
                  <TouchableOpacity style={[styles.actionButton, styles.copyButton]} onPress={()=>handleCopy(aiSummary, 'Summary')}>
                    <Text style={styles.actionButtonText}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.pasteButton]} onPress={()=>handlePaste('summary')}>
                    <Text style={styles.actionButtonText}>Paste</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={()=>handleClear('summary')}>
                    <Text style={styles.actionButtonText}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.speakButton]} onPress={()=>handleSpeakToggle(aiSummary, selectedLanguage?.code)}>
                    <Text style={styles.actionButtonText}>Listen</Text>
                  </TouchableOpacity>
                </View>
            </View>
          ) : null}
        </View>
      ) : null}
      
      {/* Download buttons */}
      {transcript && (
        <View style={styles.downloadSection}>
          <Text style={styles.downloadTitle}>Download Options:</Text>
          <View style={styles.downloadButtonsRow}>
            <TouchableOpacity style={styles.downloadButton} onPress={() => handleDownload('txt')}>
              <Text style={styles.downloadButtonText}>📄 .TXT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.downloadButton} onPress={() => handleDownload('doc')}>
              <Text style={styles.downloadButtonText}>📝 .DOC</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {translation && (
        <View style={styles.downloadSection}>
          <Text style={styles.downloadTitle}>Download Translation:</Text>
          <View style={styles.downloadButtonsRow}>
            <TouchableOpacity style={styles.downloadButton} onPress={() => handleDownloadTranslation('txt')}>
              <Text style={styles.downloadButtonText}>📄 .TXT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.downloadButton} onPress={() => handleDownloadTranslation('rtf')}>
              <Text style={styles.downloadButtonText}>📋 .RTF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.downloadButton} onPress={() => handleDownloadTranslation('doc')}>
              <Text style={styles.downloadButtonText}>📝 .DOC</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {aiSummary && (
        <View style={styles.downloadSection}>
          <Text style={styles.downloadTitle}>Download Summary:</Text>
          <View style={styles.downloadButtonsRow}>
            <TouchableOpacity style={styles.downloadButton} onPress={() => handleDownloadSummary('txt')}>
              <Text style={styles.downloadButtonText}>📄 .TXT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.downloadButton} onPress={() => handleDownloadSummary('rtf')}>
              <Text style={styles.downloadButtonText}>📋 .RTF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.downloadButton} onPress={() => handleDownloadSummary('doc')}>
              <Text style={styles.downloadButtonText}>📝 .DOC</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      <View style={styles.languageContainer}>
        <LanguageSelector
          selectedLanguage={selectedLanguage}
          onSelectLanguage={setSelectedLanguage}
          disabled={loading}
        />
      </View>

      {/* Manual Save Button */}
      {(transcript || translation || aiSummary) && !isSaved && (
        <TouchableOpacity
          style={styles.saveButton}
          onPress={async () => {
            try {
              await addToHistory({
                transcription: transcript,
                translation: translation,
                summary: aiSummary,
                translationSummary: '',
                created_at: new Date().toISOString(),
              });
              Alert.alert('Success', 'Content saved to history!');
            } catch (e) {
              Alert.alert('Error', 'Failed to save to history');
            }
          }}
        >
          <Text style={styles.saveButtonText}>💾 Save to History</Text>
        </TouchableOpacity>
      )}

      {isSaved && (transcript || translation || aiSummary) && (
        <View style={styles.savedIndicator}>
          <Text style={styles.savedText}>✅ Saved to History</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
    alignItems: 'center',
  },
  header: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 8, 
    color: '#1F2937', 
    textAlign: 'center' 
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  uploadButton: { 
    backgroundColor: '#2563EB', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 16,
    minWidth: 200,
    alignItems: 'center',
  },
  transcribeButton: {
    backgroundColor: '#10B981',
  },
  uploadButtonText: { 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  filesContainer: {
    marginBottom: 16, 
    width: '100%',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filesTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#374151',
  },
  fileItem: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  totalMinutes: {
    color: '#2563EB',
    fontWeight: 'bold',
    marginTop: 8,
  },
  creditsContainer: {
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  creditsText: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  adminCreditsContainer: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  adminCreditsText: {
    color: '#92400E',
  },
  progressContainer: {
    marginVertical: 16,
    alignItems: 'center',
  },
  progressText: {
    marginTop: 8,
    color: '#2563EB',
    fontSize: 14,
  },
  resultsContainer: {
    marginTop: 24,
    width: '100%',
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 12,
    color: '#374151',
  },
  textContainer: {
    maxHeight: 400, // Increased for better scrolling with long content
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  transcriptText: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 22,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  copyButton: {
    backgroundColor: '#6366F1',
  },
  speakButton: {
    backgroundColor: '#8B5CF6',
  },
  pasteButton: {
    backgroundColor: '#F59E0B',
  },
  clearButton: {
    backgroundColor: '#DC2626',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  processingText: {
    color: '#2563EB',
    marginTop: 8,
    fontSize: 14,
    fontStyle: 'italic',
  },
  translationContainer: {
    marginTop: 24,
  },
  summaryContainer: {
    marginTop: 24,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  summaryTitle: {
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 8,
    fontSize: 16,
  },
  summaryTextContainer: {
    maxHeight: 400, // Increased for better scrolling with long summaries
  },
  summaryText: {
    fontSize: 15,
    color: '#92400E',
    lineHeight: 22,
  },
  languageContainer: {
    marginBottom: 16, 
    width: '100%',
  },
  downloadSection: {
    marginBottom: 16,
    width: '100%',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  downloadTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 12,
    color: '#374151',
    textAlign: 'center',
  },
  downloadButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  downloadButton: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  summaryButtonContainer: {
    marginTop: 24,
    alignItems: 'center',
    width: '100%',
  },
  summaryButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  summaryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  summaryButtonNote: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 8,
    alignItems: 'center',
    width: '100%',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  savedIndicator: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  savedText: {
    color: '#059669',
    fontWeight: '600',
    fontSize: 14,
  },
}); 