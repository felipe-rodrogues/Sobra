import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseInvoicePdf, parseSmartInvoiceText } from '../src/core/parsers/smartInvoiceParser';
import { extractTextFromPdf } from '../src/core/parsers/pdfInvoiceParser';

describe('Universal Invoice Parser Test across All 3 Real Invoices (Production Code)', () => {
  const picpayPath = 'C:/Users/Felipe-PC/.gemini/antigravity-ide/brain/242d7d93-8eca-4be4-98c1-60302591fddd/.user_uploaded/media_1791351371007.pdf';
  const interPath = 'C:/Users/Felipe-PC/.gemini/antigravity-ide/brain/242d7d93-8eca-4be4-98c1-60302591fddd/.user_uploaded/media_1791347688468.pdf';
  const mpPath = 'C:/Users/Felipe-PC/.gemini/antigravity-ide/brain/242d7d93-8eca-4be4-98c1-60302591fddd/.user_uploaded/media_1791144880004.pdf';

  it('correctly parses PicPay invoice via parseInvoicePdf to exactly R$ 1.142,07', async () => {
    const buffer = fs.readFileSync(picpayPath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    const rows = await parseInvoicePdf(arrayBuffer);
    console.log('--- ROWS WITHOUT DEFAULT DATE ---', rows.length);
    const suspicious = rows.filter(r => r.amount === 1142.07 || r.amount === 1699.93 || r.description.includes('11.250') || r.description.includes('próximas'));
    console.log('Suspicious rows:', suspicious);

    const payment = rows.find(p => p.isInvoicePayment);
    expect(payment).toBeDefined();
    expect(payment?.amount).toBe(2036.51);

    const expenses = rows.filter(p => !p.isInvoicePayment);
    const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);

    expect(expenses.length).toBe(47);
    expect(Math.round(totalExpenses * 100) / 100).toBe(1142.07);

    // Verifica se os cartões (titular 9036 e adicional 9044) foram devidamente rastreados
    const card9036Rows = rows.filter(r => r.cardLastDigits === '9036');
    expect(card9036Rows.length).toBeGreaterThan(15);

    const card9044Rows = rows.filter(r => r.cardLastDigits === '9044');
    expect(card9044Rows.length).toBe(2); // SHEIN compras de Jessica Alves
  });

  it('correctly parses Banco Inter invoice via parseInvoicePdf to exactly R$ 1.354,65', async () => {
    const buffer = fs.readFileSync(interPath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    const rows = await parseInvoicePdf(arrayBuffer, '2026-09-01');

    const expenses = rows.filter(p => !p.isInvoicePayment);
    expect(expenses.length).toBe(21);
    const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
    expect(Math.round(totalExpenses * 100) / 100).toBe(1354.65);
  });

  it('correctly parses Mercado Pago invoice via parseInvoicePdf to exactly R$ 883,51', async () => {
    const buffer = fs.readFileSync(mpPath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    const rows = await parseInvoicePdf(arrayBuffer, '2026-10-03');

    const payment = rows.find(p => p.isInvoicePayment);
    expect(payment).toBeDefined();
    expect(payment?.amount).toBe(735.77);

    const expenses = rows.filter(p => !p.isInvoicePayment);
    expect(expenses.length).toBe(24);
    const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
    expect(Math.round(totalExpenses * 100) / 100).toBe(883.51);
  });
});
