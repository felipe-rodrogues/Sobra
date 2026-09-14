import { describe, it, expect } from 'vitest';
import { calculateBestPurchaseDay, calculateCardDateStatus } from '../src/core/cards/cardDateHelper';

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
});
