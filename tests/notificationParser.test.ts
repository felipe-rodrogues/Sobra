import { describe, it, expect } from 'vitest';
import { NubankParser } from '../src/core/parsers/nubankParser';
import { ItauParser } from '../src/core/parsers/itauParser';
import { BradescoParser } from '../src/core/parsers/bradescoParser';
import { BbParser } from '../src/core/parsers/bbParser';
import { CaixaParser } from '../src/core/parsers/caixaParser';
import { SantanderParser } from '../src/core/parsers/santanderParser';
import { InterParser } from '../src/core/parsers/interParser';
import { C6Parser } from '../src/core/parsers/c6Parser';
import { MercadoPagoParser } from '../src/core/parsers/mercadoPagoParser';
import { PicPayParser } from '../src/core/parsers/picpayParser';
import { GenericBankParser } from '../src/core/parsers/genericParser';
import { NotificationEngine } from '../src/core/parsers/notificationEngine';
import { parseBrlCurrency, extractDetectedBalance } from '../src/core/parsers/currencyHelper';
import { Category } from '../src/core/types';

describe('Bank Notification Parsers with Balance & Bank Detection', () => {
  describe('extractDetectedBalance', () => {
    it('deve extrair o saldo da conta quando presente no texto da notificação', () => {
      expect(extractDetectedBalance('Compra de R$ 50,00 aprovada. Saldo disponível: R$ 1.250,50')).toBe(1250.50);
      expect(extractDetectedBalance('Itaú: Saldo em conta: R$ 3.400,00')).toBe(3400.00);
      expect(extractDetectedBalance('Inter: Seu saldo é R$ 850,20')).toBe(850.20);
      expect(extractDetectedBalance('BB: Saldo da conta: R$ 2.150,00')).toBe(2150.00);
      expect(extractDetectedBalance('PicPay: Saldo em carteira: R$ 320,00')).toBe(320.00);
      expect(extractDetectedBalance('Compra aprovada sem saldo mencionado')).toBeNull();
    });
  });

  describe('NubankParser com Detecção de Saldo', () => {
    const parser = new NubankParser();

    it('deve parsear compra no Nubank e extrair saldo disponível', () => {
      const parsed = parser.parse(
        'Nubank',
        'Compra aprovada no seu Nubank de R$ 54,90 em PADARIA ESTRELA. Saldo disponível: R$ 1.840,50'
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(54.90);
      expect(parsed?.merchant).toBe('PADARIA ESTRELA');
      expect(parsed?.detectedBalance).toBe(1840.50);
      expect(parsed?.type).toBe('expense');
    });

    it('deve parsear Pix recebido no Nubank', () => {
      const parsed = parser.parse(
        'Transferência recebida',
        'Você recebeu uma transferência Pix de R$ 300,00 de Maria Souza'
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(300.00);
      expect(parsed?.merchant).toBe('Maria Souza');
      expect(parsed?.type).toBe('income');
    });
  });

  describe('ItauParser com Detecção de Saldo', () => {
    const parser = new ItauParser();

    it('deve parsear compra no cartão Itaú e capturar saldo', () => {
      const parsed = parser.parse(
        'Itaú',
        'Itaú: Compra aprovada no cartão final 1234 valor R$ 89,90 no RESTAURANTE SABOR. Saldo em conta: R$ 3.250,00'
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(89.90);
      expect(parsed?.merchant).toBe('RESTAURANTE SABOR');
      expect(parsed?.detectedBalance).toBe(3250.00);
    });
  });

  describe('BradescoParser com Detecção de Saldo', () => {
    const parser = new BradescoParser();

    it('deve parsear compra Bradesco e capturar saldo', () => {
      const parsed = parser.parse(
        'Bradesco Cartões',
        'Bradesco Cartões: Compra de R$ 120,50 aprovada em POSTO IPIRANGA. Saldo: R$ 1.450,00'
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(120.50);
      expect(parsed?.merchant).toBe('POSTO IPIRANGA');
      expect(parsed?.detectedBalance).toBe(1450.00);
    });
  });

  describe('Banco do Brasil (BB)', () => {
    const parser = new BbParser();

    it('deve parsear compra Ourocard e capturar saldo da conta', () => {
      const parsed = parser.parse(
        'Banco do Brasil',
        'BB: Compra com Ourocard Visa final 5678 aprovada no valor de R$ 68,00 em FARMACIA RAIA. Saldo da conta: R$ 2.450,30'
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(68.00);
      expect(parsed?.merchant).toBe('FARMACIA RAIA');
      expect(parsed?.detectedBalance).toBe(2450.30);
    });
  });

  describe('Caixa Econômica (CAIXA)', () => {
    const parser = new CaixaParser();

    it('deve parsear compra na Caixa e saldo disponível', () => {
      const parsed = parser.parse(
        'CAIXA',
        'CAIXA: Compra aprovada R$ 42,00 em SUPERMERCADO no cartao final 9876. Saldo disponível: R$ 920,00'
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(42.00);
      expect(parsed?.merchant).toBe('SUPERMERCADO');
      expect(parsed?.detectedBalance).toBe(920.00);
    });
  });

  describe('Banco Santander', () => {
    const parser = new SantanderParser();

    it('deve parsear compra no Santander SX e saldo em conta', () => {
      const parsed = parser.parse(
        'Santander',
        'Santander: Compra aprovada de R$ 95,00 no cartao SX final 4321 em POSTO SHELL. Saldo em conta: R$ 1.150,00'
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(95.00);
      expect(parsed?.merchant).toBe('POSTO SHELL');
      expect(parsed?.detectedBalance).toBe(1150.00);
    });
  });

  describe('Banco Inter', () => {
    const parser = new InterParser();

    it('deve parsear compra Inter e saldo da conta', () => {
      const parsed = parser.parse(
        'Banco Inter',
        'Inter: Compra de R$ 38,90 aprovada no Inter Mastercard em IFOOD. Seu saldo é R$ 850,20'
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(38.90);
      expect(parsed?.merchant).toBe('IFOOD');
      expect(parsed?.detectedBalance).toBe(850.20);
    });

    it('deve parsear notificação real do Inter com acaba de comprar e cartão final', () => {
      const parsed = parser.parse(
        'Compra no crédito',
        'Olá, Felipe. Você acaba de comprar R$ 4,49 em PAYPAL *STEAM GAMES. A compra foi no crédito nacional, com o cartão final 5023.',
        'br.com.intermedium'
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.bankId).toBe('inter');
      expect(parsed?.bankName).toBe('Banco Inter');
      expect(parsed?.amount).toBe(4.49);
      expect(parsed?.merchant).toBe('PAYPAL *STEAM GAMES');
      expect(parsed?.type).toBe('expense');
      expect(parsed?.paymentMethod).toBe('credit');
      expect(parsed?.cardLastDigits).toBe('5023');
    });
  });

  describe('C6 Bank', () => {
    const parser = new C6Parser();

    it('deve parsear compra C6 Bank e saldo em conta', () => {
      const parsed = parser.parse(
        'C6 Bank',
        'C6 Bank: Compra aprovada no valor de R$ 72,00 em UBER TRIP. Saldo em conta: R$ 2.100,00'
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(72.00);
      expect(parsed?.merchant).toBe('UBER TRIP');
      expect(parsed?.detectedBalance).toBe(2100.00);
    });
  });

  describe('Mercado Pago', () => {
    const parser = new MercadoPagoParser();

    it('deve parsear pagamento Mercado Pago e saldo disponível', () => {
      const parsed = parser.parse(
        'Mercado Pago',
        'Mercado Pago: Você pagou R$ 45,00 em PADARIA CENTRAL. Saldo disponível: R$ 560,00'
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(45.00);
      expect(parsed?.merchant).toBe('PADARIA CENTRAL');
      expect(parsed?.detectedBalance).toBe(560.00);
    });
  });

  describe('PicPay', () => {
    const parser = new PicPayParser();

    it('deve parsear pagamento PicPay e saldo em carteira', () => {
      const parsed = parser.parse(
        'PicPay',
        'PicPay: Pagamento de R$ 35,00 aprovado em RESTAURANTE ABC. Saldo em carteira: R$ 340,00'
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.amount).toBe(35.00);
      expect(parsed?.merchant).toBe('RESTAURANTE ABC');
      expect(parsed?.detectedBalance).toBe(340.00);
    });
  });

  describe('NotificationEngine Geral', () => {
    const engine = new NotificationEngine();

    it('deve orquestrar e encontrar o parser correto automaticamente', () => {
      const bbResult = engine.processNotification(
        'Banco do Brasil',
        'BB: Compra aprovada de R$ 120,00 em LOJA ROUPA'
      );
      expect(bbResult?.bankId).toBe('bb');

      const interResult = engine.processNotification(
        'Banco Inter',
        'Inter: Você recebeu um Pix de R$ 200,00 de PEDRO'
      );
      expect(interResult?.bankId).toBe('inter');
      expect(interResult?.type).toBe('income');
    });
  });
});
