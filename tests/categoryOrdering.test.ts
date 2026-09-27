import { describe, it, expect } from 'vitest';
import { 
  sortCategoriesIntelligently, 
  filterCategoriesBySearch, 
  getCategoryBasePriority,
  isFallbackCategory 
} from '../src/core/categorization/categoryOrdering';
import { Category, Transaction } from '../src/core/types';
import { INITIAL_CATEGORIES } from '../src/database/schema';

describe('categoryOrdering - Ordenação e Pesquisa Inteligente de Categorias', () => {
  const baseCategories: Category[] = INITIAL_CATEGORIES.map(c => ({
    ...c,
    createdAt: new Date().toISOString(),
  }));

  it('deve priorizar categorias essenciais do dia a dia quando não há histórico de transações', () => {
    const expenseCategories = baseCategories.filter(c => c.type === 'expense');
    const sorted = sortCategoriesIntelligently(expenseCategories, []);

    // Categorias mais frequentes do cotidiano devem vir no topo
    const topIds = sorted.slice(0, 5).map(c => c.id);
    expect(topIds).toContain('cat-alim');
    expect(topIds).toContain('cat-mercado');
    expect(topIds).toContain('cat-transp');

    // Outras Despesas deve estar rigorosamente na última posição
    const lastCategory = sorted[sorted.length - 1];
    expect(lastCategory.id).toBe('cat-outros-desp');
  });

  it('deve priorizar dinamicamente categorias mais usadas com base no histórico de transações', () => {
    const expenseCategories = baseCategories.filter(c => c.type === 'expense');

    // Usuário que gasta muito com Lazer e Streaming
    const mockTransactions: Transaction[] = [
      { id: '1', accountId: 'acc', categoryId: 'cat-lazer', amount: 50, type: 'expense', description: 'Cinema', date: '2026-09-01', status: 'confirmed', paymentMethod: 'credit', source: 'manual', createdAt: '', updatedAt: '' },
      { id: '2', accountId: 'acc', categoryId: 'cat-lazer', amount: 40, type: 'expense', description: 'Show', date: '2026-09-02', status: 'confirmed', paymentMethod: 'credit', source: 'manual', createdAt: '', updatedAt: '' },
      { id: '3', accountId: 'acc', categoryId: 'cat-lazer', amount: 30, type: 'expense', description: 'Teatro', date: '2026-09-03', status: 'confirmed', paymentMethod: 'credit', source: 'manual', createdAt: '', updatedAt: '' },
      { id: '4', accountId: 'acc', categoryId: 'cat-streaming', amount: 39, type: 'expense', description: 'Netflix', date: '2026-09-04', status: 'confirmed', paymentMethod: 'credit', source: 'manual', createdAt: '', updatedAt: '' },
      { id: '5', accountId: 'acc', categoryId: 'cat-streaming', amount: 21, type: 'expense', description: 'Spotify', date: '2026-09-05', status: 'confirmed', paymentMethod: 'credit', source: 'manual', createdAt: '', updatedAt: '' },
      { id: '6', accountId: 'acc', categoryId: 'cat-alim', amount: 20, type: 'expense', description: 'Almoço', date: '2026-09-06', status: 'confirmed', paymentMethod: 'credit', source: 'manual', createdAt: '', updatedAt: '' },
    ];

    const sorted = sortCategoriesIntelligently(expenseCategories, mockTransactions);

    // Lazer teve 3 lançamentos -> 1º lugar
    expect(sorted[0].id).toBe('cat-lazer');
    // Streaming teve 2 lançamentos -> 2º lugar
    expect(sorted[1].id).toBe('cat-streaming');
    // Alimentação teve 1 lançamento -> 3º lugar
    expect(sorted[2].id).toBe('cat-alim');
    // Outras Despesas continua no final absoluto
    expect(sorted[sorted.length - 1].id).toBe('cat-outros-desp');
  });

  it('deve manter Outras Despesas e Outras Receitas no rodapé mesmo com lançamentos', () => {
    const expenseCategories = baseCategories.filter(c => c.type === 'expense');

    const mockTransactions: Transaction[] = [
      { id: '1', accountId: 'acc', categoryId: 'cat-outros-desp', amount: 15, type: 'expense', description: 'Desconhecido', date: '2026-09-01', status: 'confirmed', paymentMethod: 'credit', source: 'manual', createdAt: '', updatedAt: '' },
    ];

    const sorted = sortCategoriesIntelligently(expenseCategories, mockTransactions);
    expect(sorted[sorted.length - 1].id).toBe('cat-outros-desp');
  });

  it('deve priorizar Salário & Renda no topo de receitas e Outras Receitas no rodapé', () => {
    const incomeCategories = baseCategories.filter(c => c.type === 'income');
    const sorted = sortCategoriesIntelligently(incomeCategories, []);

    expect(sorted[0].id).toBe('cat-salario');
    expect(sorted[sorted.length - 1].id).toBe('cat-outras-rec');
  });

  it('deve filtrar categorias via pesquisa com suporte a sinônimos práticos', () => {
    const expenseCategories = baseCategories.filter(c => c.type === 'expense');

    // Pesquisa por "uber" deve achar Mobilidade Urbana
    const uberResults = filterCategoriesBySearch(expenseCategories, 'uber');
    expect(uberResults.map(c => c.id)).toContain('cat-mobilidade');

    // Pesquisa por "gasolina" deve achar Transporte & Combustível
    const gasResults = filterCategoriesBySearch(expenseCategories, 'gasolina');
    expect(gasResults.map(c => c.id)).toContain('cat-transp');

    // Pesquisa por "ifood" deve achar Restaurantes & Delivery
    const ifoodResults = filterCategoriesBySearch(expenseCategories, 'ifood');
    expect(ifoodResults.map(c => c.id)).toContain('cat-restaurantes');

    // Pesquisa por "luz" deve achar Contas Residenciais
    const luzResults = filterCategoriesBySearch(expenseCategories, 'luz');
    expect(luzResults.map(c => c.id)).toContain('cat-contas');

    // Pesquisa por "netflix" deve achar Assinaturas & Streaming
    const netflixResults = filterCategoriesBySearch(expenseCategories, 'netflix');
    expect(netflixResults.map(c => c.id)).toContain('cat-streaming');
  });
});
