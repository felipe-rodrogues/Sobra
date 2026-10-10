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

  it('6. Deve notificar vencimento de fatura (HOJE) com pergunta "Ela já foi paga?" sem distinção de cartão conjunto', async () => {
    const cardConjunto: Account = {
      id: 'acc-conjunto',
      name: 'Cartão Conjunto',
      type: 'credit_card',
      balance: 1000.00,
      closingDay: 1,
      dueDay: 8, // Vencimento dia 8!
      isShared: true,
      splitMode: 'half',
      splitRatio: 0.5,
      invoiceStatus: 'closed', // Fechada, NÃO paga!
      color: '#3B82F6',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '',
      updatedAt: '',
    };

    const cardJaPago: Account = {
      id: 'acc-pago',
      name: 'Cartão Nubank',
      type: 'credit_card',
      balance: 0,
      closingDay: 1,
      dueDay: 8,
      invoiceStatus: 'paid', // Já está PAGA!
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '',
      updatedAt: '',
    };

    // Dia 8 às 11h: dia do vencimento!
    const dueDayTime = new Date('2026-10-08T11:00:00');

    const sentCount = await SmartNotificationService.checkAndNotifyCardDue(
      [cardConjunto, cardJaPago],
      [],
      [],
      undefined,
      dueDayTime
    );

    // Apenas o cartão não pago deve notificar!
    expect(sentCount).toBe(1);
    expect(lastNotification?.title).toContain('Cartão Conjunto vence hoje');
    expect(lastNotification?.options?.body).toContain('1.000,00');
    expect(lastNotification?.options?.body).toContain('Ela já foi paga?');
    // Não tem tratamento diferenciado para cartão conjunto:
    expect(lastNotification?.options?.body).not.toContain('sua parte');

    // Deduplicação: se rodar de novo no mesmo ciclo, não repete
    const retryCount = await SmartNotificationService.checkAndNotifyCardDue(
      [cardConjunto, cardJaPago],
      [],
      [],
      undefined,
      dueDayTime
    );
    expect(retryCount).toBe(0);
  });

  it('7. Deve notificar vencimento de fatura na VÉSPERA (1 dia antes)', async () => {
    const card: Account = {
      id: 'acc-itau',
      name: 'Itaú Black',
      type: 'credit_card',
      balance: 750.00,
      closingDay: 1,
      dueDay: 8,
      invoiceStatus: 'closed',
      color: '#EC7000',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '',
      updatedAt: '',
    };

    // Dia 7 às 14h: véspera do vencimento (dia 8)
    const eveTime = new Date('2026-10-07T14:00:00');

    const sentCount = await SmartNotificationService.checkAndNotifyCardDue(
      [card],
      [],
      [],
      undefined,
      eveTime
    );

    expect(sentCount).toBe(1);
    expect(lastNotification?.title).toContain('Itaú Black vence amanhã');
    expect(lastNotification?.options?.body).toContain('750,00');
    expect(lastNotification?.options?.body).toContain('não esqueça de pagar');
  });

  it('8. Deve notificar vencimento de fatura 2 DIAS ANTES com alerta preventivo', async () => {
    const card: Account = {
      id: 'acc-itau-2',
      name: 'Itaú Black',
      type: 'credit_card',
      balance: 750.00,
      closingDay: 1,
      dueDay: 8,
      invoiceStatus: 'closed',
      color: '#EC7000',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '',
      updatedAt: '',
    };

    // Dia 6 às 14h: 2 dias antes do vencimento (dia 8)
    const twoDaysBeforeTime = new Date('2026-10-06T14:00:00');

    const sentCount = await SmartNotificationService.checkAndNotifyCardDue(
      [card],
      [],
      [],
      undefined,
      twoDaysBeforeTime
    );

    expect(sentCount).toBe(1);
    expect(lastNotification?.title).toContain('próxima de vencer');
    expect(lastNotification?.options?.body).toContain('está próxima de vencer');
    expect(lastNotification?.options?.body).toContain('não esqueça de pagar');
  });

  it('9. Deve notificar fatura em ATRASO perguntando se foi paga', async () => {
    const card: Account = {
      id: 'acc-atraso',
      name: 'Santander',
      type: 'credit_card',
      balance: 320.00,
      closingDay: 1,
      dueDay: 8,
      invoiceStatus: 'closed',
      color: '#CC0000',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '',
      updatedAt: '',
    };

    // Dia 9 às 15h: 1 dia após o vencimento (venceu dia 8)
    const overdueTime = new Date('2026-10-09T15:00:00');

    const sentCount = await SmartNotificationService.checkAndNotifyCardDue(
      [card],
      [],
      [],
      undefined,
      overdueTime
    );

    expect(sentCount).toBe(1);
    expect(lastNotification?.title).toContain('Santander venceu');
    expect(lastNotification?.options?.body).toContain('320,00');
    expect(lastNotification?.options?.body).toContain('Ela já foi paga?');
  });

  it('10. Não deve notificar vencimento se a fatura já estiver PAGA', async () => {
    const card: Account = {
      id: 'acc-quitado',
      name: 'C6 Bank',
      type: 'credit_card',
      balance: 0,
      closingDay: 1,
      dueDay: 8,
      invoiceStatus: 'paid', // Paga!
      color: '#000000',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '',
      updatedAt: '',
    };

    const dueDayTime = new Date('2026-10-08T11:00:00');

    const sentCount = await SmartNotificationService.checkAndNotifyCardDue(
      [card],
      [],
      [],
      undefined,
      dueDayTime
    );

    expect(sentCount).toBe(0);
  });

  describe('Notificações de Salário (Pague-se Primeiro) Inteligentes & Tempestivas', () => {
    it('11. Deve notificar salário quando acabou de cair (fresco, nas últimas 48h)', async () => {
      const todayTime = new Date('2026-10-09T14:00:00'); // Dia 09 de outubro às 14h
      const salaryTx: Transaction = {
        id: 'tx-salario-hoje',
        accountId: 'acc-1',
        categoryId: 'cat-salario',
        amount: 4500.00,
        type: 'income',
        description: 'Salário Mensal Empresa',
        date: '2026-10-09T08:30:00Z', // Caiu hoje cedo!
        status: 'confirmed',
        paymentMethod: 'transfer',
        source: 'notification',
        createdAt: '',
        updatedAt: '',
      };

      const sent = await SmartNotificationService.checkAndNotifySalary(
        [salaryTx],
        10,
        2026,
        undefined,
        todayTime
      );

      expect(sent).toBe(true);
      expect(lastNotification?.title).toContain('Salário identificado');
      expect(lastNotification?.options?.body).toContain('Que tal se pagar primeiro este mês?');
    });

    it('12. NÃO deve notificar salário tardio/antigo (já caiu há dias na conta)', async () => {
      // Cenário do usuário: o salário caiu no dia 01/10 e hoje já é dia 09/10
      const todayTime = new Date('2026-10-09T14:00:00'); // 09 de outubro
      const oldSalaryTx: Transaction = {
        id: 'tx-salario-antigo',
        accountId: 'acc-1',
        categoryId: 'cat-salario',
        amount: 4500.00,
        type: 'income',
        description: 'Salário Mensal',
        date: '2026-10-01T08:30:00Z', // Caiu 8 dias atrás!
        status: 'confirmed',
        paymentMethod: 'transfer',
        source: 'notification',
        createdAt: '',
        updatedAt: '',
      };

      const sent = await SmartNotificationService.checkAndNotifySalary(
        [oldSalaryTx],
        10,
        2026,
        undefined,
        todayTime
      );

      // Não deve notificar retroativamente!
      expect(sent).toBe(false);
      expect(lastNotification).toBeNull();
    });

    it('13. NÃO deve notificar se o usuário já começou seus gastos após o salário', async () => {
      const todayTime = new Date('2026-10-09T14:00:00');
      const salaryTx: Transaction = {
        id: 'tx-salario-hoje',
        accountId: 'acc-1',
        categoryId: 'cat-salario',
        amount: 4500.00,
        type: 'income',
        description: 'Salário Mensal',
        date: '2026-10-08T10:00:00Z',
        status: 'confirmed',
        paymentMethod: 'transfer',
        source: 'notification',
        createdAt: '',
        updatedAt: '',
      };

      // Vários gastos já realizados após o salário
      const expense1: Transaction = {
        id: 'tx-exp-1',
        accountId: 'acc-1',
        categoryId: 'cat-alim',
        amount: 50.00,
        type: 'expense',
        description: 'Mercado',
        date: '2026-10-08T12:00:00Z',
        status: 'confirmed',
        paymentMethod: 'debit',
        source: 'notification',
        createdAt: '',
        updatedAt: '',
      };
      const expense2: Transaction = {
        id: 'tx-exp-2',
        accountId: 'acc-1',
        categoryId: 'cat-transp',
        amount: 30.00,
        type: 'expense',
        description: 'Uber',
        date: '2026-10-08T16:00:00Z',
        status: 'confirmed',
        paymentMethod: 'debit',
        source: 'notification',
        createdAt: '',
        updatedAt: '',
      };
      const expense3: Transaction = {
        id: 'tx-exp-3',
        accountId: 'acc-1',
        categoryId: 'cat-alim',
        amount: 45.00,
        type: 'expense',
        description: 'Farmácia',
        date: '2026-10-09T10:00:00Z',
        status: 'confirmed',
        paymentMethod: 'debit',
        source: 'notification',
        createdAt: '',
        updatedAt: '',
      };

      const sent = await SmartNotificationService.checkAndNotifySalary(
        [salaryTx, expense1, expense2, expense3],
        10,
        2026,
        undefined,
        todayTime
      );

      expect(sent).toBe(false);
      expect(lastNotification).toBeNull();
    });

    it('14. NÃO deve confundir Pix ou transferência comum com salário', async () => {
      const todayTime = new Date('2026-10-09T14:00:00');
      const pixComum: Transaction = {
        id: 'tx-pix',
        accountId: 'acc-1',
        categoryId: 'cat-outros-rec',
        amount: 150.00,
        type: 'income',
        description: 'Pagamento recebido de Lucas', // Palavra 'pagamento' comum
        date: '2026-10-09T12:00:00Z',
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'notification',
        createdAt: '',
        updatedAt: '',
      };

      const sent = await SmartNotificationService.checkAndNotifySalary(
        [pixComum],
        10,
        2026,
        undefined,
        todayTime
      );

      expect(sent).toBe(false);
      expect(lastNotification).toBeNull();
    });
  });

  describe('Prevenção de Falso Alerta de Assinatura para Parcelas', () => {
    it('15. NÃO deve disparar alerta de "Nova assinatura detectada" para parcelamentos como Tatuagem', async () => {
      const todayTime = new Date('2026-10-09T14:00:00');
      const installmentTxs: Transaction[] = [
        {
          id: 'tx-tatuagem-1',
          accountId: 'acc-1',
          categoryId: 'cat-lazer',
          amount: 280.00,
          type: 'expense',
          description: 'Tatuagem',
          date: '2026-08-10T10:00:00Z',
          status: 'confirmed',
          paymentMethod: 'credit',
          source: 'notification',
          isInstallment: true,
          installmentNumber: 3,
          installmentTotal: 10,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'tx-tatuagem-2',
          accountId: 'acc-1',
          categoryId: 'cat-lazer',
          amount: 280.00,
          type: 'expense',
          description: 'Tatuagem',
          date: '2026-09-09T10:00:00Z',
          status: 'confirmed',
          paymentMethod: 'credit',
          source: 'notification',
          isInstallment: true,
          installmentNumber: 4,
          installmentTotal: 10,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'tx-tatuagem-3',
          accountId: 'acc-1',
          categoryId: 'cat-lazer',
          amount: 280.00,
          type: 'expense',
          description: 'Tatuagem',
          date: '2026-10-09T10:00:00Z',
          status: 'confirmed',
          paymentMethod: 'credit',
          source: 'notification',
          isInstallment: true,
          installmentNumber: 5,
          installmentTotal: 10,
          createdAt: '',
          updatedAt: '',
        },
      ];

      const sent = await SmartNotificationService.checkAndNotifyUnlinkedSubscriptions(
        installmentTxs,
        [],
        [],
        undefined,
        todayTime
      );

      expect(sent).toBe(false);
      expect(lastNotification).toBeNull();
    });
  });
});
