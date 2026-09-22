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

    it('deve detectar cashback PicPay com notificationKind correto', () => {
      const parsed = parser.parse(
        'PicPay',
        'Você ganhou R$ 1,50 de cashback da sua compra. Continue comprando para ganhar mais!'
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.notificationKind).toBe('cashback');
      expect(parsed?.type).toBe('income');
      expect(parsed?.amount).toBe(1.50);
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

    it('deve rejeitar notificações promocionais e de propaganda bancária', () => {
      const promo1 = engine.processNotification(
        'Felipe, seu Pix no Crédito te espera 💳',
        'Continue pagando no seu tempo com o limite do cartão, sem mexer no seu saldo.',
        'com.mercadopago.wallet'
      );
      expect(promo1).toBeNull();

      const promo2 = engine.processNotification(
        'Nubank',
        'Você tem um empréstimo pré-aprovado de até R$ 15.000 disponível! Simule agora.',
        'com.nu.production'
      );
      expect(promo2).toBeNull();

      const promo3 = engine.processNotification(
        'Banco Inter',
        'Invista a partir de R$ 1,00 no novo CDB e concorra a prêmios!',
        'br.com.intermedium'
      );
      expect(promo3).toBeNull();

      const info1 = engine.processNotification(
        'Itaú',
        'Novo acesso detectado em seu aparelho. Código de verificação enviado.',
        'com.itau'
      );
      expect(info1).toBeNull();
    });

    // ── Novos casos de teste baseados nos cenários reais reportados ──

    it('[REAL] deve rejeitar notificação de empréstimo aprovado Mercado Pago (cenário do print)', () => {
      // Notificação real capturada pelo usuário que virou "Compra de R$ 230"
      const result = engine.processNotification(
        'Compra no Mercado Pago: R$ 230,00',
        'Seu empréstimo foi aprovado! 🤑 Você tem um crédito de R$230 disponível. Toque aqui para simular.',
        'com.mercadopago.wallet'
      );
      expect(result).toBeNull();
    });

    it('[REAL] deve detectar cashback Mercado Pago com notificationKind = cashback (não income/expense)', () => {
      // "Você ganhou R$ 0,02 de cashback - Continue usando seu Cartão de Crédito Mercado Pago"
      const result = engine.processNotification(
        'Mercado Pago',
        'Você ganhou R$ 0,02 de cashback - Continue usando seu Cartão de Crédito Mercado Pago para ganhar mais.',
        'com.mercadopago.wallet'
      );
      expect(result).not.toBeNull();
      expect(result?.notificationKind).toBe('cashback');
      expect(result?.type).toBe('income');
      expect(result?.amount).toBe(0.02);
    });

    it('[REAL] deve parsear compra Mercado Pago com preposição "a" (ex: PG *99 RIDE)', () => {
      // "Você pagou R$ 3,40 a PG *99 RIDE - O valor vai entrar na próxima fatura do seu..."
      const result = engine.processNotification(
        'Compra no Mercado Pago:...',
        'Você pagou R$ 3,40 a PG *99 RIDE - O valor vai entrar na próxima fatura do seu Cartão Mercado Pago.',
        'com.mercadopago.wallet'
      );
      expect(result).not.toBeNull();
      expect(result?.type).toBe('expense');
      expect(result?.notificationKind).toBe('expense');
      expect(result?.amount).toBe(3.40);
      // O merchant não deve ser "simular", "ver" ou verbos genéricos
      expect(result?.merchant.toLowerCase()).not.toMatch(/^(simular|ver|conferir|agora|aqui)$/);
    });

    it('[REAL] deve rejeitar lembrete Pagaleve sem movimentação real', () => {
      // "Lembrete Pagaleve: Oiê! Vem fazer um pix e antecipe sua parcela."
      const result = engine.processNotification(
        'Lembrete Pagaleve 📅',
        'Oiê! Vem fazer um pix e antecipe sua parcela.',
        'com.pagaleve'
      );
      expect(result).toBeNull();
    });

    it('deve rejeitar fatura fechando (não é pagamento real)', () => {
      const result = engine.processNotification(
        'Nubank',
        'Sua fatura de R$ 1.840,00 fechou. Vencimento dia 10. Pague agora e evite juros.',
        'com.nu.production'
      );
      expect(result).toBeNull();
    });

    it('deve rejeitar transação recusada por saldo insuficiente', () => {
      const result = engine.processNotification(
        'Nubank',
        'Compra de R$ 350,00 não autorizada em LOJA XYZ. Saldo insuficiente.',
        'com.nu.production'
      );
      expect(result).toBeNull();
    });

    it('deve detectar reembolso/estorno com notificationKind = refund', () => {
      const result = engine.processNotification(
        'Mercado Pago',
        'Reembolso de R$ 45,00 creditado em sua conta. Compra cancelada com sucesso.',
        'com.mercadopago.wallet'
      );
      expect(result).not.toBeNull();
      expect(result?.notificationKind).toBe('refund');
      expect(result?.amount).toBe(45.00);
    });

    it('deve rejeitar notificação sem verbo de ação financeira conclusiva no parser genérico', () => {
      // Ex: "Olá! Seu saldo é R$ 500,00." — sem verbo de compra/receita
      const result = engine.processNotification(
        'Banco XYZ',
        'Olá! Seu saldo é R$ 500,00. Acesse o app para ver seu extrato.',
        'com.bancoxyz.app'
      );
      // Deve retornar null pois não há verbo conclusivo e a confiança seria baixa
      expect(result).toBeNull();
    });

    it('deve detectar cashback Nubank com notificationKind correto', () => {
      const result = engine.processNotification(
        'Nubank',
        'Você recebeu R$ 12,50 de cashback da Nubank Rewards! Aproveite.',
        'com.nu.production'
      );
      expect(result).not.toBeNull();
      expect(result?.notificationKind).toBe('cashback');
      expect(result?.amount).toBe(12.50);
    });

    it('deve detectar estorno Nubank com notificationKind refund', () => {
      const result = engine.processNotification(
        'Nubank',
        'Estorno de R$ 89,90 de FAST SHOP aprovado e creditado na sua fatura.',
        'com.nu.production'
      );
      expect(result).not.toBeNull();
      expect(result?.notificationKind).toBe('refund');
      expect(result?.amount).toBe(89.90);
    });
  });
});

