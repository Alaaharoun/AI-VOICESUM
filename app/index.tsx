import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, Text, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, loading } = useAuth();
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    console.log('[Index] user:', user, 'loading:', loading);
    if (!loading) {
      if (user) {
        console.log('[Index] Routing to /tabs');
        router.replace('/(tabs)');
      } else {
        console.log('[Index] Routing to /auth/sign-in');
        router.replace('/(auth)/sign-in');
      }
      // إذا لم يتم التوجيه خلال 3 ثواني، أظهر شاشة fallback
      const timer = setTimeout(() => setFallback(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  if (fallback) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 20, color: 'red', marginBottom: 16 }}>⚠️ لم يتم التوجيه لأي شاشة!</Text>
        <Text style={{ fontSize: 16, color: '#333', marginBottom: 8 }}>user: {String(user)}</Text>
        <Text style={{ fontSize: 16, color: '#333', marginBottom: 8 }}>loading: {String(loading)}</Text>
        <Text style={{ fontSize: 14, color: '#666' }}>إذا رأيت هذه الشاشة، هناك مشكلة في التوجيه أو في Expo Router.</Text>
      </View>
    );
  }

  // Show loading screen while checking authentication
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={{ marginTop: 16, fontSize: 16, color: '#6B7280' }}>Loading...</Text>
    </View>
  );
} 