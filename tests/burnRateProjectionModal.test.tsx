import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BurnRateProjectionModal } from '../src/components/modals/BurnRateProjectionModal';
import { BurnRateProjection } from '../src/core/calculations';

describe('BurnRateProjectionModal - Projeção de Sobra & Burn Rate (Estilo Pierre)', () => {
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
      <BurnRateProjectionModal
        isOpen={false}
        onClose={vi.fn()}
        projection={mockProjection}
      />
    );
    expect(html).toBe('');
  });

  it('renderiza sobra estimada, ritmo diário e teto sugerido quando isOpen é true', () => {
    const html = renderToString(
      <BurnRateProjectionModal
        isOpen={true}
        onClose={vi.fn()}
        projection={mockProjection}
        onOpenAiChat={vi.fn()}
      />
    );

    // Header
    expect(html).toContain('Ritmo de Gastos');

    // Sobra Estimada & Status
    expect(html).toContain('Previsão para o fim do mês');
    expect(html).toContain('Superávit saudável');
    expect(html).toContain('5.299,11');
    expect(html).toContain('Você está projetando poupar mais de 25%');

    // Progresso do Mês
    expect(html).toContain('Dia 17 de 30');
    expect(html).toContain('57% do mês');

    // Ritmo vs Teto (Padrão Semanal)
    expect(html).toContain('Gasto médio real');
    expect(html).toContain('280,21');
    expect(html).toContain('/sem');

    expect(html).toContain('Teto semanal');

    // Diagnóstico e Ações
    expect(html).toContain('Diagnóstico do ritmo');
    expect(html).toContain('O que está acontecendo');
    expect(html).toContain('O que fazer agora');
    expect(html).toContain('Semanal');
    expect(html).toContain('Editar');
    expect(html).toContain('recomendações ao Sobra AI');
  });

  it('mascara valores monetários quando isPrivacyMode é true', () => {
    const html = renderToString(
      <BurnRateProjectionModal
        isOpen={true}
        onClose={vi.fn()}
        projection={mockProjection}
        isPrivacyMode={true}
      />
    );

    expect(html).toContain('••••••');
    expect(html).not.toContain('5.299,11');
  });
});
