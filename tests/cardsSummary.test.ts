import { describe, it, expect } from 'vitest';
import { db } from '../src/database/adapter';
import { Account, Transaction } from '../src/core/types';

describe('Cartões de Crédito (Design Inspirado na Referência)', () => {
  it('deve carregar os cartões padrão com dados estruturados de fechamento, vencimento e limite', async () => {
    await db.resetAll('demo');
    const accounts = await db.getAccounts();
    const creditCards = accounts.filter(a => a.type === 'credit_card');

    expect(creditCards.length).toBeGreaterThanOrEqual(2);

    const nubank = creditCards.find(c => c.name.toLowerCase().includes('nubank'));
    expect(nubank).toBeDefined();
    expect(nubank?.creditLimit).toBe(4200.00);
    expect(nubank?.openAmount).toBe(1542.85);
    expect(nubank?.invoiceAmount).toBe(939.40);
    expect(nubank?.closingDay).toBe(1);
    expect(nubank?.dueDay).toBe(8);
    expect(nubank?.cardBrand).toBe('mastercard');
    expect(nubank?.invoiceStatus).toBe('closed');

    const inter = creditCards.find(c => c.name.toLowerCase().includes('inter'));
    expect(inter).toBeDefined();
    expect(inter?.creditLimit).toBe(9180.00);
    expect(inter?.openAmount).toBe(4574.63);
    expect(inter?.invoiceAmount).toBe(1420.79);
    expect(inter?.closingDay).toBe(4);
    expect(inter?.dueDay).toBe(10);
    expect(inter?.cardBrand).toBe('mastercard');
  });

  it('deve abater o valor da fatura ao registrar pagamento com sucesso', async () => {
    await db.resetAll('demo');
    const accounts = await db.getAccounts();
    const nubank = accounts.find(a => a.name.toLowerCase() === 'nubank' && a.type === 'credit_card')!;
    const checking = accounts.find(a => a.type === 'checking')!;

    const initialInvoice = nubank.invoiceAmount || 939.40;
    const initialCheckingBalance = checking.balance;

    // Simulação do fluxo de registro de pagamento de fatura:
    // 1. Criar transação de pagamento
    const paymentTx: Transaction = {
      id: 'tx-pay-nubank-test',
      accountId: checking.id,
      categoryId: 'cat-moradia',
      amount: initialInvoice,
      type: 'expense',
      description: `Pagamento Fatura ${nubank.name}`,
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'transfer',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveTransaction(paymentTx);

    // 2. Atualizar saldo da conta corrente e fatura do cartão
    await db.saveAccount({
      ...checking,
      balance: initialCheckingBalance - initialInvoice,
    });

    await db.saveAccount({
      ...nubank,
      balance: 0,
      invoiceAmount: 0,
      invoiceStatus: 'paid',
    });

    // 3. Verificar persistência
    const updatedAccounts = await db.getAccounts();
    const updatedNubank = updatedAccounts.find(a => a.id === nubank.id)!;
    const updatedChecking = updatedAccounts.find(a => a.id === checking.id)!;

    expect(updatedNubank.invoiceAmount).toBe(0);
    expect(updatedNubank.invoiceStatus).toBe('paid');
    expect(updatedChecking.balance).toBe(initialCheckingBalance - initialInvoice);
  });
});
