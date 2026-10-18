/**
 * Sobra - Motor de Cálculo Safe-to-Spend (Dinheiro Livre Seguro)
 * 
 * Calcula com precisão matemática o orçamento diário e semanal livre,
 * deduzindo da renda as parcelas de cartões ativas (respeitando splitRatio de cartões conjuntos),
 * assinaturas recorrentes pendentes e gastos variáveis já realizados,
 * evitando rigorosamente dupla contagem e distorções temporais.
 */

import { Transaction, Account, Subscription, ActiveInstallmentGroup } from '../types';
import { isInvoicePayment } from '../calculations';
import { extractInstallmentFromDescription } from '../parsers/csvParser';
import { formatBrlCurrency } from '../parsers/currencyHelper';

export interface CommittedItemDetail {
  id: string;
  type: 'installment' | 'subscription' | 'fixed_bill';
  name: string;
  fullAmount: number;
  userAmount: number;
  userShareRatio: number; // 1.0 (100%), 0.5 (50%), 0.0 (0%), etc.
  accountName?: string;
  cardLastDigits?: string;
  isShared: boolean;
  dueDateOrDate?: string;
}

export interface SafeToSpendExplanation {
  direction: 'increased' | 'decreased' | 'stable';
  diffWeekly: number;
  diffDaily: number;
  reasonText: string;
  badgeLabel: string;
  primaryCause: 'installments' | 'subscriptions' | 'burn_rate' | 'shared_card' | 'stable';
}

export interface SafeToSpendParams {
  transactions: Transaction[];
  accounts: Account[];
  subscriptions: Subscription[];
  activeInstallmentGroups?: ActiveInstallmentGroup[];
  referenceDate?: Date;
  savingsPercent?: number; // 0 a 30
  goalsDailyNeeded?: number; // cota diária de metas com prazo vinculadas
  overrideIncome?: number; // se especificada, usa essa renda
  baselineGoal?: {
    dailyAmount?: number;
    baselineWeeklyAmount?: number;
    committedInstallmentsAmount?: number;
    committedSubscriptionsAmount?: number;
    savingsPercent?: number | null;
  } | null;
}

export interface SafeToSpendResult {
  monthlyIncome: number;
  totalDaysInMonth: number;
  elapsedDays: number;
  remainingDays: number;

  // 1. Dinheiro Comprometido Inflexível
  committedInstallmentsTotal: number;
  committedSubscriptionsTotal: number;
  committedTotal: number;
  committedItems: CommittedItemDetail[];

  // 2. Gastos Variáveis / De Bolso já consumidos no mês (exclui quitações e itens comprometidos)
  variableSpentSoFar: number;

  // 3. Reservas e Metas
  plannedSavingsAmount: number;
  plannedGoalsAmount: number;

  // 4. Saldo Seguro Livre (Safe-to-Spend)
  availableToSpend: number;
  dailySafeBudget: number;
  weeklySafeBudget: number;

  // 5. Ritmo Real de Consumo de Bolso
  actualDailyBurnRate: number;
  actualWeeklyBurnRate: number;
  projectedSobra: number;

  // 6. Diagnóstico de Variação (Delta Explanation)
  explanation: SafeToSpendExplanation;
}

/**
 * Retorna a proporção da despesa ou fatura pertencente ao usuário atual (0.0 a 1.0).
 */
export function getAccountUserRatio(account?: Account): number {
  if (!account || !account.isShared) return 1.0;
  if (account.splitRatio !== undefined) return account.splitRatio;
  if (account.splitMode === 'half') return 0.5;
  if (account.splitMode === 'none') return 0.0;
  return 1.0;
}

/**
 * Motor central de cálculo do Limite Seguro de Gastos (Safe-to-Spend).
 */
export function calculateSafeToSpendBudget(params: SafeToSpendParams): SafeToSpendResult {
  const {
    transactions = [],
    accounts = [],
    subscriptions = [],
    activeInstallmentGroups = [],
    referenceDate = new Date(),
    savingsPercent = 10,
    goalsDailyNeeded = 0,
    overrideIncome,
    baselineGoal,
  } = params;

  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1; // 1 - 12
  const currentDay = referenceDate.getDate();

  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const elapsedDays = Math.max(1, currentDay);
  const remainingDays = Math.max(1, totalDaysInMonth - currentDay);

  // Mapa de contas por ID para consultas rápidas
  const accountMap = new Map<string, Account>();
  for (const acc of accounts) {
    accountMap.set(acc.id, acc);
  }

  // ── 1. DETERMINAÇÃO DA RENDA DO MÊS ───────────────────────────────────
  let monthlyIncome = 0;
  if (overrideIncome !== undefined && overrideIncome > 0) {
    monthlyIncome = overrideIncome;
  } else {
    // Soma receitas do mês com competência/data deste mês
    for (const tx of transactions) {
      if (tx.status !== 'confirmed' || tx.type !== 'income' || tx.amount <= 0) continue;
      
      const txCompetenceMonth = tx.competenceMonth;
      const txCompetenceYear = tx.competenceYear;
      const d = new Date(tx.date);
      const isThisMonth = (txCompetenceMonth && txCompetenceYear)
        ? (txCompetenceMonth === month && txCompetenceYear === year)
        : (d.getUTCMonth() + 1 === month && d.getUTCFullYear() === year);

      if (isThisMonth) {
        const acc = accountMap.get(tx.accountId);
        const ratio = getAccountUserRatio(acc);
        monthlyIncome += tx.amount * ratio;
      }
    }

    // Se no mês atual ainda não caiu salário (ex: início do mês), busca histórico típico
    if (monthlyIncome <= 0) {
      const incomeByMonth = new Map<string, number>();
      for (const tx of transactions) {
        if (tx.status === 'confirmed' && tx.type === 'income' && tx.amount > 0) {
          const mKey = tx.date.substring(0, 7);
          const acc = accountMap.get(tx.accountId);
          const ratio = getAccountUserRatio(acc);
          incomeByMonth.set(mKey, (incomeByMonth.get(mKey) || 0) + (tx.amount * ratio));
        }
      }
      if (incomeByMonth.size > 0) {
        const values = Array.from(incomeByMonth.values());
        monthlyIncome = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
      }
    }
  }

  monthlyIncome = Math.round(monthlyIncome * 100) / 100;

  // ── 2. MAPEAMENTO DE PARCELAS COMPROMETIDAS (MÊS ATUAL) ───────────────
  const committedItems: CommittedItemDetail[] = [];
  const processedInstallmentTxIds = new Set<string>();
  const processedGroupIds = new Set<string>();
  let committedInstallmentsTotal = 0;

  // 2.1 Identifica transações de parcelas já registradas para o mês corrente
  for (const tx of transactions) {
    if (tx.status !== 'confirmed' || tx.type !== 'expense') continue;
    if (isInvoicePayment(tx)) continue;

    const d = new Date(tx.date);
    const txMonth = tx.competenceMonth || (d.getUTCMonth() + 1);
    const txYear = tx.competenceYear || d.getUTCFullYear();

    if (txMonth !== month || txYear !== year) continue;

    const isInst = Boolean(
      tx.isInstallment ||
      tx.installmentGroupId ||
      (tx.installmentTotal && tx.installmentTotal > 1) ||
      /\(\d+\/\d+\)/.test(tx.description) ||
      extractInstallmentFromDescription(tx.description).isInstallment
    );

    if (isInst) {
      processedInstallmentTxIds.add(tx.id);
      if (tx.installmentGroupId) {
        processedGroupIds.add(tx.installmentGroupId);
      }

      const acc = accountMap.get(tx.accountId);
      const ratio = getAccountUserRatio(acc);
      const userAmount = Math.round(tx.amount * ratio * 100) / 100;

      committedInstallmentsTotal += userAmount;

      committedItems.push({
        id: tx.id,
        type: 'installment',
        name: tx.description,
        fullAmount: tx.amount,
        userAmount,
        userShareRatio: ratio,
        accountName: acc?.name,
        cardLastDigits: tx.cardLastDigits || acc?.lastDigits,
        isShared: Boolean(acc?.isShared),
        dueDateOrDate: tx.date,
      });
    }
  }

  // 2.2 Complementa com grupos de parcelas ativas que possam ainda não ter transação gerada para este mês
  for (const group of activeInstallmentGroups) {
    if (processedGroupIds.has(group.groupId)) continue;
    if (group.remainingInstallmentsCount <= 0 || group.isCompleted) continue;

    const acc = accountMap.get(group.accountId);
    const ratio = getAccountUserRatio(acc);
    const userAmount = Math.round(group.monthlyAmount * ratio * 100) / 100;

    committedInstallmentsTotal += userAmount;
    processedGroupIds.add(group.groupId);

    committedItems.push({
      id: `group-${group.groupId}`,
      type: 'installment',
      name: group.description,
      fullAmount: group.monthlyAmount,
      userAmount,
      userShareRatio: ratio,
      accountName: acc?.name,
      cardLastDigits: acc?.lastDigits,
      isShared: Boolean(acc?.isShared),
      dueDateOrDate: group.nextBillingDate,
    });
  }

  committedInstallmentsTotal = Math.round(committedInstallmentsTotal * 100) / 100;

  // ── 3. MAPEAMENTO DE ASSINATURAS E CUSTOS FIXOS COMPROMETIDOS ───────────
  let committedSubscriptionsTotal = 0;
  const processedSubscriptionIds = new Set<string>();

  for (const sub of subscriptions) {
    if (sub.status !== 'active' || sub.type === 'income') continue;

    // Se este mês foi excluído pontualmente
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    if (sub.excludedMonths && sub.excludedMonths.includes(monthKey)) continue;

    // Se for anual, só computa se o mês de cobrança for este mês
    if (sub.cadence === 'yearly') {
      const billDate = sub.nextBillingDate ? new Date(sub.nextBillingDate) : null;
      if (billDate && billDate.getUTCMonth() + 1 !== month) {
        continue;
      }
    }

    const acc = sub.accountId ? accountMap.get(sub.accountId) : undefined;
    const ratio = acc ? getAccountUserRatio(acc) : (sub.isShared ? 0.5 : 1.0);
    const userAmount = Math.round(sub.amount * ratio * 100) / 100;

    committedSubscriptionsTotal += userAmount;
    processedSubscriptionIds.add(sub.id);

    committedItems.push({
      id: `sub-${sub.id}`,
      type: 'subscription',
      name: sub.name,
      fullAmount: sub.amount,
      userAmount,
      userShareRatio: ratio,
      accountName: acc?.name,
      cardLastDigits: acc?.lastDigits,
      isShared: Boolean(acc?.isShared || sub.isShared),
      dueDateOrDate: sub.nextBillingDate,
    });
  }

  committedSubscriptionsTotal = Math.round(committedSubscriptionsTotal * 100) / 100;
  const committedTotal = Math.round((committedInstallmentsTotal + committedSubscriptionsTotal) * 100) / 100;

  // ── 4. GASTOS VARIÁVEIS / DE BOLSO JÁ CONSUMIDOS NO MÊS ───────────────────
  // Prevenção de Dupla Contagem:
  // Exclui quitações de fatura, parcelas já computadas e assinaturas já registradas
  let variableSpentSoFar = 0;

  for (const tx of transactions) {
    if (tx.status !== 'confirmed' || tx.type !== 'expense') continue;
    if (isInvoicePayment(tx)) continue;
    if (processedInstallmentTxIds.has(tx.id)) continue;
    if (tx.subscriptionId && processedSubscriptionIds.has(tx.subscriptionId)) continue;

    const d = new Date(tx.date);
    const txMonth = tx.competenceMonth || (d.getUTCMonth() + 1);
    const txYear = tx.competenceYear || d.getUTCFullYear();

    if (txMonth === month && txYear === year) {
      const acc = accountMap.get(tx.accountId);
      const ratio = getAccountUserRatio(acc);
      variableSpentSoFar += tx.amount * ratio;
    }
  }

  variableSpentSoFar = Math.round(variableSpentSoFar * 100) / 100;

  // ── 5. RESERVAS PLANEJADAS E METAS COM PRAZO ────────────────────────────
  const plannedSavingsAmount = Math.round(monthlyIncome * (Math.max(0, savingsPercent) / 100) * 100) / 100;
  const plannedGoalsAmount = Math.round(goalsDailyNeeded * remainingDays * 100) / 100;

  // ── 6. SALDO LIVRE SEGURO (SAFE-TO-SPEND) E LIMITES ─────────────────────
  // Saldo livre = Renda - Compromissos Inflexíveis - Gastos de Bolso Realizados - Reserva - Metas
  const totalDeductions = committedTotal + variableSpentSoFar + plannedSavingsAmount + plannedGoalsAmount;
  const availableToSpend = Math.max(0, Math.round((monthlyIncome - totalDeductions) * 100) / 100);

  const dailySafeBudget = Math.round((availableToSpend / remainingDays) * 100) / 100;
  const weeklySafeBudget = Math.round(dailySafeBudget * 7 * 100) / 100;

  // Ritmo real de gastos variáveis do dia a dia
  const actualDailyBurnRate = Math.round((variableSpentSoFar / elapsedDays) * 100) / 100;
  const actualWeeklyBurnRate = Math.round(actualDailyBurnRate * 7 * 100) / 100;

  // Sobra final projetada se o usuário respeitar o limite seguro
  const projectedSobra = Math.round(
    (monthlyIncome - (committedTotal + variableSpentSoFar + (dailySafeBudget * remainingDays) + plannedGoalsAmount)) * 100
  ) / 100;

  // ── 7. DIAGNÓSTICO DE VARIAÇÃO (DELTA EXPLANATION) ───────────────────────
  const explanation = generateDeltaExplanation({
    weeklySafeBudget,
    dailySafeBudget,
    committedInstallmentsTotal,
    committedSubscriptionsTotal,
    actualWeeklyBurnRate,
    baselineGoal,
  });

  return {
    monthlyIncome,
    totalDaysInMonth,
    elapsedDays,
    remainingDays,
    committedInstallmentsTotal,
    committedSubscriptionsTotal,
    committedTotal,
    committedItems,
    variableSpentSoFar,
    plannedSavingsAmount,
    plannedGoalsAmount,
    availableToSpend,
    dailySafeBudget,
    weeklySafeBudget,
    actualDailyBurnRate,
    actualWeeklyBurnRate,
    projectedSobra,
    explanation,
  };
}

interface DeltaGenParams {
  weeklySafeBudget: number;
  dailySafeBudget: number;
  committedInstallmentsTotal: number;
  committedSubscriptionsTotal: number;
  actualWeeklyBurnRate: number;
  baselineGoal?: {
    dailyAmount?: number;
    baselineWeeklyAmount?: number;
    committedInstallmentsAmount?: number;
    committedSubscriptionsAmount?: number;
    savingsPercent?: number | null;
  } | null;
}

function generateDeltaExplanation(params: DeltaGenParams): SafeToSpendExplanation {
  const {
    weeklySafeBudget,
    dailySafeBudget,
    committedInstallmentsTotal,
    committedSubscriptionsTotal,
    baselineGoal,
  } = params;

  if (!baselineGoal || !baselineGoal.baselineWeeklyAmount) {
    if (committedInstallmentsTotal > 0 || committedSubscriptionsTotal > 0) {
      return {
        direction: 'stable',
        diffWeekly: 0,
        diffDaily: 0,
        badgeLabel: 'Orçamento Blindado',
        reasonText: `Parcelas (${formatBrlCurrency(committedInstallmentsTotal)}) e assinaturas (${formatBrlCurrency(committedSubscriptionsTotal)}) já descontadas da semana.`,
        primaryCause: 'stable',
      };
    }
    return {
      direction: 'stable',
      diffWeekly: 0,
      diffDaily: 0,
      badgeLabel: 'Limite Atualizado',
      reasonText: 'Limite semanal calculado com base na renda livre e dias restantes.',
      primaryCause: 'stable',
    };
  }

  const prevWeekly = baselineGoal.baselineWeeklyAmount;
  const diffWeekly = Math.round((weeklySafeBudget - prevWeekly) * 100) / 100;
  const diffDaily = Math.round((diffWeekly / 7) * 100) / 100;

  if (Math.abs(diffWeekly) < 2.0) {
    return {
      direction: 'stable',
      diffWeekly: 0,
      diffDaily: 0,
      badgeLabel: 'Em Linha',
      reasonText: 'Seu limite semanal se mantém estável com base nas contas e gastos atuais.',
      primaryCause: 'stable',
    };
  }

  const prevInstallments = baselineGoal.committedInstallmentsAmount ?? 0;
  const installmentsDelta = Math.round((committedInstallmentsTotal - prevInstallments) * 100) / 100;

  const prevSubs = baselineGoal.committedSubscriptionsAmount ?? 0;
  const subsDelta = Math.round((committedSubscriptionsTotal - prevSubs) * 100) / 100;

  if (diffWeekly < 0) {
    // Redução do limite semanal
    if (installmentsDelta > 5) {
      return {
        direction: 'decreased',
        diffWeekly: Math.abs(diffWeekly),
        diffDaily: Math.abs(diffDaily),
        badgeLabel: `-${formatBrlCurrency(Math.abs(diffWeekly))}/sem`,
        reasonText: `Limite reduziu após novas compras parceladas (+${formatBrlCurrency(installmentsDelta)}/mês na sua cota).`,
        primaryCause: 'installments',
      };
    }

    if (subsDelta > 5) {
      return {
        direction: 'decreased',
        diffWeekly: Math.abs(diffWeekly),
        diffDaily: Math.abs(diffDaily),
        badgeLabel: `-${formatBrlCurrency(Math.abs(diffWeekly))}/sem`,
        reasonText: `Limite reduziu após inclusão de assinaturas ou custos fixos (+${formatBrlCurrency(subsDelta)}/mês).`,
        primaryCause: 'subscriptions',
      };
    }

    return {
      direction: 'decreased',
      diffWeekly: Math.abs(diffWeekly),
      diffDaily: Math.abs(diffDaily),
      badgeLabel: `-${formatBrlCurrency(Math.abs(diffWeekly))}/sem`,
      reasonText: 'Limite ajustado para compensar os gastos recentes e manter sua sobra positiva.',
      primaryCause: 'burn_rate',
    };
  } else {
    // Aumento do limite semanal
    if (installmentsDelta < -5) {
      return {
        direction: 'increased',
        diffWeekly,
        diffDaily,
        badgeLabel: `+${formatBrlCurrency(diffWeekly)}/sem`,
        reasonText: `Limite aumentou após quitação de parcelas de cartão (-${formatBrlCurrency(Math.abs(installmentsDelta))} de compromissos).`,
        primaryCause: 'installments',
      };
    }

    if (subsDelta < -5) {
      return {
        direction: 'increased',
        diffWeekly,
        diffDaily,
        badgeLabel: `+${formatBrlCurrency(diffWeekly)}/sem`,
        reasonText: `Limite ampliado após cancelamento de assinaturas recorrentes (-${formatBrlCurrency(Math.abs(subsDelta))}).`,
        primaryCause: 'subscriptions',
      };
    }

    return {
      direction: 'increased',
      diffWeekly,
      diffDaily,
      badgeLabel: `+${formatBrlCurrency(diffWeekly)}/sem`,
      reasonText: 'Limite recalculado para cima graças à economia no ritmo recente de gastos.',
      primaryCause: 'burn_rate',
    };
  }
}
