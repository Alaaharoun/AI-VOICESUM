import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  checkUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,

  signIn: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      set({ user: data.user, session: data.session });
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  signUp: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      // Create profile for new user
      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          user_id: data.user.id,
          full_name: '',
          avatar_url: '',
        });
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
      set({ user: null, session: null });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  },

  checkUser: async () => {
    try {
      set({ loading: true });
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        set({ user: session.user, session });
      }
    } catch (error) {
      console.error('Check user error:', error);
    } finally {
      set({ loading: false });
    }
  },
}));

// Initialize auth state
supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.setState({ user: session?.user || null, session });
}); 