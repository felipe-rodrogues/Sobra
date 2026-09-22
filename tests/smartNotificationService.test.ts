import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SmartNotificationService } from '../src/core/notifications/smartNotificationService';
import { Account, Budget, Category, Subscription, Transaction } from '../src/core/types';

// Polyfill de localStorage e Notification para ambiente Node
let mockStore: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => mockStore[key] || null,
    setItem: (key: string, val: string) => { mockStore[key] = String(val); },
    removeItem: (key: string) => { delete mockStore[key]; },
    clear: () => { mockStore = {}; },
  };
}
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}

// Mock da Notification API
let lastNotification: { title: string; options: any } | null = null;
class MockNotification {
  static permission: NotificationPermission = 'granted';
  static requestPermission = vi.fn().mockResolvedValue('granted');
  onclick: (() => void) | null = null;

  constructor(public title: string, public options?: any) {
    lastNotification = { title, options };
  }
  close() {}
}
(globalThis as any).Notification = MockNotification;

describe('SmartNotificationService - Gatilhos Inteligentes Contextuais', () => {
  beforeEach(() => {
    mockStore = {};
    lastNotification = null;
    MockNotification.permission = 'granted';
  });

  const afternoonTime = new Date('2026-09-10T14:30:00'); // Dia 10 de setembro às 14h30

  it('1. Deve notificar fechamento de fatura INDIVIDUALMENTE por cartão no dia exato', async () => {
    const cardNubank: Account = {
      id: 'acc-nubank',
      name: 'Nubank Ultravioleta',
      type: 'credit_card',
      balance: 1450.00,
      closingDay: 10, // Fecha dia 10!
      dueDay: 17,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '',
      updatedAt: '',
    };

    const cardInter: Account = {
      id: 'acc-inter',
      name: 'Inter Black',
      type: 'credit_card',
      balance: 890.00,
      closingDay: 20, // Fecha dia 20!
      dueDay: 27,
      color: '#FF7A00',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '',
      updatedAt: '',
    };

    // No dia 10: apenas o Nubank deve disparar notificação!
    const countDay10 = await SmartNotificationService.checkAndNotifyCardClosing(
      [cardNubank, cardInter],
      [],
      9,
      2026,
      undefined,
      afternoonTime
    );

    expect(countDay10).toBe(1);
    expect(lastNotification?.title).toContain('Nubank Ultravioleta');
    expect(lastNotification?.options?.body).toContain('1.450,00');
    expect(lastNotification?.options?.body).toContain('dia 17');

    // Se rodar de novo no mesmo dia: deduplicação impede disparo duplicado
    const countRetry = await SmartNotificationService.checkAndNotifyCardClosing(
      [cardNubank, cardInter],
      [],
      9,
      2026,
      undefined,
      afternoonTime
    );
    expect(countRetry).toBe(0);

    // No dia 20: o Inter deve disparar sua própria notificação!
    const day20Time = new Date('2026-09-20T11:00:00');
    const countDay20 = await SmartNotificationService.checkAndNotifyCardClosing(
      [cardNubank, cardInter],
      [],
      9,
      2026,
      undefined,
      day20Time
    );
    expect(countDay20).toBe(1);
    expect(lastNotification?.title).toContain('Inter Black');
    expect(lastNotification?.options?.body).toContain('890,00');
    expect(lastNotification?.options?.body).toContain('dia 27');
  });

  it('2. Deve notificar nova assinatura recorrente detectada', async () => {
    const tx1: Transaction = {
      id: 'tx-net-1',
      accountId: 'acc-1',
      categoryId: 'cat-lazer',
      amount: 55.90,
      type: 'expense',
      description: 'Netflix.com Mensal',
      date: '2026-08-10T10:00:00Z',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    };
    const tx2: Transaction = {
      id: 'tx-net-2',
      accountId: 'acc-1',
      categoryId: 'cat-lazer',
      amount: 55.90,
      type: 'expense',
      description: 'Netflix.com Mensal',
      date: '2026-09-09T10:00:00Z', // ~30 dias depois
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    };

    const categories: Category[] = [
      { id: 'cat-lazer', name: 'Lazer', type: 'expense', icon: 'Tv', color: '#AA84E1', isCustom: false, createdAt: '' }
    ];

    const sent = await SmartNotificationService.checkAndNotifyUnlinkedSubscriptions(
      [tx1, tx2],
      [], // Nenhuma assinatura salva ainda
      categories,
      undefined,
      afternoonTime
    );

    expect(sent).toBe(true);
    expect(lastNotification?.title).toContain('Nova assinatura detectada?');
    expect(lastNotification?.options?.body).toContain('55,90');
  });

  it('3. Deve notificar no fechamento do mês com o balanço do Sobi', async () => {
    // Último dia de setembro: dia 30
    const endOfMonth = new Date('2026-09-30T17:00:00');

    const sent = await SmartNotificationService.checkAndNotifyMonthClosingDiagnosis(
      5000,
      3800,
      9,
      2026,
      undefined,
      endOfMonth
    );

    expect(sent).toBe(true);
    expect(lastNotification?.title).toContain('O mês fechou!');
    expect(lastNotification?.options?.body).toContain('1.200,00'); // Sobra de 5000 - 3800
  });

  it('4. Deve notificar alerta de orçamento ao atingir 80% e 100%', async () => {
    const budget: Budget = {
      id: 'b-alim',
      categoryId: 'cat-alim',
      monthlyLimit: 1000,
      month: 9,
      year: 2026,
      createdAt: '',
    };

    const categories: Category[] = [
      { id: 'cat-alim', name: 'Alimentação', type: 'expense', icon: 'Utensils', color: '#F59E0B', isCustom: false, createdAt: '' }
    ];

    // Gasto de R$ 850 (85% do teto)
    const tx850: Transaction = {
      id: 'tx-850',
      accountId: 'acc-1',
      categoryId: 'cat-alim',
      amount: 850,
      type: 'expense',
      description: 'Supermercado',
      date: '2026-09-10T12:00:00Z',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'manual',
      createdAt: '',
      updatedAt: '',
    };

    const sentCount80 = await SmartNotificationService.checkAndNotifyBudgetThresholds(
      [budget],
      categories,
      [tx850],
      9,
      2026,
      undefined,
      afternoonTime
    );

    expect(sentCount80).toBe(1);
    expect(lastNotification?.title).toContain('85%');
    expect(lastNotification?.options?.body).toContain('850,00');

    // Gasto acumulado atinge R$ 1.050 (105% do teto)
    const txExtra: Transaction = {
      id: 'tx-extra',
      accountId: 'acc-1',
      categoryId: 'cat-alim',
      amount: 200,
      type: 'expense',
      description: 'Padaria e Lanches',
      date: '2026-09-12T12:00:00Z',
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      createdAt: '',
      updatedAt: '',
    };

    const sentCount100 = await SmartNotificationService.checkAndNotifyBudgetThresholds(
      [budget],
      categories,
      [tx850, txExtra],
      9,
      2026,
      undefined,
      afternoonTime
    );

    expect(sentCount100).toBe(1);
    expect(lastNotification?.title).toContain('100%');
  });

  it('5. Não deve emitir notificações fora do horário de respeito (antes das 10h ou após 19h)', async () => {
    const nightTime = new Date('2026-09-10T22:30:00'); // 22h30 da noite

    const card: Account = {
      id: 'acc-1',
      name: 'Cartão',
      type: 'credit_card',
      balance: 1000,
      closingDay: 10,
      color: '',
      icon: '',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '',
      updatedAt: '',
    };

    const sent = await SmartNotificationService.checkAndNotifyCardClosing(
      [card],
      [],
      9,
      2026,
      undefined,
      nightTime
    );

    expect(sent).toBe(0);
    expect(lastNotification).toBeNull();
  });
});
