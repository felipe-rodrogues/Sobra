import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/database/adapter';
import { Account, Transaction } from '../src/core/types';

describe('Operações de Transferência e Gestão de Contas', () => {
  let accOrigem: Account;
  let accDestino: Account;

  beforeEach(async () => {
    // Cria duas contas de teste
    accOrigem = await db.saveAccount({
      id: `acc-origem-${Date.now()}`,
      name: 'Conta Corrente Teste',
      type: 'checking',
      balance: 1000.00,
      color: '#10B981',
      icon: 'Wallet',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    accDestino = await db.saveAccount({
      id: `acc-destino-${Date.now()}`,
      name: 'Reserva Poupança Teste',
      type: 'savings',
      balance: 500.00,
      color: '#3B82F6',
      icon: 'PiggyBank',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it('transfere valor atômico entre contas, debitando na origem e creditando no destino', async () => {
    const transferTx: Transaction = {
      id: `tx-transf-${Date.now()}`,
      accountId: accOrigem.id,
      destinationAccountId: accDestino.id,
      categoryId: 'cat-outros-desp',
      amount: 300.00,
      type: 'transfer',
      description: 'Transferência para Poupança',
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveTransaction(transferTx);

    const accounts = await db.getAccounts();
    const updatedOrigem = accounts.find(a => a.id === accOrigem.id);
    const updatedDestino = accounts.find(a => a.id === accDestino.id);

    expect(updatedOrigem?.balance).toBe(700.00); // 1000 - 300
    expect(updatedDestino?.balance).toBe(800.00); // 500 + 300
  });

  it('reverte os saldos de origem e destino ao excluir uma transferência', async () => {
    const transferTx: Transaction = {
      id: `tx-transf-del-${Date.now()}`,
      accountId: accOrigem.id,
      destinationAccountId: accDestino.id,
      categoryId: 'cat-outros-desp',
      amount: 250.00,
      type: 'transfer',
      description: 'Transferência a excluir',
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveTransaction(transferTx);
    await db.deleteTransaction(transferTx.id);

    const accounts = await db.getAccounts();
    const restoredOrigem = accounts.find(a => a.id === accOrigem.id);
    const restoredDestino = accounts.find(a => a.id === accDestino.id);

    expect(restoredOrigem?.balance).toBe(1000.00);
    expect(restoredDestino?.balance).toBe(500.00);
  });

  it('permite editar dados de uma conta existente preservando seu identificador único', async () => {
    const updated = await db.saveAccount({
      ...accOrigem,
      name: 'Itaú Personalité',
      balance: 1500.00,
      color: '#EC7000',
    });

    expect(updated.id).toBe(accOrigem.id);
    expect(updated.name).toBe('Itaú Personalité');
    expect(updated.balance).toBe(1500.00);
    expect(updated.color).toBe('#EC7000');
  });
});
