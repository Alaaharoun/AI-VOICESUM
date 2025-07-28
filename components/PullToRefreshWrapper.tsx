import React, { useState, useCallback } from 'react';
import {
  ScrollView,
  RefreshControl,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { RefreshCw } from 'lucide-react-native';

interface PullToRefreshWrapperProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void> | void;
  refreshing?: boolean;
  style?: any;
  contentContainerStyle?: any;
  showsVerticalScrollIndicator?: boolean;
  nestedScrollEnabled?: boolean;
  refreshTintColor?: string;
  refreshTitle?: string;
  refreshTitleColor?: string;
  enabled?: boolean;
}

export function PullToRefreshWrapper({
  children,
  onRefresh,
  refreshing = false,
  style,
  contentContainerStyle,
  showsVerticalScrollIndicator = true,
  nestedScrollEnabled = false,
  refreshTintColor = '#3B82F6',
  refreshTitle = 'Pull to refresh',
  refreshTitleColor = '#6B7280',
  enabled = true,
}: PullToRefreshWrapperProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!enabled) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Pull to refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, enabled]);

  const isActuallyRefreshing = refreshing || isRefreshing;

  return (
    <ScrollView
      style={style}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      nestedScrollEnabled={nestedScrollEnabled}
      refreshControl={
        enabled ? (
          <RefreshControl
            refreshing={isActuallyRefreshing}
            onRefresh={handleRefresh}
            tintColor={refreshTintColor}
            title={refreshTitle}
            titleColor={refreshTitleColor}
            colors={[refreshTintColor]}
            progressBackgroundColor="#F8FAFC"
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

// Custom Refresh Indicator Component
export function CustomRefreshIndicator({ 
  refreshing, 
  onRefresh, 
  tintColor = '#3B82F6',
  title = 'Pull to refresh'
}: {
  refreshing: boolean;
  onRefresh: () => void;
  tintColor?: string;
  title?: string;
}) {
  return (
    <View style={styles.refreshIndicator}>
      {refreshing ? (
        <View style={styles.refreshingContainer}>
          <ActivityIndicator size="small" color={tintColor} />
          <Text style={[styles.refreshText, { color: tintColor }]}>
            Refreshing...
          </Text>
        </View>
      ) : (
        <View style={styles.pullContainer}>
          <RefreshCw size={16} color={tintColor} />
          <Text style={[styles.refreshText, { color: tintColor }]}>
            {title}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  refreshIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  refreshingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pullContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
});

// Hook for managing refresh state
export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return {
    refreshing,
    onRefresh: handleRefresh,
  };
} 