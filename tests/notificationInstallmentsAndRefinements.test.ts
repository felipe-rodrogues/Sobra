import { describe, it, expect } from 'vitest';
import { detectInstallments } from '../src/core/parsers/installmentDetector';
import { cleanMerchantName } from '../src/core/categorization/merchantCleaner';
import { PicPayParser } from '../src/core/parsers/picpayParser';
import { NotificationEngine } from '../src/core/parsers/notificationEngine';
import { Category } from '../src/core/types';

describe('Intelligent Installment Detection (installmentDetector)', () => {
  it('deve detectar parcelamento com contagem e valor da parcela ("em 10x de R$ 120,00")', () => {
    const result = detectInstallments('Compra aprovada de R$ 1.200,00 em 10x de R$ 120,00 na LOJA ABC');
    expect(result).not.toBeNull();
    expect(result?.isInstallment).toBe(true);
    expect(result?.installmentCount).toBe(10);
    expect(result?.installmentAmount).toBe(120);
    expect(result?.totalAmount).toBe(1200);
  });

  it('deve calcular valor da parcela quando a notificação informar total e contagem ("R$ 300,00 em 3x")', () => {
    const result = detectInstallments('Compra de R$ 300,00 em 3x aprovada', 300);
    expect(result).not.toBeNull();
    expect(result?.isInstallment).toBe(true);
    expect(result?.installmentCount).toBe(3);
    expect(result?.totalAmount).toBe(300);
    expect(result?.installmentAmount).toBe(100);
  });

  it('deve detectar padrão de parcelas explícitas ("12 parcelas de R$ 50,00")', () => {
    const result = detectInstallments('Lançamento de 12 parcelas de R$ 50,00 no cartão final 4321');
    expect(result).not.toBeNull();
    expect(result?.isInstallment).toBe(true);
    expect(result?.installmentCount).toBe(12);
    expect(result?.installmentAmount).toBe(50);
    expect(result?.totalAmount).toBe(600);
  });

  it('deve detectar padrão de fração de parcela ("parcela 02/05")', () => {
    const result = detectInstallments('Compra aprovada: parcela 02/05 de R$ 75,00 em RESTAURANTE', 75);
    expect(result).not.toBeNull();
    expect(result?.isInstallment).toBe(true);
    expect(result?.installmentNumber).toBe(2);
    expect(result?.installmentCount).toBe(5);
    expect(result?.installmentAmount).toBe(75);
  });

  it('não deve marcar compra à vista comum como parcelamento', () => {
    const result = detectInstallments('Compra aprovada de R$ 85,00 no Débito em FARMACIA PAGUEMENOS');
    expect(result).toBeNull();
  });
});

describe('Merchant Cleaner (merchantCleaner)', () => {
  it('deve remover sufixos de status como APROVADA e pontuações', () => {
    expect(cleanMerchantName('Mega Pet House APROVADA.')).toBe('Mega Pet House');
    expect(cleanMerchantName('SUPERMERCADO EXTRA APROVADO')).toBe('SUPERMERCADO EXTRA');
    expect(cleanMerchantName('MERCADO LIVRE AUTORIZADA')).toBe('MERCADO LIVRE');
    expect(cleanMerchantName('POSTO IPIRANGA CONFIRMADA')).toBe('POSTO IPIRANGA');
  });

  it('deve remover sufixos de modalidade de pagamento', () => {
    expect(cleanMerchantName('FARMACIA POPULAR NO CREDITO')).toBe('FARMACIA POPULAR');
    expect(cleanMerchantName('RESTAURANTE SABOR NO DEBITO')).toBe('RESTAURANTE SABOR');
  });

  it('deve preservar estabelecimentos limpos', () => {
    expect(cleanMerchantName('Padaria Estrela')).toBe('Padaria Estrela');
    expect(cleanMerchantName('Uber *Trip')).toBe('Uber Trip');
  });
});

describe('PicPay Parser Enhancements', () => {
  const parser = new PicPayParser();

  it('deve reconhecer compra no cartão de crédito PicPay sem marcar como pix', () => {
    const parsed = parser.parse(
      'PicPay Card',
      'Compra de R$ 94,50 aprovada no seu PicPay Card de crédito em LOJA TESTE'
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(94.50);
    expect(parsed?.merchant).toBe('LOJA TESTE');
    expect(parsed?.paymentMethod).toBe('credit');
    expect(parsed?.type).toBe('expense');
  });

  it('deve reconhecer notificação de cashback como receita', () => {
    const parsed = parser.parse(
      'Você ganhou cashback!',
      'Você ganhou R$ 12,50 de cashback da sua compra.'
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(12.50);
    expect(parsed?.type).toBe('income');
    expect(parsed?.merchant).toBe('PicPay (Cashback)');
  });

  it('deve reconhecer Pix recebido no PicPay', () => {
    const parsed = parser.parse(
      'Pix recebido',
      'Você recebeu um Pix de R$ 250,00 de Carlos Silva'
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(250.00);
    expect(parsed?.type).toBe('income');
    expect(parsed?.paymentMethod).toBe('pix');
  });
});

describe('NotificationEngine with Installments & SMS Support', () => {
  const dummyCategories: Category[] = [
    { id: 'cat-1', name: 'Alimentação', icon: 'Utensils', color: '#10B981', isCustom: false, type: 'expense', createdAt: '' },
    { id: 'cat-2', name: 'Compras', icon: 'ShoppingBag', color: '#3B82F6', isCustom: false, type: 'expense', createdAt: '' },
  ];

  const engine = new NotificationEngine();

  it('deve processar notificação com parcelamento detectado', () => {
    const result = engine.processNotification(
      'Nubank',
      'Compra de R$ 1.200,00 em 10x de R$ 120,00 aprovada na FAST SHOP',
      'com.nu.production'
    );

    expect(result).not.toBeNull();
    expect(result?.amount).toBe(1200);
    expect(result?.isInstallment).toBe(true);
    expect(result?.installmentCount).toBe(10);
    expect(result?.installmentAmount).toBe(120);
    expect(result?.merchant).toBe('FAST SHOP');
  });

  it('deve sinalizar notificação originada de SMS', () => {
    const result = engine.processNotification(
      'Banco Inter',
      'Inter: Compra aprovada no cartao final 1234 de R$ 45,00 em DROGARIA ARAUJO',
      'com.google.android.apps.messaging'
    );

    expect(result).not.toBeNull();
    expect(result?.isFromSms).toBe(true);
    expect(result?.amount).toBe(45);
    expect(result?.merchant).toBe('DROGARIA ARAUJO');
  });
});
