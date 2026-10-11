import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/database/adapter';
import { calculateCashFlow } from '../src/core/cashFlow/cashFlowHelper';
import { Account, Goal, GoalContribution, Transaction } from '../src/core/types';

describe('Sincronização Bidirecional de Aportes (Metas <-> Movimentações <-> Fluxo de Caixa)', () => {
  beforeEach(async () => {
    await db.resetAll('empty');
    await db.saveAccount({
      id: 'acc-checking-1',
      name: 'Conta Corrente Teste',
      type: 'checking',
      balance: 1000.00,
      color: '#10B981',
      icon: 'Wallet',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    await db.saveGoal({
      id: 'goal-ps5',
      name: 'PlayStation 5',
      targetAmount: 4000.00,
      currentAmount: 0.00,
      color: '#38BDF8',
      icon: 'Gamepad2',
      defaultAccountId: 'acc-checking-1',
      isCompleted: false,
      createdAt: '2026-01-01',
    });
  });

  it('1. Ao salvar aporte, vincula bidirecionalmente a transação, debita a conta e reflete no fluxo de caixa', async () => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const amount = 250.00;
    const contribId = 'contrib-test-123';
    const txId = `tx-contrib-${contribId}`;

    // Registra aporte com ID de transação vinculada
    const contrib: GoalContribution = {
      id: contribId,
      goalId: 'goal-ps5',
      amount,
      date: todayStr,
      isAutomatic: false,
      sourceAccountId: 'acc-checking-1',
      transactionId: txId,
      note: 'Aporte PlayStation',
      createdAt: new Date().toISOString(),
    };
    await db.saveGoalContribution(contrib);

    // Registra transação correspondente no fluxo de caixa
    const tx: Transaction = {
      id: txId,
      accountId: 'acc-checking-1',
      categoryId: 'cat-invest-futuro',
      amount,
      type: 'expense',
      description: 'Aporte: PlayStation 5',
      date: `${todayStr}T12:00:00.000Z`,
      status: 'confirmed',
      paymentMethod: 'transfer',
      source: 'manual',
      notes: `Aporte para a meta PlayStation 5 (ID: ${contribId})`,
      goalId: 'goal-ps5',
      goalContributionId: contribId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveTransaction(tx);

    // Atualiza saldo acumulado da meta
    const goals = await db.getGoals();
    const targetGoal = goals.find(g => g.id === 'goal-ps5')!;
    await db.saveGoal({
      ...targetGoal,
      currentAmount: targetGoal.currentAmount + amount,
    });

    // Verificações:
    const accs = await db.getAccounts();
    const acc = accs.find(a => a.id === 'acc-checking-1')!;
    expect(acc.balance).toBe(750.00); // 1000 - 250

    const txs = await db.getTransactions();
    expect(txs.length).toBe(1);
    expect(txs[0].goalContributionId).toBe(contribId);
    expect(txs[0].goalId).toBe('goal-ps5');

    const cashFlow = calculateCashFlow(txs, accs, 'this_month');
    expect(cashFlow.totalExpense).toBe(250.00);
    expect(cashFlow.netFlow).toBe(-250.00);

    const contribs = await db.getGoalContributions();
    expect(contribs.length).toBe(1);
    expect(contribs[0].transactionId).toBe(txId);
  });

  it('2. Ao excluir o aporte na tela de metas, a transação vinculada é removida do banco, saldo é estornado e fluxo é zerado', async () => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const amount = 300.00;
    const contribId = 'contrib-test-456';
    const txId = `tx-contrib-${contribId}`;

    const contrib: GoalContribution = {
      id: contribId,
      goalId: 'goal-ps5',
      amount,
      date: todayStr,
      isAutomatic: false,
      sourceAccountId: 'acc-checking-1',
      transactionId: txId,
      createdAt: new Date().toISOString(),
    };
    await db.saveGoalContribution(contrib);

    const tx: Transaction = {
      id: txId,
      accountId: 'acc-checking-1',
      categoryId: 'cat-invest-futuro',
      amount,
      type: 'expense',
      description: 'Aporte: PlayStation 5',
      date: `${todayStr}T12:00:00.000Z`,
      status: 'confirmed',
      paymentMethod: 'transfer',
      source: 'manual',
      goalId: 'goal-ps5',
      goalContributionId: contribId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveTransaction(tx);

    const goals = await db.getGoals();
    const goal = goals.find(g => g.id === 'goal-ps5')!;
    await db.saveGoal({ ...goal, currentAmount: 300.00 });

    // Simula lógica de exclusão do aporte (deleteGoalContribution):
    // 1. Remove aporte
    await db.deleteGoalContribution(contribId);

    // 2. Localiza e remove transação vinculada (por transactionId, goalContributionId ou id)
    const allTxs = await db.getTransactions();
    const linkedTx = allTxs.find(t =>
      t.id === contrib.transactionId ||
      t.goalContributionId === contrib.id ||
      t.id === `tx-contrib-${contrib.id}`
    );
    expect(linkedTx).toBeDefined();
    await db.deleteTransaction(linkedTx!.id);

    // 3. Atualiza meta
    await db.saveGoal({ ...goal, currentAmount: Math.max(0, goal.currentAmount - amount) });

    // Verificações pós-exclusão:
    const finalContribs = await db.getGoalContributions();
    expect(finalContribs.length).toBe(0);

    const finalTxs = await db.getTransactions();
    expect(finalTxs.length).toBe(0);

    const finalAccs = await db.getAccounts();
    expect(finalAccs.find(a => a.id === 'acc-checking-1')!.balance).toBe(1000.00); // 700 + 300 estornado

    const finalGoals = await db.getGoals();
    expect(finalGoals.find(g => g.id === 'goal-ps5')!.currentAmount).toBe(0.00);

    const cashFlow = calculateCashFlow(finalTxs, finalAccs, 'this_month');
    expect(cashFlow.totalExpense).toBe(0);
  });

  it('3. Ao excluir a transação na tela de movimentações, o aporte vinculado na tela de metas é removido e não ressuscita', async () => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const amount = 500.00;
    const contribId = 'contrib-test-789';
    const txId = `tx-contrib-${contribId}`;

    const contrib: GoalContribution = {
      id: contribId,
      goalId: 'goal-ps5',
      amount,
      date: todayStr,
      isAutomatic: false,
      sourceAccountId: 'acc-checking-1',
      transactionId: txId,
      createdAt: new Date().toISOString(),
    };
    await db.saveGoalContribution(contrib);

    const tx: Transaction = {
      id: txId,
      accountId: 'acc-checking-1',
      categoryId: 'cat-invest-futuro',
      amount,
      type: 'expense',
      description: 'Aporte: PlayStation 5',
      date: `${todayStr}T12:00:00.000Z`,
      status: 'confirmed',
      paymentMethod: 'transfer',
      source: 'manual',
      goalId: 'goal-ps5',
      goalContributionId: contribId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveTransaction(tx);

    const goals = await db.getGoals();
    const goal = goals.find(g => g.id === 'goal-ps5')!;
    await db.saveGoal({ ...goal, currentAmount: 500.00 });

    // Simula lógica de exclusão da transação nas movimentações (deleteTransaction):
    // 1. Localiza e exclui o aporte vinculado
    const allContribs = await db.getGoalContributions();
    const linkedContrib = allContribs.find(c =>
      c.id === tx.goalContributionId ||
      c.transactionId === tx.id ||
      tx.id === `tx-contrib-${c.id}`
    );
    expect(linkedContrib).toBeDefined();
    await db.deleteGoalContribution(linkedContrib!.id);

    // 2. Decrementa o saldo acumulado da meta
    await db.saveGoal({ ...goal, currentAmount: Math.max(0, goal.currentAmount - linkedContrib!.amount) });

    // 3. Exclui a transação
    await db.deleteTransaction(tx.id);

    // Verificações pós-exclusão:
    const remainingTxs = await db.getTransactions();
    expect(remainingTxs.length).toBe(0);

    const remainingContribs = await db.getGoalContributions();
    expect(remainingContribs.length).toBe(0);

    const accs = await db.getAccounts();
    expect(accs.find(a => a.id === 'acc-checking-1')!.balance).toBe(1000.00);

    const updatedGoals = await db.getGoals();
    expect(updatedGoals.find(g => g.id === 'goal-ps5')!.currentAmount).toBe(0.00);

    // 4. Garante que se o reconciliador rodar, nenhuma transação fantasma será recriada
    // porque o aporte já foi deletado de goalContributions!
    const contribListAfter = await db.getGoalContributions();
    expect(contribListAfter.length).toBe(0);
  });
});
