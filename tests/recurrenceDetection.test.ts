import { describe, it, expect } from 'vitest';
import { recurrenceDetector } from '../src/core/subscriptions/recurrenceDetector';
import { Transaction, Subscription, Category } from '../src/core/types';
import { INITIAL_CATEGORIES } from '../src/database/schema';

describe('RecurrenceDetector (Aba de Assinaturas & Recorrências)', () => {
  const categories: Category[] = INITIAL_CATEGORIES.map(c => ({
    ...c,
    createdAt: new Date().toISOString(),
  }));

  it('deve identificar recorrência mensal (~30 dias) com valores semelhantes', () => {
    const now = Date.now();
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        categoryId: 'cat-lazer',
        amount: 34.90,
        type: 'expense',
        description: 'Spotify Premium',
        date: new Date(now - 60 * 86400000).toISOString(),
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'notification',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        categoryId: 'cat-lazer',
        amount: 34.90,
        type: 'expense',
        description: 'Spotify Premium',
        date: new Date(now - 30 * 86400000).toISOString(),
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'notification',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const suggestions = recurrenceDetector.detectRecurringSubscriptions(
      transactions,
      [],
      [],
      categories
    );

    expect(suggestions.length).toBe(1);
    expect(suggestions[0].merchantName).toBe('Spotify Premium');
    expect(suggestions[0].cadence).toBe('monthly');
    expect(suggestions[0].amount).toBe(34.90);
    expect(suggestions[0].intervalDays).toBeGreaterThanOrEqual(28);
    expect(suggestions[0].intervalDays).toBeLessThanOrEqual(32);
    expect(suggestions[0].transactionCount).toBe(2);
  });

  it('deve identificar recorrência anual (~365 dias)', () => {
    const now = Date.now();
    const transactions: Transaction[] = [
      {
        id: 'tx-annual-1',
        accountId: 'acc-1',
        categoryId: 'cat-compras',
        amount: 199.00,
        type: 'expense',
        description: 'Amazon Prime Anual',
        date: new Date(now - 730 * 86400000).toISOString(),
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tx-annual-2',
        accountId: 'acc-1',
        categoryId: 'cat-compras',
        amount: 199.00,
        type: 'expense',
        description: 'Amazon Prime Anual',
        date: new Date(now - 365 * 86400000).toISOString(),
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const suggestions = recurrenceDetector.detectRecurringSubscriptions(
      transactions,
      [],
      [],
      categories
    );

    expect(suggestions.length).toBe(1);
    expect(suggestions[0].merchantName).toBe('Amazon Prime Anual');
    expect(suggestions[0].cadence).toBe('yearly');
    expect(suggestions[0].amount).toBe(199.00);
  });

  it('não deve sugerir despesas que não possuem intervalo regular', () => {
    const now = Date.now();
    const randomTransactions: Transaction[] = [
      {
        id: 'tx-rand-1',
        accountId: 'acc-1',
        categoryId: 'cat-alim',
        amount: 45.00,
        type: 'expense',
        description: 'Restaurante Sabor',
        date: new Date(now - 10 * 86400000).toISOString(),
        status: 'confirmed',
        paymentMethod: 'debit',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tx-rand-2',
        accountId: 'acc-1',
        categoryId: 'cat-alim',
        amount: 52.00,
        type: 'expense',
        description: 'Restaurante Sabor',
        date: new Date(now - 3 * 86400000).toISOString(), // Apenas 7 dias depois
        status: 'confirmed',
        paymentMethod: 'debit',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const suggestions = recurrenceDetector.detectRecurringSubscriptions(
      randomTransactions,
      [],
      [],
      categories
    );

    expect(suggestions.length).toBe(0);
  });

  it('não deve sugerir serviços já confirmados como assinatura', () => {
    const now = Date.now();
    const transactions: Transaction[] = [
      {
        id: 'tx-netflix-1',
        accountId: 'acc-1',
        categoryId: 'cat-lazer',
        amount: 55.90,
        type: 'expense',
        description: 'Netflix.com',
        date: new Date(now - 60 * 86400000).toISOString(),
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'notification',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tx-netflix-2',
        accountId: 'acc-1',
        categoryId: 'cat-lazer',
        amount: 55.90,
        type: 'expense',
        description: 'Netflix.com',
        date: new Date(now - 30 * 86400000).toISOString(),
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'notification',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const confirmedSubscriptions: Subscription[] = [
      {
        id: 'sub-netflix',
        name: 'Netflix',
        amount: 55.90,
        categoryId: 'cat-lazer',
        cadence: 'monthly',
        nextBillingDate: '2026-10-15',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const suggestions = recurrenceDetector.detectRecurringSubscriptions(
      transactions,
      confirmedSubscriptions,
      [],
      categories
    );

    expect(suggestions.length).toBe(0);
  });

  it('não deve sugerir serviços que foram dispensados pelo usuário ("não é assinatura")', () => {
    const now = Date.now();
    const transactions: Transaction[] = [
      {
        id: 'tx-disp-1',
        accountId: 'acc-1',
        categoryId: 'cat-transp',
        amount: 150.00,
        type: 'expense',
        description: 'Mensalidade Estacionamento',
        date: new Date(now - 60 * 86400000).toISOString(),
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tx-disp-2',
        accountId: 'acc-1',
        categoryId: 'cat-transp',
        amount: 150.00,
        type: 'expense',
        description: 'Mensalidade Estacionamento',
        date: new Date(now - 30 * 86400000).toISOString(),
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const dismissed = ['Mensalidade Estacionamento'];

    const suggestions = recurrenceDetector.detectRecurringSubscriptions(
      transactions,
      [],
      dismissed,
      categories
    );

    expect(suggestions.length).toBe(0);
  });

  it('deve calcular corretamente o custo total mensal somando assinaturas mensais e anuais proporcionais', () => {
    const subscriptions: Subscription[] = [
      {
        id: 'sub-1',
        name: 'Spotify',
        amount: 34.90, // Mensal
        categoryId: 'cat-lazer',
        cadence: 'monthly',
        nextBillingDate: '2026-10-01',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'sub-2',
        name: 'iCloud',
        amount: 14.90, // Mensal
        categoryId: 'cat-outros-desp',
        cadence: 'monthly',
        nextBillingDate: '2026-10-05',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'sub-3',
        name: 'Amazon Prime Anual',
        amount: 120.00, // Anual -> 120 / 12 = 10.00/mês
        categoryId: 'cat-compras',
        cadence: 'yearly',
        nextBillingDate: '2027-01-01',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'sub-paused',
        name: 'Academia Pausada',
        amount: 99.00,
        categoryId: 'cat-saude',
        cadence: 'monthly',
        nextBillingDate: '2026-10-10',
        status: 'cancelled', // Não deve somar no total de ativas!
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Total: 34.90 + 14.90 + 10.00 = 59.80
    const total = recurrenceDetector.calculateTotalMonthlyCost(subscriptions);
    expect(total).toBe(59.80);
  });

  it('deve alertar quando o valor de uma assinatura muda em relação à cobrança anterior', () => {
    const now = Date.now();
    const sub: Subscription = {
      id: 'sub-netflix',
      name: 'Netflix',
      amount: 44.90,
      previousAmount: 39.90, // Subiu R$ 5,00
      categoryId: 'cat-lazer',
      cadence: 'monthly',
      nextBillingDate: '2026-10-10',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const alerts = recurrenceDetector.detectPriceChanges([sub], []);
    expect(alerts.length).toBe(1);
    expect(alerts[0].subscription.name).toBe('Netflix');
    expect(alerts[0].difference).toBe(5.00);
    expect(alerts[0].isIncrease).toBe(true);
    expect(alerts[0].percentage).toBeGreaterThan(10);
  });

  it('deve alertar sobreposição quando há mais de uma assinatura na mesma categoria', () => {
    const subscriptions: Subscription[] = [
      {
        id: 'sub-netflix',
        name: 'Netflix',
        amount: 44.90,
        categoryId: 'cat-lazer',
        cadence: 'monthly',
        nextBillingDate: '2026-10-10',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'sub-disney',
        name: 'Disney+',
        amount: 33.90,
        categoryId: 'cat-lazer',
        cadence: 'monthly',
        nextBillingDate: '2026-10-15',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'sub-vivo',
        name: 'Vivo Fibra',
        amount: 120.00,
        categoryId: 'cat-moradia',
        cadence: 'monthly',
        nextBillingDate: '2026-10-20',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const overlaps = recurrenceDetector.detectCategoryOverlaps(subscriptions, categories);
    expect(overlaps.length).toBe(1);
    expect(overlaps[0].categoryId).toBe('cat-lazer');
    expect(overlaps[0].subscriptions.length).toBe(2);
    expect(overlaps[0].totalMonthlyAmount).toBe(78.80);
  });

  describe('checkIfLikelySubscription (Detecção Proativa de Assinatura ao Editar/Criar Cobrança)', () => {
    it('deve sugerir proativamente para serviços conhecidos como Netflix, Spotify e Disney+', () => {
      const netflix = recurrenceDetector.checkIfLikelySubscription('Netflix Com', 55.90, []);
      expect(netflix.isLikely).toBe(true);
      expect(netflix.cadence).toBe('monthly');
      expect(netflix.serviceName).toBe('Netflix');

      const spotify = recurrenceDetector.checkIfLikelySubscription('SPOTIFY BRASIL', 34.90, []);
      expect(spotify.isLikely).toBe(true);
      expect(spotify.cadence).toBe('monthly');

      const primeAnual = recurrenceDetector.checkIfLikelySubscription('Amazon Prime Anual', 199.00, []);
      expect(primeAnual.isLikely).toBe(true);
      expect(primeAnual.cadence).toBe('yearly');
    });

    it('deve sugerir proativamente com base no histórico recorrente de ~30 dias de um estabelecimento qualquer', () => {
      const now = Date.now();
      const pastTransactions: Transaction[] = [
        {
          id: 'tx-lav-1',
          accountId: 'acc-1',
          categoryId: 'cat-outros',
          amount: 119.90,
          type: 'expense',
          description: 'Lavanderia 5asec Higienópolis',
          date: new Date(now - 31 * 86400000).toISOString(),
          status: 'confirmed',
          paymentMethod: 'credit',
          source: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ];

      const check = recurrenceDetector.checkIfLikelySubscription(
        'Lavanderia 5asec Higienópolis',
        119.90,
        pastTransactions
      );

      expect(check.isLikely).toBe(true);
      expect(check.cadence).toBe('monthly');
      expect(check.reason).toContain('Cobrança semelhante identificada há ~31 dias');
    });

    it('não deve sugerir para compras casuais sem histórico recorrente', () => {
      const check = recurrenceDetector.checkIfLikelySubscription(
        'Restaurante Fogão Mineiro',
        65.00,
        []
      );

      expect(check.isLikely).toBe(false);
    });
  });
});
