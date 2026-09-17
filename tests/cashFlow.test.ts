import { describe, it, expect } from 'vitest';
import { 
  calculateCashFlow, 
  isInvoicePayment, 
  isCardPurchase, 
  filterTransactionsByPeriod 
} from '../src/core/cashFlow/cashFlowHelper';
import { Account, Transaction } from '../src/core/types';

describe('Cash Flow Helper & Pierre Business Logic', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-checking',
      name: 'Inter Conta Corrente',
      type: 'checking',
      balance: 2500,
      color: '#FF7A00',
      icon: 'Landmark',
      currency: 'BRL',
      bankId: 'inter',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'acc-card',
      name: 'Nubank Ultravioleta',
      type: 'credit_card',
      balance: 1200,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      bankId: 'nubank',
      creditLimit: 10000,
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];

  const nowStr = '2026-09-16T14:30:00.000Z';

  const mockTransactions: Transaction[] = [
    // 1. Receita (Salário / Pix recebido na conta corrente)
    {
      id: 'tx-1',
      accountId: 'acc-checking',
      categoryId: 'cat-salario',
      amount: 5000,
      type: 'income',
      description: 'Salário Mensal',
      date: nowStr,
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      createdAt: nowStr,
      updatedAt: nowStr,
    },
    // 2. Compra no Cartão de Crédito (fatura aberta, não debitou da conta ainda)
    {
      id: 'tx-2',
      accountId: 'acc-card',
      categoryId: 'cat-alimentacao',
      amount: 450.50,
      type: 'expense',
      description: 'Supermercado Pão de Açúcar',
      date: nowStr,
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: nowStr,
      updatedAt: nowStr,
    },
    // 3. Despesa direta via Pix (debitada da conta corrente)
    {
      id: 'tx-3',
      accountId: 'acc-checking',
      categoryId: 'cat-moradia',
      amount: 1200,
      type: 'expense',
      description: 'Condomínio',
      date: nowStr,
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      createdAt: nowStr,
      updatedAt: nowStr,
    },
    // 4. Pagamento de Fatura do Cartão efetuado pela conta corrente
    {
      id: 'tx-4',
      accountId: 'acc-checking',
      categoryId: 'cat-outros',
      amount: 1564.82,
      type: 'expense',
      description: 'Pagamento Fatura Nubank',
      date: nowStr,
      status: 'confirmed',
      paymentMethod: 'transfer',
      source: 'manual',
      createdAt: nowStr,
      updatedAt: nowStr,
    },
  ];

  it('deve identificar corretamente pagamentos de fatura', () => {
    expect(isInvoicePayment(mockTransactions[3])).toBe(true);
    expect(isInvoicePayment(mockTransactions[1])).toBe(false);
    expect(isInvoicePayment(mockTransactions[2])).toBe(false);
  });

  it('deve identificar compras no cartão de crédito', () => {
    expect(isCardPurchase(mockTransactions[1], mockAccounts)).toBe(true);
    expect(isCardPurchase(mockTransactions[2], mockAccounts)).toBe(false);
  });

  it('deve calcular o fluxo de caixa no Regime de Caixa do Pierre (apenas dinheiro movimentado na conta bancária)', () => {
    // Modo base / padrão Pierre (simulateOpenInvoices: false)
    const result = calculateCashFlow(mockTransactions, mockAccounts, 'this_month', 9, 2026, false);

    // Entradas: Salário = R$ 5.000
    expect(result.totalIncome).toBe(5000);

    // Saídas Reais de Caixa no Pierre:
    // Pix Condomínio (1200.00) + Pagamento Fatura Nubank (1564.82) = R$ 2.764,82
    // A compra de R$ 450,50 no cartão NÃO sai do caixa até a fatura ser paga
    expect(result.totalExpense).toBe(2764.82);

    // Fluxo Líquido Real: 5000 - 2764.82 = R$ 2.235,18
    expect(result.netFlow).toBe(2235.18);

    // Identificação dos valores de fatura
    expect(result.paidInvoicesAmount).toBe(1564.82);
    expect(result.openInvoicesAmount).toBe(450.50);
    expect(result.isSimulated).toBe(false);

    // Transações no fluxo real contêm o pagamento de fatura e não a compra no cartão
    expect(result.transactions.some(t => t.id === 'tx-4')).toBe(true);
    expect(result.transactions.some(t => t.id === 'tx-2')).toBe(false);
  });

  it('deve calcular o fluxo projetado no modo Simular fatura (adicionando compras em aberto)', () => {
    // Modo simulado (simulateOpenInvoices: true)
    const result = calculateCashFlow(mockTransactions, mockAccounts, 'this_month', 9, 2026, true);

    expect(result.totalIncome).toBe(5000);

    // Saídas no modo simulado:
    // Saídas Reais (2764.82) + Compras em fatura aberta (450.50) = R$ 3.215,32
    expect(result.totalExpense).toBe(3215.32);

    // Fluxo Líquido Simulado: 5000 - 3215.32 = R$ 1.784,68
    expect(result.netFlow).toBe(1784.68);
    expect(result.cardPurchasesAmount).toBe(450.50);
    expect(result.isSimulated).toBe(true);

    // No modo simulado, a compra no cartão entra na lista de transações
    expect(result.transactions.some(t => t.id === 'tx-2')).toBe(true);
  });

  it('deve gerar os pontos diários do mês com dados corretos no modo real', () => {
    const result = calculateCashFlow(mockTransactions, mockAccounts, 'this_month', 9, 2026, false);

    expect(result.dailyPoints.length).toBe(30);

    const day16 = result.dailyPoints.find(p => p.day === 16);
    expect(day16).toBeDefined();
    expect(day16?.income).toBe(5000);
    expect(day16?.expense).toBe(2764.82);
  });
});
