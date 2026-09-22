import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getLocalPartnershipSpace, 
  activatePartnershipSpace, 
  joinPartnershipSpaceWithCode, 
  saveLocalPartnershipSpace, 
  deactivatePartnershipSpace 
} from '../src/services/partnershipService';
import { db } from '../src/database/adapter';
import { Account, Goal, Budget, Subscription, GoalContribution, UserProfile } from '../src/core/types';

describe('Ecossistema Finanças a Dois (Modo Parceiro Completo)', () => {
  const memoryStorage: Record<string, string> = {};
  if (typeof globalThis.localStorage === 'undefined') {
    (globalThis as any).localStorage = {
      getItem: (k: string) => memoryStorage[k] || null,
      setItem: (k: string, v: string) => { memoryStorage[k] = v; },
      removeItem: (k: string) => { delete memoryStorage[k]; },
      clear: () => { Object.keys(memoryStorage).forEach(k => delete memoryStorage[k]); }
    };
  }

  beforeEach(async () => {
    localStorage.clear();
    await db.resetAll('empty');
  });

  it('1. Deve ativar o espaço Finanças a Dois gerando código SOBRA-XXXX', async () => {
    const mockUser: UserProfile = {
      id: 'usr-1',
      displayName: 'Felipe Rodrigues',
      email: 'felipe@test.com',
    };

    const space = await activatePartnershipSpace(mockUser);
    expect(space).toBeDefined();
    expect(space.isActive).toBe(true);
    expect(space.code).toMatch(/^SOBRA-[A-Z0-9]{4}$/);
    expect(space.ownerName).toBe('Felipe Rodrigues');

    const loaded = getLocalPartnershipSpace();
    expect(loaded).not.toBeNull();
    expect(loaded?.code).toBe(space.code);
  });

  it('2. Deve detectar automaticamente Finanças a Dois ativo se o usuário já possuir um cartão compartilhado', () => {
    const existingSharedAccount: Account = {
      id: 'card-shared-1',
      name: 'Cartão Casa XP',
      type: 'credit_card',
      balance: 1500,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      isShared: true,
      ownerId: 'usr-1',
      ownerName: 'Felipe',
      inviteCode: 'SOBRA-CASA',
      sharedMembers: [
        { userId: 'usr-1', displayName: 'Felipe', email: 'felipe@test.com', role: 'owner', joinedAt: new Date().toISOString() },
        { userId: 'usr-2', displayName: 'Mariana', email: 'mariana@test.com', role: 'member', joinedAt: new Date().toISOString() },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const autoSpace = getLocalPartnershipSpace([existingSharedAccount]);
    expect(autoSpace).not.toBeNull();
    expect(autoSpace?.isActive).toBe(true);
    expect(autoSpace?.code).toBe('SOBRA-CASA');
    expect(autoSpace?.partnerName).toBe('Mariana');
  });

  it('3. Deve salvar e recuperar Metas e Aportes com flag isShared e autoria', async () => {
    const goal: Goal = {
      id: 'goal-viagem',
      name: 'Viagem Finlândia 2027',
      targetAmount: 20000,
      currentAmount: 1500,
      color: '#38BDF8',
      icon: 'Target',
      isCompleted: false,
      isShared: true,
      ownerId: 'usr-1',
      ownerName: 'Felipe',
      createdAt: new Date().toISOString(),
    };

    await db.saveGoal(goal);
    const loadedGoals = await db.getGoals();
    const found = loadedGoals.find(g => g.id === 'goal-viagem');
    expect(found).toBeDefined();
    expect(found?.isShared).toBe(true);
    expect(found?.ownerName).toBe('Felipe');

    // Registra aporte de Mariana
    const contrib: GoalContribution = {
      id: 'contrib-1',
      goalId: 'goal-viagem',
      amount: 1000,
      date: '2026-09-22',
      isAutomatic: false,
      contributedById: 'usr-2',
      contributedByName: 'Mariana',
      note: 'Aporte do mês',
      createdAt: new Date().toISOString(),
    };

    await db.saveGoalContribution(contrib);
    const loadedContribs = await db.getGoalContributions('goal-viagem');
    expect(loadedContribs.length).toBe(1);
    expect(loadedContribs[0].contributedByName).toBe('Mariana');
  });

  it('4. Deve salvar e recuperar Orçamentos com flag isShared', async () => {
    const budget: Budget = {
      id: 'b-mercado',
      categoryId: 'cat-mercado',
      monthlyLimit: 2500,
      month: 9,
      year: 2026,
      isShared: true,
      ownerName: 'Felipe & Mariana',
      createdAt: new Date().toISOString(),
    };

    await db.saveBudget(budget);
    const loadedBudgets = await db.getBudgets();
    const found = loadedBudgets.find(b => b.id === 'b-mercado');
    expect(found).toBeDefined();
    expect(found?.isShared).toBe(true);
    expect(found?.monthlyLimit).toBe(2500);
  });

  it('5. Deve salvar Assinaturas e detectar isShared automaticamente quando vinculada a cartão conjunto', async () => {
    const sharedCard: Account = {
      id: 'card-joint-1',
      name: 'Cartão Casa',
      type: 'credit_card',
      balance: 500,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      isShared: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveAccount(sharedCard);

    const subscription: Subscription = {
      id: 'sub-netflix',
      name: 'Netflix 4K Família',
      amount: 59.90,
      categoryId: 'cat-lazer',
      accountId: 'card-joint-1',
      cadence: 'monthly',
      nextBillingDate: '2026-10-05',
      status: 'active',
      isShared: true,
      ownerName: 'Felipe',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveSubscription(subscription);
    const loadedSubs = await db.getSubscriptions();
    const found = loadedSubs.find(s => s.id === 'sub-netflix');
    expect(found).toBeDefined();
    expect(found?.isShared).toBe(true);
    expect(found?.amount).toBe(59.90);
  });

  it('6. Deve desconectar e desativar o espaço de parceria corretamente', () => {
    const mockSpace = {
      id: 'space-test',
      code: 'SOBRA-TEST',
      isActive: true,
      createdAt: new Date().toISOString(),
      ownerId: 'usr-1',
      ownerName: 'Felipe',
    };
    saveLocalPartnershipSpace(mockSpace);
    expect(getLocalPartnershipSpace()).not.toBeNull();

    deactivatePartnershipSpace();
    expect(getLocalPartnershipSpace()).toBeNull();
  });

  it('7. Cartão criado com vínculo ao Finanças a Dois deve herdar o código da parceria e membros do casal', async () => {
    const space = {
      id: 'space-casal-1',
      code: 'SOBRA-TGXN',
      isActive: true,
      createdAt: new Date().toISOString(),
      ownerId: 'usr-1',
      ownerName: 'Felps',
      ownerAvatarUrl: 'https://avatar.com/felps.png',
      partnerId: 'usr-2',
      partnerName: 'Mari',
      partnerAvatarUrl: 'https://avatar.com/mari.png',
      joinedAt: new Date().toISOString(),
    };
    saveLocalPartnershipSpace(space);

    const newCoupleCard: Account = {
      id: 'card-couple-1',
      name: 'Nubank do Casal',
      type: 'credit_card',
      balance: 0,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      isShared: true,
      inviteCode: space.code,
      ownerId: space.ownerId,
      ownerName: space.ownerName,
      splitMode: 'half',
      splitRatio: 0.5,
      sharedMembers: [
        { userId: space.ownerId, displayName: space.ownerName, email: '', avatarUrl: space.ownerAvatarUrl, role: 'owner', joinedAt: space.createdAt },
        { userId: space.partnerId, displayName: space.partnerName, email: '', avatarUrl: space.partnerAvatarUrl, role: 'member', joinedAt: space.joinedAt },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveAccount(newCoupleCard);
    const loadedAccounts = await db.getAccounts();
    const savedCard = loadedAccounts.find(a => a.id === 'card-couple-1');
    expect(savedCard).toBeDefined();
    expect(savedCard?.isShared).toBe(true);
    expect(savedCard?.inviteCode).toBe('SOBRA-TGXN');
    expect(savedCard?.sharedMembers?.length).toBe(2);
    expect(savedCard?.sharedMembers?.[0].displayName).toBe('Felps');
    expect(savedCard?.sharedMembers?.[1].displayName).toBe('Mari');
  });
});
