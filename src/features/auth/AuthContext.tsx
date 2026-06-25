import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../../shared/lib/supabaseClient';
import type { SessionUser, AuthState, SimulatorRole } from '../../shared/types/domain';

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  hasRole: (roles: SimulatorRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const fetchUserProfile = async (userId: string): Promise<SessionUser | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, role, full_name, branch_id')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.warn('User profile not found, using default role');
        return null;
      }

      return {
        id: (data as any).id,
        email: (data as any).email,
        role: (data as any).role as SimulatorRole,
        name: (data as any).full_name || undefined,
        branchId: (data as any).branch_id || undefined,
      };
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return null;
    }
  };

  const initializeAuth = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
        setState({ user: null, session: null, isLoading: false, isAuthenticated: false });
        return;
      }

      if (session?.user) {
        const userProfile = await fetchUserProfile(session.user.id);
        if (userProfile) {
          setState({
            user: userProfile,
            session,
            isLoading: false,
            isAuthenticated: true,
          });
        } else {
          setState({
            user: null,
            session: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      } else {
        setState({ user: null, session: null, isLoading: false, isAuthenticated: false });
      }
    } catch (err) {
      console.error('Auth initialization error:', err);
      setState({ user: null, session: null, isLoading: false, isAuthenticated: false });
    }
  };

  useEffect(() => {
    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const userProfile = await fetchUserProfile(session.user.id);
        if (userProfile) {
          setState({
            user: userProfile,
            session,
            isLoading: false,
            isAuthenticated: true,
          });
        }
      } else if (event === 'SIGNED_OUT') {
        setState({ user: null, session: null, isLoading: false, isAuthenticated: false });
      } else if (session?.user) {
        const userProfile = await fetchUserProfile(session.user.id);
        if (userProfile) {
          setState({
            user: userProfile,
            session,
            isLoading: false,
            isAuthenticated: true,
          });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
    }
    setState({ user: null, session: null, isLoading: false, isAuthenticated: false });
  };

  const refreshSession = async () => {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Session refresh error:', error);
    }
    if (session?.user) {
      const userProfile = await fetchUserProfile(session.user.id);
      if (userProfile) {
        setState({
          user: userProfile,
          session,
          isLoading: false,
          isAuthenticated: true,
        });
      }
    }
  };

  const hasRole = (roles: SimulatorRole[]): boolean => {
    return state.isAuthenticated && state.user !== null && roles.includes(state.user.role);
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signInWithMagicLink, signOut, refreshSession, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
