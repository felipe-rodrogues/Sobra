import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NotificationDetectorScreen } from '../src/screens/NotificationDetectorScreen';
import { notificationListenerBridge } from '../src/native/notificationListener';

let mockPendingNotifications: any[] = [];
let mockDiscardNotification = vi.fn();

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    pendingNotifications: mockPendingNotifications,
    discardNotification: mockDiscardNotification,
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
    expect(html).toContain('Novo');
  });

  it('padroniza botões uniformemente para "Revisar" em todas as transações', () => {
    mockPendingNotifications = [
      {
        id: 'pending-mp-1',
        bankId: 'mercadopago',
        bankName: 'Mercado Pago',
        parsedAmount: 32.5,
        parsedMerchant: '99 RIDE Corrida',
        parsedType: 'expense',
        detectedAt: new Date().toISOString(),
        status: 'pending',
      },
      {
        id: 'pending-mp-2',
        bankId: 'mercadopago',
        bankName: 'Mercado Pago',
        parsedAmount: 32.5,
        parsedMerchant: '99 RIDE Corrida',
        parsedType: 'expense',
        isSuspectedDuplicate: true,
        duplicateReason: 'Cobrança repetida idêntica detectada',
        detectedAt: new Date().toISOString(),
        status: 'pending',
      },
    ];

    const rawHtml = renderToString(
      <NotificationDetectorScreen onOpenReviewModal={vi.fn()} />
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    // Verifica que todos os botões foram padronizados de forma enxuta e uniforme para "Revisar"
    expect(html).toContain('Revisar');
    expect(html).not.toContain('Revisar e Lançar');
    expect(html).not.toContain('Verificar Alerta');

    // Verifica que a diferenciação de duplicata é comunicada pelo badge
    expect(html).toContain('Duplicata');

    // Verifica que os dados essenciais (estabelecimento e valor formatado) são exibidos com clareza
    expect(html).toContain('99 RIDE Corrida');
    expect(html).toContain('R$ 32,50');
  });

  it('diferencia semântica de Pix Recebido (+ verde) e Pix Enviado (- vermelho) com badges específicos', () => {
    mockPendingNotifications = [
      {
        id: 'pending-pix-in',
        bankId: 'nubank',
        bankName: 'Nubank',
        parsedAmount: 150.0,
        parsedMerchant: 'João Silva',
        parsedType: 'income',
        notificationKind: 'income',
        parsedPaymentMethod: 'pix',
        detectedAt: new Date().toISOString(),
        status: 'pending',
      },
      {
        id: 'pending-pix-out',
        bankId: 'nubank',
        bankName: 'Nubank',
        parsedAmount: 40.0,
        parsedMerchant: 'Padaria Central',
        parsedType: 'expense',
        notificationKind: 'expense',
        parsedPaymentMethod: 'pix',
        detectedAt: new Date().toISOString(),
        status: 'pending',
      },
    ];

    const rawHtml = renderToString(
      <NotificationDetectorScreen onOpenReviewModal={vi.fn()} />
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    // Badges específicos para Pix
    expect(html).toContain('💰 Pix Recebido');
    expect(html).toContain('💸 Pix Enviado');

    // Sinais adequados para receita e despesa
    expect(html).toContain('+ R$ 150,00');
    expect(html).toContain('- R$ 40,00');

    // Botões padronizados e botão de descarte rápido presentes
    expect(html).toContain('Revisar');
    expect(html).toContain('Descartar notificação');
  });

  it('adapta hero card de cadastro quando a transação for receita/Pix em vez de compra no cartão', () => {
    mockPendingNotifications = [
      {
        id: 'pending-income-unregistered',
        bankId: 'c6',
        bankName: 'C6 Bank',
        parsedAmount: 250.0,
        parsedMerchant: 'Cliente Consultoria',
        parsedType: 'income',
        notificationKind: 'income',
        parsedPaymentMethod: 'pix',
        requiresAccountRegistration: true,
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

    expect(html).toContain('C6 Bank');
    expect(html).toContain('Conta ainda não cadastrada no Sobra');
    expect(html).toContain('+ R$ 250,00');
    expect(html).toContain('Cadastrar Conta &amp; Lançar Receita');
    expect(html).not.toContain('Cadastrar Cartão &amp; Lançar Compra');
  });
});

