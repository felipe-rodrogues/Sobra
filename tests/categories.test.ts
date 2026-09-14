import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/database/adapter';
import { Category, Transaction, Budget } from '../src/core/types';

describe('Gestão de Categorias Customizadas e Integridade de Dados', () => {
  let customExpenseCat: Category;
  let customIncomeCat: Category;

  beforeEach(async () => {
    // Cria uma categoria de despesa personalizada
    customExpenseCat = await db.saveCategory({
      id: `cat-pet-${Date.now()}`,
      name: 'Pets & Veterinário',
      type: 'expense',
      icon: 'Dog',
      color: '#F97316',
      isCustom: true,
      createdAt: new Date().toISOString(),
    });

    // Cria uma categoria de receita personalizada
    customIncomeCat = await db.saveCategory({
      id: `cat-dividendos-${Date.now()}`,
      name: 'Dividendos & FIIs',
      type: 'income',
      icon: 'TrendingUp',
      color: '#10B981',
      isCustom: true,
      createdAt: new Date().toISOString(),
    });
  });

  it('permite criar e salvar novas categorias personalizadas', async () => {
    const categories = await db.getCategories();
    const foundExp = categories.find(c => c.id === customExpenseCat.id);
    const foundInc = categories.find(c => c.id === customIncomeCat.id);

    expect(foundExp).toBeDefined();
    expect(foundExp?.name).toBe('Pets & Veterinário');
    expect(foundExp?.icon).toBe('Dog');
    expect(foundExp?.isCustom).toBe(true);

    expect(foundInc).toBeDefined();
    expect(foundInc?.name).toBe('Dividendos & FIIs');
    expect(foundInc?.type).toBe('income');
    expect(foundInc?.isCustom).toBe(true);
  });

  it('permite editar propriedades de uma categoria existente mantendo seu ID', async () => {
    const updated = await db.saveCategory({
      ...customExpenseCat,
      name: 'Cuidados com Pets & Banho',
      color: '#EC4899',
      icon: 'Heart',
    });

    expect(updated.name).toBe('Cuidados com Pets & Banho');
    expect(updated.color).toBe('#EC4899');
    expect(updated.icon).toBe('Heart');

    const categories = await db.getCategories();
    const found = categories.find(c => c.id === customExpenseCat.id);
    expect(found?.name).toBe('Cuidados com Pets & Banho');
    expect(found?.color).toBe('#EC4899');
  });

  it('impede a exclusão de categorias padrão do sistema', async () => {
    await expect(db.deleteCategory('cat-alim')).rejects.toThrow(
      'Não é possível excluir categorias padrão do sistema.'
    );

    const categories = await db.getCategories();
    expect(categories.some(c => c.id === 'cat-alim')).toBe(true);
  });

  it('exclui categoria personalizada e reatribui transações de despesa para Outras Despesas com segurança', async () => {
    // Cria uma transação vinculada à categoria personalizada
    const tx: Transaction = {
      id: `tx-pet-test-${Date.now()}`,
      accountId: 'acc-nubank',
      categoryId: customExpenseCat.id,
      amount: 150.00,
      type: 'expense',
      description: 'Ração e Petiscos',
      date: new Date().toISOString().substring(0, 10),
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveTransaction(tx);

    // Cria também um orçamento vinculado à categoria personalizada
    const budget: Budget = {
      id: `b-pet-${Date.now()}`,
      categoryId: customExpenseCat.id,
      monthlyLimit: 300.00,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      createdAt: new Date().toISOString(),
    };

    await db.saveBudget(budget);

    // Executa a exclusão da categoria personalizada
    await db.deleteCategory(customExpenseCat.id);

    // 1. Categoria deve ter sido removida da lista
    const categoriesAfter = await db.getCategories();
    expect(categoriesAfter.some(c => c.id === customExpenseCat.id)).toBe(false);

    // 2. Transação deve ter sido preservada, mas reatribuída para a categoria fallback de despesa
    const transactions = await db.getTransactions();
    const updatedTx = transactions.find(t => t.id === tx.id);
    expect(updatedTx).toBeDefined();
    expect(updatedTx?.categoryId).toBe('cat-outros-desp');

    // 3. Orçamento vinculado deve ter sido removido para evitar inconsistência
    const budgets = await db.getBudgets();
    expect(budgets.some(b => b.categoryId === customExpenseCat.id)).toBe(false);
  });

  it('exclui categoria personalizada e reatribui transações de receita para Outras Receitas com segurança', async () => {
    // Cria transação de receita vinculada à categoria customizada
    const txIncome: Transaction = {
      id: `tx-div-test-${Date.now()}`,
      accountId: 'acc-nubank',
      categoryId: customIncomeCat.id,
      amount: 320.50,
      type: 'income',
      description: 'Proventos FII MXRF11',
      date: new Date().toISOString().substring(0, 10),
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveTransaction(txIncome);

    // Exclui a categoria de receita
    await db.deleteCategory(customIncomeCat.id);

    // Transação deve ter sido preservada e migrada para Outras Receitas
    const transactions = await db.getTransactions();
    const updatedTx = transactions.find(t => t.id === txIncome.id);
    expect(updatedTx).toBeDefined();
    expect(updatedTx?.categoryId).toBe('cat-outras-rec');
  });
});
