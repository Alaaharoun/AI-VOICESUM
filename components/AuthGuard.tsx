import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    console.log('[AuthGuard] Checking auth state:', { 
      user: !!user, 
      pathname, 
      isOnAuthPage: pathname?.startsWith('/(auth)'),
      isAuthenticated: !!user 
    });

    const isOnAuthPage = pathname?.startsWith('/(auth)');
    const isAuthenticated = !!user;

    if (isAuthenticated && isOnAuthPage) {
      // المستخدم مسجل دخول وفي صفحة auth -> توجيه إلى التطبيق
      console.log('[AuthGuard] User authenticated but on auth page, redirecting to app...');
      router.replace('/(tabs)');
    } else if (!isAuthenticated && !isOnAuthPage) {
      // المستخدم غير مسجل دخول وليس في صفحة auth -> توجيه إلى التسجيل
      console.log('[AuthGuard] User not authenticated and not on auth page, redirecting to sign-up...');
      router.replace('/(auth)/sign-up');
    } else {
      // الحالات الأخرى - السماح بالوصول
      console.log('[AuthGuard] Allowing access - user:', !!user, 'pathname:', pathname);
    }
  }, [user, loading, pathname]);

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#6B7280' }}>Checking authentication...</Text>
      </View>
    );
  }

  // السماح بالوصول في جميع الحالات - التوجيه يتم في useEffect
  return <>{children}</>;
} 