import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  I18nManager,
  ActivityIndicator,
  Button,
} from 'react-native';
import { useUserPermissions } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Crown, Users, Database, Settings, ChartBar as BarChart3, Search, Info, Eye, EyeOff } from 'lucide-react-native';
import Constants from 'expo-constants';
import { Link, router } from 'expo-router';

interface UserData {
  id: string;
  email: string;
  created_at: string;
  is_subscribed: boolean;
  total_recordings: number;
  total_usage_hours: number;
  is_admin: boolean;
  roles: string[];
  role_name?: string;
}

interface SystemStats {
  totalUsers: number;
  totalSubscribers: number;
  totalRecordings: number;
  totalUsageHours: number;
}

type AdminSubscription = {
  id: string;
  user_id: string;
  subscription_type: string;
  created_at: string;
  expires_at: string | null;
  active: boolean;
  usage_seconds: number;
  profiles?: { email?: string } | null;
};

export function AdminPanel() {
  const { isSuperadmin, loading: permissionsLoading } = useUserPermissions();
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalSubscribers: 0,
    totalRecordings: 0,
    totalUsageHours: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'users'>('overview');
  const [showEnv, setShowEnv] = useState(false);
  const [rateUsUrl, setRateUsUrl] = useState('');
  const [shareAppUrl, setShareAppUrl] = useState('');
  const [savingLinks, setSavingLinks] = useState(false);
  const [linksModalVisible, setLinksModalVisible] = useState(false);
  const USERS_PER_PAGE = 30;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [showSubscriptions, setShowSubscriptions] = useState(false);
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [assemblyKey, setAssemblyKey] = useState(Constants.expoConfig?.extra?.EXPO_PUBLIC_ASSEMBLYAI_API_KEY || '');
  const [saveLoading, setSaveLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const isRTL = I18nManager.isRTL;
  const t = (ar: string, en: string) => isRTL ? ar : en;

  // ENV variables to display
  const envVars = [
    { key: 'EXPO_PUBLIC_SUPABASE_URL', value: Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL },
    { key: 'EXPO_PUBLIC_SUPABASE_ANON_KEY', value: Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY },
    { key: 'EXPO_PUBLIC_QWEN_API_KEY', value: Constants.expoConfig?.extra?.EXPO_PUBLIC_QWEN_API_KEY || process.env.EXPO_PUBLIC_QWEN_API_KEY },
    { key: 'EXPO_PUBLIC_ASSEMBLYAI_API_KEY', value: Constants.expoConfig?.extra?.EXPO_PUBLIC_ASSEMBLYAI_API_KEY || process.env.EXPO_PUBLIC_ASSEMBLYAI_API_KEY },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: Constants.expoConfig?.extra?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY },
  ];

  const maskKey = (key: string | undefined | null) => {
    if (!key) return '-';
    const str = String(key);
    if (str.length <= 10) return str;
    return str.slice(0, 4) + '*'.repeat(str.length - 8) + str.slice(-4);
  };

  useEffect(() => {
    if (isSuperadmin && !permissionsLoading) {
      fetchAdminData();
      fetchLinks();
    } else if (!permissionsLoading) {
      setLoading(false);
    }
  }, [isSuperadmin, permissionsLoading]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      // Fetch system stats
      const { data: statsData, error: statsError } = await supabase.rpc('admin_get_system_stats');
      if (statsError) throw statsError;
      if (statsData && statsData.length > 0) {
        setStats({
          totalUsers: statsData[0].total_users,
          totalSubscribers: statsData[0].total_subscribers,
          totalRecordings: statsData[0].total_recordings,
          totalUsageHours: Number(statsData[0].total_usage_hours)
        });
      }
      // Fetch all users
      const { data: usersData, error: usersError } = await supabase.rpc('admin_get_all_users');
      if (usersError) throw usersError;
      // Fetch roles for all users
      const userIds = (usersData || []).map((u: any) => u.id);
      let rolesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles_view')
          .select('user_id, role_name')
          .in('user_id', userIds);
        if (!rolesError && rolesData) {
          // Prefer superadmin > admin > any other role
          rolesData.forEach((r: any) => {
            if (!rolesMap[r.user_id] || r.role_name === 'superadmin' || (r.role_name === 'admin' && rolesMap[r.user_id] !== 'superadmin')) {
              rolesMap[r.user_id] = r.role_name;
            }
          });
        }
      }
      // Merge role_name into users
      const usersWithRoles = (usersData || []).map((u: any) => ({ ...u, role_name: rolesMap[u.id] || 'user' }));
      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      Alert.alert('Error', `Failed to load admin data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

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

  const saveLinks = async () => {
    setSavingLinks(true);
    try {
      const { error: rateError } = await supabase
        .from('app_settings')
        .upsert({ key: 'rate_us_url', value: rateUsUrl });
      const { error: shareError } = await supabase
        .from('app_settings')
        .upsert({ key: 'share_app_url', value: shareAppUrl });
      if (rateError || shareError) throw rateError || shareError;
      Alert.alert('تم الحفظ', 'تم تحديث الروابط بنجاح');
    } catch (err) {
      Alert.alert('خطأ', (err as Error).message || 'حدث خطأ أثناء حفظ الروابط');
    } finally {
      setSavingLinks(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchUsersPage = async (page: number) => {
    setLoading(true);
    try {
      const from = (page - 1) * USERS_PER_PAGE;
      const to = from + USERS_PER_PAGE - 1;
      // جلب العدد الكلي للمستخدمين
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      setTotalUsers(count || 0);
      // جلب المستخدمين لهذه الصفحة
      const { data: usersData, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      // جلب بيانات الاشتراك والتسجيلات لكل مستخدم (يمكن تحسينها لاحقاً)
      // هنا سنبقي فقط بيانات profiles للعرض الأساسي
      setUsers(usersData || []);
    } catch (error) {
      Alert.alert('Error', `Failed to load users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTab === 'users' && isSuperadmin && !permissionsLoading) {
      fetchUsersPage(currentPage);
    }
  }, [selectedTab, isSuperadmin, permissionsLoading, currentPage]);

  const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  // Handler: Make user admin
  const handleMakeAdmin = async (userId: string) => {
    try {
      // جلب id دور admin فقط
      const { data: roles, error: rolesError } = await supabase.from('roles').select('id').eq('name', 'admin').single();
      if (rolesError || !roles) throw rolesError || new Error('Admin role not found');
      const roleId = roles.id;
      // إضافة الدور
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role_id: roleId });
      if (error) throw error;
      Alert.alert('Success', 'User is now an Admin');
      fetchAdminData();
    } catch (err) {
      Alert.alert('Error', (err as Error).message || 'Error while making user admin');
    }
  };

  // Handler: Remove admin
  const handleRemoveAdmin = async (userId: string) => {
    try {
      const { data: roles, error: rolesError } = await supabase.from('roles').select('id').eq('name', 'admin').single();
      if (rolesError || !roles) throw rolesError || new Error('Admin role not found');
      const roleId = roles.id;
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role_id', roleId);
      if (error) throw error;
      Alert.alert('نجاح', 'تم إلغاء صلاحية الأدمن للمستخدم');
      fetchAdminData();
    } catch (err) {
      Alert.alert('خطأ', (err as Error).message || 'حدث خطأ أثناء إلغاء صلاحية الأدمن');
    }
  };

  // Handler: Toggle subscription
  const handleToggleSubscription = async (userId: string, active: boolean) => {
    try {
      if (active) {
        // تعطيل الاشتراك
        const { error } = await supabase.from('user_subscriptions').update({ active: false }).eq('user_id', userId);
        if (error) throw error;
        Alert.alert('نجاح', 'تم تعطيل الاشتراك');
      } else {
        // تفعيل الاشتراك (أو إضافة جديد)
        const expiresDate = new Date();
        expiresDate.setMonth(expiresDate.getMonth() + 1);
        const expiresAt = expiresDate;
        const { error } = await supabase.from('user_subscriptions').upsert({ user_id: userId, subscription_type: 'monthly', active: true, expiresAt });
        if (error) throw error;
        Alert.alert('نجاح', 'تم تفعيل الاشتراك');
      }
      fetchAdminData();
    } catch (err) {
      Alert.alert('خطأ', (err as Error).message || 'حدث خطأ أثناء تغيير حالة الاشتراك');
    }
  };

  // دالة لإعطاء يومين تجريبيين (تحديث created_at)
  const handleGrantTrial = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ created_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) throw error;
      Alert.alert('تم منح التجربة المجانية', 'تم تحديث تاريخ التجربة المجانية للمستخدم بنجاح.');
      fetchUsersPage(currentPage); // تحديث القائمة
    } catch (err) {
      Alert.alert('خطأ', (err as Error).message || 'حدث خطأ أثناء منح التجربة المجانية');
    }
  };

  // جلب الاشتراكات عند الحاجة
  useEffect(() => {
    if (showSubscriptions) {
      setSubsLoading(true);
      supabase
        .from('user_subscriptions')
        .select('id, user_id, subscription_type, created_at, expires_at, active, usage_seconds')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          setSubs(data || []);
          setSubsLoading(false);
          console.log('subs:', data);
        });
    }
  }, [showSubscriptions]);

  const handleSaveKey = async () => {
    setSaveLoading(true);
    try {
      // احفظ المفتاح في Supabase (جدول app_settings أو env)
      const { error } = await supabase.from('app_settings').upsert([
        { key: 'ASSEMBLYAI_API_KEY', value: assemblyKey }
      ], { onConflict: 'key' });
      if (error) throw error;
      alert('API Key updated successfully!');
    } catch (e) {
      alert('Failed to update API Key');
    }
    setSaveLoading(false);
  };

  if (permissionsLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading permissions...</Text>
      </View>
    );
  }

  if (!isSuperadmin) {
    return (
      <View style={styles.container}>
        <View style={styles.accessDenied}>
          <Crown size={48} color="#EF4444" />
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedText}>
            You don't have permission to access the admin panel.
          </Text>
        </View>
      </View>
    );
  }

  const renderLinksSettings = () => (
    <Modal
      visible={linksModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setLinksModalVisible(false)}
    >
      <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.3)', justifyContent:'center', alignItems:'center' }}>
        <View style={{ backgroundColor:'white', borderRadius:16, padding:24, width:'90%' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#2563EB', marginBottom: 16 }}>{t('إعدادات روابط التطبيق', 'App Links Settings')}</Text>
          <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>{t('رابط Rate Us', 'Rate Us Link')}</Text>
          <TextInput
            style={{ backgroundColor: 'white', borderRadius: 8, padding: 8, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' }}
            value={rateUsUrl}
            onChangeText={setRateUsUrl}
            placeholder={t('رابط Rate Us', 'Rate Us URL')}
            autoCapitalize="none"
          />
          <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>{t('رابط Share App', 'Share App Link')}</Text>
          <TextInput
            style={{ backgroundColor: 'white', borderRadius: 8, padding: 8, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' }}
            value={shareAppUrl}
            onChangeText={setShareAppUrl}
            placeholder={t('رابط Share App', 'Share App URL')}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={{ backgroundColor: savingLinks ? '#A5B4FC' : '#2563EB', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 8 }}
            onPress={saveLinks}
            disabled={savingLinks}
          >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>{savingLinks ? t('...جارٍ الحفظ', 'Saving...') : t('حفظ الروابط', 'Save Links')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: '#6B7280', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
            onPress={() => setLinksModalVisible(false)}
          >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>{t('إغلاق', 'Close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderOverview = () => (
    <View style={styles.overviewContainer}>
      <TouchableOpacity
        style={{ backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 16 }}
        onPress={() => setLinksModalVisible(true)}
      >
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>{t('إعدادات الروابط', 'Links Settings')}</Text>
      </TouchableOpacity>
      {renderLinksSettings()}
      <Text style={styles.sectionTitle}>System Overview</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Users size={24} color="#2563EB" />
          <Text style={styles.statNumber}>{stats.totalUsers}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={styles.statCard}>
          <Crown size={24} color="#F59E0B" />
          <Text style={styles.statNumber}>{stats.totalSubscribers}</Text>
          <Text style={styles.statLabel}>Subscribers</Text>
        </View>
        <View style={styles.statCard}>
          <Database size={24} color="#10B981" />
          <Text style={styles.statNumber}>{stats.totalRecordings}</Text>
          <Text style={styles.statLabel}>Recordings</Text>
        </View>
        <View style={styles.statCard}>
          <BarChart3 size={24} color="#8B5CF6" />
          <Text style={styles.statNumber}>{stats.totalUsageHours}h</Text>
          <Text style={styles.statLabel}>Total Usage</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.refreshButton}
        onPress={fetchAdminData}
        disabled={loading}
      >
        <Text style={styles.refreshButtonText}>
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderUsers = () => (
    <View style={styles.usersContainer}>
      <Text style={styles.sectionTitle}>User Management</Text>
      <View style={styles.searchContainer}>
        <Search size={20} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users by email..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <ScrollView style={styles.usersList}>
        {filteredUsers.map(user => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userInfo}>
              <Text style={styles.userEmail}>{user.email}</Text>
              <Text style={styles.userDetails}>
                Joined: {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'} •
                {user.total_recordings} recordings •
                {user.total_usage_hours}h usage
              </Text>
              <Text style={{ color: user.is_subscribed ? '#10B981' : '#EF4444', fontWeight: 'bold' }}>
                {user.is_subscribed ? 'Subscribed' : 'Not Subscribed'}
              </Text>
              {/* حالة الأدمن */}
              <Text style={{ color: (user.role_name === 'admin' || user.role_name === 'superadmin') ? '#2563EB' : '#6B7280', fontWeight: 'bold' }}>
                {user.role_name === 'superadmin' ? 'Superadmin' : user.role_name === 'admin' ? 'Admin' : 'Regular User'}
              </Text>
            </View>
            <View style={styles.userActions}>
              {/* زر الأدمن */}
              {(user.role_name === 'admin' || user.role_name === 'superadmin') ? (
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#EF4444' }]} onPress={() => handleRemoveAdmin(user.id)}>
                  <Text style={styles.actionButtonText}>Remove Admin</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#2563EB' }]} onPress={() => handleMakeAdmin(user.id)}>
                  <Text style={styles.actionButtonText}>Make Admin</Text>
                </TouchableOpacity>
              )}
              {/* زر الاشتراك */}
              {user.is_subscribed ? (
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#F59E0B' }]} onPress={() => handleToggleSubscription(user.id, true)}>
                  <Text style={styles.actionButtonText}>Disable Subscription</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#10B981' }]} onPress={() => handleToggleSubscription(user.id, false)}>
                  <Text style={styles.actionButtonText}>Enable Subscription</Text>
                </TouchableOpacity>
              )}
              {/* زر التجربة المجانية */}
              {!user.is_subscribed && (
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#6366F1' }]} onPress={() => handleGrantTrial(user.id)}>
                  <Text style={styles.actionButtonText}>Grant 2-Day Trial</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12 }}>
        <TouchableOpacity
          style={{ backgroundColor: currentPage === 1 ? '#E5E7EB' : '#2563EB', borderRadius: 8, padding: 8, marginHorizontal: 8 }}
          onPress={handlePrevPage}
          disabled={currentPage === 1}
        >
          <Text style={{ color: currentPage === 1 ? '#6B7280' : 'white', fontWeight: 'bold' }}>{t('السابق', 'Previous')}</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: 'bold', fontSize: 15, marginHorizontal: 8 }}>{t('صفحة', 'Page')} {currentPage} {t('من', 'of')} {totalPages}</Text>
        <TouchableOpacity
          style={{ backgroundColor: currentPage === totalPages ? '#E5E7EB' : '#2563EB', borderRadius: 8, padding: 8, marginHorizontal: 8 }}
          onPress={handleNextPage}
          disabled={currentPage === totalPages}
        >
          <Text style={{ color: currentPage === totalPages ? '#6B7280' : 'white', fontWeight: 'bold' }}>{t('التالي', 'Next')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEnvVars = () => (
    <View style={styles.envContainer}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Info size={18} color="#2563EB" />
        <Text style={styles.envTitle}>Environment Variables (Read-Only)</Text>
      </View>
      <ScrollView style={styles.envScroll}>
        {envVars.map((env) => (
          <View key={env.key} style={styles.envRow}>
            <Text style={styles.envKey}>{env.key}:</Text>
            <Text style={styles.envValue}>{env.value ? maskKey(env.value) : '-'}</Text>
          </View>
        ))}
      </ScrollView>
      <Text style={styles.envNote}>
        These variables are read-only. To change them, update your .env or Expo config and rebuild the app.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Crown size={24} color="#F59E0B" />
        <Text style={styles.title}>Admin Panel</Text>
      </View>
      {/* زر الدخول إلى شاشة رفع الملفات */}
      <TouchableOpacity style={{backgroundColor:'#2563EB',padding:12,borderRadius:8,alignSelf:'center',marginBottom:12}} onPress={()=>router.push('/admin-upload')}>
        <Text style={{color:'white',fontWeight:'bold',fontSize:16}}>Go to File Transcription (Admin)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.envToggleButton}
        onPress={() => setShowEnv((prev) => !prev)}
      >
        <Text style={styles.envToggleButtonText}>
          {showEnv ? 'Hide ENV Variables' : 'Show ENV Variables'}
        </Text>
      </TouchableOpacity>
      {showEnv && renderEnvVars()}
      <TouchableOpacity
        style={{backgroundColor:'#10B981',padding:12,borderRadius:8,alignSelf:'center',marginBottom:12}}
        onPress={()=>setShowSubscriptions(s => !s)}
      >
        <Text style={{color:'white',fontWeight:'bold',fontSize:16}}>
          {showSubscriptions ? 'Hide Subscriptions' : 'Show User Subscriptions'}
        </Text>
      </TouchableOpacity>
      {showSubscriptions && (
        <View style={{backgroundColor:'#fff',borderRadius:12,padding:12,margin:12}}>
          <Text style={{fontWeight:'bold',fontSize:18,marginBottom:8,color:'#2563EB'}}>User Subscriptions</Text>
          {subsLoading ? (
            <ActivityIndicator size="large" color="#2563EB" />
          ) : (
            <ScrollView style={{maxHeight:400}}>
              {subs.length === 0 && <Text style={{color:'#DC2626'}}>No subscriptions found.</Text>}
              {subs.map(sub => (
                <View key={sub.id} style={{borderBottomWidth:1,borderColor:'#F3F4F6',paddingVertical:8}}>
                  <Text style={{fontWeight:'bold',color:'#2563EB'}}>{sub.user_id}</Text>
                  <Text>نوع الاشتراك: {sub.subscription_type}</Text>
                  <Text>
                    الحالة: <Text style={{color: sub.active ? '#10B981' : '#DC2626'}}>{sub.active ? 'مفعل' : 'غير مفعل'}</Text>
                  </Text>
                  <Text>تاريخ البداية: {new Date(sub.created_at).toLocaleString()}</Text>
                  <Text>تاريخ الانتهاء: {sub.expires_at ? new Date(sub.expires_at).toLocaleString() : 'غير محدد'}</Text>
                  <Text>الاستهلاك (ثواني): {sub.usage_seconds}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'overview' && styles.activeTab]}
          onPress={() => setSelectedTab('overview')}
        >
          <BarChart3 size={18} color={selectedTab === 'overview' ? '#2563EB' : '#6B7280'} />
          <Text style={[styles.tabText, selectedTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'users' && styles.activeTab]}
          onPress={() => setSelectedTab('users')}
        >
          <Users size={18} color={selectedTab === 'users' ? '#2563EB' : '#6B7280'} />
          <Text style={[styles.tabText, selectedTab === 'users' && styles.activeTabText]}>
            Users
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content}>
        {loading ? (
          <Text style={styles.loadingText}>Loading admin data...</Text>
        ) : (
          <>
            {selectedTab === 'overview' && renderOverview()}
            {selectedTab === 'users' && renderUsers()}
          </>
        )}
      </ScrollView>
      <View style={{ marginVertical: 16, padding: 12, backgroundColor: '#F3F4F6', borderRadius: 12 }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Update ASSEMBLYAI_API_KEY</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            value={assemblyKey}
            onChangeText={setAssemblyKey}
            placeholder="Enter new ASSEMBLYAI_API_KEY"
            style={{ flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 8, marginBottom: 8 }}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!showKey}
          />
          <TouchableOpacity onPress={() => setShowKey((v) => !v)} style={{ marginLeft: 8, marginBottom: 8 }}>
            {showKey ? <EyeOff size={20} color="#6B7280" /> : <Eye size={20} color="#6B7280" />}
          </TouchableOpacity>
        </View>
        <Button title={saveLoading ? 'Saving...' : 'Save'} onPress={handleSaveKey} disabled={saveLoading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginRight: 24,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#2563EB',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 32,
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 24,
  },
  overviewContainer: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  refreshButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  refreshButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: 'white',
  },
  usersContainer: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    marginLeft: 12,
  },
  usersList: {
    flex: 1,
  },
  userCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: {
    flex: 1,
    marginBottom: 12,
  },
  userEmail: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  userDetails: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: 'white',
  },
  envContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 0,
  },
  envTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563EB',
    marginLeft: 8,
  },
  envRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  envKey: {
    fontWeight: 'bold',
    color: '#374151',
    marginRight: 8,
    fontSize: 13,
  },
  envScroll: {
    maxHeight: 180,
    marginBottom: 8,
  },
  envValue: {
    color: '#6B7280',
    fontSize: 13,
    flex: 1,
    flexWrap: 'wrap',
    lineHeight: 18,
  },
  envNote: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 8,
  },
  envToggleButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  envToggleButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
});