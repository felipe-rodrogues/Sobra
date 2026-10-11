import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/database/adapter';
import { calculateCashFlow } from '../src/core/cashFlow/cashFlowHelper';
import { Account, Goal, Transaction } from '../src/core/types';

describe('Goal Contribution Cash Flow Integration', () => {
  beforeEach(async () => {
    // Limpa base e insere conta e meta para teste
    await db.resetAll('empty');
    await db.saveAccount({
      id: 'acc-test-checking',
      name: 'Conta Corrente Teste',
      type: 'checking',
      balance: 2000.00,
      color: '#10B981',
      icon: 'Wallet',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    await db.saveGoal({
      id: 'goal-test-viagem',
      name: 'Viagem dos Sonhos',
      targetAmount: 5000.00,
      currentAmount: 0.00,
      color: '#4ADE80',
      icon: 'Plane',
      defaultAccountId: 'acc-test-checking',
      isCompleted: false,
      createdAt: '2026-01-01',
    });
  });

  it('deve debitar a conta e refletir a saída no Fluxo de Caixa ao salvar aporte com conta de débito', async () => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const amount = 150.00;

    // 1. Cria a transação correspondente ao aporte
    const goalTx: Transaction = {
      id: 'tx-contrib-test-1',
      accountId: 'acc-test-checking',
      categoryId: 'cat-invest-futuro',
      amount,
      type: 'expense',
      description: 'Aporte: Viagem dos Sonhos',
      date: `${todayStr}T12:00:00.000Z`,
      status: 'confirmed',
      paymentMethod: 'transfer',
      source: 'manual',
      notes: 'Aporte manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveTransaction(goalTx);

    // 2. Verifica se a conta corrente teve seu saldo debitado
    const accounts = await db.getAccounts();
    const account = accounts.find(a => a.id === 'acc-test-checking');
    expect(account).toBeDefined();
    expect(account!.balance).toBe(1850.00); // 2000 - 150

    // 3. Verifica se o Fluxo de Caixa captura a despesa de R$ 150
    const txs = await db.getTransactions();
    const cashFlow = calculateCashFlow(txs, accounts, 'this_month');

    expect(cashFlow.totalExpense).toBe(150.00);
    expect(cashFlow.directExpensesAmount).toBe(150.00);
    expect(cashFlow.netFlow).toBe(-150.00);

    // 4. Ao deletar o aporte, o saldo deve ser estornado e o fluxo de caixa zerado
    await db.deleteTransaction(goalTx.id);
    const accountsAfterDelete = await db.getAccounts();
    const accountRestored = accountsAfterDelete.find(a => a.id === 'acc-test-checking');
    expect(accountRestored!.balance).toBe(2000.00);

    const txsAfterDelete = await db.getTransactions();
    const cashFlowAfterDelete = calculateCashFlow(txsAfterDelete, accountsAfterDelete, 'this_month');
    expect(cashFlowAfterDelete.totalExpense).toBe(0);
    expect(cashFlowAfterDelete.netFlow).toBe(0);
  });
});
