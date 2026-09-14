import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NotificationReviewModal } from '../src/components/modals/NotificationReviewModal';
import { PendingNotification, Account } from '../src/core/types';

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

// Variáveis dinâmicas para o mock do FinanceContext
let mockAccounts: Account[] = [];
const mockApprove = vi.fn();
const mockDiscard = vi.fn();
const mockSaveAccount = vi.fn();

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    accounts: mockAccounts,
    categories: [
      { id: 'cat-alimentacao', name: 'Alimentação', type: 'expense', icon: 'Utensils', color: '#E79F52', isCustom: false, createdAt: '' },
    ],
    subscriptions: [],
    approveNotification: mockApprove,
    discardNotification: mockDiscard,
    checkIfLikelySubscription: () => ({ isLikely: false }),
    saveAccount: mockSaveAccount,
  }),
}));

describe('Notificação de Banco - Detecção e Vinculação de Conta', () => {
  const bradescoNotification: PendingNotification = {
    id: 'notif-bradesco-1',
    rawTitle: 'Bradesco Cartões',
    rawText: 'Compra Aprovada no Supermercado R$ 120,50 14/09 10:30',
    bankId: 'bradesco',
    bankName: 'Banco Bradesco',
    bankPackage: 'com.bradesco.cartoes',
    parsedAmount: 120.50,
    parsedMerchant: 'Supermercado',
    parsedType: 'expense',
    parsedPaymentMethod: 'credit',
    status: 'pending',
    detectedAt: new Date().toISOString(),
  };

  it('SIM → Quando a conta do banco detectado JÁ existe, seleciona ela e NÃO exibe o banner de aviso', () => {
    mockAccounts = [
      {
        id: 'acc-nubank',
        name: 'Nubank',
        type: 'credit_card',
        balance: 500,
        color: '#820AD1',
        icon: 'nubank',
        currency: 'BRL',
        bankId: 'nubank',
        syncStatus: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'acc-bradesco',
        name: 'Bradesco Principal',
        type: 'credit_card',
        balance: 1500,
        color: '#CC092F',
        icon: 'bradesco',
        currency: 'BRL',
        bankId: 'bradesco',
        syncStatus: 'manual',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const rawHtml = renderToString(
      <NotificationReviewModal
        isOpen={true}
        onClose={() => {}}
        notification={bradescoNotification}
      />
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    // O banner de aviso "Conta Bradesco não encontrada" NÃO deve aparecer
    expect(html).not.toContain('Conta Bradesco não encontrada');
    expect(html).not.toContain('Cadastrar conta Bradesco agora');
    
    // Indicador de conta vinculada deve estar presente
    expect(html).toContain('Conta Bradesco vinculada');
  });

  it('NÃO → Quando a conta do banco detectado NÃO existe, exibe o banner de aviso com opções de cadastrar ou ignorar', () => {
    // O usuário possui apenas conta Nubank, mas recebeu notificação do Bradesco
    mockAccounts = [
      {
        id: 'acc-nubank',
        name: 'Nubank',
        type: 'credit_card',
        balance: 500,
        color: '#820AD1',
        icon: 'nubank',
        currency: 'BRL',
        bankId: 'nubank',
        syncStatus: 'manual',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const rawHtml = renderToString(
      <NotificationReviewModal
        isOpen={true}
        onClose={() => {}}
        notification={bradescoNotification}
      />
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    // O banner de aviso deve ser exibido com os textos exatos solicitados
    expect(html).toContain('Conta Bradesco não encontrada');
    expect(html).toContain('Detectamos uma transação do <strong>Bradesco</strong>, mas você ainda não tem essa conta cadastrada.');
    expect(html).toContain('Cadastrar conta Bradesco agora');
    expect(html).toContain('Ignorar');
    
    // O indicador de conta ausente deve ser exibido no select
    expect(html).toContain('Conta Bradesco ausente');
  });
});
