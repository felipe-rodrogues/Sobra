import { describe, it, expect } from 'vitest';
import { 
  getRecommendedBucketPercentages, 
  resolveReferenceIncome, 
  calculateThreeBucketsSummary,
  MINIMUM_WAGE_BR
} from '../src/core/buckets/threeBucketsEngine';
import { Category, Transaction, Goal, GoalContribution, Account } from '../src/core/types';

describe('Three Buckets Engine (Realidade BR)', () => {
  describe('getRecommendedBucketPercentages', () => {
    it('deve sugerir 80/15/5 para renda até R$ 2.800', () => {
      const result = getRecommendedBucketPercentages(2500);
      expect(result.essentialsPct).toBe(80);
      expect(result.lifestylePct).toBe(15);
      expect(result.futurePct).toBe(5);
      expect(result.tierName).toBe('Proteção Básica');
    });

    it('deve sugerir 70/20/10 para renda de R$ 2.801 até R$ 6.000', () => {
      const result = getRecommendedBucketPercentages(4200);
      expect(result.essentialsPct).toBe(70);
      expect(result.lifestylePct).toBe(20);
      expect(result.futurePct).toBe(10);
      expect(result.tierName).toBe('Construção de Fôlego');
    });

    it('deve sugerir 60/25/15 para renda de R$ 6.001 até R$ 12.000', () => {
      const result = getRecommendedBucketPercentages(8500);
      expect(result.essentialsPct).toBe(60);
      expect(result.lifestylePct).toBe(25);
      expect(result.futurePct).toBe(15);
      expect(result.tierName).toBe('Consolidação');
    });

    it('deve sugerir 50/30/20 para renda acima de R$ 12.000', () => {
      const result = getRecommendedBucketPercentages(15000);
      expect(result.essentialsPct).toBe(50);
      expect(result.lifestylePct).toBe(30);
      expect(result.futurePct).toBe(20);
      expect(result.tierName).toBe('Aceleração Patrimonial');
    });
  });

  describe('resolveReferenceIncome', () => {
    it('deve priorizar a renda manual quando fornecida', () => {
      const txns: Transaction[] = [
        {
          id: 'tx-1',
          accountId: 'acc-1',
          categoryId: 'cat-salario',
          amount: 3000,
          type: 'income',
          description: 'Salário',
          date: '2026-10-05T10:00:00.000Z',
          status: 'confirmed',
          paymentMethod: 'pix',
          source: 'manual',
          createdAt: '2026-10-05',
          updatedAt: '2026-10-05',
        }
      ];

      const res = resolveReferenceIncome(txns, 10, 2026, 4500);
      expect(res.income).toBe(4500);
      expect(res.source).toBe('manual');
    });

    it('deve usar a receita real confirmada no mês se não houver renda manual', () => {
      const txns: Transaction[] = [
        {
          id: 'tx-1',
          accountId: 'acc-1',
          categoryId: 'cat-salario',
          amount: 3200,
          type: 'income',
          description: 'Salário',
          date: '2026-10-05T10:00:00.000Z',
          status: 'confirmed',
          paymentMethod: 'pix',
          source: 'manual',
          createdAt: '2026-10-05',
          updatedAt: '2026-10-05',
        }
      ];

      const res = resolveReferenceIncome(txns, 10, 2026);
      expect(res.income).toBe(3200);
      expect(res.source).toBe('current_month');
    });

    it('deve usar o salário mínimo caso não haja transações de receita', () => {
      const res = resolveReferenceIncome([], 10, 2026);
      expect(res.income).toBe(MINIMUM_WAGE_BR);
      expect(res.source).toBe('minimum_wage');
    });
  });

  describe('calculateThreeBucketsSummary', () => {
    const mockCategories: Category[] = [
      { id: 'cat-mercado', name: 'Supermercado', type: 'expense', icon: 'ShoppingCart', color: '#10B981', isCustom: false, bucket: 'essentials', createdAt: '' },
      { id: 'cat-moradia', name: 'Aluguel', type: 'expense', icon: 'Home', color: '#78BC71', isCustom: false, bucket: 'essentials', createdAt: '' },
      { id: 'cat-delivery', name: 'Delivery', type: 'expense', icon: 'Utensils', color: '#F97316', isCustom: false, bucket: 'lifestyle', createdAt: '' },
      { id: 'cat-lazer', name: 'Cinema', type: 'expense', icon: 'Film', color: '#AA84E1', isCustom: false, bucket: 'lifestyle', createdAt: '' },
      { id: 'cat-reserva', name: 'Reserva', type: 'expense', icon: 'ShieldCheck', color: '#22C55E', isCustom: false, bucket: 'future', createdAt: '' },
    ];

    it('deve calcular corretamente a separação dos 3 baldes com renda de R$ 4.000 (70/20/10)', () => {
      const txns: Transaction[] = [
        // Receita
        {
          id: 'tx-salario',
          accountId: 'acc-1',
          categoryId: 'cat-salario',
          amount: 4000,
          type: 'income',
          description: 'Salário',
          date: '2026-10-01T10:00:00.000Z',
          status: 'confirmed',
          paymentMethod: 'transfer',
          source: 'manual',
          createdAt: '',
          updatedAt: '',
        },
        // Essenciais: R$ 1.500 aluguel + R$ 600 mercado = R$ 2.100
        {
          id: 'tx-1',
          accountId: 'acc-1',
          categoryId: 'cat-moradia',
          amount: 1500,
          type: 'expense',
          description: 'Aluguel Outubro',
          date: '2026-10-05T10:00:00.000Z',
          status: 'confirmed',
          paymentMethod: 'pix',
          source: 'manual',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'tx-2',
          accountId: 'acc-1',
          categoryId: 'cat-mercado',
          amount: 600,
          type: 'expense',
          description: 'Compras Atacadão',
          date: '2026-10-08T10:00:00.000Z',
          status: 'confirmed',
          paymentMethod: 'debit',
          source: 'manual',
          createdAt: '',
          updatedAt: '',
        },
        // Estilo de Vida: R$ 200 delivery + R$ 100 cinema = R$ 300
        {
          id: 'tx-3',
          accountId: 'acc-1',
          categoryId: 'cat-delivery',
          amount: 200,
          type: 'expense',
          description: 'iFood',
          date: '2026-10-10T10:00:00.000Z',
          status: 'confirmed',
          paymentMethod: 'credit',
          source: 'manual',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'tx-4',
          accountId: 'acc-1',
          categoryId: 'cat-lazer',
          amount: 100,
          type: 'expense',
          description: 'Ingresso Cinema',
          date: '2026-10-12T10:00:00.000Z',
          status: 'confirmed',
          paymentMethod: 'credit',
          source: 'manual',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const goalContributions: GoalContribution[] = [
        {
          id: 'contrib-1',
          goalId: 'goal-1',
          amount: 250,
          date: '2026-10-15',
          isAutomatic: false,
          createdAt: '',
        }
      ];

      const summary = calculateThreeBucketsSummary({
        categories: mockCategories,
        transactions: txns,
        goalContributions,
        month: 10,
        year: 2026,
        currentDate: new Date('2026-10-15T12:00:00.000Z'),
      });

      expect(summary.referenceIncome).toBe(4000);
      expect(summary.incomeSource).toBe('current_month');

      // Balde Essenciais (70% de 4.000 = 2.800)
      expect(summary.buckets.essentials.percentageTarget).toBe(70);
      expect(summary.buckets.essentials.targetAmount).toBe(2800);
      expect(summary.buckets.essentials.spentAmount).toBe(2100);
      expect(summary.buckets.essentials.remainingAmount).toBe(700);
      expect(summary.buckets.essentials.status).toBe('normal');

      // Balde Estilo de Vida (20% de 4.000 = 800)
      expect(summary.buckets.lifestyle.percentageTarget).toBe(20);
      expect(summary.buckets.lifestyle.targetAmount).toBe(800);
      expect(summary.buckets.lifestyle.spentAmount).toBe(300);
      expect(summary.buckets.lifestyle.remainingAmount).toBe(500);
      expect(summary.buckets.lifestyle.status).toBe('normal');

      // Balde Futuro (10% de 4.000 = 400)
      // Aporte de meta = R$ 250
      expect(summary.buckets.future.percentageTarget).toBe(10);
      expect(summary.buckets.future.targetAmount).toBe(400);
      expect(summary.buckets.future.spentAmount).toBe(250);
      expect(summary.buckets.future.remainingAmount).toBe(150);

      // Sobra geral esperada: R$ 4.000 - (2.100 + 300 + 250) = R$ 1.350
      expect(summary.overallSobra).toBe(1350);
    });

    it('deve respeitar customização manual das porcentagens (ex: 60/30/10)', () => {
      const summary = calculateThreeBucketsSummary({
        categories: mockCategories,
        transactions: [],
        month: 10,
        year: 2026,
        config: {
          customIncome: 5000,
          isCustomized: true,
          essentialsPct: 60,
          lifestylePct: 30,
          futurePct: 10,
        }
      });

      expect(summary.referenceIncome).toBe(5000);
      expect(summary.incomeSource).toBe('manual');
      expect(summary.buckets.essentials.percentageTarget).toBe(60);
      expect(summary.buckets.essentials.targetAmount).toBe(3000);
      expect(summary.buckets.lifestyle.percentageTarget).toBe(30);
      expect(summary.buckets.lifestyle.targetAmount).toBe(1500);
      expect(summary.buckets.future.percentageTarget).toBe(10);
      expect(summary.buckets.future.targetAmount).toBe(500);
    });
  });
});
