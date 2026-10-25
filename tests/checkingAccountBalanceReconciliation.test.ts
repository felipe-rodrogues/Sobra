import { describe, it, expect, beforeEach } from 'vitest';
import { calculateCheckingAccountBalance } from '../src/core/calculations';
import { db } from '../src/database/adapter';
import { Account, Transaction } from '../src/core/types';

describe('Checking Account Balance & Deletion Reconciliation', () => {
  beforeEach(async () => {
    await db.resetAll('empty');
  });

  it('calculates exact balance for user scenario (Bruna, Pagamento Fatura, Salário)', () => {
    const checkingAcc: Account = {
      id: 'acc-conta-principal',
      name: 'Conta Principal',
      type: 'checking',
      balance: 2225.65, // Corrupted balance reported by user
      color: '#10B981',
      icon: 'Landmark',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const txs: Transaction[] = [
      {
        id: 'tx-1',
        accountId: 'acc-conta-principal',
        categoryId: 'cat-salario',
        amount: 19.50,
        type: 'income',
        description: 'Bruna Ktely Rodrigues F...',
        date: '2026-10-19T21:23:00Z',
        status: 'confirmed',
        createdAt: '2026-10-19T21:23:00Z',
        updatedAt: '2026-10-19T21:23:00Z',
      },
      {
        id: 'tx-2',
        accountId: 'acc-conta-principal',
        categoryId: 'cat-fatura',
        amount: 1707.83,
        type: 'expense',
        description: 'Pagamento Fatura Nu...',
        date: '2026-10-07T09:00:00Z',
        status: 'confirmed',
        createdAt: '2026-10-07T09:00:00Z',
        updatedAt: '2026-10-07T09:00:00Z',
      },
      {
        id: 'tx-3',
        accountId: 'acc-conta-principal',
        categoryId: 'cat-salario',
        amount: 2050.00,
        type: 'income',
        description: 'Salário',
        date: '2026-10-07T08:00:00Z',
        status: 'confirmed',
        createdAt: '2026-10-07T08:00:00Z',
        updatedAt: '2026-10-07T08:00:00Z',
      },
    ];

    const reconciled = calculateCheckingAccountBalance(checkingAcc, txs);
    // 0 + 19.50 - 1707.83 + 2050.00 = 361.67
    expect(reconciled).toBe(361.67);
  });

  it('reverts balance in db.deleteTransaction even if status was omitted / undefined', async () => {
    const acc: Account = {
      id: 'acc-teste-del',
      name: 'Conta Teste',
      type: 'checking',
      balance: 1000.00,
      initialBalance: 1000.00,
      color: '#10B981',
      icon: 'Landmark',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveAccount(acc);

    // Salva despesa sem status explícito (simula bug legado onde status vinha undefined)
    const expenseTx: Transaction = {
      id: 'tx-exp-1',
      accountId: 'acc-teste-del',
      categoryId: 'cat-1',
      amount: 250.00,
      type: 'expense',
      description: 'Compra Mercado',
      date: '2026-10-20T10:00:00Z',
      // status omitido propositalmente
    } as any;
    await db.saveTransaction(expenseTx);

    // O saldo deve ter caído de 1000 para 750
    const accAfterExp = (await db.getAccounts()).find(a => a.id === 'acc-teste-del');
    expect(accAfterExp?.balance).toBe(750.00);

    // Agora deleta a transação
    await db.deleteTransaction('tx-exp-1');

    // O saldo deve ser restaurado para 1000.00
    const accAfterDel = (await db.getAccounts()).find(a => a.id === 'acc-teste-del');
    expect(accAfterDel?.balance).toBe(1000.00);
  });

  it('reverts balance in db.deleteTransaction when an income is deleted', async () => {
    const acc: Account = {
      id: 'acc-teste-income',
      name: 'Conta Receitas',
      type: 'checking',
      balance: 500.00,
      initialBalance: 500.00,
      color: '#10B981',
      icon: 'Landmark',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveAccount(acc);

    const incomeTx: Transaction = {
      id: 'tx-inc-1',
      accountId: 'acc-teste-income',
      categoryId: 'cat-salario',
      amount: 1500.00,
      type: 'income',
      description: 'Freela',
      date: '2026-10-21T12:00:00Z',
      status: 'confirmed',
    } as any;
    await db.saveTransaction(incomeTx);

    const accAfterInc = (await db.getAccounts()).find(a => a.id === 'acc-teste-income');
    expect(accAfterInc?.balance).toBe(2000.00);

    // Exclui a receita
    await db.deleteTransaction('tx-inc-1');

    const accAfterDel = (await db.getAccounts()).find(a => a.id === 'acc-teste-income');
    expect(accAfterDel?.balance).toBe(500.00);
  });

  it('reverts both source and destination accounts when a transfer is deleted', async () => {
    const srcAcc: Account = {
      id: 'acc-src',
      name: 'Conta Origem',
      type: 'checking',
      balance: 1000.00,
      color: '#10B981',
      icon: 'Landmark',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const dstAcc: Account = {
      id: 'acc-dst',
      name: 'Conta Destino',
      type: 'checking',
      balance: 200.00,
      color: '#3B82F6',
      icon: 'Landmark',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveAccount(srcAcc);
    await db.saveAccount(dstAcc);

    const transferTx: Transaction = {
      id: 'tx-trf-1',
      accountId: 'acc-src',
      destinationAccountId: 'acc-dst',
      categoryId: 'cat-transf',
      amount: 300.00,
      type: 'transfer',
      description: 'Transferência Pix',
      date: '2026-10-22T14:00:00Z',
      status: 'confirmed',
    } as any;
    await db.saveTransaction(transferTx);

    const srcAfter = (await db.getAccounts()).find(a => a.id === 'acc-src');
    const dstAfter = (await db.getAccounts()).find(a => a.id === 'acc-dst');
    expect(srcAfter?.balance).toBe(700.00);
    expect(dstAfter?.balance).toBe(500.00);

    // Deleta a transferência
    await db.deleteTransaction('tx-trf-1');

    const srcReverted = (await db.getAccounts()).find(a => a.id === 'acc-src');
    const dstReverted = (await db.getAccounts()).find(a => a.id === 'acc-dst');
    expect(srcReverted?.balance).toBe(1000.00);
    expect(dstReverted?.balance).toBe(200.00);
  });

  it('reverts checking account balance when deleteInstallmentGroup is called', async () => {
    const acc: Account = {
      id: 'acc-installments',
      name: 'Conta Débito',
      type: 'checking',
      balance: 5000.00,
      color: '#10B981',
      icon: 'Landmark',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveAccount(acc);

    const groupId = 'group-parcelado-1';
    const tx1: Transaction = {
      id: 'tx-inst-1',
      installmentGroupId: groupId,
      accountId: 'acc-installments',
      categoryId: 'cat-curso',
      amount: 500.00,
      type: 'expense',
      description: 'Curso (1/2)',
      date: '2026-10-01T10:00:00Z',
      status: 'confirmed',
    } as any;
    const tx2: Transaction = {
      id: 'tx-inst-2',
      installmentGroupId: groupId,
      accountId: 'acc-installments',
      categoryId: 'cat-curso',
      amount: 500.00,
      type: 'expense',
      description: 'Curso (2/2)',
      date: '2026-11-01T10:00:00Z',
      status: 'confirmed',
    } as any;

    await db.saveTransaction(tx1);
    await db.saveTransaction(tx2);

    const accAfterInst = (await db.getAccounts()).find(a => a.id === 'acc-installments');
    expect(accAfterInst?.balance).toBe(4000.00); // 5000 - 500 - 500

    // Deleta todo o grupo de parcelamento
    await db.deleteInstallmentGroup(groupId);

    const accAfterGroupDel = (await db.getAccounts()).find(a => a.id === 'acc-installments');
    expect(accAfterGroupDel?.balance).toBe(5000.00);
  });
});
