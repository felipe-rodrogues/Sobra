import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../core/types';
import { 
  signInWithGoogle, 
  signOutUser, 
  getCurrentUserProfile, 
  updateCurrentUserProfile,
  handleAuthDeepLink,
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
  updateProfile: (updates: { displayName?: string; avatarUrl?: string }) => Promise<void>;
  continueAsGuest: () => void;
  confirmContinueAsGuest: () => void;
  openAuthModal: (options?: AuthModalOptions) => void;
  closeAuthModal: () => void;
  closeOfflineWarningModal: () => void;
  openOfflineWarningModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_STORAGE_KEY = 'sobra_auth_is_guest_mode_v1';

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
          // Mostra o modal de boas-vindas se o usuário não está logado e não escolheu modo offline
          const isGuestSaved = localStorage.getItem(GUEST_STORAGE_KEY) === 'true';
          if (!isGuestSaved) {
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
    let unsubscribeSupabase: (() => void) | undefined;
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
          setIsAuthModalOpen(false);
          setIsOfflineWarningModalOpen(false);

          // Fecha o browser nativo do Capacitor após o login via OAuth
          try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.close();
          } catch {
            // Ignora se não estiver em ambiente Capacitor
          }

          // Limpa tokens e fragmentos da URL no browser para evitar erros de token expirado em futuros reloads
          if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token')) {
            try {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch {}
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      });

      // Se a URL contiver hash expirado ou com erro, limpa também
      if (typeof window !== 'undefined' && window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('error'))) {
        setTimeout(() => {
          try {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          } catch {}
        }, 800);
      }

      unsubscribeSupabase = () => subscription.unsubscribe();
    }

    // Escuta retornos de Deep Link no ambiente nativo (Capacitor)
    let removeAppUrlListener: (() => void) | undefined;

    const setupDeepLinks = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');

        const listenerHandler = await CapApp.addListener('appUrlOpen', async ({ url }) => {
          if (url && (url.includes('com.sobra.finance') || url.includes('login-callback') || url.includes('access_token') || url.includes('code='))) {
            try {
              setIsLoading(true);
              const profile = await handleAuthDeepLink(url);
              if (profile) {
                setUser(profile);
                setIsGuest(false);
                localStorage.removeItem(GUEST_STORAGE_KEY);
                setIsAuthModalOpen(false);
                setIsOfflineWarningModalOpen(false);
              }
            } catch (err: any) {
              console.error('[AuthContext] Erro ao processar deep link:', err);
            } finally {
              setIsLoading(false);
            }
          }
        });

        removeAppUrlListener = () => {
          listenerHandler.remove();
        };

        // Verifica se o app foi aberto diretamente por uma URL
        const launchUrl = await CapApp.getLaunchUrl();
        if (launchUrl?.url && (launchUrl.url.includes('com.sobra.finance') || launchUrl.url.includes('login-callback'))) {
          const profile = await handleAuthDeepLink(launchUrl.url);
          if (profile) {
            setUser(profile);
            setIsGuest(false);
            localStorage.removeItem(GUEST_STORAGE_KEY);
            setIsAuthModalOpen(false);
          }
        }
      } catch {
        // Ignora se não estiver em ambiente Capacitor
      }
    };

    setupDeepLinks();

    return () => {
      if (unsubscribeSupabase) unsubscribeSupabase();
      if (removeAppUrlListener) removeAppUrlListener();
    };
  }, []);

  const loginWithGoogle = async () => {
    try {
      setIsLoading(true);
      const profile = await signInWithGoogle();
      if (profile && profile.id !== 'pending-redirect') {
        setUser(profile);
        setIsGuest(false);
        localStorage.removeItem(GUEST_STORAGE_KEY);
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

  const updateProfile = async (updates: { displayName?: string; avatarUrl?: string }) => {
    try {
      setIsLoading(true);
      const updated = await updateCurrentUserProfile(updates);
      setUser(updated);
      setIsGuest(false);
      localStorage.removeItem(GUEST_STORAGE_KEY);
    } catch (err) {
      console.error('Erro ao atualizar perfil:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Usuário optou por continuar sem conta
  const continueAsGuest = () => {
    setIsGuest(true);
    localStorage.setItem(GUEST_STORAGE_KEY, 'true');
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
    updateProfile,
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
