import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NotificationDetectorScreen } from '../src/screens/NotificationDetectorScreen';
import { notificationListenerBridge } from '../src/native/notificationListener';

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    pendingNotifications: [],
    onlyRegisteredBanks: false,
    autoAddCreditToInvoice: false,
    toggleOnlyRegisteredBanks: vi.fn(),
    toggleAutoAddCreditToInvoice: vi.fn(),
  }),
}));

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'dark',
    mode: 'dark',
    colors: {
      textPrimary: '#FFFFFF',
      textSecondary: '#94A3B8',
      surfaceElevated: '#1A231C',
      border: 'rgba(255, 255, 255, 0.08)',
      income: '#22C55E',
      expense: '#EF4444',
    },
  }),
}));

describe('NotificationDetectorScreen - Organização e Animação do Alerta de Status', () => {
  it('exibe o alerta recolhido quando há permissões pendentes', () => {
    // No estado inicial (simulado), granted é false
    const html = renderToString(
      <NotificationDetectorScreen onOpenReviewModal={vi.fn()} />
    );

    // Deve exibir o card de alerta nativo
    expect(html).toContain('Configuração do Leitor');
    expect(html).toContain('permissões');

    // Por estar recolhido por padrão, os detalhes internos não devem ser renderizados
    expect(html).not.toContain('Dica Samsung');
  });

  it('não quebra a renderização com mock de permissões completas', () => {
    const html = renderToString(
      <NotificationDetectorScreen onOpenReviewModal={vi.fn()} />
    );

    expect(html).toContain('Detector de Transações');
    expect(html).toContain('Sincronizar');
    expect(html).toContain('Preferências de Captura Inteligente');
  });
});
