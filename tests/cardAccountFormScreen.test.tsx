import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CardAccountFormScreen } from '../src/screens/CardAccountFormScreen';
import { AccountsScreen } from '../src/screens/AccountsScreen';
import { Account, Transaction } from '../src/core/types';

const mockTransactions: Transaction[] = [
  {
    id: 'tx-1',
    description: 'Salário',
    amount: 500.0,
    type: 'income',
    date: '2026-10-20',
    accountId: 'acc-principal',
    categoryId: 'cat-income',
    paymentMethod: 'transfer',
    source: 'manual',
    status: 'confirmed',
    createdAt: '2026-10-20',
    updatedAt: '2026-10-20',
  },
  {
    id: 'tx-2',
    description: 'Padaria',
    amount: 2.59,
    type: 'expense',
    date: '2026-10-21',
    accountId: 'acc-principal',
    categoryId: 'cat-food',
    paymentMethod: 'debit',
    source: 'manual',
    status: 'confirmed',
    createdAt: '2026-10-21',
    updatedAt: '2026-10-21',
  },
];

const mockAccountsList: Account[] = [
  {
    id: 'acc-principal',
    name: 'Conta Principal',
    type: 'checking',
    balance: 497.41,
    color: '#10B981',
    icon: 'Landmark',
    currency: 'BRL',
    syncStatus: 'manual',
    bankId: 'nubank',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'acc-inter',
    name: 'Banco Inter',
    type: 'checking',
    balance: 0.0,
    color: '#FF7A00',
    icon: 'Landmark',
    currency: 'BRL',
    syncStatus: 'manual',
    bankId: 'inter',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#090D0B',
      surface: '#111713',
      textPrimary: '#FFFFFF',
      textSecondary: '#8E8E93',
      border: 'rgba(255, 255, 255, 0.08)',
    },
  }),
}));

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    accounts: mockAccountsList,
    saveAccount: vi.fn(),
    deleteAccount: vi.fn(),
    approveNotificationWithNewAccount: vi.fn(),
    importCsvTransactions: vi.fn(),
    transactions: mockTransactions,
    isPartnershipActive: false,
    partnershipSpace: null,
    isPrivacyMode: false,
  }),
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', displayName: 'Felipe' },
    isAuthenticated: true,
    openAuthModal: vi.fn(),
  }),
}));

vi.mock('../src/services/supabase', () => ({
  createOrGetCardInvite: vi.fn(),
  updateCardInvite: vi.fn(),
  registerSharedAccountMember: vi.fn(),
  fetchSharedAccountMembers: vi.fn().mockResolvedValue([]),
  syncAccountTransactionsToCloud: vi.fn(),
  subscribeToSharedCards: vi.fn(() => () => {}),
  broadcastPartnershipEvent: vi.fn(),
  broadcastSharedCardUpdate: vi.fn(),
}));

describe('CardAccountFormScreen - Acesso à Conta Principal e Contas Bancárias', () => {
  it('1. deve renderizar a tela de edição da Conta Principal sem erros', () => {
    const contaPrincipal = mockAccountsList[0];

    const html = renderToString(
      <CardAccountFormScreen
        onBack={vi.fn()}
        accountToEdit={contaPrincipal}
      />
    );

    expect(html).toContain('Conta Principal');
    expect(html).toContain('Editar Conta');
    expect(html).toContain('Saldo Disponível na Conta');
    expect(html).toContain('497,41');
  });

  it('2. deve renderizar o cálculo do saldo e botão de sincronização quando há movimentações', () => {
    const contaPrincipal = mockAccountsList[0];

    const html = renderToString(
      <CardAccountFormScreen
        onBack={vi.fn()}
        accountToEdit={contaPrincipal}
      />
    );

    // Saldo inicial é 0, +500 - 2.59 = 497.41 -> exatamente o saldo atual
    expect(html).toContain('Saldo calculado pelas movimentações:');
  });

  it('3. deve renderizar outras contas bancárias (ex: Banco Inter) com saldo zero', () => {
    const contaInter = mockAccountsList[1];

    const html = renderToString(
      <CardAccountFormScreen
        onBack={vi.fn()}
        accountToEdit={contaInter}
      />
    );

    expect(html).toContain('Banco Inter');
    expect(html).toContain('Editar Conta');
  });

  it('4. deve renderizar a tela de contas (AccountsScreen) e listar Conta Principal e Banco Inter', () => {
    const onEditMock = vi.fn();

    const html = renderToString(
      <AccountsScreen
        onOpenNewAccount={vi.fn()}
        onEditAccount={onEditMock}
      />
    );

    expect(html).toContain('Conta Principal');
    expect(html).toContain('Banco Inter');
    expect(html).toContain('497,41');
    expect(html).toContain('0,00');
  });

  it('5. deve renderizar novo cadastro de conta (sem accountToEdit) sem erros', () => {
    const html = renderToString(
      <CardAccountFormScreen
        onBack={vi.fn()}
        defaultType="checking"
      />
    );

    expect(html).toContain('Nova Conta');
    expect(html).toContain('Cadastrar Conta');
  });
});
