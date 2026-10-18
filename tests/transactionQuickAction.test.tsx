import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TransactionQuickActionModal } from '../src/components/modals/TransactionQuickActionModal';
import { Transaction } from '../src/core/types';

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    accounts: [{ id: 'acc-1', name: 'Nubank', bankId: 'nubank' }],
    categories: [{ id: 'cat-1', name: 'Alimentação' }],
    subscriptions: [],
  }),
}));

describe('TransactionQuickActionModal - Pílula Horizontal Flutuante (Dynamic Island / Pierre)', () => {
  const mockTransaction: Transaction = {
    id: 'tx-123',
    description: 'Almoço no Restaurante',
    amount: 54.9,
    date: '2026-10-17T12:30:00Z',
    type: 'expense',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    paymentMethod: 'credit',
    status: 'confirmed',
    source: 'manual',
    createdAt: '2026-10-17T12:30:00Z',
    updatedAt: '2026-10-17T12:30:00Z',
  };

  it('renderiza a cápsula horizontal flutuante com opções de Editar e Excluir', () => {
    const html = renderToString(
      <TransactionQuickActionModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockTransaction}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Botões da cápsula horizontal
    expect(html).toContain('Editar');
    expect(html).toContain('Excluir');
  });

  it('renderiza o card da despesa elevado com dados e badge de parcelamento quando targetRect for fornecido', () => {
    const installmentTx: Transaction = {
      ...mockTransaction,
      description: 'Notebook 2/10',
      installmentNumber: 2,
      installmentTotal: 10,
      isInstallment: true,
    };

    const mockRect = {
      top: 150,
      bottom: 210,
      left: 16,
      right: 360,
      width: 344,
      height: 60,
    } as DOMRect;

    const html = renderToString(
      <TransactionQuickActionModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={installmentTx}
        targetRect={mockRect}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Card destacado elevado
    expect(html).toContain('Notebook');
    expect(html).toContain('54,90');
    expect(html).toContain('Alimentação');
    expect(html).toContain('2/10');

    // Opções táteis na pílula flutuante
    expect(html).toContain('Editar');
    expect(html).toContain('Excluir');
  });

  it('retorna vazio quando isOpen for false', () => {
    const html = renderToString(
      <TransactionQuickActionModal
        isOpen={false}
        onClose={vi.fn()}
        transaction={mockTransaction}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(html).toBe('');
  });

  it('retorna vazio quando transaction for nulo', () => {
    const html = renderToString(
      <TransactionQuickActionModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={null}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(html).toBe('');
  });
});
