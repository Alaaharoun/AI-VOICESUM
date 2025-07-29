import React, { useState, useEffect } from 'react';
import { Check, Crown, ArrowLeft, Info, HelpCircle, ExternalLink, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface SubscriptionPlan {
  id: string;
  title: string;
  googleProductIdMonthly: string;
  googleProductIdYearly?: string;
  oldPrice: string | null;
  newPrice: string;
  oldAnnualPrice: string | null;
  annualPrice: string | null;
  minutes: number;
  minutesLabel: string;
  aiSummary: boolean;
  instantTranslation: boolean;
  notes: string;
  highlight: boolean;
  badge: string | null;
  fairUse: string | null;
  annualAvailable: boolean;
}

const packageData: SubscriptionPlan[] = [
  {
    id: 'mini',
    title: 'Mini (Basic+)',
    googleProductIdMonthly: 'mini_monthly',
    oldPrice: null,
    newPrice: '$5.00',
    oldAnnualPrice: null,
    annualPrice: null,
    minutes: 60,
    minutesLabel: '60 minutes (1 hour) per month',
    aiSummary: true,
    instantTranslation: true,
    notes: 'Entry plan for light users',
    highlight: false,
    badge: null,
    fairUse: null,
    annualAvailable: false,
  },
  {
    id: 'basic',
    title: 'Basic',
    googleProductIdMonthly: 'basic_monthly',
    googleProductIdYearly: 'basic_yearly',
    oldPrice: null,
    newPrice: '$12',
    oldAnnualPrice: '$130',
    annualPrice: '$130',
    minutes: 150,
    minutesLabel: '150 minutes (2.5 hours) per month',
    aiSummary: true,
    instantTranslation: true,
    notes: 'Includes AI summary and instant translation',
    highlight: false,
    badge: null,
    fairUse: null,
    annualAvailable: true,
  },
  {
    id: 'pro',
    title: 'Pro',
    googleProductIdMonthly: 'pro_monthly',
    googleProductIdYearly: 'pro_yearly',
    oldPrice: null,
    newPrice: '$24',
    oldAnnualPrice: '$350',
    annualPrice: '$350',
    minutes: 300,
    minutesLabel: '300 minutes (5 hours) per month',
    aiSummary: true,
    instantTranslation: true,
    notes: 'For power users',
    highlight: true,
    badge: null,
    fairUse: null,
    annualAvailable: true,
  },
  {
    id: 'unlimited',
    title: 'Unlimited',
    googleProductIdMonthly: 'unlimited_monthly',
    googleProductIdYearly: 'unlimited_yearly',
    oldPrice: null,
    newPrice: '$100',
    oldAnnualPrice: '$900',
    annualPrice: '$900',
    minutes: 800,
    minutesLabel: '800 minutes (13.3 hours) per month',
    aiSummary: true,
    instantTranslation: true,
    notes: 'Unlimited (with fair use)',
    highlight: true,
    badge: null,
    fairUse: 'Unlimited use with reasonable daily limits to ensure server stability',
    annualAvailable: true,
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

export const Subscription: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [freeTrialStatus, setFreeTrialStatus] = useState<'not_activated' | 'active' | 'expired' | 'unknown'>('unknown');
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);
  const { user } = useAuthStore();

  // تحقق من حالة التجربة المجانية عند تحميل الصفحة
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('subscription_type', 'free_trial')
        .single();
      if (data) {
        const now = new Date();
        const expires = new Date(data.expires_at);
        if (data.active && expires > now) {
          setFreeTrialStatus('active');
        } else {
          setFreeTrialStatus('expired');
        }
      } else if (error && error.code === 'PGRST116') {
        setFreeTrialStatus('not_activated');
      } else {
        setFreeTrialStatus('unknown');
      }
    })();
  }, [user]);

  // جلب الرصيد المتبقي
  useEffect(() => {
    const fetchCredits = async () => {
      if (!user) return;
      
      const { data: creditsData, error: creditsError } = await supabase
        .from('transcription_credits')
        .select('total_minutes, used_minutes')
        .eq('user_id', user.id)
        .single();
      
      if (!creditsError && creditsData) {
        const remaining = (creditsData.total_minutes || 0) - (creditsData.used_minutes || 0);
        setRemainingMinutes(remaining);
      } else {
        setRemainingMinutes(null);
      }
    };
    
    fetchCredits();
  }, [user]);

  // دالة تفعيل التجربة المجانية
  const handleActivateFreeTrial = async () => {
    if (!user) {
      alert('You must be signed in.');
      return;
    }
    setLoading(true);
    try {
      // تحقق إذا كان لديه تجربة مجانية بالفعل
      const { data: existing, error: existingError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('subscription_type', 'free_trial')
        .single();
      let expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 2);
      if (existing && existing.id) {
        // تحديث الصف
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .update({ active: true, expires_at: expiresAt.toISOString() })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        // إدراج صف جديد
        const { error: insertError } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: user.id,
            subscription_type: 'free_trial',
            active: true,
            expires_at: expiresAt.toISOString(),
          });
        if (insertError) throw insertError;
      }
      console.log('Free trial activated');
      alert('Free trial activated successfully!');
    } catch (err) {
      console.error('Free trial activation failed:', err);
      let msg = '';
      if (err && typeof err === 'object' && err !== null && 'message' in err) {
        msg = (err as any).message;
      } else {
        msg = String(err);
      }
      alert('Error: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  // دالة إدارة الاشتراك
  const handleManageSubscription = () => {
    window.open('https://play.google.com/store/account/subscriptions', '_blank');
  };

  // دالة الشراء (محاكاة للويب)
  const handleSubscribe = async (planId: string, isYearly: boolean = false) => {
    if (!user) {
      alert('You must be signed in.');
      return;
    }
    
    setLoading(true);
    try {
      // محاكاة عملية الشراء
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const plan = packageData.find(p => p.id === planId);
      if (!plan) throw new Error('Plan not found');
      
      let expiresAt = new Date();
      if (isYearly) {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }
      
      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          subscription_type: planId,
          active: true,
          expires_at: expiresAt.toISOString(),
          platform: 'web',
        });
      
      if (error) throw error;
      
      alert(`Successfully subscribed to ${plan.title}!`);
    } catch (err) {
      console.error('Subscription error:', err);
      alert('Failed to process subscription');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            Please sign in to view subscription plans
          </h2>
          <p className="text-gray-600 mb-6">
            You need to be logged in to manage or purchase a subscription.
          </p>
          <button 
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold"
            onClick={() => window.history.back()}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Crown className="h-12 w-12 text-yellow-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Choose the plan that fits your needs
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            High-accuracy instant translation and smart AI summary for every session
          </p>
          <p className="text-sm text-gray-500">
            📋 Monthly subscriptions OR 🎯 One-time credits for quick uploads
          </p>
          {remainingMinutes !== null && (
            <div className="bg-green-100 border border-green-200 rounded-lg p-4 mt-4">
              <p className="text-green-800 font-semibold text-center">
                Remaining Credits: {remainingMinutes} minutes
              </p>
            </div>
          )}
        </div>

        {/* Special Offer Banner */}
        <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-4 mb-6 text-center">
          <h3 className="text-lg font-bold text-yellow-800 mb-2">
            Limited-Time Special Offer!
          </h3>
          <p className="text-yellow-700">
            Enjoy special discounts for a limited time on all plans!
          </p>
        </div>

        {/* Quick Purchase Notice */}
        <div className="bg-blue-100 border border-blue-200 rounded-lg p-4 mb-8 text-center">
          <h3 className="text-lg font-bold text-blue-800 mb-2">
            📁 Need Quick Upload Credits?
          </h3>
          <p className="text-gray-700 mb-2">
            Scroll down to find the "Quick Upload Credits" option for one-time purchases
          </p>
          <p className="text-sm text-gray-600 italic">
            This option is specifically designed for users of the upload page
          </p>
        </div>

        {/* Free Trial Section */}
        {freeTrialStatus === 'not_activated' || freeTrialStatus === 'expired' ? (
          <div className="bg-green-100 border border-green-200 rounded-lg p-6 mb-8 text-center">
            <h3 className="text-xl font-bold text-green-800 mb-2">2-Day Free Trial!</h3>
            <p className="text-green-700 mb-4">No card required. Try all features free for 2 days.</p>
            <button 
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold"
              onClick={handleActivateFreeTrial}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Start Free Trial'}
            </button>
            <p className="text-sm text-green-600 mt-2">Free trial ends automatically after 2 days.</p>
          </div>
        ) : freeTrialStatus === 'active' ? (
          <div className="bg-green-100 border border-green-200 rounded-lg p-6 mb-8 text-center">
            <h3 className="text-xl font-bold text-green-800 mb-2">Free Trial Already Activated</h3>
            <p className="text-green-700">You have already activated your free trial. Enjoy your access!</p>
            <p className="text-sm text-green-600 mt-2">Your trial will end automatically after 2 days.</p>
          </div>
        ) : null}

        {/* Minutes Slider */}
        <div className="text-center mb-8">
          <h3 className="text-lg font-semibold mb-4">Monthly minutes for each plan</h3>
          <div className="flex justify-center mb-4">
            <div className="flex w-3/4 h-5 bg-gray-800 rounded-lg overflow-hidden">
              {packageData.map((pkg, idx) => (
                <div 
                  key={pkg.id} 
                  className={`h-full ${
                    idx === 0 ? 'bg-yellow-500' : 
                    idx === 1 ? 'bg-blue-500' : 
                    idx === 2 ? 'bg-green-500' : 'bg-pink-500'
                  }`}
                  style={{ flex: pkg.minutes || 1 }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-between w-3/4 mx-auto">
            {packageData.map(pkg => (
              <span key={pkg.id} className="text-sm text-gray-600">{pkg.title}</span>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-2">All minutes are renewed every month.</p>
        </div>

        {/* Subscription Plans */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {packageData.map((plan) => (
            <div 
              key={plan.id} 
              className={`bg-white rounded-lg border-2 p-6 ${
                plan.highlight ? 'border-blue-500 shadow-lg' : 'border-gray-200'
              }`}
            >
              <h3 className={`text-xl font-bold mb-2 ${plan.highlight ? 'text-blue-600' : 'text-gray-900'}`}>
                {plan.title}
              </h3>
              
              <div className="mb-4">
                <div className="flex items-center justify-center mb-2">
                  <span className="text-2xl font-bold text-green-600">{plan.newPrice}</span>
                  <span className="text-gray-500 ml-1">/month</span>
                </div>
                {plan.annualPrice && (
                  <p className="text-sm text-gray-600 text-center">
                    or {plan.annualPrice} per year
                  </p>
                )}
              </div>
              
              <p className="text-sm text-gray-600 mb-4 text-center">{plan.minutesLabel}</p>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center">
                  {plan.aiSummary ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}
                  <span className="ml-2 text-sm">AI Summary</span>
                </div>
                <div className="flex items-center">
                  {plan.instantTranslation ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}
                  <span className="ml-2 text-sm">Instant Translation</span>
                </div>
              </div>
              
              <p className="text-xs text-gray-500 mb-4 text-center">{plan.notes}</p>
              
              {plan.fairUse && (
                <p className="text-xs text-yellow-600 mb-4 text-center">{plan.fairUse}</p>
              )}
              
              <div className="space-y-2">
                <button
                  onClick={() => handleSubscribe(plan.id, false)}
                  disabled={loading}
                  className={`w-full py-2 px-4 rounded-lg font-semibold ${
                    plan.highlight 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading ? 'Processing...' : 'Subscribe Monthly'}
                </button>
                
                {plan.annualAvailable && (
                  <button
                    onClick={() => handleSubscribe(plan.id, true)}
                    disabled={loading}
                    className="w-full py-2 px-4 rounded-lg font-semibold bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Processing...' : 'Subscribe Yearly'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Upload Credits */}
        <div className="bg-yellow-100 border-2 border-yellow-500 rounded-lg p-6 mb-8 text-center">
          <div className="bg-yellow-500 text-white px-4 py-1 rounded-full text-sm font-bold inline-block mb-4">
            POPULAR
          </div>
          
          <h3 className="text-xl font-bold text-yellow-800 mb-2">🎯 Quick Upload Credits</h3>
          <p className="text-sm text-yellow-700 mb-4 italic">Perfect for upload page users</p>
          
          <div className="text-2xl font-bold text-green-600 mb-4">$2.99</div>
          <p className="text-lg font-semibold text-gray-800 mb-2">60 minutes of transcription time</p>
          <p className="text-sm text-gray-600 mb-6">Perfect for quick file uploads and transcriptions</p>
          
          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-center">
              <Check className="h-4 w-4 text-green-500" />
              <span className="ml-2 text-sm">One-time purchase</span>
            </div>
            <div className="flex items-center justify-center">
              <Check className="h-4 w-4 text-green-500" />
              <span className="ml-2 text-sm">No subscription required</span>
            </div>
            <div className="flex items-center justify-center">
              <Check className="h-4 w-4 text-green-500" />
              <span className="ml-2 text-sm">Instant credit addition</span>
            </div>
          </div>
          
          <button
            onClick={() => handleSubscribe('transcription_1_hour')}
            disabled={loading}
            className="w-full py-3 px-6 rounded-lg font-bold bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : '🛒 Buy 60 Minutes Now'}
          </button>
        </div>

        {/* FAQ Section */}
        <div className="bg-gray-100 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-blue-600 mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {FAQ.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center">
                  <HelpCircle className="h-5 w-5 text-blue-600 mr-2" />
                  <h3 className="font-semibold text-gray-900">{item.q}</h3>
                </div>
                <p className="text-gray-600 ml-7">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Manage Subscription */}
        <div className="text-center">
          <button 
            onClick={handleManageSubscription}
            className="inline-flex items-center bg-blue-100 text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-200"
          >
            <ExternalLink className="h-5 w-5 mr-2" />
            Manage your subscription via Google Play
          </button>
        </div>
      </div>
    </div>
  );
}; 