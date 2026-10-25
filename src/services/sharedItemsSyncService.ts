import { Goal, Budget, Subscription, GoalContribution, Account } from '../core/types';
import { supabase, isSupabaseConfigured, broadcastPartnershipEvent, fetchSharedTransactions } from './supabase';
import { db } from '../database/adapter';

export const GOAL_PREFIX = 'space-goal:';
export const BUDGET_PREFIX = 'space-budget:';
export const SUB_PREFIX = 'space-sub:';
export const CONTRIB_PREFIX = 'space-contrib:';
export const CARD_PREFIX = 'space-card:';
export const PROFILE_PREFIX = 'space-profile:';

export interface SharedSpaceProfile {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role?: 'owner' | 'member';
  updatedAt?: string;
}

/**
 * Salva ou atualiza os dados de perfil (nome e avatar) de um participante no espaço da parceria
 */
export const syncSharedProfileToCloud = async (
  spaceCode: string,
  profile: SharedSpaceProfile
): Promise<void> => {
  if (!spaceCode || !profile.userId || !supabase || !isSupabaseConfigured()) return;
  const cleanCode = spaceCode.trim().toUpperCase();

  try {
    await supabase.from('shared_transactions').upsert({
      id: `profile-${cleanCode}-${profile.userId}`,
      account_id: `${PROFILE_PREFIX}${cleanCode}`,
      category_id: 'profile',
      amount: 0,
      type: 'profile',
      description: JSON.stringify({
        userId: profile.userId,
        displayName: profile.displayName || 'Usuário',
        avatarUrl: profile.avatarUrl,
        role: profile.role || 'member',
        updatedAt: profile.updatedAt || new Date().toISOString(),
      }),
      date: new Date().toISOString(),
      status: 'active',
      created_by_id: profile.userId,
      created_by_name: profile.displayName || 'Usuário',
      is_shared: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[SharedItemsSync] Erro ao sincronizar perfil compartilhado na nuvem:', err);
  }
};

/**
 * Salva ou atualiza um Cartão de Crédito compartilhado na nuvem do Supabase
 */
export const syncSharedCardToCloud = async (spaceCode: string, card: Account): Promise<void> => {
  if (!spaceCode || !supabase || !isSupabaseConfigured()) return;
  const cleanCode = spaceCode.trim().toUpperCase();

  try {
    await supabase.from('shared_transactions').upsert({
      id: card.id,
      account_id: `${CARD_PREFIX}${cleanCode}`,
      category_id: card.bankId || 'credit_card',
      amount: card.creditLimit || 0,
      type: 'credit_card',
      description: JSON.stringify({
        ...card,
        isShared: true,
      }),
      date: card.createdAt || new Date().toISOString(),
      status: 'active',
      created_by_id: card.ownerId,
      created_by_name: card.ownerName,
      is_shared: true,
      created_at: card.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[SharedItemsSync] Erro ao sincronizar cartão compartilhado na nuvem:', err);
  }
};

/**
 * Exclui (marca como excluído) um Cartão de Crédito compartilhado na nuvem
 */
export const deleteSharedCardFromCloud = async (spaceCode: string, cardId: string): Promise<void> => {
  if (!spaceCode || !supabase || !isSupabaseConfigured()) return;
  const cleanCode = spaceCode.trim().toUpperCase();

  try {
    await supabase.from('shared_transactions').upsert({
      id: cardId,
      account_id: `${CARD_PREFIX}${cleanCode}`,
      category_id: null,
      amount: 0,
      type: 'credit_card',
      description: JSON.stringify({ id: cardId, isDeleted: true }),
      date: new Date().toISOString(),
      status: 'deleted',
      is_shared: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[SharedItemsSync] Erro ao remover cartão compartilhado na nuvem:', err);
  }
};

/**
 * Salva ou atualiza uma Meta compartilhada na nuvem do Supabase
 */
export const syncSharedGoalToCloud = async (spaceCode: string, goal: Goal): Promise<void> => {
  if (!spaceCode || !supabase || !isSupabaseConfigured()) return;
  const cleanCode = spaceCode.trim().toUpperCase();

  try {
    await supabase.from('shared_transactions').upsert({
      id: goal.id,
      account_id: `${GOAL_PREFIX}${cleanCode}`,
      category_id: goal.color || 'goal',
      amount: goal.targetAmount || 0,
      type: 'goal',
      description: JSON.stringify({
        ...goal,
        isShared: true,
      }),
      date: goal.targetDate || goal.createdAt || new Date().toISOString(),
      status: goal.isCompleted ? 'completed' : 'active',
      created_by_id: goal.ownerId,
      created_by_name: goal.ownerName,
      is_shared: true,
      created_at: goal.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[SharedItemsSync] Erro ao sincronizar meta na nuvem:', err);
  }
};

/**
 * Exclui (marca como excluída) uma Meta compartilhada na nuvem
 */
export const deleteSharedGoalFromCloud = async (spaceCode: string, goalId: string): Promise<void> => {
  if (!spaceCode || !supabase || !isSupabaseConfigured()) return;
  const cleanCode = spaceCode.trim().toUpperCase();

  try {
    await supabase.from('shared_transactions').upsert({
      id: goalId,
      account_id: `${GOAL_PREFIX}${cleanCode}`,
      category_id: null,
      amount: 0,
      type: 'goal',
      description: JSON.stringify({ id: goalId, isDeleted: true }),
      date: new Date().toISOString(),
      status: 'deleted',
      is_shared: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[SharedItemsSync] Erro ao remover meta na nuvem:', err);
  }
};

/**
 * Salva ou atualiza um Orçamento compartilhado na nuvem do Supabase
 */
export const syncSharedBudgetToCloud = async (spaceCode: string, budget: Budget): Promise<void> => {
  if (!spaceCode || !supabase || !isSupabaseConfigured()) return;
  const cleanCode = spaceCode.trim().toUpperCase();

  try {
    await supabase.from('shared_transactions').upsert({
      id: budget.id,
      account_id: `${BUDGET_PREFIX}${cleanCode}`,
      category_id: budget.categoryId,
      amount: budget.monthlyLimit || 0,
      type: 'budget',
      description: JSON.stringify({
        ...budget,
        isShared: true,
      }),
      date: `${budget.year}-${String(budget.month).padStart(2, '0')}-01`,
      status: 'active',
      created_by_id: budget.ownerId,
      created_by_name: budget.ownerName,
      is_shared: true,
      created_at: budget.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[SharedItemsSync] Erro ao sincronizar orçamento na nuvem:', err);
  }
};

/**
 * Exclui (marca como excluído) um Orçamento compartilhado na nuvem
 */
export const deleteSharedBudgetFromCloud = async (spaceCode: string, budgetId: string): Promise<void> => {
  if (!spaceCode || !supabase || !isSupabaseConfigured()) return;
  const cleanCode = spaceCode.trim().toUpperCase();

  try {
    await supabase.from('shared_transactions').upsert({
      id: budgetId,
      account_id: `${BUDGET_PREFIX}${cleanCode}`,
      category_id: null,
      amount: 0,
      type: 'budget',
      description: JSON.stringify({ id: budgetId, isDeleted: true }),
      date: new Date().toISOString(),
      status: 'deleted',
      is_shared: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[SharedItemsSync] Erro ao remover orçamento na nuvem:', err);
  }
};

/**
 * Salva ou atualiza uma Assinatura compartilhada na nuvem do Supabase
 */
export const syncSharedSubscriptionToCloud = async (spaceCode: string, sub: Subscription): Promise<void> => {
  if (!spaceCode || !supabase || !isSupabaseConfigured()) return;
  const cleanCode = spaceCode.trim().toUpperCase();

  try {
    await supabase.from('shared_transactions').upsert({
      id: sub.id,
      account_id: `${SUB_PREFIX}${cleanCode}`,
      category_id: sub.categoryId,
      amount: sub.amount || 0,
      type: 'subscription',
      description: JSON.stringify({
        ...sub,
        isShared: true,
      }),
      date: sub.nextBillingDate || new Date().toISOString(),
      status: sub.status || 'active',
      created_by_id: sub.ownerId,
      created_by_name: sub.ownerName,
      is_shared: true,
      created_at: sub.createdAt || new Date().toISOString(),
      updated_at: sub.updatedAt || new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[SharedItemsSync] Erro ao sincronizar assinatura na nuvem:', err);
  }
};

/**
 * Exclui (marca como excluída) uma Assinatura compartilhada na nuvem
 */
export const deleteSharedSubscriptionFromCloud = async (spaceCode: string, subId: string): Promise<void> => {
  if (!spaceCode || !supabase || !isSupabaseConfigured()) return;
  const cleanCode = spaceCode.trim().toUpperCase();

  try {
    await supabase.from('shared_transactions').upsert({
      id: subId,
      account_id: `${SUB_PREFIX}${cleanCode}`,
      category_id: null,
      amount: 0,
      type: 'subscription',
      description: JSON.stringify({ id: subId, isDeleted: true }),
      date: new Date().toISOString(),
      status: 'deleted',
      is_shared: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[SharedItemsSync] Erro ao remover assinatura na nuvem:', err);
  }
};

/**
 * Salva ou atualiza um Aporte de Meta compartilhada na nuvem
 */
export const syncSharedContributionToCloud = async (spaceCode: string, contrib: GoalContribution): Promise<void> => {
  if (!spaceCode || !supabase || !isSupabaseConfigured()) return;
  const cleanCode = spaceCode.trim().toUpperCase();

  try {
    await supabase.from('shared_transactions').upsert({
      id: contrib.id,
      account_id: `${CONTRIB_PREFIX}${cleanCode}`,
      category_id: contrib.goalId,
      amount: contrib.amount || 0,
      type: 'goal_contribution',
      description: JSON.stringify(contrib),
      date: contrib.date || new Date().toISOString(),
      status: 'active',
      created_by_id: contrib.contributedById,
      created_by_name: contrib.contributedByName,
      is_shared: true,
      created_at: contrib.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[SharedItemsSync] Erro ao sincronizar aporte na nuvem:', err);
  }
};

/**
 * Exclui (marca como excluído) um Aporte de Meta na nuvem
 */
export const deleteSharedContributionFromCloud = async (spaceCode: string, contribId: string): Promise<void> => {
  if (!spaceCode || !supabase || !isSupabaseConfigured()) return;
  const cleanCode = spaceCode.trim().toUpperCase();

  try {
    await supabase.from('shared_transactions').upsert({
      id: contribId,
      account_id: `${CONTRIB_PREFIX}${cleanCode}`,
      category_id: null,
      amount: 0,
      type: 'goal_contribution',
      description: JSON.stringify({ id: contribId, isDeleted: true }),
      date: new Date().toISOString(),
      status: 'deleted',
      is_shared: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[SharedItemsSync] Erro ao remover aporte na nuvem:', err);
  }
};

/**
 * Busca todas as entidades do espaço Finanças a Dois salvas na nuvem
 */
export const fetchSharedSpaceEntities = async (spaceCode: string): Promise<{
  goals: Goal[];
  budgets: Budget[];
  subscriptions: Subscription[];
  contributions: GoalContribution[];
  cards: Account[];
  profiles: SharedSpaceProfile[];
  deletedIds: Set<string>;
}> => {
  if (!spaceCode || !supabase || !isSupabaseConfigured()) {
    return { goals: [], budgets: [], subscriptions: [], contributions: [], cards: [], profiles: [], deletedIds: new Set() };
  }

  const cleanCode = spaceCode.trim().toUpperCase();
  const accountIds = [
    `${GOAL_PREFIX}${cleanCode}`,
    `${BUDGET_PREFIX}${cleanCode}`,
    `${SUB_PREFIX}${cleanCode}`,
    `${CONTRIB_PREFIX}${cleanCode}`,
    `${CARD_PREFIX}${cleanCode}`,
    `${PROFILE_PREFIX}${cleanCode}`,
  ];

  try {
    const { data, error } = await supabase
      .from('shared_transactions')
      .select('*')
      .in('account_id', accountIds);

    if (error || !data) {
      console.warn('[SharedItemsSync] Erro ao consultar itens da parceria no Supabase:', error);
      return { goals: [], budgets: [], subscriptions: [], contributions: [], cards: [], profiles: [], deletedIds: new Set() };
    }

    const goals: Goal[] = [];
    const budgets: Budget[] = [];
    const subscriptions: Subscription[] = [];
    const contributions: GoalContribution[] = [];
    const cards: Account[] = [];
    const profiles: SharedSpaceProfile[] = [];
    const deletedIds = new Set<string>();

    for (const row of data) {
      if (row.status === 'deleted') {
        deletedIds.add(row.id);
        continue;
      }

      try {
        const parsed = JSON.parse(row.description);
        if (row.type === 'credit_card' || row.account_id.startsWith(CARD_PREFIX)) {
          cards.push({
            ...parsed,
            id: row.id,
            isShared: true,
          });
        } else if (row.type === 'goal' || row.account_id.startsWith(GOAL_PREFIX)) {
          goals.push({
            ...parsed,
            id: row.id,
            isShared: true,
          });
        } else if (row.type === 'budget' || row.account_id.startsWith(BUDGET_PREFIX)) {
          budgets.push({
            ...parsed,
            id: row.id,
            isShared: true,
          });
        } else if (row.type === 'subscription' || row.account_id.startsWith(SUB_PREFIX)) {
          subscriptions.push({
            ...parsed,
            id: row.id,
            isShared: true,
          });
        } else if (row.type === 'goal_contribution' || row.account_id.startsWith(CONTRIB_PREFIX)) {
          contributions.push({
            ...parsed,
            id: row.id,
          });
        } else if (row.type === 'profile' || row.account_id.startsWith(PROFILE_PREFIX)) {
          profiles.push({
            ...parsed,
            userId: parsed.userId || row.created_by_id,
            displayName: parsed.displayName || row.created_by_name || 'Usuário',
            avatarUrl: parsed.avatarUrl,
            role: parsed.role,
            updatedAt: parsed.updatedAt || row.updated_at,
          });
        }
      } catch (parseErr) {
        console.warn('[SharedItemsSync] Erro ao fazer parse de item compartilhado:', row.id, parseErr);
      }
    }

    return { goals, budgets, subscriptions, contributions, cards, profiles, deletedIds };
  } catch (err) {
    console.warn('[SharedItemsSync] Falha na consulta de itens compartilhados:', err);
    return { goals: [], budgets: [], subscriptions: [], contributions: [], cards: [], profiles: [], deletedIds: new Set() };
  }
};

/**
 * Reconciliação bidirecional:
 * 1. Puxa itens compartilhados da nuvem (remotos) e salva localmente.
 * 2. Identifica itens compartilhados locais pré-existentes que ainda não estão na nuvem e sobe.
 * 3. Remove itens que foram marcados como excluídos na nuvem.
 */
export const syncAllLocalSharedItemsWithCloud = async (
  spaceCode: string,
  localData: {
    goals: Goal[];
    budgets: Budget[];
    subscriptions: Subscription[];
    contributions: GoalContribution[];
    sharedAccountIds: string[];
    accounts?: Account[];
  },
  currentUser?: { id?: string; displayName?: string; avatarUrl?: string; role?: 'owner' | 'member' } | null
): Promise<{ hasChanges: boolean; profiles: SharedSpaceProfile[] }> => {
  if (!spaceCode || !supabase || !isSupabaseConfigured()) {
    return { hasChanges: false, profiles: [] };
  }

  const cleanCode = spaceCode.trim().toUpperCase();
  const remote = await fetchSharedSpaceEntities(cleanCode);

  let hasChanges = false;

  // --- 0. SINCRONIZAÇÃO DE PERFIL DO USUÁRIO NO ESPAÇO ---
  if (currentUser?.id) {
    const myRemoteProfile = remote.profiles.find(p => p.userId === currentUser.id);
    const needsUpload = !myRemoteProfile || 
      myRemoteProfile.avatarUrl !== currentUser.avatarUrl || 
      myRemoteProfile.displayName !== currentUser.displayName;
    if (needsUpload) {
      await syncSharedProfileToCloud(cleanCode, {
        userId: currentUser.id,
        displayName: currentUser.displayName || 'Usuário',
        avatarUrl: currentUser.avatarUrl,
        role: currentUser.role,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  const remoteGoalMap = new Map(remote.goals.map(g => [g.id, g]));
  const remoteBudgetMap = new Map(remote.budgets.map(b => [b.id, b]));
  const remoteSubMap = new Map(remote.subscriptions.map(s => [s.id, s]));
  const remoteContribMap = new Map(remote.contributions.map(c => [c.id, c]));
  const remoteCardMap = new Map(remote.cards.map(c => [c.id, c]));

  // --- 1. METAS ---
  // A. Local -> Nuvem (upload de metas locais não excluídas que faltam na nuvem)
  for (const localGoal of localData.goals) {
    if (localGoal.isShared) {
      if (remote.deletedIds.has(localGoal.id)) {
        // Meta foi excluída remotamente, remove localmente
        await db.deleteGoal(localGoal.id);
        hasChanges = true;
      } else if (!remoteGoalMap.has(localGoal.id)) {
        // Meta compartilhada criada localmente que ainda não subiu para a nuvem
        console.log('[SharedItemsSync] Enviando meta compartilhada local para a nuvem:', localGoal.name);
        await syncSharedGoalToCloud(cleanCode, localGoal);
      }
    } else {
      // Se a meta local não é mais compartilhada mas ainda existe na nuvem, remove da nuvem
      if (remoteGoalMap.has(localGoal.id)) {
        console.log('[SharedItemsSync] Meta tornada pessoal, removendo da nuvem:', localGoal.name);
        await deleteSharedGoalFromCloud(cleanCode, localGoal.id);
        remoteGoalMap.delete(localGoal.id);
        hasChanges = true;
      }
    }
  }

  // B. Nuvem -> Local (download de metas criadas pelo parceiro)
  for (const remoteGoal of remote.goals) {
    if (!remoteGoalMap.has(remoteGoal.id)) continue;

    const local = localData.goals.find(g => g.id === remoteGoal.id);
    if (!local) {
      console.log('[SharedItemsSync] Salvando meta compartilhada do parceiro no banco local:', remoteGoal.name);
      await db.saveGoal(remoteGoal);
      hasChanges = true;
    } else {
      if (!local.isShared) {
        await deleteSharedGoalFromCloud(cleanCode, local.id);
        remoteGoalMap.delete(local.id);
        continue;
      }

      // Atualiza se houver divergência de saldo ou status
      const isDiff = local.currentAmount !== remoteGoal.currentAmount ||
                     local.targetAmount !== remoteGoal.targetAmount ||
                     local.name !== remoteGoal.name ||
                     local.isCompleted !== remoteGoal.isCompleted;
      if (isDiff) {
        await db.saveGoal({
          ...local,
          ...remoteGoal,
          isShared: true,
        });
        hasChanges = true;
      }
    }
  }

  // --- 2. ORÇAMENTOS ---
  // A. Local -> Nuvem
  for (const localBudget of localData.budgets) {
    if (localBudget.isShared) {
      if (remote.deletedIds.has(localBudget.id)) {
        await db.deleteBudget(localBudget.id);
        hasChanges = true;
      } else if (!remoteBudgetMap.has(localBudget.id)) {
        console.log('[SharedItemsSync] Enviando orçamento compartilhado local para a nuvem:', localBudget.categoryId);
        await syncSharedBudgetToCloud(cleanCode, localBudget);
      }
    } else {
      if (remoteBudgetMap.has(localBudget.id)) {
        console.log('[SharedItemsSync] Orçamento tornado pessoal, removendo da nuvem:', localBudget.categoryId);
        await deleteSharedBudgetFromCloud(cleanCode, localBudget.id);
        remoteBudgetMap.delete(localBudget.id);
        hasChanges = true;
      }
    }
  }

  // B. Nuvem -> Local
  for (const remoteBudget of remote.budgets) {
    if (!remoteBudgetMap.has(remoteBudget.id)) continue;

    const local = localData.budgets.find(b => b.id === remoteBudget.id);
    if (!local) {
      console.log('[SharedItemsSync] Salvando orçamento compartilhado do parceiro no banco local:', remoteBudget.categoryId);
      await db.saveBudget(remoteBudget);
      hasChanges = true;
    } else {
      if (!local.isShared) {
        await deleteSharedBudgetFromCloud(cleanCode, local.id);
        remoteBudgetMap.delete(local.id);
        continue;
      }

      if (local.monthlyLimit !== remoteBudget.monthlyLimit) {
        await db.saveBudget({
          ...local,
          ...remoteBudget,
          isShared: true,
        });
        hasChanges = true;
      }
    }
  }

  // --- 3. ASSINATURAS ---
  // A. Local -> Nuvem
  for (const localSub of localData.subscriptions) {
    const isShared = localSub.isShared || (localSub.accountId && localData.sharedAccountIds.includes(localSub.accountId));
    if (isShared) {
      if (remote.deletedIds.has(localSub.id)) {
        await db.deleteSubscription(localSub.id);
        hasChanges = true;
      } else if (!remoteSubMap.has(localSub.id)) {
        console.log('[SharedItemsSync] Enviando assinatura compartilhada local para a nuvem:', localSub.name);
        const subToSync: Subscription = {
          ...localSub,
          isShared: true,
        };
        await syncSharedSubscriptionToCloud(cleanCode, subToSync);
        if (!localSub.isShared) {
          await db.saveSubscription(subToSync);
          hasChanges = true;
        }
      }
    } else {
      // Se a assinatura local não é mais compartilhada (ex: mudou para conta pessoal),
      // remove da nuvem para não ser resgatada como compartilhada
      if (remoteSubMap.has(localSub.id)) {
        console.log('[SharedItemsSync] Assinatura local não é mais compartilhada, removendo da nuvem:', localSub.name);
        await deleteSharedSubscriptionFromCloud(cleanCode, localSub.id);
        remoteSubMap.delete(localSub.id);
        hasChanges = true;
      }
    }
  }

  // B. Nuvem -> Local
  for (const remoteSub of remote.subscriptions) {
    if (!remoteSubMap.has(remoteSub.id)) continue;

    const local = localData.subscriptions.find(s => s.id === remoteSub.id);
    if (!local) {
      console.log('[SharedItemsSync] Salvando assinatura compartilhada do parceiro no banco local:', remoteSub.name);
      await db.saveSubscription(remoteSub);
      hasChanges = true;
    } else {
      // Se a assinatura local existe e NÃO é compartilhada (usuário mudou para conta pessoal),
      // a decisão local prevalece: remove da nuvem e não sobrescreve a conta local!
      const isLocalShared = local.isShared || (local.accountId && localData.sharedAccountIds.includes(local.accountId));
      if (!isLocalShared) {
        console.log('[SharedItemsSync] Assinatura local mantida como pessoal, desvinculando da nuvem:', local.name);
        await deleteSharedSubscriptionFromCloud(cleanCode, local.id);
        remoteSubMap.delete(local.id);
        continue;
      }

      const isDiff = local.amount !== remoteSub.amount ||
                     local.name !== remoteSub.name ||
                     local.cadence !== remoteSub.cadence ||
                     local.nextBillingDate !== remoteSub.nextBillingDate ||
                     local.accountId !== remoteSub.accountId;
      if (isDiff) {
        await db.saveSubscription({
          ...local,
          ...remoteSub,
          isShared: true,
        });
        hasChanges = true;
      }
    }
  }

  // --- 4. APORTES DE METAS ---
  // A. Local -> Nuvem
  for (const localContrib of localData.contributions) {
    const parentGoal = localData.goals.find(g => g.id === localContrib.goalId);
    if (parentGoal?.isShared) {
      if (remote.deletedIds.has(localContrib.id)) {
        await db.deleteGoalContribution(localContrib.id);
        hasChanges = true;
      } else if (!remoteContribMap.has(localContrib.id)) {
        await syncSharedContributionToCloud(cleanCode, localContrib);
      }
    }
  }

  // B. Nuvem -> Local
  for (const remoteContrib of remote.contributions) {
    const local = localData.contributions.find(c => c.id === remoteContrib.id);
    if (!local) {
      await db.saveGoalContribution(remoteContrib);
      hasChanges = true;
    }
  }

  // --- 5. CARTÕES COMPARTILHADOS ---
  const localAccounts = localData.accounts || [];

  // A. Local -> Nuvem
  for (const localAcc of localAccounts) {
    if (localAcc.isShared) {
      if (remote.deletedIds.has(localAcc.id)) {
        console.log('[SharedItemsSync] Removendo cartão excluído na nuvem:', localAcc.name);
        await db.deleteAccount(localAcc.id);
        hasChanges = true;
      } else if (!remoteCardMap.has(localAcc.id)) {
        console.log('[SharedItemsSync] Enviando cartão compartilhado local para a nuvem:', localAcc.name);
        await syncSharedCardToCloud(cleanCode, localAcc);
      } else {
        const remoteCard = remoteCardMap.get(localAcc.id);
        const hasDigitsDiff = (localAcc.lastDigits && (!remoteCard?.lastDigits || remoteCard.lastDigits !== localAcc.lastDigits)) ||
                              (localAcc.additionalCardLastDigits && (!remoteCard?.additionalCardLastDigits || remoteCard.additionalCardLastDigits !== localAcc.additionalCardLastDigits)) ||
                              (localAcc.additionalCardHolderName && (!remoteCard?.additionalCardHolderName || remoteCard.additionalCardHolderName !== localAcc.additionalCardHolderName));
        if (hasDigitsDiff) {
          console.log('[SharedItemsSync] Sincronizando dígitos/adicional do cartão local para a nuvem:', localAcc.name);
          await syncSharedCardToCloud(cleanCode, {
            ...remoteCard,
            ...localAcc,
            lastDigits: localAcc.lastDigits || remoteCard?.lastDigits,
            additionalCardLastDigits: localAcc.additionalCardLastDigits || remoteCard?.additionalCardLastDigits,
            additionalCardHolderName: localAcc.additionalCardHolderName || remoteCard?.additionalCardHolderName,
            additionalCards: localAcc.additionalCards || remoteCard?.additionalCards,
          });
        }
      }
    }
  }

  // B. Nuvem -> Local (download ou atualização de edições no cartão feitas pelo parceiro)
  for (const remoteCard of remote.cards) {
    const local = localAccounts.find(a => a.id === remoteCard.id);
    if (!local) {
      console.log('[SharedItemsSync] Salvando novo cartão compartilhado do parceiro no banco local:', remoteCard.name);
      await db.saveAccount(remoteCard);
      try {
        const remoteTxs = await fetchSharedTransactions(remoteCard.id);
        for (const tx of remoteTxs) {
          await db.saveTransaction({ ...tx, isShared: true });
        }
      } catch (txErr) {
        console.warn('[SharedItemsSync] Erro ao buscar transações do novo cartão compartilhado:', txErr);
      }
      hasChanges = true;
    } else {
      const remoteHasDigits = Boolean(remoteCard.lastDigits && remoteCard.lastDigits.trim());
      const isDigitsDiff = remoteHasDigits && local.lastDigits !== remoteCard.lastDigits;
      const isAdditionalDigitsDiff = Boolean(remoteCard.additionalCardLastDigits && local.additionalCardLastDigits !== remoteCard.additionalCardLastDigits);

      const isDiff = local.name !== remoteCard.name ||
                     local.creditLimit !== remoteCard.creditLimit ||
                     local.color !== remoteCard.color ||
                     local.bankId !== remoteCard.bankId ||
                     local.closingDay !== remoteCard.closingDay ||
                     local.dueDay !== remoteCard.dueDay ||
                     isDigitsDiff ||
                     isAdditionalDigitsDiff ||
                     local.splitMode !== remoteCard.splitMode ||
                     local.splitRatio !== remoteCard.splitRatio;
      if (isDiff) {
        console.log('[SharedItemsSync] Atualizando edições no cartão compartilhado recebidas do parceiro:', remoteCard.name);
        await db.saveAccount({
          ...local,
          ...remoteCard,
          lastDigits: remoteCard.lastDigits || local.lastDigits,
          additionalCardLastDigits: remoteCard.additionalCardLastDigits || local.additionalCardLastDigits,
          additionalCardHolderName: remoteCard.additionalCardHolderName || local.additionalCardHolderName,
          additionalCards: remoteCard.additionalCards || local.additionalCards,
          balance: local.balance,
          invoiceAmount: local.invoiceAmount,
          isShared: true,
          updatedAt: new Date().toISOString(),
        });
        hasChanges = true;
      }
    }
  }

  return { hasChanges, profiles: remote.profiles };
};
