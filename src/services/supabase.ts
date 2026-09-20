import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserProfile, SharedCardInvite, Transaction, Account } from '../core/types';

// Constantes de fallback padrão da infraestrutura Sobra
const DEFAULT_SUPABASE_URL = 'https://hhmzbjeaixodhkymavnm.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_l1-liOByIX2j0vKsqnga_A_sbZXA02t';

// Carrega as variáveis de ambiente Vite com fallback resiliente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

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
export const isCapacitorNative = (): boolean => {
  return (
    typeof (window as any).Capacitor !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.() === true
  );
};

// URL padrão para retorno de OAuth no aplicativo Android nativo
export const NATIVE_OAUTH_REDIRECT = 'com.sobra.finance://login-callback';

/**
 * Autenticação via Google
 * No ambiente Capacitor (Android/iOS), abre o browser nativo apontando para o retorno com.sobra.finance://login-callback.
 */
export const signInWithGoogle = async (): Promise<UserProfile> => {
  if (supabase && isSupabaseConfigured()) {
    const redirectUrl = isCapacitorNative()
      ? NATIVE_OAUTH_REDIRECT
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
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({ url: data.url, windowName: '_self' });
        } catch (browserErr) {
          console.error('[Capacitor] Erro ao abrir browser OAuth:', browserErr);
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
 * Processa a URL de retorno recebida via Deep Link (ex: com.sobra.finance://login-callback)
 * Suporta fluxo PKCE (?code=...) e fluxo com Hash (#access_token=...)
 */
export const handleAuthDeepLink = async (url: string): Promise<UserProfile | null> => {
  if (!supabase || !url) return null;

  // Fecha o browser nativo do Capacitor assim que recebermos o retorno
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close();
  } catch {}

  try {
    // 1. Caso PKCE (?code=...)
    if (url.includes('code=')) {
      let code: string | null = null;
      try {
        const parsed = new URL(url);
        code = parsed.searchParams.get('code');
      } catch {
        const match = url.match(/[?&]code=([^&#]+)/);
        if (match) code = decodeURIComponent(match[1]);
      }

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('[Supabase] Erro ao trocar código por sessão:', error.message);
          throw error;
        }
        if (data?.session?.user) {
          const u = data.session.user;
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
      }
    }

    // 2. Caso Hash (#access_token=...&refresh_token=...)
    if (url.includes('access_token=') && url.includes('refresh_token=')) {
      const hashPart = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
      const params = new URLSearchParams(hashPart);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) {
          console.error('[Supabase] Erro ao salvar sessão de hash:', error.message);
          throw error;
        }
        if (data?.session?.user) {
          const u = data.session.user;
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
      }
    }

    // 3. Caso contenha erro
    if (url.includes('error=')) {
      const match = url.match(/[?&#]error_description=([^&#]+)/) || url.match(/[?&#]error=([^&#]+)/);
      const errorMsg = match ? decodeURIComponent(match[1]) : 'Erro na autenticação';
      console.error('[Supabase] Retorno com erro OAuth:', errorMsg);
      throw new Error(errorMsg);
    }
  } catch (err) {
    console.error('[Supabase] Falha ao processar deep link de auth:', err);
    throw err;
  }

  return null;
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
  const localRaw = safeStorage.getItem(LOCAL_AUTH_USER_KEY);
  let localProfile: Partial<UserProfile> | null = null;
  if (localRaw) {
    try {
      localProfile = JSON.parse(localRaw);
    } catch {}
  }

  if (supabase && isSupabaseConfigured()) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const user = session.user;
      return {
        id: user.id,
        email: user.email || '',
        displayName:
          localProfile?.displayName ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Usuário',
        avatarUrl:
          localProfile?.avatarUrl !== undefined
            ? localProfile.avatarUrl
            : (user.user_metadata?.avatar_url || user.user_metadata?.picture),
      };
    }
  }

  if (localProfile && localProfile.id) {
    return localProfile as UserProfile;
  }
  return null;
};

/**
 * Atualiza o perfil do usuário (nome e/ou foto)
 */
export const updateCurrentUserProfile = async (
  updates: { displayName?: string; avatarUrl?: string }
): Promise<UserProfile> => {
  let current = await getCurrentUserProfile();

  if (!current) {
    current = {
      id: `usr_${Date.now().toString(36)}`,
      email: '',
      displayName: updates.displayName?.trim() || 'Usuário',
      avatarUrl: updates.avatarUrl,
    };
  } else {
    current = {
      ...current,
      ...(updates.displayName !== undefined ? { displayName: updates.displayName.trim() || current.displayName } : {}),
      ...(updates.avatarUrl !== undefined ? { avatarUrl: updates.avatarUrl } : {}),
    };
  }

  // 1. Salva no storage local
  safeStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(current));

  // 2. Se houver sessão Supabase ativa, sincroniza metadados na nuvem
  if (supabase && isSupabaseConfigured()) {
    try {
      const userMetaUpdates: Record<string, any> = {};
      if (updates.displayName !== undefined) {
        userMetaUpdates.full_name = current.displayName;
        userMetaUpdates.name = current.displayName;
      }
      if (updates.avatarUrl !== undefined) {
        userMetaUpdates.avatar_url = current.avatarUrl;
        userMetaUpdates.picture = current.avatarUrl;
      }
      await supabase.auth.updateUser({ data: userMetaUpdates });

      // Atualiza também na tabela public.profiles caso exista
      await supabase.from('profiles').update({
        display_name: current.displayName,
        avatar_url: current.avatarUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', current.id);
    } catch (e) {
      console.warn('[Supabase] Aviso ao sincronizar perfil na nuvem:', e);
    }
  }

  return current;
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
    try {
      // 1. Verifica se já existe para este código para decidir entre insert e update
      // Isso evita o erro de permissão RLS do PostgreSQL ao fazer ON CONFLICT DO UPDATE (upsert)
      const { data: existing } = await supabase
        .from('card_invites')
        .select('code, owner_id')
        .eq('code', invite.code)
        .maybeSingle();

      let writeError = null;
      if (existing) {
        const { error } = await supabase
          .from('card_invites')
          .update({
            account_name: invite.accountName,
            bank_id: invite.bankId,
            color: invite.color,
            credit_limit: invite.creditLimit,
            type: invite.type,
          })
          .eq('code', invite.code);
        writeError = error;
      } else {
        const { error } = await supabase.from('card_invites').insert({
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
        writeError = error;
      }

      if (writeError) {
        console.error('[Supabase] Falha ao salvar convite na nuvem:', writeError.message, writeError.details, writeError.hint);
        console.warn('Convite salvo no cache local como contingência.');
      }
    } catch (netErr: any) {
      console.warn('[Supabase] Falha ao conectar ao Supabase para convite:', netErr);
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
 * Busca histórico de transações existentes de um cartão compartilhado
 */
export const fetchSharedTransactions = async (accountId: string): Promise<Transaction[]> => {
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('shared_transactions')
        .select('*')
        .eq('account_id', accountId);

      if (!error && data) {
        return data.map((row: any) => ({
          id: row.id,
          accountId: row.account_id,
          categoryId: row.category_id,
          amount: Number(row.amount) || 0,
          type: row.type,
          description: row.description,
          date: row.date,
          status: row.status || 'confirmed',
          paymentMethod: row.payment_method || 'credit',
          source: (row.source as any) || 'manual',
          createdById: row.created_by_id,
          createdByName: row.created_by_name,
          isShared: true,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
      }
    } catch (err) {
      console.warn('[Supabase] Erro ao buscar transações compartilhadas:', err);
    }
  }
  return [];
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

/**
 * Informações sobre o backup na nuvem
 */
export interface CloudBackupInfo {
  userId: string;
  accountsCount: number;
  transactionsCount: number;
  updatedAt: string;
  data?: any;
}

const LOCAL_LAST_BACKUP_KEY = 'sobra_last_cloud_backup_meta_v1';

/**
 * Salva o backup geral de dados na nuvem (Supabase)
 */
export const uploadCloudBackup = async (userId: string, fullData: any): Promise<CloudBackupInfo> => {
  const accountsCount = fullData?.accounts?.length || 0;
  const transactionsCount = fullData?.transactions?.length || 0;
  const updatedAt = new Date().toISOString();

  const backupMeta: CloudBackupInfo = {
    userId,
    accountsCount,
    transactionsCount,
    updatedAt,
  };

  if (supabase && isSupabaseConfigured()) {
    try {
      // 1. Tenta salvar na tabela user_cloud_backups
      const { error } = await supabase
        .from('user_cloud_backups')
        .upsert({
          user_id: userId,
          data: fullData,
          accounts_count: accountsCount,
          transactions_count: transactionsCount,
          updated_at: updatedAt,
        });

      if (error) {
        console.warn('[Supabase] Erro ao salvar na tabela user_cloud_backups:', error.message);
        if (error.code === 'PGRST205' || error.message.includes('not find')) {
          throw new Error('TABLE_NOT_FOUND');
        }
        throw new Error(error.message);
      }
    } catch (err: any) {
      if (err.message === 'TABLE_NOT_FOUND') {
        throw err;
      }
      throw new Error(`Falha de conexão com a nuvem: ${err.message || 'Erro desconhecido'}`);
    }
  }

  // Armazena metadados do último backup localmente para consulta rápida
  safeStorage.setItem(LOCAL_LAST_BACKUP_KEY, JSON.stringify(backupMeta));
  return backupMeta;
};

/**
 * Busca o último backup salvo na nuvem
 */
export const fetchCloudBackup = async (userId: string): Promise<CloudBackupInfo | null> => {
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('user_cloud_backups')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        const info: CloudBackupInfo = {
          userId: data.user_id,
          accountsCount: data.accounts_count || (data.data?.accounts?.length || 0),
          transactionsCount: data.transactions_count || (data.data?.transactions?.length || 0),
          updatedAt: data.updated_at,
          data: data.data,
        };
        safeStorage.setItem(LOCAL_LAST_BACKUP_KEY, JSON.stringify(info));
        return info;
      }
    } catch (e) {
      console.warn('[Supabase] Erro ao buscar backup na nuvem:', e);
    }
  }

  // Fallback nos metadados salvos localmente
  const localMeta = safeStorage.getItem(LOCAL_LAST_BACKUP_KEY);
  if (localMeta) {
    try {
      return JSON.parse(localMeta);
    } catch {}
  }

  return null;
};
