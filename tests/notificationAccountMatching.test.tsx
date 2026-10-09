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

  it('DÍGITOS & CONJUNTO → Prioriza o cartão exato pelos 4 dígitos quando houver múltiplos cartões do mesmo banco', () => {
    mockAccounts = [
      {
        id: 'acc-nu-pessoal',
        name: 'Nubank Pessoal',
        type: 'credit_card',
        balance: 200,
        color: '#820AD1',
        icon: 'nubank',
        currency: 'BRL',
        bankId: 'nubank',
        lastDigits: '1111',
        isShared: false,
        syncStatus: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'acc-nu-conjunto',
        name: 'Nubank Casal',
        type: 'credit_card',
        balance: 600,
        color: '#820AD1',
        icon: 'nubank',
        currency: 'BRL',
        bankId: 'nubank',
        lastDigits: '2222',
        isShared: true,
        syncStatus: 'manual',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const notifNubankCasal: PendingNotification = {
      id: 'notif-nu-1',
      rawTitle: 'Nubank',
      rawText: 'Compra de R$ 80,00 aprovada no cartão final 2222',
      bankId: 'nubank',
      bankName: 'Nubank',
      parsedAmount: 80.0,
      parsedMerchant: 'Mercado',
      parsedType: 'expense',
      parsedPaymentMethod: 'credit',
      cardLastDigits: '2222',
      status: 'pending',
      detectedAt: new Date().toISOString(),
      bankPackage: 'com.nu.production',
    };

    const rawHtml = renderToString(
      <NotificationReviewModal
        isOpen={true}
        onClose={() => {}}
        notification={notifNubankCasal}
      />
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    // Deve exibir o selo de conjunto e os dígitos nas opções
    expect(html).toContain('Nubank Casal (•••• 2222) • Conjunto');
    expect(html).toContain('Nubank Pessoal (•••• 1111)');
    // Deve exibir o aviso de múltiplos cartões para conferência
    expect(html).toContain('Você possui mais de um cartão Nubank. Confirme o cartão correto acima.');
  });

  it('PIX RECEBIDO → NUNCA permite cartão de crédito como opção, detecta ausência de conta corrente Nubank e seleciona Conta Principal', () => {
    // Cenário idêntico ao reportado pelo usuário:
    // Usuário tem Conta Principal (checking) e 5 cartões de crédito, incluindo o cartão Nubank 6188
    mockAccounts = [
      {
        id: 'acc-principal',
        name: 'Conta Principal',
        type: 'checking',
        balance: -1307.91,
        color: '#10B981',
        icon: 'landmark',
        currency: 'BRL',
        syncStatus: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'acc-nu-card',
        name: 'Nubank (•••• 6188)',
        type: 'credit_card',
        balance: 1406.45,
        color: '#820AD1',
        icon: 'nubank',
        currency: 'BRL',
        bankId: 'nubank',
        lastDigits: '6188',
        isShared: true,
        syncStatus: 'manual',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'acc-inter-card',
        name: 'Banco Inter',
        type: 'credit_card',
        balance: 1110.12,
        color: '#FF7A00',
        icon: 'inter',
        currency: 'BRL',
        bankId: 'inter',
        lastDigits: '5023',
        syncStatus: 'manual',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const notifPixNubank: PendingNotification = {
      id: 'notif-pix-nu-1',
      rawTitle: 'Nubank',
      rawText: 'Você recebeu uma transferência de R$ 119,91 de Jéssica Furtado Alves.',
      bankId: 'nubank',
      bankName: 'Nubank',
      parsedAmount: 119.91,
      parsedMerchant: 'Jéssica Furtado Alves',
      parsedType: 'income',
      parsedPaymentMethod: 'pix',
      status: 'approved',
      detectedAt: new Date().toISOString(),
      bankPackage: 'com.nu.production',
    };

    const rawHtml = renderToString(
      <NotificationReviewModal
        isOpen={true}
        onClose={() => {}}
        notification={notifPixNubank}
      />
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    // 1. Título do seletor deve ser focado em recebimento ("Conta de Destino" e "Somente contas")
    expect(html).toContain('Conta de Destino');
    expect(html).toContain('Somente contas');

    // 2. Não deve falsamente afirmar que a conta Nubank está vinculada
    expect(html).not.toContain('Conta Nubank vinculada');
    expect(html).toContain('Conta Nubank ausente');

    // 3. Deve orientar o usuário sobre possuir apenas o cartão de crédito e oferecer criar a conta corrente
    expect(html).toContain('Conta Nubank não encontrada');
    expect(html).toContain('Cadastrar conta Nubank agora');

    // 4. A conta selecionada como fallback deve ser a Conta Principal (checking), NUNCA o cartão
    expect(html).toContain('Conta Principal');

    // 5. O seletor de contas para recebimento NÃO pode conter o cartão Nubank ou Inter
    // (os cartões de crédito foram totalmente excluídos das opções de recebimento)
    expect(html).not.toContain('Nubank (•••• 6188)');
    expect(html).not.toContain('Banco Inter');
  });
});
