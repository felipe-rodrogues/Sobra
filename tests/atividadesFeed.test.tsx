import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { RecentTransactionsSection } from '../src/components/dashboard/RecentTransactionsSection';
import { TransactionsScreen } from '../src/screens/TransactionsScreen';
import { Transaction, Category, Account } from '../src/core/types';

const mockCategories: Category[] = [
  { id: 'cat-1', name: 'Transporte', icon: 'Car', color: '#EF4444', type: 'expense', isCustom: false, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cat-2', name: 'Alimentação', icon: 'Utensils', color: '#F59E0B', type: 'expense', isCustom: false, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cat-3', name: 'Salário', icon: 'Briefcase', color: '#10B981', type: 'income', isCustom: false, createdAt: '2026-01-01T00:00:00.000Z' },
];

const mockAccounts: Account[] = [
  { id: 'acc-1', name: 'Nubank', type: 'checking', balance: 1000, color: '#8A05BE', bankId: 'nubank', currency: 'BRL', syncStatus: 'manual', icon: 'Landmark', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'acc-2', name: 'Inter', type: 'checking', balance: 2000, color: '#FF7A00', bankId: 'inter', currency: 'BRL', syncStatus: 'manual', icon: 'Landmark', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
];

const mockTransactions: Transaction[] = [
  { id: 'tx-1', accountId: 'acc-1', categoryId: 'cat-1', amount: 230, type: 'expense', description: 'Posto Shell', date: '2026-09-10T14:00:00.000Z', status: 'confirmed', paymentMethod: 'credit', source: 'notification', createdAt: '2026-09-10T14:00:00.000Z', updatedAt: '2026-09-10T14:00:00.000Z' },
  { id: 'tx-2', accountId: 'acc-1', categoryId: 'cat-2', amount: 450.5, type: 'expense', description: 'Supermercado Pão de Açúcar', date: '2026-09-08T12:00:00.000Z', status: 'confirmed', paymentMethod: 'credit', source: 'notification', createdAt: '2026-09-08T12:00:00.000Z', updatedAt: '2026-09-08T12:00:00.000Z' },
  { id: 'tx-3', accountId: 'acc-2', categoryId: 'cat-3', amount: 6500, type: 'income', description: 'Salário Mensal', date: '2026-09-05T09:00:00.000Z', status: 'confirmed', paymentMethod: 'pix', source: 'manual', createdAt: '2026-09-05T09:00:00.000Z', updatedAt: '2026-09-05T09:00:00.000Z' },
  { id: 'tx-4', accountId: 'acc-1', categoryId: 'cat-2', amount: 21.9, type: 'expense', description: 'Spotify Premium', date: '2026-08-14T10:00:00.000Z', status: 'confirmed', paymentMethod: 'credit', source: 'notification', createdAt: '2026-08-14T10:00:00.000Z', updatedAt: '2026-08-14T10:00:00.000Z' },
];

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#0B0C0E',
      surface: '#121316',
      surfaceElevated: '#1A1C20',
      primary: '#4ADE80',
      primaryLight: 'rgba(74, 222, 128, 0.15)',
      primaryDark: '#22C55E',
      expense: '#FB7185',
      income: '#4ADE80',
      border: '#27272A',
      textPrimary: '#FFFFFF',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      danger: '#EF4444',
      warning: '#F59E0B',
      success: '#10B981',
      info: '#38BDF8',
    }
  }),
}));

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    transactions: mockTransactions,
    accounts: mockAccounts,
    categories: mockCategories,
    subscriptions: [],
    deleteTransaction: vi.fn(),
    deleteInstallmentGroup: vi.fn(),
    isPrivacyMode: false,
    togglePrivacyMode: vi.fn(),
  }),
}));

describe('RecentTransactionsSection & Atividades Pierre Screen', () => {
  it('RecentTransactionsSection limits displayed items to exactly 3', () => {
    const html = renderToString(
      <RecentTransactionsSection
        transactions={mockTransactions}
        categories={mockCategories}
        maskValue={(v) => v}
        onViewAll={() => {}}
      />
    );

    // Deve conter as 3 primeiras transações
    expect(html).toContain('Posto Shell');
    expect(html).toContain('Supermercado Pão de Açúcar');
    expect(html).toContain('Salário Mensal');

    // A 4ª transação NÃO deve ser renderizada na Home
    expect(html).not.toContain('Spotify Premium');

    // Botão "Ver todas" deve estar visível
    expect(html).toContain('Ver todas');
  });

  it('TransactionsScreen renders with Pierre layout: Atividades title, first Filtros button, back button, and full feed', () => {
    const html = renderToString(
      <TransactionsScreen
        onBack={() => {}}
        onOpenNewTransaction={() => {}}
        onOpenCsvImport={() => {}}
        onEditTransaction={() => {}}
      />
    );

    // 1. Título principal "Atividades"
    expect(html).toContain('Atividades');

    // 2. Botão de Voltar
    expect(html).toContain('title="Voltar"');

    // 3. Campo de busca com placeholder "Buscar"
    expect(html).toContain('placeholder="Buscar"');

    // 4. Botão "Filtros" como primeira opção
    expect(html).toContain('Filtros');

    // 5. Demais filtros
    expect(html).toContain('Entradas');
    expect(html).toContain('Saídas');
    expect(html).toContain('Parceladas');
    expect(html).toContain('Transferências');

    // 6. Todas as 4 transações devem estar presentes no feed
    expect(html).toContain('Posto Shell');
    expect(html).toContain('Supermercado Pão de Açúcar');
    expect(html).toContain('Salário Mensal');
    expect(html).toContain('Spotify Premium');

    // 7. Pill contextual estilo Pierre
    expect(html).toContain('Pagamento');

    // 8. O botão não deve ter a cor amarela/limão do Pierre (#CCFF00) e sim a cor primária do Sobra (#4ADE80)
    expect(html).not.toContain('#CCFF00');
    expect(html).toContain('#4ADE80');
  });
});
