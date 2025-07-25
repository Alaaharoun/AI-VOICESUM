import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Button, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useUserPermissions } from '@/hooks/useAuth';
import { AdminPanel } from '@/components/AdminPanel';
import * as DocumentPicker from 'expo-document-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import { Audio } from 'expo-av';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AdminRoute() {
  const { isSuperadmin, hasRole, loading } = useUserPermissions();
  const [pin, setPin] = useState('');
  const [pinOk, setPinOk] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [loadingTest, setLoadingTest] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [micResult, setMicResult] = useState('');
  const [micLoading, setMicLoading] = useState(false);
  const [wsResult, setWsResult] = useState('');
  const [wsRecording, setWsRecording] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [wsAudio, setWsAudio] = useState<Array<any>>([]);
  const [wsRecObj, setWsRecObj] = useState<Audio.Recording | null>(null);
  const { user } = useAuth();
  const [transcriptionStats, setTranscriptionStats] = useState<{
    total_users: number;
    total_minutes_purchased: number;
    total_minutes_used: number;
    average_usage_per_user: number;
    active_users_today: number;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Safe check for admin permissions
  const isAdmin = isSuperadmin || (typeof hasRole === 'function' && (hasRole('admin') || hasRole('super_admin')));

  // 1. إذا كان لا يزال يتحقق من الصلاحيات، أظهر شاشة التحميل
  if (loading) {
    return <View style={styles.center}><Text>Loading...</Text></View>;
  }

  // 2. إذا لم يكن المستخدم أدمن، أظهر Access Denied مباشرة
  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>Access Denied</Text>
        <Text style={styles.deniedText}>You do not have permission to access this page.</Text>
      </View>
    );
  }

  // 3. إذا كان المستخدم أدمن ولم يدخل الرقم السري بعد، أظهر شاشة إدخال الرقم السري فقط
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
          onPress={async () => {
            try {
              if (pin === '1414') {
                setPinOk(true);
                setError('');
              } else {
                setError('Incorrect PIN');
              }
            } catch (err) {
              setError('Unexpected error. Please try again.');
              Alert.alert('Error', 'An unexpected error occurred while checking the PIN.');
            }
          }}
        >
          <Text style={styles.pinButtonText}>Submit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 4. إذا كان المستخدم أدمن وأدخل الرقم السري الصحيح، أظهر فقط رسالة ترحيب بسيطة بدون أي مكون أو بيانات أخرى
  if (pinOk) {
    return (
      <View style={styles.center}>
        <Text style={styles.headerTitle}>🔧 Welcome to Admin Panel</Text>
        <Text style={styles.headerSubtitle}>You have successfully entered the admin area.</Text>
      </View>
    );
  }

  // 4. إذا كان المستخدم أدمن وأدخل الرقم السري الصحيح، أظهر لوحة الأدمن (الكود الحالي)
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

  const startRecordingOnce = async () => {
    setMicResult('');
    setMicLoading(true);
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setMicResult('❌ لم يتم منح إذن المايكروفون');
        setMicLoading(false);
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
      setMicLoading(false);
    } catch (err) {
      setMicResult('❌ خطأ في بدء التسجيل');
      setMicLoading(false);
    }
  };

  const stopRecordingOnce = async () => {
    setMicLoading(true);
    try {
      if (!recording) {
        setMicResult('❌ لم يتم العثور على تسجيل');
        setMicLoading(false);
        return;
      }
      await recording.stopAndUnloadAsync();
      setIsRecording(false);
      const uri = recording.getURI();
      if (!uri) {
        setMicResult('❌ لم يتم العثور على ملف الصوت');
        setMicLoading(false);
        return;
      }
      const file = await fetch(uri);
      const blob = await file.blob();
      const formData = new FormData();
      formData.append('audio', blob, 'mic-test.wav');
      const response = await fetch('https://ai-voicesum.onrender.com/live-translate', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = await response.json();
      if (data.transcription) {
        setMicResult('✅ النتيجة: ' + data.transcription);
      } else if (data.error) {
        setMicResult('❌ خطأ: ' + data.error);
      } else {
        setMicResult('❌ خطأ غير معروف');
      }
    } catch (err) {
      setMicResult('❌ خطأ في إرسال الصوت');
    }
    setMicLoading(false);
  };

  const startWsRecording = async () => {
    setWsResult('');
    setWsAudio([]);
    setWsRecording(true);
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setWsResult('❌ لم يتم منح إذن المايكروفون');
        setWsRecording(false);
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setWsRecObj(rec);
      // افتح WebSocket
      const socket = new WebSocket('wss://ai-voicesum.onrender.com/ws');
      socket.onopen = () => {
        setWs(socket);
        setWsResult('🔴 التسجيل جارٍ...');
      };
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'partial') {
            setWsResult('⏳ نص جزئي: ' + msg.text);
          } else if (msg.type === 'final') {
            setWsResult('✅ نص نهائي: ' + msg.text);
          } else if (msg.type === 'error') {
            setWsResult('❌ خطأ: ' + msg.error);
          }
        } catch {}
      };
      socket.onerror = () => setWsResult('❌ خطأ في الاتصال بالسيرفر');
      socket.onclose = () => setWsRecording(false);
    } catch (err) {
      setWsResult('❌ خطأ في بدء التسجيل');
      setWsRecording(false);
    }
  };

  const stopWsRecording = async () => {
    setWsRecording(false);
    try {
      if (wsRecObj) {
        await wsRecObj.stopAndUnloadAsync();
        const uri = wsRecObj.getURI();
        if (!uri) {
          setWsResult('❌ لم يتم العثور على ملف الصوت');
          return;
        }
        const file = await fetch(uri);
        const blob = await file.blob();
        // تقسيم الصوت إلى أجزاء صغيرة (مثلاً كل 1 ثانية)
        // هنا سنرسل الملف كاملاً دفعة واحدة (للتبسيط)، ويمكنك لاحقًا تقطيعه
        if (ws && ws.readyState === 1) {
          const arrayBuffer = await blob.arrayBuffer();
          try {
            ws.send(arrayBuffer);
            // انتظر قليلاً لإعطاء فرصة للإرسال
            await new Promise(res => setTimeout(res, 300));
            ws.close();
            setWsResult('✅ تم إرسال الصوت بنجاح');
          } catch (err) {
            setWsResult('❌ حدث خطأ أثناء إرسال الصوت عبر WebSocket');
          }
        } else {
          setWsResult('❌ الاتصال مغلق، لم يتم إرسال الصوت');
        }
      }
    } catch (err) {
      setWsResult('❌ خطأ في إرسال الصوت');
    }
  };

  // جلب إحصائيات تفريغ الصوت
  const fetchTranscriptionStats = async () => {
    setLoadingStats(true);
    try {
      // إحصائيات شاملة
      const { data: creditsData, error: creditsError } = await supabase
        .from('transcription_credits')
        .select('total_minutes, used_minutes');

      if (!creditsError && creditsData) {
        const totalMinutesPurchased = creditsData.reduce((sum, credit) => sum + (credit.total_minutes || 0), 0);
        const totalMinutesUsed = creditsData.reduce((sum, credit) => sum + (credit.used_minutes || 0), 0);
        const totalUsers = creditsData.length;
        const averageUsage = totalUsers > 0 ? Math.round(totalMinutesUsed / totalUsers * 100) / 100 : 0;

        // المستخدمين النشطين اليوم (مثال بسيط)
        const today = new Date().toISOString().split('T')[0];
        const { data: todayUsers } = await supabase
          .from('transcription_credits')
          .select('user_id')
          .gte('updated_at', today);

        setTranscriptionStats({
          total_users: totalUsers,
          total_minutes_purchased: totalMinutesPurchased,
          total_minutes_used: totalMinutesUsed,
          average_usage_per_user: averageUsage,
          active_users_today: todayUsers?.length || 0
        });
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while fetching transcription stats.');
      console.error('Error fetching transcription stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // جلب الإحصائيات عند تحميل الصفحة
  React.useEffect(() => {
    // لا تنفذ أي شيء إلا إذا كان المستخدم أدمن وأدخل الرقم السري
    if (pinOk) {
      try {
        fetchTranscriptionStats();
      } catch (error) {
        Alert.alert('Error', 'An error occurred while loading admin data.');
        console.error('Error in useEffect for fetchTranscriptionStats:', error);
      }
    }
  }, [pinOk]);

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

      {/* قسم إحصائيات تفريغ الصوت */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 إحصائيات تفريغ الصوت</Text>
        
        {loadingStats ? (
          <ActivityIndicator color="#2563EB" size="large" />
        ) : transcriptionStats ? (
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{transcriptionStats.total_users}</Text>
                <Text style={styles.statLabel}>إجمالي المستخدمين</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{transcriptionStats.total_minutes_purchased}</Text>
                <Text style={styles.statLabel}>الدقائق المشتراة</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{transcriptionStats.total_minutes_used}</Text>
                <Text style={styles.statLabel}>الدقائق المستخدمة</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{transcriptionStats.average_usage_per_user}</Text>
                <Text style={styles.statLabel}>متوسط الاستخدام/مستخدم</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{transcriptionStats.active_users_today}</Text>
                <Text style={styles.statLabel}>المستخدمين النشطين اليوم</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>
                  {transcriptionStats.total_minutes_purchased > 0 
                    ? Math.round((transcriptionStats.total_minutes_used / transcriptionStats.total_minutes_purchased) * 100)
                    : 0}%
                </Text>
                <Text style={styles.statLabel}>نسبة الاستخدام الإجمالية</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={fetchTranscriptionStats}
            >
              <Text style={styles.refreshButtonText}>تحديث الإحصائيات</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.noStatsText}>لا توجد إحصائيات متاحة</Text>
        )}
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

        {/* زر تسجيل وإرسال دفعة واحدة */}
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>🎙️ تسجيل وإرسال دفعة واحدة</Text>
          <Text style={styles.settingDescription}>
            سجل صوتك من المايك وأرسله دفعة واحدة إلى السيرفر لاختبار الترجمة
          </Text>
          {!isRecording && !micLoading ? (
            <TouchableOpacity
              style={styles.settingButton}
              onPress={startRecordingOnce}
            >
              <Text style={styles.settingButtonText}>بدء التسجيل</Text>
            </TouchableOpacity>
          ) : null}
          {isRecording && !micLoading ? (
            <TouchableOpacity
              style={styles.settingButton}
              onPress={async () => {
                await stopRecordingOnce();
                setRecording(null); // إعادة تعيين كائن التسجيل
              }}
            >
              <Text style={styles.settingButtonText}>إيقاف وإرسال</Text>
            </TouchableOpacity>
          ) : null}
          {micLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : null}
          {micResult ? (
            <View style={styles.resultContainer}>
              <Text style={styles.resultText}>{micResult}</Text>
              {!isRecording && !micLoading ? (
                <TouchableOpacity
                  style={[styles.settingButton, {marginTop: 8}]}
                  onPress={startRecordingOnce}
                >
                  <Text style={styles.settingButtonText}>بدء تسجيل جديد</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* زر تسجيل وإرسال فوري (WebSocket) */}
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>🌐 تسجيل وإرسال فوري (WebSocket)</Text>
          <Text style={styles.settingDescription}>
            سجل صوتك من المايك وأرسله مباشرة إلى السيرفر عبر WebSocket لاختبار الترجمة الفورية
          </Text>
          {!wsRecording ? (
            <TouchableOpacity
              style={styles.settingButton}
              onPress={startWsRecording}
            >
              <Text style={styles.settingButtonText}>بدء التسجيل الفوري</Text>
            </TouchableOpacity>
          ) : null}
          {wsRecording ? (
            <TouchableOpacity
              style={styles.settingButton}
              onPress={async () => {
                await stopWsRecording();
                setWsRecObj(null); // إعادة تعيين كائن التسجيل
              }}
            >
              <Text style={styles.settingButtonText}>إيقاف التسجيل</Text>
            </TouchableOpacity>
          ) : null}
          {wsResult ? (
            <View style={styles.resultContainer}>
              <Text style={styles.resultText}>{wsResult}</Text>
              {!wsRecording ? (
                <TouchableOpacity
                  style={[styles.settingButton, {marginTop: 8}]}
                  onPress={startWsRecording}
                >
                  <Text style={styles.settingButtonText}>بدء تسجيل جديد</Text>
                </TouchableOpacity>
              ) : null}
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
  statsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563EB',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  noStatsText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 16,
    fontStyle: 'italic',
  },
}); 