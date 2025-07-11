import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Button, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useUserPermissions } from '@/hooks/useAuth';
import { AdminPanel } from '@/components/AdminPanel';
import * as DocumentPicker from 'expo-document-picker';
import * as IntentLauncher from 'expo-intent-launcher';

export default function AdminRoute() {
  const { isSuperadmin, hasRole, loading } = useUserPermissions();
  const [pin, setPin] = useState('');
  const [pinOk, setPinOk] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [loadingTest, setLoadingTest] = useState(false);

  const isAdmin = isSuperadmin || hasRole('admin') || hasRole('superadmin');

  if (loading) {
    return <View style={styles.center}><Text>Loading...</Text></View>;
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>Access Denied</Text>
        <Text style={styles.deniedText}>You do not have permission to access this page.</Text>
      </View>
    );
  }

  if (!pinOk) {
    return (
      <View style={styles.center}>
        <Text style={styles.pinTitle}>Enter Admin PIN</Text>
        <TextInput
          style={styles.pinInput}
          value={pin}
          onChangeText={setPin}
          keyboardType="numeric"
          secureTextEntry
          maxLength={8}
          placeholder="Enter PIN"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={styles.pinButton}
          onPress={() => {
            if (pin === '1414') {
              setPinOk(true);
              setError('');
            } else {
              setError('Incorrect PIN');
            }
          }}
        >
          <Text style={styles.pinButtonText}>Submit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const testAudioToServer = async () => {
    setResult('');
    setLoadingTest(true);

    try {
      // اختر ملف صوتي من الجهاز
      const file = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (file.canceled) {
        setLoadingTest(false);
        return;
      }

      // جلب البيانات الثنائية للملف
      const responseFile = await fetch(file.assets[0].uri);
      const blob = await responseFile.blob();

      const formData = new FormData();
      formData.append('audio', blob, file.assets[0].name || 'test-audio.wav');

      const response = await fetch('https://ai-voicesum.onrender.com/live-translate', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const data = await response.json();
      if (data.translatedText) {
        setResult('✅ النتيجة: ' + data.translatedText);
      } else if (data.error) {
        setResult('❌ خطأ: ' + data.error);
      } else {
        setResult('❌ خطأ غير معروف');
      }
    } catch (err) {
      setResult('❌ خطأ في الاتصال بالسيرفر');
      console.error('Audio test error:', err);
    }
    setLoadingTest(false);
  };

  const openGooglePlay = () => {
    IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: 'https://play.google.com/store/apps/details?id=com.anonymous.boltexponativewind',
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔧 لوحة الإدارة</Text>
        <Text style={styles.headerSubtitle}>مرحباً بك في لوحة تحكم التطبيق</Text>
      </View>

      {/* قسم الإدارة الرئيسي */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 إدارة المستخدمين والاشتراكات</Text>
        <AdminPanel />
      </View>

      {/* قسم الإعدادات */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ الإعدادات</Text>
        
        {/* زر تجربة الصوت */}
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>🎤 اختبار الترجمة الفورية</Text>
          <Text style={styles.settingDescription}>
            اختبر إرسال ملف صوتي إلى السيرفر للحصول على الترجمة الفورية
          </Text>
          <TouchableOpacity 
            style={[styles.settingButton, loadingTest && styles.settingButtonDisabled]} 
            onPress={testAudioToServer}
            disabled={loadingTest}
          >
            {loadingTest ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.settingButtonText}>اختبار الصوت</Text>
            )}
          </TouchableOpacity>
          {result ? (
            <View style={styles.resultContainer}>
              <Text style={styles.resultText}>{result}</Text>
            </View>
          ) : null}
        </View>

        {/* زر Google Play */}
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>📱 Google Play Store</Text>
          <Text style={styles.settingDescription}>
            افتح صفحة التطبيق على متجر Google Play
          </Text>
          <TouchableOpacity 
            style={styles.settingButton} 
            onPress={openGooglePlay}
          >
            <Text style={styles.settingButtonText}>فتح Google Play</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  header: {
    backgroundColor: '#2563EB',
    padding: 24,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#E0E7FF',
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  settingItem: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  settingButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  settingButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  settingButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  resultContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  resultText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  deniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  deniedText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  pinTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1F2937',
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    width: 180,
    textAlign: 'center',
    marginBottom: 12,
    backgroundColor: 'white',
  },
  pinButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  pinButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  error: {
    color: '#EF4444',
    marginBottom: 8,
  },
}); 