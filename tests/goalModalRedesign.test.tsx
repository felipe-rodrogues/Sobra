import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { GoalModal } from '../src/components/modals/GoalModal';
import { Goal } from '../src/core/types';

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    accounts: [
      {
        id: 'acc-1',
        name: 'Conta Principal',
        type: 'checking',
        balance: 1500,
        color: '#10B981',
        icon: 'Wallet',
        bankId: 'nubank',
        currency: 'BRL',
        syncStatus: 'manual',
        createdAt: '2026-01-01',
      },
      {
        id: 'acc-2',
        name: 'Reserva Nu',
        type: 'savings',
        balance: 3200,
        color: '#8B5CF6',
        icon: 'PiggyBank',
        bankId: 'inter',
        currency: 'BRL',
        syncStatus: 'manual',
        createdAt: '2026-01-01',
      },
    ],
    saveGoal: vi.fn(),
    transactions: [],
    isPartnershipActive: false,
    partnershipSpace: null,
  }),
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com', name: 'Felipe' },
  }),
}));

describe('GoalModal Redesign (Pierre Standard)', () => {
  it('renderiza no padrão Pierre limpo sem legendas redundantes e com cápsula Hero de valor alvo', () => {
    const html = renderToString(
      <GoalModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Título direto
    expect(html).toContain('Nova Meta');
    // Remove subtítulos redundantes
    expect(html).not.toContain('Edite o nome, valor alvo, prazo ou cor desta meta');

    // Hero do Valor Alvo
    expect(html).toContain('Valor Alvo da Meta');
    expect(html).toContain('R$');

    // Botão de criação em largura total
    expect(html).toContain('Criar Meta');

    // Seletor Pierre de conta (com saldo disponível)
    expect(html).toContain('Debitar da Conta');
    expect(html).toContain('Conta Principal');
    expect(html).toContain('Saldo disponível:');
  });

  it('renderiza meta existente com valores preenchidos e botão de exclusão discreto', () => {
    const existingGoal: Goal = {
      id: 'goal-playstation',
      name: 'PlayStation 5',
      targetAmount: 4000,
      currentAmount: 1200,
      color: '#38BDF8',
      icon: 'Gamepad2',
      defaultAccountId: 'acc-1',
      isCompleted: false,
      createdAt: '2026-01-01',
    };

    const html = renderToString(
      <GoalModal
        isOpen={true}
        onClose={vi.fn()}
        editingGoal={existingGoal}
        onDelete={vi.fn()}
      />
    );

    expect(html).toContain('Configurações da Meta');
    expect(html).toContain('PlayStation 5');
    expect(html).toContain('Salvar Alterações');
    expect(html).toContain('Excluir meta');
  });

  it('não renderiza nada quando isOpen for false', () => {
    const html = renderToString(
      <GoalModal
        isOpen={false}
        onClose={vi.fn()}
      />
    );

    expect(html).toBe('');
  });
});
