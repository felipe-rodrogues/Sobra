import { describe, it, expect } from 'vitest';
import { 
  calculateHistoricalMonthlySummary, 
  calculateBurnRateProjection 
} from '../src/core/calculations';
import { Transaction } from '../src/core/types';

describe('Cálculos Analíticos e Projeções Financeiras', () => {
  const sampleTransactions: Transaction[] = [
    // Setembro 2026 (Mês corrente)
    {
      id: 'tx-1',
      accountId: 'acc-1',
      categoryId: 'cat-salario',
      amount: 5000.00,
      type: 'income',
      description: 'Salário Setembro',
      date: '2026-09-05T10:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'transfer',
      source: 'manual',
      createdAt: '2026-09-05T10:00:00.000Z',
      updatedAt: '2026-09-05T10:00:00.000Z',
    },
    {
      id: 'tx-2',
      accountId: 'acc-1',
      categoryId: 'cat-moradia',
      amount: 1500.00,
      type: 'expense',
      description: 'Aluguel',
      date: '2026-09-08T10:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      createdAt: '2026-09-08T10:00:00.000Z',
      updatedAt: '2026-09-08T10:00:00.000Z',
    },
    // Agosto 2026
    {
      id: 'tx-3',
      accountId: 'acc-1',
      categoryId: 'cat-salario',
      amount: 5000.00,
      type: 'income',
      description: 'Salário Agosto',
      date: '2026-08-05T10:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'transfer',
      source: 'manual',
      createdAt: '2026-08-05T10:00:00.000Z',
      updatedAt: '2026-08-05T10:00:00.000Z',
    },
    {
      id: 'tx-4',
      accountId: 'acc-1',
      categoryId: 'cat-moradia',
      amount: 2200.00,
      type: 'expense',
      description: 'Aluguel e Contas Agosto',
      date: '2026-08-10T10:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      createdAt: '2026-08-10T10:00:00.000Z',
      updatedAt: '2026-08-10T10:00:00.000Z',
    },
  ];

  it('calcula o histórico de 6 meses corretamente, incluindo labels e saldos', () => {
    // Referência: 12 de Setembro de 2026
    const refDate = new Date(2026, 8, 12); // Mês 8 = Setembro
    const history = calculateHistoricalMonthlySummary(sampleTransactions, 6, refDate);

    expect(history).toHaveLength(6);

    // O último mês da série deve ser Setembro 2026 (mês de referência)
    const currentMonthData = history[history.length - 1];
    expect(currentMonthData.month).toBe(9);
    expect(currentMonthData.year).toBe(2026);
    expect(currentMonthData.label).toBe('Set');
    expect(currentMonthData.income).toBe(5000.00);
    expect(currentMonthData.expense).toBe(1500.00);
    expect(currentMonthData.net).toBe(3500.00);
    expect(currentMonthData.isSurplus).toBe(true);
    expect(currentMonthData.isCurrentMonth).toBe(true);

    // O penúltimo mês deve ser Agosto 2026
    const prevMonthData = history[history.length - 2];
    expect(prevMonthData.month).toBe(8);
    expect(prevMonthData.year).toBe(2026);
    expect(prevMonthData.income).toBe(5000.00);
    expect(prevMonthData.expense).toBe(2200.00);
    expect(prevMonthData.net).toBe(2800.00);
    expect(prevMonthData.isSurplus).toBe(true);
  });

  it('lida perfeitamente com virada de ano na série histórica de 6 meses', () => {
    // Referência: 15 de Fevereiro de 2026
    const refDate = new Date(2026, 1, 15); // Fevereiro 2026
    const history = calculateHistoricalMonthlySummary([], 6, refDate);

    expect(history).toHaveLength(6);
    // A sequência esperada de meses é: Set/25, Out/25, Nov/25, Dez/25, Jan/26, Fev/26
    expect(history[0].month).toBe(9);
    expect(history[0].year).toBe(2025);
    expect(history[3].month).toBe(12);
    expect(history[3].year).toBe(2025);
    expect(history[4].month).toBe(1);
    expect(history[4].year).toBe(2026);
    expect(history[5].month).toBe(2);
    expect(history[5].year).toBe(2026);
  });

  it('projeta o Burn Rate diário e a sobra no fim do mês com precisão matemática', () => {
    // Referência: Dia 10 de Setembro (Setembro tem 30 dias)
    const refDate = new Date(2026, 8, 10);
    const projection = calculateBurnRateProjection(sampleTransactions, refDate);

    expect(projection.currentDay).toBe(10);
    expect(projection.totalDaysInMonth).toBe(30);
    expect(projection.elapsedDays).toBe(10);
    expect(projection.remainingDays).toBe(20);
    expect(projection.monthProgressPercent).toBe(33); // 10/30 = 33.3%

    // Gasto acumulado até dia 10: R$ 1.500,00
    expect(projection.currentExpense).toBe(1500.00);
    // Gasto médio por dia (Burn Rate): 1500 / 10 = R$ 150,00/dia
    expect(projection.dailyBurnRate).toBe(150.00);

    // Gasto projetado para os 30 dias: 1500 + (150 * 20) = R$ 4.500,00
    expect(projection.projectedExpense).toBe(4500.00);

    // Receita do mês: R$ 5.000,00
    // Sobra estimada: 5000 - 4500 = R$ +500,00
    expect(projection.projectedSobra).toBe(500.00);

    // Saldo ainda a gastar: 5000 - 1500 = 3500
    // Teto diário recomendado: 3500 / 20 = R$ 175,00/dia
    expect(projection.recommendedDailyBudget).toBe(175.00);

    // Como 500 >= 10% de 5000, status de sobra positiva
    expect(projection.paceStatus).toBe('on_track');
  });

  it('identifica ritmo acelerado (fast_burn) quando a projeção ultrapassa a renda', () => {
    const heavySpendingTransactions: Transaction[] = [
      {
        id: 'tx-inc',
        accountId: 'acc-1',
        categoryId: 'cat-salario',
        amount: 3000.00,
        type: 'income',
        description: 'Salário',
        date: '2026-09-02T10:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'transfer',
        source: 'manual',
        createdAt: '2026-09-02T10:00:00.000Z',
        updatedAt: '2026-09-02T10:00:00.000Z',
      },
      {
        id: 'tx-exp-heavy',
        accountId: 'acc-1',
        categoryId: 'cat-alim',
        amount: 2500.00, // Gastou 2500 em apenas 5 dias
        type: 'expense',
        description: 'Gastos altos',
        date: '2026-09-05T10:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'manual',
        createdAt: '2026-09-05T10:00:00.000Z',
        updatedAt: '2026-09-05T10:00:00.000Z',
      }
    ];

    const refDate = new Date(2026, 8, 5);
    const projection = calculateBurnRateProjection(heavySpendingTransactions, refDate);

    // 2500 em 5 dias = 500/dia. Em 30 dias = 15.000 de gastos projetados
    expect(projection.dailyBurnRate).toBe(500.00);
    expect(projection.projectedSobra).toBeLessThan(0);
    expect(projection.paceStatus).toBe('fast_burn');
  });
});
