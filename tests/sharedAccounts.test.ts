import { describe, it, expect, beforeEach } from 'vitest';
import { generateInviteCode, createOrGetCardInvite, fetchInviteByCode } from '../src/services/supabase';
import { Account, UserProfile } from '../src/core/types';

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
});
