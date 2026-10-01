import { describe, it, expect } from 'vitest';
import { 
  generateInstallmentTransactions, 
  calculateInvoiceForMonth, 
  calculateFutureInvoiceTimeline, 
  getActiveInstallmentGroups,
  getInvoiceDueDateForDate,
  addMonthsToDate 
} from '../src/core/installments/installmentHelper';
import { Transaction, Account } from '../src/core/types';

describe('Installment Helper & Future Invoices', () => {
  it('divides amounts accurately with cent adjustments on the first installment', () => {
    // R$ 100,00 divididos em 3x: 33,34 + 33,33 + 33,33 = 100,00
    const txs = generateInstallmentTransactions({
      accountId: 'acc-nubank',
      categoryId: 'cat-compras',
      description: 'Fone de Ouvido Bluetooth',
      totalAmount: 100.00,
      installmentCount: 3,
      startDate: '2026-09-15T12:00:00.000Z',
    });

    expect(txs.length).toBe(3);
    expect(txs[0].amount).toBe(33.34);
    expect(txs[1].amount).toBe(33.33);
    expect(txs[2].amount).toBe(33.33);

    const totalSum = txs.reduce((acc, t) => acc + t.amount, 0);
    expect(Math.round(totalSum * 100) / 100).toBe(100.00);

    expect(txs[0].description).toBe('Fone de Ouvido Bluetooth (1/3)');
    expect(txs[1].description).toBe('Fone de Ouvido Bluetooth (2/3)');
    expect(txs[2].description).toBe('Fone de Ouvido Bluetooth (3/3)');

    expect(txs[0].isInstallment).toBe(true);
    expect(txs[0].installmentNumber).toBe(1);
    expect(txs[0].installmentTotal).toBe(3);
    expect(txs[0].originalTotalAmount).toBe(100.00);
    expect(txs[0].installmentGroupId).toBe(txs[1].installmentGroupId);
  });

  it('generates correct monthly dates across months, even at month end', () => {
    const baseDate = new Date('2026-01-31T12:00:00.000Z');
    const plus1 = addMonthsToDate(baseDate, 1);
    // Em fevereiro (não bissexto), deve cair em 28 de fevereiro
    expect(plus1.getUTCMonth()).toBe(1); // 0-indexed: 1 = Fevereiro
    expect(plus1.getUTCDate()).toBe(28);

    const plus2 = addMonthsToDate(baseDate, 2);
    expect(plus2.getUTCMonth()).toBe(2); // Março
  });

  it('calculates monthly invoices correctly including installments falling into that month', () => {
    const cardId = 'acc-card';
    const txs: Transaction[] = [
      // Compra pontual em Setembro/2026
      {
        id: 'tx-1',
        accountId: cardId,
        categoryId: 'cat-alim',
        amount: 50.00,
        type: 'expense',
        description: 'Almoço',
        date: '2026-09-10T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: '2026-09-10T12:00:00.000Z',
        updatedAt: '2026-09-10T12:00:00.000Z',
      },
      // Parcela 1 em Setembro/2026
      {
        id: 'tx-2',
        accountId: cardId,
        categoryId: 'cat-compras',
        amount: 100.00,
        type: 'expense',
        description: 'Geladeira (1/3)',
        date: '2026-09-15T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        isInstallment: true,
        installmentGroupId: 'group-geladeira',
        installmentNumber: 1,
        installmentTotal: 3,
        originalTotalAmount: 300.00,
        createdAt: '2026-09-15T12:00:00.000Z',
        updatedAt: '2026-09-15T12:00:00.000Z',
      },
      // Parcela 2 em Outubro/2026
      {
        id: 'tx-3',
        accountId: cardId,
        categoryId: 'cat-compras',
        amount: 100.00,
        type: 'expense',
        description: 'Geladeira (2/3)',
        date: '2026-10-15T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        isInstallment: true,
        installmentGroupId: 'group-geladeira',
        installmentNumber: 2,
        installmentTotal: 3,
        originalTotalAmount: 300.00,
        createdAt: '2026-09-15T12:00:00.000Z',
        updatedAt: '2026-09-15T12:00:00.000Z',
      },
      // Parcela 3 em Novembro/2026
      {
        id: 'tx-4',
        accountId: cardId,
        categoryId: 'cat-compras',
        amount: 100.00,
        type: 'expense',
        description: 'Geladeira (3/3)',
        date: '2026-11-15T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        isInstallment: true,
        installmentGroupId: 'group-geladeira',
        installmentNumber: 3,
        installmentTotal: 3,
        originalTotalAmount: 300.00,
        createdAt: '2026-09-15T12:00:00.000Z',
        updatedAt: '2026-09-15T12:00:00.000Z',
      },
    ];

    // Fatura de Setembro/2026: 50 + 100 = 150
    const sep = calculateInvoiceForMonth(cardId, txs, 9, 2026);
    expect(sep.totalAmount).toBe(150.00);
    expect(sep.transactions.length).toBe(2);

    // Fatura de Outubro/2026: 100
    const oct = calculateInvoiceForMonth(cardId, txs, 10, 2026);
    expect(oct.totalAmount).toBe(100.00);
    expect(oct.transactions.length).toBe(1);

    // Fatura de Novembro/2026: 100
    const nov = calculateInvoiceForMonth(cardId, txs, 11, 2026);
    expect(nov.totalAmount).toBe(100.00);

    // Fatura de Dezembro/2026: 0
    const dec = calculateInvoiceForMonth(cardId, txs, 12, 2026);
    expect(dec.totalAmount).toBe(0);
  });

  it('deducts refunds and estornos from invoice total amount instead of adding', () => {
    const cardId = 'acc-card';
    const txs: Transaction[] = [
      {
        id: 'tx-1',
        accountId: cardId,
        categoryId: 'cat-alim',
        amount: 100.00,
        type: 'expense',
        description: 'Compra Mercado',
        date: '2026-09-10T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: '2026-09-10T12:00:00.000Z',
        updatedAt: '2026-09-10T12:00:00.000Z',
      },
      // Reembolso de R$ 40,00 no cartão
      {
        id: 'tx-refund',
        accountId: cardId,
        categoryId: 'cat-alim',
        amount: 40.00,
        type: 'income',
        isRefund: true,
        description: 'Estorno Compra Mercado',
        date: '2026-09-12T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'csv',
        createdAt: '2026-09-12T12:00:00.000Z',
        updatedAt: '2026-09-12T12:00:00.000Z',
      },
    ];

    // Fatura de Setembro/2026: 100 - 40 = 60
    const sep = calculateInvoiceForMonth(cardId, txs, 9, 2026);
    expect(sep.totalAmount).toBe(60.00);
    expect(sep.transactions.length).toBe(2);
  });

  it('projects future invoice timeline accurately for N months', () => {
    const cardId = 'acc-card';
    const txs = generateInstallmentTransactions({
      accountId: cardId,
      categoryId: 'cat-compras',
      description: 'Notebook Dell',
      totalAmount: 2400.00,
      installmentCount: 12, // 12x de 200
      startDate: '2026-09-01T12:00:00.000Z',
    });

    const timeline = calculateFutureInvoiceTimeline(cardId, txs, 4, 9, 2026);
    expect(timeline.length).toBe(4);
    expect(timeline[0].month).toBe(9);
    expect(timeline[0].totalAmount).toBe(200.00);
    expect(timeline[1].month).toBe(10);
    expect(timeline[1].totalAmount).toBe(200.00);
    expect(timeline[2].month).toBe(11);
    expect(timeline[2].totalAmount).toBe(200.00);
    expect(timeline[3].month).toBe(12);
    expect(timeline[3].totalAmount).toBe(200.00);
  });

  it('aggregates active installment groups correctly', () => {
    const cardId = 'acc-card';
    const txs = generateInstallmentTransactions({
      accountId: cardId,
      categoryId: 'cat-eletronicos',
      description: 'iPhone 15 Pro',
      totalAmount: 6000.00,
      installmentCount: 6, // 6x de 1000
      startDate: '2026-09-01T12:00:00.000Z',
    });

    const groups = getActiveInstallmentGroups(txs, cardId);
    expect(groups.length).toBe(1);
    expect(groups[0].description).toBe('iPhone 15 Pro');
    expect(groups[0].originalTotalAmount).toBe(6000.00);
    expect(groups[0].installmentTotal).toBe(6);
    expect(groups[0].monthlyAmount).toBe(1000.00);
  });

  it('updates card limit and current invoice properly in storage adapter', async () => {
    const { db } = await import('../src/database/adapter');
    await db.resetAll('demo');

    // Criar cartão de teste com R$ 5.000 de limite
    const card = await db.saveAccount({
      id: 'acc-card-test',
      name: 'Cartão Master Teste',
      type: 'credit_card',
      balance: 0,
      creditLimit: 5000,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const now = new Date();
    // Compra parcelada de R$ 1.200 em 10x (R$ 120/mês)
    const installmentTxs = generateInstallmentTransactions({
      accountId: card.id,
      categoryId: 'cat-compras',
      description: 'Televisor 55 polegadas',
      totalAmount: 1200.00,
      installmentCount: 10,
      startDate: now.toISOString(),
    });

    await db.saveInstallmentTransactions(installmentTxs);

    const accounts = await db.getAccounts();
    const updatedCard = accounts.find(a => a.id === card.id);
    expect(updatedCard).toBeDefined();

    // A fatura do mês atual deve conter a parcela do mês atual (R$ 120,00)
    expect(updatedCard!.balance).toBe(120.00);

    // O openAmount deve comprometer o total da compra parcelada (R$ 1.200,00)
    expect(updatedCard!.openAmount).toBe(1200.00);

    // Limite disponível: 5000 - 1200 = 3800
    const available = (updatedCard!.creditLimit || 5000) - (updatedCard!.openAmount || 0);
    expect(available).toBe(3800.00);

    // Agora testar o cancelamento completo do parcelamento
    const groupId = installmentTxs[0].installmentGroupId!;
    await db.deleteInstallmentGroup(groupId);

    const accountsAfterDelete = await db.getAccounts();
    const cardAfterDelete = accountsAfterDelete.find(a => a.id === card.id);
    expect(cardAfterDelete!.balance).toBe(0);
    expect(cardAfterDelete!.openAmount).toBe(0);

    const allTxs = await db.getTransactions();
    const remainingGroupTxs = allTxs.filter(t => t.installmentGroupId === groupId);
    expect(remainingGroupTxs.length).toBe(0);
  });

  it('deve auto-recuperar e agrupar parcelas de cartão compartilhado mesmo sem flags explícitas', () => {
    const jointCardId = 'acc-shared-card';
    const rawSharedTxs: Transaction[] = [
      {
        id: 'tx-inst-inst-csv-1-3',
        accountId: jointCardId,
        categoryId: 'cat-casa',
        amount: 85.46,
        type: 'expense',
        description: 'Obramax (3/3)',
        date: '2026-11-10T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        isShared: true,
        createdAt: '2026-09-23T04:52:00.000Z',
        updatedAt: '2026-09-29T01:39:00.000Z',
      },
      {
        id: 'tx-inst-inst-csv-1-2',
        accountId: jointCardId,
        categoryId: 'cat-casa',
        amount: 85.46,
        type: 'expense',
        description: 'Obramax (2/3)',
        date: '2026-10-10T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        isShared: true,
        createdAt: '2026-09-23T04:52:00.000Z',
        updatedAt: '2026-09-29T01:39:00.000Z',
      },
      {
        id: 'tx-csv-random-1',
        accountId: jointCardId,
        categoryId: 'cat-casa',
        amount: 85.46,
        type: 'expense',
        description: 'Obramax (1/3)',
        date: '2026-09-10T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        isShared: true,
        createdAt: '2026-09-23T04:52:00.000Z',
        updatedAt: '2026-09-29T01:39:00.000Z',
      },
      {
        id: 'tx-inst-shein-2',
        accountId: jointCardId,
        categoryId: 'cat-vest',
        amount: 56.99,
        type: 'expense',
        description: 'Shein (2/3)',
        date: '2026-10-03T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        isShared: true,
        createdAt: '2026-09-23T04:52:00.000Z',
        updatedAt: '2026-09-29T01:39:00.000Z',
      },
      {
        id: 'tx-inst-ballunodome-4',
        accountId: jointCardId,
        categoryId: 'cat-lazer',
        amount: 183.50,
        type: 'expense',
        description: 'Ballunodome (4/4)',
        date: '2026-10-01T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        isShared: true,
        createdAt: '2026-09-23T04:52:00.000Z',
        updatedAt: '2026-09-29T01:39:00.000Z',
      },
      {
        id: 'tx-inst-ballunodome-3',
        accountId: jointCardId,
        categoryId: 'cat-lazer',
        amount: 183.50,
        type: 'expense',
        description: 'Ballunodome (3/4)',
        date: '2026-09-01T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        isShared: true,
        createdAt: '2026-09-23T04:52:00.000Z',
        updatedAt: '2026-09-29T01:39:00.000Z',
      },
    ];

    const groups = getActiveInstallmentGroups(rawSharedTxs, jointCardId);
    expect(groups.length).toBe(3);

    const obramax = groups.find(g => g.description === 'Obramax');
    expect(obramax).toBeDefined();
    expect(obramax!.installmentTotal).toBe(3);
    expect(obramax!.transactions.length).toBe(3);
    expect(obramax!.monthlyAmount).toBe(85.46);
    expect(obramax!.originalTotalAmount).toBe(256.38);
    expect(obramax!.paidInstallmentsCount).toBe(1);
    expect(obramax!.remainingInstallmentsCount).toBe(2);

    const ballunodome = groups.find(g => g.description === 'Ballunodome');
    expect(ballunodome).toBeDefined();
    expect(ballunodome!.installmentTotal).toBe(4);
    expect(ballunodome!.paidInstallmentsCount).toBe(3);
    expect(ballunodome!.remainingInstallmentsCount).toBe(1);
    expect(ballunodome!.remainingAmount).toBe(183.50);
  });

  it('calculates exact credit card invoice due dates based on closing and due days', () => {
    const nubankCard: Account = {
      id: 'acc-nubank',
      name: 'Nubank',
      type: 'credit_card',
      balance: 0,
      closingDay: 1,
      dueDay: 8,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Compras em Outubro em cartão que fecha dia 1 e vence dia 8
    // Devem cair na fatura que fecha em 1 de Novembro e vence dia 8 de Novembro
    const due1 = getInvoiceDueDateForDate('2026-10-10T12:00:00.000Z', nubankCard);
    expect(due1.getFullYear()).toBe(2026);
    expect(due1.getMonth() + 1).toBe(11); // Novembro
    expect(due1.getDate()).toBe(8);

    const due2 = getInvoiceDueDateForDate('2026-10-03T12:00:00.000Z', nubankCard);
    expect(due2.getFullYear()).toBe(2026);
    expect(due2.getMonth() + 1).toBe(11);
    expect(due2.getDate()).toBe(8);

    const due3 = getInvoiceDueDateForDate('2026-10-01T12:00:00.000Z', nubankCard);
    expect(due3.getFullYear()).toBe(2026);
    expect(due3.getMonth() + 1).toBe(11);
    expect(due3.getDate()).toBe(8);

    // Cartão com fechamento dia 25 e vencimento dia 5 do mês seguinte
    const interCard: Account = {
      ...nubankCard,
      id: 'acc-inter',
      closingDay: 25,
      dueDay: 5,
    };

    // Compra dia 10 de Outubro (< 25): fecha 25/out, vence 05/nov
    const dueInter1 = getInvoiceDueDateForDate('2026-10-10T12:00:00.000Z', interCard);
    expect(dueInter1.getMonth() + 1).toBe(11);
    expect(dueInter1.getDate()).toBe(5);

    // Compra dia 26 de Outubro (>= 25): fecha 25/nov, vence 05/dez
    const dueInter2 = getInvoiceDueDateForDate('2026-10-26T12:00:00.000Z', interCard);
    expect(dueInter2.getMonth() + 1).toBe(12);
    expect(dueInter2.getDate()).toBe(5);
  });

  it('unifies nextBillingDate to card invoice due date for all installments on the same card', () => {
    const jointCardId = 'acc-shared-nubank';
    const nubankCard: Account = {
      id: jointCardId,
      name: 'Nubank',
      type: 'credit_card',
      balance: 0,
      closingDay: 1,
      dueDay: 8,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const rawTxs: Transaction[] = [
      // Obramax 1/3 (passada) e 2/3 (próxima em 10/10)
      {
        id: 'tx-ob-1',
        accountId: jointCardId,
        categoryId: 'cat-casa',
        amount: 85.46,
        type: 'expense',
        description: 'Obramax (1/3)',
        date: '2026-09-10T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: '2026-09-10T12:00:00.000Z',
        updatedAt: '2026-09-10T12:00:00.000Z',
      },
      {
        id: 'tx-ob-2',
        accountId: jointCardId,
        categoryId: 'cat-casa',
        amount: 85.46,
        type: 'expense',
        description: 'Obramax (2/3)',
        date: '2026-10-10T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: '2026-09-10T12:00:00.000Z',
        updatedAt: '2026-09-10T12:00:00.000Z',
      },
      // Shein 1/3 (passada) e 2/3 (próxima em 03/10)
      {
        id: 'tx-sh-1',
        accountId: jointCardId,
        categoryId: 'cat-vest',
        amount: 56.99,
        type: 'expense',
        description: 'Shein (1/3)',
        date: '2026-09-03T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: '2026-09-03T12:00:00.000Z',
        updatedAt: '2026-09-03T12:00:00.000Z',
      },
      {
        id: 'tx-sh-2',
        accountId: jointCardId,
        categoryId: 'cat-vest',
        amount: 56.99,
        type: 'expense',
        description: 'Shein (2/3)',
        date: '2026-10-03T12:00:00.000Z',
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: '2026-09-03T12:00:00.000Z',
        updatedAt: '2026-09-03T12:00:00.000Z',
      },
    ];

    const groups = getActiveInstallmentGroups(rawTxs, jointCardId, false, [nubankCard]);
    const obramax = groups.find(g => g.description === 'Obramax');
    const shein = groups.find(g => g.description === 'Shein');

    expect(obramax).toBeDefined();
    expect(shein).toBeDefined();

    // Ambos devem ter nextBillingDate vencendo em 08 de Novembro de 2026
    const obDueDate = new Date(obramax!.nextBillingDate!);
    const shDueDate = new Date(shein!.nextBillingDate!);

    expect(obDueDate.getDate()).toBe(8);
    expect(obDueDate.getMonth() + 1).toBe(11); // Novembro (próximo mês, não outubro!)

    expect(shDueDate.getDate()).toBe(8);
    expect(shDueDate.getMonth() + 1).toBe(11); // Novembro

    // Conferindo que ambos têm a mesma data de vencimento de fatura:
    expect(obDueDate.toISOString().substring(0, 10)).toBe('2026-11-08');
    expect(shDueDate.toISOString().substring(0, 10)).toBe('2026-11-08');
  });

  it('retains recently completed installments until the next invoice cycle and auto-archives older ones', () => {
    const cardId = 'acc-nubank';
    const nubankCard: Account = {
      id: cardId,
      name: 'Nubank',
      type: 'credit_card',
      balance: 0,
      closingDay: 1,
      dueDay: 8,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const now = new Date();
    // Parcela finalizada recentemente (venceu ou foi faturada há poucos dias)
    const recentCompletedTxs: Transaction[] = [
      {
        id: 'tx-ticket-1',
        accountId: cardId,
        categoryId: 'cat-show',
        amount: 108.75,
        type: 'expense',
        description: 'Ticketmaster (1/2)',
        date: new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString(),
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tx-ticket-2',
        accountId: cardId,
        categoryId: 'cat-show',
        amount: 108.75,
        type: 'expense',
        description: 'Ticketmaster (2/2)',
        date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const groups = getActiveInstallmentGroups(recentCompletedTxs, cardId, false, [nubankCard]);
    const ticket = groups.find(g => g.description === 'Ticketmaster');
    expect(ticket).toBeDefined();
    expect(ticket!.isCompleted).toBe(true);
    expect(ticket!.remainingInstallmentsCount).toBe(0);

    // Parcela finalizada há muitos meses (ex: há 4 meses) - deve ser auto-arquivada
    const oldCompletedTxs: Transaction[] = [
      {
        id: 'tx-old-1',
        accountId: cardId,
        categoryId: 'cat-show',
        amount: 50.0,
        type: 'expense',
        description: 'Show Antigo (1/2)',
        date: new Date(now.getFullYear(), now.getMonth() - 5, 10).toISOString(),
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tx-old-2',
        accountId: cardId,
        categoryId: 'cat-show',
        amount: 50.0,
        type: 'expense',
        description: 'Show Antigo (2/2)',
        date: new Date(now.getFullYear(), now.getMonth() - 4, 10).toISOString(),
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const oldGroups = getActiveInstallmentGroups(oldCompletedTxs, cardId, false, [nubankCard]);
    const oldShow = oldGroups.find(g => g.description === 'Show Antigo');
    expect(oldShow).toBeUndefined(); // Auto-arquivado!
  });
});
