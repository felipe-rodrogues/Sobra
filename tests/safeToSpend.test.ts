import { describe, it, expect } from 'vitest';
import { calculateSafeToSpendBudget, getAccountUserRatio } from '../src/core/budgets/safeToSpendHelper';
import { Account, Transaction, Subscription, ActiveInstallmentGroup } from '../src/core/types';

describe('Safe-to-Spend & Intelligent Weekly Budget Engine', () => {
  const referenceDate = new Date(2026, 9, 18); // 18 de Outubro de 2026 (mês tem 31 dias, 13 dias restantes)

  const mockCardIndividual: Account = {
    id: 'acc-card-ind',
    name: 'Nubank Pessoal',
    type: 'credit_card',
    balance: -500,
    color: '#820AD1',
    icon: 'credit-card',
    currency: 'BRL',
    syncStatus: 'manual',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const mockCardShared50: Account = {
    id: 'acc-card-shared',
    name: 'Inter Casal',
    type: 'credit_card',
    balance: -800,
    color: '#FF7A00',
    icon: 'credit-card',
    currency: 'BRL',
    isShared: true,
    splitMode: 'half',
    splitRatio: 0.5,
    syncStatus: 'manual',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const mockCardSharedZero: Account = {
    id: 'acc-card-partner-only',
    name: 'Cartão Parceiro',
    type: 'credit_card',
    balance: -300,
    color: '#10B981',
    icon: 'credit-card',
    currency: 'BRL',
    isShared: true,
    splitMode: 'none',
    splitRatio: 0.0,
    syncStatus: 'manual',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  it('determines the correct user ratio across shared and individual accounts', () => {
    expect(getAccountUserRatio(mockCardIndividual)).toBe(1.0);
    expect(getAccountUserRatio(mockCardShared50)).toBe(0.5);
    expect(getAccountUserRatio(mockCardSharedZero)).toBe(0.0);
  });

  it('deducts active credit card installments applying splitRatio for shared cards', () => {
    // Renda = R$ 2.000
    // Parcela individual = R$ 200 (Geladeira 3/10)
    // Parcela compartilhada 50% = R$ 300 (Sofá 2/5 -> sua parte R$ 150)
    // Total comprometido com parcelas = 200 + 150 = 350
    // Reserva planejada 10% = R$ 200
    // Dias restantes = 13 dias
    // Saldo livre = 2000 - 350 - 200 = 1450
    // Diário = 1450 / 13 = 111,54
    // Semanal = 111,54 * 7 = 780,78
    const txs: Transaction[] = [
      {
        id: 'tx-salary',
        accountId: 'acc-checking',
        categoryId: 'cat-salary',
        amount: 2000.0,
        type: 'income',
        description: 'Salário Mensal',
        date: '2026-10-05T10:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'manual',
        createdAt: '2026-10-05',
        updatedAt: '2026-10-05',
      },
      {
        id: 'tx-inst-1',
        accountId: mockCardIndividual.id,
        categoryId: 'cat-compras',
        amount: 200.0,
        type: 'expense',
        description: 'Geladeira (3/10)',
        date: '2026-10-10T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        isInstallment: true,
        installmentNumber: 3,
        installmentTotal: 10,
        createdAt: '2026-10-10',
        updatedAt: '2026-10-10',
      },
      {
        id: 'tx-inst-shared',
        accountId: mockCardShared50.id,
        categoryId: 'cat-compras',
        amount: 300.0,
        type: 'expense',
        description: 'Sofá Casal (2/5)',
        date: '2026-10-12T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        isInstallment: true,
        installmentNumber: 2,
        installmentTotal: 5,
        createdAt: '2026-10-12',
        updatedAt: '2026-10-12',
      },
    ];

    const result = calculateSafeToSpendBudget({
      transactions: txs,
      accounts: [mockCardIndividual, mockCardShared50],
      subscriptions: [],
      referenceDate,
      savingsPercent: 10,
    });

    expect(result.monthlyIncome).toBe(2000.0);
    expect(result.committedInstallmentsTotal).toBe(350.0); // 200 + 150
    expect(result.committedTotal).toBe(350.0);
    expect(result.plannedSavingsAmount).toBe(200.0);
    expect(result.availableToSpend).toBe(1450.0);
    expect(result.dailySafeBudget).toBe(111.54);
    expect(result.weeklySafeBudget).toBe(780.78);
  });

  it('prevents double counting: does not count installments twice in variable spent', () => {
    // Renda = R$ 2.000
    // Parcela individual = R$ 100
    // Gasto de bolso variável (mercado) = R$ 50
    const txs: Transaction[] = [
      {
        id: 'tx-salary',
        accountId: 'acc-checking',
        categoryId: 'cat-salary',
        amount: 2000.0,
        type: 'income',
        description: 'Salário',
        date: '2026-10-05T10:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'manual',
        createdAt: '2026-10-05',
        updatedAt: '2026-10-05',
      },
      {
        id: 'tx-inst-1',
        accountId: mockCardIndividual.id,
        categoryId: 'cat-compras',
        amount: 100.0,
        type: 'expense',
        description: 'Celular (1/10)',
        date: '2026-10-10T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        isInstallment: true,
        createdAt: '2026-10-10',
        updatedAt: '2026-10-10',
      },
      {
        id: 'tx-mercado',
        accountId: 'acc-checking',
        categoryId: 'cat-mercado',
        amount: 50.0,
        type: 'expense',
        description: 'Supermercado',
        date: '2026-10-15T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'manual',
        createdAt: '2026-10-15',
        updatedAt: '2026-10-15',
      },
    ];

    const result = calculateSafeToSpendBudget({
      transactions: txs,
      accounts: [mockCardIndividual],
      subscriptions: [],
      referenceDate,
      savingsPercent: 0,
    });

    expect(result.committedInstallmentsTotal).toBe(100.0);
    expect(result.variableSpentSoFar).toBe(50.0); // O celular NÃO pode estar aqui!
    // Saldo livre = 2000 - 100 (parcela) - 50 (mercado) = 1850
    expect(result.availableToSpend).toBe(1850.0);
  });

  it('generates accurate variation explanation when new installments decrease weekly budget', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-salary',
        accountId: 'acc-checking',
        categoryId: 'cat-salary',
        amount: 2000.0,
        type: 'income',
        description: 'Salário',
        date: '2026-10-05T10:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'manual',
        createdAt: '2026-10-05',
        updatedAt: '2026-10-05',
      },
      {
        id: 'tx-inst-new',
        accountId: mockCardIndividual.id,
        categoryId: 'cat-compras',
        amount: 300.0,
        type: 'expense',
        description: 'TV Nova (1/10)',
        date: '2026-10-15T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        isInstallment: true,
        createdAt: '2026-10-15',
        updatedAt: '2026-10-15',
      },
    ];

    // Meta anterior sem parcelas: baselineWeeklyAmount = R$ 900
    const result = calculateSafeToSpendBudget({
      transactions: txs,
      accounts: [mockCardIndividual],
      subscriptions: [],
      referenceDate,
      savingsPercent: 0,
      baselineGoal: {
        baselineWeeklyAmount: 1076.0,
        committedInstallmentsAmount: 0.0,
        committedSubscriptionsAmount: 0.0,
      },
    });

    expect(result.explanation.direction).toBe('decreased');
    expect(result.explanation.primaryCause).toBe('installments');
    expect(result.explanation.reasonText).toContain('compras parceladas');
  });

  it('deducts active subscriptions applying the shared card ratio', () => {
    const mockSubs: Subscription[] = [
      {
        id: 'sub-netflix',
        name: 'Netflix Casal',
        amount: 60.0,
        categoryId: 'cat-stream',
        accountId: mockCardShared50.id,
        cadence: 'monthly',
        nextBillingDate: '2026-10-25',
        status: 'active',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'sub-spotify',
        name: 'Spotify Pessoal',
        amount: 30.0,
        categoryId: 'cat-stream',
        accountId: mockCardIndividual.id,
        cadence: 'monthly',
        nextBillingDate: '2026-10-22',
        status: 'active',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];

    const result = calculateSafeToSpendBudget({
      transactions: [],
      accounts: [mockCardIndividual, mockCardShared50],
      subscriptions: mockSubs,
      overrideIncome: 3000.0,
      referenceDate,
      savingsPercent: 0,
    });

    // Netflix casal (60 * 0.5 = 30) + Spotify pessoal (30 * 1 = 30) = 60
    expect(result.committedSubscriptionsTotal).toBe(60.0);
    expect(result.committedTotal).toBe(60.0);
    // Saldo livre = 3000 - 60 = 2940
    expect(result.availableToSpend).toBe(2940.0);
  });

  it('detects increase in weekly budget after installment is paid off', () => {
    // Agora não há parcelas ativas
    const result = calculateSafeToSpendBudget({
      transactions: [],
      accounts: [mockCardIndividual],
      subscriptions: [],
      overrideIncome: 2000.0,
      referenceDate,
      savingsPercent: 0,
      baselineGoal: {
        baselineWeeklyAmount: 700.0,
        committedInstallmentsAmount: 300.0,
        committedSubscriptionsAmount: 0.0,
      },
    });

    expect(result.explanation.direction).toBe('increased');
    expect(result.explanation.primaryCause).toBe('installments');
    expect(result.explanation.reasonText).toContain('quitação de parcelas');
  });
});
