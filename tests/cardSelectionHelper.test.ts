import { describe, it, expect } from 'vitest';
import { 
  extractCardLastDigits, 
  getCardDisplayTitle, 
  getCardDisplaySubtitle, 
  getSmartDefaultCreditCard,
  getSmartDefaultAccountForExpense
} from '../src/core/cards/cardSelectionHelper';
import { Account, Transaction } from '../src/core/types';

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
});
