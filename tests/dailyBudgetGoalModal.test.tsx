import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DailyBudgetGoalModal } from '../src/components/modals/DailyBudgetGoalModal';
import { BurnRateProjection } from '../src/core/calculations';

// Mock do FinanceContext para testes
vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    saveGoal: vi.fn(),
  }),
}));

describe('DailyBudgetGoalModal - Definição de Meta Diária Inteligente (Sem Abas, Sem Emojis)', () => {
  const mockProjection: BurnRateProjection = {
    currentDay: 17,
    totalDaysInMonth: 30,
    elapsedDays: 17,
    remainingDays: 13,
    monthProgressPercent: 57,
    currentExpense: 680.5,
    currentIncome: 6500.0,
    dailyBurnRate: 40.03,
    projectedExpense: 1200.89,
    projectedSobra: 5299.11,
    recommendedDailyBudget: 447.65,
    paceStatus: 'surplus',
    paceMessage: 'Excelente! Você está projetando poupar mais de 25% da sua renda este mês.',
  };

  it('não renderiza nada quando isOpen é false', () => {
    const html = renderToString(
      <DailyBudgetGoalModal
        isOpen={false}
        onClose={vi.fn()}
        projection={mockProjection}
        onSaveGoalConfig={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('renderiza título limpo, contexto sem jargões e sugestões inteligentes em 1 tela quando isOpen é true', () => {
    const html = renderToString(
      <DailyBudgetGoalModal
        isOpen={true}
        onClose={vi.fn()}
        projection={mockProjection}
        onSaveGoalConfig={vi.fn()}
        onOpenAiChat={vi.fn()}
      />
    );

    // Título e Subtítulo
    expect(html).toContain('Limite de Gastos');

    // Campo de valor principal
    expect(html).toContain('/sem');

    // Botão inferior grande foi removido no redesign Pierre (salvar agora é no cabeçalho quando editado)
    expect(html).not.toContain('Confirmar limite de gastos');
    expect(html).not.toContain('Salvar alterações');

    // Seletor de economia em porcentagem e baseline padrão de 10%
    expect(html).toContain('Objetivo de economia');
    expect(html).toContain('10%');
    expect(html).toContain('Reserva básica');

    // Card único de sobra estimada
    expect(html).toContain('Sobra estimada no fim do mês');

    // Renda considerada no topo da tela (hero)
    expect(html).toContain('Renda considerada');
  });

  it('não renderiza o botão destrutivo de remover limite no rodapé', () => {
    const html = renderToString(
      <DailyBudgetGoalModal
        isOpen={true}
        onClose={vi.fn()}
        projection={mockProjection}
        currentGoal={{
          mode: 'suggested',
          dailyAmount: 55.0,
          savedAt: new Date().toISOString(),
          month: 9,
          year: 2026,
        }}
        onSaveGoalConfig={vi.fn()}
        onRemoveGoalConfig={vi.fn()}
        onOpenAiChat={vi.fn()}
      />
    );

    expect(html).not.toContain('Remover limite de gastos');
    expect(html).toContain('Pedir recomendações ao Sobi');
  });

  it('reflete cadência diária quando initialCadence é daily e não renderiza botões de toggle', () => {
    const html = renderToString(
      <DailyBudgetGoalModal
        isOpen={true}
        onClose={vi.fn()}
        projection={mockProjection}
        initialCadence="daily"
        onSaveGoalConfig={vi.fn()}
      />
    );

    expect(html).toContain('Limite Diário');
    expect(html).toContain('/dia');
    expect(html).not.toContain('Limite Semanal');
  });

  it('renderiza corretamente valores arbitrários de economia (3% e 9%) sem "Sem reserva" indevido', () => {
    const html3Percent = renderToString(
      <DailyBudgetGoalModal
        isOpen={true}
        onClose={vi.fn()}
        projection={mockProjection}
        currentGoal={{
          mode: 'suggested',
          dailyAmount: 2375.63 / 7,
          savedAt: new Date().toISOString(),
          month: 9,
          year: 2026,
          savingsPercent: 3,
        }}
        onSaveGoalConfig={vi.fn()}
      />
    );

    expect(html3Percent).toContain('Objetivo de economia: <strong style="color:#10B981;font-weight:700">3%</strong>');
    expect(html3Percent).toContain('Guardando <strong style="color:#FFFFFF">3%</strong> da renda');
    // Não deve conter "Sem reserva" quando o percentual é 3%
    expect(html3Percent).not.toContain('Sem reserva');

    const html9Percent = renderToString(
      <DailyBudgetGoalModal
        isOpen={true}
        onClose={vi.fn()}
        projection={mockProjection}
        currentGoal={{
          mode: 'suggested',
          dailyAmount: 2139.38 / 7,
          savedAt: new Date().toISOString(),
          month: 9,
          year: 2026,
          savingsPercent: 9,
        }}
        onSaveGoalConfig={vi.fn()}
      />
    );

    expect(html9Percent).toContain('Objetivo de economia: <strong style="color:#10B981;font-weight:700">9%</strong>');
    expect(html9Percent).toContain('Guardando <strong style="color:#FFFFFF">9%</strong> da renda');
    expect(html9Percent).not.toContain('Sem reserva');
  });

  it('renderiza explicação de equilíbrio quando savingsPercent é 0%', () => {
    const html0Percent = renderToString(
      <DailyBudgetGoalModal
        isOpen={true}
        onClose={vi.fn()}
        projection={mockProjection}
        currentGoal={{
          mode: 'suggested',
          dailyAmount: 2500 / 7,
          savedAt: new Date().toISOString(),
          month: 9,
          year: 2026,
          savingsPercent: 0,
        }}
        onSaveGoalConfig={vi.fn()}
      />
    );

    expect(html0Percent).toContain('Objetivo de economia: <strong style="color:#10B981;font-weight:700">0%</strong>');
    expect(html0Percent).toContain('sem guardar reserva');
  });

  it('não exibe botão de salvar no cabeçalho antes de haver edições', () => {
    const html = renderToString(
      <DailyBudgetGoalModal
        isOpen={true}
        onClose={vi.fn()}
        projection={mockProjection}
        onSaveGoalConfig={vi.fn()}
      />
    );

    expect(html).not.toContain('Salvar alterações');
    expect(html).not.toContain('Confirmar limite de gastos');
  });
});

