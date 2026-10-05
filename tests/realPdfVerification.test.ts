import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseInvoicePdf } from '../src/core/parsers/smartInvoiceParser';
import { extractTextFromPdf } from '../src/core/parsers/pdfInvoiceParser';

describe('Real PDF Verification - Mercado Pago Invoice End-to-End', () => {
  const pdfPath = 'C:/Users/Felipe-PC/.gemini/antigravity-ide/brain/242d7d93-8eca-4be4-98c1-60302591fddd/.user_uploaded/media_1791144880004.pdf';

  it('deve extrair texto e processar através do parseInvoicePdf diretamente', async () => {
    if (!fs.existsSync(pdfPath)) {
      console.log('Skipping real PDF test: artifact not present in local path');
      return;
    }
    const buffer = fs.readFileSync(pdfPath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    // Teste 1: extractTextFromPdf direto
    const text = await extractTextFromPdf(arrayBuffer);
    expect(text.length).toBeGreaterThan(100);

    // Teste 2: parseInvoicePdf fim a fim
    const rows = await parseInvoicePdf(arrayBuffer, '2026-10-03');
    expect(rows).toBeDefined();
    expect(rows.length).toBe(25);

    const payment = rows.find(r => r.isInvoicePayment);
    expect(payment).toBeDefined();
    expect(payment?.amount).toBe(735.77);

    const expenses = rows.filter(r => !r.isInvoicePayment);
    expect(expenses.length).toBe(24);

    const totalExpense = expenses.reduce((sum, r) => sum + r.amount, 0);
    expect(Math.round(totalExpense * 100) / 100).toBe(883.51);

    // Verifica se as parcelas foram devidamente reconhecidas
    const parcelas = expenses.filter(e => e.isInstallment);
    expect(parcelas.length).toBe(4);

    // 1. SH BARRA Parcela 1 de 2: R$ 69,95
    const shBarra = parcelas.find(p => p.description.includes('SH BARRA'));
    expect(shBarra).toBeDefined();
    expect(shBarra?.installmentNumber).toBe(1);
    expect(shBarra?.installmentTotal).toBe(2);
    expect(shBarra?.amount).toBe(69.95);

    // 2. FELIPECELL Parcela 4 de 18: R$ 288,83
    const felipecell = parcelas.find(p => p.description.includes('FELIPECELL'));
    expect(felipecell).toBeDefined();
    expect(felipecell?.installmentNumber).toBe(4);
    expect(felipecell?.installmentTotal).toBe(18);
    expect(felipecell?.amount).toBe(288.83);
    expect(felipecell?.date).toBe('2026-09-10');
    expect(felipecell?.originalPurchaseDate).toBe('2026-06-10');

    // 3. Steam Parcela 3 de 3: R$ 49,45 (última parcela)
    const steam = parcelas.find(p => p.description.includes('Steam'));
    expect(steam).toBeDefined();
    expect(steam?.installmentNumber).toBe(3);
    expect(steam?.installmentTotal).toBe(3);
    expect(steam?.amount).toBe(49.45);

    // 4. MERCADOLIVRE Parcela 3 de 3: R$ 50,97 (última parcela)
    const ml = parcelas.find(p => p.description.includes('MERCADOLIVRE') && p.installmentTotal === 3);
    expect(ml).toBeDefined();
    expect(ml?.installmentNumber).toBe(3);
    expect(ml?.installmentTotal).toBe(3);
    expect(ml?.amount).toBe(50.97);
  });
});
