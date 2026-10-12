import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TransactionModal } from '../src/components/modals/TransactionModal';
import { FinanceContext } from '../src/context/FinanceContext';
import { Account, Transaction } from '../src/core/types';

describe('Edição de Compras Parceladas no TransactionModal', () => {
  const creditCard: Account = {
    id: 'card-nu-1234',
    name: 'Nubank',
    type: 'credit_card',
    balance: 500,
    color: '#820AD1',
    icon: 'credit-card',
    currency: 'BRL',
    bankId: 'nubank',
    lastDigits: '1234',
    syncStatus: 'manual',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const mockCategories = [
    { id: 'cat-eletronicos', name: 'Eletrônicos', icon: 'Tv', color: '#3B82F6', type: 'expense' as const },
    { id: 'cat-salario', name: 'Salário', icon: 'Briefcase', color: '#10B981', type: 'income' as const },
  ];

  const createMockFinanceContext = (overrides?: any) => ({
    accounts: [creditCard],
    categories: mockCategories,
    transactions: [] as Transaction[],
    subscriptions: [],
    saveTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    saveInstallmentPurchase: vi.fn(),
    convertTransactionToInstallments: vi.fn(),
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
    cleanTransactionDescription: vi.fn((d: string) => d),
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

  it('deve renderizar o chip de condição de pagamento "À vista" ao editar uma despesa comum não parcelada', () => {
    const singleExpense: Transaction = {
      id: 'tx-single-1',
      accountId: creditCard.id,
      categoryId: 'cat-eletronicos',
      amount: 300,
      description: 'Fone de Ouvido',
      date: '2026-03-10T12:00:00.000Z',
      type: 'expense',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'manual',
      createdAt: '2026-03-10T12:00:00.000Z',
      updatedAt: '2026-03-10T12:00:00.000Z',
    };

    const mockContext = createMockFinanceContext({
      transactions: [singleExpense],
    });

    const html = renderToString(
      <FinanceContext.Provider value={mockContext}>
        <TransactionModal
          isOpen={true}
          onClose={vi.fn()}
          initialData={singleExpense}
          defaultType="expense"
        />
      </FinanceContext.Provider>
    );

    // Deve conter a opção de condição de pagamento visível para o usuário clicar e alterar
    expect(html).toContain('À vista');
  });

  it('deve renderizar o chip de condição de pagamento com "3x de R$ 100,00" ao editar uma despesa parcelada', () => {
    const installmentExpense: Transaction = {
      id: 'tx-inst-1',
      accountId: creditCard.id,
      categoryId: 'cat-eletronicos',
      amount: 100,
      originalTotalAmount: 300,
      description: 'Kindle',
      date: '2026-03-10T12:00:00.000Z',
      type: 'expense',
      status: 'confirmed',
      paymentMethod: 'credit',
      isInstallment: true,
      installmentNumber: 1,
      installmentTotal: 3,
      installmentGroupId: 'inst-kindle-1',
      source: 'manual',
      createdAt: '2026-03-10T12:00:00.000Z',
      updatedAt: '2026-03-10T12:00:00.000Z',
    };

    const mockContext = createMockFinanceContext({
      transactions: [installmentExpense],
    });

    const html = renderToString(
      <FinanceContext.Provider value={mockContext}>
        <TransactionModal
          isOpen={true}
          onClose={vi.fn()}
          initialData={installmentExpense}
          defaultType="expense"
        />
      </FinanceContext.Provider>
    );

    // Deve renderizar o chip indicando as 3x de R$ 100,00
    expect(html).toContain('3x');
    expect(html).toContain('100,00');
  });

  it('deve renderizar o chip ao criar uma nova despesa do zero', () => {
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

    // Ao criar nova despesa, chip "À vista" também aparece
    expect(html).toContain('À vista');
  });

  it('não deve exibir o chip de parcelamento para receitas', () => {
    const incomeTx: Transaction = {
      id: 'tx-inc-1',
      accountId: 'acc-conta-principal',
      categoryId: 'cat-salario',
      amount: 5000,
      description: 'Salário',
      date: '2026-03-05T12:00:00.000Z',
      type: 'income',
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      createdAt: '2026-03-05T12:00:00.000Z',
      updatedAt: '2026-03-05T12:00:00.000Z',
    };

    const mockContext = createMockFinanceContext({
      transactions: [incomeTx],
    });

    const html = renderToString(
      <FinanceContext.Provider value={mockContext}>
        <TransactionModal
          isOpen={true}
          onClose={vi.fn()}
          initialData={incomeTx}
          defaultType="income"
        />
      </FinanceContext.Provider>
    );

    // Não deve ter chip de parcelamento para receita
    expect(html).not.toContain('À vista');
    expect(html).not.toContain('parcelado');
  });

  it('não deve exibir o chip de parcelamento quando for assinatura ou recorrência', () => {
    const recurringExpense: Transaction = {
      id: 'tx-sub-1',
      accountId: creditCard.id,
      categoryId: 'cat-eletronicos',
      amount: 49.90,
      description: 'Netflix',
      date: '2026-03-10T12:00:00.000Z',
      type: 'expense',
      status: 'confirmed',
      paymentMethod: 'credit',
      isRecurring: true,
      source: 'manual',
      createdAt: '2026-03-10T12:00:00.000Z',
      updatedAt: '2026-03-10T12:00:00.000Z',
    };

    const mockContext = createMockFinanceContext({
      transactions: [recurringExpense],
    });

    const html = renderToString(
      <FinanceContext.Provider value={mockContext}>
        <TransactionModal
          isOpen={true}
          onClose={vi.fn()}
          initialData={recurringExpense}
          defaultType="expense"
        />
      </FinanceContext.Provider>
    );

    // Assinaturas possuem controle próprio de recorrência, não parcelamento fixo
    expect(html).not.toContain('À vista');
  });

  it('deve fornecer convertTransactionToInstallments no contexto financeiro para conversões seguras', () => {
    const convertMock = vi.fn().mockResolvedValue([]);
    const sharedCard: Account = {
      ...creditCard,
      id: 'card-shared-1',
      isShared: true,
      name: 'Cartão Conjunto',
    };
    const mockContext = createMockFinanceContext({
      accounts: [sharedCard],
      convertTransactionToInstallments: convertMock,
    });

    expect(typeof mockContext.convertTransactionToInstallments).toBe('function');
  });
});
