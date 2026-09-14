import { describe, it, expect } from 'vitest';
import { db } from '../src/database/adapter';
import { notificationEngine } from '../src/core/parsers/notificationEngine';
import { 
  calculateConsolidatedBalance, 
  calculateMonthlySummary, 
  calculateSpendingByCategory, 
  calculateBudgetStatuses 
} from '../src/core/calculations';
import { Account, Transaction, Budget, PendingNotification } from '../src/core/types';

describe('End-to-End User Flow Integration Test', () => {
  it('deve executar o fluxo completo exigido pelo usuário com perfeição', async () => {
    // 1. Carregar estado inicial
    await db.resetAll();
    const initialAccounts = await db.getAccounts();
    const initialBalance = calculateConsolidatedBalance(initialAccounts);
    expect(initialBalance).toBeGreaterThan(0);

    // 2. Criar nova conta ("Inter Digital", saldo R$ 1.200,00)
    const newAccount: Account = {
      id: 'acc-inter',
      name: 'Inter Digital',
      type: 'checking',
      balance: 1200.00,
      color: '#FF7A00',
      icon: 'Wallet',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveAccount(newAccount);

    const accountsAfterNew = await db.getAccounts();
    const balanceAfterNew = calculateConsolidatedBalance(accountsAfterNew);
    expect(balanceAfterNew).toBe(initialBalance + 1200.00);

    // 3. Adicionar transação manual (Despesa: Almoço Restaurante, R$ 65,00)
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const manualTx: Transaction = {
      id: 'tx-manual-almoco',
      accountId: 'acc-inter',
      categoryId: 'cat-alim',
      amount: 65.00,
      type: 'expense',
      description: 'Almoço Restaurante',
      date: new Date(currentYear, currentMonth - 1, 15).toISOString(),
      status: 'confirmed',
      paymentMethod: 'debit',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveTransaction(manualTx);

    // Saldo da conta Inter deve ter reduzido de 1200 para 1135
    const interAcc = (await db.getAccounts()).find(a => a.id === 'acc-inter');
    expect(interAcc?.balance).toBe(1135.00);

    // 4. Detecção via Notificação Bancária Simulada (Nubank)
    const rawTitle = 'Nubank';
    const rawText = 'Compra aprovada no seu Nubank de R$ 45,90 em PADARIA ESTRELA';
    const parsed = notificationEngine.processNotification(rawTitle, rawText, 'com.nu.production');

    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(45.90);
    expect(parsed?.merchant).toBe('PADARIA ESTRELA');
    expect(parsed?.type).toBe('expense');

    // Fila de notificação pendente
    const pendingNotif: PendingNotification = {
      id: 'pending-test-1',
      bankPackage: 'com.nu.production',
      bankName: 'Nubank',
      rawTitle,
      rawText,
      parsedAmount: parsed!.amount,
      parsedMerchant: parsed!.merchant,
      parsedType: parsed!.type,
      parsedPaymentMethod: parsed!.paymentMethod,
      suggestedAccountId: 'acc-inter',
      suggestedCategoryId: 'cat-alim',
      detectedAt: new Date().toISOString(),
      status: 'pending',
    };
    await db.savePendingNotification(pendingNotif);

    const pendingList = await db.getPendingNotifications();
    expect(pendingList.some(p => p.id === 'pending-test-1')).toBe(true);

    // 5. Usuário revisa e confirma a notificação detectada
    const detectedTx: Transaction = {
      id: 'tx-detected-padaria',
      accountId: 'acc-inter',
      categoryId: 'cat-alim',
      amount: pendingNotif.parsedAmount,
      type: pendingNotif.parsedType,
      description: pendingNotif.parsedMerchant,
      date: new Date(currentYear, currentMonth - 1, 15).toISOString(),
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveTransaction(detectedTx);
    await db.updatePendingNotificationStatus(pendingNotif.id, 'approved');

    // Fila não deve mais conter como pendente
    const pendingAfterApprove = await db.getPendingNotifications();
    expect(pendingAfterApprove.some(p => p.id === 'pending-test-1')).toBe(false);

    // 6. Verificar reflexo no Dashboard (gastos de Alimentação somados)
    const allTransactions = await db.getTransactions();
    const allCategories = await db.getCategories();
    const spending = calculateSpendingByCategory(allTransactions, allCategories, currentMonth, currentYear);

    const alimSpending = spending.find(s => s.categoryId === 'cat-alim');
    expect(alimSpending).toBeDefined();
    // 450.50 (inicial) + 65.00 (manual) + 45.90 (notificação) = 561.40
    expect(alimSpending?.amount).toBe(561.40);

    // 7. Definir Orçamento Mensal que force alerta de limite ultrapassado
    // Definimos limite de R$ 500,00 para Alimentação (gasto atual é R$ 561,40 -> ultrapassou!)
    const testBudget: Budget = {
      id: 'b-test-alim',
      categoryId: 'cat-alim',
      monthlyLimit: 500.00,
      month: currentMonth,
      year: currentYear,
      createdAt: new Date().toISOString(),
    };
    await db.saveBudget(testBudget);

    const budgets = await db.getBudgets(currentMonth, currentYear);
    const budgetStatuses = calculateBudgetStatuses(budgets, allCategories, allTransactions, currentMonth, currentYear);

    const alimStatus = budgetStatuses.find(b => b.categoryId === 'cat-alim');
    expect(alimStatus?.status).toBe('danger');
    expect(alimStatus?.spentAmount).toBe(561.40);
    expect(alimStatus?.monthlyLimit).toBe(500.00);
    expect(alimStatus?.percentageSpent).toBeGreaterThan(100);
  });
});
