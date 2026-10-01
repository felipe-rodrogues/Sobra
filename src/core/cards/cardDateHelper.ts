/**
 * Sobra - Inteligência de Datas de Cartão de Crédito
 * Cálculos de melhor dia de compra, status da fatura (aberta/fechada) e contagem regressiva
 */

import { CardDateStatus, Account, Transaction } from '../types';
import { calculateInvoiceForMonth, MONTH_NAMES } from '../installments/installmentHelper';

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
  openAmount: number = 0,
  targetMonth?: number,
  targetYear?: number
): CardDateStatus {
  const safeClosing = Math.max(1, Math.min(31, closingDay || 1));
  const safeDue = Math.max(1, Math.min(31, dueDay || 8));

  const bestDay = calculateBestPurchaseDay(safeClosing);
  const bestPurchaseDayFormatted = `Dia ${String(bestDay).padStart(2, '0')}`;

  // Se o mês e ano da fatura foram especificados diretamente (ex: Fatura de Setembro/2026)
  if (targetMonth !== undefined && targetYear !== undefined) {
    const dueMonth = targetMonth === 12 ? 1 : targetMonth + 1;
    const dueYear = targetMonth === 12 ? targetYear + 1 : targetYear;
    const dueDate = new Date(dueYear, dueMonth - 1, safeDue);

    const closingDate = safeClosing <= safeDue
      ? new Date(dueYear, dueMonth - 1, safeClosing)
      : new Date(targetYear, targetMonth - 1, safeClosing);

    const todayNoTime = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    const dueDateNoTime = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const closingDateNoTime = new Date(closingDate.getFullYear(), closingDate.getMonth(), closingDate.getDate());

    const diffDueTime = dueDateNoTime.getTime() - todayNoTime.getTime();
    const diffDays = Math.round(diffDueTime / (1000 * 60 * 60 * 24));

    const diffClosingTime = closingDateNoTime.getTime() - todayNoTime.getTime();
    const diffClosingDays = Math.round(diffClosingTime / (1000 * 60 * 60 * 24));

    const isPastClosing = todayNoTime.getTime() >= closingDateNoTime.getTime();
    const isExplicitlyPaid = invoiceStatus === 'paid' && isPastClosing;
    const isZeroAmount = invoiceAmount === 0;

    let displayStatus: CardDateStatus['displayStatus'] = 'open';
    let statusLabel = 'Aberta';
    let statusBadgeVariant: CardDateStatus['statusBadgeVariant'] = 'info';
    let statusText = '';

    if (isExplicitlyPaid || (isZeroAmount && diffDays <= 0 && isPastClosing)) {
      displayStatus = 'paid';
      statusLabel = 'Paga';
      statusBadgeVariant = 'success';
      statusText = 'Fatura paga';
    } else if (isZeroAmount && diffDays > 0) {
      displayStatus = 'zero';
      statusLabel = 'Em dia';
      statusBadgeVariant = 'success';
      statusText = `Sem pendências • Fecha em ${Math.max(0, diffClosingDays)} dias`;
    } else if (diffDays < 0) {
      displayStatus = 'overdue';
      statusLabel = 'Vencida';
      statusBadgeVariant = 'danger';
      const daysPast = Math.abs(diffDays);
      statusText = `Fatura vencida há ${daysPast} dia${daysPast === 1 ? '' : 's'}`;
    } else if (diffDays === 0) {
      displayStatus = 'closed';
      statusLabel = 'Vence hoje';
      statusBadgeVariant = 'warning';
      statusText = 'Fatura fechada • Vence hoje!';
    } else {
      // diffDays > 0 (vencimento no futuro)
      if (todayNoTime.getTime() >= closingDateNoTime.getTime()) {
        displayStatus = 'closed';
        statusLabel = 'Fechada';
        statusBadgeVariant = diffDays <= 3 ? 'warning' : 'info';
        statusText = `Fatura fechada • Vence em ${diffDays} dia${diffDays === 1 ? '' : 's'}`;
      } else {
        displayStatus = 'open';
        statusLabel = diffClosingDays === 0 ? 'Fecha hoje' : diffClosingDays === 1 ? 'Fecha amanhã' : 'Aberta';
        statusBadgeVariant = diffClosingDays <= 1 ? 'warning' : 'info';
        statusText = `Fatura aberta • Fecha em ${Math.max(0, diffClosingDays)} dias`;
      }
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      bestPurchaseDay: bestDay,
      bestPurchaseDayFormatted,
      isInvoiceClosed: displayStatus === 'closed' || displayStatus === 'overdue',
      daysUntilClosing: Math.max(0, diffClosingDays),
      daysUntilDue: diffDays,
      statusText,
      statusBadgeVariant,
      displayStatus,
      statusLabel,
      cycleClosingDateFormatted: `${pad(safeClosing)}/${MONTH_NAMES_SHORT[closingDate.getMonth()]}`,
      cycleDueDateFormatted: `${pad(safeDue)}/${MONTH_NAMES_SHORT[dueDate.getMonth()]}`,
    };
  }

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
    const diffPastDue = today.getTime() - thisMonthDue.getTime();
    const daysPast = Math.max(1, Math.floor(diffPastDue / (1000 * 60 * 60 * 24)));

    const isExplicitlyOverdue = invoiceStatus === 'overdue';
    const isUnpaidClosedPastDue = (invoiceStatus === 'closed' || invoiceStatus === undefined) && daysPast <= 15;

    // Se a fatura passada tem valor pendente e ainda está dentro da janela de atraso recente do ciclo anterior:
    if (invoiceAmount !== undefined && invoiceAmount > 0 && !isExplicitlyPaid && (isExplicitlyOverdue || isUnpaidClosedPastDue)) {
      isInvoiceClosed = true;
      daysUntilDue = -daysPast;

      displayStatus = 'overdue';
      statusLabel = 'Vencida';
      statusBadgeVariant = 'danger';
      statusText = `Fatura vencida há ${daysPast} dia${daysPast === 1 ? '' : 's'}`;
      cycleClosingDateFormatted = `${String(safeClosing).padStart(2, '0')}/${MONTH_NAMES_SHORT[thisMonthClosing.getMonth()]}`;
      cycleDueDateFormatted = `${String(safeDue).padStart(2, '0')}/${MONTH_NAMES_SHORT[thisMonthDue.getMonth()]}`;
    } 
    // Se a fatura já está zerada (R$ 0,00), quitada ou já avançou para o próximo ciclo de compras:
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
      } else if (invoiceAmount > 0 || openAmount > 0) {
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

export interface CardActiveInvoiceInfo {
  month: number;
  year: number;
  monthOffset: number;
  status: 'open' | 'closed' | 'paid' | 'overdue';
  statusLabel: string;
  totalAmount: number;
  userAmount: number;
  dueDay: number;
  dueMonth: number;
  dueYear: number;
  dueDate: Date;
  dueDateFormatted: string;
  daysUntilDue: number;
  isOverdue: boolean;
  isPaid: boolean;
  isClosed: boolean;
}

/**
 * Determina com precisão a fatura ativa/em foco do cartão:
 * - Se a fatura fechada mais recente estiver em aberto/pendente (ou reaberta por cancelamento de pagamento),
 *   ela é a fatura em foco prioritária com seu valor e vencimento correspondente.
 * - Se a fatura fechada já foi quitada, o foco avança para a fatura em aberto acumulando no ciclo atual.
 */
export function getCardActiveInvoiceInfo(
  card: Account,
  transactions: Transaction[],
  referenceDate: Date = new Date()
): CardActiveInvoiceInfo {
  const now = referenceDate;
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  const closingDay = Math.max(1, Math.min(31, card.closingDay || 1));
  const dueDay = Math.max(1, Math.min(31, card.dueDay || 8));

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

  const userRatio = card.isShared
    ? (card.splitRatio !== undefined ? card.splitRatio : card.splitMode === 'half' ? 0.5 : card.splitMode === 'none' ? 0 : 1.0)
    : 1.0;

  let targetMonth = currentMonth;
  let targetYear = currentYear;
  let monthOffset = 0;
  let dueM = currentMonth;
  let dueY = currentYear;
  let status: 'open' | 'closed' | 'paid' | 'overdue' = 'open';
  let statusLabel = 'Aberta';
  let isClosed = false;
  let isPaid = false;

  // Se o fechamento ocorre antes ou no dia do vencimento (caso padrão brasileiro, ex: fecha 01, vence 08)
  if (closingDay <= dueDay) {
    // Se hoje já alcançou ou passou o dia de fechamento do mês
    if (currentDay >= closingDay) {
      // O ciclo que fechou este mês no dia closingDay corresponde às compras do mês anterior (prevMonth)
      // e vence no dia dueDay deste mês (currentMonth)
      const isCardPaid = card.invoiceStatus === 'paid';

      if (!isCardPaid) {
        // Fatura fechada/pendente aguardando quitação (ou vencida se currentDay > dueDay)
        targetMonth = prevMonth;
        targetYear = prevYear;
        monthOffset = -1;
        dueM = currentMonth;
        dueY = currentYear;
        isClosed = true;
        isPaid = false;
        if (currentDay > dueDay) {
          status = 'overdue';
          statusLabel = 'Vencida';
        } else {
          status = 'closed';
          statusLabel = currentDay === dueDay ? 'Vence hoje' : 'Fechada';
        }
      } else {
        // Fatura do ciclo anterior foi PAGA! O foco avança para a fatura em aberto acumulando no mês atual
        targetMonth = currentMonth;
        targetYear = currentYear;
        monthOffset = 0;
        dueM = nextMonth;
        dueY = nextYear;
        status = 'open';
        statusLabel = 'Aberta';
        isClosed = false;
        isPaid = false;
      }
    } else {
      // Ainda não fechou a fatura deste mês (ex: hoje dia 25, fecha dia 01 do mês seguinte)
      const isExplicitlyOverdue = card.invoiceStatus === 'overdue';
      if (isExplicitlyOverdue) {
        targetMonth = prevMonth;
        targetYear = prevYear;
        monthOffset = -1;
        dueM = currentMonth;
        dueY = currentYear;
        status = 'overdue';
        statusLabel = 'Vencida';
        isClosed = true;
        isPaid = false;
      } else {
        targetMonth = currentMonth;
        targetYear = currentYear;
        monthOffset = 0;
        dueM = nextMonth;
        dueY = nextYear;
        status = 'open';
        statusLabel = 'Aberta';
        isClosed = false;
        isPaid = card.invoiceStatus === 'paid';
      }
    }
  } else {
    // closingDay > dueDay (ex: fecha dia 25, vence dia 05 do mês seguinte)
    if (currentDay >= closingDay) {
      const isCardPaid = card.invoiceStatus === 'paid';
      if (!isCardPaid) {
        targetMonth = currentMonth;
        targetYear = currentYear;
        monthOffset = 0;
        dueM = nextMonth;
        dueY = nextYear;
        status = 'closed';
        statusLabel = 'Fechada';
        isClosed = true;
        isPaid = false;
      } else {
        targetMonth = nextMonth;
        targetYear = nextYear;
        monthOffset = 1;
        dueM = nextMonth === 12 ? 1 : nextMonth + 1;
        dueY = nextMonth === 12 ? nextYear + 1 : nextYear;
        status = 'open';
        statusLabel = 'Aberta';
        isClosed = false;
        isPaid = false;
      }
    } else if (currentDay <= dueDay) {
      const isCardPaid = card.invoiceStatus === 'paid';
      if (!isCardPaid) {
        targetMonth = prevMonth;
        targetYear = prevYear;
        monthOffset = -1;
        dueM = currentMonth;
        dueY = currentYear;
        isClosed = true;
        isPaid = false;
        if (currentDay === dueDay) {
          status = 'closed';
          statusLabel = 'Vence hoje';
        } else {
          status = 'closed';
          statusLabel = 'Fechada';
        }
      } else {
        targetMonth = currentMonth;
        targetYear = currentYear;
        monthOffset = 0;
        dueM = nextMonth;
        dueY = nextYear;
        status = 'open';
        statusLabel = 'Aberta';
      }
    } else {
      targetMonth = currentMonth;
      targetYear = currentYear;
      monthOffset = 0;
      dueM = nextMonth;
      dueY = nextYear;
      status = 'open';
      statusLabel = 'Aberta';
    }
  }

  const dueDate = new Date(dueY, dueM - 1, dueDay);
  const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Cálculo de valor para a fatura do ciclo em foco
  const monthData = calculateInvoiceForMonth(card.id, transactions, targetMonth, targetYear);
  const totalAmount = monthData.transactions.length > 0
    ? monthData.totalAmount
    : (card.invoiceAmount !== undefined ? card.invoiceAmount : (card.balance ? Math.abs(card.balance) : monthData.totalAmount));

  const userAmount = Math.round(totalAmount * userRatio * 100) / 100;
  const dueDateFormatted = `${dueDay} de ${MONTH_NAMES[dueM - 1]}`;

  return {
    month: targetMonth,
    year: targetYear,
    monthOffset,
    status,
    statusLabel,
    totalAmount,
    userAmount,
    dueDay,
    dueMonth: dueM,
    dueYear: dueY,
    dueDate,
    dueDateFormatted,
    daysUntilDue: diffDays,
    isOverdue: status === 'overdue' || diffDays < 0,
    isPaid,
    isClosed,
  };
}

