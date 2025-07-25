import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useUserPermissions } from '@/hooks/useAuth';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { LanguageSelector, type Language } from '@/components/LanguageSelector';
import { SpeechService } from '@/services/speechService';
import Tts from 'react-native-tts';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Audio, Video } from 'expo-av';

// Provider is now fixed to AssemblyAI only
const PROVIDER = 'assemblyai';

const ASSEMBLYAI_API_KEY = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY;
const QWEN_API_KEY = process.env.EXPO_PUBLIC_QWEN_API_KEY;

// نوع جديد لقائمة الملفات مع المدة
interface FileWithDuration {
  name: string;
  uri: string;
  size: number;
  duration: number; // بالثواني
}

const maskKey = (key: string | undefined | null) => {
  if (!key) return '-';
  const str = String(key);
  if (str.length <= 10) return str;
  return str.slice(0, 4) + '*'.repeat(str.length - 8) + str.slice(-4);
};

export default function AdminUploadScreen() {
  const { isSuperadmin, hasRole, loading: permissionsLoading } = useUserPermissions();
  const { user } = useAuth();
  const [files, setFiles] = useState<FileWithDuration[]>([]);
  const [provider, setProvider] = useState('assemblyai');
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
  // إزالة transcriptionStats state

  // تبسيط جلب الرصيد فقط
  useEffect(() => {
    const fetchCredits = async () => {
      if (!user) return;
      
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
  }, [user, files]);

  if (permissionsLoading) {
    return <View style={styles.center}><Text>Loading...</Text></View>;
  }
  if (!isSuperadmin && !hasRole('admin')) {
    return <View style={styles.center}><Text style={{color:'#DC2626', fontWeight:'bold'}}>Admin Only - You do not have permission to access this page.</Text></View>;
  }

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
        setProgress('');
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
    if (remainingMinutes === null) {
      Alert.alert('Error', 'Cannot fetch your credits.');
      return;
    }
    if (totalMinutes > remainingMinutes) {
      Alert.alert('رصيدك غير كافٍ', 'مجموع مدة الملفات أكبر من رصيدك المتبقي. يرجى شراء دقائق إضافية.');
      return;
    }
    setLoading(true);
    setProgress('Uploading files...');
    setTranscript('');
    setTranslation('');
    setAiSummary('');
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
      setProgress('');
        setTranscript(prev => prev + `\n\n[${file.name}]\n` + resultText);
        // خصم الدقائق بعد كل ملف
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
      }
      setFiles([]);
    } catch (err) {
      setProgress('');
      const errorMsg = err instanceof Error ? err.message : 'Transcription failed';
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (type: 'txt' | 'doc') => {
    if (!transcript) return;
    try {
      const fileName = `transcription_${Date.now()}.${type}`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, transcript, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: type === 'txt' ? 'text/plain' : 'application/msword' });
    } catch (err) {
      Alert.alert('Error', 'Failed to share file.');
    }
  };

  const handleCopy = async (text: string, type: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Success', `${type} copied to clipboard!`);
    } catch (err) {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.adminNote}>⚠️ This screen is for admins only. Unauthorized access is prohibited.</Text>
      <Text style={styles.header}>Admin File Transcription</Text>
      <Text style={{color:'#DC2626',fontSize:13,marginBottom:8}}>ASSEMBLYAI_API_KEY: {maskKey(ASSEMBLYAI_API_KEY)}</Text>
      <TouchableOpacity style={styles.uploadButton} onPress={handlePickFile} disabled={loading}>
        <Text style={styles.uploadButtonText}>{files.length > 0 ? 'Change Files' : 'Upload Audio/Video Files'}</Text>
      </TouchableOpacity>
      {files.length > 0 && (
        <View style={{marginBottom:16, width:'100%'}}>
          <Text style={{fontWeight:'bold',marginBottom:4}}>Selected files:</Text>
          {files.map((f, idx) => (
            <Text key={idx} style={{fontSize:14}}>
              {f.name} - {Math.ceil(f.duration/60)} min
            </Text>
          ))}
          <Text style={{color:'#2563EB',marginTop:4}}>Total: {totalMinutes} min</Text>
        </View>
      )}
      {/* عرض الرصيد المتبقي فقط */}
      {user && (
        <Text style={{color:'#10B981',fontWeight:'bold',marginBottom:8}}>
          الرصيد المتبقي: {remainingMinutes !== null ? remainingMinutes + ' دقيقة' : '...'}
        </Text>
      )}
      
      {/* إزالة قسم الإحصائيات */}
      {/* لا تعرض اسم المزود */}
      {/* <Text style={styles.sectionTitle}>Select Transcription Provider</Text> */}
      {/* <View style={styles.providerRow}> ... */}
      {/* لا تعرض أزرار المزود */}
      {/* زر بدء التفريغ فقط */}
      {files.length > 0 && (
        <TouchableOpacity style={[styles.uploadButton, {backgroundColor:'#10B981'}]} onPress={handleStartTranscription} disabled={loading}>
          <Text style={styles.uploadButtonText}>{loading ? 'جاري التفريغ...' : 'بدء التفريغ'}</Text>
        </TouchableOpacity>
      )}
      {progress ? (
        <View style={{marginVertical:16,alignItems:'center'}}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={{marginTop:8,color:'#2563EB'}}>{progress}</Text>
        </View>
      ) : null}
      {transcript ? (
        <View style={{marginTop:24,width:'100%'}}>
          <Text style={{fontWeight:'bold',fontSize:16,marginBottom:8,color:'#374151'}}>النص الأصلي:</Text>
          <ScrollView style={{maxHeight:200,backgroundColor:'#F3F4F6',borderRadius:8,padding:12}}>
            <Text selectable style={{fontSize:15,color:'#1F2937'}}>{transcript}</Text>
          </ScrollView>
          <View style={{flexDirection:'row',marginTop:8,justifyContent:'flex-end'}}>
            <TouchableOpacity style={[styles.uploadButton,{backgroundColor:'#6366F1',marginRight:8}]} onPress={()=>handleCopy(transcript, 'النص الأصلي')}>
              <Text style={styles.uploadButtonText}>نسخ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.uploadButton,{backgroundColor:'#6366F1'}]} onPress={()=>handleSpeakToggle(transcript)}>
              <Text style={styles.uploadButtonText}>استمع</Text>
            </TouchableOpacity>
          </View>
          {translating && <Text style={{color:'#2563EB',marginTop:8}}>جاري الترجمة...</Text>}
          {translation ? (
            <View style={{marginTop:18}}>
              <Text style={{fontWeight:'bold',fontSize:16,marginBottom:8,color:'#8B5CF6'}}>الترجمة:</Text>
              <ScrollView style={{maxHeight:200,backgroundColor:'#F3F4F6',borderRadius:8,padding:12}}>
                <Text selectable style={{fontSize:15,color:'#1F2937'}}>{translation}</Text>
              </ScrollView>
              <View style={{flexDirection:'row',marginTop:8,justifyContent:'flex-end'}}>
                <TouchableOpacity style={[styles.uploadButton,{backgroundColor:'#6366F1',marginRight:8}]} onPress={()=>handleCopy(translation, 'الترجمة')}>
                  <Text style={styles.uploadButtonText}>نسخ</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.uploadButton,{backgroundColor:'#6366F1'}]} onPress={()=>handleSpeakToggle(translation, selectedLanguage?.code)}>
                  <Text style={styles.uploadButtonText}>استمع</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {summarizing && <Text style={{color:'#10B981',marginTop:8}}>جاري التلخيص...</Text>}
          {aiSummary ? (
            <View style={{marginTop:18,backgroundColor:'#FEF3C7',borderRadius:8,padding:12}}>
              <Text style={{fontWeight:'bold',color:'#92400E',marginBottom:6}}>ملخص الذكاء الاصطناعي:</Text>
              <ScrollView style={{maxHeight:180}}>
                <Text selectable style={{fontSize:15,color:'#92400E'}}>{aiSummary}</Text>
              </ScrollView>
              <View style={{flexDirection:'row',marginTop:8,justifyContent:'flex-end'}}>
                <TouchableOpacity style={[styles.uploadButton,{backgroundColor:'#10B981',marginRight:8}]} onPress={()=>handleCopy(aiSummary, 'الملخص')}>
                  <Text style={styles.uploadButtonText}>نسخ</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.uploadButton,{backgroundColor:'#10B981'}]} onPress={()=>handleSpeakToggle(aiSummary, selectedLanguage?.code)}>
                  <Text style={styles.uploadButtonText}>استمع</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={{marginBottom:16, width:'100%'}}>
        <LanguageSelector
          selectedLanguage={selectedLanguage}
          onSelectLanguage={setSelectedLanguage}
          disabled={loading}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#F8FAFC', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  adminNote: { color: '#DC2626', fontWeight: 'bold', marginBottom: 16, fontSize: 15, textAlign: 'center' },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 18, color: '#2563EB', textAlign: 'center' },
  uploadButton: { backgroundColor: '#2563EB', padding: 14, borderRadius: 10, marginBottom: 16 },
  uploadButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  fileInfo: { marginBottom: 16, alignItems: 'center' },
  fileLabel: { fontWeight: 'bold', color: '#374151' },
  fileValue: { color: '#2563EB' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#374151', alignSelf: 'flex-start' },
  providerRow: { flexDirection: 'row', marginBottom: 24 },
  providerButton: { padding: 10, borderRadius: 8, backgroundColor: '#E5E7EB', marginRight: 12 },
  providerButtonActive: { backgroundColor: '#2563EB' },
  providerButtonText: { color: '#374151', fontWeight: 'bold' },
  providerButtonTextActive: { color: 'white' },
}); 