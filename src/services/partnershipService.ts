import { PartnershipSpace, UserProfile, Account, SharedMember } from '../core/types';
import { 
  safeStorage, 
  generateInviteCode, 
  supabase, 
  isSupabaseConfigured,
  registerSharedAccountMember,
  broadcastPartnershipEvent,
  fetchSharedAccountMembers
} from './supabase';

const LOCAL_PARTNERSHIP_KEY = 'sobra_partnership_space_v1';

export type JoinedPartnershipSpace = PartnershipSpace & {
  accountToImport?: Omit<Account, 'id' | 'createdAt' | 'updatedAt'> & { id: string };
};

/**
 * Obtém o espaço de parceria salvo localmente ou deduz de contas compartilhadas existentes.
 */
export const getLocalPartnershipSpace = (accounts?: Account[]): PartnershipSpace | null => {
  try {
    const raw = safeStorage.getItem(LOCAL_PARTNERSHIP_KEY);
    if (raw) {
      const parsed: PartnershipSpace = JSON.parse(raw);
      if (parsed && parsed.isActive) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[PartnershipService] Erro ao ler espaço de parceria local:', err);
  }

  // Compatibilidade com contas compartilhadas pré-existentes:
  // Se o usuário já possui um cartão compartilhado, ativa o Finanças a Dois automaticamente!
  if (accounts && accounts.length > 0) {
    const sharedAccount = accounts.find(a => a.isShared);
    if (sharedAccount) {
      const fallbackOwner = sharedAccount.sharedMembers?.find(m => m.userId === sharedAccount.ownerId);
      const fallbackPartner = sharedAccount.sharedMembers?.find(m => m.userId !== sharedAccount.ownerId);
      const autoSpace: PartnershipSpace = {
        id: `space-${sharedAccount.id}`,
        code: sharedAccount.inviteCode || generateInviteCode(),
        isActive: true,
        createdAt: sharedAccount.createdAt || new Date().toISOString(),
        ownerId: sharedAccount.ownerId || 'current-user',
        ownerName: sharedAccount.ownerName || 'Você',
        ownerAvatarUrl: fallbackOwner?.avatarUrl,
        partnerId: fallbackPartner?.userId,
        partnerName: fallbackPartner?.displayName,
        partnerEmail: fallbackPartner?.email,
        partnerAvatarUrl: fallbackPartner?.avatarUrl,
        joinedAt: fallbackPartner?.joinedAt,
      };
      // Salva no storage para estabilizar
      saveLocalPartnershipSpace(autoSpace);
      return autoSpace;
    }
  }

  return null;
};

/**
 * Salva o espaço de parceria localmente
 */
export const saveLocalPartnershipSpace = (space: PartnershipSpace): void => {
  try {
    safeStorage.setItem(LOCAL_PARTNERSHIP_KEY, JSON.stringify(space));
  } catch (err) {
    console.warn('[PartnershipService] Erro ao salvar espaço de parceria:', err);
  }
};

/**
 * Ativa o espaço "Finanças a Dois" para o usuário atual
 */
export const activatePartnershipSpace = async (
  currentUser: UserProfile,
  existingCode?: string
): Promise<PartnershipSpace> => {
  const code = existingCode || generateInviteCode();
  const spaceId = `space-${currentUser.id}-${Date.now().toString(36)}`;

  const newSpace: PartnershipSpace = {
    id: spaceId,
    code,
    isActive: true,
    createdAt: new Date().toISOString(),
    ownerId: currentUser.id,
    ownerName: currentUser.displayName,
    ownerAvatarUrl: currentUser.avatarUrl,
  };

  // Salva no storage local
  saveLocalPartnershipSpace(newSpace);

  // Se Supabase estiver ativo, podemos registrar na nuvem
  if (supabase && isSupabaseConfigured()) {
    try {
      await supabase.from('card_invites').upsert({
        code: newSpace.code,
        account_id: newSpace.id,
        account_name: 'Espaço Finanças a Dois',
        owner_id: newSpace.ownerId,
        owner_name: newSpace.ownerName,
        created_at: newSpace.createdAt,
      }, { onConflict: 'code' });

      // Registra o titular na tabela de membros do espaço
      await registerSharedAccountMember(`space-${newSpace.code}`, {
        userId: currentUser.id,
        displayName: currentUser.displayName,
        email: currentUser.email,
        avatarUrl: currentUser.avatarUrl,
        role: 'owner',
        joinedAt: newSpace.createdAt,
      });
    } catch (err) {
      console.warn('[PartnershipService] Aviso ao sincronizar com Supabase:', err);
    }
  }

  return newSpace;
};

/**
 * Conecta com o parceiro através de um código de convite e descobre o cartão compartilhado
 */
export const joinPartnershipSpaceWithCode = async (
  code: string,
  currentUser: UserProfile
): Promise<JoinedPartnershipSpace> => {
  const cleanCode = code.trim().toUpperCase();

  let remoteOwnerId = 'owner-remote';
  let remoteOwnerName = 'Parceiro(a)';
  let remoteOwnerAvatarUrl: string | undefined = undefined;
  let remoteAccountId = `space-${cleanCode}`;
  let remoteAccountName = 'Espaço Finanças a Dois';
  let remoteCreatedAt = new Date().toISOString();
  let accountToImport: (Omit<Account, 'id' | 'createdAt' | 'updatedAt'> & { id: string }) | undefined = undefined;

  // 1. Consulta o convite no Supabase
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data } = await supabase
        .from('card_invites')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle();

      if (data) {
        remoteOwnerId = data.owner_id;
        remoteOwnerName = data.owner_name || 'Parceiro(a)';
        remoteAccountId = data.account_id;
        remoteAccountName = data.account_name || 'Cartão Compartilhado';
        remoteCreatedAt = data.created_at || remoteCreatedAt;

        // Se o convite for de um cartão real (não apenas o espaço vazio inicial)
        const isRealCard = data.account_id && !data.account_id.startsWith('space-');
        if (isRealCard) {
          const membersList: SharedMember[] = [
            {
              userId: data.owner_id,
              displayName: data.owner_name,
              email: '',
              role: 'owner',
              joinedAt: data.created_at,
            },
            {
              userId: currentUser.id,
              displayName: currentUser.displayName,
              email: currentUser.email,
              avatarUrl: currentUser.avatarUrl,
              role: 'member',
              joinedAt: new Date().toISOString(),
            },
          ];

          accountToImport = {
            id: data.account_id,
            name: data.account_name || 'Cartão Compartilhado',
            type: data.type || 'credit_card',
            balance: 0,
            creditLimit: data.credit_limit !== null && data.credit_limit !== undefined ? Number(data.credit_limit) : undefined,
            color: data.color || '#820AD1',
            icon: 'CreditCard',
            currency: 'BRL',
            bankId: data.bank_id || 'nubank',
            syncStatus: 'synced',
            isShared: true,
            ownerId: data.owner_id,
            ownerName: data.owner_name,
            inviteCode: cleanCode,
            sharedMembers: membersList,
          };
        }

        // Tenta buscar o avatar do titular no Supabase Profiles
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', data.owner_id)
            .maybeSingle();
          if (profile?.avatar_url) {
            remoteOwnerAvatarUrl = profile.avatar_url;
          }
        } catch {}
      }
    } catch (err) {
      console.warn('[PartnershipService] Erro ao consultar convite remoto:', err);
    }
  }

  // 2. Registra o parceiro no Supabase
  const newMember: SharedMember = {
    userId: currentUser.id,
    displayName: currentUser.displayName,
    email: currentUser.email,
    avatarUrl: currentUser.avatarUrl,
    role: 'member',
    joinedAt: new Date().toISOString(),
  };

  try {
    // Registra tanto no ID do cartão quanto no ID virtual do espaço
    if (remoteAccountId) {
      await registerSharedAccountMember(remoteAccountId, newMember);
    }
    await registerSharedAccountMember(`space-${cleanCode}`, newMember);
  } catch (regErr) {
    console.warn('[PartnershipService] Aviso ao registrar membro na nuvem:', regErr);
  }

  // 3. Monta o objeto do Espaço Finanças a Dois
  const space: JoinedPartnershipSpace = {
    id: `space-${cleanCode}`,
    code: cleanCode,
    isActive: true,
    createdAt: remoteCreatedAt,
    ownerId: remoteOwnerId,
    ownerName: remoteOwnerName,
    ownerAvatarUrl: remoteOwnerAvatarUrl,
    partnerId: currentUser.id,
    partnerName: currentUser.displayName,
    partnerEmail: currentUser.email,
    partnerAvatarUrl: currentUser.avatarUrl,
    joinedAt: new Date().toISOString(),
    accountToImport,
  };

  // Salva no storage local
  saveLocalPartnershipSpace(space);

  // 4. Notifica o titular em tempo real pelo canal da parceria
  try {
    await broadcastPartnershipEvent(cleanCode, 'partner_joined', {
      spaceCode: cleanCode,
      partner: {
        userId: currentUser.id,
        displayName: currentUser.displayName,
        email: currentUser.email,
        avatarUrl: currentUser.avatarUrl,
        joinedAt: space.joinedAt,
      },
    });
  } catch (broadErr) {
    console.warn('[PartnershipService] Falha ao enviar broadcast de parceiro conectado:', broadErr);
  }

  return space;
};

/**
 * Atualiza campos ou configurações do espaço de parceria
 */
export const updatePartnershipSpace = (updates: Partial<PartnershipSpace>): PartnershipSpace | null => {
  const current = getLocalPartnershipSpace();
  if (!current) return null;
  const updated: PartnershipSpace = { ...current, ...updates };
  saveLocalPartnershipSpace(updated);
  return updated;
};

/**
 * Desconecta ou desativa o espaço de parceria
 */
export const deactivatePartnershipSpace = (spaceCode?: string, userId?: string): void => {
  const current = getLocalPartnershipSpace();
  const codeToNotify = spaceCode || current?.code;
  const userToNotify = userId || current?.partnerId;

  if (codeToNotify) {
    try {
      broadcastPartnershipEvent(codeToNotify, 'partner_left', {
        spaceCode: codeToNotify,
        userId: userToNotify,
      });
    } catch {}
  }

  try {
    safeStorage.removeItem(LOCAL_PARTNERSHIP_KEY);
  } catch (err) {
    console.warn('[PartnershipService] Erro ao desativar espaço de parceria:', err);
  }
};

