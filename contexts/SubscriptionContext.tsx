import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

interface SubscriptionContextType {
  isSubscribed: boolean;
  subscriptionType: 'monthly' | 'yearly' | null;
  hasFreeTrial: boolean;
  freeTrialExpired: boolean;
  dailyUsageSeconds: number;
  dailyLimitSeconds: number;
  hasRemainingTrialTime: boolean;
  loading: boolean;
  checkSubscription: () => Promise<void>;
  updateDailyUsage: (additionalSeconds: number) => Promise<void>;
  getRemainingTrialTime: () => number;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const DAILY_TRIAL_LIMIT_SECONDS = 60 * 60; // 1 hour = 3600 seconds

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const mountedRef = useRef(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<'monthly' | 'yearly' | null>(null);
  const [hasFreeTrial, setHasFreeTrial] = useState(false);
  const [freeTrialExpired, setFreeTrialExpired] = useState(false);
  const [dailyUsageSeconds, setDailyUsageSeconds] = useState(0);
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
        setHasFreeTrial(false);
        setFreeTrialExpired(false);
        setDailyUsageSeconds(0);
        setLoading(false);
      }
      return;
    }

    if (mountedRef.current) {
      setLoading(true);
    }

    try {
      // Check subscription status
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking subscription:', error);
        // Don't return early, continue to check trial status
      }

      if (data) {
        if (mountedRef.current) {
          setIsSubscribed(true);
          setSubscriptionType(data.subscription_type);
          setHasFreeTrial(false);
          setFreeTrialExpired(false);
          setDailyUsageSeconds(0);
        }
      } else {
        if (mountedRef.current) {
          setIsSubscribed(false);
          setSubscriptionType(null);
        }
        // Check free trial status for non-subscribed users
        await checkFreeTrialStatus();
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      if (mountedRef.current) {
        setIsSubscribed(false);
        setSubscriptionType(null);
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

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        subscriptionType,
        hasFreeTrial,
        freeTrialExpired,
        dailyUsageSeconds,
        dailyLimitSeconds,
        hasRemainingTrialTime,
        loading,
        checkSubscription,
        updateDailyUsage,
        getRemainingTrialTime,
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