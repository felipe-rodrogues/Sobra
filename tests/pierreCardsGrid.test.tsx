import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PierreCompactCardsGrid } from '../src/components/dashboard/PierreCompactCardsGrid';
import { Subscription, Transaction, Account, Category } from '../src/core/types';

describe('PierreCompactCardsGrid - Cards lado a lado estilo Pierre', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      name: 'Nubank',
      type: 'checking',
      balance: 5000,
      bankId: 'nubank',
      color: '#820AD1',
      icon: 'Wallet',
      currency: 'BRL',
      syncStatus: 'synced',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ];

  const mockCategories: Category[] = [
    {
      id: 'cat-stream',
      name: 'Streaming & Mídia',
      type: 'expense',
      icon: 'Tv',
      color: '#EC4899',
      isCustom: false,
      createdAt: '',
    },
  ];

  const mockSubscriptions: Subscription[] = [
    {
      id: 'sub-1',
      name: 'Netflix',
      amount: 55.90,
      categoryId: 'cat-stream',
      cadence: 'monthly',
      nextBillingDate: '2026-09-25',
      status: 'active',
      type: 'expense',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'sub-2',
      name: 'Spotify',
      amount: 21.90,
      categoryId: 'cat-stream',
      cadence: 'monthly',
      nextBillingDate: '2026-09-28',
      status: 'active',
      type: 'expense',
      createdAt: '',
      updatedAt: '',
    },
  ];

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      description: 'Supermercado',
      amount: 250,
      type: 'expense',
      categoryId: 'cat-stream',
      accountId: 'acc-1',
      date: '2026-09-10T12:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      createdAt: '',
      updatedAt: '',
    },
  ];

  it('deve renderizar os 2 cards compactos: Assinaturas e Ritmo de Gastos', () => {
    const html = renderToString(
      <PierreCompactCardsGrid
        subscriptions={mockSubscriptions}
        transactions={mockTransactions}
        accounts={mockAccounts}
        categories={mockCategories}
        isPrivacyMode={false}
        maskValue={(v) => v}
        onOpenSubscriptions={() => {}}
        onOpenProjection={() => {}}
      />
    );

    // Card 1: Assinaturas
    expect(html).toContain('Assinaturas');
    expect(html).toContain('2 assinaturas');
    expect(html).toMatch(/77,80/); // 55.90 + 21.90

    // Card 2: Ritmo de Gastos
    expect(html).toContain('Ritmo de gastos');
    expect(html).toContain('Teto');
  });

  it('deve exibir mensagem apropriada quando não houver assinaturas cadastradas', () => {
    const html = renderToString(
      <PierreCompactCardsGrid
        subscriptions={[]}
        transactions={mockTransactions}
        accounts={mockAccounts}
        categories={mockCategories}
        isPrivacyMode={false}
        maskValue={(v) => v}
        onOpenSubscriptions={() => {}}
        onOpenProjection={() => {}}
      />
    );

    expect(html).toContain('Assinaturas');
    expect(html).toContain('Nenhuma cadastrada');
    expect(html).toContain('R$ 0,00');
  });
});
