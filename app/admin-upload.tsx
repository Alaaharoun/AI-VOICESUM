import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useUserPermissions } from '@/hooks/useAuth';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { LanguageSelector, type Language } from '@/components/LanguageSelector';
import { SpeechService } from '@/services/speechService';
import Tts from 'react-native-tts';
import * as Clipboard from 'expo-clipboard';

const PROVIDERS = [
  { label: 'AssemblyAI', value: 'assemblyai' },
  { label: 'Azure Speech Services', value: 'azure' },
];

const ASSEMBLYAI_API_KEY = process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY;
const QWEN_API_KEY = process.env.EXPO_PUBLIC_QWEN_API_KEY;

type FileType = DocumentPicker.DocumentPickerSuccessResult | null;

const maskKey = (key: string | undefined | null) => {
  if (!key) return '-';
  const str = String(key);
  if (str.length <= 10) return str;
  return str.slice(0, 4) + '*'.repeat(str.length - 8) + str.slice(-4);
};

export default function AdminUploadScreen() {
  const { isSuperadmin, hasRole, loading: permissionsLoading } = useUserPermissions();
  const [file, setFile] = useState<FileType>(null);
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

  if (permissionsLoading) {
    return <View style={styles.center}><Text>Loading...</Text></View>;
  }
  if (!isSuperadmin && !hasRole('admin')) {
    return <View style={styles.center}><Text style={{color:'#DC2626', fontWeight:'bold'}}>Admin Only - You do not have permission to access this page.</Text></View>;
  }

  const handlePickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'video/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) {
        setFile(null);
      } else {
        setFile(res);
        setTranscript('');
        setProgress('');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick file.');
    }
  };

  const handleStartTranscription = async () => {
    if (!file || !file.assets || !file.assets[0] || !file.assets[0].uri) {
      Alert.alert('No file selected');
      return;
    }
    if (!ASSEMBLYAI_API_KEY) {
      Alert.alert('Error', 'AssemblyAI API key is missing.');
      return;
    }
    setLoading(true);
    setProgress('Uploading file...');
    setTranscript('');
    setTranslation('');
    setAiSummary('');
    try {
      // 1. رفع الملف إلى AssemblyAI
      const fileUri = file.assets[0].uri;
      const fileInfo = await fetch(fileUri);
      const fileBlob = await fileInfo.blob();
      const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'authorization': ASSEMBLYAI_API_KEY,
        },
        body: fileBlob,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.upload_url) throw new Error('Upload failed');
      setProgress('File uploaded. Starting transcription...');
      // 2. بدء التفريغ
      const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'authorization': ASSEMBLYAI_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          audio_url: uploadData.upload_url,
        }),
      });
      const transcriptData = await transcriptRes.json();
      if (!transcriptData.id) throw new Error('Transcription start failed');
      setProgress('Transcription started. Waiting for result...');
      // 3. Polling for result
      let status = transcriptData.status;
      let resultText = '';
      while (status && status !== 'completed' && status !== 'error') {
        await new Promise(res => setTimeout(res, 4000));
        setProgress('Transcribing... (' + status + ')');
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
      setTranscript(resultText);
      if (resultText && selectedLanguage && selectedLanguage.code) {
        setTranslating(true);
        try {
          const translated = await SpeechService.translateText(resultText, selectedLanguage.code);
          setTranslation(translated);
        } catch (err) {
          setTranslation('');
          Alert.alert('Error', 'Translation failed');
        } finally {
          setTranslating(false);
        }
      }
      // التلخيص
      const textToSummarize = translation || resultText;
      if (textToSummarize && textToSummarize.length >= 50) {
        setSummarizing(true);
        try {
          const summary = await SpeechService.summarizeText(textToSummarize, selectedLanguage?.code);
          setAiSummary(summary);
        } catch (err) {
          setAiSummary('');
          Alert.alert('Error', 'Summarization failed');
        } finally {
          setSummarizing(false);
        }
      }
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
        <Text style={styles.uploadButtonText}>{file ? 'Change File' : 'Upload Audio/Video File'}</Text>
      </TouchableOpacity>
      {file && file.assets && file.assets[0] && (
        <View style={styles.fileInfo}>
          <Text style={styles.fileLabel}>File Name: <Text style={styles.fileValue}>{file.assets[0].name || ''}</Text></Text>
          <Text style={styles.fileLabel}>File Size: <Text style={styles.fileValue}>{file.assets[0].size ? (Number(file.assets[0].size)/1024).toFixed(2) : ''} KB</Text></Text>
        </View>
      )}
      <Text style={styles.sectionTitle}>Select Transcription Provider</Text>
      <View style={styles.providerRow}>
        {PROVIDERS.map((prov) => (
          <TouchableOpacity
            key={prov.value}
            style={[styles.providerButton, provider === prov.value && styles.providerButtonActive]}
            onPress={() => setProvider(prov.value)}
            disabled={loading}
          >
            <Text style={[styles.providerButtonText, provider === prov.value && styles.providerButtonTextActive]}>{prov.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {file && (
        <TouchableOpacity style={[styles.uploadButton, {backgroundColor:'#10B981'}]} onPress={handleStartTranscription} disabled={loading}>
          <Text style={styles.uploadButtonText}>{loading ? 'Processing...' : 'Start Transcription'}</Text>
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
          <Text style={{fontWeight:'bold',fontSize:16,marginBottom:8,color:'#374151'}}>Original Transcription:</Text>
          <ScrollView style={{maxHeight:200,backgroundColor:'#F3F4F6',borderRadius:8,padding:12}}>
            <Text selectable style={{fontSize:15,color:'#1F2937'}}>{transcript}</Text>
          </ScrollView>
          <View style={{flexDirection:'row',marginTop:8}}>
            <TouchableOpacity style={[styles.uploadButton,{backgroundColor:'#6366F1',marginRight:8}]} onPress={()=>handleCopy(transcript, 'Transcription')}>
              <Text style={styles.uploadButtonText}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.uploadButton,{backgroundColor:'#6366F1'}]} onPress={()=>handleSpeakToggle(transcript)}>
              <Text style={styles.uploadButtonText}>Speak</Text>
            </TouchableOpacity>
          </View>
          {translating && <Text style={{color:'#2563EB',marginTop:8}}>Translating...</Text>}
          {translation ? (
            <View style={{marginTop:18}}>
              <Text style={{fontWeight:'bold',fontSize:16,marginBottom:8,color:'#8B5CF6'}}>Translation ({selectedLanguage?.flag} {selectedLanguage?.name}):</Text>
              <ScrollView style={{maxHeight:200,backgroundColor:'#F3F4F6',borderRadius:8,padding:12}}>
                <Text selectable style={{fontSize:15,color:'#1F2937'}}>{translation}</Text>
              </ScrollView>
              <View style={{flexDirection:'row',marginTop:8}}>
                <TouchableOpacity style={[styles.uploadButton,{backgroundColor:'#6366F1',marginRight:8}]} onPress={()=>handleCopy(translation, 'Translation')}>
                  <Text style={styles.uploadButtonText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.uploadButton,{backgroundColor:'#6366F1'}]} onPress={()=>handleSpeakToggle(translation, selectedLanguage?.code)}>
                  <Text style={styles.uploadButtonText}>Speak</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {summarizing && <Text style={{color:'#10B981',marginTop:8}}>Summarizing...</Text>}
          {aiSummary ? (
            <View style={{marginTop:18,backgroundColor:'#FEF3C7',borderRadius:8,padding:12}}>
              <Text style={{fontWeight:'bold',color:'#92400E',marginBottom:6}}>AI Summary:</Text>
              <ScrollView style={{maxHeight:180}}>
                <Text selectable style={{fontSize:15,color:'#92400E'}}>{aiSummary}</Text>
              </ScrollView>
              <View style={{flexDirection:'row',marginTop:8}}>
                <TouchableOpacity style={[styles.uploadButton,{backgroundColor:'#10B981',marginRight:8}]} onPress={()=>handleCopy(aiSummary, 'Summary')}>
                  <Text style={styles.uploadButtonText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.uploadButton,{backgroundColor:'#10B981'}]} onPress={()=>handleSpeakToggle(aiSummary, selectedLanguage?.code)}>
                  <Text style={styles.uploadButtonText}>Speak</Text>
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