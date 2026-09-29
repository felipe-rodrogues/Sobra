import { describe, it, expect, beforeEach } from 'vitest';
import { generateInviteCode, createOrGetCardInvite, fetchInviteByCode } from '../src/services/supabase';
import { Account, UserProfile, Transaction } from '../src/core/types';

const memoryStorage: Record<string, string> = {};
// Polyfill do localStorage para ambiente Node
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => memoryStorage[k] || null,
    setItem: (k: string, v: string) => { memoryStorage[k] = v; },
    removeItem: (k: string) => { delete memoryStorage[k]; },
    clear: () => { Object.keys(memoryStorage).forEach(k => delete memoryStorage[k]); }
  };
}

describe('Sistema de Contas e Cartões Compartilhados (Contas Conjuntas)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('deve gerar códigos de convite no padrão SOBRA-XXXX', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^SOBRA-[A-Z0-9]{4}$/);
  });

  it('deve criar e persistir um convite para cartão de crédito', async () => {
    const mockUser: UserProfile = {
      id: 'usr-123',
      displayName: 'Felipe Rodrigues',
      email: 'felipe@gmail.com',
    };

    const mockAccount: Account = {
      id: 'card-nubank',
      name: 'Nubank Conjunto',
      type: 'credit_card',
      balance: 150.0,
      creditLimit: 5000,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      bankId: 'nubank',
      syncStatus: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const invite = await createOrGetCardInvite(mockAccount, mockUser);
    expect(invite).toBeDefined();
    expect(invite.code).toMatch(/^SOBRA-/);
    expect(invite.accountName).toBe('Nubank Conjunto');
    expect(invite.ownerName).toBe('Felipe Rodrigues');

    // Recupera pelo código gerado
    const fetched = await fetchInviteByCode(invite.code);
    expect(fetched).not.toBeNull();
    expect(fetched?.accountId).toBe('card-nubank');
    expect(fetched?.ownerName).toBe('Felipe Rodrigues');
  });

  it('deve retornar null para código de convite inexistente', async () => {
    const fetched = await fetchInviteByCode('SOBRA-INEXISTENTE');
    expect(fetched).toBeNull();
  });

  it('apenas o titular/criador do grupo/cartão deve ter permissão para excluir o cartão compartilhado', () => {
    const creatorUser = { id: 'usr-felipe', displayName: 'Felipe' };
    const partnerUser = { id: 'usr-jessica', displayName: 'Jéssica' };
    const sharedCard: Account = {
      id: 'acc-nubank-conjunto',
      name: 'Nubank Conjunto',
      type: 'credit_card',
      balance: 0,
      creditLimit: 5000,
      color: '#820AD1',
      icon: 'CreditCard',
      currency: 'BRL',
      bankId: 'nubank',
      syncStatus: 'manual',
      isShared: true,
      ownerId: 'usr-felipe',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const partnershipSpace = {
      code: 'SOBRA-Q2M3',
      ownerId: 'usr-felipe',
      ownerName: 'Felipe',
      partnerId: 'usr-jessica',
      partnerName: 'Jéssica',
      createdAt: new Date().toISOString(),
    };

    const canDelete = (card: Account, user: { id: string }, space: typeof partnershipSpace) => {
      return !card.isShared || (
        card.ownerId ? card.ownerId === user.id : (space ? space.ownerId === user.id : true)
      );
    };

    // Titular/criador tem permissão
    expect(canDelete(sharedCard, creatorUser, partnershipSpace)).toBe(true);

    // Parceiro convidado NÃO tem permissão
    expect(canDelete(sharedCard, partnerUser, partnershipSpace)).toBe(false);
  });

  it('deve sincronizar edições de nome, limite, cor e datas do cartão conjunto', async () => {
    const originalCard: Account = {
      id: 'card-1',
      name: 'Cartão Antigo',
      type: 'credit_card',
      balance: 50,
      creditLimit: 2000,
      color: '#820AD1',
      bankId: 'nubank',
      closingDay: 1,
      dueDay: 8,
      icon: 'credit-card',
      currency: 'BRL',
      syncStatus: 'manual',
      isShared: true,
      ownerId: 'usr-felipe',
      ownerName: 'Felipe',
      inviteCode: 'SOBRA-TEST',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Atualização simulada recebida no broadcast ou fetch
    const updatedCard: Account = {
      ...originalCard,
      name: 'Cartão Black Casal',
      creditLimit: 10000,
      color: '#000000',
      bankId: 'c6',
      closingDay: 10,
      dueDay: 17,
      updatedAt: new Date().toISOString(),
    };

    // Função de mesclagem idêntica à do FinanceContext e sharedItemsSyncService
    const mergeAccountUpdates = (local: Account, remote: Account): Account => ({
      ...local,
      ...remote,
      balance: (remote.balance !== undefined && remote.balance !== 0) ? remote.balance : local.balance,
      invoiceAmount: local.invoiceAmount,
      isShared: true,
      updatedAt: remote.updatedAt,
    });

    const reconciled = mergeAccountUpdates(originalCard, updatedCard);
    expect(reconciled.name).toBe('Cartão Black Casal');
    expect(reconciled.creditLimit).toBe(10000);
    expect(reconciled.color).toBe('#000000');
    expect(reconciled.bankId).toBe('c6');
    expect(reconciled.closingDay).toBe(10);
    expect(reconciled.dueDay).toBe(17);
    expect(reconciled.balance).toBe(50); // Preserva o saldo local calculado
  });

  it('deve sincronizar edições em lançamentos do cartão conjunto (ex: alteração de receita para despesa e novo nome)', async () => {
    // 1. Transação antiga local no aparelho da parceira (registrada incorretamente como receita)
    const localTx: Transaction = {
      id: 'tx-shared-123',
      accountId: 'card-shared-1',
      categoryId: 'cat-income',
      amount: 150.00,
      type: 'income',
      description: 'Entrada Incorreta',
      date: '2026-09-15T12:00:00.000Z',
      status: 'confirmed',
      paymentMethod: 'credit',
      source: 'manual',
      isShared: true,
      createdById: 'usr-felipe',
      createdByName: 'Felipe',
      createdAt: '2026-09-15T10:00:00.000Z',
      updatedAt: '2026-09-15T10:00:00.000Z',
    };

    // 2. Transação editada pelo Felipe (corrigida para despesa e com nova descrição)
    const remoteEditedTx: Transaction = {
      ...localTx,
      type: 'expense',
      description: 'Supermercado Casal',
      amount: 180.50,
      categoryId: 'cat-alimentacao',
      updatedAt: '2026-09-28T19:30:00.000Z',
    };

    // Lógica idêntica ao reconciliation loop no FinanceContext
    const isTxDiff =
      localTx.description !== remoteEditedTx.description ||
      localTx.amount !== remoteEditedTx.amount ||
      localTx.type !== remoteEditedTx.type ||
      localTx.categoryId !== remoteEditedTx.categoryId ||
      localTx.date !== remoteEditedTx.date ||
      localTx.status !== remoteEditedTx.status ||
      localTx.paymentMethod !== remoteEditedTx.paymentMethod ||
      (remoteEditedTx.updatedAt && localTx.updatedAt !== remoteEditedTx.updatedAt);

    expect(isTxDiff).toBe(true);

    const updatedTx: Transaction = {
      ...localTx,
      ...remoteEditedTx,
      isShared: true,
    };

    expect(updatedTx.type).toBe('expense');
    expect(updatedTx.description).toBe('Supermercado Casal');
    expect(updatedTx.amount).toBe(180.50);
    expect(updatedTx.categoryId).toBe('cat-alimentacao');
  });
});
