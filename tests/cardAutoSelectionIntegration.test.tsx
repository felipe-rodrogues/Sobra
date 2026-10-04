import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TransactionModal } from '../src/components/modals/TransactionModal';
import { FinanceContext } from '../src/context/FinanceContext';
import { Account, Transaction } from '../src/core/types';

describe('Integração: Visualização do Final dos Cartões e Seleção Automática Inteligente', () => {
  const cardNubank1: Account = {
    id: 'card-nu-5023',
    name: 'Nubank',
    type: 'credit_card',
    balance: 400,
    color: '#820AD1',
    icon: 'credit-card',
    currency: 'BRL',
    bankId: 'nubank',
    lastDigits: '5023',
    syncStatus: 'manual',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const cardNubank2: Account = {
    id: 'card-nu-9812',
    name: 'Nubank',
    type: 'credit_card',
    balance: 1500,
    color: '#820AD1',
    icon: 'credit-card',
    currency: 'BRL',
    bankId: 'nubank',
    lastDigits: '9812',
    syncStatus: 'manual',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const checkingAcc: Account = {
    id: 'acc-conta-principal',
    name: 'Conta Principal',
    type: 'checking',
    balance: 5000,
    color: '#10B981',
    icon: 'landmark',
    currency: 'BRL',
    bankId: 'itau',
    syncStatus: 'manual',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const mockCategories = [
    { id: 'cat-alimentacao', name: 'Alimentação', icon: 'Utensils', color: '#F97316', type: 'expense' as const },
  ];

  const createMockFinanceContext = (overrides?: any) => ({
    accounts: [cardNubank1, cardNubank2, checkingAcc],
    categories: mockCategories,
    transactions: [] as Transaction[],
    subscriptions: [],
    saveTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    saveInstallmentPurchase: vi.fn(),
    deleteInstallmentGroup: vi.fn(),
    suggestCategoryForMerchant: vi.fn(),
    checkIfLikelySubscription: vi.fn().mockReturnValue({ isLikely: false }),
    activeViewedCardId: null,
    setActiveViewedCardId: vi.fn(),
    saveAccount: vi.fn(),
    deleteAccount: vi.fn(),
    saveCategory: vi.fn(),
    deleteCategory: vi.fn(),
    saveBudget: vi.fn(),
    deleteBudget: vi.fn(),
    saveGoal: vi.fn(),
    deleteGoal: vi.fn(),
    addGoalContribution: vi.fn(),
    updateGoalContribution: vi.fn(),
    deleteGoalContribution: vi.fn(),
    goalContributions: [],
    approveNotification: vi.fn(),
    approveNotificationWithNewAccount: vi.fn(),
    discardNotification: vi.fn(),
    simulateIncomingNotification: vi.fn(),
    saveSubscription: vi.fn(),
    deleteSubscription: vi.fn(),
    confirmSubscriptionSuggestion: vi.fn(),
    dismissSubscriptionSuggestion: vi.fn(),
    recordCategoryLearning: vi.fn(),
    saveDescriptionRule: vi.fn(),
    deleteDescriptionRule: vi.fn(),
    cleanTransactionDescription: vi.fn(d => d),
    importCsvTransactions: vi.fn(),
    refreshData: vi.fn(),
    resetAllData: vi.fn(),
    exportFullBackup: vi.fn(),
    importFullBackup: vi.fn(),
    partnershipSpace: null,
    isPartnershipActive: false,
    activatePartnership: vi.fn(),
    joinPartnershipWithCode: vi.fn(),
    updatePartnershipSettings: vi.fn(),
    disconnectPartnership: vi.fn(),
    ...overrides,
  });

  it('renderiza o final dos cartões e subtítulos informativos para diferenciar cartões com mesmo nome', () => {
    const mockContext = createMockFinanceContext();

    const html = renderToString(
      <FinanceContext.Provider value={mockContext}>
        <TransactionModal
          isOpen={true}
          onClose={vi.fn()}
          defaultType="expense"
        />
      </FinanceContext.Provider>
    );

    // Deve conter os 4 dígitos formatados nos botões e listas
    expect(html).toContain('5023');
  });

  it('seleciona automaticamente o cartão mais usado recentemente na hora de adicionar despesa', () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const recentTransactions: Transaction[] = [
      // cardNubank2 (final 9812) foi usado ontem (muito recente)
      {
        id: 'tx-recent-1',
        accountId: 'card-nu-9812',
        categoryId: 'cat-test',
        source: 'manual',
        amount: 85,
        description: 'Supermercado',
        date: yesterday,
        type: 'expense',
        paymentMethod: 'credit',
        status: 'confirmed',
        createdAt: yesterday,
        updatedAt: yesterday,
      },
      // cardNubank1 (final 5023) foi usado há 2 semanas
      {
        id: 'tx-old-1',
        accountId: 'card-nu-5023',
        categoryId: 'cat-test',
        source: 'manual',
        amount: 50,
        description: 'Restaurante',
        date: twoWeeksAgo,
        type: 'expense',
        paymentMethod: 'credit',
        status: 'confirmed',
        createdAt: twoWeeksAgo,
        updatedAt: twoWeeksAgo,
      },
    ];

    const mockContext = createMockFinanceContext({
      transactions: recentTransactions,
    });

    const html = renderToString(
      <FinanceContext.Provider value={mockContext}>
        <TransactionModal
          isOpen={true}
          onClose={vi.fn()}
          defaultType="expense"
        />
      </FinanceContext.Provider>
    );

    // O cartão pré-selecionado exibido no botão do formulário deve ser o 9812
    expect(html).toContain('9812');
  });

  it('seleciona automaticamente o cartão cuja página o usuário está visualizando (activeViewedCardId)', () => {
    // Mesmo que o cartão 9812 seja mais usado, se o usuário estiver na página do cartão 5023:
    const mockContext = createMockFinanceContext({
      activeViewedCardId: 'card-nu-5023',
    });

    const html = renderToString(
      <FinanceContext.Provider value={mockContext}>
        <TransactionModal
          isOpen={true}
          onClose={vi.fn()}
          defaultType="expense"
        />
      </FinanceContext.Provider>
    );

    expect(html).toContain('5023');
  });

  it('respeita defaultAccountId passado explicitamente por propriedade', () => {
    const mockContext = createMockFinanceContext({
      activeViewedCardId: null,
    });

    const html = renderToString(
      <FinanceContext.Provider value={mockContext}>
        <TransactionModal
          isOpen={true}
          onClose={vi.fn()}
          defaultType="expense"
          defaultAccountId="card-nu-9812"
        />
      </FinanceContext.Provider>
    );

    expect(html).toContain('9812');
  });
});
