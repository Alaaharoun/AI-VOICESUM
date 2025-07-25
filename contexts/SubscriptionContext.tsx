import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

interface SubscriptionContextType {
  isSubscribed: boolean;
  subscriptionType: 'monthly' | 'yearly' | null;
  subscriptionPlan: 'basic' | 'sup_pro' | 'unlimited' | null;
  subscriptionStatus: 'active' | 'canceled' | 'trial' | null;
  subscriptionEndDate: Date | null;
  subscriptionPlanName: string | null;
  hasFreeTrial: boolean;
  freeTrialExpired: boolean;
  dailyUsageSeconds: number;
  dailyLimitSeconds: number;
  hasRemainingTrialTime: boolean;
  loading: boolean;
  checkSubscription: () => Promise<void>;
  updateDailyUsage: (additionalSeconds: number) => Promise<void>;
  getRemainingTrialTime: () => number;
  getRemainingMinutes: () => number | null;
  paidUsageSeconds: number;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const DAILY_TRIAL_LIMIT_SECONDS = 60 * 60; // 1 hour = 3600 seconds

const PLAN_MINUTES: Record<string, number> = {
  'mini_monthly': 60,
  'basic_monthly': 150,
  'basic_yearly': 150,
  'pro_monthly': 300,
  'pro_yearly': 300,
  'unlimited_monthly': 800,
  'unlimited_yearly': 800,
};

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const mountedRef = useRef(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'yearly' | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<'basic' | 'sup_pro' | 'unlimited' | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'canceled' | 'trial' | null>(null);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<Date | null>(null);
  const [subscriptionPlanName, setSubscriptionPlanName] = useState<string | null>(null);
  const [hasFreeTrial, setHasFreeTrial] = useState(false);
  const [freeTrialExpired, setFreeTrialExpired] = useState(false);
  const [dailyUsageSeconds, setDailyUsageSeconds] = useState(0);
  const [paidUsageSeconds, setPaidUsageSeconds] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const dailyLimitSeconds = DAILY_TRIAL_LIMIT_SECONDS;
  const hasRemainingTrialTime = hasFreeTrial && !freeTrialExpired && dailyUsageSeconds < dailyLimitSeconds;

  const getRemainingTrialTime = () => {
    if (!hasFreeTrial || freeTrialExpired) return 0;
    return Math.max(0, dailyLimitSeconds - dailyUsageSeconds);
  };

  const checkDailyUsage = async () => {
    if (!user) return;

    try {
      // First try to get existing daily usage
      const { data: existingUsage, error: fetchError } = await supabase
        .from('daily_usage')
        .select('*')
        .eq('user_id', user.id)
        .eq('usage_date', new Date().toISOString().split('T')[0])
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching daily usage:', fetchError);
        return;
      }

      if (existingUsage && mountedRef.current) {
        setDailyUsageSeconds(existingUsage.seconds_used || 0);
      } else if (fetchError?.code === 'PGRST116' && mountedRef.current) {
        // No record found for today, create one
        const { data: newUsage, error: createError } = await supabase
          .from('daily_usage')
          .insert({
            user_id: user.id,
            usage_date: new Date().toISOString().split('T')[0],
            seconds_used: 0
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating daily usage:', createError);
          return;
        }

        if (newUsage && mountedRef.current) {
          setDailyUsageSeconds(0);
        }
      }
    } catch (error) {
      console.error('Error checking daily usage:', error);
    }
  };

  const updateDailyUsage = async (additionalSeconds: number) => {
    if (!user || !hasFreeTrial || freeTrialExpired) return;

    try {
      const newUsage = dailyUsageSeconds + additionalSeconds;
      
      const { error } = await supabase
        .from('daily_usage')
        .upsert({
          user_id: user.id,
          usage_date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
          seconds_used: newUsage
        });

      if (error) {
        console.error('Error updating daily usage:', error);
        return;
      }

      if (mountedRef.current) {
        setDailyUsageSeconds(newUsage);
      }
    } catch (error) {
      console.error('Error updating daily usage:', error);
    }
  };

  const checkFreeTrialStatus = async () => {
    if (!user) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (profile) {
        const createdAt = new Date(profile.created_at);
        const twoDaysLater = new Date(createdAt.getTime() + (2 * 24 * 60 * 60 * 1000));
        const now = new Date();

        if (mountedRef.current) {
          if (now <= twoDaysLater) {
            setHasFreeTrial(true);
            setFreeTrialExpired(false);
            // Check daily usage when trial is active
            await checkDailyUsage();
          } else {
            setHasFreeTrial(false);
            setFreeTrialExpired(true);
            setDailyUsageSeconds(0);
          }
        }
      }
    } catch (error) {
      console.error('Error checking trial status:', error);
    }
  };

  const checkSubscription = async () => {
    if (!user) {
      if (mountedRef.current) {
        setIsSubscribed(false);
        setSubscriptionType(null);
        setSubscriptionPlan(null);
        setSubscriptionStatus(null);
        setSubscriptionEndDate(null);
        setSubscriptionPlanName(null);
        setHasFreeTrial(false);
        setFreeTrialExpired(false);
        setDailyUsageSeconds(0);
        setPaidUsageSeconds(0);
        setLoading(false);
      }
      return;
    }

    if (mountedRef.current) {
      setLoading(true);
    }

    try {
      // Check subscription status using the new table structure
      console.log('[SubscriptionContext] Checking subscription for user:', user.id);
      const { data: subscriptionData, error } = await supabase
        .from('user_subscriptions')
        .select('id, user_id, subscription_type, active, expires_at, usage_seconds, created_at')
        .eq('user_id', user.id)
        .eq('active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking subscription:', error);
        // Don't return early, continue to check trial status
      }

      if (subscriptionData) {
        console.log('[SubscriptionContext] Active subscription found:', subscriptionData);
        if (mountedRef.current) {
          setIsSubscribed(true);
          setSubscriptionType(subscriptionData.subscription_type as 'monthly' | 'yearly');
          setSubscriptionPlan(subscriptionData.subscription_type as 'basic' | 'sup_pro' | 'unlimited');
          setSubscriptionStatus('active');
          setSubscriptionEndDate(subscriptionData.expires_at ? new Date(subscriptionData.expires_at) : null);
          setSubscriptionPlanName(subscriptionData.subscription_type || null);
          setHasFreeTrial(false);
          setFreeTrialExpired(false);
          setDailyUsageSeconds(0);
          setPaidUsageSeconds(subscriptionData.usage_seconds || 0);
        }
      } else {
        if (mountedRef.current) {
          setIsSubscribed(false);
          setSubscriptionType(null);
          setSubscriptionPlan(null);
          setSubscriptionStatus(null);
          setSubscriptionEndDate(null);
          setSubscriptionPlanName(null);
        }
        // Check free trial status for non-subscribed users
        await checkFreeTrialStatus();
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      if (mountedRef.current) {
        setIsSubscribed(false);
        setSubscriptionType(null);
        setSubscriptionPlan(null);
        setSubscriptionStatus(null);
        setSubscriptionEndDate(null);
        setSubscriptionPlanName(null);
        // Still try to check trial status on error
        try {
          await checkFreeTrialStatus();
        } catch (trialError) {
          console.error('Error checking trial status:', trialError);
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    checkSubscription();
    
    return () => {
      mountedRef.current = false;
    };
  }, [user]);

  // دالة موحدة لحساب الدقائق المتبقية
  const getRemainingMinutes = () => {
    if (hasFreeTrial && !freeTrialExpired) {
      return Math.max(0, Math.floor((dailyLimitSeconds - dailyUsageSeconds) / 60));
    }
    if (isSubscribed && subscriptionType) {
      const plan = PLAN_MINUTES[subscriptionType];
      if (typeof plan === 'number') {
        return Math.max(0, plan - Math.floor(paidUsageSeconds / 60));
      }
    }
    return null;
  };

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        subscriptionType,
        subscriptionPlan,
        subscriptionStatus,
        subscriptionEndDate,
        subscriptionPlanName,
        hasFreeTrial,
        freeTrialExpired,
        dailyUsageSeconds,
        dailyLimitSeconds,
        hasRemainingTrialTime,
        loading,
        checkSubscription,
        updateDailyUsage,
        getRemainingTrialTime,
        getRemainingMinutes,
        paidUsageSeconds,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}