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

    // Categorias mais frequentes do cotidiano devem vir no topo (Mercado, Restaurantes, Transporte)
    const topIds = sorted.slice(0, 5).map(c => c.id);
    expect(topIds).toContain('cat-mercado');
    expect(topIds).toContain('cat-restaurantes');
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
      { id: '6', accountId: 'acc', categoryId: 'cat-restaurantes', amount: 20, type: 'expense', description: 'Almoço', date: '2026-09-06', status: 'confirmed', paymentMethod: 'credit', source: 'manual', createdAt: '', updatedAt: '' },
    ];

    const sorted = sortCategoriesIntelligently(expenseCategories, mockTransactions);

    // Lazer teve 3 lançamentos -> 1º lugar
    expect(sorted[0].id).toBe('cat-lazer');
    // Streaming teve 2 lançamentos -> 2º lugar
    expect(sorted[1].id).toBe('cat-streaming');
    // Restaurantes teve 1 lançamento -> 3º lugar
    expect(sorted[2].id).toBe('cat-restaurantes');
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

    // Pesquisa por "uber" deve achar Transporte & Mobilidade
    const uberResults = filterCategoriesBySearch(expenseCategories, 'uber');
    expect(uberResults.map(c => c.id)).toContain('cat-transp');

    // Pesquisa por "gasolina" deve achar Transporte & Mobilidade
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

    // Pesquisa por "animais" ou "animal" ou "gato" deve achar Pets
    const animalResults = filterCategoriesBySearch(expenseCategories, 'animais');
    expect(animalResults.map(c => c.id)).toContain('cat-pets');

    const catResults = filterCategoriesBySearch(expenseCategories, 'gato');
    expect(catResults.map(c => c.id)).toContain('cat-pets');

    // Pesquisa por "games" ou "ps5" deve achar Lazer
    const gamesResults = filterCategoriesBySearch(expenseCategories, 'games');
    expect(gamesResults.map(c => c.id)).toContain('cat-lazer');

    const ps5Results = filterCategoriesBySearch(expenseCategories, 'ps5');
    expect(ps5Results.map(c => c.id)).toContain('cat-lazer');

    // Pesquisa por "reforma" ou "leroy merlin" deve achar Moradia
    const reformaResults = filterCategoriesBySearch(expenseCategories, 'reforma');
    expect(reformaResults.map(c => c.id)).toContain('cat-moradia');
  });

  it('deve tolerar pequenos erros de digitação (typos) na busca de categorias', () => {
    const expenseCategories = baseCategories.filter(c => c.type === 'expense');

    // "trasporte" (sem n) -> Transporte & Mobilidade
    const typoTransp = filterCategoriesBySearch(expenseCategories, 'trasporte');
    expect(typoTransp.map(c => c.id)).toContain('cat-transp');

    // "supermecado" (com e no meio) -> Supermercado & Feira
    const typoMercado = filterCategoriesBySearch(expenseCategories, 'supermecado');
    expect(typoMercado.map(c => c.id)).toContain('cat-mercado');

    // "restorante" (com o) -> Restaurantes & Delivery
    const typoRest = filterCategoriesBySearch(expenseCategories, 'restorante');
    expect(typoRest.map(c => c.id)).toContain('cat-restaurantes');
  });
});
