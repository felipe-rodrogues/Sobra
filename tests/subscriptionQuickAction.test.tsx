import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SubscriptionQuickActionModal } from '../src/components/modals/SubscriptionQuickActionModal';
import { Subscription, Account, Category } from '../src/core/types';

describe('SubscriptionQuickActionModal - Pílula Horizontal Flutuante para Assinaturas (Pierre Minimalista)', () => {
  const mockSubscription: Subscription = {
    id: 'sub-meli',
    name: 'Meli+',
    amount: 65.0,
    cadence: 'monthly',
    dayOfMonth: 4,
    nextBillingDate: '2026-10-04',
    status: 'active',
    categoryId: 'cat-lazer',
    accountId: 'acc-nu',
    isShared: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const mockAccount: Account = {
    id: 'acc-nu',
    name: 'Nubank',
    type: 'credit_card',
    balance: 0,
    color: '#820AD1',
    icon: 'CreditCard',
    currency: 'BRL',
    bankId: 'nubank',
    isShared: true,
    syncStatus: 'manual',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const mockCategory: Category = {
    id: 'cat-lazer',
    name: 'Streaming & Serviços',
    type: 'expense',
    icon: 'Tv',
    color: '#A855F7',
    isCustom: false,
    createdAt: '2026-01-01T00:00:00Z',
  };

  it('renderiza a cápsula horizontal flutuante com opções táteis de Editar e Excluir', () => {
    const html = renderToString(
      <SubscriptionQuickActionModal
        isOpen={true}
        onClose={vi.fn()}
        subscription={mockSubscription}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Botões táteis na cápsula
    expect(html).toContain('Editar');
    expect(html).toContain('Excluir');
  });

  it('renderiza o card elevado no local exato com nome, subtítulo, badge e valor', () => {
    const mockRect = {
      top: 140,
      bottom: 200,
      left: 16,
      right: 360,
      width: 344,
      height: 60,
    } as DOMRect;

    const html = renderToString(
      <SubscriptionQuickActionModal
        isOpen={true}
        onClose={vi.fn()}
        subscription={mockSubscription}
        targetRect={mockRect}
        account={mockAccount}
        category={mockCategory}
        statusSubtitle="Dia 4 • No cartão"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Card destacado elevado
    expect(html).toContain('Meli+');
    expect(html).toContain('65,00');
    expect(html).toContain('Dia 4 • No cartão');

    // Botões da cápsula horizontal
    expect(html).toContain('Editar');
    expect(html).toContain('Excluir');
  });

  it('retorna vazio quando isOpen for false ou subscription for null', () => {
    const htmlClosed = renderToString(
      <SubscriptionQuickActionModal
        isOpen={false}
        onClose={vi.fn()}
        subscription={mockSubscription}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(htmlClosed).toBe('');

    const htmlNull = renderToString(
      <SubscriptionQuickActionModal
        isOpen={true}
        onClose={vi.fn()}
        subscription={null}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(htmlNull).toBe('');
  });

  it('aplica máscara de privacidade quando maskValue for fornecido', () => {
    const mockRect = {
      top: 140,
      bottom: 200,
      left: 16,
      right: 360,
      width: 344,
      height: 60,
    } as DOMRect;

    const html = renderToString(
      <SubscriptionQuickActionModal
        isOpen={true}
        onClose={vi.fn()}
        subscription={mockSubscription}
        targetRect={mockRect}
        maskValue={() => '••••••'}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(html).toContain('••••••');
    expect(html).not.toContain('65,00');
  });
});
