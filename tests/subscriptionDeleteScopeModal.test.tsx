import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SubscriptionDeleteScopeModal } from '../src/components/modals/SubscriptionDeleteScopeModal';
import { calculateInvoiceForMonth } from '../src/core/installments/installmentHelper';
import { Subscription, Transaction, Account } from '../src/core/types';

describe('SubscriptionDeleteScopeModal & Exclusão de Assinatura na Fatura', () => {
  it('renderiza o modal com informações da assinatura e opções claras de escopo', () => {
    const html = renderToString(
      <SubscriptionDeleteScopeModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        subscriptionName="Netflix"
        transactionTitle="Netflix 4K"
        amount={55.9}
        cadence="monthly"
        monthLabel="Outubro de 2026"
      />
    );

    // Título e explicação de assinatura recorrente
    expect(html).toContain('Cobrança de Assinatura');
    expect(html).toContain('Esta cobrança faz parte da assinatura recorrente de');
    expect(html).toContain('Netflix');

    // Micro-card com valor e informações
    expect(html).toContain('55,90');
    expect(html).toContain('Assinatura Mensal • Outubro de 2026');

    // Duas opções disponíveis
    expect(html).toContain('Apenas esta cobrança');
    expect(html).toContain('Remove o lançamento desta fatura');
    expect(html).toContain('Remover a assinatura também');
    expect(html).toContain('Exclui esta cobrança e cancela a assinatura cadastrada');

    // Badges visuais das opções
    expect(html).toContain('Apenas esta fatura');
    expect(html).toContain('Excluir assinatura');

    // Botões
    expect(html).toContain('Cancelar');
    expect(html).toContain('Excluir cobrança');
  });

  it('não renderiza nada quando isOpen for false', () => {
    const html = renderToString(
      <SubscriptionDeleteScopeModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        subscriptionName="Spotify"
        amount={34.9}
      />
    );

    expect(html).toBe('');
  });

  it('calculateInvoiceForMonth não projeta assinatura em mês presente em excludedMonths', () => {
    const mockCard: Account = {
      id: 'card-1',
      name: 'Nubank Ultravioleta',
      type: 'credit_card',
      balance: 0,
      closingDay: 25,
      dueDay: 5,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const mockSub: Subscription = {
      id: 'sub-netflix',
      name: 'Netflix',
      amount: 55.9,
      categoryId: 'cat-streaming',
      accountId: 'card-1',
      cadence: 'monthly',
      nextBillingDate: '2026-10-15',
      dayOfMonth: 15,
      status: 'active',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      excludedMonths: ['2026-10'], // Mês de outubro de 2026 excluído
    };

    const existingTransactions: Transaction[] = [];

    // Fatura de Outubro de 2026 (mês excluído pontualmente)
    const octInvoice = calculateInvoiceForMonth(mockCard.id, existingTransactions, 10, 2026, [mockSub]);
    expect(octInvoice.transactions.length).toBe(0);
    expect(octInvoice.totalAmount).toBe(0);

    // Fatura de Novembro de 2026 (mês seguinte NÃO excluído)
    const novInvoice = calculateInvoiceForMonth(mockCard.id, existingTransactions, 11, 2026, [mockSub]);
    expect(novInvoice.transactions.length).toBe(1);
    expect(novInvoice.transactions[0].description).toBe('Netflix');
    expect(novInvoice.totalAmount).toBe(55.9);
  });

  it('permite múltiplos meses excluídos e mantém outros meses projetados corretamente', () => {
    const mockCard: Account = {
      id: 'card-1',
      name: 'Nubank Ultravioleta',
      type: 'credit_card',
      balance: 0,
      closingDay: 25,
      dueDay: 5,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const mockSub: Subscription = {
      id: 'sub-spotify',
      name: 'Spotify Family',
      amount: 34.9,
      categoryId: 'cat-music',
      accountId: 'card-1',
      cadence: 'monthly',
      nextBillingDate: '2026-08-10',
      dayOfMonth: 10,
      status: 'active',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      excludedMonths: ['2026-08', '2026-09'],
    };

    const existingTransactions: Transaction[] = [];

    // Agosto e Setembro excluídos
    expect(calculateInvoiceForMonth(mockCard.id, existingTransactions, 8, 2026, [mockSub]).transactions.length).toBe(0);
    expect(calculateInvoiceForMonth(mockCard.id, existingTransactions, 9, 2026, [mockSub]).transactions.length).toBe(0);

    // Outubro NÃO excluído
    const oct = calculateInvoiceForMonth(mockCard.id, existingTransactions, 10, 2026, [mockSub]);
    expect(oct.transactions.length).toBe(1);
    expect(oct.transactions[0].description).toBe('Spotify Family');
    expect(oct.transactions[0].amount).toBe(34.9);
  });

  it('extrai corretamente subId e mês de IDs proj-sub e tx-sub', () => {
    const txId1 = 'tx-sub-sub-123-2026-10';
    const match1 = txId1.match(/^(?:tx-sub|proj-sub)-(.+)-(\d{4})-(\d{2})$/);
    expect(match1).not.toBeNull();
    expect(match1![1]).toBe('sub-123');
    expect(match1![2]).toBe('2026');
    expect(match1![3]).toBe('10');

    const txId2 = 'proj-sub-netflix-999-2026-12';
    const match2 = txId2.match(/^(?:tx-sub|proj-sub)-(.+)-(\d{4})-(\d{2})$/);
    expect(match2).not.toBeNull();
    expect(match2![1]).toBe('netflix-999');
    expect(match2![2]).toBe('2026');
    expect(match2![3]).toBe('12');
  });
});
