import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import Constants from 'expo-constants';

interface UserPermissions {
  isSuperadmin: boolean;
  permissions: string[];
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: any }>;
  userPermissions: UserPermissions | null;
  serverConnectionStatus: 'disconnected' | 'connecting' | 'connected';
  initializeServerConnection: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [serverConnectionStatus, setServerConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const mountedRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);

  // جلب صلاحيات المستخدم عند تغيير المستخدم
  useEffect(() => {
    let cancelled = false;
    async function fetchPermissions(userId: string) {
      try {
        // تحقق من الأدمن
        const { data: isSuperadmin, error: superadminError } = await supabase.rpc('is_superadmin');
        if (cancelled) return;
        // جلب الأدوار
        const { data: userRoles, error: rolesError } = await supabase
          .from('user_roles_view')
          .select('role_name')
          .eq('user_id', userId);
        if (cancelled) return;
        // جلب الصلاحيات
        let permissionsList: string[] = [];
        if (isSuperadmin) {
          const { data: allPermissions, error: permissionsError } = await supabase
            .from('permissions')
            .select('name');
          if (!permissionsError && allPermissions) {
            permissionsList = (allPermissions as { name: string }[]).map(p => p.name);
          }
        } else {
          permissionsList = ['basic_access'];
        }
        const roles = userRoles?.map(role => role.role_name) || [];
        setUserPermissions({
          isSuperadmin: isSuperadmin || false,
          permissions: [...new Set(permissionsList)],
          roles
        });
      } catch {
        setUserPermissions({ isSuperadmin: false, permissions: [], roles: [] });
      }
    }
    if (user) {
      setUserPermissions(null); // reset while loading
      fetchPermissions(user.id);
    } else {
      setUserPermissions(null);
    }
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    console.log('[AuthContext] Initializing auth context...');
    
    // Check if Supabase is properly configured
    if (!isSupabaseConfigured) {
      console.warn('[AuthContext] Supabase not properly configured, skipping auth initialization');
      if (mountedRef.current) {
        setUser(null);
        setSession(null);
        setLoading(false);
      }
      return;
    }
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AuthContext] Initial session loaded:', !!session);
      if (mountedRef.current) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    }).catch((error) => {
      console.error('[AuthContext] Error loading initial session:', error);
      if (mountedRef.current) {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AuthContext] Auth state changed:', _event, !!session);
      if (mountedRef.current) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // الاتصال التلقائي بالسيرفر عند تسجيل الدخول
        if (session?.user && _event === 'SIGNED_IN') {
          console.log('[AuthContext] User signed in, initializing server connection...');
          setTimeout(() => {
            initializeServerConnection();
          }, 1000); // انتظار ثانية واحدة للتأكد من اكتمال تسجيل الدخول
        }
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: any }> => {
    console.log('[AuthContext] Attempting sign in for:', email);
    try {
      if (!supabase) {
        throw new Error('Supabase not configured');
      }
      
      const result = await supabase.auth.signInWithPassword({ email, password });
      console.log('[AuthContext] Sign in result:', result.error ? 'Error' : 'Success');
      
      // Ensure we always return an object with error property
      if (result.error) {
        return { 
          error: {
            message: typeof result.error === 'object' && result.error?.message 
              ? result.error.message 
              : String(result.error || 'Sign in failed')
          }
        };
      }
      
      // Success case - return no error
      return { error: null };
      
    } catch (error) {
      console.error('[AuthContext] Sign in error:', error);
      return { 
        error: { 
          message: error && typeof error === 'object' && (error as any).message 
            ? (error as any).message 
            : String(error || 'Network error')
        } 
      };
    }
  };

  const signUp = async (email: string, password: string) => {
    console.log('[AuthContext] Attempting sign up for:', email);
    try {
      const result = await supabase.auth.signUp({ email, password });
      console.log('[AuthContext] Sign up result:', result.error ? 'Error' : 'Success');
      if (result.error && typeof (result.error as any).message !== 'string') {
        result.error = { message: String(result.error) } as any;
      }
      if (!result.error && result.data?.user) {
        const user = result.data.user;
        try {
          const { error: profileError } = await supabase.from('profiles').insert([
            {
              id: user.id,
              full_name: '',
              avatar_url: ''
            }
          ]);
          if (profileError) {
            console.error('[AuthContext] Error creating profile after sign up:', profileError);
          }
        } catch (profileInsertError) {
          console.error('[AuthContext] Exception creating profile after sign up:', profileInsertError);
        }
      }
      return result;
    } catch (error: any) {
      console.error('[AuthContext] Sign up error:', error);
      return { error: { message: error && typeof (error as any).message === 'string' ? (error as any).message : String(error) } };
    }
  };

  const signOut = async () => {
    console.log('[AuthContext] Signing out...');
    try {
      await supabase.auth.signOut();
      if (mountedRef.current) {
        setUser(null);
        setSession(null);
      }
      console.log('[AuthContext] Sign out successful');
    } catch (error) {
      console.error('[AuthContext] Sign out error:', error);
      throw error;
    }
  };

  const deleteAccount = async () => {
    console.log('[AuthContext] Deleting account...');
    if (!user) {
      return { error: { message: 'No user logged in' } };
    }

    try {
      // Delete user data from all tables
      const tables = ['recordings', 'user_subscriptions', 'free_trials'];
      
      for (const table of tables) {
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq('user_id', user.id);

        if (deleteError) {
          console.error(`[AuthContext] Error deleting from ${table}:`, deleteError);
        }
      }

      // Delete the user account
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);

      if (deleteUserError) {
        console.error('[AuthContext] Error deleting user:', deleteUserError);
        return { error: { message: 'Failed to delete user account' } };
      }

      // Clear local state
      if (mountedRef.current) {
        setUser(null);
        setSession(null);
      }

      console.log('[AuthContext] Account deletion successful');
      return { error: null };
    } catch (error) {
      console.error('[AuthContext] Account deletion error:', error);
      return { error: { message: error && typeof (error as any).message === 'string' ? (error as any).message : String(error) } };
    }
  };

  // دالة لتهيئة الاتصال بالسيرفر
  const initializeServerConnection = async () => {
    try {
      console.log('[AuthContext] Initializing server connection...');
      setServerConnectionStatus('connecting');
      
      // إغلاق أي اتصال موجود
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // إنشاء اتصال جديد
      const ws = new WebSocket('wss://ai-voicesum.onrender.com/ws');
      
      ws.onopen = () => {
        console.log('[AuthContext] Server connection established');
        setServerConnectionStatus('connected');
        
        // إرسال رسالة تهيئة بسيطة
        const initMessage = {
          type: 'init',
          language: 'ar-SA',
          targetLanguage: 'en-US',
          clientSideTranslation: true,
          realTimeMode: true,
          autoDetection: true,
          audioConfig: {
            sampleRate: 16000,
            channels: 1,
            bitsPerSample: 16,
            encoding: 'pcm_s16le'
          }
        };
        ws.send(JSON.stringify(initMessage));
      };
      
      ws.onerror = (error) => {
        console.error('[AuthContext] Server connection error:', error);
        setServerConnectionStatus('disconnected');
      };
      
      ws.onclose = (event) => {
        console.log('[AuthContext] Server connection closed:', event.code, event.reason);
        setServerConnectionStatus('disconnected');
      };
      
      wsRef.current = ws;
      
    } catch (error) {
      console.error('[AuthContext] Failed to initialize server connection:', error);
      setServerConnectionStatus('disconnected');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        deleteAccount,
        userPermissions,
        serverConnectionStatus,
        initializeServerConnection,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}