import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CardInvoiceModal } from '../src/components/modals/CardInvoiceModal';
import { Account } from '../src/core/types';

const mockSharedCard: Account = {
  id: 'card-shared-1',
  name: 'Nubank Conjunto',
  type: 'credit_card',
  bankId: 'nubank',
  balance: 2161.81,
  invoiceAmount: 2161.81,
  creditLimit: 4000,
  color: '#820AD1',
  currency: 'BRL',
  icon: 'CreditCard',
  lastDigits: '6188',
  closingDay: 1,
  dueDay: 8,
  isShared: true,
  splitMode: 'half',
  splitRatio: 0.5,
  syncStatus: 'manual',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockIndividualCard: Account = {
  id: 'card-ind-1',
  name: 'Inter Individual',
  type: 'credit_card',
  bankId: 'inter',
  balance: 1000.00,
  invoiceAmount: 1000.00,
  creditLimit: 5000,
  color: '#FF7A00',
  currency: 'BRL',
  icon: 'CreditCard',
  lastDigits: '1234',
  closingDay: 5,
  dueDay: 15,
  isShared: false,
  syncStatus: 'manual',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    accounts: [mockSharedCard, mockIndividualCard],
    transactions: [],
    categories: [],
    subscriptions: [],
    isPrivacyMode: false,
    togglePrivacyMode: () => {},
    setActiveViewedCardId: () => {},
    saveAccount: async () => {},
    deleteTransaction: async () => {},
  }),
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Felipe' },
  }),
}));

describe('CardInvoiceModal - Hierarquia da Cota do Usuário e Limite Consumido', () => {
  it('deve priorizar a cota do usuário no total de faturas e exibir total somado como apoio', () => {
    const html = renderToString(
      <CardInvoiceModal
        isOpen={true}
        onClose={() => {}}
        card={null}
        initialMonthOffset={0}
      />
    );

    expect(html).toContain('Total em faturas');
    // Total somado dos cartões como apoio: 2.161,81 + 1.000,00 = 3.161,81
    expect(html).toContain('Total somado dos cartões:');
    expect(html).toContain('3.161,81');

    // No card do Nubank, o destaque deve ser a cota do usuário (1.080,91)
    expect(html).toContain('1.080,91');
    expect(html).toContain('Sua cota');
    expect(html).toContain('Fatura total:');
    expect(html).toContain('2.161,81');

    // A barra de limite deve usar Consumido e Disponível
    expect(html).toContain('Consumido');
    expect(html).toContain('Disponível');
  });
});
