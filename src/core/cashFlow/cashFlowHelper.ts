/**
 * Sobra - Utilitário de Cálculo do Fluxo de Caixa (Regime de Caixa do Pierre + Simulação)
 * 
 * Regras do Pierre:
 * 1. Padrão (Regime de Caixa): Só considera o dinheiro que de fato entrou e saiu da conta bancária.
 *    - Compras no cartão NÃO entram no fluxo de caixa imediatamente (entram quando a fatura é paga).
 *    - Pagamentos de fatura feitos pela conta bancária ENTRAM como saídas reais da conta.
 * 2. Modo Simulado ("Simular fatura"):
 *    - Soma as compras em faturas abertas do período às saídas, projetando a sobra como se as compras
 *      já tivessem sido debitadas da conta.
 *    - Estado efêmero (não persistido) para garantir total confiança nos números reais.
 */

import { Transaction, Account } from '../types';
import { getEffectiveTransactionAmount } from '../calculations';

export type CashFlowPeriod = 'this_month' | '3m' | '6m' | '1y';

export interface DailyCashFlowPoint {
  day: number;
  dateStr: string; // YYYY-MM-DD
  income: number;
  expense: number;
  net: number;
  transactionCount: number;
}

export interface CashFlowSummaryResult {
  period: CashFlowPeriod;
  totalIncome: number;
  totalExpense: number;
  netFlow: number; // totalIncome - totalExpense
  cardPurchasesAmount: number; // No modo real: faturas pagas; No modo simulado: compras no cartão
  directExpensesAmount: number; // Pix, boletos, débito e transferências pagas
  openInvoicesAmount: number; // Compras no cartão aguardando pagamento
  paidInvoicesAmount: number; // Pagamentos de faturas já debitados da conta
  isSimulated: boolean;
  dailyPoints: DailyCashFlowPoint[];
  transactions: Transaction[];
  selectedMonthName: string;
  selectedYear: number;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Verifica se a transação é um pagamento de fatura de cartão efetuado via conta bancária
 */
export function isInvoicePayment(tx: Transaction): boolean {
  const desc = (tx.description || '').toLowerCase();
  if (desc.includes('pagamento fatura') || desc.includes('pagamento de fatura') || desc.includes('fatura paga')) {
    return true;
  }
  if (tx.paymentMethod === 'transfer' && desc.includes('fatura')) {
    return true;
  }
  return false;
}

/**
 * Verifica se a transação é uma compra no cartão de crédito
 */
export function isCardPurchase(tx: Transaction, accounts: Account[]): boolean {
  if (tx.paymentMethod === 'credit') return true;
  const acc = accounts.find(a => a.id === tx.accountId);
  return acc?.type === 'credit_card';
}

/**
 * Filtra transações pelo período especificado
 */
export function filterTransactionsByPeriod(
  transactions: Transaction[],
  period: CashFlowPeriod,
  refMonth: number,
  refYear: number
): Transaction[] {
  const confirmed = transactions.filter(t => t.status === 'confirmed');

  if (period === 'this_month') {
    return confirmed.filter(t => {
      const d = new Date(t.date);
      const m = d.getUTCMonth() + 1;
      const y = d.getUTCFullYear();
      return m === refMonth && y === refYear;
    });
  }

  const now = new Date(refYear, refMonth - 1, 28);
  let monthsBack = 3;
  if (period === '6m') monthsBack = 6;
  if (period === '1y') monthsBack = 12;

  const startDate = new Date(refYear, refMonth - monthsBack, 1);

  return confirmed.filter(t => {
    const d = new Date(t.date);
    return d >= startDate && d <= now;
  });
}

/**
 * Calcula o resumo completo de Fluxo de Caixa nas Contas
 * 
 * @param transactions Lista de transações do usuário
 * @param accounts Lista de contas cadastradas
 * @param period Período analisado ('this_month', '3m', '6m', '1y')
 * @param selectedMonth Mês selecionado (1 a 12)
 * @param selectedYear Ano selecionado (ex: 2026)
 * @param simulateOpenInvoices Se true, adiciona compras no cartão às saídas projetadas
 */
export function calculateCashFlow(
  transactions: Transaction[],
  accounts: Account[],
  period: CashFlowPeriod = 'this_month',
  selectedMonth = new Date().getMonth() + 1,
  selectedYear = new Date().getFullYear(),
  simulateOpenInvoices = false
): CashFlowSummaryResult {
  const periodTxns = filterTransactionsByPeriod(transactions, period, selectedMonth, selectedYear);

  let totalIncome = 0;
  let directExpensesAmount = 0;
  let paidInvoicesAmount = 0;
  let openInvoicesAmount = 0;

  // Lista de transações válidas para este cálculo
  const validTxns: Transaction[] = [];

  periodTxns.forEach(tx => {
    const effectiveAmount = getEffectiveTransactionAmount(tx, accounts);

    if (tx.type === 'income') {
      totalIncome += effectiveAmount;
      validTxns.push(tx);
    } else if (tx.type === 'expense') {
      const isCard = isCardPurchase(tx, accounts);
      const isInvoice = isInvoicePayment(tx);

      if (isInvoice) {
        // Pagamento de fatura efetuado na conta bancária (saída real de caixa)
        paidInvoicesAmount += effectiveAmount;
        directExpensesAmount += effectiveAmount;
        validTxns.push(tx);
      } else if (isCard) {
        // Compra no cartão de crédito
        openInvoicesAmount += effectiveAmount;
        if (simulateOpenInvoices) {
          // No modo simulado, adiciona ao fluxo para simular quitação imediata
          validTxns.push(tx);
        }
      } else {
        // Despesa direta na conta (Pix, boleto, débito, saque, transferência)
        directExpensesAmount += effectiveAmount;
        validTxns.push(tx);
      }
    }
  });

  // Cálculo de saídas totais e fluxo líquido
  const totalExpense = directExpensesAmount + (simulateOpenInvoices ? openInvoicesAmount : 0);
  const cardPurchasesAmount = simulateOpenInvoices ? openInvoicesAmount : paidInvoicesAmount;
  const netFlow = totalIncome - totalExpense;

  // Ordenar transações por data decrescente
  validTxns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Gerar pontos diários para o mês selecionado
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const dailyMap: Record<number, { income: number; expense: number; count: number }> = {};

  for (let d = 1; d <= daysInMonth; d++) {
    dailyMap[d] = { income: 0, expense: 0, count: 0 };
  }

  validTxns.forEach(tx => {
    const d = new Date(tx.date);
    const m = d.getUTCMonth() + 1;
    const y = d.getUTCFullYear();

    if (m === selectedMonth && y === selectedYear) {
      const dayNum = d.getUTCDate();
      if (dailyMap[dayNum]) {
        const effective = getEffectiveTransactionAmount(tx, accounts);
        if (tx.type === 'income') {
          dailyMap[dayNum].income += effective;
        } else if (tx.type === 'expense') {
          dailyMap[dayNum].expense += effective;
        }
        dailyMap[dayNum].count += 1;
      }
    }
  });

  const dailyPoints: DailyCashFlowPoint[] = Object.keys(dailyMap).map(k => {
    const day = parseInt(k, 10);
    const data = dailyMap[day];
    const monthPad = String(selectedMonth).padStart(2, '0');
    const dayPad = String(day).padStart(2, '0');
    return {
      day,
      dateStr: `${selectedYear}-${monthPad}-${dayPad}`,
      income: Math.round(data.income * 100) / 100,
      expense: Math.round(data.expense * 100) / 100,
      net: Math.round((data.income - data.expense) * 100) / 100,
      transactionCount: data.count,
    };
  });

  return {
    period,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    netFlow: Math.round(netFlow * 100) / 100,
    cardPurchasesAmount: Math.round(cardPurchasesAmount * 100) / 100,
    directExpensesAmount: Math.round(directExpensesAmount * 100) / 100,
    openInvoicesAmount: Math.round(openInvoicesAmount * 100) / 100,
    paidInvoicesAmount: Math.round(paidInvoicesAmount * 100) / 100,
    isSimulated: simulateOpenInvoices,
    dailyPoints,
    transactions: validTxns,
    selectedMonthName: MONTH_NAMES[selectedMonth - 1] || '',
    selectedYear,
  };
}
