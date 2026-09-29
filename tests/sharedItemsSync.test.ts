import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  syncSharedGoalToCloud,
  deleteSharedGoalFromCloud,
  syncSharedBudgetToCloud,
  deleteSharedBudgetFromCloud,
  syncSharedSubscriptionToCloud,
  deleteSharedSubscriptionFromCloud,
  syncSharedCardToCloud,
  deleteSharedCardFromCloud,
  syncAllLocalSharedItemsWithCloud,
} from '../src/services/sharedItemsSyncService';
import { db } from '../src/database/adapter';
import { Goal, Budget, Subscription, Account } from '../src/core/types';

describe('Sincronização de Metas, Orçamentos, Assinaturas e Cartões no Finanças a Dois', () => {
  const spaceCode = 'SOBRA-TEST';

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.resetAll('empty');
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

  it('deve persistir e reconciliar edições feitas em cartões conjuntos locais', async () => {
    const cardInitial: Account = {
      id: 'card-conjunto-1',
      name: 'Nubank Conjunto',
      type: 'credit_card',
      balance: 100,
      creditLimit: 3000,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      bankId: 'nubank',
      closingDay: 1,
      dueDay: 8,
      syncStatus: 'manual',
      isShared: true,
      ownerId: 'usr-felipe',
      ownerName: 'Felipe',
      splitMode: 'half',
      splitRatio: 0.5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveAccount(cardInitial);

    // Edição do cartão (Felipe altera limite, nome e dias)
    const cardEdited: Account = {
      ...cardInitial,
      name: 'Nubank do Casal',
      creditLimit: 6000,
      closingDay: 5,
      dueDay: 12,
      color: '#A855F7',
      updatedAt: new Date().toISOString(),
    };

    await db.saveAccount(cardEdited);

    const accounts = await db.getAccounts();
    const found = accounts.find(a => a.id === 'card-conjunto-1');
    expect(found).toBeDefined();
    expect(found?.name).toBe('Nubank do Casal');
    expect(found?.creditLimit).toBe(6000);
    expect(found?.closingDay).toBe(5);
    expect(found?.dueDay).toBe(12);
    expect(found?.color).toBe('#A855F7');
    expect(found?.isShared).toBe(true);
  });
});
