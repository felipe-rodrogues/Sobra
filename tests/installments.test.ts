import { describe, it, expect } from 'vitest';
import { 
  generateInstallmentTransactions, 
  calculateInvoiceForMonth, 
  calculateFutureInvoiceTimeline, 
  getActiveInstallmentGroups,
  addMonthsToDate 
} from '../src/core/installments/installmentHelper';
import { Transaction } from '../src/core/types';

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
    await db.resetAll();

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
});
