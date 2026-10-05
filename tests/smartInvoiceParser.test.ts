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

  it('deve extrair com perfeição faturas do Mercado Pago sem ruídos de limites, simulações ou taxas CET', () => {
    const mpInvoiceText = `
Felipe Rodrigues Fonseca
Emitida em: 03/10/2026
Olá, Felipe
Essa é sua fatura de outubro
Total a pagar
R$ 883,51
Vence em
07/10/2026
Limite total
R$ 7.400,00
Saque total
R$ 50,00
Parcelamento de fatura
Até 1 + 15x R$ 100,16
Pagamento mínimo
R$ 132,53
CET (Custo Efetivo Total) máximo 276,45% a.a.
Informações complementares
Resumo da fatura
Consumos de 03/09 a 02/10 R$ 883,51
Total da fatura de setembro R$ 735,77
Total R$ 883,51
Detalhes de consumo
Movimentações na fatura
Data Movimentações Valor em R$
07/09 Pagamento da fatura de setembro/2026 R$ 735,77
Cartão Visa [************7732]
Data Movimentações Valor em R$
03/09 CASA DO BISCOITO R$ 10,00
03/09 DL*99 RIDE R$ 4,00
03/09 MAIS MOBI RIOCARD R$ 20,00
03/09 00046 SH BARRA RIO JA Parcela 1 de 2 R$ 69,95
05/09 MAIS MOBI RIOCARD R$ 20,00
08/09 DL*99 RIDE R$ 3,57
09/09 MERCADOLIVRE*GHGAMES R$ 177,32
10/09 DL*99 RIDE R$ 3,48
14/09 DL *99 Ride R$ 3,74
15/09 DL*99 RIDE R$ 6,50
21/09 99Food *99Food R$ 1,00
21/09 99Food *Bastilha pending R$ 36,93
21/09 99Food *Bastilha pending R$ 38,51
21/09 DL*99 RIDE R$ 3,44
21/09 MP*MP R$ 8,08
21/09 PG *99 RIDE R$ 3,40
22/09 MP*BARBEARIA R$ 40,00
25/09 MP*MP R$ 8,36
27/09 99Food *Chefinho Gourmet R$ 29,54
28/09 DL*99 RIDE R$ 3,22
29/09 DL*99 RIDE R$ 3,22
10/06 MERCADOLIVRE*FELIPECELL Parcela 4 de 18 R$ 288,83
04/07 Steam Parcela 3 de 3 R$ 49,45
18/07 MERCADOLIVRE*MERCADOLIVRE Parcela 3 de 3 R$ 50,97
Total R$ 883,51
Parcele a fatura do seu Cartão de Crédito Mercado Pago
1 + [2]x R$ 322,09
Total: R$ 966,27
Limite utilizado R$ 4.997,08
Compras parceladas R$ 4.113,57
CET (Custo Total Efetivo) rotativo 426,35% a.a
SAC 0800 637 7246
`;

    const rows = parseSmartInvoiceText(mpInvoiceText, '2026-10-03');
    
    // Deve conter o pagamento da fatura anterior + as 24 compras reais
    expect(rows).toHaveLength(25);

    const paymentRow = rows.find(r => r.isInvoicePayment);
    expect(paymentRow).toBeDefined();
    expect(paymentRow?.amount).toBe(735.77);

    const expenseRows = rows.filter(r => !r.isInvoicePayment);
    expect(expenseRows).toHaveLength(24);

    const totalExpense = expenseRows.reduce((sum, r) => sum + r.amount, 0);
    expect(Math.round(totalExpense * 100) / 100).toBe(883.51);

    // Deve reconhecer as parcelas
    const felipecell = expenseRows.find(r => r.description.includes('FELIPECELL'));
    expect(felipecell?.isInstallment).toBe(true);
    expect(felipecell?.installmentNumber).toBe(4);
    expect(felipecell?.installmentTotal).toBe(18);
    expect(felipecell?.amount).toBe(288.83);
    // Data deve ter sido alinhada ao ciclo da fatura (mês 09), com a data original preservada
    expect(felipecell?.date).toBe('2026-09-10');
    expect(felipecell?.originalPurchaseDate).toBe('2026-06-10');
  });
});
