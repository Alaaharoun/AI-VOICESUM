import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  Platform,
  PermissionsAndroid,
  Linking,
  Switch,
  TextInput,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import { User, Mail, Crown, Settings, LogOut, Calendar, CircleCheck as CheckCircle, Sun, Moon, Info, Trash2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
  },
  subscriptionText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
    marginLeft: 4,
  },
  freeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoContent: {
    marginLeft: 16,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  subscriptionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginLeft: 8,
  },
  subscriptionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 16,
  },
  features: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginLeft: 8,
  },
  upgradeCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  upgradeTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginLeft: 8,
  },
  upgradeDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 16,
  },
  upgradeButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: 'white',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginLeft: 12,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: 'white',
  },
});

const PLAN_LABELS: Record<string, string> = {
  'mini-monthly': 'Mini (Basic+)',
  'basic-monthly': 'Basic Monthly',
  'basic-yearly': 'Basic Yearly',
  'pro-monthly': 'Pro Monthly',
  'pro-yearly': 'Pro Yearly',
  'unlimited-monthly': 'Unlimited Monthly',
  'unlimited-yearly': 'Unlimited Yearly',
  'free_trial': 'Free Trial',
};

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { 
    isSubscribed,
    checkSubscription, 
    hasFreeTrial, 
    freeTrialExpired,
    dailyUsageSeconds,
    dailyLimitSeconds,
    getRemainingTrialTime,
    getRemainingMinutes,
    subscriptionType,
    subscriptionPlan,
    subscriptionStatus,
    subscriptionEndDate,
    subscriptionPlanName
  } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [loadingPaid, setLoadingPaid] = useState(false);
  const [remainingPaidMinutes, setRemainingPaidMinutes] = useState<number | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [micStatus, setMicStatus] = useState<'granted' | 'denied' | 'unknown'>('unknown');
  const [storageStatus, setStorageStatus] = useState<'granted' | 'denied' | 'unknown'>('unknown');
  const systemScheme = useColorScheme();
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [supportVisible, setSupportVisible] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [rateTapCount, setRateTapCount] = useState(0);
  const rateTapTimeout = useRef<NodeJS.Timeout | number | null>(null);
  const [rateUsUrl, setRateUsUrl] = useState('');
  const [shareAppUrl, setShareAppUrl] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    const fetchPaidUsage = async () => {
      if (!user || !isSubscribed || subscriptionType === 'yearly') {
        setRemainingPaidMinutes(null);
        return;
      }
      setLoadingPaid(true);
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('usage_seconds, subscription_type')
        .eq('user_id', user.id)
        .eq('active', true)
        .gt('expires_at', new Date().toISOString())
        .single();
      if (error || !data) {
        setRemainingPaidMinutes(null);
        setLoadingPaid(false);
        return;
      }
      let totalMinutes = 0;
      if (data.subscription_type === 'transcription_2.5hr') totalMinutes = 150;
      else if (data.subscription_type === 'transcription_5hr') totalMinutes = 300;
      else {
        setRemainingPaidMinutes(null);
        setLoadingPaid(false);
        return;
      }
      const usedMinutes = Math.floor((data.usage_seconds || 0) / 60);
      setRemainingPaidMinutes(Math.max(0, totalMinutes - usedMinutes));
      setLoadingPaid(false);
    };
    fetchPaidUsage();
  }, [user, checkSubscription, subscriptionType]);

  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const { data: rateData, error: rateError } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'rate_us_url')
          .single();
        
        if (rateError) {
          console.warn('Error fetching rate_us_url:', rateError);
          setRateUsUrl('https://play.google.com/store/apps/details?id=com.ailivetranslate.app');
        } else if (rateData && rateData.value) {
          setRateUsUrl(rateData.value);
        }
        
        const { data: shareData, error: shareError } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'share_app_url')
          .single();
        
        if (shareError) {
          console.warn('Error fetching share_app_url:', shareError);
          setShareAppUrl('https://play.google.com/store/apps/details?id=com.ailivetranslate.app');
        } else if (shareData && shareData.value) {
          setShareAppUrl(shareData.value);
        }
      } catch (error) {
        console.error('Error fetching app settings:', error);
        // Set default values if there's an error
        setRateUsUrl('https://play.google.com/store/apps/details?id=com.ailivetranslate.app');
        setShareAppUrl('https://play.google.com/store/apps/details?id=com.ailivetranslate.app');
      }
    };
    fetchLinks();
  }, []);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
            await SecureStore.deleteItemAsync('savedEmail');
            await SecureStore.deleteItemAsync('savedPassword');
            await AsyncStorage.clear();
          } catch (err) {
            console.error('SignOut failed:', err);
            const msg = (err && typeof err === 'object' && 'message' in err) ? (err as any).message : String(err);
            Alert.alert('Error', msg ?? 'Failed to sign out');
          } finally {
            setSigningOut(false);
            router.replace('/(auth)/sign-in');
          }
        },
      },
    ]);
  };

  useEffect(() => {
    if (!user && !signingOut) {
      router.replace('/(auth)/sign-in');
    }
  }, [user, signingOut]);

  const checkMicPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      setMicStatus(granted ? 'granted' : 'denied');
    } else {
      setMicStatus('granted'); // iOS: assume granted for demo
    }
  };
  const checkStoragePermission = async () => {
    if (Platform.OS === 'android') {
      let granted = false;
      if (Platform.Version >= 33) {
        // Android 13+ (API 33)
        const audio = await PermissionsAndroid.check('android.permission.READ_MEDIA_AUDIO');
        const images = await PermissionsAndroid.check('android.permission.READ_MEDIA_IMAGES');
        const video = await PermissionsAndroid.check('android.permission.READ_MEDIA_VIDEO');
        granted = audio && images && video;
      } else {
        // Android 12 وأقل
        const write = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        const read = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
        granted = write && read;
      }
      setStorageStatus(granted ? 'granted' : 'denied');
    } else {
      setStorageStatus('granted');
    }
  };
  const checkAllPermissions = async () => {
    await checkMicPermission();
    await checkStoragePermission();
  };
  const requestMicPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      setMicStatus(granted === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied');
    } else {
      setMicStatus('granted');
    }
    await checkAllPermissions();
  };
  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      let granted = false;
      if (Platform.Version >= 33) {
        // Android 13+ (API 33)
        const audio = await PermissionsAndroid.request('android.permission.READ_MEDIA_AUDIO');
        const images = await PermissionsAndroid.request('android.permission.READ_MEDIA_IMAGES');
        const video = await PermissionsAndroid.request('android.permission.READ_MEDIA_VIDEO');
        granted = [audio, images, video].every(
          (res) => res === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        // Android 12 وأقل
        const write = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        const read = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
        granted = write === PermissionsAndroid.RESULTS.GRANTED && read === PermissionsAndroid.RESULTS.GRANTED;
      }
      setStorageStatus(granted ? 'granted' : 'denied');
      if (!granted) {
        Alert.alert(
          'تنبيه التصاريح',
          'لم يتم منح تصريح التخزين. إذا لم يظهر التصريح في الإعدادات، جرب حذف التطبيق وإعادة تثبيته أو احفظ ملفًا فعليًا من التطبيق.'
        );
      }
    } else {
      setStorageStatus('granted');
    }
    await checkAllPermissions();
  };

  const handleRateUsSecret = () => {
    setRateTapCount((prev) => {
      const newCount = prev + 1;
      if (newCount === 5) {
        setRateTapCount(0);
        if (rateTapTimeout.current) clearTimeout(rateTapTimeout.current);
        router.push('/admin');
        return 0;
      } else {
        if (rateTapTimeout.current) clearTimeout(rateTapTimeout.current);
        rateTapTimeout.current = setTimeout(() => setRateTapCount(0), 2000);
        return newCount;
      }
    });
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: `جرب تطبيق الترجمة الصوتية الرائع! حمله الآن من هنا: ${shareAppUrl}`,
        url: shareAppUrl,
        title: 'تطبيق الترجمة الصوتية'
      });
    } catch (error) {
      // يمكنك إظهار رسالة خطأ إذا أردت
    }
  };

  const getPlanLabel = () => {
    if (!isSubscribed && hasFreeTrial && !freeTrialExpired) return PLAN_LABELS['free_trial'];
    if (!isSubscribed) return 'Free';
    if (subscriptionType && PLAN_LABELS[subscriptionType]) return PLAN_LABELS[subscriptionType];
    return 'Premium'; // fallback
  };

  const getMemberSince = () => {
    if (!user?.created_at) return '';
    const created = new Date(user.created_at);
    const now = new Date();
    // إذا كان التاريخ في المستقبل، اعرض تاريخ اليوم
    if (created > now) return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return created.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <Text style={{ fontSize: 16, color: '#6B7280' }}>Loading profile...</Text>
      </View>
    );
  }

  try {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <User size={32} color="#6B7280" />
            </View>
          </View>
          <Text style={styles.userName}>{user.email}</Text>
          <View style={styles.subscriptionBadge}>
            <Crown size={16} color="#F59E0B" />
            <Text style={styles.subscriptionText}>{getPlanLabel()} Plan</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Mail size={20} color="#6B7280" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Calendar size={20} color="#6B7280" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Member Since</Text>
                <Text style={styles.infoValue}>{getMemberSince()}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription Status</Text>
          {isSubscribed ? (
            <View style={styles.subscriptionCard}>
              <View style={styles.subscriptionHeader}>
                <Crown size={24} color="#F59E0B" />
                <Text style={styles.subscriptionTitle}>{getPlanLabel()} Plan</Text>
              </View>
              <View style={styles.infoRow}>
                <Calendar size={20} color="#6B7280" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Subscription Type</Text>
                  <Text style={styles.infoValue}>{getPlanLabel()} Plan</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Calendar size={20} color="#6B7280" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Valid Until</Text>
                  <Text style={styles.infoValue}>
                    {subscriptionEndDate
                      ? subscriptionEndDate.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <CheckCircle size={20} color="#10B981" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Minutes Left</Text>
                  <Text style={[styles.infoValue, { color: '#10B981' }]}> 
                    {loadingPaid ? '-' : (subscriptionPlan === 'unlimited' ? 'Unlimited' : (getRemainingMinutes() !== null && getRemainingMinutes() !== undefined ? String(getRemainingMinutes()) + ' min' : '-'))}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.actionButton, { flex: 1, backgroundColor: '#2563EB' }]}
                  onPress={() => router.push('/subscription')}
                >
                  <Text style={styles.actionButtonText}>Change Plan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { flex: 1, backgroundColor: '#EF4444' }]}
                  onPress={() => {
                    Alert.alert(
                      'Cancel Subscription',
                      'Are you sure you want to cancel your subscription? You can reactivate it anytime.',
                      [
                        { text: 'No', style: 'cancel' },
                        {
                          text: 'Yes, Cancel',
                          style: 'destructive',
                          onPress: () => {
                            // TODO: Implement subscription cancellation
                            Alert.alert('Subscription Cancelled', 'Your subscription has been cancelled. You can reactivate it anytime from the subscription page.');
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : hasFreeTrial ? (
            <View style={styles.subscriptionCard}>
              <View style={styles.subscriptionHeader}>
                <Crown size={24} color="#10B981" />
                <Text style={styles.subscriptionTitle}>Free Trial</Text>
              </View>
              <View style={styles.infoRow}>
                <CheckCircle size={20} color="#10B981" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Minutes Left</Text>
                  <Text style={[styles.infoValue, { color: '#10B981' }]}> {Math.floor((dailyLimitSeconds - dailyUsageSeconds) / 60)} min</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Calendar size={20} color="#6B7280" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Trial Ends</Text>
                  <Text style={styles.infoValue}>
                    {subscriptionEndDate
                      ? subscriptionEndDate.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : hasFreeTrial
                        ? (() => { const d = new Date(); d.setDate(d.getDate() + 2); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); })()
                        : ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#2563EB', marginTop: 16 }]}
                onPress={() => router.push('/subscription')}
              >
                <Text style={styles.actionButtonText}>Upgrade to Premium</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.subscriptionCard}>
              <View style={styles.subscriptionHeader}>
                <Crown size={24} color="#6B7280" />
                <Text style={styles.subscriptionTitle}>No Active Subscription</Text>
              </View>
              <Text style={styles.subscriptionDescription}>
                Upgrade to premium to get unlimited transcriptions, AI summaries, and instant translations.
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#2563EB', marginTop: 16 }]}
                onPress={() => router.push('/subscription')}
              >
                <Text style={styles.actionButtonText}>View Plans</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              setSettingsVisible(true);
              checkAllPermissions();
            }}
          >
            <Settings size={20} color="#6B7280" />
            <Text style={styles.settingText}>App Settings</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem} onPress={handleSignOut} disabled={signingOut}>
            <LogOut size={20} color="#EF4444" />
            <Text style={[styles.settingText, { color: '#EF4444' }]}>{signingOut ? 'Signing Out...' : 'Sign Out'}</Text>
          </TouchableOpacity>

          {/* Enable Live Translate Button */}
          {(isSubscribed || (hasFreeTrial && !freeTrialExpired && (dailyLimitSeconds - dailyUsageSeconds) > 0)) && (
            <TouchableOpacity
              style={[styles.settingItem, { backgroundColor: '#E0F2FE', marginTop: 8 }]}
              onPress={() => router.push('/(tabs)/live-translation')}
            >
              <Info size={20} color="#2563EB" />
              <Text style={[styles.settingText, { color: '#2563EB' }]}>Enable Live Translate</Text>
            </TouchableOpacity>
          )}

          {/* Rate Us Button */}
          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: '#FEF3C7', marginTop: 8 }]}
            onPress={() => Linking.openURL(rateUsUrl)}
          >
            <Crown size={20} color="#F59E0B" />
            <Text style={[styles.settingText, { color: '#F59E0B' }]}>Rate Us</Text>
          </TouchableOpacity>

          {/* Privacy Policy Button */}
          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: '#F3F4F6', marginTop: 8 }]}
            onPress={() => setPrivacyVisible(true)}
          >
            <Info size={20} color="#2563EB" />
            <Text style={[styles.settingText, { color: '#2563EB' }]}>Privacy Policy</Text>
          </TouchableOpacity>

          {/* Terms of Service Button */}
          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: '#F3F4F6', marginTop: 8 }]}
            onPress={() => setTermsVisible(true)}
          >
            <Info size={20} color="#2563EB" />
            <Text style={[styles.settingText, { color: '#2563EB' }]}>Terms of Service</Text>
          </TouchableOpacity>

          {/* Customer Support Button */}
          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: '#F3F4F6', marginTop: 8 }]}
            onPress={() => setSupportVisible(true)}
          >
            <Info size={20} color="#10B981" />
            <Text style={[styles.settingText, { color: '#10B981' }]}>Customer Support</Text>
          </TouchableOpacity>

          {/* Share App Button */}
          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: '#E0F2FE', marginTop: 8 }]}
            onPress={handleShareApp}
          >
            <Info size={20} color="#2563EB" />
            <Text style={[styles.settingText, { color: '#2563EB' }]}>Share App</Text>
          </TouchableOpacity>

          {/* App Version Display */}
          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: '#F3F4F6', marginTop: 8, justifyContent: 'center' }]}
            onPress={handleRateUsSecret}
          >
            <Info size={20} color="#6B7280" />
            <Text style={[styles.settingText, { color: '#6B7280' }]}>Version: 6.7.0</Text>
          </TouchableOpacity>

          {/* Delete Account Button */}
          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: '#FEE2E2', marginTop: 8 }]}
            onPress={() => {
              const deleteAccountUrl = 'https://ai-voicesum.onrender.com/simple-delete-account.html';
              Linking.openURL(deleteAccountUrl);
            }}
          >
            <Trash2 size={20} color="#DC2626" />
            <Text style={[styles.settingText, { color: '#DC2626' }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={settingsVisible} animationType="slide" transparent={true} onRequestClose={() => setSettingsVisible(false)}>
          <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.3)', justifyContent:'center', alignItems:'center' }}>
            <View style={{ backgroundColor:'white', borderRadius:16, padding:24, width:'80%' }}>
              <Text style={{ fontSize:18, fontWeight:'bold', marginBottom:16 }}>App Permissions</Text>
              <View style={{ marginBottom:16 }}>
                <Text style={{ fontSize:16 }}>Microphone: {micStatus === 'granted' ? '✅ Granted' : micStatus === 'denied' ? '❌ Denied' : 'Unknown'}</Text>
                <TouchableOpacity style={{ marginTop:8, backgroundColor:'#2563EB', borderRadius:8, padding:10 }} onPress={requestMicPermission}>
                  <Text style={{ color:'white', textAlign:'center' }}>Request Microphone Permission</Text>
                </TouchableOpacity>
              </View>
              <View style={{ marginBottom:16 }}>
                <Text style={{ fontSize:16 }}>Storage: {storageStatus === 'granted' ? '✅ Granted' : storageStatus === 'denied' ? '❌ Denied' : 'Unknown'}</Text>
                <TouchableOpacity style={{ marginTop:8, backgroundColor:'#2563EB', borderRadius:8, padding:10 }} onPress={requestStoragePermission}>
                  <Text style={{ color:'white', textAlign:'center' }}>Request Storage Permission</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={{ marginTop:8, backgroundColor:'#10B981', borderRadius:8, padding:10 }} onPress={() => Linking.openSettings()}>
                <Text style={{ color:'white', textAlign:'center' }}>Open App Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop:8, backgroundColor:'#6B7280', borderRadius:8, padding:10 }} onPress={() => setSettingsVisible(false)}>
                <Text style={{ color:'white', textAlign:'center' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Privacy Policy Modal */}
        <Modal visible={privacyVisible} animationType="slide" transparent={true} onRequestClose={() => setPrivacyVisible(false)}>
          <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.3)', justifyContent:'center', alignItems:'center' }}>
            <View style={{ backgroundColor:'white', borderRadius:16, padding:24, width:'90%', maxHeight:'90%' }}>
              <ScrollView>
                <Text style={{ fontSize:18, fontWeight:'bold', marginBottom:8 }}>Privacy Policy</Text>
                <Text style={{ fontSize:13, color:'#374151' }}>
Effective Date: 2024-07-05
{"\n"}

1. Introduction{"\n"}
Welcome to AI LIVE TRANSLATE. This Privacy Policy explains how we collect, use, and protect your personal information when you use our mobile application (the App).{"\n"}

Your privacy is important to us, and we are committed to complying with applicable privacy laws and Google Play policies.{"\n"}

2. Information We Collect{"\n"}
When using our app, we may collect the following types of information:{"\n"}

a. Audio Recordings{"\n"}
We collect audio recordings that you choose to transcribe, translate, or summarize.{"\n"}

Audio data is processed by third-party services (AssemblyAI, translation services) to provide you with results.{"\n"}

Audio data is not stored on our servers permanently, only temporarily for processing.{"\n"}

b. Personal Information{"\n"}
If you sign in with Google or another authentication method, we may collect your name, email address, and profile picture.{"\n"}

This data is used only to create and manage your account.{"\n"}

c. Device Information{"\n"}
We may collect basic device information (e.g., device model, operating system) to improve app performance and troubleshoot issues.{"\n"}

3. How We Use Your Information{"\n"}
We use your information to:{"\n"}
- Transcribe and translate your audio recordings.{"\n"}
- Generate AI-powered summaries.{"\n"}
- Improve app functionality and user experience.{"\n"}
- Provide customer support.{"\n"}
- Comply with legal requirements.{"\n"}

4. Third-Party Services{"\n"}
We may share your data with the following services strictly for processing purposes:{"\n"}
- AssemblyAI for speech recognition.{"\n"}
- Translation APIs (e.g., LibreTranslate, Google Translate, Azure) for translations.{"\n"}
- Authentication and payment providers (Google Play Billing, Google Sign-In).{"\n"}

These services are required to comply with their own privacy policies and data protection standards.{"\n"}

5. Data Security{"\n"}
We implement reasonable security measures to protect your data. However, no system is 100% secure. By using our app, you acknowledge these risks.{"\n"}

6. Data Retention{"\n"}
Audio and transcription data are only retained for the duration necessary to complete processing.{"\n"}

Personal account information is retained as long as your account is active.{"\n"}

7. Your Rights{"\n"}
You may:{"\n"}
- Access, update, or delete your personal data by contacting us at: alaa.zekroum@gmail.com{"\n"}
- Delete your account and related data via the app's settings.{"\n"}

8. Children's Privacy{"\n"}
This app is not intended for children under 13 years of age. If we learn that we have collected data from a child, we will delete it promptly.
                </Text>
              </ScrollView>
              <TouchableOpacity style={{ marginTop:16, backgroundColor:'#2563EB', borderRadius:8, padding:10 }} onPress={() => setPrivacyVisible(false)}>
                <Text style={{ color:'white', textAlign:'center' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Terms of Service Modal */}
        <Modal visible={termsVisible} animationType="slide" transparent={true} onRequestClose={() => setTermsVisible(false)}>
          <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.3)', justifyContent:'center', alignItems:'center' }}>
            <View style={{ backgroundColor:'white', borderRadius:16, padding:24, width:'90%', maxHeight:'90%' }}>
              <ScrollView>
                <Text style={{ fontSize:18, fontWeight:'bold', marginBottom:8 }}>Terms of Service & End User License Agreement</Text>
                <Text style={{ fontSize:13, color:'#374151' }}>
Effective Date: 2024-07-05
{"\n"}

Welcome to AI LIVE TRANSLATE: Speak and Translate with Summary (the "App"). By using this App, you agree to the following Terms of Service and End User License Agreement (EULA). Please read them carefully before using the App.{"\n"}

1. License Grant
You are granted a limited, non-exclusive, non-transferable, revocable license to use the App for personal, non-commercial purposes only. You may not reverse engineer, decompile, or modify the App.{"\n"}

2. Acceptable Use
You agree to use the App in compliance with all applicable laws and Google Play policies. You will not use the App to violate the rights of others, upload illegal or harmful content, or attempt to disrupt the App's operation.{"\n"}

3. Intellectual Property
All content, trademarks, and intellectual property in the App are owned by the developer. You may not copy, distribute, or create derivative works without permission.{"\n"}

4. Third-Party Services
The App uses third-party services (AssemblyAI, translation APIs, Google Play Billing, etc.). Your use of these services is subject to their respective terms and privacy policies.{"\n"}

5. Disclaimer & Limitation of Liability
The App is provided "as is" without warranties of any kind. The developer is not liable for any damages arising from your use of the App. Use at your own risk.{"\n"}

6. Termination
Your license to use the App may be terminated at any time if you violate these terms or Google Play policies.{"\n"}

7. Updates
The developer may update the App or these terms at any time. Continued use after updates constitutes acceptance of the new terms.{"\n"}

8. Contact
For questions or support, contact: alaa.zekroum@gmail.com
                </Text>
              </ScrollView>
              <TouchableOpacity style={{ marginTop:16, backgroundColor:'#2563EB', borderRadius:8, padding:10 }} onPress={() => setTermsVisible(false)}>
                <Text style={{ color:'white', textAlign:'center' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Customer Support Modal */}
        <Modal visible={supportVisible} animationType="slide" transparent={true} onRequestClose={() => setSupportVisible(false)}>
          <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.3)', justifyContent:'center', alignItems:'center' }}>
            <View style={{ backgroundColor:'white', borderRadius:16, padding:24, width:'90%', maxWidth:400 }}>
              <Text style={{ fontSize:18, fontWeight:'bold', marginBottom:8 }}>Customer Support</Text>
              <Text style={{ fontSize:13, color:'#374151', marginBottom:12 }}>Send us your question or issue. Your message will be sent to our support team.</Text>
              <View style={{ minHeight:80, borderColor:'#E5E7EB', borderWidth:1, borderRadius:8, marginBottom:16, padding:8 }}>
                <TextInput
                  style={{ fontSize:15, color:'#1F2937', minHeight:60 }}
                  placeholder="Type your message here..."
                  value={supportMessage}
                  onChangeText={setSupportMessage}
                  multiline
                />
              </View>
              <TouchableOpacity
                style={{ backgroundColor:'#10B981', borderRadius:8, padding:12, marginBottom:8 }}
                onPress={async () => {
                  let deviceInfo = '';
                  try {
                    const info = [
                      `Platform: ${Platform.OS}`,
                      `Version: ${Platform.Version}`,
                      `User Email: ${user?.email || 'N/A'}`
                    ];
                    deviceInfo = info.join('\n');
                  } catch (e) { deviceInfo = ''; }
                  const subject = encodeURIComponent('Customer Support Request');
                  const body = encodeURIComponent(`${supportMessage}\n\n---\n${deviceInfo}`);
                  Linking.openURL(`mailto:alaa.zekroum@gmail.com?subject=${subject}&body=${body}`);
                  setSupportVisible(false);
                  setSupportMessage("");
                }}
                disabled={!supportMessage.trim()}
              >
                <Text style={{ color:'white', textAlign:'center', fontWeight:'bold' }}>Send</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop:4, backgroundColor:'#6B7280', borderRadius:8, padding:10 }} onPress={() => setSupportVisible(false)}>
                <Text style={{ color:'white', textAlign:'center' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  } catch (e) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <Text style={{ fontSize: 16, color: '#EF4444' }}>Error loading profile.</Text>
      </View>
    );
  }
}
