import { describe, it, expect } from 'vitest';
import { sobraAiEngine } from '../src/core/ai/sobraAiEngine';
import { Account, Transaction, Budget, Category } from '../src/core/types';

describe('Sobra AI • Motor de Inteligência Financeira e Insights Ativos', () => {
  const refDate = new Date(2026, 8, 15); // Setembro/2026

  const mockCategories: Category[] = [
    { id: 'cat-alim', name: 'Alimentação', type: 'expense', icon: 'Utensils', color: '#F59E0B', isCustom: false, createdAt: '' },
    { id: 'cat-lazer', name: 'Lazer & Entretenimento', type: 'expense', icon: 'Film', color: '#8B5CF6', isCustom: false, createdAt: '' },
    { id: 'cat-salario', name: 'Salário & Renda', type: 'income', icon: 'Briefcase', color: '#10B981', isCustom: false, createdAt: '' },
  ];

  it('calcula o Sobra Health Score com alta pontuação (Grau A/A+) para finanças saudáveis', () => {
    const healthyAccounts: Account[] = [
      {
        id: 'acc-1',
        name: 'Conta Corrente',
        type: 'checking',
        balance: 5000.00,
        color: '#10B981',
        icon: 'Wallet',
        currency: 'BRL',
        syncStatus: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'acc-card',
        name: 'Cartão Black',
        type: 'credit_card',
        balance: 600.00, // Fatura de R$ 600 em limite de R$ 5.000 (12%)
        creditLimit: 5000.00,
        color: '#820AD1',
        icon: 'CreditCard',
        currency: 'BRL',
        syncStatus: 'manual',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const healthyTxns: Transaction[] = [
      {
        id: 'tx-inc-1',
        accountId: 'acc-1',
        categoryId: 'cat-salario',
        amount: 6000.00,
        type: 'income',
        description: 'Salário Mensal',
        date: '2026-09-05',
        status: 'confirmed',
        paymentMethod: 'transfer',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'tx-exp-1',
        accountId: 'acc-1',
        categoryId: 'cat-alim',
        amount: 1200.00,
        type: 'expense',
        description: 'Mercado',
        date: '2026-09-10',
        status: 'confirmed',
        paymentMethod: 'debit',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const healthyBudgets: Budget[] = [
      {
        id: 'b-1',
        categoryId: 'cat-alim',
        monthlyLimit: 2000.00,
        month: 9,
        year: 2026,
        createdAt: '',
      },
    ];

    const score = sobraAiEngine.calculateHealthScore(
      healthyAccounts,
      healthyTxns,
      healthyBudgets,
      [],
      refDate
    );

    expect(score.overallScore).toBeGreaterThanOrEqual(80);
    expect(['A+', 'A']).toContain(score.grade);
    expect(score.status).toBe('excelente');
    expect(score.pillars).toHaveLength(4);

    // Pilar de sobra deve estar excelente (gastou 1200 de 6000 -> sobra > 25%)
    const savingsPillar = score.pillars.find(p => p.type === 'savings');
    expect(savingsPillar?.score).toBe(100);

    // Pilar de cartões deve estar excelente (uso 600 / 5000 = 12% <= 30%)
    const creditPillar = score.pillars.find(p => p.type === 'credit_cards');
    expect(creditPillar?.score).toBe(100);
  });

  it('detecta anomalias de pico de gastos (Spike Detection) em relação à média dos últimos 3 meses', () => {
    // Histórico dos 3 meses anteriores: média de R$ 100 em Lazer
    // Mês 8 (Agosto): R$ 100
    // Mês 7 (Julho): R$ 100
    // Mês 6 (Junho): R$ 100
    // Mês 9 (Setembro - atual): R$ 350 (salto de +250%)
    const txnsWithSpike: Transaction[] = [
      {
        id: 'tx-past-1',
        accountId: 'acc-1',
        categoryId: 'cat-lazer',
        amount: 100.00,
        type: 'expense',
        description: 'Cinema Agosto',
        date: '2026-08-10',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'tx-past-2',
        accountId: 'acc-1',
        categoryId: 'cat-lazer',
        amount: 100.00,
        type: 'expense',
        description: 'Cinema Julho',
        date: '2026-07-10',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'tx-past-3',
        accountId: 'acc-1',
        categoryId: 'cat-lazer',
        amount: 100.00,
        type: 'expense',
        description: 'Cinema Junho',
        date: '2026-06-10',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'tx-curr-spike',
        accountId: 'acc-1',
        categoryId: 'cat-lazer',
        amount: 350.00,
        type: 'expense',
        description: 'Show e Ingressos Setembro',
        date: '2026-09-08',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const anomalies = sobraAiEngine.detectCategoryAnomalies(txnsWithSpike, mockCategories, refDate);

    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    const spike = anomalies.find(a => a.id.includes('cat-lazer'));
    expect(spike).toBeDefined();
    expect(spike?.title).toContain('Lazer & Entretenimento');
    expect(spike?.highlightValue).toContain('+250%');
    expect(spike?.severity).toBe('critical'); // > 60% increase
  });

  it('detecta risco crítico de liquidez quando faturas superam o saldo em conta corrente', () => {
    const tightAccounts: Account[] = [
      {
        id: 'acc-cash',
        name: 'Conta Corrente',
        type: 'checking',
        balance: 400.00, // Apenas R$ 400 em conta
        color: '#10B981',
        icon: 'Wallet',
        currency: 'BRL',
        syncStatus: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'acc-card',
        name: 'Cartão Nubank',
        type: 'credit_card',
        balance: 1200.00, // Fatura de R$ 1.200 a pagar!
        creditLimit: 2000.00,
        color: '#820AD1',
        icon: 'CreditCard',
        currency: 'BRL',
        syncStatus: 'manual',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const liquidityInsights = sobraAiEngine.analyzeLiquidityAndCards(tightAccounts, []);
    const deficitInsight = liquidityInsights.find(i => i.id === 'insight-liquidity-deficit');

    expect(deficitInsight).toBeDefined();
    expect(deficitInsight?.severity).toBe('critical');
    expect(deficitInsight?.title).toContain('Cobertura de Faturas');
    expect(deficitInsight?.highlightValue).toBe('R$\u00A0800,00'); // Déficit de 800 (1200 - 400)
  });

  it('detecta padrão comportamental de concentração de gastos em fins de semana', () => {
    const weekendTxns: Transaction[] = [
      // 2026-09-05 foi Sábado (R$ 300)
      {
        id: 'tx-sat-1',
        accountId: 'acc-1',
        categoryId: 'cat-alim',
        amount: 300.00,
        type: 'expense',
        description: 'Restaurante Sábado',
        date: '2026-09-05',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      // 2026-09-06 foi Domingo (R$ 250)
      {
        id: 'tx-sun-1',
        accountId: 'acc-1',
        categoryId: 'cat-lazer',
        amount: 250.00,
        type: 'expense',
        description: 'Passeio Domingo',
        date: '2026-09-06',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      // 2026-09-08 foi Terça (R$ 100)
      {
        id: 'tx-tue-1',
        accountId: 'acc-1',
        categoryId: 'cat-alim',
        amount: 100.00,
        type: 'expense',
        description: 'Almoço Terça',
        date: '2026-09-08',
        status: 'confirmed',
        paymentMethod: 'debit',
        source: 'manual',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const { pattern, insights } = sobraAiEngine.detectSpendingPattern(weekendTxns);

    // Total: 650. Fim de semana: 550 / 650 = 84.6%
    expect(pattern.weekendExpenseRatio).toBeGreaterThan(50);
    expect(insights.length).toBeGreaterThanOrEqual(1);
    expect(insights[0].title).toContain('Padrão de Fim de Semana');
  });

  it('gera o diagnóstico completo consolidado com o Plano de Ação Estratégico em 3 Passos', () => {
    const fullDiagnosis = sobraAiEngine.generateFullDiagnosis(
      [
        {
          id: 'acc-1',
          name: 'Conta Teste',
          type: 'checking',
          balance: 3000.00,
          color: '#10B981',
          icon: 'Wallet',
          currency: 'BRL',
          syncStatus: 'manual',
          createdAt: '',
          updatedAt: '',
        },
      ],
      mockCategories,
      [],
      [],
      [],
      [],
      refDate
    );

    expect(fullDiagnosis).toBeDefined();
    expect(fullDiagnosis.score).toBeDefined();
    expect(fullDiagnosis.actionPlan).toHaveLength(3);
    expect(fullDiagnosis.actionPlan[0].stepNumber).toBe(1);
    expect(fullDiagnosis.actionPlan[1].stepNumber).toBe(2);
    expect(fullDiagnosis.actionPlan[2].stepNumber).toBe(3);
    expect(fullDiagnosis.strengths.length).toBeGreaterThan(0);
  });
});
