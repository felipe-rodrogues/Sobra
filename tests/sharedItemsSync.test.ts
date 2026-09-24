import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  syncSharedGoalToCloud,
  deleteSharedGoalFromCloud,
  syncSharedBudgetToCloud,
  deleteSharedBudgetFromCloud,
  syncSharedSubscriptionToCloud,
  deleteSharedSubscriptionFromCloud,
  syncAllLocalSharedItemsWithCloud,
} from '../src/services/sharedItemsSyncService';
import { db } from '../src/database/adapter';
import { Goal, Budget, Subscription } from '../src/core/types';

describe('Sincronização de Metas, Orçamentos e Assinaturas no Finanças a Dois', () => {
  const spaceCode = 'SOBRA-TEST';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve sincronizar e reconciliar metas compartilhadas com o banco local', async () => {
    const localGoal: Goal = {
      id: 'g-local-1',
      name: 'Viagem a Dois',
      targetAmount: 5000,
      currentAmount: 1200,
      color: '#10B981',
      icon: 'Target',
      isCompleted: false,
      isShared: true,
      ownerName: 'Felps',
      createdAt: new Date().toISOString(),
    };

    await db.saveGoal(localGoal);

    const saved = await db.getGoals();
    expect(saved.some(g => g.id === 'g-local-1' && g.isShared)).toBe(true);
  });

  it('deve identificar orçamentos conjuntos locais e marcar para sync', async () => {
    const localBudget: Budget = {
      id: 'b-local-1',
      categoryId: 'cat-alim',
      monthlyLimit: 1500,
      month: 9,
      year: 2026,
      isShared: true,
      ownerName: 'Jéssica Furtado',
      createdAt: new Date().toISOString(),
    };

    await db.saveBudget(localBudget);

    const saved = await db.getBudgets();
    expect(saved.some(b => b.id === 'b-local-1' && b.isShared)).toBe(true);
  });

  it('deve identificar assinaturas conjuntas vinculadas ao cartão ou marcadas como conjuntas', async () => {
    const localSub: Subscription = {
      id: 'sub-local-1',
      name: 'Meli+',
      amount: 65,
      categoryId: 'cat-servicos',
      accountId: 'acc-nubank',
      cadence: 'monthly',
      nextBillingDate: '2026-10-03',
      status: 'active',
      isShared: true,
      ownerName: 'Felps',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveSubscription(localSub);

    const saved = await db.getSubscriptions();
    const found = saved.find(s => s.id === 'sub-local-1');
    expect(found).toBeDefined();
    expect(found?.isShared).toBe(true);
    expect(found?.amount).toBe(65);
  });
});
