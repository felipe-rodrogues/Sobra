import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SubscriptionLogo } from '../src/components/subscriptions/SubscriptionLogo';
import { SubscriptionDetailView } from '../src/components/subscriptions/SubscriptionDetailView';
import { SubscriptionTransactionPickerModal } from '../src/components/subscriptions/SubscriptionTransactionPickerModal';
import { SubscriptionsScreen } from '../src/screens/SubscriptionsScreen';
import { Subscription, Category, Account, Transaction } from '../src/core/types';

// Mock contexts
const mockCategory: Category = {
  id: 'cat-faculdade',
  name: 'Universidade',
  type: 'expense',
  icon: 'GraduationCap',
  color: '#38BDF8',
  isCustom: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockAccount: Account = {
  id: 'acc-inter',
  name: 'Inter',
  type: 'credit_card',
  balance: 1000,
  color: '#FF7A00',
  icon: 'Landmark',
  currency: 'BRL',
  bankId: 'inter',
  syncStatus: 'manual',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockSubscription: Subscription = {
  id: 'sub-uva',
  name: 'UVA',
  amount: 135.26,
  categoryId: 'cat-faculdade',
  accountId: 'acc-inter',
  cadence: 'monthly',
  nextBillingDate: '2026-09-15',
  lastChargeDate: '2026-08-15',
  status: 'active',
  createdAt: '2026-08-15T12:00:00.000Z',
  updatedAt: '2026-08-15T12:00:00.000Z',
};

const mockTransactions: Transaction[] = [
  {
    id: 'tx-1',
    accountId: 'acc-inter',
    categoryId: 'cat-faculdade',
    amount: 135.26,
    type: 'expense',
    description: 'UVA',
    date: '2026-08-15T10:00:00.000Z',
    status: 'confirmed',
    paymentMethod: 'credit',
    source: 'notification',
    createdAt: '2026-08-15T10:00:00.000Z',
    updatedAt: '2026-08-15T10:00:00.000Z',
  },
  {
    id: 'tx-2',
    accountId: 'acc-inter',
    categoryId: 'cat-faculdade',
    amount: 135.26,
    type: 'expense',
    description: 'UVA',
    date: '2026-07-15T10:00:00.000Z',
    status: 'confirmed',
    paymentMethod: 'credit',
    source: 'notification',
    createdAt: '2026-07-15T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
  },
];

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    subscriptions: [mockSubscription],
    subscriptionSuggestions: [],
    transactions: mockTransactions,
    categories: [mockCategory],
    accounts: [mockAccount],
    isPrivacyMode: false,
    togglePrivacyMode: vi.fn(),
    saveSubscription: vi.fn(),
    deleteSubscription: vi.fn(),
  }),
}));

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      textPrimary: '#FFFFFF',
      textSecondary: '#9CA3AF',
      surface: '#0A0B0D',
      surfaceElevated: '#121418',
      primary: '#A3E635',
      expense: '#EF4444',
      border: 'rgba(255, 255, 255, 0.08)',
    },
  }),
}));

describe('Redesign da Tela de Assinaturas & Recorrências', () => {
  it('SubscriptionLogo renderiza marcas reconhecidas e badge do banco', () => {
    const htmlUva = renderToString(
      <SubscriptionLogo name="UVA" category={mockCategory} bankId="inter" size={44} />
    );
    expect(htmlUva).toBeDefined();

    const htmlClaro = renderToString(
      <SubscriptionLogo name="Claro" category={mockCategory} bankId="inter" size={44} />
    );
    expect(htmlClaro).toContain("Claro");

    const htmlSteam = renderToString(
      <SubscriptionLogo name="Steam" category={mockCategory} bankId="inter" size={44} />
    );
    expect(htmlSteam).toContain('<svg');
  });

  it('SubscriptionDetailView renderiza detalhes, timeline, insight e NUNCA cita Pierre', () => {
    const html = renderToString(
      <SubscriptionDetailView
        subscription={mockSubscription}
        onBack={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    // Nome e valor
    expect(html).toContain('UVA');
    expect(html).toContain('135,26');

    // Frequência
    expect(html).toContain('Assinatura paga todo dia');

    // Transações similares
    expect(html).toContain('Transações similares');
    expect(html).toContain('2 transações');

    // Insight card (garante que contém gasto real, custo anual previsto e NÃO cita Pierre)
    expect(html).toContain('Insight');
    expect(html).toContain('Você já gastou');
    expect(html).toContain('custo previsto para 12 meses');
    expect(html.toLowerCase()).not.toContain('pierre');

    // Metadados
    expect(html).toContain('Categoria');
    expect(html).toContain('Universidade');
    expect(html).toContain('Conta');
    expect(html).toContain('Inter');
  });

  it('SubscriptionTransactionPickerModal renderiza busca e botão Marcar como assinatura', () => {
    const html = renderToString(
      <SubscriptionTransactionPickerModal
        isOpen={true}
        onClose={vi.fn()}
        onOpenManualSubscription={vi.fn()}
      />
    );

    expect(html).toContain('Assinaturas');
    expect(html).toContain('Encontre uma transação recorrente para definir como assinatura');
    expect(html).toContain('Buscar transação');
    expect(html).toContain('Marcar como assinatura');
  });

  it('SubscriptionsScreen renderiza Compromisso Mensal e botão Adicionar assinatura', () => {
    const html = renderToString(
      <SubscriptionsScreen
        onBack={vi.fn()}
        onOpenNewSubscription={vi.fn()}
        onEditSubscription={vi.fn()}
      />
    );

    expect(html).toContain('Compromisso Mensal');
    expect(html).toContain('Adicionar assinatura');
    expect(html).toContain('UVA');
  });

  it('SubscriptionsScreen no modo calendário renderiza grade de 7 colunas, dias da semana e Total mensal', () => {
    const html = renderToString(
      <SubscriptionsScreen
        onBack={vi.fn()}
        onOpenNewSubscription={vi.fn()}
        onEditSubscription={vi.fn()}
        initialViewMode="calendar"
      />
    );

    // Total mensal e controles de frequência
    expect(html).toContain('Total mensal');
    expect(html).toContain('Mensal');
    expect(html).toContain('Diária');

    // Dias da semana fiéis ao print (Seg, Ter, Qua, Qui, Sex, Sáb, Dom)
    expect(html).toContain('Seg');
    expect(html).toContain('Ter');
    expect(html).toContain('Qua');
    expect(html).toContain('Qui');
    expect(html).toContain('Sex');
    expect(html).toContain('Sáb');
    expect(html).toContain('Dom');
  });
});
