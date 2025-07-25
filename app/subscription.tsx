import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import { Crown, ArrowLeft, CheckCircle, Info, HelpCircle, ExternalLink, X, Check } from 'lucide-react-native';
import { purchaseUpdatedListener, purchaseErrorListener, finishTransaction, flushFailedPurchasesCachedAsPendingAndroid } from 'react-native-iap';

// Only import RNIap if not on web
let RNIap: any = null;
if (Platform.OS !== 'web') {
  try {
    RNIap = require('react-native-iap');
  } catch (error) {
    console.warn('RNIap not available:', error);
  }
}

// التحقق من أن التطبيق يعمل في المتصفح
const isWeb = Platform.OS === 'web';

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
  planButton: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 150,
    flexGrow: 1,
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
});

const packageData = [
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

// تعريف معرفات المنتجات وخريطة الخطط والعروض خارج المكون

type SubSku =
  | 'mini_monthly'
  | 'basic_monthly'
  | 'basic_yearly'
  | 'pro_monthly'
  | 'pro_yearly'
  | 'unlimited_monthly'
  | 'unlimited_yearly'
  | 'transcription_1_hour';

const PLAN_MAP: Record<SubSku, { basePlanId: string; offerId: string }> = {
  mini_monthly:      { basePlanId: 'mini-monthly',      offerId: 'mini-monthlyupdate' },
  basic_monthly:     { basePlanId: 'basic-monthly',     offerId: 'basic-monthlyupdate' },
  basic_yearly:      { basePlanId: 'basic-yearly',      offerId: 'basic-yearlyupdate' },
  pro_monthly:       { basePlanId: 'pro-monthly',       offerId: 'pro-monthlyupdate' },
  pro_yearly:        { basePlanId: 'pro-yearly',        offerId: 'pro-yearlyupdate' },
  unlimited_monthly: { basePlanId: 'unlimited-monthly', offerId: 'unlimited-monthlyupdate' },
  unlimited_yearly:  { basePlanId: 'unlimited-yearly',  offerId: 'unlimited-yearlyupdate' },
  transcription_1_hour: { basePlanId: 'transcription-1-hour', offerId: 'transcription-1-hour-update' },
};

const PRODUCT_IDS: SubSku[] = Object.keys(PLAN_MAP) as SubSku[];

// دالة مساعدة لإيجاد تفاصيل العرض الترويجي
function getOfferDetailsFor(
  productList: any[],
  productId: SubSku
): { pricePromo?: string; priceRecurring?: string; offerToken?: string } {
  const map = PLAN_MAP[productId];
  const prod = productList.find((p: any) => p.productId === productId);
  if (!prod) return {};
  const offers = prod.subscriptionOfferDetails ?? [];
  // حاول أولاً المطابقة الدقيقة (base + offer)
  let offer = offers.find((o: any) => o.basePlanId === map.basePlanId && o.offerId === map.offerId);
  // fallback: أي عرض بنفس الـ basePlan
  if (!offer) offer = offers.find((o: any) => o.basePlanId === map.basePlanId);
  // fallback أخير: أول عرض متاح
  if (!offer) offer = offers[0];
  if (!offer) return {};
  const phases = offer.pricingPhases ?? [];
  const first = phases[0];
  const last = phases[phases.length - 1];
  return {
    pricePromo: first?.formattedPrice,
    priceRecurring: last?.formattedPrice ?? first?.formattedPrice,
    offerToken: offer.offerToken,
  };
}

export default function SubscriptionScreen() {
  // جميع الـHooks في الأعلى
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [freeTrialStatus, setFreeTrialStatus] = useState<'not_activated' | 'active' | 'expired' | 'unknown'>('unknown');
  const authContext = useAuth();
  const subscriptionContext = useSubscription();
  const user = authContext?.user;
  const {
    checkSubscription,
    hasFreeTrial,
    freeTrialExpired,
    dailyUsageSeconds,
    dailyLimitSeconds,
    getRemainingTrialTime
  } = subscriptionContext || {};

  const purchaseUpdateRef = useRef<any>(null);
  const purchaseErrorRef = useRef<any>(null);
  const [pendingPurchase, setPendingPurchase] = useState<any>(null);
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);

  // تحديث useEffect لجلب المنتجات
  useEffect(() => {
    let didCancel = false;
    if (Platform.OS === 'web') {
      setIsReady(true);
      return;
    }
    if (!RNIap) {
      setIsReady(true);
      return;
    }
    const initIAP = async () => {
      try {
        await RNIap.initConnection();
        await flushFailedPurchasesCachedAsPendingAndroid();
        // جلب الاشتراكات والمنتجات الفردية
        const subscriptions = await RNIap.getSubscriptions(PRODUCT_IDS.filter(id => id !== 'transcription_1_hour'));
        const individualProducts = await RNIap.getProducts(['transcription_1_hour']);
        const products = [...subscriptions, ...individualProducts];
        
        // لوج مفصل لكل منتج وعروضه
        console.log(
          '▶️ Loaded products:',
          JSON.stringify(products.map((p: any) => ({
            id: p.productId,
            price: p.price,
            localizedPrice: p.localizedPrice,
            type: p.subscriptionOfferDetails ? 'subscription' : 'product',
            offers: p.subscriptionOfferDetails?.map((o: any) => ({
              basePlanId: o.basePlanId,
              offerId: o.offerId,
              token: o.offerToken,
              phases: o.pricingPhases?.map((ph: any) => ph.formattedPrice),
            })),
          })), null, 2)
        );
        
        products.forEach((prod: any) => {
          console.log('Product:', prod.productId, 'Price:', prod.localizedPrice || prod.price, 'Type:', prod.subscriptionOfferDetails ? 'subscription' : 'product');
          if (prod.subscriptionOfferDetails) {
            prod.subscriptionOfferDetails.forEach((offer: any) => {
              console.log('  basePlanId:', offer.basePlanId, 'offerId:', offer.offerId, 'offerToken:', offer.offerToken);
            });
          }
        });
        if (!didCancel) setProducts(products || []);
      } catch (err) {
        if (!didCancel) setProducts([]);
      } finally {
        if (!didCancel) setIsReady(true);
      }
    };
    setTimeout(() => {
      initIAP();
    }, 100);
    return () => {
      didCancel = true;
      if (RNIap) {
        try { RNIap.endConnection(); } catch {}
      }
    };
  }, []);

  // مستمعي الشراء
  useEffect(() => {
    if (!RNIap) return;
    purchaseUpdateRef.current = purchaseUpdatedListener(async (purchase: any) => {
      try {
        // فقط إذا كان الشراء مكتمل (purchaseStateAndroid === 1)
        const productId = purchase.products?.[0] || purchase.productId;
        if (purchase && purchase.transactionReceipt && productId && purchase.purchaseStateAndroid === 1) {
          setPendingPurchase({ ...purchase, productId });
        }
      } catch (e) {
        console.error('Error in purchaseUpdatedListener:', e);
      }
    });
    purchaseErrorRef.current = purchaseErrorListener((error: any) => {
      Alert.alert('Purchase Error', error?.message || 'Unknown error');
      setLoading(false);
    });
    return () => {
      if (purchaseUpdateRef.current) purchaseUpdateRef.current.remove();
      if (purchaseErrorRef.current) purchaseErrorRef.current.remove();
    };
  }, []);

  // حفظ الاشتراك في supabase بعد استلام الشراء (بدون تحقق خادومي)
  useEffect(() => {
    const saveSubscription = async () => {
      if (!pendingPurchase || !user) return;
      try {
        const productId = pendingPurchase.productId as string;
        const purchaseToken = pendingPurchase.purchaseToken;
        const orderId = pendingPurchase.transactionId ?? pendingPurchase.orderId;
        if (productId === 'transcription_1_hour') {
          // شراء ساعة تفريغ صوتي لمرة واحدة
          console.log('🛒 Processing transcription_1_hour purchase for user:', user.id);
          
          // استخدام RPC function لإضافة الدقائق
          const { data: rpcResult, error: rpcError } = await supabase.rpc('increment_transcription_minutes', { 
            uid: user.id, 
            minutes: 60 
          });
          
          if (rpcError) {
            console.error('RPC Error:', rpcError);
            throw rpcError;
          }
          
          console.log('✅ Successfully added 60 minutes. RPC result:', rpcResult);
          
          // تحديث الرصيد المحلي
          setRemainingMinutes(prev => prev !== null ? prev + 60 : 60);
          
          showAlert('Success', '✅ 60 minutes added to your account successfully!');
          router.replace('/(tabs)');
          await finishTransaction(pendingPurchase);
        } else {
          // منطق الاشتراكات الشهرية/السنوية كما هو
          const planInfo = PLAN_MAP[productId as SubSku];
        let expiresAt: Date | null = null;
        if (planInfo) {
          expiresAt = new Date();
          if (planInfo.basePlanId.includes('yearly')) {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          } else {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
          }
        }
        const { error: upsertError } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: user.id,
            subscription_type: planInfo.basePlanId,
            active: true,
            expires_at: expiresAt ? expiresAt.toISOString() : null,
            purchase_token: purchaseToken,
            order_id: orderId,
            platform: 'google_play',
          }, { onConflict: 'user_id,subscription_type,platform' });
        if (upsertError) throw upsertError;
        await checkSubscription?.();
        router.replace('/(tabs)');
        await finishTransaction(pendingPurchase);
        }
      } catch (e) {
        let msg = (typeof e === 'object' && e !== null && 'message' in e) ? (e as any).message : String(e);
        showAlert('Error', msg || 'Failed to save subscription');
      } finally {
        setLoading(false);
        setPendingPurchase(null);
      }
    };
    saveSubscription();
  }, [pendingPurchase]);

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
    console.log('press handleActivateFreeTrial');
    if (isWeb) {
      showAlert('Not supported', 'Free trial activation is not supported on web.');
      return;
    }
    if (!user) {
      showAlert('Error', 'You must be signed in.');
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
      await checkSubscription?.();
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Free trial activation failed:', err, typeof err);
      let msg = '';
      if (err && typeof err === 'object' && err !== null && 'message' in err) {
        msg = (err as any).message;
      } else {
        msg = String(err);
      }
      showAlert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  // دالة إدارة الاشتراك
  const handleManageSubscription = () => {
    Linking.openURL('https://play.google.com/store/account/subscriptions');
  };

  // دالة عرض المحتوى حسب الحالة
  function renderContent() {
    if (!user) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 24 }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#EF4444', marginBottom: 16, textAlign: 'center' }}>
            Please sign in to view subscription plans
          </Text>
          <Text style={{ fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>
            You need to be logged in to manage or purchase a subscription.
          </Text>
          <TouchableOpacity 
            style={{ backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
            onPress={handleBack}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (error) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, color: '#EF4444', textAlign: 'center', marginBottom: 20 }}>
            {error}
          </Text>
          <TouchableOpacity 
            style={{ backgroundColor: '#2563EB', padding: 12, borderRadius: 8 }}
            onPress={() => setError(null)}
          >
            <Text style={{ color: 'white' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!isReady) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
          <Text style={{ fontSize: 16, color: '#6B7280' }}>Loading subscription plans...</Text>
        </View>
      );
    }
    if (!isWeb && !RNIap) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 24 }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#EF4444', marginBottom: 16, textAlign: 'center' }}>
            In-app purchases are not available
          </Text>
          <Text style={{ fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>
            The in-app purchase system (Google Play Billing) is not available on this device or build. Please use a production build or a compatible device.
          </Text>
          <TouchableOpacity 
            style={{ backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
            onPress={handleBack}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }
    // ... بقية منطق عرض الصفحة (نفس الكود السابق)
    // return الواجهة الكاملة للخطط وبطاقات التجربة المجانية ...
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.container}>
          {/* Error Boundary */}
          {error && (
            <View style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              backgroundColor: '#FEE2E2', 
              padding: 16, 
              zIndex: 1000 
            }}>
              <Text style={{ color: '#DC2626', textAlign: 'center' }}>{error}</Text>
            </View>
          )}
          {loading && (
            <View style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              backgroundColor: 'rgba(0,0,0,0.5)', 
              justifyContent: 'center', 
              alignItems: 'center',
              zIndex: 1000
            }}>
              <Text style={{ color: 'white', fontSize: 16 }}>Loading...</Text>
            </View>
          )}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleBack}
            >
              <ArrowLeft size={24} color="#374151" />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <Crown size={48} color="#F59E0B" />
              <Text style={styles.title}>Choose the plan that fits your needs - with high-accuracy instant translation and smart AI summary for every session.</Text>
            <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8 }}>
              📋 Monthly subscriptions OR 🎯 One-time credits for quick uploads
            </Text>
            {remainingMinutes !== null && (
              <View style={{ backgroundColor: '#ECFDF5', padding: 12, borderRadius: 8, marginTop: 16 }}>
                <Text style={{ color: '#10B981', fontWeight: 'bold', fontSize: 16, textAlign: 'center' }}>
                  Remaining Credits: {remainingMinutes} minutes
                </Text>
              </View>
            )}
            </View>
          </View>

          <View style={{backgroundColor:'#FEF3C7',borderRadius:12,padding:16,marginHorizontal:24,marginTop:16,marginBottom:8,alignItems:'center'}}>
            <Text style={{fontSize:18,fontWeight:'bold',color:'#92400E',marginBottom:4}}>Limited-Time Special Offer!</Text>
            <Text style={{color:'#92400E',fontSize:15,textAlign:'center',marginBottom:8}}>
              Enjoy special discounts for a limited time on all plans!
            </Text>
          </View>
          
          {/* Quick Purchase Notice */}
          <View style={{backgroundColor:'#EFF6FF',borderRadius:12,padding:16,marginHorizontal:24,marginBottom:16,alignItems:'center',borderWidth:1,borderColor:'#3B82F6'}}>
            <Text style={{fontSize:16,fontWeight:'bold',color:'#1E40AF',marginBottom:4}}>📁 Need Quick Upload Credits?</Text>
            <Text style={{color:'#374151',fontSize:14,textAlign:'center',marginBottom:4}}>
              Scroll down to find the "Quick Upload Credits" option for one-time purchases
            </Text>
            <Text style={{color:'#6B7280',fontSize:12,textAlign:'center',fontStyle:'italic'}}>
              This option is specifically designed for users of the upload.tsx page
            </Text>
          </View>

          {/* Free Trial Section */}
          {freeTrialStatus === 'not_activated' || freeTrialStatus === 'expired' ? (
            <View style={styles.trialCard}>
              <Text style={styles.trialTitle}>2-Day Free Trial!</Text>
              <Text style={styles.trialDesc}>No card required. Try all features free for 2 days.</Text>
              <TouchableOpacity style={styles.trialButton} onPress={handleActivateFreeTrial}>
                <Text style={styles.trialButtonText}>Start Free Trial</Text>
              </TouchableOpacity>
              <Text style={styles.trialNote}>Free trial ends automatically after 2 days.</Text>
            </View>
          ) : freeTrialStatus === 'active' ? (
            <View style={styles.trialCard}>
              <Text style={styles.trialTitle}>Free Trial Already Activated</Text>
              <Text style={styles.trialDesc}>You have already activated your free trial. Enjoy your access!</Text>
              <Text style={styles.trialNote}>Your trial will end automatically after 2 days.</Text>
            </View>
          ) : null}

          {/* Slider for minutes */}
          <View style={{ width: '100%', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 16, marginBottom: 8 }}>Monthly minutes for each plan</Text>
            <View style={{ flexDirection: 'row', width: '90%', height: 20, backgroundColor: '#1F2937', borderRadius: 12, overflow: 'hidden', marginBottom: 8, paddingHorizontal: 4, alignItems: 'center' }}>
              {packageData.map((pkg, idx) => (
                <View key={pkg.id} style={{ flex: pkg.minutes || 1, backgroundColor: idx === 0 ? '#F59E0B' : idx === 1 ? '#2563EB' : idx === 2 ? '#10B981' : '#F43F5E', height: '70%', borderRadius: 8, marginHorizontal: 2 }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '90%' }}>
              {packageData.map(pkg => (
                <Text key={pkg.id} style={{ fontSize: 12 }}>{pkg.title}</Text>
              ))}
            </View>
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 8, textAlign: 'center' }}>All minutes are renewed every month.</Text>
          </View>

          {/* Packages Vertical Comparison */}
          <View style={{ width: '100%', alignItems: 'center', marginBottom: 32 }}>
            {packageData.map((pkg, idx) => {
              const monthly = getOfferDetailsFor(products, pkg.googleProductIdMonthly as SubSku);
              const yearly  = pkg.googleProductIdYearly ? getOfferDetailsFor(products, pkg.googleProductIdYearly as SubSku) : undefined;
              return (
                <View key={pkg.id} style={[styles.planCard, pkg.highlight && { borderColor: '#2563EB', borderWidth: 2, shadowColor: '#2563EB', shadowOpacity: 0.12, elevation: 4 }]}> 
                  <Text style={[styles.planTitle, pkg.highlight && { color: '#2563EB' }]}>{pkg.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontWeight: 'bold', color: '#10B981', fontSize: 22, marginHorizontal: 4 }}>
                      {monthly?.pricePromo && monthly?.priceRecurring && monthly?.pricePromo !== monthly?.priceRecurring ? (
                        <>
                          {monthly.pricePromo}
                          <Text style={{ fontSize: 14, color: '#6B7280' }}>/month</Text>
                        </>
                      ) : (monthly?.pricePromo ?? monthly?.priceRecurring ?? '...')}
                    </Text>
                    {monthly?.priceRecurring && monthly?.priceRecurring !== monthly?.pricePromo && (
                      <Text style={{ color: '#6B7280', fontSize: 14, marginHorizontal: 4, textDecorationLine: 'line-through' }}>
                        {monthly.priceRecurring}
                      </Text>
                    )}
                  </View>
                  {pkg.annualPrice && (
                    <Text style={{ color: '#374151', fontSize: 14, marginBottom: 4 }}>
                      or {yearly?.pricePromo && yearly?.priceRecurring && yearly?.pricePromo !== yearly?.priceRecurring ? (
                        <>
                          {yearly.pricePromo}
                          <Text style={{ fontSize: 14, color: '#6B7280' }}>/year</Text>
                        </>
                      ) : yearly?.pricePromo ?? '...'} per year
                    </Text>
                  )}
                  <Text style={{ color: '#374151', fontSize: 14, marginBottom: 8 }}>{pkg.minutesLabel}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    {pkg.aiSummary ? <Check size={18} color="#10B981" /> : <X size={18} color="#EF4444" />}
                    <Text style={{ marginLeft: 8, fontSize: 15 }}>AI Summary</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    {pkg.instantTranslation ? <Check size={18} color="#10B981" /> : <X size={18} color="#EF4444" />}
                    <Text style={{ marginLeft: 8, fontSize: 15 }}>Instant Translation</Text>
                  </View>
                  <Text style={{ color: '#6B7280', fontSize: 13, marginBottom: 8 }}>{pkg.notes}</Text>
                  {pkg.fairUse && (
                    <Text style={{ color: '#F59E0B', fontSize: 12, marginBottom: 8 }}>{pkg.fairUse}</Text>
                  )}
                  {pkg.annualAvailable ? (
                    <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                      <TouchableOpacity
                        disabled={loading}
                        style={[
                          styles.planButton, 
                          { backgroundColor: loading ? '#9CA3AF' : (pkg.highlight ? '#2563EB' : '#10B981') }
                        ]}
                        onPress={() => buy(pkg.googleProductIdMonthly as SubSku)}
                      >
                        <Text style={styles.planButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                          {loading ? 'Loading...' : 'Subscribe Monthly'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={loading}
                        style={[styles.planButton, { backgroundColor: loading ? '#9CA3AF' : '#F59E0B' }]}
                        onPress={() => buy(pkg.googleProductIdYearly as SubSku)}
                      >
                        <Text style={styles.planButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                          {loading ? 'Loading...' : 'Subscribe Yearly'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      disabled={loading}
                      style={[
                        styles.planButton, 
                        { 
                          backgroundColor: loading ? '#9CA3AF' : (pkg.highlight ? '#2563EB' : '#10B981'), 
                          marginTop: 8 
                        }
                      ]}
                      onPress={() => buy(pkg.googleProductIdMonthly as SubSku)}
                    >
                      <Text style={styles.planButtonText}>
                        {loading ? 'Loading...' : 'Subscribe Monthly'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            {/* بطاقة شراء ساعة تفريغ صوتي */}
            <View style={[
              styles.planCard, 
              { 
                borderColor: '#F59E0B', 
                borderWidth: 3, 
                marginTop: 16,
                backgroundColor: '#FEF3C7',
                shadowColor: '#F59E0B',
                shadowOpacity: 0.15,
                elevation: 4
              }
            ]}> 
              <View style={{ 
                position: 'absolute', 
                top: -8, 
                left: 20, 
                backgroundColor: '#F59E0B', 
                paddingHorizontal: 12, 
                paddingVertical: 4, 
                borderRadius: 12 
              }}>
                <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>POPULAR</Text>
              </View>
              
              <Text style={[styles.planTitle, { color: '#92400E', marginTop: 8 }]}>🎯 Quick Upload Credits</Text>
              <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 8, textAlign: 'center', fontStyle: 'italic' }}>
                Perfect for upload.tsx page users
              </Text>
              <Text style={{ fontWeight: 'bold', color: '#10B981', fontSize: 24, marginVertical: 8 }}>
                {(() => {
                  const product = products.find(p => p.productId === 'transcription_1_hour');
                  if (!product) return 'Loading...';
                  return product.localizedPrice || product.price || 'Price not available';
                })()}
              </Text>
              <Text style={{ color: '#374151', fontSize: 16, marginBottom: 8, textAlign: 'center', fontWeight: '600' }}>
                60 minutes of transcription time
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>
                Perfect for quick file uploads and transcriptions
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Check size={18} color="#10B981" />
                <Text style={{ marginLeft: 8, fontSize: 15, color: '#374151' }}>One-time purchase</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Check size={18} color="#10B981" />
                <Text style={{ marginLeft: 8, fontSize: 15, color: '#374151' }}>No subscription required</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Check size={18} color="#10B981" />
                <Text style={{ marginLeft: 8, fontSize: 15, color: '#374151' }}>Instant credit addition</Text>
              </View>
              
              <TouchableOpacity
                disabled={loading || !products.find(p => p.productId === 'transcription_1_hour')}
                style={[
                  styles.planButton, 
                  { 
                    backgroundColor: loading || !products.find(p => p.productId === 'transcription_1_hour') ? '#9CA3AF' : '#F59E0B', 
                    marginTop: 8,
                    paddingVertical: 12,
                    borderRadius: 12
                  }
                ]}
                onPress={() => buy('transcription_1_hour' as any)}
              >
                <Text style={[styles.planButtonText, { fontSize: 16, fontWeight: 'bold' }]}>
                  {loading ? 'Processing...' : 
                   !products.find(p => p.productId === 'transcription_1_hour') ? 'Product Unavailable' : 
                   '🛒 Buy 60 Minutes Now'}
                </Text>
              </TouchableOpacity>
              
              {!products.find(p => p.productId === 'transcription_1_hour') && (
                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                  Product not available in your region or store
                </Text>
              )}
            </View>
          </View>

          {/* FAQ Section */}
          <View style={styles.faqSection}>
            <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
            <View style={styles.faqItem}>
              <View style={styles.faqQRow}>
                <HelpCircle size={18} color="#2563EB" />
                <Text style={styles.faqQ}>How does the free trial work?</Text>
              </View>
              <Text style={styles.faqA}>You get 2 days of unlimited access to all features. No credit card required. After 2 days, you'll need to subscribe to continue.</Text>
            </View>
            <View style={styles.faqItem}>
              <View style={styles.faqQRow}>
                <HelpCircle size={18} color="#2563EB" />
                <Text style={styles.faqQ}>Can I cancel my subscription?</Text>
              </View>
              <Text style={styles.faqA}>Yes, you can cancel anytime through Google Play Store. Your subscription will remain active until the end of the current billing period.</Text>
            </View>
            <View style={styles.faqItem}>
              <View style={styles.faqQRow}>
                <HelpCircle size={18} color="#2563EB" />
                <Text style={styles.faqQ}>What happens if I exceed my monthly minutes?</Text>
              </View>
              <Text style={styles.faqA}>You can upgrade to a higher plan or wait until your minutes reset next month. Unused minutes don't carry over.</Text>
            </View>
            <View style={styles.faqItem}>
              <View style={styles.faqQRow}>
                <HelpCircle size={18} color="#2563EB" />
                <Text style={styles.faqQ}>Is my data secure?</Text>
              </View>
              <Text style={styles.faqA}>Yes, we use industry-standard encryption and your data is processed securely. We don't store your audio files permanently.</Text>
            </View>
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

  // دالة showAlert (تعريفها داخل المكون)
  function showAlert(title: string, message: string) {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  // دالة العودة للخلف (handleBack)
  const handleBack = () => {
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  // عند الشراء: انتظر تأكيد الشراء من المستمع
  const buy = async (productId: SubSku) => {
    console.log('🛒 buy pressed for', productId);
    if (!RNIap) return;
    if (!user) {
      showAlert('Error', 'You must be signed in.');
      return;
    }
    
    // إذا كان منتج فردي (transcription_1_hour)
    if (productId === 'transcription_1_hour') {
      // تحقق من توفر المنتج
      const product = products.find(p => p.productId === 'transcription_1_hour');
      if (!product) {
        showAlert('Product Not Available', 'This product is not available in your region or store. Please try a subscription plan instead.');
        return;
      }
      
      setLoading(true);
      try {
        await RNIap.requestPurchase({
          sku: productId,
          obfuscatedAccountIdAndroid: user.id,
        });
        return;
      } catch (err) {
        let msg = '';
        if (err && typeof err === 'object' && err !== null && 'message' in err) {
          msg = (err as any).message;
        } else {
          msg = String(err);
        }
        Alert.alert('Purchase Failed', msg);
        showAlert('Error', msg);
        setLoading(false);
        return;
      }
    }
    
    // إذا كان اشتراك
    const details = getOfferDetailsFor(products, productId);
    console.log('🛒 offer details for', productId, ':', details);
    
    if (!details.offerToken) {
      console.log('🛒 no offerToken found for', productId, '- trying without subscriptionOffers');
      // إذا لم يكن هناك offerToken، جرب الشراء بدون subscriptionOffers
      setLoading(true);
      try {
        await RNIap.requestSubscription({
          sku: productId,
          obfuscatedAccountIdAndroid: user.id,
        });
        return;
      } catch (err) {
        let msg = '';
        if (err && typeof err === 'object' && err !== null && 'message' in err) {
          msg = (err as any).message;
        } else {
          msg = String(err);
        }
        Alert.alert('Purchase Failed', msg);
        showAlert('Error', msg);
        setLoading(false);
        return;
      }
    }
    
    console.log('🛒 using offerToken', details.offerToken, 'for', productId);
    setLoading(true);
    try {
      await RNIap.requestSubscription({
        sku: productId,
        subscriptionOffers: [{ offerToken: details.offerToken }],
        obfuscatedAccountIdAndroid: user.id,
      });
      // لا تكتب في supabase هنا، انتظر purchaseUpdatedListener
    } catch (err) {
      let msg = '';
      if (err && typeof err === 'object' && err !== null && 'message' in err) {
        msg = (err as any).message;
      } else {
        msg = String(err);
      }
      Alert.alert('Purchase Failed', msg);
      showAlert('Error', msg);
      setLoading(false);
    }
  };

  // استبدل جميع return في المكون بـ:
  return renderContent();
} 