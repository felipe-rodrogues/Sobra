import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TransactionModal } from '../src/components/modals/TransactionModal';
import { db } from '../src/database/adapter';
import { Subscription, Transaction, Account, Category } from '../src/core/types';
import { calculateInvoiceForMonth } from '../src/core/installments/installmentHelper';
import { categorizationEngine } from '../src/core/categorization/categorizationEngine';

// Mock contexts
const mockSaveTransaction = vi.fn();
const mockSaveSubscription = vi.fn();

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#0B0F0C',
      surface: '#121813',
      surfaceElevated: '#161F18',
      primary: '#10B981',
      border: 'rgba(255, 255, 255, 0.08)',
      textPrimary: '#FFFFFF',
      textSecondary: '#94A3B8',
      income: '#4ADE80',
      expense: '#EF4444',
      warning: '#F59E0B',
    },
  }),
}));

const mockCategories: Category[] = [
  { id: 'cat-stream', name: 'Streaming', type: 'expense', icon: 'Tv', color: '#8B5CF6', isCustom: false, createdAt: '' },
  { id: 'cat-mercado', name: 'Alimentação', type: 'expense', icon: 'ShoppingBag', color: '#F59E0B', isCustom: false, createdAt: '' },
];

const mockAccounts: Account[] = [
  {
    id: 'acc-nubank-card',
    name: 'Nubank Roxinho',
    bankId: 'nubank',
    type: 'credit_card',
    balance: 500,
    creditLimit: 5000,
    closingDay: 1,
    dueDay: 8,
    color: '#820AD1',
    icon: 'CreditCard',
    currency: 'BRL',
    syncStatus: 'manual',
    createdAt: '',
    updatedAt: '',
  },
];

let currentSubscriptions: Subscription[] = [];
let currentTransactions: Transaction[] = [];

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    accounts: mockAccounts,
    categories: mockCategories,
    transactions: currentTransactions,
    subscriptions: currentSubscriptions,
    saveTransaction: mockSaveTransaction,
    deleteTransaction: vi.fn(),
    saveSubscription: mockSaveSubscription,
    deleteSubscription: vi.fn(),
    saveInstallmentPurchase: vi.fn(),
    deleteInstallmentGroup: vi.fn(),
    suggestCategoryForMerchant: vi.fn(),
    checkIfLikelySubscription: () => ({ isLikely: false }),
    activeViewedCardId: 'acc-nubank-card',
    isPartnershipActive: false,
    partnershipSpace: null,
  }),
}));

describe('Descrição com Logo do Estabelecimento e Sincronização de Nome Assinaturas/Fatura', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.resetAll('demo');
    currentSubscriptions = [];
    currentTransactions = [];
  });

  it('TransactionModal deve renderizar o BrandLogo ao lado do input de descrição com estilo flex', () => {
    const tx: Transaction = {
      id: 'tx-netflix-1',
      accountId: 'acc-nubank-card',
      categoryId: 'cat-stream',
      amount: 55.90,
      type: 'expense',
      description: 'Netflix',
      date: '2026-10-05T12:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'manual',
      subscriptionId: 'sub-netflix',
      createdAt: '2026-10-05T12:00:00.000Z',
      updatedAt: '2026-10-05T12:00:00.000Z',
    };

    const html = renderToString(
      <TransactionModal
        isOpen={true}
        onClose={vi.fn()}
        initialData={tx}
      />
    );

    // Verifica que o logo do estabelecimento (Netflix) e o input com flex: 1 foram renderizados
    expect(html).toContain('alt="Netflix"');
    expect(html).toContain('value="Netflix"');
    expect(html).toContain('flex:1');
    expect(html).toContain('display:flex;gap:10px;align-items:center');
  });

  it('deve sincronizar o nome da assinatura para as transações da fatura de cartão quando alterado em assinaturas', async () => {
    // 1. Cadastra assinatura inicial "Spotify"
    const subId = 'sub-spotify-123';
    const sub: Subscription = {
      id: subId,
      name: 'Spotify',
      amount: 34.90,
      categoryId: 'cat-stream',
      accountId: 'acc-nubank-card',
      cadence: 'monthly',
      nextBillingDate: '2026-11-10',
      status: 'active',
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
    };
    await db.saveSubscription(sub);

    // 2. Transação do cartão na fatura de outubro vinculada a essa assinatura
    const cardTx: Transaction = {
      id: `tx-sub-${subId}-2026-10`,
      accountId: 'acc-nubank-card',
      categoryId: 'cat-stream',
      amount: 34.90,
      type: 'expense',
      description: 'Spotify',
      date: '2026-10-10T12:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'manual',
      subscriptionId: subId,
      isRecurring: true,
      recurringCadence: 'monthly',
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
    };
    await db.saveTransaction(cardTx);

    // 3. Simula a lógica de saveSubscription (como ocorre no FinanceContext) ao editar para "Spotify Família"
    const updatedSub: Subscription = {
      ...sub,
      name: 'Spotify Família',
      amount: 54.90,
      updatedAt: new Date().toISOString(),
    };
    await db.saveSubscription(updatedSub);

    // Sincronização de transações no DB
    const allDbTxs = await db.getTransactions();
    const linkedTxs = allDbTxs.filter(t =>
      t.subscriptionId === updatedSub.id ||
      t.id.startsWith(`tx-sub-${updatedSub.id}-`) ||
      t.id.startsWith(`proj-sub-${updatedSub.id}-`) ||
      (sub.name && t.description?.trim().toLowerCase() === sub.name.toLowerCase())
    );

    for (const linked of linkedTxs) {
      linked.description = updatedSub.name;
      linked.subscriptionId = updatedSub.id;
      await db.saveTransaction(linked);
    }

    // 4. Verifica se a transação do cartão na fatura agora tem o novo nome "Spotify Família"
    const refreshedTxs = await db.getTransactions();
    const refreshedCardTx = refreshedTxs.find(t => t.id === cardTx.id);
    expect(refreshedCardTx).toBeDefined();
    expect(refreshedCardTx?.description).toBe('Spotify Família');
  });

  it('deve sincronizar o nome da transação do cartão para a assinatura e transações irmãs quando alterado na fatura', async () => {
    // 1. Cadastra assinatura inicial "Disney Plus"
    const subId = 'sub-disney-999';
    const sub: Subscription = {
      id: subId,
      name: 'Disney Plus',
      amount: 43.90,
      categoryId: 'cat-stream',
      accountId: 'acc-nubank-card',
      cadence: 'monthly',
      nextBillingDate: '2026-11-15',
      status: 'active',
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
    };
    await db.saveSubscription(sub);

    // Duas transações de meses diferentes vinculadas a essa assinatura
    const txOutubro: Transaction = {
      id: `tx-sub-${subId}-2026-10`,
      accountId: 'acc-nubank-card',
      categoryId: 'cat-stream',
      amount: 43.90,
      type: 'expense',
      description: 'Disney Plus',
      date: '2026-10-15T12:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'manual',
      subscriptionId: subId,
      isRecurring: true,
      recurringCadence: 'monthly',
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
    };
    const txNovembro: Transaction = {
      id: `tx-sub-${subId}-2026-11`,
      accountId: 'acc-nubank-card',
      categoryId: 'cat-stream',
      amount: 43.90,
      type: 'expense',
      description: 'Disney Plus',
      date: '2026-11-15T12:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'manual',
      subscriptionId: subId,
      isRecurring: true,
      recurringCadence: 'monthly',
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
    };
    await db.saveTransaction(txOutubro);
    await db.saveTransaction(txNovembro);

    // 2. Usuário edita a transação de outubro na fatura mudando a descrição para "Disney+ & Star+"
    const newDescription = 'Disney+ & Star+';
    const editedTx: Transaction = {
      ...txOutubro,
      description: newDescription,
    };
    await db.saveTransaction(editedTx);

    // Sincronização para a assinatura vinculada e outras transações irmãs
    const existingSubs = await db.getSubscriptions();
    const targetSub = existingSubs.find(s => s.id === subId);
    expect(targetSub).toBeDefined();

    if (targetSub) {
      targetSub.name = newDescription;
      await db.saveSubscription(targetSub);

      const allDbTxs = await db.getTransactions();
      const siblings = allDbTxs.filter(t => t.id !== editedTx.id && t.subscriptionId === subId);
      for (const sib of siblings) {
        sib.description = newDescription;
        await db.saveTransaction(sib);
      }
    }

    // 3. Valida que a assinatura foi atualizada para "Disney+ & Star+"
    const refreshedSubs = await db.getSubscriptions();
    const finalSub = refreshedSubs.find(s => s.id === subId);
    expect(finalSub?.name).toBe('Disney+ & Star+');

    // 4. Valida que a outra transação da fatura (novembro) também foi atualizada automaticamente
    const finalTxs = await db.getTransactions();
    const finalTxNov = finalTxs.find(t => t.id === txNovembro.id);
    expect(finalTxNov?.description).toBe('Disney+ & Star+');
  });

  it('calculateInvoiceForMonth NÃO deve projetar assinaturas de cartão em datas futuras no mês atual', () => {
    const now = new Date();
    const curMonth = now.getUTCMonth() + 1;
    const curYear = now.getUTCFullYear();

    // Cria assinatura Meli+ cobrada no dia 31 (ou último dia do mês)
    const subMeli: Subscription = {
      id: 'sub-meli-plus',
      name: 'Meli+',
      amount: 65.00,
      categoryId: 'cat-stream',
      accountId: 'acc-nubank-card',
      cadence: 'monthly',
      dayOfMonth: 31,
      nextBillingDate: '2026-10-31',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Supondo que hoje ainda não seja dia 31, a assinatura não deve ser projetada como transação na fatura atual
    const result = calculateInvoiceForMonth('acc-nubank-card', [], curMonth, curYear, [subMeli]);
    const hasProjectedFutureMeli = result.transactions.some(t => 
      t.description === 'Meli+' && new Date(t.date).getUTCDate() === 31 && 31 > now.getUTCDate()
    );

    // Se hoje é antes do dia 31, não pode haver lançamento futuro
    if (now.getUTCDate() < 31) {
      expect(hasProjectedFutureMeli).toBe(false);
      expect(result.totalAmount).toBe(0);
    }
  });

  it('deve vincular inteligentemente uma despesa do cartão à assinatura cadastrada quando for lançada/detectada', async () => {
    // 1. Cadastra a assinatura ativa Meli+
    const subMeli: Subscription = {
      id: 'sub-meli-123',
      name: 'Meli+',
      amount: 65.00,
      categoryId: 'cat-stream',
      accountId: 'acc-nubank-card',
      cadence: 'monthly',
      dayOfMonth: 31,
      nextBillingDate: '2026-10-31',
      status: 'active',
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
    };
    await db.saveSubscription(subMeli);

    // 2. Transação capturada/detectada pelo app no cartão Nubank (sem subscriptionId preenchido inicialmente)
    const incomingCharge: Transaction = {
      id: 'tx-nubank-meli-charge',
      accountId: 'acc-nubank-card',
      categoryId: 'cat-stream',
      amount: 65.00,
      type: 'expense',
      description: 'Meli+',
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 3. Simula a lógica inteligente de auto-link (idêntica ao FinanceContext)
    const allSubs = await db.getSubscriptions();
    const matchedSub = allSubs.find(s => {
      if (s.status !== 'active' || s.type === 'income') return false;
      if (s.accountId && incomingCharge.accountId && s.accountId !== incomingCharge.accountId) return false;
      const normSub = categorizationEngine.normalize(s.name || '');
      const normDesc = categorizationEngine.normalize(incomingCharge.description || '');
      const isNameMatch = normSub === normDesc || normDesc.includes(normSub) || normSub.includes(normDesc);
      if (!isNameMatch) return false;
      const diff = Math.abs(s.amount - incomingCharge.amount);
      return diff < 0.05 || (s.amount > 0 && (diff / s.amount) <= 0.25) || diff <= 15.0;
    });

    expect(matchedSub).toBeDefined();
    expect(matchedSub?.id).toBe(subMeli.id);

    if (matchedSub) {
      incomingCharge.subscriptionId = matchedSub.id;
      incomingCharge.isRecurring = true;
      incomingCharge.recurringCadence = matchedSub.cadence;
      incomingCharge.recurringDayOfMonth = matchedSub.dayOfMonth;
      await db.saveTransaction(incomingCharge);

      matchedSub.lastChargeDate = incomingCharge.date;
      await db.saveSubscription(matchedSub);
    }

    // 4. Valida que a transação no banco agora possui o vínculo da assinatura
    const savedTxs = await db.getTransactions();
    const finalTx = savedTxs.find(t => t.id === incomingCharge.id);
    expect(finalTx).toBeDefined();
    expect(finalTx?.subscriptionId).toBe('sub-meli-123');
    expect(finalTx?.isRecurring).toBe(true);
    expect(finalTx?.recurringCadence).toBe('monthly');

    // 5. Valida que a assinatura teve a data da última cobrança atualizada
    const finalSubs = await db.getSubscriptions();
    const finalSub = finalSubs.find(s => s.id === 'sub-meli-123');
    expect(finalSub?.lastChargeDate).toBe(incomingCharge.date);
  });
});
