import { Goal, Budget, Subscription, GoalContribution } from '../core/types';
import { supabase, isSupabaseConfigured, broadcastPartnershipEvent } from './supabase';
import { db } from '../database/adapter';

export const GOAL_PREFIX = 'space-goal:';
export const BUDGET_PREFIX = 'space-budget:';
export const SUB_PREFIX = 'space-sub:';
export const CONTRIB_PREFIX = 'space-contrib:';

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
  deletedIds: Set<string>;
}> => {
  if (!spaceCode || !supabase || !isSupabaseConfigured()) {
    return { goals: [], budgets: [], subscriptions: [], contributions: [], deletedIds: new Set() };
  }

  const cleanCode = spaceCode.trim().toUpperCase();
  const accountIds = [
    `${GOAL_PREFIX}${cleanCode}`,
    `${BUDGET_PREFIX}${cleanCode}`,
    `${SUB_PREFIX}${cleanCode}`,
    `${CONTRIB_PREFIX}${cleanCode}`,
  ];

  try {
    const { data, error } = await supabase
      .from('shared_transactions')
      .select('*')
      .in('account_id', accountIds);

    if (error || !data) {
      console.warn('[SharedItemsSync] Erro ao consultar itens da parceria no Supabase:', error);
      return { goals: [], budgets: [], subscriptions: [], contributions: [], deletedIds: new Set() };
    }

    const goals: Goal[] = [];
    const budgets: Budget[] = [];
    const subscriptions: Subscription[] = [];
    const contributions: GoalContribution[] = [];
    const deletedIds = new Set<string>();

    for (const row of data) {
      if (row.status === 'deleted') {
        deletedIds.add(row.id);
        continue;
      }

      try {
        const parsed = JSON.parse(row.description);
        if (row.type === 'goal' || row.account_id.startsWith(GOAL_PREFIX)) {
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
        }
      } catch (parseErr) {
        console.warn('[SharedItemsSync] Erro ao fazer parse de item compartilhado:', row.id, parseErr);
      }
    }

    return { goals, budgets, subscriptions, contributions, deletedIds };
  } catch (err) {
    console.warn('[SharedItemsSync] Falha na consulta de itens compartilhados:', err);
    return { goals: [], budgets: [], subscriptions: [], contributions: [], deletedIds: new Set() };
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
  }
): Promise<{ hasChanges: boolean }> => {
  if (!spaceCode || !supabase || !isSupabaseConfigured()) {
    return { hasChanges: false };
  }

  const cleanCode = spaceCode.trim().toUpperCase();
  const remote = await fetchSharedSpaceEntities(cleanCode);

  let hasChanges = false;

  const remoteGoalMap = new Map(remote.goals.map(g => [g.id, g]));
  const remoteBudgetMap = new Map(remote.budgets.map(b => [b.id, b]));
  const remoteSubMap = new Map(remote.subscriptions.map(s => [s.id, s]));
  const remoteContribMap = new Map(remote.contributions.map(c => [c.id, c]));

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
    }
  }

  // B. Nuvem -> Local (download de metas criadas pelo parceiro)
  for (const remoteGoal of remote.goals) {
    const local = localData.goals.find(g => g.id === remoteGoal.id);
    if (!local) {
      console.log('[SharedItemsSync] Salvando meta compartilhada do parceiro no banco local:', remoteGoal.name);
      await db.saveGoal(remoteGoal);
      hasChanges = true;
    } else {
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
    }
  }

  // B. Nuvem -> Local
  for (const remoteBudget of remote.budgets) {
    const local = localData.budgets.find(b => b.id === remoteBudget.id);
    if (!local) {
      console.log('[SharedItemsSync] Salvando orçamento compartilhado do parceiro no banco local:', remoteBudget.categoryId);
      await db.saveBudget(remoteBudget);
      hasChanges = true;
    } else if (local.monthlyLimit !== remoteBudget.monthlyLimit) {
      await db.saveBudget({
        ...local,
        ...remoteBudget,
        isShared: true,
      });
      hasChanges = true;
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
    }
  }

  // B. Nuvem -> Local
  for (const remoteSub of remote.subscriptions) {
    const local = localData.subscriptions.find(s => s.id === remoteSub.id);
    if (!local) {
      console.log('[SharedItemsSync] Salvando assinatura compartilhada do parceiro no banco local:', remoteSub.name);
      await db.saveSubscription(remoteSub);
      hasChanges = true;
    } else {
      const isDiff = local.amount !== remoteSub.amount ||
                     local.name !== remoteSub.name ||
                     local.cadence !== remoteSub.cadence ||
                     local.nextBillingDate !== remoteSub.nextBillingDate ||
                     !local.isShared;
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

  return { hasChanges };
};
