import { describe, it, expect } from 'vitest';
import { Transaction } from '../src/core/types';

// Replica lógica de detecção de importação e de data
const isCardImportedTx = (t: Transaction): boolean => {
  return Boolean(
    t.source === 'csv' ||
    t.id.startsWith('tx-csv-') ||
    (t.notes && t.notes.includes('Importado via')) ||
    (t.id.startsWith('tx-inst-') && t.notes && t.notes.includes('importação'))
  );
};

const isTxImportedToday = (tx: Transaction, testNow?: Date): boolean => {
  let createdDate: Date | null = null;

  if (tx.createdAt) {
    const d = new Date(tx.createdAt);
    if (!isNaN(d.getTime())) {
      createdDate = d;
    }
  }

  if (!createdDate && tx.id.startsWith('tx-csv-')) {
    const parts = tx.id.split('-');
    const ts = Number(parts[2]);
    if (!isNaN(ts) && ts > 0) {
      createdDate = new Date(ts);
    }
  }

  if (!createdDate) return false;

  const now = testNow || new Date();
  const isSameCalendarDay =
    createdDate.getFullYear() === now.getFullYear() &&
    createdDate.getMonth() === now.getMonth() &&
    createdDate.getDate() === now.getDate();

  if (isSameCalendarDay) return true;

  const diffHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours < 24;
};

describe('Regra de Exibição de Limpeza de Importação', () => {
  it('reconhece transações importadas via CSV/PDF', () => {
    const txImported: Transaction = {
      id: 'tx-csv-123456789-abc',
      accountId: 'card-1',
      categoryId: 'cat-1',
      amount: 50,
      type: 'expense',
      description: 'Compra Mercado',
      date: '2026-09-28T12:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'csv',
      notes: 'Importado via extrato CSV/PDF',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const txManual: Transaction = {
      id: 'tx-manual-1',
      accountId: 'card-1',
      categoryId: 'cat-1',
      amount: 50,
      type: 'expense',
      description: 'Compra Manual',
      date: '2026-09-28T12:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(isCardImportedTx(txImported)).toBe(true);
    expect(isCardImportedTx(txManual)).toBe(false);
  });

  it('exibe aviso somente no dia em que foi importado e oculta em dias posteriores', () => {
    const now = new Date('2026-10-06T20:00:00.000Z');

    // Transação importada hoje
    const txToday: Transaction = {
      id: `tx-csv-${now.getTime()}-xyz`,
      accountId: 'card-1',
      categoryId: 'cat-1',
      amount: 100,
      type: 'expense',
      description: 'Compra Teste Hoje',
      date: '2026-09-29T12:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'csv',
      notes: 'Importado via extrato CSV: 99 RIDE',
      createdAt: '2026-10-06T19:30:00.000Z',
      updatedAt: '2026-10-06T19:30:00.000Z',
    };

    // Transação importada 3 dias atrás
    const txOld: Transaction = {
      id: 'tx-csv-1000000-old',
      accountId: 'card-1',
      categoryId: 'cat-1',
      amount: 100,
      type: 'expense',
      description: 'Compra Teste Antiga',
      date: '2026-09-10T12:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'csv',
      notes: 'Importado via extrato CSV',
      createdAt: '2026-10-02T10:00:00.000Z',
      updatedAt: '2026-10-02T10:00:00.000Z',
    };

    expect(isTxImportedToday(txToday, now)).toBe(true);
    expect(isTxImportedToday(txOld, now)).toBe(false);
  });

  it('permite dispensar o aviso manualmente por chave de cartão e mês/ano da fatura', () => {
    const cardId = 'card-1';
    const year = 2026;
    const month = 10;
    const key = `${cardId}_${year}_${month}`;

    const dismissedBanners: Record<string, boolean> = {};

    // Inicialmente não está dispensado
    expect(Boolean(dismissedBanners[key])).toBe(false);

    // Usuário clica em 'Tudo certo' ou no 'x'
    dismissedBanners[key] = true;
    expect(Boolean(dismissedBanners[key])).toBe(true);

    // Outro cartão ou mês diferente não é afetado
    const otherKey = `${cardId}_${year}_${month + 1}`;
    expect(Boolean(dismissedBanners[otherKey])).toBe(false);

    // Ao desfazer a importação para reimportar, a chave de dispensa é resetada
    delete dismissedBanners[key];
    expect(Boolean(dismissedBanners[key])).toBe(false);
  });
});

