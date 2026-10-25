import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { InstallmentsHubScreen } from '../src/screens/InstallmentsHubScreen';
import { getActiveInstallmentGroups } from '../src/core/installments/installmentHelper';
import { Transaction, Account, Category } from '../src/core/types';

const mockAccount: Account = {
  id: 'acc-nubank',
  name: 'Nubank',
  type: 'credit_card',
  balance: 5000,
  color: '#820AD1',
  icon: 'CreditCard',
  currency: 'BRL',
  bankId: 'nubank',
  syncStatus: 'manual',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockCategory: Category = {
  id: 'cat-eletronicos',
  name: 'Eletrônicos',
  type: 'expense',
  icon: 'Smartphone',
  color: '#38BDF8',
  isCustom: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockInstallmentTransactions: Transaction[] = [
  {
    id: 'tx-inst-1-1',
    accountId: 'acc-nubank',
    categoryId: 'cat-eletronicos',
    amount: 1000,
    type: 'expense',
    description: 'iPhone 15 (1/4)',
    date: '2026-08-10T12:00:00.000Z',
    status: 'confirmed',
    paymentMethod: 'credit',
    source: 'manual',
    isInstallment: true,
    installmentGroupId: 'inst-iphone',
    installmentNumber: 1,
    installmentTotal: 4,
    originalTotalAmount: 4000,
    createdAt: '2026-08-10T12:00:00.000Z',
    updatedAt: '2026-08-10T12:00:00.000Z',
  },
  {
    id: 'tx-inst-1-2',
    accountId: 'acc-nubank',
    categoryId: 'cat-eletronicos',
    amount: 1000,
    type: 'expense',
    description: 'iPhone 15 (2/4)',
    date: '2026-09-10T12:00:00.000Z',
    status: 'confirmed',
    paymentMethod: 'credit',
    source: 'manual',
    isInstallment: true,
    installmentGroupId: 'inst-iphone',
    installmentNumber: 2,
    installmentTotal: 4,
    originalTotalAmount: 4000,
    createdAt: '2026-08-10T12:00:00.000Z',
    updatedAt: '2026-08-10T12:00:00.000Z',
  },
  {
    id: 'tx-inst-1-3',
    accountId: 'acc-nubank',
    categoryId: 'cat-eletronicos',
    amount: 1000,
    type: 'expense',
    description: 'iPhone 15 (3/4)',
    date: '2026-11-10T12:00:00.000Z',
    status: 'confirmed',
    paymentMethod: 'credit',
    source: 'manual',
    isInstallment: true,
    installmentGroupId: 'inst-iphone',
    installmentNumber: 3,
    installmentTotal: 4,
    originalTotalAmount: 4000,
    createdAt: '2026-08-10T12:00:00.000Z',
    updatedAt: '2026-08-10T12:00:00.000Z',
  },
  {
    id: 'tx-inst-1-4',
    accountId: 'acc-nubank',
    categoryId: 'cat-eletronicos',
    amount: 1000,
    type: 'expense',
    description: 'iPhone 15 (4/4)',
    date: '2026-12-10T12:00:00.000Z',
    status: 'confirmed',
    paymentMethod: 'credit',
    source: 'manual',
    isInstallment: true,
    installmentGroupId: 'inst-iphone',
    installmentNumber: 4,
    installmentTotal: 4,
    originalTotalAmount: 4000,
    createdAt: '2026-08-10T12:00:00.000Z',
    updatedAt: '2026-08-10T12:00:00.000Z',
  },
];

let mockIsPrivacyMode = false;

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    transactions: mockInstallmentTransactions,
    accounts: [mockAccount],
    categories: [mockCategory],
    isPrivacyMode: mockIsPrivacyMode,
    togglePrivacyMode: vi.fn(),
  }),
}));

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      textPrimary: '#FFFFFF',
      textSecondary: '#9CA3AF',
      surface: '#0A0B0D',
      surfaceElevated: '#121418',
      primary: '#38BDF8',
      border: 'rgba(255, 255, 255, 0.08)',
    },
    mode: 'dark',
  }),
}));

describe('InstallmentsHubScreen - Compras Parceladas Hub', () => {
  it('deve retornar grupos de parcelamentos corretamente', () => {
    const groups = getActiveInstallmentGroups(mockInstallmentTransactions, undefined, false, [mockAccount]);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].installmentTotal).toBe(4);
    expect(groups[0].description).toBe('iPhone 15');
    expect(groups[0].originalTotalAmount).toBe(4000);
  });

  it('deve renderizar o título da tela, o Hero card e os detalhes do parcelamento com filtro de cartões', () => {
    mockIsPrivacyMode = false;
    const html = renderToString(
      <InstallmentsHubScreen
        onBack={vi.fn()}
        onEditTransaction={vi.fn()}
      />
    );

    expect(html).toContain('Compras Parceladas');
    expect(html).toContain('Saldo a Quitar');
    expect(html).toContain('Comprometido');
    expect(html).toContain('Todos');
    expect(html).toContain('Nubank');
    expect(html).toContain('iPhone 15');
    expect(html).toContain('Ordenar:');
    // Não deve conter a contagem redundante ao lado da ordenação
    expect(html).not.toContain('compra ativa');
  });

  it('deve mascarar os valores quando o modo de privacidade estiver ativo', () => {
    mockIsPrivacyMode = true;
    const html = renderToString(
      <InstallmentsHubScreen
        onBack={vi.fn()}
        onEditTransaction={vi.fn()}
      />
    );

    expect(html).toContain('••••••');
  });
});
