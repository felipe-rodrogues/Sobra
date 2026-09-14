/**
 * Sobra - Inteligência de Datas de Cartão de Crédito
 * Cálculos de melhor dia de compra, status da fatura (aberta/fechada) e contagem regressiva
 */

import { CardDateStatus } from '../types';

/**
 * Calcula o melhor dia de compra (geralmente o dia seguinte ao fechamento da fatura).
 * Nesse dia, a compra só constará na fatura do mês subsequente, garantindo até 40 dias de prazo.
 */
export function calculateBestPurchaseDay(closingDay: number): number {
  if (!closingDay || closingDay < 1) return 1;
  if (closingDay >= 31) return 1;
  return closingDay + 1;
}

const MONTH_NAMES_SHORT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/**
 * Calcula o status detalhado da fatura do cartão com base nos dias de fechamento, vencimento,
 * valor da fatura e status de pagamento.
 */
export function calculateCardDateStatus(
  closingDay: number = 1,
  dueDay: number = 8,
  referenceDate: Date = new Date(),
  invoiceAmount: number = 0,
  invoiceStatus?: 'closed' | 'open' | 'paid' | 'overdue',
  openAmount: number = 0
): CardDateStatus {
  const safeClosing = Math.max(1, Math.min(31, closingDay || 1));
  const safeDue = Math.max(1, Math.min(31, dueDay || 8));

  const bestDay = calculateBestPurchaseDay(safeClosing);
  const bestPurchaseDayFormatted = `Dia ${String(bestDay).padStart(2, '0')}`;

  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth(); // 0 - 11
  const currentDay = referenceDate.getDate();

  // Data de referência no fuso local sem horas
  const today = new Date(currentYear, currentMonth, currentDay);

  // Fechamento e Vencimento do mês atual
  const thisMonthClosing = new Date(currentYear, currentMonth, safeClosing);
  let thisMonthDue: Date;
  if (safeDue >= safeClosing) {
    thisMonthDue = new Date(currentYear, currentMonth, safeDue);
  } else {
    thisMonthDue = new Date(currentYear, currentMonth + 1, safeDue);
  }

  const isPastClosing = today.getTime() >= thisMonthClosing.getTime();
  const isPastDue = today.getTime() > thisMonthDue.getTime();
  const isDueToday = today.getTime() === thisMonthDue.getTime();

  const isExplicitlyPaid = invoiceStatus === 'paid';

  let isInvoiceClosed = false;
  let daysUntilClosing = 0;
  let daysUntilDue = 0;
  let statusText = '';
  let statusBadgeVariant: CardDateStatus['statusBadgeVariant'] = 'info';
  let displayStatus: CardDateStatus['displayStatus'] = 'open';
  let statusLabel = 'Aberta';
  let cycleClosingDateFormatted = '';
  let cycleDueDateFormatted = '';

  // CASO 1: Hoje ainda NÃO passou da data de fechamento deste mês (ex: dia 15, fecha dia 20)
  if (!isPastClosing) {
    isInvoiceClosed = false;
    const diffTime = thisMonthClosing.getTime() - today.getTime();
    daysUntilClosing = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const diffDueTime = thisMonthDue.getTime() - today.getTime();
    daysUntilDue = Math.max(0, Math.ceil(diffDueTime / (1000 * 60 * 60 * 24)));

    cycleClosingDateFormatted = `${String(safeClosing).padStart(2, '0')}/${MONTH_NAMES_SHORT[thisMonthClosing.getMonth()]}`;
    cycleDueDateFormatted = `${String(safeDue).padStart(2, '0')}/${MONTH_NAMES_SHORT[thisMonthDue.getMonth()]}`;

    if (daysUntilClosing === 0) {
      statusText = 'Fatura fecha hoje';
      statusBadgeVariant = 'warning';
      displayStatus = 'open';
      statusLabel = 'Fecha hoje';
    } else if (daysUntilClosing === 1) {
      statusText = 'Fecha amanhã';
      statusBadgeVariant = 'info';
      displayStatus = 'open';
      statusLabel = 'Aberta';
    } else {
      statusText = `Fecha em ${daysUntilClosing} dias`;
      statusBadgeVariant = 'info';
      displayStatus = 'open';
      statusLabel = 'Aberta';
    }
  } 
  // CASO 2: Hoje está ENTRE o fechamento e o vencimento (inclusive no dia do vencimento)
  // (ex: fecha dia 20, hoje é dia 22 ou dia 28, e vence dia 28)
  else if (!isPastDue) {
    const nextMonthClosing = new Date(currentYear, currentMonth + 1, safeClosing);
    const diffNextClosing = nextMonthClosing.getTime() - today.getTime();
    const daysUntilClosingNext = Math.max(0, Math.ceil(diffNextClosing / (1000 * 60 * 60 * 24)));

    if (isExplicitlyPaid) {
      isInvoiceClosed = false;
      displayStatus = 'paid';
      statusLabel = 'Paga';
      statusBadgeVariant = 'success';
      statusText = `Fatura paga • Próx. fecha em ${daysUntilClosingNext} dias`;
      cycleClosingDateFormatted = `${String(safeClosing).padStart(2, '0')}/${MONTH_NAMES_SHORT[nextMonthClosing.getMonth()]}`;
      cycleDueDateFormatted = `${String(safeDue).padStart(2, '0')}/${MONTH_NAMES_SHORT[thisMonthDue.getMonth()]}`;
    } else {
      isInvoiceClosed = true;
      cycleClosingDateFormatted = `${String(safeClosing).padStart(2, '0')}/${MONTH_NAMES_SHORT[thisMonthClosing.getMonth()]}`;
      cycleDueDateFormatted = `${String(safeDue).padStart(2, '0')}/${MONTH_NAMES_SHORT[thisMonthDue.getMonth()]}`;

      if (isDueToday) {
        daysUntilDue = 0;
        displayStatus = 'closed';
        statusLabel = 'Vence hoje';
        statusBadgeVariant = 'warning';
        statusText = 'Fatura fechada • Vence hoje!';
      } else {
        const diffDue = thisMonthDue.getTime() - today.getTime();
        daysUntilDue = Math.max(1, Math.ceil(diffDue / (1000 * 60 * 60 * 24)));
        displayStatus = 'closed';
        statusLabel = 'Fechada';
        statusBadgeVariant = daysUntilDue <= 3 ? 'warning' : 'info';
        statusText = `Fatura fechada • Vence em ${daysUntilDue} dia${daysUntilDue === 1 ? '' : 's'}`;
      }
    }
  } 
  // CASO 3: Hoje já PASSOU da data de vencimento (ex: hoje é 13/SET, e venceu 07/SET ou 10/SET)
  else {
    // Se a fatura passada tem valor pendente (invoiceAmount > 0 e não está paga)
    if (invoiceAmount !== undefined && invoiceAmount > 0 && !isExplicitlyPaid) {
      isInvoiceClosed = true;
      const diffPastDue = today.getTime() - thisMonthDue.getTime();
      const daysPast = Math.max(1, Math.floor(diffPastDue / (1000 * 60 * 60 * 24)));
      daysUntilDue = -daysPast;

      displayStatus = 'overdue';
      statusLabel = 'Vencida';
      statusBadgeVariant = 'danger';
      statusText = `Fatura vencida há ${daysPast} dia${daysPast === 1 ? '' : 's'}`;
      cycleClosingDateFormatted = `${String(safeClosing).padStart(2, '0')}/${MONTH_NAMES_SHORT[thisMonthClosing.getMonth()]}`;
      cycleDueDateFormatted = `${String(safeDue).padStart(2, '0')}/${MONTH_NAMES_SHORT[thisMonthDue.getMonth()]}`;
    } 
    // Se a fatura já está zerada (R$ 0,00) ou foi quitada:
    // O cartão já avançou automaticamente para o ciclo da próxima fatura!
    else {
      isInvoiceClosed = false;
      const nextMonthClosing = new Date(currentYear, currentMonth + 1, safeClosing);
      let nextMonthDue: Date;
      if (safeDue >= safeClosing) {
        nextMonthDue = new Date(currentYear, currentMonth + 1, safeDue);
      } else {
        nextMonthDue = new Date(currentYear, currentMonth + 2, safeDue);
      }

      const diffNextClosing = nextMonthClosing.getTime() - today.getTime();
      daysUntilClosing = Math.max(0, Math.ceil(diffNextClosing / (1000 * 60 * 60 * 24)));
      daysUntilDue = Math.max(0, Math.ceil((nextMonthDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

      cycleClosingDateFormatted = `${String(safeClosing).padStart(2, '0')}/${MONTH_NAMES_SHORT[nextMonthClosing.getMonth()]}`;
      cycleDueDateFormatted = `${String(safeDue).padStart(2, '0')}/${MONTH_NAMES_SHORT[nextMonthDue.getMonth()]}`;

      if (isExplicitlyPaid) {
        displayStatus = 'paid';
        statusLabel = 'Paga';
        statusBadgeVariant = 'success';
        statusText = `Fatura paga • Próx. fecha em ${daysUntilClosing} dias`;
      } else if (openAmount > 0) {
        displayStatus = 'open';
        statusLabel = 'Aberta';
        statusBadgeVariant = 'info';
        statusText = `Fatura aberta • Fecha em ${daysUntilClosing} dias`;
      } else {
        displayStatus = 'zero';
        statusLabel = 'Em dia';
        statusBadgeVariant = 'success';
        statusText = `Sem pendências • Fecha em ${daysUntilClosing} dias`;
      }
    }
  }

  return {
    bestPurchaseDay: bestDay,
    bestPurchaseDayFormatted,
    isInvoiceClosed,
    daysUntilClosing,
    daysUntilDue,
    statusText,
    statusBadgeVariant,
    displayStatus,
    statusLabel,
    cycleClosingDateFormatted,
    cycleDueDateFormatted,
  };
}

