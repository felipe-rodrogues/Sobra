import { describe, it, expect, beforeEach } from 'vitest';
import { calculateInvoiceForMonth } from '../src/core/installments/installmentHelper';
import { Account, Transaction } from '../src/core/types';
import { db } from '../src/database/adapter';

describe('Correções de Conta Conjunta, Importação de CSV e Fatura', () => {
  const memoryStorage: Record<string, string> = {};
  if (typeof globalThis.localStorage === 'undefined') {
    (globalThis as any).localStorage = {
      getItem: (k: string) => memoryStorage[k] || null,
      setItem: (k: string, v: string) => { memoryStorage[k] = v; },
      removeItem: (k: string) => { delete memoryStorage[k]; },
      clear: () => { Object.keys(memoryStorage).forEach(k => delete memoryStorage[k]); }
    };
  }

  beforeEach(async () => {
    localStorage.clear();
    await db.resetAll('empty');
  });

  it('1. Deve calcular a fatura estritamente pela soma das despesas (sem duplicar saldo)', () => {
    const cardId = 'card-test-shared';
    const now = new Date();
    const curMonth = now.getUTCMonth() + 1;
    const curYear = now.getUTCFullYear();
    const dateIso = `${curYear}-${String(curMonth).padStart(2, '0')}-15T12:00:00.000Z`;

    const txs: Transaction[] = [
      {
        id: 'tx-1',
        accountId: cardId,
        categoryId: 'cat-test',
        amount: 1000.0,
        type: 'expense',
        description: 'Mercado',
        date: dateIso,
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'csv',
        isShared: true,
        createdAt: dateIso,
        updatedAt: dateIso,
      },
      {
        id: 'tx-2',
        accountId: cardId,
        categoryId: 'cat-test',
        amount: 953.56,
        type: 'expense',
        description: 'Passagem aérea',
        date: dateIso,
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'csv',
        isShared: true,
        createdAt: dateIso,
        updatedAt: dateIso,
      },
    ];

    const invoice = calculateInvoiceForMonth(cardId, txs, curMonth, curYear);
    expect(invoice.totalAmount).toBe(1953.56);
    expect(invoice.transactions.length).toBe(2);

    // Cota de 50% em conta conjunta
    const quota50 = Math.round(invoice.totalAmount * 0.5 * 100) / 100;
    expect(quota50).toBe(976.78);
  });

  it('2. Ao excluir uma compra da fatura, o total deve diminuir imediatamente', () => {
    const cardId = 'card-test-shared';
    const now = new Date();
    const curMonth = now.getUTCMonth() + 1;
    const curYear = now.getUTCFullYear();
    const dateIso = `${curYear}-${String(curMonth).padStart(2, '0')}-10T12:00:00.000Z`;

    let txs: Transaction[] = [
      {
        id: 'tx-1',
        accountId: cardId,
        categoryId: 'cat-test',
        amount: 1900.0,
        type: 'expense',
        description: 'Supermercado',
        date: dateIso,
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'csv',
        isShared: true,
        createdAt: dateIso,
        updatedAt: dateIso,
      },
      {
        id: 'tx-2',
        accountId: cardId,
        categoryId: 'cat-test',
        amount: 53.56,
        type: 'expense',
        description: 'Farmácia',
        date: dateIso,
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'csv',
        isShared: true,
        createdAt: dateIso,
        updatedAt: dateIso,
      },
    ];

    const initialInvoice = calculateInvoiceForMonth(cardId, txs, curMonth, curYear);
    expect(initialInvoice.totalAmount).toBe(1953.56);

    // Exclui a compra tx-2 de R$ 53,56
    txs = txs.filter(t => t.id !== 'tx-2');
    const updatedInvoice = calculateInvoiceForMonth(cardId, txs, curMonth, curYear);

    expect(updatedInvoice.totalAmount).toBe(1900.0);
    expect(updatedInvoice.transactions.length).toBe(1);
    expect(Math.round(updatedInvoice.totalAmount * 0.5 * 100) / 100).toBe(950.0);
  });

  it('3. O adaptador de banco de dados deve manter account.invoiceAmount atualizado ao excluir despesa de cartão', async () => {
    const cardAcc: Account = {
      id: 'card-adapter-test',
      name: 'Cartão Conjunto',
      type: 'credit_card',
      balance: 1953.56,
      invoiceAmount: 1953.56,
      creditLimit: 5000,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveAccount(cardAcc);

    const tx: Transaction = {
      id: 'tx-test-del',
      accountId: cardAcc.id,
      categoryId: 'cat-test',
      amount: 153.56,
      type: 'expense',
      description: 'Jantar',
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'csv',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveTransaction(tx);

    const accAfterSave = (await db.getAccounts()).find(a => a.id === cardAcc.id);
    expect(accAfterSave?.balance).toBe(2107.12);

    // Exclui a transação
    await db.deleteTransaction('tx-test-del');

    const accounts = await db.getAccounts();
    const updated = accounts.find(a => a.id === cardAcc.id);
    expect(updated).toBeDefined();
    // Saldo e fatura devem ter diminuído pelo valor da transação excluída, voltando a 1953.56
    expect(updated?.balance).toBe(1953.56);
    expect(updated?.invoiceAmount).toBe(1953.56);
  });

  it('4. Estornos / créditos em cartão diminuem o total da fatura corretamente', () => {
    const cardId = 'card-estorno';
    const now = new Date();
    const curMonth = now.getUTCMonth() + 1;
    const curYear = now.getUTCFullYear();
    const dateIso = `${curYear}-${String(curMonth).padStart(2, '0')}-05T12:00:00.000Z`;

    const txs: Transaction[] = [
      {
        id: 'tx-exp',
        accountId: cardId,
        categoryId: 'cat-test',
        amount: 200.0,
        type: 'expense',
        description: 'Compra cancelada',
        date: dateIso,
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'csv',
        createdAt: dateIso,
        updatedAt: dateIso,
      },
      {
        id: 'tx-estorno',
        accountId: cardId,
        categoryId: 'cat-test',
        amount: 200.0,
        type: 'income',
        description: 'Estorno da compra',
        date: dateIso,
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'csv',
        createdAt: dateIso,
        updatedAt: dateIso,
      },
    ];

    const invoice = calculateInvoiceForMonth(cardId, txs, curMonth, curYear);
    expect(invoice.totalAmount).toBe(0.0);
  });
});
