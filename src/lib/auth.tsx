// Keeps track of who is signed in and their profile, and shares it with every screen.
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { supabase } from './supabase';
import type { Profile } from './types';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<Profile | null>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) console.warn('Could not load profile:', error.message);
    setProfile(data ?? null);
    return (data as Profile | null) ?? null;
  }, []);

  const currentUserId = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Fires once at startup (with the saved login, if any) and again on every
    // sign-in, sign-out and token refresh.
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      const userId = newSession?.user.id;
      if (event !== 'INITIAL_SESSION' && userId === currentUserId.current) return; // same person, nothing to reload
      currentUserId.current = userId;
      setLoading(true);
      // Supabase recommends not awaiting other calls inside this callback, so defer it
      setTimeout(async () => {
        await loadProfile(userId);
        setLoading(false);
      }, 0);
    });
    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  const refreshProfile = useCallback(
    () => loadProfile(session?.user.id),
    [loadProfile, session?.user.id]
  );

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
