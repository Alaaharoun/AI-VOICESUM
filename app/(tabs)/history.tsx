import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import { FileText, Trash2, Clock, Crown, Languages, ArrowLeft, Download } from 'lucide-react-native';
import { DownloadHelper } from '@/utils/downloadHelper';
import { useUserPermissions } from '@/hooks/useAuth';

interface Recording {
  id: string;
  transcription: string;
  summary: string;
  translation?: string;
  target_language?: string;
  duration: number;
  created_at: string;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 8,
  },
  trialText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
    marginLeft: 8,
  },
  subscriptionRequired: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  subscriptionTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  subscriptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  upgradeButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: 'white',
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  recordingCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  recordingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recordingInfo: {
    flex: 1,
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDate: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 4,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  duration: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginLeft: 4,
  },
  downloadButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  transcription: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    lineHeight: 24,
    marginBottom: 12,
  },
  summaryContainer: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  downloadSummaryButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#ECFDF5',
  },
  summary: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  translationContainer: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  translationLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#8B5CF6',
    marginBottom: 4,
  },
  translation: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 20,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default function HistoryScreen() {
  const { user } = useAuth();
  const { isSubscribed, hasFreeTrial, freeTrialExpired, loading: subscriptionLoading } = useSubscription();
  const { isSuperadmin, hasRole, loading: permissionsLoading } = useUserPermissions();
  const isAdmin = isSuperadmin || hasRole('admin') || hasRole('super_admin');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Admin:', isAdmin);
    console.log('Subscribed:', isSubscribed);
    console.log('Free Trial:', hasFreeTrial);
    console.log('User:', user);
    console.log('Subscription loading:', subscriptionLoading);
    console.log('Permissions loading:', permissionsLoading);

    if (subscriptionLoading || permissionsLoading) return;

    if (isAdmin || isSubscribed || hasFreeTrial) {
      fetchRecordings();
    } else {
      setLoading(false);
    }
  }, [user, isSubscribed, hasFreeTrial, isAdmin, subscriptionLoading, permissionsLoading]);

  const fetchRecordings = async () => {
    try {
      if (!user?.id) {
        setLoading(false);
        console.log('No user id, skipping fetch.');
        return;
      }
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      console.log('Recordings data:', data);
      console.log('Supabase error:', error);

      if (error) {
        throw error;
      }

      setRecordings(data || []);
    } catch (error) {
      console.error('Error fetching recordings:', error);
      Alert.alert('Error', 'Failed to load recordings');
    } finally {
      setLoading(false);
    }
  };

  const deleteRecording = async (id: string) => {
    try {
      const { error } = await supabase
        .from('recordings')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      setRecordings(recordings.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting recording:', error);
      Alert.alert('Error', 'Failed to delete recording');
    }
  };

  const handleDeletePress = (id: string) => {
    Alert.alert(
      'Delete Recording',
      'Are you sure you want to delete this recording?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteRecording(id) },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = (recording: Recording, type: 'transcription' | 'summary') => {
    const content = type === 'transcription' ? recording.transcription : recording.summary;
    if (!content) return;
    
    Alert.alert(
      'Download Format',
      'Choose the format for your download:',
      [
        {
          text: 'Text (.txt)',
          onPress: () => {
            const filename = DownloadHelper.generateFilename(type);
            DownloadHelper.downloadText(content, filename, 'txt');
          }
        },
        {
          text: 'Rich Text (.rtf)',
          onPress: () => {
            const filename = DownloadHelper.generateFilename(type);
            DownloadHelper.downloadText(content, filename, 'rtf');
          }
        },
        {
          text: 'Word Document (.html)',
          onPress: () => {
            const filename = DownloadHelper.generateFilename(type);
            DownloadHelper.downloadText(content, filename, 'doc');
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const renderRecording = ({ item }: { item: Recording }) => (
    <View style={styles.recordingCard}>
      <View style={styles.recordingHeader}>
        <View style={styles.recordingInfo}>
          <Text style={styles.recordingDate}>{formatDate(item.created_at)}</Text>
          <View style={styles.durationContainer}>
            <Clock size={12} color="#6B7280" />
            <Text style={styles.duration}>{formatDuration(item.duration)}</Text>
          </View>
        </View>
        <View style={styles.recordingActions}>
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={() => handleDownload(item, 'transcription')}
          >
            <Download size={16} color="#2563EB" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeletePress(item.id)}
          >
            <Trash2 size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
      
      <Text style={styles.transcription}>
        {item.transcription}
      </Text>
      
      {item.summary && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryLabel}>Summary:</Text>
            <TouchableOpacity
              style={styles.downloadSummaryButton}
              onPress={() => handleDownload(item, 'summary')}
            >
              <Download size={12} color="#10B981" />
            </TouchableOpacity>
          </View>
          <Text style={styles.summary}>
            {item.summary}
          </Text>
        </View>
      )}

      {item.translation && item.target_language && (
        <View style={styles.translationContainer}>
          <Text style={styles.translationLabel}>
            <Languages size={12} color="#8B5CF6" /> Translation ({item.target_language}):
          </Text>
          <Text style={styles.translation}>
            {item.translation}
          </Text>
        </View>
      )}
    </View>
  );

  const renderTrialBanner = () => {
    if (!hasFreeTrial || isSubscribed) return null;

    return (
      <View style={styles.trialBanner}>
        <Crown size={20} color="#F59E0B" />
        <Text style={styles.trialText}>
          Free trial active - {freeTrialExpired ? 'Expired' : 'Enjoy unlimited access!'}
        </Text>
      </View>
    );
  };

  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <Text style={{ fontSize: 16, color: '#6B7280' }}>Please sign in to view your history.</Text>
      </View>
    );
  }

  if (!isAdmin && !isSubscribed && !hasFreeTrial && !subscriptionLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#374151" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Recording History</Text>
            <Text style={styles.subtitle}>Access your past recordings</Text>
          </View>
        </View>

        <View style={styles.subscriptionRequired}>
          <Crown size={48} color="#F59E0B" />
          <Text style={styles.subscriptionTitle}>
            {freeTrialExpired ? 'Free Trial Expired' : 'Premium Required'}
          </Text>
          <Text style={styles.subscriptionText}>
            {freeTrialExpired 
              ? 'Your 2-day free trial has ended. Upgrade to Premium to continue accessing your recording history and save unlimited transcriptions.'
              : 'Upgrade to Premium to access your recording history and save unlimited transcriptions. Start with a 2-day free trial!'
            }
          </Text>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => router.push('/subscription')}
          >
            <Text style={styles.upgradeButtonText}>
              {freeTrialExpired ? 'Upgrade Now' : 'Start Free Trial'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#374151" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Recording History</Text>
            <Text style={styles.subtitle}>Loading your recordings...</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Recording History</Text>
          <Text style={styles.subtitle}>
            {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {renderTrialBanner()}

      {recordings.length === 0 ? (
        <View style={styles.emptyState}>
          <FileText size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No recordings yet</Text>
          <Text style={styles.emptyText}>
            Start recording your voice to see your transcriptions here
          </Text>
        </View>
      ) : (
        <FlatList
          data={recordings}
          renderItem={renderRecording}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}