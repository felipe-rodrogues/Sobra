import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MonthCategoriesModal } from '../src/components/modals/MonthCategoriesModal';
import { Transaction, Account, Category } from '../src/core/types';

describe('MonthCategoriesModal - Detalhamento por Categoria (Estilo Pierre)', () => {
  const mockCategories: Category[] = [
    {
      id: 'cat-alim',
      name: 'Alimentação',
      type: 'expense',
      icon: 'Utensils',
      color: '#E79F52',
      isCustom: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'cat-educ',
      name: 'Educação',
      type: 'expense',
      icon: 'GraduationCap',
      color: '#EC4899',
      isCustom: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      name: 'Inter',
      type: 'checking',
      balance: 1000,
      color: '#FF7A00',
      icon: 'Landmark',
      currency: 'BRL',
      bankId: 'inter',
      syncStatus: 'manual',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      accountId: 'acc-1',
      categoryId: 'cat-educ',
      amount: 132.18,
      type: 'expense',
      description: 'Curso de Inglês',
      date: '2026-09-12T10:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'manual',
      createdAt: '2026-09-12T10:00:00.000Z',
      updatedAt: '2026-09-12T10:00:00.000Z',
    },
    {
      id: 'tx-2',
      accountId: 'acc-1',
      categoryId: 'cat-alim',
      amount: 296.82,
      type: 'expense',
      description: 'Supermercado',
      date: '2026-09-14T15:30:00.000Z',
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      createdAt: '2026-09-14T15:30:00.000Z',
      updatedAt: '2026-09-14T15:30:00.000Z',
    },
  ];

  it('não deve renderizar nada quando isOpen for false', () => {
    const html = renderToString(
      <MonthCategoriesModal
        isOpen={false}
        onClose={() => {}}
        transactions={mockTransactions}
        accounts={mockAccounts}
        categories={mockCategories}
        selectedMonth={9}
        selectedYear={2026}
        onSelectMonth={() => {}}
        isPrivacyMode={false}
        onTogglePrivacy={() => {}}
      />
    );

    expect(html).toBe('');
  });

  it('deve renderizar o modal com categorias agrupadas, percentuais e total de gastos quando isOpen for true', () => {
    const html = renderToString(
      <MonthCategoriesModal
        isOpen={true}
        onClose={() => {}}
        transactions={mockTransactions}
        accounts={mockAccounts}
        categories={mockCategories}
        selectedMonth={9}
        selectedYear={2026}
        onSelectMonth={() => {}}
        isPrivacyMode={false}
        onTogglePrivacy={() => {}}
      />
    );

    // Total: 132.18 + 296.82 = 429.00
    expect(html).toContain('Setembro 2026');
    expect(html).toMatch(/429/);
    expect(html).toContain('gastos esse mês');

    // Categorias agrupadas
    expect(html).toContain('Alimentação');
    expect(html).toContain('Educação');

    // Valores formatados
    expect(html).toMatch(/296,82/);
    expect(html).toMatch(/132,18/);

    // Percentuais calculados
    expect(html).toContain('69%'); // 296.82 / 429 = ~69%
    expect(html).toContain('31%'); // 132.18 / 429 = ~31%
  });

  it('deve mascarar os valores quando o modo de privacidade estiver ativado', () => {
    const html = renderToString(
      <MonthCategoriesModal
        isOpen={true}
        onClose={() => {}}
        transactions={mockTransactions}
        accounts={mockAccounts}
        categories={mockCategories}
        selectedMonth={9}
        selectedYear={2026}
        onSelectMonth={() => {}}
        isPrivacyMode={true}
        onTogglePrivacy={() => {}}
      />
    );

    expect(html).toContain('••••••');
    expect(html).not.toMatch(/R\$\s*429,00/);
  });
});
