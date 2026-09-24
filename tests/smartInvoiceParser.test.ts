import { describe, it, expect } from 'vitest';
import { parseSmartInvoiceText } from '../src/core/parsers/smartInvoiceParser';

describe('SmartInvoiceParser - Reconhecedor Inteligente de Fatura e Texto Livre', () => {
  it('deve extrair lançamentos de texto digitado com data e valor', () => {
    const text = `
      12/09 iFood R$ 45,90
      14/09 Posto Shell 120,00
      18/09/2026 Drogaria Pacheco 34,50
    `;

    const rows = parseSmartInvoiceText(text);
    expect(rows).toHaveLength(3);

    expect(rows[0].cleanDescription.toLowerCase()).toContain('ifood');
    expect(rows[0].amount).toBe(45.9);
    expect(rows[0].date).toBe('2026-09-12');

    expect(rows[1].cleanDescription.toLowerCase()).toContain('shell');
    expect(rows[1].amount).toBe(120);
    expect(rows[1].date).toBe('2026-09-14');

    expect(rows[2].cleanDescription.toLowerCase()).toContain('pacheco');
    expect(rows[2].amount).toBe(34.5);
    expect(rows[2].date).toBe('2026-09-18');
  });

  it('deve identificar parcelamentos nos padrões (1/3) e 3x', () => {
    const text = `
      10/09 Obramax - Parcela 1/3 85,46
      15/09 Magazine Luiza 10x 89,90
      20/09 Shein (02/05) 56,99
    `;

    const rows = parseSmartInvoiceText(text);
    expect(rows).toHaveLength(3);

    // Obramax 1/3
    expect(rows[0].isInstallment).toBe(true);
    expect(rows[0].installmentNumber).toBe(1);
    expect(rows[0].installmentTotal).toBe(3);
    expect(rows[0].amount).toBe(85.46);

    // Magazine Luiza 10x
    expect(rows[1].isInstallment).toBe(true);
    expect(rows[1].installmentTotal).toBe(10);
    expect(rows[1].amount).toBe(89.9);

    // Shein (02/05)
    expect(rows[2].isInstallment).toBe(true);
    expect(rows[2].installmentNumber).toBe(2);
    expect(rows[2].installmentTotal).toBe(5);
    expect(rows[2].amount).toBe(56.99);
  });

  it('deve identificar quitação de fatura e marcar como pagamento recebido', () => {
    const text = `
      02 OUT NUBANK PAGAMENTO RECEBIDO -2.135,82
      05 OUT Paiva Hortifruti 28,00
    `;

    const rows = parseSmartInvoiceText(text);
    expect(rows).toHaveLength(2);

    expect(rows[0].isInvoicePayment).toBe(true);
    expect(rows[0].type).toBe('income');
    expect(rows[0].amount).toBe(2135.82);

    expect(rows[1].isInvoicePayment).toBe(false);
    expect(rows[1].type).toBe('expense');
    expect(rows[1].amount).toBe(28);
  });

  it('deve lidar com linhas sem data explícita usando data fallback', () => {
    const text = `
      Uber Viagem 23,50
      Padaria do Bairro 14,00
    `;

    const rows = parseSmartInvoiceText(text, '2026-09-23');
    expect(rows).toHaveLength(2);
    expect(rows[0].amount).toBe(23.5);
    expect(rows[0].date).toBe('2026-09-23');
    expect(rows[1].amount).toBe(14);
  });

  it('deve ignorar ruídos e cabeçalhos de fatura bancária', () => {
    const text = `
      FATURA DE CARTÃO DE CRÉDITO
      VENCIMENTO: 08/10/2026
      TOTAL DA FATURA: R$ 4.200,00
      LIMITE DISPONÍVEL: R$ 900,00
      Página 1 de 2
      05/09 PAIVA HORTIFRUTI 28,00
      06/09 SERVI SUPERMERCADOS 6,86
    `;

    const rows = parseSmartInvoiceText(text);
    expect(rows).toHaveLength(2);
    expect(rows[0].amount).toBe(28);
    expect(rows[1].amount).toBe(6.86);
  });
});
