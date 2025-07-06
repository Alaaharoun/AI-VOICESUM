import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SubscriptionPlan } from '@/components/SubscriptionPlan';
import { supabase } from '@/lib/supabase';
import { Crown, ArrowLeft } from 'lucide-react-native';

export default function SubscriptionScreen() {
  const { user } = useAuth();
  const { 
    checkSubscription, 
    hasFreeTrial, 
    freeTrialExpired,
    dailyUsageSeconds,
    dailyLimitSeconds,
    getRemainingTrialTime
  } = useSubscription();
  const [loading, setLoading] = useState(false);

  const handleSelectPlan = async (planType: 'monthly' | 'yearly') => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to continue');
      return;
    }

    setLoading(true);
    
    try {
      // In a real app, you would integrate with RevenueCat or similar
      // For demo purposes, we'll simulate a successful subscription
      const expiresAt = new Date();
      if (planType === 'monthly') {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }

      // Insert subscription record
      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          subscription_type: planType,
          active: true,
          expires_at: expiresAt.toISOString(),
        });

      if (error) {
        throw error;
      }

      await checkSubscription();
      
      Alert.alert(
        'Success!',
        `You've successfully subscribed to the ${planType} plan. Welcome to Premium!`,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch (error) {
      console.error('Subscription error:', error);
      Alert.alert('Error', 'Failed to process subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Crown size={48} color="#F59E0B" />
          <Text style={styles.title}>Upgrade to Premium</Text>
          {hasFreeTrial && !freeTrialExpired && (
            <View style={styles.trialIndicator}>
              <Text style={styles.trialText}>
                ✨ Free trial active - {formatTime(getRemainingTrialTime())} remaining today
              </Text>
            </View>
          )}
          <Text style={styles.subtitle}>
            {hasFreeTrial && !freeTrialExpired 
              ? 'Upgrade to get unlimited daily usage without time limits'
              : 'Unlock unlimited voice transcriptions and AI-powered summaries'
            }
          </Text>
        </View>
      </View>

      <View style={styles.plansContainer}>
        <SubscriptionPlan
          title="Monthly"
          price="$10"
          period="month"
          features={[
            'Unlimited daily usage',
            'AI-powered transcriptions',
            'Instant text summaries',
            'Multi-language translation',
            'Recording history',
            'Priority support',
          ]}
          onSelect={() => handleSelectPlan('monthly')}
          disabled={loading}
        />
        
        <SubscriptionPlan
          title="Yearly"
          price="$90"
          period="year"
          features={[
            'Unlimited daily usage',
            'AI-powered transcriptions',
            'Instant text summaries',
            'Multi-language translation',
            'Recording history',
            'Priority support',
            'Save $30 per year',
          ]}
          isPopular={true}
          onSelect={() => handleSelectPlan('yearly')}
          disabled={loading}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Free trial: 1 hour per day for 2 days, then upgrade for unlimited access.
        </Text>
        <Text style={styles.footerText}>
          Plans auto-renew. Cancel anytime in your account settings.
        </Text>
        <Text style={styles.footerText}>
          By subscribing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  trialIndicator: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  trialText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#047857',
  },
  plansContainer: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
});