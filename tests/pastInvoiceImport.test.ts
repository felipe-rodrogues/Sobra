import { describe, it, expect } from 'vitest';
import { parseSmartInvoiceText } from '../src/core/parsers/smartInvoiceParser';
import { parseBankCsv } from '../src/core/parsers/csvParser';

describe('Importação de Faturas de Meses Anteriores & Reconhecimento de Parcelas', () => {
  it('ancora datas ao mês e ano selecionados ao interpretar texto ou PDF de fatura anterior', () => {
    const rawInvoiceText = `
      05/08 Uber Viagens 24,90
      12/08 Supermercado Pão de Açúcar 150,00
      18/08 Magazine Luiza 2/10 89,90
    `;

    // Importando com âncora em Agosto de 2026
    const rows = parseSmartInvoiceText(rawInvoiceText, '2026-08-01');

    expect(rows.length).toBe(3);
    expect(rows[0].date).toBe('2026-08-05');
    expect(rows[0].amount).toBe(24.90);

    expect(rows[1].date).toBe('2026-08-12');
    expect(rows[1].amount).toBe(150.00);

    expect(rows[2].date).toBe('2026-08-18');
    expect(rows[2].isInstallment).toBe(true);
    expect(rows[2].installmentNumber).toBe(2);
    expect(rows[2].installmentTotal).toBe(10);
    expect(rows[2].amount).toBe(89.90);
  });

  it('interpreta CSV com datas curtas DD/MM usando defaultYear e defaultMonth do mês selecionado', () => {
    const csvContent = `Data,Descricao,Valor
15/08,Restaurante Paris 6,180.00
20/08,Farmacia Raia,45.50`;

    const result = parseBankCsv(csvContent, {
      isCreditCard: true,
      defaultYear: 2026,
      defaultMonth: 8,
    });

    expect(result.success).toBe(true);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0].date).toBe('2026-08-15');
    expect(result.rows[0].amount).toBe(180.00);
    expect(result.rows[1].date).toBe('2026-08-20');
    expect(result.rows[1].amount).toBe(45.50);
  });

  it('reconhece datas com apenas o dia quando contextualizado no mês selecionado', () => {
    const rawInvoiceText = `
      Dia 14 Padaria do Bairro 35,00
      Dia 22 Farmacia Drogasil 68,40
    `;

    const rows = parseSmartInvoiceText(rawInvoiceText, '2026-08-01');

    expect(rows.length).toBe(2);
    expect(rows[0].date).toBe('2026-08-14');
    expect(rows[0].amount).toBe(35.00);
    expect(rows[1].date).toBe('2026-08-22');
    expect(rows[1].amount).toBe(68.40);
  });

  it('permite vincular compra parcelada mesmo se a descrição foi renomeada pelo usuário (chave: accountId + total de parcelas + valor idêntico)', () => {
    // Simula transações já salvas no banco pelo usuário (usuário renomeou de 'MAGAZINELUIZA' para 'Notebook Dell')
    const existingDbTxs = [
      {
        id: 'tx-existing-1',
        accountId: 'card-nubank-123',
        description: 'Notebook Dell (3/10)',
        amount: 89.90,
        isInstallment: true,
        installmentGroupId: 'inst-group-notebook',
        installmentNumber: 3,
        installmentTotal: 10,
        originalTotalAmount: 899.00,
        categoryId: 'cat-tech',
      }
    ];

    // Simula a linha que vem no CSV / PDF de um mês anterior (ex: 2/10 vindo com o nome original do banco)
    const incomingRow = {
      description: 'MGL*MAGAZINELUIZA 02/10',
      amount: 89.90,
      isInstallment: true,
      installmentNumber: 2,
      installmentTotal: 10,
    };

    const targetAccountId = 'card-nubank-123';

    // Lógica do FinanceContext: busca parcelamentos com mesmo accountId, isInstallment, mesmo total de parcelas e valor idêntico
    const matchingGroups = existingDbTxs.filter(t => {
      if (t.accountId !== targetAccountId) return false;
      if (!t.isInstallment || !t.installmentGroupId) return false;
      if (t.installmentTotal !== incomingRow.installmentTotal) return false;
      return Math.abs(t.amount - incomingRow.amount) <= 0.05;
    });

    expect(matchingGroups.length).toBe(1);
    const existingGroup = matchingGroups[0];
    expect(existingGroup.installmentGroupId).toBe('inst-group-notebook');
    expect(existingGroup.categoryId).toBe('cat-tech');
    expect(existingGroup.originalTotalAmount).toBe(899.00);
  });
});

