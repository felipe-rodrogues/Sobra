import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BudgetsScreen } from '../src/screens/BudgetsScreen';
import { Budget, Category, Goal, Transaction } from '../src/core/types';

// Mock do FinanceContext
const mockCategory: Category = {
  id: 'cat-alimentacao',
  name: 'Alimentação',
  type: 'expense',
  icon: 'Utensils',
  color: '#F59E0B',
  isCustom: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockBudget: Budget = {
  id: 'b-1',
  categoryId: 'cat-alimentacao',
  monthlyLimit: 800,
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockGoal: Goal = {
  id: 'g-1',
  name: 'Reserva de Emergência',
  targetAmount: 10000,
  currentAmount: 4500,
  targetDate: '2026-12-31',
  color: '#10B981',
  icon: 'Target',
  isCompleted: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockTransaction: Transaction = {
  id: 'tx-1',
  accountId: 'acc-1',
  categoryId: 'cat-alimentacao',
  amount: 450.5,
  type: 'expense',
  description: 'Supermercado',
  date: new Date().toISOString(),
  status: 'confirmed',
  paymentMethod: 'credit',
  source: 'notification',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    budgets: [mockBudget],
    categories: [mockCategory],
    transactions: [mockTransaction],
    goals: [mockGoal],
    subscriptions: [],
    deleteBudget: vi.fn(),
    deleteGoal: vi.fn(),
    deleteCategory: vi.fn(),
    saveGoal: vi.fn(),
    isPrivacyMode: false,
    togglePrivacyMode: vi.fn(),
  }),
}));

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#0A0E0C',
      surface: '#131915',
      surfaceElevated: '#1A231C',
      border: 'rgba(255, 255, 255, 0.08)',
      primary: '#22C55E',
      textPrimary: '#FFFFFF',
      textSecondary: '#94A3B8',
    },
    mode: 'dark',
  }),
}));

describe('BudgetsScreen - Redesign Pierre', () => {
  it('renderiza o header com o título Planejamento e o segmented control', () => {
    const html = renderToString(
      <BudgetsScreen
        onOpenNewBudget={vi.fn()}
        onOpenNewGoal={vi.fn()}
      />
    );

    expect(html).toContain('Planejamento');
    expect(html).toContain('Orçamentos');
    expect(html).toContain('Metas');
  });

  it('renderiza o Hero Card com valor disponível e categoria orçada no padrão Pierre', () => {
    const html = renderToString(
      <BudgetsScreen
        onOpenNewBudget={vi.fn()}
        onOpenNewGoal={vi.fn()}
      />
    );

    expect(html).toContain('Disponível no Orçamento');
    expect(html).toContain('Alimentação');
    expect(html).toContain('Teto:');
    expect(html).toContain('Gasto:');
    expect(html).toContain('Resta:');
    expect(html).toContain('Novo Orçamento');
  });

  it('renderiza o card unificado Ritmo & Limite de Gastos e atalho de assinaturas', () => {
    const html = renderToString(
      <BudgetsScreen
        onOpenNewBudget={vi.fn()}
        onOpenNewGoal={vi.fn()}
        dailyGoal={{
          mode: 'suggested',
          dailyAmount: 60,
          cadence: 'weekly',
          savedAt: new Date().toISOString(),
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
        }}
      />
    );

    expect(html).toContain('Ritmo &amp; Limite de Gastos');
    expect(html).toContain('/sem');
    expect(html).toContain('Assinaturas');
  });
});
