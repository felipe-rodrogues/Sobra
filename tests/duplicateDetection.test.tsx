import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NotificationReviewModal } from '../src/components/modals/NotificationReviewModal';
import { PendingNotification } from '../src/core/types';

// Mock do ThemeContext
vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#0F172A',
      surface: '#1E293B',
      surfaceElevated: '#334155',
      primary: '#10B981',
      primaryLight: '#34D399',
      border: '#475569',
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      income: '#10B981',
      expense: '#EF4444',
      warning: '#F59E0B',
    },
  }),
}));

const mockApprove = vi.fn();
const mockDiscard = vi.fn();
const mockSaveAccount = vi.fn();

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    accounts: [
      { id: 'acc-1', name: 'Nubank', type: 'credit_card', bankId: 'nubank', balance: 1000, color: '#820AD1', icon: 'CreditCard', currency: 'BRL', createdAt: '', updatedAt: '' }
    ],
    categories: [
      { id: 'cat-1', name: 'Alimentação', type: 'expense', icon: 'Utensils', color: '#E79F52', isCustom: false, createdAt: '' },
    ],
    subscriptions: [],
    approveNotification: mockApprove,
    discardNotification: mockDiscard,
    checkIfLikelySubscription: () => ({ isLikely: false }),
    saveAccount: mockSaveAccount,
  }),
}));

describe('Detecção e Confirmação de Cobranças Duplicadas', () => {
  it('exibe o banner de alerta e opções quando a notificação for marcada como suspeita de duplicidade', () => {
    const duplicateNotif: PendingNotification = {
      id: 'notif-dup-1',
      rawTitle: 'Nubank',
      rawText: 'Compra de R$ 45,00 aprovada em PADARIA ESTRELA',
      bankId: 'nubank',
      bankName: 'Nubank',
      bankPackage: 'com.nu.production',
      parsedAmount: 45.0,
      parsedMerchant: 'PADARIA ESTRELA',
      parsedType: 'expense',
      parsedPaymentMethod: 'credit',
      status: 'pending',
      detectedAt: new Date().toISOString(),
      isSuspectedDuplicate: true,
      duplicateReason: 'Cobrança de R$ 45,00 em "PADARIA ESTRELA" já foi registrada no extrato hoje.',
    };

    const html = renderToString(
      <NotificationReviewModal
        isOpen={true}
        onClose={() => {}}
        notification={duplicateNotif}
      />
    );

    // Deve exibir o aviso chamativo de duplicidade
    expect(html).toContain('Possível Cobrança Duplicada Detectada');
    expect(html).toContain('já foi registrada no extrato hoje');
    expect(html).toContain('É cobrança duplicada (Descartar)');
    expect(html).toContain('compra real separada');
  });

  it('não exibe alerta de duplicidade para notificações normais sem duplicatas detectadas', () => {
    const normalNotif: PendingNotification = {
      id: 'notif-norm-1',
      rawTitle: 'Nubank',
      rawText: 'Compra de R$ 89,90 aprovada em FARMACIA POPULAR',
      bankId: 'nubank',
      bankName: 'Nubank',
      bankPackage: 'com.nu.production',
      parsedAmount: 89.9,
      parsedMerchant: 'FARMACIA POPULAR',
      parsedType: 'expense',
      parsedPaymentMethod: 'credit',
      status: 'pending',
      detectedAt: new Date().toISOString(),
      isSuspectedDuplicate: false,
    };

    const html = renderToString(
      <NotificationReviewModal
        isOpen={true}
        onClose={() => {}}
        notification={normalNotif}
      />
    );

    expect(html).not.toContain('Possível Cobrança Duplicada Detectada');
    expect(html).not.toContain('É cobrança duplicada (Descartar)');
  });
});
