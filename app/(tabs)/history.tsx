// ملاحظة هامة: أي كود متعلق بمكتبات الصوت Native مثل expo-av يجب أن يبقى محصوراى في هذه الصفحة فقط.
// لا تقم بتصدير أو مشاركة أي دوال أو كائنات من هذه المكتبة إلى صفحات أو مكونات أخرى لتفادي الكراش في باقي التطبيق.

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  Platform, 
  Alert,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LanguageSelector } from '../../components/LanguageSelector';
import { SpeechService } from '../../services/speechService';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { getAudioService } from '../../services/audioService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, Clock, FileText, Languages, Trash2, Play, Pause } from 'lucide-react-native';

interface HistoryItem {
  id: string;
  transcription?: string;
  translation?: string;
  summary?: string;
  translationSummary?: string;
  created_at: string;
  targetLanguage?: string;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filteredHistory, setFilteredHistory] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [audioService, setAudioService] = useState<any>(null);

  // تحميل التاريخ
  const loadHistory = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setHistory(data || []);
      setFilteredHistory(data || []);
    } catch (error) {
      console.error('Error loading history:', error);
      Alert.alert('Error', 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  // وظيفة التحديث
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadHistory();
      // تأخير صغير لتحسين تجربة المستخدم
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // تحميل التاريخ عند فتح الصفحة
  useEffect(() => {
    loadHistory();
  }, [user]);

  // تصفية التاريخ بناءً على البحث واللغة
  useEffect(() => {
    let filtered = history;
    
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.transcription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.translation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.summary?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (selectedLanguage) {
      filtered = filtered.filter(item => 
        item.targetLanguage === selectedLanguage.code
      );
    }
    
    setFilteredHistory(filtered);
  }, [history, searchQuery, selectedLanguage]);

  // تهيئة خدمة الصوت
  useEffect(() => {
    const initAudioService = async () => {
      try {
        const service = await getAudioService();
        setAudioService(service);
      } catch (error) {
        console.error('Error initializing audio service:', error);
      }
    };
    
    initAudioService();
  }, []);

  // تشغيل/إيقاف الصوت
  const toggleAudio = async (text: string, itemId: string) => {
    if (!audioService) return;
    
    try {
      if (isPlaying === itemId) {
        await audioService.stop();
        setIsPlaying(null);
      } else {
        if (isPlaying) {
          await audioService.stop();
        }
        await audioService.speak(text, selectedLanguage?.code || 'en');
        setIsPlaying(itemId);
      }
    } catch (error) {
      console.error('Audio error:', error);
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  // حذف عنصر من التاريخ
  const deleteHistoryItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('transcriptions')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      
      // إعادة تحميل التاريخ
      await loadHistory();
      Alert.alert('Success', 'Item deleted successfully');
    } catch (error) {
      console.error('Error deleting item:', error);
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  // تنسيق التاريخ
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // عرض عنصر التاريخ
  const renderHistoryItem = (item: HistoryItem) => (
    <View key={item.id} style={styles.historyItem}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Clock size={16} color="#6B7280" />
          <Text style={styles.itemDate}>{formatDate(item.created_at)}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteHistoryItem(item.id)}
        >
          <Trash2 size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {item.transcription && (
        <View style={styles.contentSection}>
          <View style={styles.sectionHeader}>
            <FileText size={16} color="#3B82F6" />
            <Text style={styles.sectionTitle}>Transcription</Text>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => toggleAudio(item.transcription!, item.id)}
            >
              {isPlaying === item.id ? (
                <Pause size={14} color="#3B82F6" />
              ) : (
                <Play size={14} color="#3B82F6" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.contentText}>{item.transcription}</Text>
        </View>
      )}

      {item.translation && (
        <View style={styles.contentSection}>
          <View style={styles.sectionHeader}>
            <Languages size={16} color="#10B981" />
            <Text style={styles.sectionTitle}>Translation</Text>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => toggleAudio(item.translation!, item.id)}
            >
              {isPlaying === item.id ? (
                <Pause size={14} color="#10B981" />
              ) : (
                <Play size={14} color="#10B981" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.contentText}>{item.translation}</Text>
        </View>
      )}

      {item.summary && (
        <View style={styles.contentSection}>
          <View style={styles.sectionHeader}>
            <FileText size={16} color="#8B5CF6" />
            <Text style={styles.sectionTitle}>Summary</Text>
          </View>
          <Text style={styles.contentText}>{item.summary}</Text>
        </View>
      )}
    </View>
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>Please sign in to view history</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <TouchableOpacity
          style={styles.languageButton}
          onPress={() => setShowLanguageSelector(true)}
        >
          <Languages size={20} color="#3B82F6" />
          <Text style={styles.languageButtonText}>
            {selectedLanguage ? selectedLanguage.name : 'All Languages'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3B82F6"
            title="Pull to refresh"
            titleColor="#6B7280"
            colors={["#3B82F6"]}
            progressBackgroundColor="#F8FAFC"
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Loading history...</Text>
          </View>
        ) : filteredHistory.length === 0 ? (
          <View style={styles.noDataContainer}>
            <Clock size={48} color="#9CA3AF" />
            <Text style={styles.noDataText}>
              {searchQuery || selectedLanguage 
                ? 'No items found matching your criteria'
                : 'No history yet. Start recording to see your transcriptions here!'
              }
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.resultsCount}>
              {filteredHistory.length} item{filteredHistory.length !== 1 ? 's' : ''} found
            </Text>
            {filteredHistory.map(renderHistoryItem)}
          </>
        )}
      </ScrollView>

      {/* Language Selector Modal */}
      {showLanguageSelector && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Language</Text>
              <TouchableOpacity onPress={() => setShowLanguageSelector(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <LanguageSelector
              selectedLanguage={selectedLanguage}
              onSelectLanguage={(language) => {
                setSelectedLanguage(language);
                setShowLanguageSelector(false);
              }}
              title="Select Language"
              subtitle="Filter history by language"
            />
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={() => {
                setSelectedLanguage(null);
                setShowLanguageSelector(false);
              }}
            >
              <Text style={styles.clearFilterText}>Clear Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  languageButtonText: {
    marginLeft: 6,
    color: '#3B82F6',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 16,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  noDataText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  resultsCount: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: '#6B7280',
    fontSize: 14,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  historyItem: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemDate: {
    marginLeft: 6,
    color: '#6B7280',
    fontSize: 14,
  },
  deleteButton: {
    padding: 4,
  },
  contentSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  playButton: {
    marginLeft: 'auto',
    padding: 4,
  },
  contentText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalClose: {
    fontSize: 20,
    color: '#6B7280',
    padding: 4,
  },
  clearFilterButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  clearFilterText: {
    color: '#6B7280',
    fontWeight: '600',
  },
});