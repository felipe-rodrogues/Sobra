import { describe, it, expect } from 'vitest';
import { 
  accountMatchesCardDigits, 
  getAccountAllLastDigits, 
  getCardHolderLabelForDigits 
} from '../src/core/cards/cardSelectionHelper';
import { Account, Transaction } from '../src/core/types';

describe('Suporte a Cartão Adicional no Cartão Compartilhado', () => {
  const sharedCardWithAdditional: Account = {
    id: 'card-nu-shared',
    name: 'Nubank Conjunto',
    type: 'credit_card',
    balance: 800,
    color: '#820AD1',
    icon: 'credit-card',
    currency: 'BRL',
    bankId: 'nubank',
    lastDigits: '6188', // Cartão titular (ex: Felps)
    additionalCardLastDigits: '4432', // Cartão adicional (ex: Jéssica Furtado)
    additionalCardHolderName: 'Jéssica Furtado',
    additionalCards: [
      {
        id: 'add-card-4432',
        lastDigits: '4432',
        holderName: 'Jéssica Furtado',
      }
    ],
    isShared: true,
    syncStatus: 'manual',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const simpleCard: Account = {
    id: 'card-inter',
    name: 'Inter',
    type: 'credit_card',
    balance: 200,
    color: '#FF7A00',
    icon: 'credit-card',
    currency: 'BRL',
    bankId: 'inter',
    lastDigits: '9010',
    syncStatus: 'manual',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  describe('accountMatchesCardDigits', () => {
    it('corresponde ao cartão titular pelos 4 dígitos principais (6188)', () => {
      expect(accountMatchesCardDigits(sharedCardWithAdditional, '6188')).toBe(true);
      expect(accountMatchesCardDigits(sharedCardWithAdditional, '•••• 6188')).toBe(true);
    });

    it('corresponde ao cartão adicional pelos 4 dígitos do adicional (4432)', () => {
      expect(accountMatchesCardDigits(sharedCardWithAdditional, '4432')).toBe(true);
      expect(accountMatchesCardDigits(sharedCardWithAdditional, '•••• 4432')).toBe(true);
    });

    it('não corresponde a dígitos diferentes ou inexistentes', () => {
      expect(accountMatchesCardDigits(sharedCardWithAdditional, '9999')).toBe(false);
      expect(accountMatchesCardDigits(sharedCardWithAdditional, '')).toBe(false);
      expect(accountMatchesCardDigits(sharedCardWithAdditional, null)).toBe(false);
      expect(accountMatchesCardDigits(null, '6188')).toBe(false);
    });
  });

  describe('getAccountAllLastDigits', () => {
    it('retorna os dígitos do titular e do adicional sem duplicatas', () => {
      const allDigits = getAccountAllLastDigits(sharedCardWithAdditional);
      expect(allDigits).toContain('6188');
      expect(allDigits).toContain('4432');
      expect(allDigits.length).toBe(2);
    });

    it('retorna apenas os dígitos do titular caso não haja cartão adicional', () => {
      const digits = getAccountAllLastDigits(simpleCard);
      expect(digits).toEqual(['9010']);
    });
  });

  describe('getCardHolderLabelForDigits', () => {
    it('identifica o portador como "Titular" para os dígitos do cartão principal', () => {
      expect(getCardHolderLabelForDigits(sharedCardWithAdditional, '6188')).toBe('Titular');
    });

    it('identifica o nome do parceiro/adicional para os dígitos do cartão adicional', () => {
      expect(getCardHolderLabelForDigits(sharedCardWithAdditional, '4432')).toBe('Jéssica Furtado');
    });

    it('retorna "Adicional" caso o nome do portador não tenha sido preenchido', () => {
      const cardWithoutName: Account = {
        ...sharedCardWithAdditional,
        additionalCardHolderName: undefined,
        additionalCards: [{ id: 'add-1', lastDigits: '4432' }]
      };
      expect(getCardHolderLabelForDigits(cardWithoutName, '4432')).toBe('Adicional');
    });

    it('retorna undefined para dígitos que não pertencem ao cartão', () => {
      expect(getCardHolderLabelForDigits(sharedCardWithAdditional, '1111')).toBeUndefined();
    });
  });

  describe('Filtragem e direcionamento de compras para a fatura do cartão conjunto', () => {
    it('direciona compras do titular e do adicional para a mesma conta de cartão', () => {
      const accounts = [sharedCardWithAdditional, simpleCard];

      // Compra 1: Notificação capturada com o final do titular (6188)
      const parsedNotificationTitular = {
        cardLastDigits: '6188',
        merchant: 'Supermercado Pão de Açúcar',
        amount: 150.0,
      };

      // Compra 2: Notificação capturada com o final do adicional (4432)
      const parsedNotificationAdicional = {
        cardLastDigits: '4432',
        merchant: 'Zara Shopping',
        amount: 280.0,
      };

      const matchedTitular = accounts.find(a => accountMatchesCardDigits(a, parsedNotificationTitular.cardLastDigits));
      const matchedAdicional = accounts.find(a => accountMatchesCardDigits(a, parsedNotificationAdicional.cardLastDigits));

      // Ambos devem cair no mesmo cartão compartilhado (fatura conjunta)
      expect(matchedTitular?.id).toBe('card-nu-shared');
      expect(matchedAdicional?.id).toBe('card-nu-shared');
      expect(matchedTitular?.name).toBe('Nubank Conjunto');
      expect(matchedAdicional?.name).toBe('Nubank Conjunto');
    });

    it('preserva compatibilidade regressiva com cartões legados sem lastDigits e sem adicional', () => {
      const legacyCard: Account = {
        id: 'card-legacy',
        name: 'Nubank Pessoal',
        type: 'credit_card',
        balance: 100,
        color: '#820AD1',
        icon: 'credit-card',
        currency: 'BRL',
        bankId: 'nubank',
        syncStatus: 'manual',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      };

      // 1. Dígitos retornam vazio com segurança
      expect(getAccountAllLastDigits(legacyCard)).toEqual([]);
      expect(accountMatchesCardDigits(legacyCard, '6188')).toBe(false);
      expect(getCardHolderLabelForDigits(legacyCard, '6188')).toBeUndefined();

      // 2. Se o nome tiver os dígitos (ex: extração por regex de nome antigo)
      const legacyCardWithNameDigits: Account = {
        ...legacyCard,
        name: 'Nubank (Final 7788)',
      };
      expect(getAccountAllLastDigits(legacyCardWithNameDigits)).toEqual(['7788']);
      expect(accountMatchesCardDigits(legacyCardWithNameDigits, '7788')).toBe(true);
      expect(getCardHolderLabelForDigits(legacyCardWithNameDigits, '7788')).toBe('Titular');
    });

    it('quando uma notificação não traz dígitos do cartão, não quebra a busca por banco', () => {
      const accounts = [sharedCardWithAdditional, simpleCard];
      const notifWithoutDigits = {
        bankId: 'inter',
        merchant: 'Farmácia Raia',
        amount: 45.90,
      };

      // Busca padrão por banco continua funcionando normalmente
      const matched = accounts.find(a => a.bankId === notifWithoutDigits.bankId);
      expect(matched?.id).toBe('card-inter');
    });
  });
});
