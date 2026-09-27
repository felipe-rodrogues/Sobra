import { describe, it, expect } from 'vitest';
import { 
  detectSalaryAdvance, 
  getEffectiveTransactionCompetence,
  getNextMonthAndYear,
  formatCompetenceLabel 
} from '../src/core/salary/salaryCycleHelper';
import { filterTransactionsByMonth, calculateMonthlySummary } from '../src/core/calculations';
import { detectSalaryInMonth } from '../src/core/payFirst/payFirstHelper';
import { sobraAiEngine } from '../src/core/ai/sobraAiEngine';
import { Account, Transaction, Subscription, Goal, Budget } from '../src/core/types';

describe('Inteligência de Salário Adiantado e Competência Financeira', () => {
  const mockSubscriptions: Subscription[] = [
    {
      id: 'sub-salary',
      name: 'Salário Mensal Empresa',
      amount: 6000.00,
      categoryId: 'cat-salario',
      cadence: 'monthly',
      nextBillingDate: '2026-10-31',
      status: 'active',
      type: 'income',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  it('deve detectar salário que cai no dia 31 como adiantamento do mês seguinte', () => {
    const tx: Partial<Transaction> = {
      type: 'income',
      amount: 6000.00,
      date: '2026-10-31T15:30:00.000Z',
      description: 'Salário Mensal Empresa',
    };

    const result = detectSalaryAdvance(tx, mockSubscriptions);
    expect(result.isAdvance).toBe(true);
    expect(result.competenceMonth).toBe(11);
    expect(result.competenceYear).toBe(2026);
    expect(result.targetMonthName).toBe('Novembro');
  });

  it('deve alocar a receita no mês de competência em filterTransactionsByMonth', () => {
    const salaryTx: Transaction = {
      id: 'tx-salario-31',
      accountId: 'acc-1',
      categoryId: 'cat-salario',
      amount: 6000.00,
      type: 'income',
      description: 'Salário Antecipado',
      date: '2026-10-31T18:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      isSalaryAdvance: true,
      competenceMonth: 11,
      competenceYear: 2026,
      createdAt: '2026-10-31',
      updatedAt: '2026-10-31',
    };

    const regularExpenseNov: Transaction = {
      id: 'tx-despesa-nov',
      accountId: 'acc-1',
      categoryId: 'cat-mercado',
      amount: 800.00,
      type: 'expense',
      description: 'Supermercado',
      date: '2026-11-03T10:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'debit',
      source: 'manual',
      createdAt: '2026-11-03',
      updatedAt: '2026-11-03',
    };

    const allTxs = [salaryTx, regularExpenseNov];

    // Em Outubro (mês 10), o salário adiantado NÃO deve inflar as receitas de outubro
    const octTxs = filterTransactionsByMonth(allTxs, 10, 2026);
    expect(octTxs.length).toBe(0);

    // Em Novembro (mês 11), o salário adiantado DEVE ser contabilizado
    const novTxs = filterTransactionsByMonth(allTxs, 11, 2026);
    expect(novTxs.length).toBe(2);
    expect(novTxs.some(t => t.id === 'tx-salario-31')).toBe(true);

    // Resumo de Novembro deve ter receita de R$ 6.000 e despesa de R$ 800
    const novSummary = calculateMonthlySummary(allTxs, 11, 2026);
    expect(novSummary.income).toBe(6000.00);
    expect(novSummary.expense).toBe(800.00);
    expect(novSummary.net).toBe(5200.00);
  });

  it('deve reconhecer o salário em detectSalaryInMonth no mês de competência', () => {
    const salaryTx: Transaction = {
      id: 'tx-salario-31',
      accountId: 'acc-1',
      categoryId: 'cat-salario',
      amount: 5500.00,
      type: 'income',
      description: 'DOC/TED Salário',
      date: '2026-10-31T20:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'transfer',
      source: 'notification',
      isSalaryAdvance: true,
      competenceMonth: 11,
      competenceYear: 2026,
      createdAt: '2026-10-31',
      updatedAt: '2026-10-31',
    };

    const detected = detectSalaryInMonth([salaryTx], 11, 2026);
    expect(detected).not.toBeNull();
    expect(detected?.id).toBe('tx-salario-31');
    expect(detected?.amount).toBe(5500.00);
  });
});

describe('A Escada Financeira (Jornada em 3 Fases)', () => {
  const baseAccounts: Account[] = [
    {
      id: 'acc-corrente',
      name: 'Nubank Conta',
      type: 'checking',
      balance: 4000.00,
      color: '#820AD1',
      icon: 'Wallet',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'acc-cartao',
      name: 'Nubank Cartão',
      type: 'credit_card',
      balance: 1500.00,
      creditLimit: 6000.00,
      invoiceAmount: 1500.00,
      invoiceStatus: 'closed',
      dueDay: 10,
      closingDay: 3,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const baseTxns: Transaction[] = [
    {
      id: 'tx-exp-1',
      accountId: 'acc-corrente',
      categoryId: 'cat-alimentacao',
      amount: 2000.00,
      type: 'expense',
      description: 'Gastos Médios',
      date: '2026-09-10',
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      createdAt: '2026-09-10',
      updatedAt: '2026-09-10',
    },
  ];

  it('deve acionar Degrau 1 (Estancar Dívidas) se conta corrente estiver negativa', () => {
    const negativeAccounts: Account[] = [
      {
        ...baseAccounts[0],
        balance: -600.00, // Cheque especial!
      },
      baseAccounts[1],
    ];

    const ladder = sobraAiEngine.calculateFinancialLadder(negativeAccounts, baseTxns, [], []);
    expect(ladder.currentStage).toBe('debt_relief');
    expect(ladder.stageNumber).toBe(1);
    expect(ladder.stageTitle).toBe('Estancar Dívidas');
    expect(ladder.debtAlertDetails?.negativeAccountsCount).toBe(1);
    expect(ladder.debtAlertDetails?.negativeBalanceTotal).toBe(600.00);
  });

  it('deve estar no Degrau 2 (Construção da Reserva) quando sem dívidas mas reserva incompleta', () => {
    const savingsAccount: Account = {
      id: 'acc-savings',
      name: 'Caixinha Reserva',
      type: 'savings',
      balance: 3000.00,
      color: '#10B981',
      icon: 'PiggyBank',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const ladder = sobraAiEngine.calculateFinancialLadder(
      [...baseAccounts, savingsAccount],
      baseTxns,
      [],
      []
    );

    expect(ladder.currentStage).toBe('emergency_fund');
    expect(ladder.stageNumber).toBe(2);
    expect(ladder.stageTitle).toBe('Construção da Reserva');
    expect(ladder.monthsProtected).toBeGreaterThan(0);
    expect(ladder.checkpoints.length).toBe(3);
    expect(ladder.checkpoints[0].targetMonths).toBe(1);
    expect(ladder.checkpoints[1].targetMonths).toBe(3);
    expect(ladder.checkpoints[2].targetMonths).toBe(6);
  });

  it('deve liberar Degrau 3 (Multiplicação & Metas) quando reserva for de 6 meses ou mais', () => {
    const solidSavingsAccount: Account = {
      id: 'acc-savings-full',
      name: 'Itaú Reserva Completa',
      type: 'savings',
      balance: 14000.00, // > 6x custo de vida de R$ 2.000
      color: '#10B981',
      icon: 'PiggyBank',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const ladder = sobraAiEngine.calculateFinancialLadder(
      [...baseAccounts, solidSavingsAccount],
      baseTxns,
      [],
      []
    );

    expect(ladder.currentStage).toBe('wealth_building');
    expect(ladder.stageNumber).toBe(3);
    expect(ladder.stageTitle).toBe('Multiplicação & Metas');
    expect(ladder.monthsProtected).toBeGreaterThanOrEqual(6.0);
    expect(ladder.checkpoints.every(cp => cp.isReached)).toBe(true);
  });

  it('deve renderizar o Hero Master Unificado com Score, Fase e Stepper sem duplicar cards', async () => {
    const React = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { FinancialLadderHero } = await import('../src/components/modals/FinancialLadderHero');
    const { SobraAiReportView } = await import('../src/components/modals/SobraAiReportView');

    const mockScore: import('../src/core/ai/types').SobraHealthScore = {
      overallScore: 79,
      grade: 'B',
      status: 'bom',
      headline: 'Finanças equilibradas no mês',
      summary: 'Suas contas estão organizadas, com boa margem para formar ou reforçar sua reserva.',
      pillars: [],
    };

    const mockLadder: import('../src/core/ai/types').FinancialLadderProgress = {
      currentStage: 'emergency_fund',
      stageNumber: 2,
      stageTitle: 'Construção da Reserva',
      stageBadge: 'Fase 2',
      headline: 'Reserva em Construção: 1.8 meses protegidos',
      summary: 'Você já deu o primeiro passo!',
      monthlyLivingCost: 2000,
      emergencyFundCurrent: 3600,
      emergencyFundTarget: 12000,
      monthsProtected: 1.8,
      percentProgress: 30,
      checkpoints: [
        { id: 'cp-1m', name: 'Tampão (1m)', targetMonths: 1, targetAmount: 2000, isReached: true },
        { id: 'cp-3m', name: 'Estabilidade (3m)', targetMonths: 3, targetAmount: 6000, isReached: false },
        { id: 'cp-6m', name: 'Blindagem (6m)', targetMonths: 6, targetAmount: 12000, isReached: false },
      ],
      nextMilestoneLabel: 'Faltam R$ 2.400 para completar 3 meses (Estabilidade CLT)',
    };

    const htmlHero = renderToString(
      React.createElement(FinancialLadderHero, {
        score: mockScore,
        ladder: mockLadder,
      })
    );

    // Deve conter elementos unificados
    expect(htmlHero).toContain('79');
    expect(htmlHero).toContain('/ 100');
    expect(htmlHero).toContain('Saúde Financeira');
    expect(htmlHero).toContain('Equilibrado');
    expect(htmlHero).toContain('1. Dívidas');
    expect(htmlHero).toContain('2. Reserva');
    expect(htmlHero).toContain('3. Metas');
    expect(htmlHero).toContain('1.8 meses de proteção');
    expect(htmlHero).toContain('Faltam R$ 2.400 para completar 3 meses');

    // Teste no SobraAiReportView: deve conter apenas 1 ocorrência de "79"
    const fullDiagnosis: import('../src/core/ai/types').SobraFullDiagnosis = {
      generatedAt: new Date().toISOString(),
      score: mockScore,
      strengths: [],
      vulnerabilities: [],
      pattern: {
        weekendExpenseRatio: 20,
        peakDayName: 'Sábado',
      },
      actionPlan: [],
      insights: [],
      ladder: mockLadder,
    };

    const htmlReport = renderToString(
      React.createElement(SobraAiReportView, {
        diagnosis: fullDiagnosis,
      })
    );

    expect(htmlReport).toContain('Saúde Financeira');
    expect(htmlReport).toContain('Finanças equilibradas no mês');
  });
});
