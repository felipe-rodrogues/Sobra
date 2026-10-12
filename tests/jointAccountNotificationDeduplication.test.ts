import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../src/database/adapter';
import { Account, Transaction } from '../src/core/types';
import { notificationEngine } from '../src/core/parsers/notificationEngine';
import { generateInstallmentTransactions } from '../src/core/installments/installmentHelper';
import { categorizationEngine } from '../src/core/categorization/categorizationEngine';

// Polyfill localStorage para ambiente de teste Node/Vitest
const memoryStorage: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => memoryStorage[k] || null,
    setItem: (k: string, v: string) => { memoryStorage[k] = v; },
    removeItem: (k: string) => { delete memoryStorage[k]; },
    clear: () => { Object.keys(memoryStorage).forEach(k => delete memoryStorage[k]); }
  };
}

describe('Deduplicação de Compras em Cartão Conjunto / Conta Compartilhada em Múltiplos Celulares', () => {
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

  beforeEach(async () => {
    localStorage.clear();
    await db.resetAll('empty');
    await db.saveAccount(cardConjunto);
  });

  it('1. Deve gerar ID determinístico para compra à vista na conta conjunta evitando duplicatas concorrentes', () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const merchant = 'Supermercado Pão de Açúcar';
    const amount = 145.80;

    const normSlug = categorizationEngine.normalize(merchant)
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    const amountCents = Math.round(amount * 100);

    // Celular 1 e Celular 2 recebem a mesma notificação ao mesmo tempo
    const idCelular1 = `tx-shared-notif-${cardConjunto.id}-${todayStr}-${normSlug}-${amountCents}`;
    const idCelular2 = `tx-shared-notif-${cardConjunto.id}-${todayStr}-${normSlug}-${amountCents}`;

    expect(idCelular1).toBe(idCelular2);
    expect(idCelular1).toContain(cardConjunto.id);
    expect(idCelular1).toContain('14580');
  });

  it('2. Deve gerar IDs determinísticos para parcelas de compra parcelada no cartão conjunto', () => {
    const totalAmount = 600.0;
    const count = 3;
    const description = 'Loja de Móveis';

    const txsPhone1 = generateInstallmentTransactions({
      accountId: cardConjunto.id,
      categoryId: 'cat-casa',
      description,
      totalAmount,
      installmentCount: count,
      card: cardConjunto,
      startDate: '2026-10-12T10:00:00.000Z',
    });

    const txsPhone2 = generateInstallmentTransactions({
      accountId: cardConjunto.id,
      categoryId: 'cat-casa',
      description,
      totalAmount,
      installmentCount: count,
      card: cardConjunto,
      startDate: '2026-10-12T10:00:00.000Z',
    });

    expect(txsPhone1.length).toBe(3);
    expect(txsPhone2.length).toBe(3);

    // Ambos os aparelhos geram exatamente os mesmos IDs de transação e grupo para cada parcela
    expect(txsPhone1[0].id).toBe(txsPhone2[0].id);
    expect(txsPhone1[1].id).toBe(txsPhone2[1].id);
    expect(txsPhone1[2].id).toBe(txsPhone2[2].id);
    expect(txsPhone1[0].installmentGroupId).toBe(txsPhone2[0].installmentGroupId);
  });

  it('3. Quando o Celular 1 já registrou a compra, a notificação no Celular 2 (mesmo horas depois) deve ser reconhecida como duplicata e ignorada', async () => {
    // 1. Celular 1 processa a notificação e salva a transação no cartão conjunto
    const tx1: Transaction = {
      id: 'tx-celular-1',
      accountId: cardConjunto.id,
      categoryId: 'cat-alimentacao',
      amount: 85.50,
      type: 'expense',
      description: 'Padaria Central',
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      isShared: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveTransaction(tx1);

    // 2. Horas depois, o Celular 2 recebe a mesma notificação: mesmo nome e mesmo valor
    const parsedPhone2 = notificationEngine.processNotification(
      'Nubank',
      'Compra de R$ 85,50 aprovada na Padaria Central',
      'com.nu.production'
    );
    expect(parsedPhone2).not.toBeNull();
    expect(parsedPhone2?.amount).toBe(85.50);

    // Valida a detecção de duplicata em conta conjunta
    const localTxs = await db.getTransactions();
    const normParsedMerchant = categorizationEngine.normalize(parsedPhone2!.merchant);

    const isDuplicate = localTxs.some(t => {
      const isCardMatch = t.accountId === cardConjunto.id || t.isShared;
      const isAmountMatch = Math.abs(t.amount - parsedPhone2!.amount) < 0.01;
      const tNorm = categorizationEngine.normalize(t.description || '');
      const isNameMatch = tNorm === normParsedMerchant || tNorm.includes(normParsedMerchant) || normParsedMerchant.includes(tNorm);
      const isRecent = Math.abs(Date.now() - new Date(t.date || t.createdAt || 0).getTime()) < 24 * 60 * 60 * 1000;

      return isCardMatch && isAmountMatch && isNameMatch && isRecent;
    });

    expect(isDuplicate).toBe(true);

    // O extrato do cartão conjunto deve manter exatamente 1 transação (sem duplicar)
    const cardTxs = (await db.getTransactions()).filter(t => t.accountId === cardConjunto.id);
    expect(cardTxs.length).toBe(1);
    expect(cardTxs[0].amount).toBe(85.50);
  });

  it('4. Auto-cura: duas compras idênticas prévias no cartão conjunto (geradas pelos dois celulares) são unificadas em uma única', async () => {
    // Simula cenário onde o bug anterior já havia gerado duas transações no mesmo cartão conjunto
    const dup1: Transaction = {
      id: 'tx-dup-celular-1',
      accountId: cardConjunto.id,
      categoryId: 'cat-refeicao',
      amount: 62.00,
      type: 'expense',
      description: 'Restaurante Bom Sabor',
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      notes: 'Lançado diretamente na fatura do Nubank Conjunto',
      isShared: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const dup2: Transaction = {
      id: 'tx-dup-celular-2',
      accountId: cardConjunto.id,
      categoryId: 'cat-refeicao',
      amount: 62.00,
      type: 'expense',
      description: 'Restaurante Bom Sabor',
      date: new Date().toISOString(),
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'notification',
      notes: 'Lançado diretamente na fatura do Nubank Conjunto',
      isShared: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveTransaction(dup1);
    await db.saveTransaction(dup2);

    const initialTxs = await db.getTransactions();
    expect(initialTxs.length).toBe(2);

    // Executa a lógica de autocura de duplicatas em conta conjunta
    const duplicateIdsToDelete = new Set<string>();
    for (let i = 0; i < initialTxs.length; i++) {
      const t1 = initialTxs[i];
      if (duplicateIdsToDelete.has(t1.id)) continue;
      if (!t1.isShared) continue;

      for (let j = i + 1; j < initialTxs.length; j++) {
        const t2 = initialTxs[j];
        if (duplicateIdsToDelete.has(t2.id)) continue;
        if (t1.accountId !== t2.accountId) continue;
        if (Math.abs(t1.amount - t2.amount) >= 0.01) continue;

        const norm1 = categorizationEngine.normalize(t1.description || '');
        const norm2 = categorizationEngine.normalize(t2.description || '');
        const isSameDesc = norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1);

        if (isSameDesc) {
          duplicateIdsToDelete.add(t2.id);
          await db.deleteTransaction(t2.id);
          break;
        }
      }
    }

    expect(duplicateIdsToDelete.size).toBe(1);
    expect(
      duplicateIdsToDelete.has('tx-dup-celular-1') || duplicateIdsToDelete.has('tx-dup-celular-2')
    ).toBe(true);

    const healedTxs = await db.getTransactions();
    expect(healedTxs.length).toBe(1);
    expect(healedTxs[0].amount).toBe(62.00);
  });
});
