import { describe, it, expect, vi } from 'vitest';
import { AiActionExecutor, ActionResolutionContext } from '../src/core/ai/aiActionExecutor';
import { Account, Category, Transaction, Budget, Subscription } from '../src/core/types';

describe('Sobra AI - AI Action Executor (Function Calling)', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-nu',
      name: 'Nubank',
      type: 'credit_card',
      balance: 500,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'acc-inter',
      name: 'Inter',
      type: 'credit_card',
      balance: 200,
      color: '#FF7A00',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '',
      updatedAt: '',
    }
  ];

  const mockCategories: Category[] = [
    { id: 'cat-alim', name: 'Alimentação', type: 'expense', icon: 'Utensils', color: '#F59E0B', isCustom: false, createdAt: '' },
    { id: 'cat-transp', name: 'Transporte', type: 'expense', icon: 'Car', color: '#3B82F6', isCustom: false, createdAt: '' },
    { id: 'cat-outros', name: 'Outras Despesas', type: 'expense', icon: 'MoreHorizontal', color: '#64748B', isCustom: false, createdAt: '' }
  ];

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-posto',
      accountId: 'acc-nu',
      categoryId: 'cat-outros',
      amount: 180.00,
      type: 'expense',
      description: 'Posto Shell Marginal',
      date: '2026-10-10',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'manual',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'tx-ifood-1',
      accountId: 'acc-nu',
      categoryId: 'cat-outros',
      amount: 45.00,
      type: 'expense',
      description: 'iFood Pedido #1234',
      date: '2026-10-11',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'manual',
      createdAt: '',
      updatedAt: '',
    }
  ];

  const mockCtx: ActionResolutionContext = {
    accounts: mockAccounts,
    categories: mockCategories,
    transactions: mockTransactions,
    budgets: [],
    subscriptions: []
  };

  it('deve resolver ação de mover cobrança entre cartões (fuzzy match)', () => {
    const action = AiActionExecutor.resolveProposedAction(
      'move_transaction_account',
      { searchDescription: 'posto shell', targetAccountName: 'Inter' },
      mockCtx
    );

    expect(action).not.toBeNull();
    expect(action?.type).toBe('move_transaction_account');
    expect(action?.status).toBe('pending');
    expect(action?.payload.targetAccountId).toBe('acc-inter');
    expect(action?.payload.transactionIds).toContain('tx-posto');
  });

  it('deve resolver ação de recategorizar despesas em lote', () => {
    const action = AiActionExecutor.resolveProposedAction(
      'recategorize_transactions',
      { searchDescription: 'ifood', targetCategoryName: 'Alimentação' },
      mockCtx
    );

    expect(action).not.toBeNull();
    expect(action?.type).toBe('recategorize_transactions');
    expect(action?.status).toBe('pending');
    expect(action?.payload.targetCategoryId).toBe('cat-alim');
    expect(action?.payload.transactionIds).toContain('tx-ifood-1');
  });

  it('deve resolver ação de definir assinatura fixa mensal', () => {
    const action = AiActionExecutor.resolveProposedAction(
      'set_as_subscription',
      { serviceName: 'Spotify', amount: 21.90, cadence: 'monthly' },
      mockCtx
    );

    expect(action).not.toBeNull();
    expect(action?.type).toBe('set_as_subscription');
    expect(action?.payload.name).toBe('Spotify');
    expect(action?.payload.amount).toBe(21.90);
    expect(action?.payload.cadence).toBe('monthly');
  });

  it('deve executar ação aprovada chamando callbacks do app', async () => {
    const action = AiActionExecutor.resolveProposedAction(
      'move_transaction_account',
      { searchDescription: 'posto shell', targetAccountName: 'Inter' },
      mockCtx
    );

    const saveTransaction = vi.fn().mockResolvedValue({});
    const refreshData = vi.fn().mockResolvedValue({});

    const result = await AiActionExecutor.executeAction(action!, mockCtx, {
      saveTransaction,
      deleteTransaction: vi.fn(),
      saveSubscription: vi.fn(),
      saveBudget: vi.fn(),
      refreshData
    });

    expect(result.success).toBe(true);
    expect(saveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tx-posto',
        accountId: 'acc-inter'
      })
    );
    expect(refreshData).toHaveBeenCalled();
  });
});
