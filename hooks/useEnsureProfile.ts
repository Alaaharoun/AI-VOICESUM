import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useEnsureProfile() {
  const { user } = useAuth();

  useEffect(() => {
    const ensureProfile = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (!data) {
        await supabase.from('profiles').insert([
          {
            id: user.id,
            user_id: user.id,
            email: user.email,
            plan: 'free'
          }
        ]);
      }
    };
    ensureProfile();
  }, [user]);
} 