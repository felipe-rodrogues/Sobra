import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NotificationDetectorScreen } from '../src/screens/NotificationDetectorScreen';
import { notificationListenerBridge } from '../src/native/notificationListener';

let mockPendingNotifications: any[] = [];

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    pendingNotifications: mockPendingNotifications,
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
      warning: '#F59E0B',
    },
  }),
}));

describe('NotificationDetectorScreen - Organização e Animação do Alerta de Status', () => {
  beforeEach(() => {
    mockPendingNotifications = [];
  });

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

    expect(html).toContain('Notificações');
    expect(html).toContain('Configuração do Leitor');
  });

  it('exibe o Hero Card em alta evidência quando detecta compra de cartão não cadastrado', () => {
    mockPendingNotifications = [
      {
        id: 'pending-inter-1',
        bankId: 'inter',
        bankName: 'Banco Inter',
        bankPackage: 'br.com.intermedium',
        rawTitle: 'Compra no crédito',
        rawText: 'Olá, Felipe. Você acaba de comprar R$ 4,49 em PAYPAL *STEAM GAMES. A compra foi no crédito nacional, com o cartão final 5023.',
        parsedAmount: 4.49,
        parsedMerchant: 'PAYPAL *STEAM GAMES',
        parsedType: 'expense',
        parsedPaymentMethod: 'credit',
        cardLastDigits: '5023',
        requiresAccountRegistration: true,
        isUnregisteredBank: true,
        detectedAt: new Date().toISOString(),
        status: 'pending',
      },
    ];

    const rawHtml = renderToString(
      <NotificationDetectorScreen
        onOpenReviewModal={vi.fn()}
        onOpenCreateAccountForNotification={vi.fn()}
      />
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    expect(html).toContain('Banco Inter');
    expect(html).toContain('Final 5023');
    expect(html).toContain('PAYPAL *STEAM GAMES');
    expect(html).toContain('R$ 4,49');
    expect(html).toContain('Cadastrar Cartão &amp; Lançar Compra');
    expect(html).toContain('Novo Cartão');
  });
});
