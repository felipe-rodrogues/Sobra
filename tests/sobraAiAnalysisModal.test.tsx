import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SobraAiAnalysisModal } from '../src/components/modals/SobraAiAnalysisModal';
import { SobraFullDiagnosis } from '../src/core/ai/types';

describe('SobraAiAnalysisModal - Repaginação Pierre / Designer', () => {
  const mockDiagnosis: SobraFullDiagnosis = {
    generatedAt: '2026-09-17T00:00:00.000Z',
    score: {
      overallScore: 92,
      grade: 'A+',
      status: 'excelente',
      headline: 'Excelente Equilíbrio Financeiro',
      summary: 'Suas contas estão sob controle e você mantém uma sobra líquida saudável neste mês.',
      pillars: [
        {
          type: 'savings',
          name: 'Sobra & Poupança',
          weight: 0.35,
          score: 95,
          status: 'excelente',
          headline: 'Poupança de Alto Nível',
          metricLabel: 'Taxa de Poupança',
          metricValue: '35% da renda',
          feedback: 'Excelente retenção de capital.',
        },
        {
          type: 'credit_cards',
          name: 'Uso do Cartão',
          weight: 0.25,
          score: 88,
          status: 'excelente',
          headline: 'Uso Saudável',
          metricLabel: 'Comprometimento',
          metricValue: '18% do limite',
          feedback: 'Faturas dentro da capacidade de pagamento.',
        },
      ],
    },
    strengths: ['Excelente disciplina de sobra líquida no mês corrente.'],
    vulnerabilities: ['Atenção aos pequenos gastos em finais de semana.'],
    pattern: {
      weekendExpenseRatio: 42,
      peakDayName: 'Sábado',
    },
    actionPlan: [
      {
        stepNumber: 1,
        title: 'Definir teto de gastos no fim de semana',
        description: 'Reduzir saídas supérfluas entre sexta e domingo para reter mais capital.',
        estimatedImpact: '+R$ 300/mês',
        action: {
          label: 'Ajustar Planejamento',
          actionType: 'navigate_tab',
          target: 'budgets',
        },
      },
    ],
    insights: [],
  };

  it('não renderiza nada quando isOpen é false', () => {
    const html = renderToString(
      <SobraAiAnalysisModal
        isOpen={false}
        onClose={vi.fn()}
        diagnosis={mockDiagnosis}
        onExecuteAction={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('renderiza score central, pilares limpos e visão executiva quando isOpen é true', () => {
    const html = renderToString(
      <SobraAiAnalysisModal
        isOpen={true}
        onClose={vi.fn()}
        diagnosis={mockDiagnosis}
        onExecuteAction={vi.fn()}
        onOpenChat={vi.fn()}
      />
    );

    // Título e Header
    expect(html).toContain('Saúde Financeira');
    expect(html).toContain('Sobra AI');

    // Score Hero
    expect(html).toContain('92');
    expect(html).toContain('/ 100');
    expect(html).toContain('Grau A+');
    expect(html).toContain('Excelente Equilíbrio Financeiro');
    expect(html).toContain('Suas contas estão sob controle');

    // Pilares
    expect(html).toContain('Pilares de Avaliação');
    expect(html).toContain('Sobra &amp; Poupança');
    expect(html).toContain('35% da renda');
    expect(html).toContain('Uso do Cartão');
    expect(html).toContain('18% do limite');

    // Visão executiva
    expect(html).toContain('Visão do Sobra AI');
    expect(html).toContain('Excelente disciplina de sobra líquida');
    expect(html).toContain('Atenção aos pequenos gastos em finais de semana');
    expect(html).toContain('42%');
    expect(html).toContain('Sábado');

    // Plano de Ação & CTA
    expect(html).toContain('Definir teto de gastos no fim de semana');
    expect(html).toContain('+R$ 300/mês');
    expect(html).toContain('Ajustar Planejamento');
    expect(html).toContain('Conversar com o Sobra AI');
  });
});
