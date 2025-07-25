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
import { Search, Filter, UserCheck, UserX, Crown, Calendar, Mail, Clock } from 'lucide-react-native';

interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  is_subscribed: boolean;
  subscription_type?: string;
  subscription_expires?: string;
  total_usage_minutes: number;
  role_name: string;
  status: 'active' | 'inactive' | 'banned';
}

interface UserManagementProps {
  onRefresh?: () => void;
}

export function UserManagement({ onRefresh }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterSubscription, setFilterSubscription] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  
  const USERS_PER_PAGE = 20;

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, searchQuery, filterRole, filterSubscription]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch users from auth.users with their email
      const { data: authUsersData, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.warn('Could not fetch from auth.users, using profiles instead:', authError);
        // Fallback to profiles table
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (profilesError) throw profilesError;
        
        // Use profiles data as fallback
        const fallbackUsers = profilesData?.map(profile => ({
          ...profile,
          email: profile.email || 'No email provided',
          user_id: profile.user_id || profile.id
        })) || [];
        
        await processUsersData(fallbackUsers);
        return;
      }

      // Process auth users data
      const authUsers = authUsersData.users?.map(user => ({
        id: user.id,
        user_id: user.id,
        email: user.email || 'No email',
        created_at: user.created_at,
        updated_at: user.updated_at || user.created_at,
      })) || [];

      await processUsersData(authUsers);

    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to load users data');
    } finally {
      setLoading(false);
    }
  };

  const processUsersData = async (baseUsers: any[]) => {
    try {
      // Fetch subscription data
      const { data: subscriptionsData } = await supabase
        .from('user_subscriptions')
        .select('user_id, subscription_type, expires_at, active, usage_seconds');

      // Fetch usage data  
      const { data: creditsData } = await supabase
        .from('transcription_credits')
        .select('user_id, used_minutes, total_minutes');

      // Fetch roles data using a query that works
      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          roles (
            name
          )
        `);

      // Process roles data
      const rolesMap: Record<string, string> = {};
      userRolesData?.forEach((userRole: any) => {
        const roleName = userRole.roles?.name || 'user';
        // Prefer super_admin > admin > user
        if (!rolesMap[userRole.user_id] || 
            roleName === 'super_admin' || 
            (roleName === 'admin' && rolesMap[userRole.user_id] !== 'super_admin')) {
          rolesMap[userRole.user_id] = roleName;
        }
      });

      // Combine all data
      const usersWithData: User[] = baseUsers.map(user => {
        const userId = user.user_id || user.id;
        const subscription = subscriptionsData?.find(s => s.user_id === userId);
        const credits = creditsData?.find(c => c.user_id === userId);
        const userRole = rolesMap[userId] || 'user';

        return {
          id: userId,
          email: user.email || 'No email',
          created_at: user.created_at,
          updated_at: user.updated_at || user.created_at,
          is_subscribed: subscription?.active || false,
          subscription_type: subscription?.subscription_type,
          subscription_expires: subscription?.expires_at,
          total_usage_minutes: Math.round((credits?.used_minutes || 0)),
          role_name: userRole,
          status: 'active' as const,
        };
      });

      setUsers(usersWithData);
      
    } catch (error) {
      console.error('Error processing users data:', error);
    }
  };

  const applyFilters = () => {
    let filtered = users;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Role filter
    if (filterRole !== 'all') {
      filtered = filtered.filter(user => user.role_name === filterRole);
    }

    // Subscription filter
    if (filterSubscription !== 'all') {
      if (filterSubscription === 'subscribed') {
        filtered = filtered.filter(user => user.is_subscribed);
      } else if (filterSubscription === 'free') {
        filtered = filtered.filter(user => !user.is_subscribed);
      }
    }

    setFilteredUsers(filtered);
    setCurrentPage(1);
  };

  const handleMakeAdmin = async (userId: string) => {
    try {
      const { data: roles, error: rolesError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'admin')
        .single();

      if (rolesError || !roles) throw rolesError || new Error('Admin role not found');

      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role_id: roles.id });

      if (error) throw error;

      Alert.alert('Success', 'User is now an Admin');
      fetchUsers();
    } catch (err) {
      Alert.alert('Error', (err as Error).message || 'Error while making user admin');
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    try {
      const { data: roles, error: rolesError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'admin')
        .single();

      if (rolesError || !roles) throw rolesError || new Error('Admin role not found');

      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', roles.id);

      if (error) throw error;

      Alert.alert('Success', 'Admin privileges removed');
      fetchUsers();
    } catch (err) {
      Alert.alert('Error', (err as Error).message || 'Error while removing admin privileges');
    }
  };

  const handleGrantTrial = async (userId: string, days: number = 3) => {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          subscription_type: 'trial',
          active: true,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      Alert.alert('Success', `${days}-day trial granted successfully`);
      fetchUsers();
    } catch (err) {
      Alert.alert('Error', (err as Error).message || 'Error while granting trial');
    }
  };

  const handleToggleSubscription = async (userId: string, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        // Deactivate subscription
        const { error } = await supabase
          .from('user_subscriptions')
          .update({ active: false })
          .eq('user_id', userId);

        if (error) throw error;
        Alert.alert('Success', 'Subscription deactivated');
      } else {
        // Activate subscription
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        const { error } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            subscription_type: 'monthly',
            active: true,
            expires_at: expiresAt.toISOString(),
          });

        if (error) throw error;
        Alert.alert('Success', 'Subscription activated');
      }

      fetchUsers();
    } catch (err) {
      Alert.alert('Error', (err as Error).message || 'Error while updating subscription');
    }
  };

  const renderUserModal = () => (
    <Modal
      visible={showUserModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowUserModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {selectedUser && (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>User Details</Text>
                <TouchableOpacity onPress={() => setShowUserModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.userDetailCard}>
                <View style={styles.userDetailRow}>
                  <Mail size={16} color="#6B7280" />
                  <Text style={styles.userDetailLabel}>Email:</Text>
                  <Text style={styles.userDetailValue}>{selectedUser.email}</Text>
                </View>

                <View style={styles.userDetailRow}>
                  <Crown size={16} color="#6B7280" />
                  <Text style={styles.userDetailLabel}>Role:</Text>
                  <Text style={[styles.userDetailValue, { 
                    color: selectedUser.role_name === 'admin' ? '#3B82F6' : '#6B7280' 
                  }]}>
                    {selectedUser.role_name}
                  </Text>
                </View>

                <View style={styles.userDetailRow}>
                  <Calendar size={16} color="#6B7280" />
                  <Text style={styles.userDetailLabel}>Joined:</Text>
                  <Text style={styles.userDetailValue}>
                    {new Date(selectedUser.created_at).toLocaleDateString()}
                  </Text>
                </View>

                <View style={styles.userDetailRow}>
                  <Clock size={16} color="#6B7280" />
                  <Text style={styles.userDetailLabel}>Usage:</Text>
                  <Text style={styles.userDetailValue}>{selectedUser.total_usage_minutes} min</Text>
                </View>
              </View>

              <View style={styles.actionButtons}>
                {selectedUser.role_name === 'admin' ? (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#EF4444' }]}
                    onPress={() => {
                      setShowUserModal(false);
                      handleRemoveAdmin(selectedUser.id);
                    }}
                  >
                    <UserX size={16} color="white" />
                    <Text style={styles.actionButtonText}>Remove Admin</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
                    onPress={() => {
                      setShowUserModal(false);
                      handleMakeAdmin(selectedUser.id);
                    }}
                  >
                    <UserCheck size={16} color="white" />
                    <Text style={styles.actionButtonText}>Make Admin</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, { 
                    backgroundColor: selectedUser.is_subscribed ? '#F59E0B' : '#10B981' 
                  }]}
                  onPress={() => {
                    setShowUserModal(false);
                    handleToggleSubscription(selectedUser.id, selectedUser.is_subscribed);
                  }}
                >
                  <Text style={styles.actionButtonText}>
                    {selectedUser.is_subscribed ? 'Disable Sub' : 'Enable Sub'}
                  </Text>
                </TouchableOpacity>

                {!selectedUser.is_subscribed && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#8B5CF6' }]}
                    onPress={() => {
                      setShowUserModal(false);
                      handleGrantTrial(selectedUser.id, 3);
                    }}
                  >
                    <Text style={styles.actionButtonText}>Grant Trial</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderFilters = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.filterModalContent}>
          <Text style={styles.filterModalTitle}>Filters</Text>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Role:</Text>
            <View style={styles.filterButtons}>
              {['all', 'user', 'admin', 'super_admin'].map(role => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.filterButton,
                    filterRole === role && styles.filterButtonActive
                  ]}
                  onPress={() => setFilterRole(role)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    filterRole === role && styles.filterButtonTextActive
                  ]}>
                    {role.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Subscription:</Text>
            <View style={styles.filterButtons}>
              {['all', 'subscribed', 'free'].map(status => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterButton,
                    filterSubscription === status && styles.filterButtonActive
                  ]}
                  onPress={() => setFilterSubscription(status)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    filterSubscription === status && styles.filterButtonTextActive
                  ]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={styles.applyFiltersButton}
            onPress={() => setShowFilters(false)}
          >
            <Text style={styles.applyFiltersButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * USERS_PER_PAGE,
    currentPage * USERS_PER_PAGE
  );

  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>User Management</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchUsers}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
        >
          <Filter size={16} color="white" />
          <Text style={styles.filterButtonText}>Filters</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.statsText}>
          Total: {filteredUsers.length} users
        </Text>
        <Text style={styles.statsText}>
          Page {currentPage} of {totalPages}
        </Text>
      </View>

      <ScrollView style={styles.usersList}>
        {paginatedUsers.map(user => (
          <TouchableOpacity
            key={user.id}
            style={styles.userCard}
            onPress={() => {
              setSelectedUser(user);
              setShowUserModal(true);
            }}
          >
            <View style={styles.userInfo}>
              <Text style={styles.userEmail}>{user.email}</Text>
              <View style={styles.userMeta}>
                <Text style={styles.userMetaText}>
                  Role: <Text style={styles.userRole}>{user.role_name}</Text>
                </Text>
                <Text style={styles.userMetaText}>•</Text>
                <Text style={[
                  styles.userMetaText,
                  { color: user.is_subscribed ? '#10B981' : '#6B7280' }
                ]}>
                  {user.is_subscribed ? 'Subscribed' : 'Free'}
                </Text>
                <Text style={styles.userMetaText}>•</Text>
                <Text style={styles.userMetaText}>
                  {user.total_usage_minutes}min used
                </Text>
              </View>
              <Text style={styles.userJoined}>
                Joined: {new Date(user.created_at).toLocaleDateString()}
              </Text>
            </View>
            
            <View style={styles.userActions}>
              <Text style={styles.viewDetailsText}>Tap to view details</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

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

      {renderUserModal()}
      {renderFilters()}
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
  refreshButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B7280',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
  },
  filterButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  statsText: {
    fontSize: 14,
    color: '#6B7280',
  },
  usersList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  userCard: {
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
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userMetaText: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8,
  },
  userRole: {
    fontWeight: '600',
    color: '#3B82F6',
  },
  userJoined: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  userActions: {
    alignItems: 'flex-end',
  },
  viewDetailsText: {
    fontSize: 12,
    color: '#3B82F6',
    fontStyle: 'italic',
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalClose: {
    fontSize: 20,
    color: '#6B7280',
  },
  userDetailCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  userDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userDetailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
    width: 60,
  },
  userDetailValue: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  filterModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
  },
  filterGroup: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  applyFiltersButton: {
    backgroundColor: '#3B82F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyFiltersButtonText: {
    color: 'white',
    fontWeight: '600',
  },
}); 