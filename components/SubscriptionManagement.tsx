import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { 
  Crown, 
  Calendar, 
  DollarSign, 
  Clock, 
  TrendingUp, 
  Users, 
  Gift,
  Plus,
  Edit3,
  Trash2
} from 'lucide-react-native';

interface Subscription {
  id: string;
  user_id: string;
  user_email: string;
  subscription_type: string;
  created_at: string;
  expires_at: string | null;
  active: boolean;
  usage_seconds: number;
  total_minutes?: number;
  remaining_minutes?: number;
}

interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  trialSubscriptions: number;
  totalRevenue: number;
  averageUsage: number;
}

export function SubscriptionManagement() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filteredSubs, setFilteredSubs] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<SubscriptionStats>({
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
    trialSubscriptions: 0,
    totalRevenue: 0,
    averageUsage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  
  // New subscription form
  const [newSubEmail, setNewSubEmail] = useState('');
  const [newSubType, setNewSubType] = useState('monthly');
  const [newSubMinutes, setNewSubMinutes] = useState('120');
  const [newSubDays, setNewSubDays] = useState('30');

  const SUBS_PER_PAGE = 15;

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [subscriptions, searchQuery, filterType]);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      // Fetch subscriptions with user data
      const { data: subsData, error: subsError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      // Get user emails from auth users or profiles
      let userEmails: Record<string, string> = {};
      
      try {
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        authUsers?.users?.forEach(user => {
          if (user.email) {
            userEmails[user.id] = user.email;
          }
        });
      } catch (authError) {
        console.warn('Could not fetch auth users, trying profiles:', authError);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, email');
        
        profilesData?.forEach(profile => {
          if (profile.email) {
            userEmails[profile.user_id] = profile.email;
          }
        });
      }

      if (subsError) throw subsError;

      // Fetch usage data
      const { data: creditsData, error: creditsError } = await supabase
        .from('transcription_credits')
        .select('user_id, total_minutes, used_minutes');

      // Process subscriptions data
      const processedSubs: Subscription[] = subsData?.map(sub => {
        const credits = creditsData?.find(c => c.user_id === sub.user_id);
        const usageMinutes = Math.floor((sub.usage_seconds || 0) / 60);
        
        return {
          id: sub.id,
          user_id: sub.user_id,
          user_email: userEmails[sub.user_id] || 'Unknown Email',
          subscription_type: sub.subscription_type,
          created_at: sub.created_at,
          expires_at: sub.expires_at,
          active: sub.active,
          usage_seconds: sub.usage_seconds || 0,
          total_minutes: credits?.total_minutes || 0,
          remaining_minutes: Math.max(0, (credits?.total_minutes || 0) - (credits?.used_minutes || 0)),
        };
      }) || [];

      setSubscriptions(processedSubs);

      // Calculate stats
      const now = new Date();
      const activeCount = processedSubs.filter(s => s.active).length;
      const expiredCount = processedSubs.filter(s => 
        s.expires_at && new Date(s.expires_at) < now
      ).length;
      const trialCount = processedSubs.filter(s => 
        s.subscription_type === 'trial'
      ).length;
      
      // Mock revenue calculation (you'd need actual pricing data)
      const mockRevenue = processedSubs
        .filter(s => s.subscription_type !== 'trial' && s.active)
        .length * 9.99; // Assuming $9.99/month

      const avgUsage = processedSubs.length > 0
        ? Math.round(processedSubs.reduce((sum, s) => sum + Math.floor(s.usage_seconds / 60), 0) / processedSubs.length)
        : 0;

      setStats({
        totalSubscriptions: processedSubs.length,
        activeSubscriptions: activeCount,
        expiredSubscriptions: expiredCount,
        trialSubscriptions: trialCount,
        totalRevenue: mockRevenue,
        averageUsage: avgUsage,
      });

    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      Alert.alert('Error', 'Failed to load subscriptions data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = subscriptions;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(sub =>
        sub.user_email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Type filter
    if (filterType !== 'all') {
      if (filterType === 'active') {
        filtered = filtered.filter(sub => sub.active);
      } else if (filterType === 'expired') {
        const now = new Date();
        filtered = filtered.filter(sub => 
          sub.expires_at && new Date(sub.expires_at) < now
        );
      } else {
        filtered = filtered.filter(sub => sub.subscription_type === filterType);
      }
    }

    setFilteredSubs(filtered);
    setCurrentPage(1);
  };

  const handleCreateSubscription = async () => {
    if (!newSubEmail.trim()) {
      Alert.alert('Error', 'Please enter a user email');
      return;
    }

    try {
      // Find user by email
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', newSubEmail.trim())
        .single();

      if (userError || !userData) {
        Alert.alert('Error', 'User not found with this email');
        return;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(newSubDays));

      // Create subscription
      const { error: subError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userData.user_id,
          subscription_type: newSubType,
          active: true,
          expires_at: expiresAt.toISOString(),
        });

      if (subError) throw subError;

      // Create/update transcription credits
      const { error: creditsError } = await supabase
        .from('transcription_credits')
        .upsert({
          user_id: userData.user_id,
          total_minutes: parseInt(newSubMinutes),
          used_minutes: 0,
        });

      if (creditsError) throw creditsError;

      Alert.alert('Success', 'Subscription created successfully');
      setShowCreateModal(false);
      setNewSubEmail('');
      setNewSubType('monthly');
      setNewSubMinutes('120');
      setNewSubDays('30');
      fetchSubscriptions();

    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to create subscription');
    }
  };

  const handleGrantTrial = async (email: string, days: number = 3, minutes: number = 60) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', email.trim())
        .single();

      if (userError || !userData) {
        Alert.alert('Error', 'User not found');
        return;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: userData.user_id,
          subscription_type: 'trial',
          active: true,
          expires_at: expiresAt.toISOString(),
        });

      if (error) throw error;

      // Grant trial minutes
      const { error: creditsError } = await supabase
        .from('transcription_credits')
        .upsert({
          user_id: userData.user_id,
          total_minutes: minutes,
          used_minutes: 0,
        });

      if (creditsError) throw creditsError;

      Alert.alert('Success', `${days}-day trial with ${minutes} minutes granted`);
      fetchSubscriptions();

    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to grant trial');
    }
  };

  const handleToggleSubscription = async (subId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('user_subscriptions')
        .update({ active: !currentStatus })
        .eq('id', subId);

      if (error) throw error;

      Alert.alert('Success', `Subscription ${currentStatus ? 'deactivated' : 'activated'}`);
      fetchSubscriptions();

    } catch (error) {
      Alert.alert('Error', (error as Error).message || 'Failed to update subscription');
    }
  };

  const handleDeleteSubscription = async (subId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this subscription?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('user_subscriptions')
                .delete()
                .eq('id', subId);

              if (error) throw error;

              Alert.alert('Success', 'Subscription deleted');
              fetchSubscriptions();

            } catch (error) {
              Alert.alert('Error', (error as Error).message || 'Failed to delete subscription');
            }
          }
        }
      ]
    );
  };

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowCreateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Create New Subscription</Text>

          <TextInput
            style={styles.input}
            placeholder="User Email"
            value={newSubEmail}
            onChangeText={setNewSubEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.inputLabel}>Subscription Type:</Text>
          <View style={styles.typeButtons}>
            {['trial', 'monthly', 'yearly'].map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  newSubType === type && styles.typeButtonActive
                ]}
                onPress={() => setNewSubType(type)}
              >
                <Text style={[
                  styles.typeButtonText,
                  newSubType === type && styles.typeButtonTextActive
                ]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Total Minutes"
            value={newSubMinutes}
            onChangeText={setNewSubMinutes}
            keyboardType="numeric"
          />

          <TextInput
            style={styles.input}
            placeholder="Duration (days)"
            value={newSubDays}
            onChangeText={setNewSubDays}
            keyboardType="numeric"
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#6B7280' }]}
              onPress={() => setShowCreateModal(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#3B82F6' }]}
              onPress={handleCreateSubscription}
            >
              <Text style={styles.modalButtonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderQuickTrialModal = () => {
    const [trialEmail, setTrialEmail] = useState('');

    return (
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Grant Trial Subscription</Text>

            <TextInput
              style={styles.input}
              placeholder="User Email"
              value={trialEmail}
              onChangeText={setTrialEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.trialOptions}>
              <TouchableOpacity
                style={styles.trialButton}
                onPress={() => {
                  handleGrantTrial(trialEmail, 3, 60);
                  setShowEditModal(false);
                  setTrialEmail('');
                }}
              >
                <Text style={styles.trialButtonText}>3 Days / 60 Min</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.trialButton}
                onPress={() => {
                  handleGrantTrial(trialEmail, 7, 120);
                  setShowEditModal(false);
                  setTrialEmail('');
                }}
              >
                <Text style={styles.trialButtonText}>7 Days / 120 Min</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#6B7280' }]}
              onPress={() => {
                setShowEditModal(false);
                setTrialEmail('');
              }}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const paginatedSubs = filteredSubs.slice(
    (currentPage - 1) * SUBS_PER_PAGE,
    currentPage * SUBS_PER_PAGE
  );

  const totalPages = Math.ceil(filteredSubs.length / SUBS_PER_PAGE);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading subscriptions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Subscription Management</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#10B981' }]}
            onPress={() => setShowEditModal(true)}
          >
            <Gift size={16} color="white" />
            <Text style={styles.actionButtonText}>Grant Trial</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
            onPress={() => setShowCreateModal(true)}
          >
            <Plus size={16} color="white" />
            <Text style={styles.actionButtonText}>Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Users size={20} color="#3B82F6" />
            <Text style={styles.statNumber}>{stats.totalSubscriptions}</Text>
            <Text style={styles.statLabel}>Total Subs</Text>
          </View>

          <View style={styles.statCard}>
            <Crown size={20} color="#10B981" />
            <Text style={styles.statNumber}>{stats.activeSubscriptions}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>

          <View style={styles.statCard}>
            <Clock size={20} color="#F59E0B" />
            <Text style={styles.statNumber}>{stats.expiredSubscriptions}</Text>
            <Text style={styles.statLabel}>Expired</Text>
          </View>

          <View style={styles.statCard}>
            <Gift size={20} color="#8B5CF6" />
            <Text style={styles.statNumber}>{stats.trialSubscriptions}</Text>
            <Text style={styles.statLabel}>Trials</Text>
          </View>
        </View>

        <View style={styles.revenueCard}>
          <DollarSign size={24} color="#10B981" />
          <View>
            <Text style={styles.revenueAmount}>${stats.totalRevenue.toFixed(2)}</Text>
            <Text style={styles.revenueLabel}>Est. Monthly Revenue</Text>
          </View>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by email..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9CA3AF"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
          {['all', 'active', 'trial', 'monthly', 'yearly', 'expired'].map(filter => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterTab,
                filterType === filter && styles.filterTabActive
              ]}
              onPress={() => setFilterType(filter)}
            >
              <Text style={[
                styles.filterTabText,
                filterType === filter && styles.filterTabTextActive
              ]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <Text style={styles.resultsCount}>
        {filteredSubs.length} subscriptions found
      </Text>

      {/* Subscriptions List */}
      <ScrollView style={styles.subscriptionsList}>
        {paginatedSubs.map(sub => {
          const isExpired = sub.expires_at && new Date(sub.expires_at) < new Date();
          const daysLeft = sub.expires_at 
            ? Math.ceil((new Date(sub.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            : null;

          return (
            <View key={sub.id} style={styles.subCard}>
              <View style={styles.subHeader}>
                <View>
                  <Text style={styles.subEmail}>{sub.user_email}</Text>
                  <View style={styles.subMeta}>
                    <Text style={[
                      styles.subType,
                      { color: sub.subscription_type === 'trial' ? '#8B5CF6' : '#3B82F6' }
                    ]}>
                      {sub.subscription_type}
                    </Text>
                    <Text style={styles.subDivider}>•</Text>
                    <Text style={[
                      styles.subStatus,
                      { color: sub.active ? '#10B981' : '#EF4444' }
                    ]}>
                      {sub.active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                <View style={styles.subActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      { backgroundColor: sub.active ? '#F59E0B' : '#10B981' }
                    ]}
                    onPress={() => handleToggleSubscription(sub.id, sub.active)}
                  >
                    <Text style={styles.actionBtnText}>
                      {sub.active ? 'Pause' : 'Resume'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#EF4444' }]}
                    onPress={() => handleDeleteSubscription(sub.id)}
                  >
                    <Trash2 size={14} color="white" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.subDetails}>
                <View style={styles.subDetailItem}>
                  <Calendar size={14} color="#6B7280" />
                  <Text style={styles.subDetailText}>
                    Created: {new Date(sub.created_at).toLocaleDateString()}
                  </Text>
                </View>

                {sub.expires_at && (
                  <View style={styles.subDetailItem}>
                    <Clock size={14} color={isExpired ? '#EF4444' : '#6B7280'} />
                    <Text style={[
                      styles.subDetailText,
                      { color: isExpired ? '#EF4444' : '#6B7280' }
                    ]}>
                      {isExpired ? 'Expired' : `${daysLeft} days left`}
                    </Text>
                  </View>
                )}

                <View style={styles.subDetailItem}>
                  <TrendingUp size={14} color="#6B7280" />
                  <Text style={styles.subDetailText}>
                    Usage: {Math.floor(sub.usage_seconds / 60)} min
                  </Text>
                </View>

                {sub.remaining_minutes !== undefined && (
                  <View style={styles.subDetailItem}>
                    <Crown size={14} color="#6B7280" />
                    <Text style={styles.subDetailText}>
                      Remaining: {sub.remaining_minutes} min
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <TouchableOpacity
            style={[
              styles.paginationButton,
              currentPage === 1 && styles.paginationButtonDisabled
            ]}
            onPress={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <Text style={styles.paginationButtonText}>Previous</Text>
          </TouchableOpacity>

          <Text style={styles.paginationInfo}>
            {currentPage} / {totalPages}
          </Text>

          <TouchableOpacity
            style={[
              styles.paginationButton,
              currentPage === totalPages && styles.paginationButtonDisabled
            ]}
            onPress={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <Text style={styles.paginationButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      )}

      {renderCreateModal()}
      {renderQuickTrialModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  statsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  revenueCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  revenueAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  revenueLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  filtersContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  searchInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterTabs: {
    flexDirection: 'row',
  },
  filterTab: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: '#3B82F6',
  },
  filterTabText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  filterTabTextActive: {
    color: 'white',
  },
  resultsCount: {
    fontSize: 14,
    color: '#6B7280',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  subscriptionsList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  subCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  subEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  subMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subType: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  subDivider: {
    fontSize: 14,
    color: '#9CA3AF',
    marginHorizontal: 8,
  },
  subStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  subActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  subDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  subDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subDetailText: {
    fontSize: 12,
    color: '#6B7280',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  paginationButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  paginationButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  paginationButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  paginationInfo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#3B82F6',
  },
  typeButtonText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: 'white',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  trialOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  trialButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  trialButtonText: {
    color: 'white',
    fontWeight: '600',
  },
}); 