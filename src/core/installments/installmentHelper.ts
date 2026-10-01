/**
 * Sobra - Auxiliar de Compras Parceladas & Projeção de Faturas
 */

import { 
  Transaction, 
  Account, 
  InvoiceMonthProjection, 
  ActiveInstallmentGroup 
} from '../types';
import { isRefundDescription, isInvoicePaymentDescription, extractInstallmentFromDescription } from '../parsers/csvParser';

export interface GenerateInstallmentsParams {
  accountId: string;
  categoryId: string;
  description: string;
  totalAmount: number;
  installmentCount: number;
  startDate?: string; // YYYY-MM-DD or ISO
  card?: Account;
  notes?: string;
  source?: Transaction['source'];
}

/**
 * Adiciona meses a uma data respeitando o último dia do mês (ex: 31/jan -> 28/fev).
 */
export function addMonthsToDate(date: Date, monthsToAdd: number): Date {
  const result = new Date(date.getTime());
  const expectedMonth = (result.getUTCMonth() + monthsToAdd) % 12;
  
  result.setUTCMonth(result.getUTCMonth() + monthsToAdd);
  
  // Se passou do mês esperado (ex: 31 de janeiro virando 3 de março em ano não bissexto)
  if (result.getUTCMonth() !== ((expectedMonth + 12) % 12)) {
    result.setUTCDate(0); // Volta para o último dia do mês correto
  }
  
  return result;
}

/**
 * Gera as N transações correspondentes às parcelas de uma compra.
 * Ajusta a diferença de centavos na primeira parcela para que a soma bata 100% no centavo.
 */
export function generateInstallmentTransactions(params: GenerateInstallmentsParams): Transaction[] {
  const {
    accountId,
    categoryId,
    description,
    totalAmount,
    installmentCount,
    startDate = new Date().toISOString(),
    card,
    notes,
    source = 'manual',
  } = params;

  if (installmentCount <= 1) {
    throw new Error('Parcelamento deve ter 2 ou mais parcelas.');
  }

  const groupId = `inst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const baseDate = new Date(startDate);

  // Cálculo da parcela base e do resto de centavos
  const baseParcel = Math.floor((totalAmount / installmentCount) * 100) / 100;
  const totalBase = Math.round(baseParcel * installmentCount * 100) / 100;
  const centDifference = Math.round((totalAmount - totalBase) * 100) / 100;

  const transactions: Transaction[] = [];

  for (let i = 1; i <= installmentCount; i++) {
    // A primeira parcela absorve a diferença de arredondamento
    const parcelAmount = i === 1 
      ? Math.round((baseParcel + centDifference) * 100) / 100 
      : baseParcel;

    const parcelDate = addMonthsToDate(baseDate, i - 1);
    const nowIso = new Date().toISOString();

    const tx: Transaction = {
      id: `tx-inst-${groupId}-${i}`,
      accountId,
      categoryId,
      amount: parcelAmount,
      type: 'expense',
      description: `${description.trim()} (${i}/${installmentCount})`,
      date: parcelDate.toISOString(),
      status: 'confirmed',
      paymentMethod: 'credit',
      source,
      notes: notes || `Compra parcelada em ${installmentCount}x`,
      isInstallment: true,
      installmentGroupId: groupId,
      installmentNumber: i,
      installmentTotal: installmentCount,
      originalTotalAmount: totalAmount,
      isShared: Boolean(card?.isShared),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    transactions.push(tx);
  }

  return transactions;
}

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Calcula a fatura de um determinado mês e ano para um cartão específico.
 */
export function calculateInvoiceForMonth(
  cardId: string,
  transactions: Transaction[],
  month: number, // 1 - 12
  year: number
): { totalAmount: number; transactions: Transaction[] } {
  const cardTxs = transactions.filter(t => {
    if (t.accountId !== cardId) return false;
    if (t.status !== 'confirmed') return false;
    const d = new Date(t.date);
    const txMonth = d.getUTCMonth() + 1;
    const txYear = d.getUTCFullYear();
    return txMonth === month && txYear === year;
  });

  let totalAmount = 0;
  for (const t of cardTxs) {
    const isCreditOrRefund = 
      t.isRefund || 
      t.type === 'income' || 
      isRefundDescription(t.description) || 
      isInvoicePaymentDescription(t.description);

    if (isCreditOrRefund) {
      // Estorno, reembolso ou crédito abatendo da fatura
      totalAmount -= t.amount;
    } else if (t.type === 'expense') {
      totalAmount += t.amount;
    }
  }

  return {
    totalAmount: Math.max(0, Math.round(totalAmount * 100) / 100),
    transactions: cardTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  };
}

/**
 * Projeta a linha do tempo das faturas dos próximos N meses para um cartão.
 */
export function calculateFutureInvoiceTimeline(
  cardId: string,
  transactions: Transaction[],
  monthsCount = 6,
  startMonth = new Date().getUTCMonth() + 1,
  startYear = new Date().getUTCFullYear()
): InvoiceMonthProjection[] {
  const timeline: InvoiceMonthProjection[] = [];

  let curMonth = startMonth;
  let curYear = startYear;

  const currentMonthNum = new Date().getUTCMonth() + 1;
  const currentYearNum = new Date().getUTCFullYear();

  for (let i = 0; i < monthsCount; i++) {
    const { totalAmount, transactions: monthTxs } = calculateInvoiceForMonth(cardId, transactions, curMonth, curYear);
    
    let status: 'closed' | 'open' | 'future' = 'future';
    if (curYear === currentYearNum && curMonth === currentMonthNum) {
      status = 'open';
    } else if (curYear < currentYearNum || (curYear === currentYearNum && curMonth < currentMonthNum)) {
      status = 'closed';
    }

    timeline.push({
      month: curMonth,
      year: curYear,
      monthLabel: `${MONTH_NAMES[curMonth - 1]} / ${curYear}`,
      totalAmount,
      transactions: monthTxs,
      status,
    });

    curMonth++;
    if (curMonth > 12) {
      curMonth = 1;
      curYear++;
    }
  }

  return timeline;
}

/**
 * Retorna a data de vencimento da fatura do cartão em que uma determinada transação cairá.
 * Considera o dia de fechamento (closingDay) e o dia de vencimento (dueDay).
 */
export function getInvoiceDueDateForDate(
  txDateOrIso: Date | string,
  card?: Account
): Date {
  let year: number;
  let month: number; // 1-12
  let day: number;

  if (typeof txDateOrIso === 'string') {
    const match = txDateOrIso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10);
      day = parseInt(match[3], 10);
    } else {
      const d = new Date(txDateOrIso);
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
    }
  } else {
    year = txDateOrIso.getFullYear();
    month = txDateOrIso.getMonth() + 1;
    day = txDateOrIso.getDate();
  }

  if (!card || card.type !== 'credit_card') {
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  const closingDay = Math.max(1, Math.min(31, card.closingDay || 1));
  const dueDay = Math.max(1, Math.min(31, card.dueDay || 8));

  let dueYear = year;
  let dueMonth = month; // 1-12

  if (closingDay <= dueDay) {
    // Caso padrão brasileiro (ex: fecha dia 1, vence dia 8)
    // Compras a partir do fechamento caem na fatura do mês seguinte
    if (day >= closingDay) {
      dueMonth = month + 1;
    } else {
      dueMonth = month;
    }
  } else {
    // Caso em que o fechamento é em um mês e o vencimento no seguinte (ex: fecha 25, vence 5)
    if (day >= closingDay) {
      dueMonth = month + 2;
    } else {
      dueMonth = month + 1;
    }
  }

  while (dueMonth > 12) {
    dueMonth -= 12;
    dueYear += 1;
  }

  return new Date(dueYear, dueMonth - 1, dueDay, 12, 0, 0);
}

/**
 * Retorna todos os grupos de parcelamentos ativos com detalhes consolidados.
 * Suporta auto-reconhecimento inteligente de parcelas mesmo que flags de banco de dados
 * tenham sido perdidas (ex: sincronização de cartão conjunto na nuvem via Supabase).
 */
export function getActiveInstallmentGroups(
  transactions: Transaction[],
  cardId?: string,
  onlyActive: boolean = false,
  accounts?: Account[]
): ActiveInstallmentGroup[] {
  // 1. Mapeamento de correspondência por chave descritiva para unificar parcelas de mesmo grupo
  const descGroupMap = new Map<string, string>(); // `accId|cleanDesc|total|roundedAmount` -> groupId

  // Primeira passada: indexar grupos que já possuem groupId explícito ou id com padrão tx-inst-
  for (const t of transactions) {
    if (cardId && t.accountId !== cardId) continue;
    const detected = extractInstallmentFromDescription(t.description);
    const idMatch = t.id?.match(/^tx-inst-(.+)-(\d+)$/);
    const groupId = t.installmentGroupId || (idMatch ? idMatch[1] : undefined);
    const total = t.installmentTotal || detected.installmentTotal;
    const cleanDesc = (detected.cleanDescription || t.description.replace(/\s*\(\d+\/\d+\)$/, '')).toLowerCase().trim();

    if (groupId && total) {
      const key = `${t.accountId}|${cleanDesc}|${total}|${Math.round(t.amount * 100)}`;
      if (!descGroupMap.has(key)) {
        descGroupMap.set(key, groupId);
      }
    }
  }

  // Segunda passada: classificar e normalizar cada transação
  const groupsMap = new Map<string, Transaction[]>();

  for (const t of transactions) {
    if (cardId && t.accountId !== cardId) continue;

    let isInstallment = !!t.isInstallment;
    let groupId = t.installmentGroupId;
    let num = t.installmentNumber;
    let total = t.installmentTotal;
    const detected = extractInstallmentFromDescription(t.description);
    const idMatch = t.id?.match(/^tx-inst-(.+)-(\d+)$/);

    if (detected.isInstallment || idMatch || isInstallment || (groupId && total)) {
      isInstallment = true;
      num = num || (idMatch ? parseInt(idMatch[2], 10) : undefined) || detected.installmentNumber || 1;
      total = total || detected.installmentTotal || (idMatch ? parseInt(idMatch[2], 10) : num);
      const cleanDesc = (detected.cleanDescription || t.description.replace(/\s*\(\d+\/\d+\)$/, '')).toLowerCase().trim();
      const descKey = `${t.accountId}|${cleanDesc}|${total}|${Math.round(t.amount * 100)}`;

      if (!groupId) {
        groupId = descGroupMap.get(descKey) || (idMatch ? idMatch[1] : `inst-auto-${t.accountId}-${cleanDesc.replace(/[^a-z0-9]/g, '-')}-${total}-${Math.round(t.amount * 100)}`);
        descGroupMap.set(descKey, groupId);
      }

      const normalizedTx: Transaction = {
        ...t,
        isInstallment: true,
        installmentGroupId: groupId,
        installmentNumber: num,
        installmentTotal: total,
        originalTotalAmount: t.originalTotalAmount || (total && t.amount ? Math.round(t.amount * total * 100) / 100 : undefined),
      };

      const list = groupsMap.get(groupId) || [];
      list.push(normalizedTx);
      groupsMap.set(groupId, list);
    }
  }

  const result: ActiveInstallmentGroup[] = [];
  const now = new Date();
  const currentTimestamp = now.getTime();

  for (const [groupId, txList] of groupsMap.entries()) {
    txList.sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
    const firstTx = txList[0];
    if (!firstTx) continue;

    const cleanDesc = firstTx.description.replace(/\s*\(\d+\/\d+\)$/, '').trim();
    const installmentTotal = firstTx.installmentTotal || txList.length;
    const originalTotalAmount = firstTx.originalTotalAmount || Math.round((firstTx.amount * installmentTotal) * 100) / 100;

    let paidCount = 0;
    let nextTx: Transaction | undefined = undefined;

    for (const t of txList) {
      const txTime = new Date(t.date).getTime();
      if (txTime <= currentTimestamp) {
        const n = t.installmentNumber || 0;
        if (n > paidCount) paidCount = n;
      } else if (!nextTx) {
        nextTx = t;
      }
    }

    const card = accounts?.find(a => a.id === firstTx.accountId);
    let nextBillingDate: string | undefined = undefined;

    if (nextTx) {
      if (card && card.type === 'credit_card') {
        nextBillingDate = getInvoiceDueDateForDate(nextTx.date, card).toISOString();
      } else {
        nextBillingDate = nextTx.date;
      }
    }

    const remainingCount = Math.max(0, installmentTotal - paidCount);
    const futureTxs = txList.filter(t => new Date(t.date).getTime() > currentTimestamp);
    const remainingAmount = futureTxs.length > 0
      ? Math.round(futureTxs.reduce((sum, t) => sum + t.amount, 0) * 100) / 100
      : Math.round(remainingCount * (originalTotalAmount / installmentTotal) * 100) / 100;

    const group: ActiveInstallmentGroup = {
      groupId,
      description: cleanDesc,
      accountId: firstTx.accountId,
      categoryId: firstTx.categoryId,
      originalTotalAmount: Math.round(originalTotalAmount * 100) / 100,
      installmentTotal,
      paidInstallmentsCount: Math.min(installmentTotal, paidCount),
      remainingInstallmentsCount: remainingCount,
      monthlyAmount: Math.round((originalTotalAmount / installmentTotal) * 100) / 100,
      remainingAmount,
      startDate: firstTx.date,
      nextBillingDate,
      nextTransactionDate: nextTx?.date,
      transactions: txList,
      isCompleted: remainingCount === 0,
    };

    const isCompleted = remainingCount === 0;

    // Se o parcelamento já foi 100% quitado:
    // Permanece visível para clareza e alívio de quitação apenas até a próxima fatura do cartão
    if (isCompleted) {
      if (onlyActive) {
        continue;
      }

      const lastTx = txList[txList.length - 1];
      if (lastTx) {
        const lastDueDate = card && card.type === 'credit_card'
          ? getInvoiceDueDateForDate(lastTx.date, card)
          : new Date(lastTx.date);

        // Expiração: 1 ciclo após o vencimento da última parcela (próxima fatura)
        const expirationDate = new Date(
          lastDueDate.getFullYear(),
          lastDueDate.getMonth() + 1,
          lastDueDate.getDate(),
          23, 59, 59
        );

        if (now.getTime() > expirationDate.getTime()) {
          continue;
        }
      }
    }

    result.push(group);
  }

  // Ordena os ativos primeiro (que ainda têm parcelas a vencer), depois por data de início mais recente
  return result.sort((a, b) => {
    if (a.remainingInstallmentsCount > 0 && b.remainingInstallmentsCount === 0) return -1;
    if (a.remainingInstallmentsCount === 0 && b.remainingInstallmentsCount > 0) return 1;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });
}
