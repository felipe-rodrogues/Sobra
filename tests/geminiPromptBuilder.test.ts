import { describe, it, expect } from 'vitest';
import { buildFinancialSystemPrompt } from '../src/core/ai/geminiPromptBuilder';
import { Account, Category, Transaction, Budget, Subscription } from '../src/core/types';

describe('Sobra AI - Gemini Prompt Builder', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-nu',
      name: 'Nubank',
      type: 'credit_card',
      balance: 1200.50,
      creditLimit: 5000,
      closingDay: 1,
      dueDay: 8,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'acc-cc',
      name: 'Conta Corrente Inter',
      type: 'checking',
      balance: 3450.00,
      color: '#FF7A00',
      icon: 'Wallet',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];

  const mockCategories: Category[] = [
    { id: 'cat-sal', name: 'Salário', type: 'income', icon: 'Briefcase', color: '#10B981', isCustom: false, createdAt: '' },
    { id: 'cat-alim', name: 'Alimentação', type: 'expense', icon: 'Utensils', color: '#F59E0B', isCustom: false, createdAt: '' },
  ];

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      accountId: 'acc-nu',
      categoryId: 'cat-alim',
      amount: 150.00,
      type: 'expense',
      description: 'Supermercado Pão de Açúcar',
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tx-2',
      accountId: 'acc-cc',
      categoryId: 'cat-sal',
      amount: 5000.00,
      type: 'income',
      description: 'Salário Empresa',
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];

  const mockBudgets: Budget[] = [
    {
      id: 'b-1',
      categoryId: 'cat-alim',
      monthlyLimit: 1000.00,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      createdAt: new Date().toISOString(),
    }
  ];

  const mockSubscriptions: Subscription[] = [
    {
      id: 'sub-1',
      name: 'Netflix',
      amount: 45.90,
      categoryId: 'cat-alim',
      cadence: 'monthly',
      nextBillingDate: '2026-10-15',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];

  it('deve gerar o system prompt com todas as contas, categorias e valores agregados', () => {
    const prompt = buildFinancialSystemPrompt(
      mockAccounts,
      mockCategories,
      mockTransactions,
      mockBudgets,
      mockSubscriptions
    );

    expect(prompt).toContain('Sobi');
    expect(prompt).toContain('Sobra AI');
    expect(prompt).toContain('Nubank');
    expect(prompt).toContain('Conta Corrente Inter');
    expect(prompt).toContain('Alimentação');
    expect(prompt).toContain('Supermercado Pão de Açúcar');
    expect(prompt).toContain('Netflix');
    expect(prompt).toContain('Receita no Mês:');
    expect(prompt).toContain('Sobra Projetada Atual:');
  });

  it('deve incluir instruções claras sobre as ferramentas de Function Calling disponíveis', () => {
    const prompt = buildFinancialSystemPrompt([], [], [], [], []);

    expect(prompt).toContain('move_transaction_account');
    expect(prompt).toContain('recategorize_transactions');
    expect(prompt).toContain('set_as_subscription');
    expect(prompt).toContain('adjust_budget');
    expect(prompt).toContain('create_transaction');
  });
});
