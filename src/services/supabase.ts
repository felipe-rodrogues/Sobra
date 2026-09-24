import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserProfile, SharedCardInvite, Transaction, Account, SharedMember } from '../core/types';

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
        // Envia apenas se for URL externa HTTP/HTTPS.
        // Se for imagem em base64 (data:image/...), mantém no storage local para não inchar o JWT e evitar erro HTTP 431
        if (!current.avatarUrl?.startsWith('data:')) {
          userMetaUpdates.avatar_url = current.avatarUrl;
          userMetaUpdates.picture = current.avatarUrl;
        }
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
    creditLimit: account.creditLimit !== undefined && account.creditLimit !== null ? Number(account.creditLimit) : undefined,
    type: account.type,
    createdAt: new Date().toISOString(),
  };

  // Se Supabase estiver ativo, salva na tabela de convites
  if (supabase && isSupabaseConfigured()) {
    try {
      // 1. Verifica se já existe para este código para decidir entre insert e update
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
            account_id: invite.accountId,
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

      // Registra também o titular como membro 'owner' na tabela shared_account_members
      await registerSharedAccountMember(invite.accountId, {
        userId: currentUser.id,
        displayName: currentUser.displayName,
        email: currentUser.email,
        avatarUrl: currentUser.avatarUrl,
        role: 'owner',
        joinedAt: invite.createdAt,
      });
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
 * Atualiza os dados de um convite existente no Supabase (ex: nome, limite, banco)
 */
export const updateCardInvite = async (
  code: string,
  updates: Partial<SharedCardInvite>
): Promise<void> => {
  if (!code) return;
  const cleanCode = code.toUpperCase().trim();

  if (supabase && isSupabaseConfigured()) {
    try {
      const payload: Record<string, any> = {};
      if (updates.accountName !== undefined) payload.account_name = updates.accountName;
      if (updates.bankId !== undefined) payload.bank_id = updates.bankId;
      if (updates.color !== undefined) payload.color = updates.color;
      if (updates.creditLimit !== undefined) payload.credit_limit = updates.creditLimit ? Number(updates.creditLimit) : null;
      if (updates.type !== undefined) payload.type = updates.type;
      if (updates.accountId !== undefined) payload.account_id = updates.accountId;

      if (Object.keys(payload).length > 0) {
        await supabase
          .from('card_invites')
          .update(payload)
          .eq('code', cleanCode);
      }
    } catch (e) {
      console.warn('[Supabase] Erro ao atualizar dados do convite na nuvem:', e);
    }
  }

  // Atualiza também o cache local
  try {
    const raw = safeStorage.getItem(LOCAL_INVITES_KEY);
    if (raw) {
      const map: Record<string, SharedCardInvite> = JSON.parse(raw);
      if (map[cleanCode]) {
        map[cleanCode] = { ...map[cleanCode], ...updates };
        safeStorage.setItem(LOCAL_INVITES_KEY, JSON.stringify(map));
      }
    }
  } catch {}
};

/**
 * Registra um membro vinculado ao cartão compartilhado no Supabase
 */
export const registerSharedAccountMember = async (
  accountId: string,
  member: SharedMember
): Promise<void> => {
  if (!accountId || !member.userId) return;

  if (supabase && isSupabaseConfigured()) {
    try {
      // 1. Tenta upsert na tabela shared_account_members
      const { error } = await supabase
        .from('shared_account_members')
        .upsert({
          account_id: accountId,
          user_id: member.userId,
          display_name: member.displayName || 'Parceiro(a)',
          email: member.email || '',
          role: member.role || 'member',
          joined_at: member.joinedAt || new Date().toISOString(),
        }, { onConflict: 'account_id,user_id' });

      if (error) {
        console.warn('[Supabase] Erro ao registrar membro da conta compartilhada:', error.message);
      }

      // 2. Dispara notificação Realtime para os participantes conectados
      try {
        const pubChannel = supabase.channel(`pub-mem-${Math.random().toString(36).slice(2, 8)}:${accountId}`);
        pubChannel.subscribe(status => {
          if (status === 'SUBSCRIBED') {
            pubChannel.send({
              type: 'broadcast',
              event: 'member_joined',
              payload: {
                accountId,
                member,
                timestamp: new Date().toISOString(),
              },
            }).finally(() => {
              setTimeout(() => {
                try { supabase?.removeChannel(pubChannel); } catch {}
              }, 1500);
            });
          }
        });
      } catch {}
    } catch (err) {
      console.warn('[Supabase] Falha ao registrar membro compartilhado:', err);
    }
  }

  // Emite evento local via BroadcastChannel
  try {
    const bc = new BroadcastChannel(`sobra_card_${accountId}`);
    bc.postMessage({
      event: 'member_joined',
      accountId,
      member,
    });
    bc.close();
  } catch {}
};

/**
 * Busca todos os membros vinculados a um cartão compartilhado no Supabase
 */
export const fetchSharedAccountMembers = async (accountId: string): Promise<SharedMember[]> => {
  if (!accountId) return [];

  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('shared_account_members')
        .select('*')
        .eq('account_id', accountId)
        .order('joined_at', { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((row: any) => ({
          userId: row.user_id,
          displayName: row.display_name,
          email: row.email || '',
          role: row.role as 'owner' | 'member',
          joinedAt: row.joined_at,
        }));
      }
    } catch (e) {
      console.warn('[Supabase] Erro ao buscar membros compartilhados:', e);
    }
  }

  return [];
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
          creditLimit: data.credit_limit !== null && data.credit_limit !== undefined ? Number(data.credit_limit) : undefined,
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
 * Sincroniza em lote as transações locais de um cartão para a nuvem
 */
export const syncAccountTransactionsToCloud = async (
  accountId: string,
  transactions: Transaction[]
): Promise<void> => {
  if (!accountId || transactions.length === 0) return;
  if (supabase && isSupabaseConfigured()) {
    try {
      const cardTxs = transactions.filter(t => t.accountId === accountId);
      if (cardTxs.length === 0) return;

      const rows = cardTxs.map(t => ({
        id: t.id,
        account_id: t.accountId,
        category_id: t.categoryId,
        amount: t.amount,
        type: t.type,
        description: t.description,
        date: t.date,
        status: t.status || 'confirmed',
        payment_method: t.paymentMethod || 'credit',
        created_by_id: t.createdById,
        created_by_name: t.createdByName,
        is_shared: true,
        updated_at: new Date().toISOString(),
      }));

      // Upsert em lotes de 50
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        await supabase.from('shared_transactions').upsert(batch, { onConflict: 'id' });
      }
    } catch (err) {
      console.warn('[Supabase] Erro ao sincronizar lote de transações compartilhadas:', err);
    }
  }
};

/**
 * Remove em lote uma lista de IDs de transações compartilhadas da nuvem
 */
export const deleteSharedTransactionsBatchFromCloud = async (
  accountId: string,
  transactionIds: string[]
): Promise<void> => {
  if (!accountId || transactionIds.length === 0) return;
  if (supabase && isSupabaseConfigured()) {
    try {
      for (let i = 0; i < transactionIds.length; i += 50) {
        const batch = transactionIds.slice(i, i + 50);
        await supabase
          .from('shared_transactions')
          .delete()
          .eq('account_id', accountId)
          .in('id', batch);
      }
    } catch (err) {
      console.warn('[Supabase] Erro ao deletar lote de transações compartilhadas:', err);
    }
  }
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
        .eq('account_id', accountId)
        .order('date', { ascending: false });

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

// Identificador único da sessão/aba do cliente para descartar autoechos de broadcast
export const CLIENT_SESSION_ID = Math.random().toString(36).substring(2, 10);

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
      // 1. Persiste na tabela shared_transactions
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
          payment_method_id: (transaction as any).paymentMethodId,
          created_by_id: transaction.createdById,
          created_by_name: transaction.createdByName,
          is_shared: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      }

      // 2. Envia broadcast no canal Realtime determinístico compartilhado
      try {
        const channelTopic = `shared-card:${accountId}`;
        let pubChannel = supabase.getChannels().find(ch => ch.topic === `realtime:${channelTopic}` || ch.topic === channelTopic);
        if (!pubChannel) {
          pubChannel = supabase.channel(channelTopic);
        }

        const sendMsg = () => {
          pubChannel?.send({
            type: 'broadcast',
            event: 'transaction_event',
            payload: {
              action,
              transaction,
              accountId,
              timestamp: new Date().toISOString(),
              senderSessionId: CLIENT_SESSION_ID,
            },
          });
        };

        if ((pubChannel as any).state === 'joined' || (pubChannel as any).state === 'joined_subscription') {
          sendMsg();
        } else {
          pubChannel.subscribe(status => {
            if (status === 'SUBSCRIBED') {
              sendMsg();
            }
          });
        }
      } catch (realtimeErr) {
        console.warn('[Supabase] Erro ao emitir broadcast Realtime:', realtimeErr);
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
      senderSessionId: CLIENT_SESSION_ID,
    });
    setTimeout(() => {
      try { bc.close(); } catch {}
    }, 1000);
  } catch (e) {
    // BroadcastChannel não suportado em alguns contextos
  }
};

/**
 * Escuta transações, membros e eventos de exclusão em tempo real para uma lista de contas compartilhadas
 */
export const subscribeToSharedCards = (
  sharedAccountIds: string[],
  onTransactionEvent: (event: { action: 'insert' | 'update' | 'delete' | 'batch_refresh'; transaction?: Transaction; accountId?: string }) => void,
  onMemberEvent?: (event: { accountId: string; member: SharedMember }) => void,
  onCardDeleted?: (accountId: string) => void,
  onMemberLeft?: (event: { accountId: string; userId: string }) => void
): (() => void) => {
  if (sharedAccountIds.length === 0) return () => {};

  const cleanups: Array<() => void> = [];

  sharedAccountIds.forEach(accId => {
    // 1. Supabase Realtime Channel determinístico por conta compartilhada
    if (supabase && isSupabaseConfigured()) {
      const channelTopic = `shared-card:${accId}`;
      const channel = supabase.channel(channelTopic)
        .on('broadcast', { event: 'transaction_event' }, payload => {
          if (payload.payload) {
            // Descarta autoecho gerado pela própria aba
            if (payload.payload.senderSessionId === CLIENT_SESSION_ID) return;
            onTransactionEvent(payload.payload);
          }
        })
        .on('broadcast', { event: 'member_joined' }, payload => {
          if (payload.payload && onMemberEvent) {
            if (payload.payload.senderSessionId === CLIENT_SESSION_ID) return;
            onMemberEvent(payload.payload);
          }
        })
        .on('broadcast', { event: 'card_deleted' }, payload => {
          if (payload.payload && onCardDeleted) {
            if (payload.payload.senderSessionId === CLIENT_SESSION_ID) return;
            onCardDeleted(payload.payload.accountId || accId);
          }
        })
        .on('broadcast', { event: 'member_left' }, payload => {
          if (payload.payload && onMemberLeft) {
            if (payload.payload.senderSessionId === CLIENT_SESSION_ID) return;
            onMemberLeft({ accountId: payload.payload.accountId || accId, userId: payload.payload.userId });
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'shared_transactions',
            filter: `account_id=eq.${accId}`,
          },
          (payload: any) => {
            if (payload.eventType === 'DELETE' && payload.old) {
              onTransactionEvent({ action: 'delete', transaction: { id: payload.old.id, accountId: accId } as any });
            } else if (payload.new) {
              const row = payload.new;
              onTransactionEvent({
                action: payload.eventType === 'INSERT' ? 'insert' : 'update',
                transaction: {
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
                },
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'shared_account_members',
            filter: `account_id=eq.${accId}`,
          },
          (payload: any) => {
            if (payload.eventType === 'DELETE' && payload.old && onMemberLeft) {
              onMemberLeft({ accountId: accId, userId: payload.old.user_id });
            } else if (payload.new && onMemberEvent) {
              onMemberEvent({
                accountId: accId,
                member: {
                  userId: payload.new.user_id,
                  displayName: payload.new.display_name,
                  email: payload.new.email || '',
                  role: payload.new.role || 'member',
                  joinedAt: payload.new.joined_at,
                },
              });
            }
          }
        )
        .subscribe();

      cleanups.push(() => {
        supabase?.removeChannel(channel);
      });
    }

    // 2. BroadcastChannel para comunicação local entre abas
    try {
      const bc = new BroadcastChannel(`sobra_card_${accId}`);
      bc.onmessage = (msg) => {
        if (msg.data) {
          // Descarta autoecho gerado pela própria aba
          if (msg.data.senderSessionId === CLIENT_SESSION_ID) return;
          if (msg.data.transaction) {
            onTransactionEvent(msg.data);
          } else if (msg.data.event === 'member_joined' && onMemberEvent) {
            onMemberEvent(msg.data);
          } else if (msg.data.event === 'card_deleted' && onCardDeleted) {
            onCardDeleted(msg.data.accountId || accId);
          } else if (msg.data.event === 'member_left' && onMemberLeft) {
            onMemberLeft({ accountId: msg.data.accountId || accId, userId: msg.data.userId });
          }
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
 * Publica eventos no canal do espaço Finanças a Dois
 */
export const broadcastPartnershipEvent = async (
  spaceCode: string,
  event: 'partner_joined' | 'partner_left' | 'card_added' | 'card_deleted' | 'card_updated',
  payload: any
): Promise<void> => {
  if (!spaceCode) return;
  const cleanCode = spaceCode.trim().toUpperCase();

  if (supabase && isSupabaseConfigured()) {
    try {
      const channelTopic = `partnership-space:${cleanCode}`;
      let pubChannel = supabase.getChannels().find(ch => ch.topic === `realtime:${channelTopic}` || ch.topic === channelTopic);
      if (!pubChannel) {
        pubChannel = supabase.channel(channelTopic);
      }

      const sendMsg = () => {
        pubChannel?.send({
          type: 'broadcast',
          event: 'partnership_event',
          payload: {
            event,
            ...payload,
            timestamp: new Date().toISOString(),
            senderSessionId: CLIENT_SESSION_ID,
          },
        });
      };

      if ((pubChannel as any).state === 'joined' || (pubChannel as any).state === 'joined_subscription') {
        sendMsg();
      } else {
        pubChannel.subscribe(status => {
          if (status === 'SUBSCRIBED') {
            sendMsg();
          }
        });
      }
    } catch (realtimeErr) {
      console.warn('[Supabase] Erro ao emitir broadcast de parceria:', realtimeErr);
    }
  }

  // Local BroadcastChannel
  try {
    const bc = new BroadcastChannel(`sobra_partnership_${cleanCode}`);
    bc.postMessage({
      event,
      ...payload,
      timestamp: new Date().toISOString(),
      senderSessionId: CLIENT_SESSION_ID,
    });
    setTimeout(() => {
      try { bc.close(); } catch {}
    }, 1000);
  } catch {}
};

/**
 * Inscreve-se no canal em tempo real do espaço Finanças a Dois
 */
export const subscribeToPartnershipSpace = (
  spaceCode: string,
  onEvent: (event: { event: string; [key: string]: any }) => void
): (() => void) => {
  if (!spaceCode) return () => {};
  const cleanCode = spaceCode.trim().toUpperCase();
  const cleanups: Array<() => void> = [];

  if (supabase && isSupabaseConfigured()) {
    const channelTopic = `partnership-space:${cleanCode}`;
    const channel = supabase.channel(channelTopic)
      .on('broadcast', { event: 'partnership_event' }, payload => {
        if (payload.payload) {
          if (payload.payload.senderSessionId === CLIENT_SESSION_ID) return;
          onEvent(payload.payload);
        }
      })
      .subscribe();

    cleanups.push(() => {
      supabase?.removeChannel(channel);
    });
  }

  try {
    const bc = new BroadcastChannel(`sobra_partnership_${cleanCode}`);
    bc.onmessage = (msg) => {
      if (msg.data) {
        if (msg.data.senderSessionId === CLIENT_SESSION_ID) return;
        onEvent(msg.data);
      }
    };
    cleanups.push(() => bc.close());
  } catch {}

  return () => {
    cleanups.forEach(fn => fn());
  };
};

/**
 * Notifica a exclusão de um cartão compartilhado para todos os participantes
 */
export const broadcastSharedCardDelete = async (
  accountId: string,
  spaceCode?: string
): Promise<void> => {
  if (!accountId) return;

  if (supabase && isSupabaseConfigured()) {
    try {
      const channelTopic = `shared-card:${accountId}`;
      let ch = supabase.getChannels().find(c => c.topic === `realtime:${channelTopic}` || c.topic === channelTopic);
      if (!ch) ch = supabase.channel(channelTopic);

      const send = () => {
        ch?.send({
          type: 'broadcast',
          event: 'card_deleted',
          payload: {
            accountId,
            timestamp: new Date().toISOString(),
            senderSessionId: CLIENT_SESSION_ID,
          },
        });
      };

      if ((ch as any).state === 'joined' || (ch as any).state === 'joined_subscription') {
        send();
      } else {
        ch.subscribe(status => {
          if (status === 'SUBSCRIBED') send();
        });
      }
    } catch {}
  }

  if (spaceCode) {
    await broadcastPartnershipEvent(spaceCode, 'card_deleted', { accountId });
  }

  try {
    const bc = new BroadcastChannel(`sobra_card_${accountId}`);
    bc.postMessage({
      event: 'card_deleted',
      accountId,
      senderSessionId: CLIENT_SESSION_ID,
    });
    setTimeout(() => { try { bc.close(); } catch {} }, 1000);
  } catch {}
};

/**
 * Notifica que um membro deixou um cartão compartilhado
 */
export const broadcastSharedCardMemberLeft = async (
  accountId: string,
  userId: string,
  spaceCode?: string
): Promise<void> => {
  if (!accountId || !userId) return;

  if (supabase && isSupabaseConfigured()) {
    try {
      const channelTopic = `shared-card:${accountId}`;
      let ch = supabase.getChannels().find(c => c.topic === `realtime:${channelTopic}` || c.topic === channelTopic);
      if (!ch) ch = supabase.channel(channelTopic);

      const send = () => {
        ch?.send({
          type: 'broadcast',
          event: 'member_left',
          payload: {
            accountId,
            userId,
            timestamp: new Date().toISOString(),
            senderSessionId: CLIENT_SESSION_ID,
          },
        });
      };

      if ((ch as any).state === 'joined' || (ch as any).state === 'joined_subscription') {
        send();
      } else {
        ch.subscribe(status => {
          if (status === 'SUBSCRIBED') send();
        });
      }
    } catch {}
  }

  if (spaceCode) {
    await broadcastPartnershipEvent(spaceCode, 'partner_left', { userId, accountId });
  }

  try {
    const bc = new BroadcastChannel(`sobra_card_${accountId}`);
    bc.postMessage({
      event: 'member_left',
      accountId,
      userId,
      senderSessionId: CLIENT_SESSION_ID,
    });
    setTimeout(() => { try { bc.close(); } catch {} }, 1000);
  } catch {}
};

/**
 * Busca todas as contas compartilhadas das quais o usuário é membro na nuvem
 */
export const fetchUserSharedAccounts = async (userId: string): Promise<SharedCardInvite[]> => {
  if (!userId || !supabase || !isSupabaseConfigured()) return [];

  try {
    // 1. Busca os IDs de contas onde o usuário está registrado
    const { data: memberRows, error: memErr } = await supabase
      .from('shared_account_members')
      .select('account_id')
      .eq('user_id', userId);

    if (memErr || !memberRows || memberRows.length === 0) return [];

    const accountIds = Array.from(new Set(memberRows.map(r => r.account_id)));

    // 2. Busca os convites/detalhes dessas contas
    const { data: inviteRows, error: invErr } = await supabase
      .from('card_invites')
      .select('*')
      .in('account_id', accountIds);

    if (invErr || !inviteRows) return [];

    return inviteRows.map((data: any) => ({
      code: data.code,
      accountId: data.account_id,
      accountName: data.account_name,
      ownerId: data.owner_id,
      ownerName: data.owner_name,
      bankId: data.bank_id,
      color: data.color,
      creditLimit: data.credit_limit !== null && data.credit_limit !== undefined ? Number(data.credit_limit) : undefined,
      type: data.type,
      createdAt: data.created_at,
    }));
  } catch (err) {
    console.warn('[Supabase] Erro ao buscar contas compartilhadas do usuário:', err);
    return [];
  }
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
