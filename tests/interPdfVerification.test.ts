import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseInvoicePdf } from '../src/core/parsers/smartInvoiceParser';

describe('Real PDF Verification - Banco Inter End-to-End', () => {
  const pdfPath = 'C:/Users/Felipe-PC/.gemini/antigravity-ide/brain/242d7d93-8eca-4be4-98c1-60302591fddd/.user_uploaded/media_1791347688468.pdf';

  it('deve extrair e processar perfeitamente a fatura do Banco Inter via parseInvoicePdf', async () => {
    const buffer = fs.readFileSync(pdfPath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    const rows = await parseInvoicePdf(arrayBuffer, '2026-09-01');

    console.log('--- PARSED ROWS FROM INTER PDF ---');
    console.log('Total rows identified:', rows.length);
    rows.forEach(r => {
      console.log(`${r.date} | ${r.cleanDescription} | R$ ${r.amount} | payment=${r.isInvoicePayment} | inst=${r.isInstallment ? `${r.installmentNumber}/${r.installmentTotal}` : 'no'}`);
    });

    // 1 Pagamento de fatura anterior
    const payment = rows.find(r => r.isInvoicePayment);
    expect(payment).toBeDefined();
    expect(payment?.amount).toBe(1564.82);

    // 21 Despesas normais da fatura
    const expenses = rows.filter(r => !r.isInvoicePayment);
    expect(expenses.length).toBe(21);

    // Total de despesas deve ser exatamente R$ 1.354,65
    const totalExpense = expenses.reduce((sum, r) => sum + r.amount, 0);
    console.log('Total Expense Calculated:', totalExpense);
    expect(Math.round(totalExpense * 100) / 100).toBe(1354.65);
  });
});
