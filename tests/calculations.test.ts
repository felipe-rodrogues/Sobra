import { describe, it, expect } from 'vitest';
import { 
  calculateConsolidatedBalance, 
  calculateMonthlySummary, 
  calculateSpendingByCategory, 
  calculateBudgetStatuses, 
  calculateGoalProgress,
  calculateBalanceTrend,
  calculateBurnRateProjection
} from '../src/core/calculations';
import { Account, Transaction, Category, Budget, Goal } from '../src/core/types';

describe('Financial Calculations Engine', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      name: 'Nubank Corrente',
      type: 'checking',
      balance: 1500.50,
      color: '#820AD1',
      icon: 'Wallet',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'acc-2',
      name: 'Itaú Poupança',
      type: 'savings',
      balance: 3000.00,
      color: '#EC7000',
      icon: 'PiggyBank',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'acc-3',
      name: 'Cartão de Crédito',
      type: 'credit_card',
      balance: -450.25, // Fatura em aberto
      color: '#1E293B',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const mockCategories: Category[] = [
    { id: 'cat-salario', name: 'Salário', type: 'income', icon: 'Briefcase', color: '#10B981', isCustom: false, createdAt: '' },
    { id: 'cat-alim', name: 'Alimentação', type: 'expense', icon: 'Utensils', color: '#F59E0B', isCustom: false, createdAt: '' },
    { id: 'cat-transp', name: 'Transporte', type: 'expense', icon: 'Car', color: '#3B82F6', isCustom: false, createdAt: '' },
  ];

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      accountId: 'acc-1',
      categoryId: 'cat-salario',
      amount: 5000.00,
      type: 'income',
      description: 'Salário Mensal',
      date: '2026-09-05T12:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'transfer',
      source: 'manual',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'tx-2',
      accountId: 'acc-1',
      categoryId: 'cat-alim',
      amount: 600.00,
      type: 'expense',
      description: 'Supermercado',
      date: '2026-09-10T15:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'debit',
      source: 'manual',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'tx-3',
      accountId: 'acc-3',
      categoryId: 'cat-transp',
      amount: 250.00,
      type: 'expense',
      description: 'Combustível',
      date: '2026-09-12T10:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'tx-pending',
      accountId: 'acc-1',
      categoryId: 'cat-alim',
      amount: 999.00,
      type: 'expense',
      description: 'Compra não confirmada',
      date: '2026-09-12T10:00:00.000Z',
      status: 'pending_review',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    },
  ];

  it('deve calcular o saldo consolidado corretamente', () => {
    const total = calculateConsolidatedBalance(mockAccounts);
    // 1500.50 + 3000.00 - 450.25 = 4050.25
    expect(total).toBe(4050.25);
  });

  it('deve calcular o resumo mensal ignorando transações pendentes de revisão', () => {
    const summary = calculateMonthlySummary(mockTransactions, 9, 2026);
    expect(summary.income).toBe(5000.00);
    expect(summary.expense).toBe(850.00); // 600 + 250 (ignora 999 pendente)
    expect(summary.net).toBe(4150.00);
    expect(summary.transactionCount).toBe(3);
  });

  it('deve agrupar os gastos por categoria com percentuais corretos', () => {
    const spending = calculateSpendingByCategory(mockTransactions, mockCategories, 9, 2026);
    expect(spending).toHaveLength(2);
    // 600 em Alimentação, 250 em Transporte -> Total 850
    expect(spending[0].categoryName).toBe('Alimentação');
    expect(spending[0].amount).toBe(600.00);
    expect(spending[0].percentage).toBeCloseTo(70.6, 1);
    
    expect(spending[1].categoryName).toBe('Transporte');
    expect(spending[1].amount).toBe(250.00);
    expect(spending[1].percentage).toBeCloseTo(29.4, 1);
  });

  it('deve calcular o status de alerta de orçamentos (normal, warning, danger)', () => {
    const budgets: Budget[] = [
      {
        id: 'b-1',
        categoryId: 'cat-alim',
        monthlyLimit: 500.00, // Gasto foi 600 -> DANGER (> 100%)
        month: 9,
        year: 2026,
        createdAt: '',
      },
      {
        id: 'b-2',
        categoryId: 'cat-transp',
        monthlyLimit: 300.00, // Gasto foi 250 -> 250/300 = 83.3% -> WARNING (80-100%)
        month: 9,
        year: 2026,
        createdAt: '',
      },
      {
        id: 'b-3',
        categoryId: 'cat-salario',
        monthlyLimit: 1000.00, // Gasto foi 0 -> NORMAL (< 80%)
        month: 9,
        year: 2026,
        createdAt: '',
      },
    ];

    const results = calculateBudgetStatuses(budgets, mockCategories, mockTransactions, 9, 2026);

    const alimStatus = results.find(r => r.categoryId === 'cat-alim');
    expect(alimStatus?.status).toBe('danger');
    expect(alimStatus?.spentAmount).toBe(600.00);

    const transpStatus = results.find(r => r.categoryId === 'cat-transp');
    expect(transpStatus?.status).toBe('warning');
    expect(transpStatus?.percentageSpent).toBeCloseTo(83.3, 1);

    const salStatus = results.find(r => r.categoryId === 'cat-salario');
    expect(salStatus?.status).toBe('normal');
    expect(salStatus?.percentageSpent).toBe(0);
  });

  it('deve calcular o progresso da meta financeira', () => {
    const goal: Goal = {
      id: 'g-1',
      name: 'Reserva de Emergência',
      targetAmount: 10000.00,
      currentAmount: 4500.00,
      targetDate: '2026-12-31',
      color: '#10B981',
      icon: 'ShieldCheck',
      isCompleted: false,
      createdAt: '',
    };

    const progress = calculateGoalProgress(goal, new Date('2026-09-01'));
    expect(progress.percentageCompleted).toBe(45.0);
    expect(progress.remainingAmount).toBe(5500.00);
    expect(progress.isCompleted).toBe(false);
    expect(progress.isOverdue).toBe(false);
    expect(progress.daysRemaining).toBeGreaterThan(0);
  });

  it('deve calcular a tendência real do saldo em relação ao mês anterior', () => {
    const historicalTxns: Transaction[] = [
      // Mês 8 (Agosto): Receita 4000, Despesa 1000 => Sobra = 3000
      {
        id: 'tx-aug-1',
        accountId: 'acc-1',
        categoryId: 'cat-salario',
        amount: 4000.00,
        type: 'income',
        description: 'Salário Agosto',
        date: '2026-08-05T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'tx-aug-2',
        accountId: 'acc-1',
        categoryId: 'cat-alim',
        amount: 1000.00,
        type: 'expense',
        description: 'Mercado Agosto',
        date: '2026-08-10T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      // Mês 9 (Setembro): Receita 5000, Despesa 1000 => Sobra = 4000 (+33.3%)
      {
        id: 'tx-sep-1',
        accountId: 'acc-1',
        categoryId: 'cat-salario',
        amount: 5000.00,
        type: 'income',
        description: 'Salário Setembro',
        date: '2026-09-05T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'tx-sep-2',
        accountId: 'acc-1',
        categoryId: 'cat-alim',
        amount: 1000.00,
        type: 'expense',
        description: 'Mercado Setembro',
        date: '2026-09-10T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const trend = calculateBalanceTrend(historicalTxns, 9, 2026);
    expect(trend.hasPreviousData).toBe(true);
    expect(trend.isPositive).toBe(true);
    expect(trend.percentageChange).toBe(33.3);
    expect(trend.label).toBe('+33,3%');
    expect(trend.comparisonText).toBe('em relação ao mês passado');
  });

  it('deve calcular a projeção de gastos e sobra respeitando contas compartilhadas (50/50)', () => {
    const sharedAccount: Account = {
      id: 'acc-shared',
      name: 'Cartão Casal',
      type: 'credit_card',
      balance: 0,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      isShared: true,
      splitMode: 'half',
      splitRatio: 0.5,
      syncStatus: 'synced',
      createdAt: '',
      updatedAt: '',
    };

    const sharedTransactions: Transaction[] = [
      {
        id: 'tx-inc',
        accountId: 'acc-1',
        categoryId: 'cat-salario',
        amount: 3000,
        type: 'income',
        description: 'Salário',
        date: '2026-09-01T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'tx-shared-exp',
        accountId: 'acc-shared',
        categoryId: 'cat-alim',
        amount: 1000, // No banco é R$ 1000, mas a cota do usuário é R$ 500 (50%)
        type: 'expense',
        description: 'Mercado Casal',
        date: '2026-09-05T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const refDate = new Date(2026, 8, 10); // 10 de setembro
    const projection = calculateBurnRateProjection(sharedTransactions, refDate, [sharedAccount]);

    expect(projection.currentIncome).toBe(3000);
    // currentExpense deve ser 500 (50% de 1000), e NÃO 1000
    expect(projection.currentExpense).toBe(500);
    // burn rate nos primeiros 10 dias: 500 / 10 = 50/dia
    expect(projection.dailyBurnRate).toBe(50);
    // projeção total: 500 + 50 * 20 = 1500
    expect(projection.projectedExpense).toBe(1500);
    // sobra projetada: 3000 - 1500 = 1500
    expect(projection.projectedSobra).toBe(1500);
  });
});

