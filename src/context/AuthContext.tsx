import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../core/types';
import { 
  signInWithGoogle, 
  signOutUser, 
  getCurrentUserProfile, 
  supabase, 
  isSupabaseConfigured 
} from '../services/supabase';

export interface AuthModalOptions {
  title?: string;
  subtitle?: string;
  iconType?: 'logo' | 'shared';
  hideGuestOption?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalOptions: AuthModalOptions | null;
  isOfflineWarningModalOpen: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  continueAsGuest: () => void;
  confirmContinueAsGuest: () => void;
  openAuthModal: (options?: AuthModalOptions) => void;
  closeAuthModal: () => void;
  closeOfflineWarningModal: () => void;
  openOfflineWarningModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_STORAGE_KEY = 'sobra_auth_is_guest_mode_v1';
const ONBOARDING_COMPLETED_KEY = 'sobra_auth_onboarding_seen_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return localStorage.getItem(GUEST_STORAGE_KEY) === 'true';
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalOptions, setAuthModalOptions] = useState<AuthModalOptions | null>(null);
  const [isOfflineWarningModalOpen, setIsOfflineWarningModalOpen] = useState<boolean>(false);

  // Inicializa estado de autenticação
  useEffect(() => {
    const initAuth = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (profile) {
          setUser(profile);
          setIsGuest(false);
          localStorage.removeItem(GUEST_STORAGE_KEY);
        } else {
          // Verifica se é primeira vez no app
          const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
          const isGuestSaved = localStorage.getItem(GUEST_STORAGE_KEY) === 'true';

          if (!hasCompletedOnboarding && !isGuestSaved) {
            // Incentiva a criação de conta abrindo o modal de boas-vindas
            setIsAuthModalOpen(true);
          }
        }
      } catch (err) {
        console.error('Erro ao inicializar auth:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Se o Supabase estiver configurado, escuta mudanças de autenticação
    if (supabase && isSupabaseConfigured()) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const u = session.user;
          const prof: UserProfile = {
            id: u.id,
            email: u.email || '',
            displayName: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Usuário',
            avatarUrl: u.user_metadata?.avatar_url || u.user_metadata?.picture,
          };
          setUser(prof);
          setIsGuest(false);
          localStorage.removeItem(GUEST_STORAGE_KEY);
          localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
          setIsAuthModalOpen(false);
          setIsOfflineWarningModalOpen(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  const loginWithGoogle = async () => {
    try {
      setIsLoading(true);
      const profile = await signInWithGoogle();
      if (profile && profile.id !== 'pending-redirect') {
        setUser(profile);
        setIsGuest(false);
        localStorage.removeItem(GUEST_STORAGE_KEY);
        localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
        setIsAuthModalOpen(false);
        setIsOfflineWarningModalOpen(false);
      }
    } catch (err) {
      console.error('Erro no login com Google:', err);
      alert('Não foi possível conectar com o Google no momento. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
      setUser(null);
      setIsGuest(true);
      localStorage.setItem(GUEST_STORAGE_KEY, 'true');
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  // Usuário optou por continuar sem conta
  const continueAsGuest = () => {
    setIsGuest(true);
    localStorage.setItem(GUEST_STORAGE_KEY, 'true');
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    setIsAuthModalOpen(false);
    setIsOfflineWarningModalOpen(false);
  };

  const confirmContinueAsGuest = continueAsGuest;

  const openAuthModal = (options?: AuthModalOptions) => {
    setAuthModalOptions(options || null);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthModalOptions(null);
  };

  const openOfflineWarningModal = () => {
    setIsOfflineWarningModalOpen(true);
  };

  const closeOfflineWarningModal = () => {
    setIsOfflineWarningModalOpen(false);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isGuest,
    isLoading,
    isAuthModalOpen,
    authModalOptions,
    isOfflineWarningModalOpen,
    loginWithGoogle,
    logout,
    continueAsGuest,
    confirmContinueAsGuest,
    openAuthModal,
    closeAuthModal,
    openOfflineWarningModal,
    closeOfflineWarningModal,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
