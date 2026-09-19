import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserProfile, SharedCardInvite, Transaction, Account } from '../core/types';

// Carrega as variáveis de ambiente Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verifica se as credenciais do Supabase foram configuradas
export const isSupabaseConfigured = (): boolean => {
  return !!(
    supabaseUrl && 
    supabaseAnonKey && 
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseUrl.includes('your-project')
  );
};

// Cliente Supabase instanciado se as variáveis existirem
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

// Chave local para persistência de sessão e dados simulados (quando sem Supabase na nuvem)
const LOCAL_AUTH_USER_KEY = 'sobra_auth_user_profile_v1';
const LOCAL_INVITES_KEY = 'sobra_shared_card_invites_v1';

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    } catch {}
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch {}
  },
  removeItem: (key: string): void => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch {}
  },
};

/**
 * Detecta se está rodando dentro de um WebView Capacitor (app nativo)
 */
const isCapacitorNative = (): boolean => {
  return (
    typeof (window as any).Capacitor !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.() === true
  );
};

/**
 * Autenticação via Google
 * No ambiente Capacitor (Android/iOS), abre o browser nativo e detecta a sessão após o fechamento.
 */
export const signInWithGoogle = async (): Promise<UserProfile> => {
  if (supabase && isSupabaseConfigured()) {
    // O redirect vai para o próprio Supabase (sempre aceito) ou para a URL do app
    const redirectUrl = isCapacitorNative()
      ? `${supabaseUrl}/auth/v1/callback`
      : window.location.origin;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: isCapacitorNative(),
      },
    });

    if (error) throw error;

    if (data?.url) {
      if (isCapacitorNative()) {
        // Abre o fluxo OAuth no browser nativo do sistema
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({ url: data.url, windowName: '_self' });

          // Aguarda o usuário concluir o login e o browser ser fechado
          await new Promise<void>((resolve) => {
            Browser.addListener('browserFinished', () => resolve());
          });

          // Após o browser fechar, tenta recuperar a sessão do Supabase
          const { data: sessionData } = await supabase!.auth.getSession();
          if (sessionData?.session?.user) {
            const u = sessionData.session.user;
            return {
              id: u.id,
              email: u.email || '',
              displayName:
                u.user_metadata?.full_name ||
                u.user_metadata?.name ||
                u.email?.split('@')[0] ||
                'Usuário',
              avatarUrl: u.user_metadata?.avatar_url || u.user_metadata?.picture,
            };
          }
        } catch (browserErr) {
          console.error('[Capacitor] Erro ao abrir browser OAuth:', browserErr);
          // Fallback: abre no WebView
          window.open(data.url, '_blank');
        }
      } else {
        window.location.href = data.url;
      }
    }

    return {
      id: 'pending-redirect',
      email: '',
      displayName: 'Carregando...',
    };
  }

  // Modo Simulação Local (Dev / Sem credenciais Supabase configuradas)
  const mockUser: UserProfile = {
    id: `usr_${Date.now().toString(36)}`,
    email: 'usuario@gmail.com',
    displayName: 'Usuário Sobra',
    avatarUrl: undefined,
  };

  safeStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(mockUser));
  return mockUser;
};

/**
 * Encerra a sessão do usuário
 */
export const signOutUser = async (): Promise<void> => {
  if (supabase && isSupabaseConfigured()) {
    await supabase.auth.signOut();
  }
  safeStorage.removeItem(LOCAL_AUTH_USER_KEY);
};

/**
 * Obtém o perfil do usuário logado
 */
export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  if (supabase && isSupabaseConfigured()) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const user = session.user;
      return {
        id: user.id,
        email: user.email || '',
        displayName: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
        avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture,
      };
    }
    return null;
  }

  const raw = safeStorage.getItem(LOCAL_AUTH_USER_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as UserProfile;
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Gera um código de convite amigável de 6 caracteres (ex: SOBRA-7492)
 */
export const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomPart = '';
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SOBRA-${randomPart}`;
};

/**
 * Cria ou recupera um convite de cartão compartilhado
 */
export const createOrGetCardInvite = async (
  account: Account,
  currentUser: UserProfile
): Promise<SharedCardInvite> => {
  const existingCode = account.inviteCode || generateInviteCode();

  const invite: SharedCardInvite = {
    code: existingCode,
    accountId: account.id,
    accountName: account.name,
    ownerId: currentUser.id,
    ownerName: currentUser.displayName,
    bankId: account.bankId,
    color: account.color,
    creditLimit: account.creditLimit,
    type: account.type,
    createdAt: new Date().toISOString(),
  };

  // Se Supabase estiver ativo, salva na tabela de convites
  if (supabase && isSupabaseConfigured()) {
    const { error } = await supabase.from('card_invites').upsert({
      code: invite.code,
      account_id: invite.accountId,
      account_name: invite.accountName,
      owner_id: invite.ownerId,
      owner_name: invite.ownerName,
      bank_id: invite.bankId,
      color: invite.color,
      credit_limit: invite.creditLimit,
      type: invite.type,
      created_at: invite.createdAt,
    });

    if (error) {
      // Loga o erro completo para diagnóstico
      console.error('[Supabase] Falha ao salvar convite na nuvem:', error.message, error.details, error.hint);
      throw new Error(
        `Não foi possível criar o convite na nuvem.\n\nCertifique-se de que:\n• Você está logado com Google\n• A tabela "card_invites" existe no Supabase\n\nDetalhes: ${error.message}`
      );
    }
  }

  // Salva no storage local como cache
  const raw = safeStorage.getItem(LOCAL_INVITES_KEY);
  const map: Record<string, SharedCardInvite> = raw ? JSON.parse(raw) : {};
  map[invite.code] = invite;
  safeStorage.setItem(LOCAL_INVITES_KEY, JSON.stringify(map));

  return invite;
};

/**
 * Busca os detalhes de um convite pelo código digitado
 */
export const fetchInviteByCode = async (code: string): Promise<SharedCardInvite | null> => {
  const cleanCode = code.toUpperCase().trim();

  // 1. Tenta no Supabase
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('card_invites')
        .select('*')
        .eq('code', cleanCode)
        .single();

      if (!error && data) {
        return {
          code: data.code,
          accountId: data.account_id,
          accountName: data.account_name,
          ownerId: data.owner_id,
          ownerName: data.owner_name,
          bankId: data.bank_id,
          color: data.color,
          creditLimit: data.credit_limit,
          type: data.type,
          createdAt: data.created_at,
        };
      }
    } catch (err) {
      console.warn('[Supabase] Erro ao buscar convite online:', err);
    }
  }

  // 2. Fallback no cache local
  const raw = safeStorage.getItem(LOCAL_INVITES_KEY);
  if (raw) {
    try {
      const map: Record<string, SharedCardInvite> = JSON.parse(raw);
      if (map[cleanCode]) {
        return map[cleanCode];
      }
    } catch {
      // ignore
    }
  }

  return null;
};

/**
 * Publica uma transação em tempo real para o canal do cartão compartilhado
 */
export const broadcastSharedTransaction = async (
  accountId: string,
  transaction: Transaction,
  action: 'insert' | 'update' | 'delete'
): Promise<void> => {
  if (supabase && isSupabaseConfigured()) {
    try {
      const channel = supabase.channel(`card-sync:${accountId}`);
      await channel.send({
        type: 'broadcast',
        event: 'transaction_event',
        payload: {
          action,
          transaction,
          accountId,
          timestamp: new Date().toISOString(),
        },
      });

      // Se existir a tabela shared_transactions, persiste
      if (action === 'delete') {
        await supabase.from('shared_transactions').delete().eq('id', transaction.id);
      } else {
        await supabase.from('shared_transactions').upsert({
          id: transaction.id,
          account_id: transaction.accountId,
          category_id: transaction.categoryId,
          amount: transaction.amount,
          type: transaction.type,
          description: transaction.description,
          date: transaction.date,
          status: transaction.status,
          payment_method: transaction.paymentMethod,
          created_by_id: transaction.createdById,
          created_by_name: transaction.createdByName,
          is_shared: true,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('[Supabase] Erro no broadcast realtime:', err);
    }
  }

  // Dispara evento local para abas do mesmo navegador (BroadcastChannel)
  try {
    const bc = new BroadcastChannel(`sobra_card_${accountId}`);
    bc.postMessage({
      action,
      transaction,
      accountId,
      timestamp: new Date().toISOString(),
    });
    bc.close();
  } catch (e) {
    // BroadcastChannel não suportado em alguns contextos
  }
};

/**
 * Escuta transações em tempo real para uma lista de contas compartilhadas
 */
export const subscribeToSharedCards = (
  sharedAccountIds: string[],
  onTransactionEvent: (event: { action: 'insert' | 'update' | 'delete'; transaction: Transaction }) => void
): (() => void) => {
  if (sharedAccountIds.length === 0) return () => {};

  const cleanups: Array<() => void> = [];

  sharedAccountIds.forEach(accId => {
    // 1. Supabase Realtime Channel
    if (supabase && isSupabaseConfigured()) {
      const channel = supabase.channel(`card-sync:${accId}`)
        .on('broadcast', { event: 'transaction_event' }, payload => {
          if (payload.payload) {
            onTransactionEvent(payload.payload);
          }
        })
        .subscribe();

      cleanups.push(() => {
        supabase?.removeChannel(channel);
      });
    }

    // 2. BroadcastChannel para comunicação local entre abas
    try {
      const bc = new BroadcastChannel(`sobra_card_${accId}`);
      bc.onmessage = (msg) => {
        if (msg.data && msg.data.transaction) {
          onTransactionEvent(msg.data);
        }
      };
      cleanups.push(() => bc.close());
    } catch (e) {
      // ignore
    }
  });

  return () => {
    cleanups.forEach(fn => fn());
  };
};
