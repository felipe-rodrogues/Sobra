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
    expect(html).toContain('Definir Meta Diária');
    expect(html).toContain('Restam 13 dias para o fim do mês');

    // Contexto calmo
    expect(html).toContain('Gasto real até hoje');
    expect(html).toContain('40,03');

    // Campo de valor principal
    expect(html).toContain('/dia');

    // Diagnóstico em tempo real da sobra
    expect(html).toContain('sobra estimada no fim do mês');
    expect(html).toContain('Folga de');

    // Referências sugeridas
    expect(html).toContain('Recomendado');
    expect(html).toContain('Poupar 20%');
    expect(html).toContain('Teto máximo');

    // Checkbox e Botão principal
    expect(html).toContain('Acompanhar esta meta na aba Planejamento');
    expect(html).toContain('Salvar meta');
    expect(html).toContain('Pedir recomendações ao Sobra AI');
  });

  it('renderiza botão de remover meta quando já existe currentGoal', () => {
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
      />
    );

    expect(html).toContain('Remover meta');
  });
});
