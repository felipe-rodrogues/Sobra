import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MicroExpensesRadarCard } from '../src/components/dashboard/MicroExpensesRadarCard';
import { MicroExpensesAnalysis } from '../src/core/microExpenses/microExpensesHelper';

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#0B0C0E',
      surface: '#121316',
      surfaceElevated: '#131915',
      primary: '#22C55E',
      primaryLight: '#4ADE80',
      border: 'rgba(255, 255, 255, 0.08)',
      textPrimary: '#FFFFFF',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
    },
  }),
}));

describe('MicroExpensesRadarCard Component', () => {
  const mockAnalysis: MicroExpensesAnalysis = {
    eligible: true,
    totalCount: 26,
    totalAmount: 390,
    averageAmount: 15,
    projectedAnnualTotal: 4680,
    suggestedSavingsCount: 4,
    suggestedSavingsAmount: 60,
    projectedAnnualSavings: 720,
    thresholdAmount: 30,
    dayOfMonth: 18,
    transactions: [],
    groups: [
      {
        id: 'cafes_bakeries',
        label: 'Padarias & Cafés',
        shortLabel: 'Cafés',
        emoji: '☕',
        count: 14,
        totalAmount: 180,
        transactions: [],
      },
      {
        id: 'delivery_snacks',
        label: 'Lanches & Apps',
        shortLabel: 'Lanches',
        emoji: '🛵',
        count: 8,
        totalAmount: 150,
        transactions: [],
      },
      {
        id: 'convenience_retail',
        label: 'Conveniência & Outros',
        shortLabel: 'Conveniência',
        emoji: '🏪',
        count: 4,
        totalAmount: 60,
        transactions: [],
      },
    ],
  };

  it('deve renderizar os números principais, frase acolhedora e pills', () => {
    const html = renderToString(
      <MicroExpensesRadarCard
        analysis={mockAnalysis}
        onViewTransactions={vi.fn()}
      />
    );

    expect(html).toContain('Radar de Microgastos');
    expect(html).toContain('Automático');
    expect(html).toContain('comprinhas');
    expect(html).toContain('Sem neura com o cafezinho');
    expect(html).toContain('Padarias &amp; Cafés');
    expect(html).toContain('Lanches &amp; Apps');
    expect(html).toContain('Topar Meta');
    expect(html).toContain('compras');
  });
});
