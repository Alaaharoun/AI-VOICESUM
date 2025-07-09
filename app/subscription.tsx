import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SubscriptionPlan } from '@/components/SubscriptionPlan';
import { supabase } from '@/lib/supabase';
import { Crown, ArrowLeft, CheckCircle, Info, HelpCircle, ExternalLink } from 'lucide-react-native';

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
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
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
  card: {
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
  mainTitle: {
    fontSize: 26,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 8,
  },
  trialCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  trialTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
    marginBottom: 8,
  },
  trialDesc: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 16,
  },
  trialButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginBottom: 8,
  },
  trialButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  trialNote: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  plansRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 32,
    gap: 12,
    flexWrap: 'wrap',
  },
  planCard: {
    flex: 1,
    minWidth: 180,
    maxWidth: 220,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
    marginHorizontal: 6,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  planTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  planDesc: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  trialBadge: {
    backgroundColor: '#FDE68A',
    color: '#B45309',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 8,
  },
  planButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 8,
    alignItems: 'center',
  },
  planButtonText: {
    color: 'white',
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
  },
  faqSection: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  faqTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
    marginBottom: 12,
  },
  faqItem: {
    marginBottom: 16,
  },
  faqQRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  faqQ: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginLeft: 8,
  },
  faqA: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 26,
    marginBottom: 4,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    alignSelf: 'center',
  },
  manageText: {
    color: '#2563EB',
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 8,
  },
  privacyButton: {
    alignSelf: 'center',
    marginBottom: 32,
  },
  privacyText: {
    color: '#6B7280',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
});

const plans = [
  {
    id: 'transcription_2.5hr',
    title: '2.5 Hours',
    price: '$5',
    description: 'Perfect for temporary use. Convert audio to text, translate, and summarize quickly.',
    button: 'Buy Now',
    color: '#2563EB',
  },
  {
    id: 'transcription_5hr',
    title: '5 Hours',
    price: '$10',
    description: 'Get more time for a better value! Ideal for big projects.',
    button: 'Buy Now',
    color: '#10B981',
  },
  {
    id: 'transcription_annual',
    title: 'Annual',
    price: '$100/year',
    description: 'Unlimited access for a full year. Best for power users.',
    button: 'Buy Now',
    color: '#F59E0B',
  },
];

const FAQ = [
  {
    q: 'How do I cancel my subscription?',
    a: 'You can cancel anytime via Google Play settings.'
  },
  {
    q: 'What is included in the subscription?',
    a: 'High-accuracy speech-to-text, automatic translation to multiple languages, and smart summarization.'
  },
  {
    q: 'Is my subscription auto-renewed?',
    a: 'Yes, all paid subscriptions renew automatically at the end of each period unless you cancel through Google Play.'
  },
  {
    q: 'When does billing start for the free trial?',
    a: 'You will NOT be charged automatically after your free trial ends. If you enjoy the service, you can choose and purchase a paid plan at any time. If you do nothing, your access will simply end after the 2 days—no payment or subscription will be activated unless you buy one yourself.'
  },
];

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

  const handleBuy = (planId: string) => {
    // TODO: Connect to in-app purchase logic
    alert(`Selected plan: ${planId}`);
  };
  const handleStartTrial = () => {
    // TODO: Connect to trial activation logic
    alert('Free trial started!');
  };
  const handleManageSubscription = () => {
    Linking.openURL('https://play.google.com/store/account/subscriptions');
  };
  const handlePrivacyPolicy = () => {
    Linking.openURL('https://your-privacy-policy-link.com');
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={styles.container}>
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
                  ✨ Free trial active - {(() => {
                    const mins = Math.floor(getRemainingTrialTime() / 60);
                    const secs = getRemainingTrialTime() % 60;
                    return `${mins}m ${secs}s`;
                  })()} remaining today
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

        {/* Free Trial Section */}
        <View style={styles.trialCard}>
          <Text style={styles.trialTitle}>Try All Features Free for 2 Days!</Text>
          <Text style={styles.trialDesc}>No credit card required. Enjoy unlimited speech-to-text, translation, and smart summaries. If you like the service, you can subscribe to a paid plan anytime.</Text>
          <TouchableOpacity style={styles.trialButton} onPress={handleStartTrial}>
            <Text style={styles.trialButtonText}>Start Free Trial</Text>
          </TouchableOpacity>
          <Text style={styles.trialNote}>No payment or card required. Trial ends automatically after 2 days.</Text>
        </View>

        {/* Plans Section */}
        <View style={styles.plansRow}>
          {plans.map(plan => (
            <View key={plan.id} style={[styles.planCard, { borderColor: plan.color }]}> 
              <Text style={[styles.planTitle, { color: plan.color }]}>{plan.title}</Text>
              <Text style={styles.planPrice}>{plan.price}</Text>
              <Text style={styles.planDesc}>{plan.description}</Text>
              <TouchableOpacity style={[styles.planButton, { backgroundColor: plan.color }]} onPress={() => handleBuy(plan.id)}>
                <Text style={styles.planButtonText}>{plan.button}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
          {FAQ.map((item, idx) => (
            <View key={idx} style={styles.faqItem}>
              <View style={styles.faqQRow}>
                <HelpCircle size={18} color="#2563EB" />
                <Text style={styles.faqQ}>{item.q}</Text>
              </View>
              <Text style={styles.faqA}>{item.a}</Text>
            </View>
          ))}
        </View>

        {/* Manage Subscription & Privacy */}
        <TouchableOpacity style={styles.manageButton} onPress={handleManageSubscription}>
          <ExternalLink size={18} color="#2563EB" />
          <Text style={styles.manageText}>Manage your subscription via Google Play</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}