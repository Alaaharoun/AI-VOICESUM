import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Settings, CreditCard, Download, LogOut, Crown, Calendar, CheckCircle, Info, Trash2, Share, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { permissionHelper } from '../utils/permissionHelper';

interface SubscriptionData {
  isSubscribed: boolean;
  subscriptionType: string | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  subscriptionEndDate: Date | null;
  dailyUsageSeconds: number;
  dailyLimitSeconds: number;
  hasFreeTrial: boolean;
  freeTrialExpired: boolean;
}

export const Profile: React.FC = () => {
  const { user, signOut } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>({
    isSubscribed: false,
    subscriptionType: null,
    subscriptionPlan: null,
    subscriptionStatus: null,
    subscriptionEndDate: null,
    dailyUsageSeconds: 0,
    dailyLimitSeconds: 0,
    hasFreeTrial: false,
    freeTrialExpired: false,
  });
  const [loading, setLoading] = useState(false);
  const [loadingPaid, setLoadingPaid] = useState(false);
  const [remainingPaidMinutes, setRemainingPaidMinutes] = useState<number | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [micStatus, setMicStatus] = useState<'granted' | 'denied' | 'unknown'>('unknown');
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [supportVisible, setSupportVisible] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [rateTapCount, setRateTapCount] = useState(0);
  const rateTapTimeout = useRef<number | null>(null);
  const [rateUsUrl, setRateUsUrl] = useState('');
  const [shareAppUrl, setShareAppUrl] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const PLAN_LABELS: Record<string, string> = {
    'mini-monthly': 'Mini (Basic+)',
    'basic-monthly': 'Basic Monthly',
    'basic-yearly': 'Basic Yearly',
    'pro-monthly': 'Pro Monthly',
    'pro-yearly': 'Pro Yearly',
    'unlimited-monthly': 'Unlimited Monthly',
    'unlimited-yearly': 'Unlimited Yearly',
    'free_trial': 'Free Trial',
  };

  // Fetch subscription data
  const fetchSubscriptionData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get user subscription data
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      // Get user profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (subscriptionData) {
        setSubscriptionData({
          isSubscribed: true,
          subscriptionType: subscriptionData.subscription_type,
          subscriptionPlan: subscriptionData.subscription_type,
          subscriptionStatus: subscriptionData.status,
          subscriptionEndDate: new Date(subscriptionData.expires_at),
          dailyUsageSeconds: subscriptionData.usage_seconds || 0,
          dailyLimitSeconds: subscriptionData.subscription_type === 'transcription_2.5hr' ? 9000 : 18000,
          hasFreeTrial: false,
          freeTrialExpired: false,
        });
      } else if (profileData) {
        // Check for free trial
        const hasFreeTrial = profileData.free_trial_used === false;
        const freeTrialExpired = profileData.free_trial_expires_at ? 
          new Date(profileData.free_trial_expires_at) < new Date() : false;

        setSubscriptionData({
          isSubscribed: false,
          subscriptionType: null,
          subscriptionPlan: null,
          subscriptionStatus: null,
          subscriptionEndDate: profileData.free_trial_expires_at ? new Date(profileData.free_trial_expires_at) : null,
          dailyUsageSeconds: profileData.daily_usage_seconds || 0,
          dailyLimitSeconds: 3600, // 1 hour for free trial
          hasFreeTrial,
          freeTrialExpired,
        });
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch paid usage for monthly subscriptions
  const fetchPaidUsage = async () => {
    if (!user || !subscriptionData.isSubscribed || subscriptionData.subscriptionType?.includes('yearly')) {
      setRemainingPaidMinutes(null);
      return;
    }

    setLoadingPaid(true);
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('usage_seconds, subscription_type')
        .eq('user_id', user.id)
        .eq('active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        setRemainingPaidMinutes(null);
        return;
      }

      let totalMinutes = 0;
      if (data.subscription_type === 'transcription_2.5hr') totalMinutes = 150;
      else if (data.subscription_type === 'transcription_5hr') totalMinutes = 300;
      else {
        setRemainingPaidMinutes(null);
        return;
      }

      const usedMinutes = Math.floor((data.usage_seconds || 0) / 60);
      setRemainingPaidMinutes(Math.max(0, totalMinutes - usedMinutes));
    } catch (error) {
      console.error('Error fetching paid usage:', error);
      setRemainingPaidMinutes(null);
    } finally {
      setLoadingPaid(false);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchSubscriptionData();
      await fetchPaidUsage();
      await checkAllPermissions();
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch app settings
  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const { data: rateData, error: rateError } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'rate_us_url')
          .single();
        
        if (rateError) {
          console.warn('Error fetching rate_us_url:', rateError);
          setRateUsUrl('https://play.google.com/store/apps/details?id=com.ailivetranslate.app');
        } else if (rateData && rateData.value) {
          setRateUsUrl(rateData.value);
        }
        
        const { data: shareData, error: shareError } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'share_app_url')
          .single();
        
        if (shareError) {
          console.warn('Error fetching share_app_url:', shareError);
          setShareAppUrl('https://play.google.com/store/apps/details?id=com.ailivetranslate.app');
        } else if (shareData && shareData.value) {
          setShareAppUrl(shareData.value);
        }
      } catch (error) {
        console.error('Error fetching app settings:', error);
        setRateUsUrl('https://play.google.com/store/apps/details?id=com.ailivetranslate.app');
        setShareAppUrl('https://play.google.com/store/apps/details?id=com.ailivetranslate.app');
      }
    };
    fetchLinks();
  }, []);

  // Load initial data
  useEffect(() => {
    if (user) {
      fetchSubscriptionData();
      fetchPaidUsage();
      checkAllPermissions();
    }
  }, [user]);

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      setSigningOut(true);
      try {
        await signOut();
        window.location.href = '/sign-in';
      } catch (err) {
        console.error('SignOut failed:', err);
        alert('Failed to sign out');
      } finally {
        setSigningOut(false);
      }
    }
  };

  // Check microphone permission
  const checkMicPermission = async () => {
    try {
      const status = await permissionHelper.getPermissionStatusString();
      setMicStatus(status);
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      setMicStatus('unknown');
    }
  };

  // Check all permissions
  const checkAllPermissions = async () => {
    await checkMicPermission();
  };

  // Request microphone permission
  const requestMicPermission = async () => {
    try {
      const permissionStatus = await permissionHelper.requestMicrophonePermission();
      setMicStatus(permissionStatus.granted ? 'granted' : 'denied');
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      setMicStatus('denied');
    }
    await checkAllPermissions();
  };

  // Handle rate us secret (5 taps to access admin)
  const handleRateUsSecret = () => {
    setRateTapCount((prev) => {
      const newCount = prev + 1;
      if (newCount === 5) {
        setRateTapCount(0);
        if (rateTapTimeout.current) clearTimeout(rateTapTimeout.current);
        window.location.href = '/admin';
        return 0;
      } else {
        if (rateTapTimeout.current) clearTimeout(rateTapTimeout.current);
        rateTapTimeout.current = setTimeout(() => setRateTapCount(0), 2000);
        return newCount;
      }
    });
  };

  // Handle share app
  const handleShareApp = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'LiveTranslate App',
          text: 'Try this amazing voice translation app!',
          url: shareAppUrl,
        });
      } else {
        // Fallback for browsers that don't support Web Share API
        await navigator.clipboard.writeText(shareAppUrl);
        alert('App link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing app:', error);
    }
  };

  const getPlanLabel = () => {
    if (!subscriptionData.isSubscribed && subscriptionData.hasFreeTrial && !subscriptionData.freeTrialExpired) 
      return PLAN_LABELS['free_trial'];
    if (!subscriptionData.isSubscribed) return 'Free';
    if (subscriptionData.subscriptionType && PLAN_LABELS[subscriptionData.subscriptionType]) 
      return PLAN_LABELS[subscriptionData.subscriptionType];
    return 'Premium';
  };

  const getMemberSince = () => {
    if (!user?.created_at) return '';
    const created = new Date(user.created_at);
    const now = new Date();
    if (created > now) return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return created.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getRemainingMinutes = () => {
    if (subscriptionData.subscriptionPlan === 'unlimited') return 'Unlimited';
    if (subscriptionData.isSubscribed && remainingPaidMinutes !== null) {
      return `${remainingPaidMinutes} min`;
    }
    if (subscriptionData.hasFreeTrial && !subscriptionData.freeTrialExpired) {
      return `${Math.floor((subscriptionData.dailyLimitSeconds - subscriptionData.dailyUsageSeconds) / 60)} min`;
    }
    return null;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{user.email}</h1>
                <div className="flex items-center space-x-2 mt-1">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium text-yellow-700">{getPlanLabel()} Plan</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <nav className="space-y-2">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    activeTab === 'profile'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5" />
                    <span>Profile</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('subscription')}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    activeTab === 'subscription'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Crown className="h-5 w-5" />
                    <span>Subscription</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    activeTab === 'settings'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Settings className="h-5 w-5" />
                    <span>Settings</span>
                  </div>
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="md:col-span-3">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                {/* Account Information */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Account Information</h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <Mail className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Email</p>
                        <p className="text-gray-900">{user.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Member Since</p>
                        <p className="text-gray-900">{getMemberSince()}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subscription Status */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Subscription Status</h2>
                  
                  {subscriptionData.isSubscribed ? (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Crown className="h-6 w-6 text-yellow-500" />
                        <span className="text-lg font-medium text-gray-900">{getPlanLabel()} Plan</span>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Subscription Type</p>
                          <p className="text-gray-900">{getPlanLabel()} Plan</p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-700">Valid Until</p>
                          <p className="text-gray-900">
                            {subscriptionData.subscriptionEndDate
                              ? subscriptionData.subscriptionEndDate.toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })
                              : 'N/A'}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-700">Minutes Left</p>
                          <p className="text-green-600 font-medium">
                            {loadingPaid ? '-' : getRemainingMinutes() || '-'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex space-x-3 pt-4">
                        <button className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                          Change Plan
                        </button>
                        <button className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : subscriptionData.hasFreeTrial ? (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Crown className="h-6 w-6 text-green-500" />
                        <span className="text-lg font-medium text-gray-900">Free Trial</span>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Minutes Left</p>
                          <p className="text-green-600 font-medium">
                            {Math.floor((subscriptionData.dailyLimitSeconds - subscriptionData.dailyUsageSeconds) / 60)} min
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-700">Trial Ends</p>
                          <p className="text-gray-900">
                            {subscriptionData.subscriptionEndDate
                              ? subscriptionData.subscriptionEndDate.toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })
                              : 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        Upgrade to Premium
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Crown className="h-6 w-6 text-gray-400" />
                        <span className="text-lg font-medium text-gray-900">No Active Subscription</span>
                      </div>
                      
                      <p className="text-gray-600">
                        Upgrade to premium to get unlimited transcriptions, AI summaries, and instant translations.
                      </p>
                      
                      <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        View Plans
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'subscription' && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Subscription Plans</h2>
                
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-blue-900">Free Plan</h3>
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        Current Plan
                      </span>
                    </div>
                    <p className="text-blue-700 mb-4">
                      You're currently on the free plan with limited features.
                    </p>
                    <ul className="space-y-2 text-sm text-blue-700">
                      <li>• 10 minutes of transcription per month</li>
                      <li>• Basic translation features</li>
                      <li>• Standard support</li>
                    </ul>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="border border-gray-200 rounded-lg p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Pro Plan</h3>
                      <div className="text-3xl font-bold text-gray-900 mb-2">$9.99<span className="text-lg text-gray-500">/month</span></div>
                      <ul className="space-y-2 text-sm text-gray-600 mb-4">
                        <li>• Unlimited transcription</li>
                        <li>• Advanced translation features</li>
                        <li>• Priority support</li>
                        <li>• Export to multiple formats</li>
                      </ul>
                      <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        Upgrade to Pro
                      </button>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Enterprise Plan</h3>
                      <div className="text-3xl font-bold text-gray-900 mb-2">$29.99<span className="text-lg text-gray-500">/month</span></div>
                      <ul className="space-y-2 text-sm text-gray-600 mb-4">
                        <li>• Everything in Pro</li>
                        <li>• Team collaboration</li>
                        <li>• API access</li>
                        <li>• Custom integrations</li>
                      </ul>
                      <button className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                        Contact Sales
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                {/* App Settings */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">App Settings</h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Microphone Permission</p>
                        <p className="text-sm text-gray-600">
                          Status: {micStatus === 'granted' ? '✅ Granted' : micStatus === 'denied' ? '❌ Denied' : 'Unknown'}
                        </p>
                      </div>
                      <button
                        onClick={requestMicPermission}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Request Permission
                      </button>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Actions</h2>
                  
                  <div className="space-y-3">
                    <button
                      onClick={() => window.location.href = '/live-translation'}
                      className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Info className="h-5 w-5 text-blue-600" />
                      <span className="text-blue-600">Live Translation</span>
                    </button>
                    
                    <button
                      onClick={() => window.open(rateUsUrl, '_blank')}
                      className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Crown className="h-5 w-5 text-yellow-500" />
                      <span className="text-yellow-600">Rate Us</span>
                    </button>
                    
                    <button
                      onClick={() => setPrivacyVisible(true)}
                      className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Info className="h-5 w-5 text-blue-600" />
                      <span className="text-blue-600">Privacy Policy</span>
                    </button>
                    
                    <button
                      onClick={() => setTermsVisible(true)}
                      className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Info className="h-5 w-5 text-blue-600" />
                      <span className="text-blue-600">Terms of Service</span>
                    </button>
                    
                    <button
                      onClick={() => setSupportVisible(true)}
                      className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Info className="h-5 w-5 text-green-600" />
                      <span className="text-green-600">Customer Support</span>
                    </button>
                    
                    <button
                      onClick={handleShareApp}
                      className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Share className="h-5 w-5 text-blue-600" />
                      <span className="text-blue-600">Share App</span>
                    </button>
                    
                    <button
                      onClick={() => window.location.href = '/history'}
                      className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Info className="h-5 w-5 text-blue-600" />
                      <span className="text-blue-600">History</span>
                    </button>
                    
                    <button
                      onClick={handleRateUsSecret}
                      className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Info className="h-5 w-5 text-gray-400" />
                      <span className="text-gray-600">Version: 6.7.0</span>
                    </button>
                    
                    <button
                      onClick={() => window.open('https://ai-voicesum.onrender.com/simple-delete-account.html', '_blank')}
                      className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-5 w-5 text-red-600" />
                      <span className="text-red-600">Delete Account</span>
                    </button>
                    
                    <button
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <LogOut className="h-5 w-5 text-red-600" />
                      <span className="text-red-600">{signingOut ? 'Signing Out...' : 'Sign Out'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Privacy Policy Modal */}
      {privacyVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Privacy Policy</h3>
            <div className="text-sm text-gray-700 space-y-4">
              <p><strong>Effective Date:</strong> 2024-07-05</p>
              <p>Welcome to AI LIVE TRANSLATE. This Privacy Policy explains how we collect, use, and protect your personal information when you use our application.</p>
              <p>Your privacy is important to us, and we are committed to complying with applicable privacy laws and policies.</p>
              <h4 className="font-semibold mt-4">Information We Collect</h4>
              <p>When using our app, we may collect audio recordings that you choose to transcribe, translate, or summarize. Audio data is processed by third-party services and is not stored permanently on our servers.</p>
              <h4 className="font-semibold mt-4">How We Use Your Information</h4>
              <p>We use your information to transcribe and translate your audio recordings, generate AI-powered summaries, improve app functionality, and provide customer support.</p>
            </div>
            <button
              onClick={() => setPrivacyVisible(false)}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Terms of Service Modal */}
      {termsVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Terms of Service</h3>
            <div className="text-sm text-gray-700 space-y-4">
              <p><strong>Effective Date:</strong> 2024-07-05</p>
              <p>Welcome to AI LIVE TRANSLATE. By using this App, you agree to the following Terms of Service and End User License Agreement (EULA).</p>
              <h4 className="font-semibold mt-4">License Grant</h4>
              <p>You are granted a limited, non-exclusive, non-transferable, revocable license to use the App for personal, non-commercial purposes only.</p>
              <h4 className="font-semibold mt-4">Acceptable Use</h4>
              <p>You agree to use the App in compliance with all applicable laws and policies. You will not use the App to violate the rights of others or upload illegal content.</p>
            </div>
            <button
              onClick={() => setTermsVisible(false)}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Customer Support Modal */}
      {supportVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Customer Support</h3>
            <p className="text-sm text-gray-600 mb-4">Send us your question or issue. Your message will be sent to our support team.</p>
            <textarea
              value={supportMessage}
              onChange={(e) => setSupportMessage(e.target.value)}
              placeholder="Type your message here..."
              className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none"
            />
            <div className="flex space-x-3 mt-4">
              <button
                onClick={() => {
                  const subject = encodeURIComponent('Customer Support Request');
                  const body = encodeURIComponent(`${supportMessage}\n\n---\nPlatform: Web\nUser Email: ${user?.email || 'N/A'}`);
                  window.open(`mailto:alaa.zekroum@gmail.com?subject=${subject}&body=${body}`);
                  setSupportVisible(false);
                  setSupportMessage("");
                }}
                disabled={!supportMessage.trim()}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                Send
              </button>
              <button
                onClick={() => setSupportVisible(false)}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 