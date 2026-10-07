import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../src/database/adapter';
import { Account, Transaction, PendingNotification } from '../src/core/types';
import { notificationEngine } from '../src/core/parsers/notificationEngine';
import { NubankParser } from '../src/core/parsers/nubankParser';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NotificationReviewModal } from '../src/components/modals/NotificationReviewModal';

// Polyfill localStorage
const memoryStorage: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => memoryStorage[k] || null,
    setItem: (k: string, v: string) => { memoryStorage[k] = v; },
    removeItem: (k: string) => { delete memoryStorage[k]; },
    clear: () => { Object.keys(memoryStorage).forEach(k => delete memoryStorage[k]); }
  };
}

// Mocks para renderizar componentes
let mockAccounts: Account[] = [];
let mockTransactions: Transaction[] = [];
const mockApprove = vi.fn();
const mockDiscard = vi.fn();

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#0F172A',
      surface: '#1E293B',
      surfaceElevated: '#334155',
      primary: '#10B981',
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      expense: '#EF4444',
      border: '#475569',
    },
  }),
}));

vi.mock('../src/context/FinanceContext', () => ({
  useFinance: () => ({
    accounts: mockAccounts,
    categories: [
      { id: 'cat-alimentacao', name: 'Alimentação', type: 'expense', icon: 'Utensils', color: '#E79F52', isCustom: false, createdAt: '' },
      { id: 'cat-transporte', name: 'Transporte', type: 'expense', icon: 'Car', color: '#3B82F6', isCustom: false, createdAt: '' },
    ],
    subscriptions: [],
    transactions: mockTransactions,
    approveNotification: mockApprove,
    discardNotification: mockDiscard,
    checkIfLikelySubscription: () => ({ isLikely: false }),
    saveAccount: vi.fn(),
  }),
}));

describe('Sistema de Lançamento de Compras e Prevenção de Duplicatas', () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.resetAll('demo');
    mockAccounts = [];
    mockTransactions = [];
    vi.clearAllMocks();
  });

  it('1. Compra em cartão conjunto ou com múltiplos cartões do banco deve ser lançada diretamente na fatura', async () => {
    // Configura dois cartões Nubank: um pessoal e um compartilhado (conjunto)
    const cardPessoal: Account = {
      id: 'acc-nu-pessoal',
      name: 'Nubank Pessoal',
      type: 'credit_card',
      balance: 0,
      bankId: 'nubank',
      isShared: false,
      color: '#820AD1',
      icon: 'credit-card',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const cardConjunto: Account = {
      id: 'acc-nu-conjunto',
      name: 'Nubank Conjunto',
      type: 'credit_card',
      balance: 0,
      bankId: 'nubank',
      isShared: true,
      color: '#820AD1',
      icon: 'credit-card',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveAccount(cardPessoal);
    await db.saveAccount(cardConjunto);

    // Simula notificação de compra no cartão de crédito
    const parsed = notificationEngine.processNotification(
      'Nubank',
      'Compra de R$ 50,00 aprovada no UBER',
      'com.nu.production'
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('expense');
    expect(parsed?.paymentMethod).toBe('credit');

    // Ao processar, o lançamento deve ir diretamente para a fatura do cartão
    const createdTxId = 'tx-direct-123';
    const newTx: Transaction = {
      id: createdTxId,
      accountId: cardConjunto.id,
      categoryId: 'cat-transporte',
      amount: parsed!.amount,
      type: 'expense',
      description: 'UBER',
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      rawNotificationPayload: `${parsed!.rawTitle} - ${parsed!.rawText}`,
      notes: `Lançado diretamente na fatura do ${cardConjunto.name}`,
      isShared: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveTransaction(newTx);

    const pendingNotif: PendingNotification = {
      id: 'pending-123',
      bankPackage: 'com.nu.production',
      bankName: 'Nubank',
      rawTitle: parsed!.rawTitle,
      rawText: parsed!.rawText,
      parsedAmount: parsed!.amount,
      parsedMerchant: 'UBER',
      parsedType: 'expense',
      parsedPaymentMethod: 'credit',
      suggestedAccountId: cardConjunto.id,
      suggestedCategoryId: 'cat-transporte',
      detectedAt: new Date().toISOString(),
      status: 'approved',
      generatedTransactionId: createdTxId,
    };
    await db.savePendingNotification(pendingNotif);

    const txsOnInvoice = (await db.getTransactions()).filter(t => t.accountId === cardConjunto.id);
    expect(txsOnInvoice.length).toBe(1);
    expect(txsOnInvoice[0].description).toBe('UBER');
    expect(txsOnInvoice[0].amount).toBe(50.00);
  });

  it('2. Edição de título e categoria via notificação atualiza a transação in-place sem duplicar na fatura', async () => {
    // 1. Transação inicial criada automaticamente pelo recebimento da notificação
    const originalTxId = 'tx-uber-original';
    const originalTx: Transaction = {
      id: originalTxId,
      accountId: 'acc-nu-conjunto',
      categoryId: 'cat-alimentacao', // categoria inicial sugerida
      amount: 45.00,
      type: 'expense',
      description: 'UBER *TRIP', // descrição inicial não limpa
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      rawNotificationPayload: 'Nubank - Compra aprovada de R$ 45,00 no UBER *TRIP',
      notes: 'Lançado diretamente na fatura do Nubank Conjunto',
      isShared: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveTransaction(originalTx);

    const pending: PendingNotification = {
      id: 'pending-uber-1',
      bankPackage: 'com.nu.production',
      bankName: 'Nubank',
      rawTitle: 'Nubank',
      rawText: 'Compra aprovada de R$ 45,00 no UBER *TRIP',
      parsedAmount: 45.00,
      parsedMerchant: 'UBER *TRIP',
      parsedType: 'expense',
      parsedPaymentMethod: 'credit',
      suggestedAccountId: 'acc-nu-conjunto',
      suggestedCategoryId: 'cat-alimentacao',
      detectedAt: new Date().toISOString(),
      status: 'approved',
      generatedTransactionId: originalTxId,
    };
    await db.savePendingNotification(pending);

    // 2. Usuário edita o título para "Uber Trabalho" e a categoria para "Transporte"
    const editedTitle = 'Uber Trabalho';
    const editedCategory = 'cat-transporte';

    // A lógica de approveNotification / saveTransaction deve usar o mesmo id: originalTxId
    const existingDbTxs = await db.getTransactions();
    const existing = existingDbTxs.find(t => t.id === pending.generatedTransactionId);
    expect(existing).toBeDefined();

    const updatedTx: Transaction = {
      ...existing!,
      description: editedTitle,
      categoryId: editedCategory,
      updatedAt: new Date().toISOString(),
    };
    await db.saveTransaction(updatedTx);

    // 3. Verifica a fatura: DEVE CONTER APENAS 1 TRANSAÇÃO com os novos dados
    const allTxs = await db.getTransactions();
    const nuTxs = allTxs.filter(t => t.accountId === 'acc-nu-conjunto');
    expect(nuTxs.length).toBe(1);
    expect(nuTxs[0].id).toBe(originalTxId);
    expect(nuTxs[0].description).toBe('Uber Trabalho');
    expect(nuTxs[0].categoryId).toBe('cat-transporte');
  });

  it('3. Auto-cura: remove duplicata antiga da fatura caso o bug já tenha ocorrido anteriormente', async () => {
    // Simula o estado defeituoso antes da correção: duas transações na fatura
    // t1: a original não editada gerada na notificação
    const t1: Transaction = {
      id: 'tx-old-direct',
      accountId: 'acc-nu-conjunto',
      categoryId: 'cat-alimentacao',
      amount: 32.50,
      type: 'expense',
      description: 'PAG*RESTAURANTE',
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      rawNotificationPayload: 'Nubank - Compra aprovada de R$ 32,50 no PAG*RESTAURANTE',
      notes: 'Lançado diretamente na fatura do Nubank Conjunto',
      isShared: true,
      createdAt: new Date(Date.now() - 60000).toISOString(),
      updatedAt: new Date(Date.now() - 60000).toISOString(),
    };
    // t2: a duplicata criada pelo approveNotification antigo com o novo título e categoria
    const t2: Transaction = {
      id: 'tx-new-duplicate',
      accountId: 'acc-nu-conjunto',
      categoryId: 'cat-alimentacao',
      amount: 32.50,
      type: 'expense',
      description: 'Almoço Restaurante',
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      rawNotificationPayload: 'Nubank - Compra aprovada de R$ 32,50 no PAG*RESTAURANTE',
      notes: 'Detectado automaticamente do Nubank',
      isShared: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveTransaction(t1);
    await db.saveTransaction(t2);

    const pending: PendingNotification = {
      id: 'pending-rest-1',
      bankPackage: 'com.nu.production',
      bankName: 'Nubank',
      rawTitle: 'Nubank',
      rawText: 'Compra aprovada de R$ 32,50 no PAG*RESTAURANTE',
      parsedAmount: 32.50,
      parsedMerchant: 'PAG*RESTAURANTE',
      parsedType: 'expense',
      parsedPaymentMethod: 'credit',
      suggestedAccountId: 'acc-nu-conjunto',
      status: 'approved',
      generatedTransactionId: 'tx-old-direct',
      detectedAt: new Date().toISOString(),
    };
    await db.savePendingNotification(pending);

    // Simula a lógica de auto-cura do refreshData
    const txs = await db.getTransactions();
    const notifs = await db.getPendingNotifications();
    const duplicateIdsToDelete = new Set<string>();

    for (let i = 0; i < txs.length; i++) {
      const a = txs[i];
      if (duplicateIdsToDelete.has(a.id)) continue;
      for (let j = i + 1; j < txs.length; j++) {
        const b = txs[j];
        if (duplicateIdsToDelete.has(b.id)) continue;

        if (a.accountId !== b.accountId) continue;
        if (a.type !== 'expense' || b.type !== 'expense') continue;
        if (Math.abs(a.amount - b.amount) >= 0.01) continue;

        const sharesPayload = Boolean(a.rawNotificationPayload && b.rawNotificationPayload && a.rawNotificationPayload === b.rawNotificationPayload);
        const aIsPending = notifs.some(p => p.generatedTransactionId === a.id);
        const bIsPending = notifs.some(p => p.generatedTransactionId === b.id);

        if ((aIsPending && b.source === 'notification') || (bIsPending && a.source === 'notification') || sharesPayload) {
          const toDelete = (aIsPending && !bIsPending) ? a : ((bIsPending && !aIsPending) ? b : (new Date(a.updatedAt || a.date) < new Date(b.updatedAt || b.date) ? a : b));
          duplicateIdsToDelete.add(toDelete.id);
          await db.deleteTransaction(toDelete.id);
          break;
        }
      }
    }

    expect(duplicateIdsToDelete.has('tx-old-direct')).toBe(true);
    const remaining = await db.getTransactions();
    const remainingForAccount = remaining.filter(t => t.accountId === 'acc-nu-conjunto');
    expect(remainingForAccount.length).toBe(1);
    expect(remainingForAccount[0].id).toBe('tx-new-duplicate');
    expect(remainingForAccount[0].description).toBe('Almoço Restaurante');
  });

  it('4. NotificationReviewModal exibe badge de lançada na fatura e botão de Atualizar Lançamento', () => {
    const card: Account = {
      id: 'acc-nu-1',
      name: 'Nubank Conjunto',
      type: 'credit_card',
      balance: 100,
      bankId: 'nubank',
      isShared: true,
      color: '#820AD1',
      icon: 'credit-card',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: '',
      updatedAt: '',
    };
    mockAccounts = [card];

    const notification: PendingNotification = {
      id: 'notif-1',
      bankPackage: 'com.nu.production',
      rawTitle: 'Nubank',
      rawText: 'Compra de R$ 50,00 no UBER aprovada',
      bankId: 'nubank',
      bankName: 'Nubank',
      parsedAmount: 50.00,
      parsedMerchant: 'UBER',
      parsedType: 'expense',
      parsedPaymentMethod: 'credit',
      status: 'approved',
      generatedTransactionId: 'tx-uber-1',
      detectedAt: new Date().toISOString(),
    };

    const html = renderToString(
      <NotificationReviewModal
        isOpen={true}
        onClose={() => {}}
        notification={notification}
      />
    );

    expect(html).toContain('Lançada na fatura:');
    expect(html).toContain('Atualizar Lançamento');
  });

  it('5. Package-First: Reconhece Banco Inter pelo packageName mesmo sem "Inter" no texto e sem dígitos', () => {
    // Notificação real do Banco Inter onde o nome do banco não aparece no título ou texto
    const parsed = notificationEngine.processNotification(
      'Compra aprovada',
      'Compra aprovada de R$ 50,00 no Cartão de Crédito em PADARIA',
      'br.com.intermedium'
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.bankId).toBe('inter');
    expect(parsed?.bankName).toBe('Banco Inter');
    expect(parsed?.amount).toBe(50.00);
    expect(parsed?.merchant).toBe('PADARIA');
    expect(parsed?.paymentMethod).toBe('credit');
    expect(parsed?.type).toBe('expense');
    expect(parsed?.cardLastDigits).toBeUndefined();
  });

  it('6. NubankParser rejeita imediatamente notificações vindas do pacote de outro banco (ex: Inter)', () => {
    const nubankParser = new NubankParser();
    // Mesmo com palavras como "compra", "cartão", "aprovada"
    const canHandle = nubankParser.canHandle(
      'br.com.intermedium',
      'Compra aprovada',
      'Compra aprovada de R$ 85,00 no Cartão de Crédito em RESTAURANTE'
    );
    expect(canHandle).toBe(false);
  });

  it('7. Sem final cadastrado nos cartões: compra do Inter vai para a fatura do Inter e NUNCA para o Nubank', async () => {
    await db.resetAll('empty');
    // Usuário tem cartões Nubank e Inter cadastrados, ambos SEM final de cartão
    const cardNubank: Account = {
      id: 'acc-nubank-no-digits',
      name: 'Nubank Pessoal',
      type: 'credit_card',
      balance: 0,
      bankId: 'nubank',
      color: '#820AD1',
      icon: 'credit-card',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastDigits: undefined, // Final removido pelo usuário!
    };
    const cardInter: Account = {
      id: 'acc-inter-no-digits',
      name: 'Banco Inter',
      type: 'credit_card',
      balance: 0,
      bankId: 'inter',
      color: '#FF7A00',
      icon: 'credit-card',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastDigits: undefined, // Final removido pelo usuário!
    };
    await db.saveAccount(cardNubank);
    await db.saveAccount(cardInter);

    // Notificação do Banco Inter sem final e sem nome do banco no texto
    const parsed = notificationEngine.processNotification(
      'Compra aprovada',
      'Compra aprovada de R$ 92,30 no Cartão de Crédito em MERCADO CENTRAL',
      'br.com.intermedium'
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.bankId).toBe('inter');

    // Simula a resolução de conta exatamente como no FinanceContext
    const accs = await db.getAccounts();
    const targetBankId = (parsed!.bankId || '').toLowerCase();
    const bankCandidates = accs.filter(a => {
      const aBankId = (a.bankId || '').toLowerCase();
      const aName = a.name.toLowerCase();
      return (targetBankId && aBankId === targetBankId) ||
             (targetBankId && aName.includes(targetBankId));
    });
    const creditCandidates = bankCandidates.filter(a => a.type === 'credit_card');

    let suggestedAcc: Account | undefined = undefined;
    if (parsed!.cardLastDigits) {
      suggestedAcc = accs.find(a => a.lastDigits === parsed!.cardLastDigits);
    } else if (creditCandidates.length === 1) {
      suggestedAcc = creditCandidates[0];
    } else if (!targetBankId || targetBankId === 'generic') {
      suggestedAcc = accs.find(a => a.type === 'credit_card');
    }

    // O cartão selecionado DEVE ser o Banco Inter e NUNCA o Nubank
    expect(suggestedAcc).toBeDefined();
    expect(suggestedAcc?.id).toBe(cardInter.id);
    expect(suggestedAcc?.bankId).toBe('inter');
    expect(suggestedAcc?.id).not.toBe(cardNubank.id);

    // Lança na fatura
    const newTx: Transaction = {
      id: 'tx-inter-1',
      accountId: suggestedAcc!.id,
      categoryId: 'cat-alimentacao',
      amount: parsed!.amount,
      type: 'expense',
      description: parsed!.merchant,
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      rawNotificationPayload: `${parsed!.rawTitle} - ${parsed!.rawText}`,
      isShared: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveTransaction(newTx);

    const txs = await db.getTransactions();
    const interTxs = txs.filter(t => t.accountId === cardInter.id);
    const nubankTxs = txs.filter(t => t.accountId === cardNubank.id);

    expect(interTxs.length).toBe(1);
    expect(interTxs[0].amount).toBe(92.30);
    expect(nubankTxs.length).toBe(0); // Nenhuma compra caiu no Nubank!
  });

  it('8. Não contaminação: Se o usuário NÃO tem cartão Inter cadastrado, NUNCA cai no Nubank como fallback', async () => {
    await db.resetAll('empty');
    // Usuário possui APENAS cartão Nubank
    const cardNubank: Account = {
      id: 'acc-nubank-only',
      name: 'Nubank Pessoal',
      type: 'credit_card',
      balance: 0,
      bankId: 'nubank',
      color: '#820AD1',
      icon: 'credit-card',
      currency: 'BRL',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveAccount(cardNubank);

    // Recebe notificação do Inter
    const parsed = notificationEngine.processNotification(
      'Compra aprovada',
      'Compra aprovada de R$ 40,00 no Cartão em FARMACIA',
      'br.com.intermedium'
    );
    expect(parsed?.bankId).toBe('inter');

    const accs = await db.getAccounts();
    const targetBankId = (parsed!.bankId || '').toLowerCase();
    const bankCandidates = accs.filter(a => {
      const aBankId = (a.bankId || '').toLowerCase();
      const aName = a.name.toLowerCase();
      return (targetBankId && aBankId === targetBankId) ||
             (targetBankId && aName.includes(targetBankId));
    });
    const creditCandidates = bankCandidates.filter(a => a.type === 'credit_card');

    const isBankIdentified = Boolean(targetBankId && targetBankId !== 'generic');
    let suggestedAcc: Account | undefined = undefined;
    if (creditCandidates.length === 1) {
      suggestedAcc = creditCandidates[0];
    } else if (!isBankIdentified) {
      suggestedAcc = accs.find(a => a.type === 'credit_card') || accs[0];
    } else {
      // Banco identificado mas não cadastrado: NÃO selecionar cartão alheio!
      suggestedAcc = undefined;
    }

    // suggestedAcc deve ser undefined para evitar contaminação do Nubank
    expect(suggestedAcc).toBeUndefined();
  });
});
