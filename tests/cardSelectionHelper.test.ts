import { describe, it, expect } from 'vitest';
import { 
  extractCardLastDigits, 
  getCardDisplayTitle, 
  getCardDisplaySubtitle, 
  getSmartDefaultCreditCard,
  getSmartDefaultAccountForExpense,
  resolveTransactionAuthorBadge,
} from '../src/core/cards/cardSelectionHelper';
import { Account, Transaction, PartnershipSpace } from '../src/core/types';

describe('cardSelectionHelper', () => {
  const cardNubank1: Account = {
    id: 'card-nu-1',
    name: 'Nubank',
    type: 'credit_card',
    balance: 500,
    color: '#820AD1',
    icon: 'credit-card',
    currency: 'BRL',
    bankId: 'nubank',
    lastDigits: '5023',
    syncStatus: 'manual',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const cardNubank2: Account = {
    id: 'card-nu-2',
    name: 'Nubank',
    type: 'credit_card',
    balance: 1200,
    color: '#820AD1',
    icon: 'credit-card',
    currency: 'BRL',
    bankId: 'nubank',
    lastDigits: '9812',
    syncStatus: 'manual',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const cardInterNoDigits: Account = {
    id: 'card-inter',
    name: 'Inter (Final 4455)',
    type: 'credit_card',
    balance: 300,
    color: '#FF7A00',
    icon: 'credit-card',
    currency: 'BRL',
    bankId: 'inter',
    syncStatus: 'manual',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const cardC6Plain: Account = {
    id: 'card-c6',
    name: 'C6 Bank',
    type: 'credit_card',
    balance: 0,
    color: '#242424',
    icon: 'credit-card',
    currency: 'BRL',
    bankId: 'c6',
    syncStatus: 'manual',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const checkingAcc: Account = {
    id: 'acc-main',
    name: 'Conta Principal',
    type: 'checking',
    balance: 3500,
    color: '#10B981',
    icon: 'landmark',
    currency: 'BRL',
    bankId: 'itau',
    syncStatus: 'manual',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  describe('extractCardLastDigits', () => {
    it('extrai os 4 dígitos a partir de lastDigits', () => {
      expect(extractCardLastDigits(cardNubank1)).toBe('5023');
      expect(extractCardLastDigits(cardNubank2)).toBe('9812');
    });

    it('extrai os 4 dígitos do nome se lastDigits não estiver preenchido', () => {
      expect(extractCardLastDigits(cardInterNoDigits)).toBe('4455');
      expect(extractCardLastDigits({ ...cardC6Plain, name: 'C6 Bank •••• 7788' })).toBe('7788');
      expect(extractCardLastDigits({ ...cardC6Plain, name: 'C6 Bank (1234)' })).toBe('1234');
    });

    it('retorna vazio se o cartão não tiver dígitos nem no nome nem no campo', () => {
      expect(extractCardLastDigits(cardC6Plain)).toBe('');
      expect(extractCardLastDigits(undefined)).toBe('');
    });
  });

  describe('getCardDisplayTitle & getCardDisplaySubtitle', () => {
    it('adiciona •••• 5023 ao título se o nome não contém os dígitos', () => {
      expect(getCardDisplayTitle(cardNubank1)).toBe('Nubank •••• 5023');
      expect(getCardDisplayTitle(cardNubank2)).toBe('Nubank •••• 9812');
    });

    it('não duplica os dígitos se o nome já contiver', () => {
      expect(getCardDisplayTitle(cardInterNoDigits)).toBe('Inter (Final 4455)');
    });

    it('monta o subtítulo informativo com o final do cartão', () => {
      expect(getCardDisplaySubtitle(cardNubank1, 'Cartão de Crédito')).toBe('Cartão de Crédito • Final 5023');
      expect(getCardDisplaySubtitle(cardC6Plain, 'Cartão de Crédito')).toBe('Cartão de Crédito');
      expect(getCardDisplaySubtitle(checkingAcc, 'Conta Corrente')).toBe('Conta Corrente');
    });
  });

  describe('getSmartDefaultCreditCard', () => {
    const refDate = new Date('2026-10-04T12:00:00Z');

    it('seleciona o cartão mais utilizado nos últimos dias', () => {
      const accounts = [cardNubank1, cardNubank2, checkingAcc];
      
      const transactions: Transaction[] = [
        // cardNubank1 usado ontem e anteontem (muito recente = 5 pts cada = 10 pts)
        {
          id: 'tx-1',
          accountId: 'card-nu-1',
          categoryId: 'cat-test',
          source: 'manual',
          amount: 50,
          description: 'Padaria',
          date: '2026-10-03T10:00:00Z',
          type: 'expense',
          paymentMethod: 'credit',
          status: 'confirmed',
          createdAt: '2026-10-03',
          updatedAt: '2026-10-03',
        },
        {
          id: 'tx-2',
          accountId: 'card-nu-1',
          categoryId: 'cat-test',
          source: 'manual',
          amount: 120,
          description: 'Mercado',
          date: '2026-10-02T14:00:00Z',
          type: 'expense',
          paymentMethod: 'credit',
          status: 'confirmed',
          createdAt: '2026-10-02',
          updatedAt: '2026-10-02',
        },
        // cardNubank2 usado há 12 dias (2 pts)
        {
          id: 'tx-3',
          accountId: 'card-nu-2',
          categoryId: 'cat-test',
          source: 'manual',
          amount: 200,
          description: 'Restaurante',
          date: '2026-09-22T19:00:00Z',
          type: 'expense',
          paymentMethod: 'credit',
          status: 'confirmed',
          createdAt: '2026-09-22',
          updatedAt: '2026-09-22',
        },
      ];

      const selected = getSmartDefaultCreditCard(accounts, transactions, refDate);
      expect(selected?.id).toBe('card-nu-1');
      expect(selected?.lastDigits).toBe('5023');
    });

    it('desempata por recência da última compra caso a pontuação seja igual', () => {
      const accounts = [cardNubank1, cardNubank2];

      const transactions: Transaction[] = [
        {
          id: 'tx-1',
          accountId: 'card-nu-1',
          categoryId: 'cat-test',
          source: 'manual',
          amount: 50,
          description: 'Café',
          date: '2026-10-02T08:00:00Z',
          type: 'expense',
          paymentMethod: 'credit',
          status: 'confirmed',
          createdAt: '2026-10-02',
          updatedAt: '2026-10-02',
        },
        {
          id: 'tx-2',
          accountId: 'card-nu-2',
          categoryId: 'cat-test',
          source: 'manual',
          amount: 80,
          description: 'Farmácia',
          date: '2026-10-03T18:00:00Z', // Mais recente que card-nu-1
          type: 'expense',
          paymentMethod: 'credit',
          status: 'confirmed',
          createdAt: '2026-10-03',
          updatedAt: '2026-10-03',
        },
      ];

      const selected = getSmartDefaultCreditCard(accounts, transactions, refDate);
      expect(selected?.id).toBe('card-nu-2');
    });

    it('ignora pagamentos de fatura na contagem de uso do cartão', () => {
      const accounts = [cardNubank1, cardNubank2];

      const transactions: Transaction[] = [
        {
          id: 'tx-pay',
          accountId: 'card-nu-1',
          categoryId: 'cat-test',
          source: 'manual',
          amount: 1500,
          description: 'Pagamento de fatura Nubank',
          date: '2026-10-03T18:00:00Z',
          type: 'expense',
          paymentMethod: 'credit',
          status: 'confirmed',
          createdAt: '2026-10-03',
          updatedAt: '2026-10-03',
        },
        {
          id: 'tx-compra',
          accountId: 'card-nu-2',
          categoryId: 'cat-test',
          source: 'manual',
          amount: 45,
          description: 'Livraria',
          date: '2026-10-01T15:00:00Z',
          type: 'expense',
          paymentMethod: 'credit',
          status: 'confirmed',
          createdAt: '2026-10-01',
          updatedAt: '2026-10-01',
        },
      ];

      const selected = getSmartDefaultCreditCard(accounts, transactions, refDate);
      expect(selected?.id).toBe('card-nu-2');
    });

    it('retorna o primeiro cartão quando não houver transações', () => {
      const accounts = [cardNubank1, cardNubank2];
      const selected = getSmartDefaultCreditCard(accounts, [], refDate);
      expect(selected?.id).toBe('card-nu-1');
    });
  });

  describe('getSmartDefaultAccountForExpense', () => {
    it('respeita defaultAccountId explícito mesmo se outro cartão for mais usado', () => {
      const accounts = [cardNubank1, cardNubank2];
      const selected = getSmartDefaultAccountForExpense(accounts, [], {
        defaultAccountId: 'card-nu-2',
      });
      expect(selected?.id).toBe('card-nu-2');
    });

    it('respeita activeViewedCardId se o usuário estiver na página de um cartão específico', () => {
      const accounts = [cardNubank1, cardNubank2];
      const selected = getSmartDefaultAccountForExpense(accounts, [], {
        activeViewedCardId: 'card-nu-2',
      });
      expect(selected?.id).toBe('card-nu-2');
    });
  });

  describe('resolveTransactionAuthorBadge', () => {
    const sharedCard: Account = {
      id: 'acc-shared-card',
      name: 'Nubank Conjunto',
      type: 'credit_card',
      balance: 500,
      color: '#820AD1',
      icon: 'credit-card',
      currency: 'BRL',
      bankId: 'nubank',
      lastDigits: '6188',
      additionalCardLastDigits: '4432',
      additionalCardHolderName: 'Jéssica',
      isShared: true,
      syncStatus: 'manual',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const sharedCardWithoutAdditional: Account = {
      ...sharedCard,
      id: 'acc-shared-no-add',
      additionalCardLastDigits: undefined,
      additionalCardHolderName: undefined,
    };

    const privateCard: Account = {
      id: 'acc-private-card',
      name: 'Inter Pessoal',
      type: 'credit_card',
      balance: 100,
      color: '#FF7A00',
      icon: 'credit-card',
      currency: 'BRL',
      bankId: 'inter',
      lastDigits: '1122',
      isShared: false,
      syncStatus: 'manual',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const space: PartnershipSpace = {
      id: 'space-1',
      code: 'SOBRA-TEST',
      isActive: true,
      createdAt: '2026-01-01',
      ownerId: 'user-felps',
      ownerName: 'Felps',
      ownerAvatarUrl: 'https://example.com/felps.png',
      partnerId: 'user-jessica',
      partnerName: 'Jéssica',
      partnerAvatarUrl: 'https://example.com/jessica.png',
    };

    const currentUser = {
      id: 'user-felps',
      displayName: 'Felps',
      avatarUrl: 'https://example.com/felps.png',
    };

    it('retorna type "bank" para compras pessoais/não compartilhadas', () => {
      const tx: Transaction = {
        id: 'tx-1',
        accountId: 'acc-private-card',
        categoryId: 'cat-1',
        amount: 50,
        type: 'expense',
        paymentMethod: 'credit',
        source: 'manual',
        description: 'Mercado',
        date: '2026-10-18',
        status: 'confirmed',
        createdAt: '2026-10-18',
        updatedAt: '2026-10-18',
      };

      const badge = resolveTransactionAuthorBadge({
        tx,
        account: privateCard,
        currentUser,
        partnershipSpace: space,
      });

      expect(badge.type).toBe('bank');
    });

    it('retorna ícone de conjunto se o usuário não inseriu o final do cartão adicional', () => {
      const tx: Transaction = {
        id: 'tx-2',
        accountId: 'acc-shared-no-add',
        categoryId: 'cat-1',
        amount: 80,
        type: 'expense',
        paymentMethod: 'credit',
        source: 'manual',
        description: 'Farmácia',
        cardLastDigits: '6188',
        date: '2026-10-18',
        status: 'confirmed',
        createdAt: '2026-10-18',
        updatedAt: '2026-10-18',
      };

      const badge = resolveTransactionAuthorBadge({
        tx,
        account: sharedCardWithoutAdditional,
        currentUser,
        partnershipSpace: space,
      });

      expect(badge.type).toBe('joint');
      expect(badge.isJoint).toBe(true);
    });

    it('identifica a compra como do adicional (Jéssica) pelos dígitos do adicional (4432) com avatar', () => {
      const tx: Transaction = {
        id: 'tx-3',
        accountId: 'acc-shared-card',
        categoryId: 'cat-1',
        amount: 120,
        type: 'expense',
        paymentMethod: 'credit',
        source: 'manual',
        description: 'Zara Shopping',
        cardLastDigits: '4432',
        date: '2026-10-18',
        status: 'confirmed',
        createdAt: '2026-10-18',
        updatedAt: '2026-10-18',
      };

      const badge = resolveTransactionAuthorBadge({
        tx,
        account: sharedCard,
        currentUser,
        partnershipSpace: space,
      });

      expect(badge.type).toBe('author');
      expect(badge.name).toBe('Jéssica');
      expect(badge.initial).toBe('J');
      expect(badge.avatarUrl).toBe('https://example.com/jessica.png');
    });

    it('identifica a compra como do titular (Felps) pelos dígitos do titular (6188) com avatar', () => {
      const tx: Transaction = {
        id: 'tx-4',
        accountId: 'acc-shared-card',
        categoryId: 'cat-1',
        amount: 35,
        type: 'expense',
        paymentMethod: 'credit',
        source: 'manual',
        description: 'Posto Shell',
        cardLastDigits: '6188',
        date: '2026-10-18',
        status: 'confirmed',
        createdAt: '2026-10-18',
        updatedAt: '2026-10-18',
      };

      const badge = resolveTransactionAuthorBadge({
        tx,
        account: sharedCard,
        currentUser,
        partnershipSpace: space,
      });

      expect(badge.type).toBe('author');
      expect(badge.name).toBe('Felps');
      expect(badge.initial).toBe('F');
      expect(badge.avatarUrl).toBe('https://example.com/felps.png');
    });

    it('retorna a inicial quando o usuário não tiver foto definida', () => {
      const spaceWithoutPhoto: PartnershipSpace = {
        ...space,
        partnerAvatarUrl: undefined,
      };

      const tx: Transaction = {
        id: 'tx-5',
        accountId: 'acc-shared-card',
        categoryId: 'cat-1',
        amount: 45,
        type: 'expense',
        paymentMethod: 'credit',
        source: 'manual',
        description: 'Padaria',
        cardLastDigits: '4432',
        date: '2026-10-18',
        status: 'confirmed',
        createdAt: '2026-10-18',
        updatedAt: '2026-10-18',
      };

      const badge = resolveTransactionAuthorBadge({
        tx,
        account: sharedCard,
        currentUser,
        partnershipSpace: spaceWithoutPhoto,
      });

      expect(badge.type).toBe('author');
      expect(badge.avatarUrl).toBeUndefined();
      expect(badge.initial).toBe('J');
    });

    it('retorna ícone de casal se a compra não tiver dígitos nem autor', () => {
      const tx: Transaction = {
        id: 'tx-6',
        accountId: 'acc-shared-card',
        categoryId: 'cat-1',
        amount: 200,
        type: 'expense',
        paymentMethod: 'credit',
        source: 'manual',
        description: 'Supermercado Mensal',
        date: '2026-10-18',
        status: 'confirmed',
        createdAt: '2026-10-18',
        updatedAt: '2026-10-18',
      };

      const badge = resolveTransactionAuthorBadge({
        tx,
        account: sharedCard,
        currentUser,
        partnershipSpace: space,
      });

      expect(badge.type).toBe('joint');
      expect(badge.isJoint).toBe(true);
    });

    it('identifica a parceira por createdByName sem acento ("Jessica" vs "Jéssica") e retorna o avatar', () => {
      const tx: Transaction = {
        id: 'tx-7',
        accountId: 'acc-shared-card',
        categoryId: 'cat-1',
        amount: 13.5,
        type: 'expense',
        paymentMethod: 'credit',
        source: 'manual',
        description: 'TikTok Shop S',
        createdByName: 'Jessica',
        date: '2026-10-25',
        status: 'confirmed',
        createdAt: '2026-10-25',
        updatedAt: '2026-10-25',
      };

      const badge = resolveTransactionAuthorBadge({
        tx,
        account: sharedCard,
        currentUser,
        partnershipSpace: space,
      });

      expect(badge.type).toBe('author');
      expect(badge.name).toBe('Jessica');
      expect(badge.avatarUrl).toBe('https://example.com/jessica.png');
    });

    it('identifica a parceira por createdById mesmo sem createdByName e retorna o avatar', () => {
      const tx: Transaction = {
        id: 'tx-8',
        accountId: 'acc-shared-card',
        categoryId: 'cat-1',
        amount: 55,
        type: 'expense',
        paymentMethod: 'credit',
        source: 'manual',
        description: 'Livraria',
        createdById: 'user-jessica',
        date: '2026-10-25',
        status: 'confirmed',
        createdAt: '2026-10-25',
        updatedAt: '2026-10-25',
      };

      const badge = resolveTransactionAuthorBadge({
        tx,
        account: sharedCard,
        currentUser,
        partnershipSpace: space,
      });

      expect(badge.type).toBe('author');
      expect(badge.avatarUrl).toBe('https://example.com/jessica.png');
    });

    it('recupera avatar da parceira a partir de sharedMembers em accounts quando partnershipSpace não tiver foto', () => {
      const emptySpace: PartnershipSpace = {
        ...space,
        partnerAvatarUrl: undefined,
      };

      const cardWithMemberAvatar: Account = {
        ...sharedCard,
        sharedMembers: [
          {
            userId: 'user-owner',
            displayName: 'Felps',
            email: 'felps@test.com',
            role: 'owner',
            joinedAt: '2026-10-01',
          },
          {
            userId: 'user-partner',
            displayName: 'Jéssica',
            email: 'jessica@test.com',
            avatarUrl: 'https://example.com/jessica-from-card.png',
            role: 'member',
            joinedAt: '2026-10-01',
          },
        ],
      };

      const tx: Transaction = {
        id: 'tx-9',
        accountId: cardWithMemberAvatar.id,
        categoryId: 'cat-1',
        amount: 13.5,
        type: 'expense',
        paymentMethod: 'credit',
        source: 'manual',
        description: 'TikTok Shop S',
        createdByName: 'Jéssica',
        date: '2026-10-25',
        status: 'confirmed',
        createdAt: '2026-10-25',
        updatedAt: '2026-10-25',
      };

      const badge = resolveTransactionAuthorBadge({
        tx,
        account: cardWithMemberAvatar,
        currentUser,
        partnershipSpace: emptySpace,
      });

      expect(badge.type).toBe('author');
      expect(badge.avatarUrl).toBe('https://example.com/jessica-from-card.png');
    });
  });
});
