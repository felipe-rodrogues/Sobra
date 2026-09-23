import { PartnershipSpace, UserProfile, Account } from '../core/types';
import { safeStorage, generateInviteCode, supabase, isSupabaseConfigured } from './supabase';

const LOCAL_PARTNERSHIP_KEY = 'sobra_partnership_space_v1';

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
    } catch (err) {
      console.warn('[PartnershipService] Aviso ao sincronizar com Supabase:', err);
    }
  }

  return newSpace;
};

/**
 * Conecta com o parceiro através de um código de convite
 */
export const joinPartnershipSpaceWithCode = async (
  code: string,
  currentUser: UserProfile
): Promise<PartnershipSpace> => {
  const cleanCode = code.trim().toUpperCase();

  // Verifica se temos no Supabase
  let remoteOwnerId = 'owner-remote';
  let remoteOwnerName = 'Parceiro(a)';

  if (supabase && isSupabaseConfigured()) {
    try {
      const { data } = await supabase
        .from('card_invites')
        .select('code, owner_id, owner_name, created_at')
        .eq('code', cleanCode)
        .maybeSingle();

      if (data) {
        remoteOwnerId = data.owner_id;
        remoteOwnerName = data.owner_name || 'Parceiro(a)';
      }
    } catch (err) {
      console.warn('[PartnershipService] Erro ao consultar convite remoto:', err);
    }
  }

  const space: PartnershipSpace = {
    id: `space-${cleanCode}`,
    code: cleanCode,
    isActive: true,
    createdAt: new Date().toISOString(),
    ownerId: remoteOwnerId,
    ownerName: remoteOwnerName,
    partnerId: currentUser.id,
    partnerName: currentUser.displayName,
    partnerEmail: currentUser.email,
    partnerAvatarUrl: currentUser.avatarUrl,
    joinedAt: new Date().toISOString(),
  };

  saveLocalPartnershipSpace(space);
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
export const deactivatePartnershipSpace = (): void => {
  try {
    safeStorage.removeItem(LOCAL_PARTNERSHIP_KEY);
  } catch (err) {
    console.warn('[PartnershipService] Erro ao desativar espaço de parceria:', err);
  }
};
