import { describe, it, expect } from 'vitest';
import { calculateBestPurchaseDay, calculateCardDateStatus, getCardActiveInvoiceInfo } from '../src/core/cards/cardDateHelper';

describe('cardDateHelper', () => {
  it('calcula corretamente o melhor dia de compra', () => {
    // Dia seguinte ao fechamento
    expect(calculateBestPurchaseDay(1)).toBe(2);
    expect(calculateBestPurchaseDay(10)).toBe(11);
    expect(calculateBestPurchaseDay(25)).toBe(26);
    // Virada de mês
    expect(calculateBestPurchaseDay(31)).toBe(1);
    expect(calculateBestPurchaseDay(0)).toBe(1);
  });

  it('determina fatura aberta quando a data atual é anterior ao fechamento', () => {
    // Referência: 15 de Maio. Fechamento dia 20, Vencimento dia 28.
    const refDate = new Date(2026, 4, 15); // Maio (mês 4 zero-indexed)
    const status = calculateCardDateStatus(20, 28, refDate);

    expect(status.isInvoiceClosed).toBe(false);
    expect(status.daysUntilClosing).toBe(5);
    expect(status.statusText).toContain('Fecha em 5 dias');
    expect(status.bestPurchaseDay).toBe(21);
    expect(status.bestPurchaseDayFormatted).toBe('Dia 21');
  });

  it('determina fatura fechada quando a data atual é igual ou posterior ao fechamento', () => {
    // Referência: 22 de Maio. Fechamento dia 20, Vencimento dia 28.
    const refDate = new Date(2026, 4, 22);
    const status = calculateCardDateStatus(20, 28, refDate);

    expect(status.isInvoiceClosed).toBe(true);
    expect(status.daysUntilDue).toBe(6);
    expect(status.statusText).toContain('Fatura fechada • Vence em 6 dias');
  });

  it('avisa quando a fatura vence hoje', () => {
    // Referência: 28 de Maio. Fechamento dia 20, Vencimento dia 28.
    const refDate = new Date(2026, 4, 28);
    const status = calculateCardDateStatus(20, 28, refDate);

    expect(status.isInvoiceClosed).toBe(true);
    expect(status.daysUntilDue).toBe(0);
    expect(status.statusText).toContain('Vence hoje');
    expect(status.statusBadgeVariant).toBe('warning');
  });

  it('determina fatura vencida quando a data atual passou do vencimento e há saldo a pagar', () => {
    // Referência: 13 de Setembro. Fechamento dia 01, Vencimento dia 07. Fatura R$ 200 pendente.
    const refDate = new Date(2026, 8, 13);
    const status = calculateCardDateStatus(1, 7, refDate, 200, 'closed', 600);

    expect(status.isInvoiceClosed).toBe(true);
    expect(status.displayStatus).toBe('overdue');
    expect(status.statusLabel).toBe('Vencida');
    expect(status.statusBadgeVariant).toBe('danger');
    expect(status.statusText).toContain('Fatura vencida há 6 dias');
    expect(status.cycleClosingDateFormatted).toBe('01/SET');
    expect(status.cycleDueDateFormatted).toBe('07/SET');
  });

  it('avança para o próximo ciclo sem alarme de vencimento quando a fatura é R$ 0,00', () => {
    // Referência: 13 de Setembro. Fechamento dia 02, Vencimento dia 10. Fatura zerada R$ 0,00.
    const refDate = new Date(2026, 8, 13);
    const status = calculateCardDateStatus(2, 10, refDate, 0, 'open', 0);

    expect(status.isInvoiceClosed).toBe(false);
    expect(status.displayStatus).toBe('zero');
    expect(status.statusLabel).toBe('Em dia');
    expect(status.statusBadgeVariant).toBe('success');
    expect(status.statusText).toContain('Sem pendências');
    expect(status.statusText).toContain('Fecha em 19 dias');
    expect(status.cycleClosingDateFormatted).toBe('02/OUT');
    expect(status.cycleDueDateFormatted).toBe('10/OUT');
  });

  it('reconhece fatura quitada e avança para o próximo fechamento', () => {
    // Referência: 13 de Setembro. Fechamento dia 01, Vencimento dia 07. Fatura paga.
    const refDate = new Date(2026, 8, 13);
    const status = calculateCardDateStatus(1, 7, refDate, 0, 'paid', 400);

    expect(status.isInvoiceClosed).toBe(false);
    expect(status.displayStatus).toBe('paid');
    expect(status.statusLabel).toBe('Paga');
    expect(status.statusBadgeVariant).toBe('success');
    expect(status.statusText).toContain('Fatura paga');
    expect(status.statusText).toContain('Próx. fecha em 18 dias');
  });

  it('determina fatura de Setembro como aberta quando vence no dia 10 do próximo mês (Outubro)', () => {
    // Hoje: 30 de Setembro. Fechamento dia 01, Vencimento dia 10. Fatura de Setembro (mês 9, ano 2026).
    const refDate = new Date(2026, 8, 30);
    const status = calculateCardDateStatus(1, 10, refDate, 2161.81, 'closed', 0, 9, 2026);

    expect(status.displayStatus).toBe('open');
    expect(status.statusLabel).toBe('Fecha amanhã');
    expect(status.daysUntilDue).toBe(10);
    expect(status.cycleDueDateFormatted).toBe('10/OUT');
    expect(status.cycleClosingDateFormatted).toBe('01/OUT');
  });

  it('determina fatura de mês anterior como vencida caso tenha passado do vencimento sem pagamento', () => {
    // Hoje: 30 de Setembro. Fechamento dia 01, Vencimento dia 10. Fatura de Agosto (mês 8, ano 2026) que venceu 10/SET.
    const refDate = new Date(2026, 8, 30);
    const status = calculateCardDateStatus(1, 10, refDate, 500, 'closed', 0, 8, 2026);

    expect(status.displayStatus).toBe('overdue');
    expect(status.statusLabel).toBe('Vencida');
    expect(status.daysUntilDue).toBe(-20);
    expect(status.statusText).toContain('Fatura vencida há 20 dias');
  });

  it('determina corretamente a fatura em foco ao desfazer pagamento (foco na fatura fechada no dia 1 e a vencer)', () => {
    // Nubank com fechamento dia 1 e vencimento dia 8.
    // Hoje é dia 01/10/2026. A fatura de Setembro fechou hoje e vence dia 08/10/2026.
    const card = {
      id: 'nu-1',
      name: 'Nubank',
      type: 'credit_card' as const,
      closingDay: 1,
      dueDay: 8,
      isShared: true,
      splitRatio: 0.5,
      invoiceStatus: 'closed' as const,
      invoiceAmount: 2161.81,
      balance: 2161.81,
    } as any;

    const txs = [
      {
        id: 't1',
        accountId: 'nu-1',
        amount: 2161.81,
        type: 'expense' as const,
        description: 'Compras Setembro',
        date: '2026-09-20T12:00:00.000Z',
        status: 'confirmed' as const,
      },
      {
        id: 't2',
        accountId: 'nu-1',
        amount: 325.95,
        type: 'expense' as const,
        description: 'Compras Outubro',
        date: '2026-10-01T12:00:00.000Z',
        status: 'confirmed' as const,
      },
    ] as any;

    // Caso 1: Pagamento desfeito -> fatura 'closed' (não paga)
    const activeUnpaid = getCardActiveInvoiceInfo(card, txs, new Date(2026, 9, 1));
    expect(activeUnpaid.month).toBe(9); // Setembro
    expect(activeUnpaid.year).toBe(2026);
    expect(activeUnpaid.monthOffset).toBe(-1);
    expect(activeUnpaid.status).toBe('closed');
    expect(activeUnpaid.totalAmount).toBe(2161.81);
    expect(activeUnpaid.userAmount).toBe(1080.91);
    expect(activeUnpaid.dueDateFormatted).toBe('8 de Outubro');

    // Caso 2: Fatura paga -> foco avança para a fatura aberta do mês atual
    const cardPaid = { ...card, invoiceStatus: 'paid' as const, invoiceAmount: 0 };
    const activePaid = getCardActiveInvoiceInfo(cardPaid, txs, new Date(2026, 9, 1));
    expect(activePaid.month).toBe(10); // Outubro
    expect(activePaid.year).toBe(2026);
    expect(activePaid.monthOffset).toBe(0);
    expect(activePaid.status).toBe('open');
    expect(activePaid.totalAmount).toBe(325.95);
    expect(activePaid.userAmount).toBe(162.98);
    // Caso 3: Verificar que calculateCardDateStatus para Outubro NÃO marca como paga quando Setembro foi pago
    const octStatus = calculateCardDateStatus(1, 8, new Date(2026, 9, 1), 325.95, 'paid', 325.95, 10, 2026);
    expect(octStatus.displayStatus).toBe('open');
    expect(octStatus.statusLabel).toBe('Aberta');
    expect(octStatus.cycleDueDateFormatted).toBe('08/NOV');

    // E Setembro fechado deve constar como 'paid'
    const septStatus = calculateCardDateStatus(1, 8, new Date(2026, 9, 1), 2161.81, 'paid', 325.95, 9, 2026);
    expect(septStatus.displayStatus).toBe('paid');
    expect(septStatus.statusLabel).toBe('Paga');
    expect(septStatus.cycleDueDateFormatted).toBe('08/OUT');
  });
});


