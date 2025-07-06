import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { useUserPermissions } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Crown, Users, Database, Settings, ChartBar as BarChart3, Search } from 'lucide-react-native';

interface UserData {
  id: string;
  email: string;
  created_at: string;
  is_subscribed: boolean;
  total_recordings: number;
  total_usage_hours: number;
}

interface SystemStats {
  totalUsers: number;
  totalSubscribers: number;
  totalRecordings: number;
  totalUsageHours: number;
}

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
  const [selectedTab, setSelectedTab] = useState<'overview' | 'users' | 'recordings'>('overview');

  useEffect(() => {
    if (isSuperadmin && !permissionsLoading) {
      fetchAdminData();
    } else if (!permissionsLoading) {
      setLoading(false);
    }
  }, [isSuperadmin, permissionsLoading]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);

      // Get basic stats using direct queries instead of RPC functions
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*');

      if (usersError) {
        throw usersError;
      }

      const totalUsers = usersData?.length || 0;
      const totalSubscribers = usersData?.filter(user => user.is_subscribed)?.length || 0;

      // Get recordings count
      const { data: recordingsData, error: recordingsError } = await supabase
        .from('recordings')
        .select('*');

      if (recordingsError) {
        console.warn('Could not fetch recordings data:', recordingsError);
      }

      const totalRecordings = recordingsData?.length || 0;

      // Calculate total usage hours (approximate)
      const totalUsageHours = Math.round((totalRecordings * 2) / 60); // Assume 2 minutes per recording

      setStats({
        totalUsers,
        totalSubscribers,
        totalRecordings,
        totalUsageHours
      });

      // Process users data
      const processedUsers = (usersData || []).map(user => ({
        id: user.id,
        email: user.email || 'N/A',
        created_at: user.created_at,
        is_subscribed: user.is_subscribed || false,
        total_recordings: 0, // We'll calculate this separately if needed
        total_usage_hours: 0 // We'll calculate this separately if needed
      }));

      setUsers(processedUsers);

    } catch (error) {
      console.error('Error fetching admin data:', error);
      Alert.alert('Error', `Failed to load admin data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSubscription = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_subscribed: !currentStatus })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      // Refresh data
      await fetchAdminData();
      Alert.alert('Success', 'User subscription updated successfully');

    } catch (error) {
      console.error('Error updating subscription:', error);
      Alert.alert('Error', `Failed to update subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const renderOverview = () => (
    <View style={styles.overviewContainer}>
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
                Joined: {new Date(user.created_at).toLocaleDateString()} • 
                {user.total_recordings} recordings • 
                {user.total_usage_hours}h usage
              </Text>
            </View>
            
            <View style={styles.userActions}>
              <View style={[
                styles.subscriptionBadge,
                user.is_subscribed ? styles.subscribedBadge : styles.freeBadge
              ]}>
                <Text style={[
                  styles.subscriptionText,
                  user.is_subscribed ? styles.subscribedText : styles.freeText
                ]}>
                  {user.is_subscribed ? 'Premium' : 'Free'}
                </Text>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  user.is_subscribed ? styles.cancelButton : styles.upgradeButton
                ]}
                onPress={() => toggleUserSubscription(user.id, user.is_subscribed)}
              >
                <Text style={styles.actionButtonText}>
                  {user.is_subscribed ? 'Cancel' : 'Upgrade'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Crown size={24} color="#F59E0B" />
        <Text style={styles.title}>Admin Panel</Text>
      </View>

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
  subscriptionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subscribedBadge: {
    backgroundColor: '#FEF3C7',
  },
  freeBadge: {
    backgroundColor: '#F3F4F6',
  },
  subscriptionText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  subscribedText: {
    color: '#92400E',
  },
  freeText: {
    color: '#6B7280',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  upgradeButton: {
    backgroundColor: '#2563EB',
  },
  cancelButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: 'white',
  },
});