import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!loading) {
      // إذا كان المستخدم غير موجود وليس في صفحة auth
      if (!user && !pathname.startsWith('/(auth)') && !hasRedirected.current) {
        console.log('[AuthGuard] No user found, redirecting to sign-in...');
        hasRedirected.current = true;
        // استخدام setTimeout للتأكد من أن التوجيه يحدث بعد render
        setTimeout(() => {
          router.replace('/(auth)/sign-in');
        }, 100);
      } 
      // إذا كان المستخدم موجود وفي صفحة auth
      else if (user && pathname.startsWith('/(auth)') && !hasRedirected.current) {
        console.log('[AuthGuard] User authenticated, redirecting to tabs...');
        hasRedirected.current = true;
        // استخدام setTimeout للتأكد من أن التوجيه يحدث بعد render
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 100);
      }
      // إعادة تعيين العلم عند تغيير حالة المستخدم
      else if (user && hasRedirected.current) {
        console.log('[AuthGuard] User authenticated, resetting redirect flag');
        hasRedirected.current = false;
      }
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

  // If no user and not loading, allow navigation to auth pages
  if (!user && !pathname.startsWith('/(auth)')) {
    // Don't show loading screen, let the redirect happen naturally
    return <>{children}</>;
  }

  // If user is authenticated and on auth pages, allow navigation to app
  if (user && pathname.startsWith('/(auth)')) {
    // Don't show loading screen, let the redirect happen naturally
    return <>{children}</>;
  }

  // Render children for all other cases
  return <>{children}</>;
} 