/**
 * Sobra - Auxiliar de Compras Parceladas & Projeção de Faturas
 */

import { 
  Transaction, 
  Account, 
  InvoiceMonthProjection, 
  ActiveInstallmentGroup 
} from '../types';

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
    if (t.type === 'expense') {
      totalAmount += t.amount;
    } else if (t.type === 'income') {
      // Estorno ou crédito
      totalAmount -= t.amount;
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
 * Retorna todos os grupos de parcelamentos ativos com detalhes consolidados.
 */
export function getActiveInstallmentGroups(
  transactions: Transaction[],
  cardId?: string
): ActiveInstallmentGroup[] {
  const groupsMap = new Map<string, Transaction[]>();

  for (const t of transactions) {
    if (!t.isInstallment || !t.installmentGroupId) continue;
    if (cardId && t.accountId !== cardId) continue;

    const list = groupsMap.get(t.installmentGroupId) || [];
    list.push(t);
    groupsMap.set(t.installmentGroupId, list);
  }

  const result: ActiveInstallmentGroup[] = [];
  const now = new Date();
  const currentTimestamp = now.getTime();

  for (const [groupId, txList] of groupsMap.entries()) {
    txList.sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));
    const firstTx = txList[0];
    if (!firstTx) continue;

    // Limpar o sufixo " (1/10)" da descrição
    const cleanDesc = firstTx.description.replace(/\s*\(\d+\/\d+\)$/, '');
    const originalTotalAmount = firstTx.originalTotalAmount || txList.reduce((acc, t) => acc + t.amount, 0);
    const installmentTotal = firstTx.installmentTotal || txList.length;

    // Quantas parcelas já venceram ou caíram no mês atual/passado
    let paidCount = 0;
    let nextBillingDate: string | undefined = undefined;

    for (const t of txList) {
      const txTime = new Date(t.date).getTime();
      if (txTime <= currentTimestamp) {
        paidCount++;
      } else if (!nextBillingDate) {
        nextBillingDate = t.date;
      }
    }

    const remainingCount = Math.max(0, installmentTotal - paidCount);
    const remainingAmount = txList
      .filter(t => new Date(t.date).getTime() > currentTimestamp)
      .reduce((sum, t) => sum + t.amount, 0);

    result.push({
      groupId,
      description: cleanDesc,
      accountId: firstTx.accountId,
      categoryId: firstTx.categoryId,
      originalTotalAmount: Math.round(originalTotalAmount * 100) / 100,
      installmentTotal,
      paidInstallmentsCount: Math.min(installmentTotal, paidCount),
      remainingInstallmentsCount: remainingCount,
      monthlyAmount: Math.round((originalTotalAmount / installmentTotal) * 100) / 100,
      remainingAmount: Math.round(remainingAmount * 100) / 100,
      startDate: firstTx.date,
      nextBillingDate,
      transactions: txList,
    });
  }

  return result.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}
