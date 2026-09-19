/**
 * Sobra - Cálculos Financeiros
 * Funções puras para cálculo de saldos, fluxo de caixa, orçamentos e metas
 */

import { 
  Account, 
  Transaction, 
  Budget, 
  Category, 
  BudgetCalculationResult, 
  Goal, 
  GoalCalculationResult 
} from './types';

export interface FinancialSummary {
  cashBalance: number;       // Dinheiro disponível em contas correntes, poupança, investimentos e espécie
  creditCardDebt: number;    // Faturas de cartões de crédito em aberto a pagar
  netSobra: number;          // Sobra Líquida Real (cashBalance - creditCardDebt)
}

/**
 * Calcula o resumo patrimonial detalhado:
 * - Total disponível em contas bancárias e dinheiro
 * - Total de faturas de cartões de crédito a pagar
 * - Sobra Líquida (o que realmente sobra após pagar os cartões)
 */
export function calculateFinancialSummary(accounts: Account[]): FinancialSummary {
  let cashBalance = 0;
  let creditCardDebt = 0;

  for (const account of accounts) {
    if (account.type === 'credit_card') {
      // Fatura em aberto do cartão é tratada como dívida pendente
      creditCardDebt += Math.abs(account.balance);
    } else {
      cashBalance += account.balance;
    }
  }

  const netSobra = Math.round((cashBalance - creditCardDebt) * 100) / 100;

  return {
    cashBalance: Math.round(cashBalance * 100) / 100,
    creditCardDebt: Math.round(creditCardDebt * 100) / 100,
    netSobra,
  };
}

/**
 * Calcula a Sobra Líquida Consolidada (Saldo em contas - Faturas de cartão).
 */
export function calculateConsolidatedBalance(accounts: Account[]): number {
  return calculateFinancialSummary(accounts).netSobra;
}

/**
 * Filtra transações confirmadas por período (mês e ano).
 */
export function filterTransactionsByMonth(
  transactions: Transaction[], 
  month: number, 
  year: number
): Transaction[] {
  return transactions.filter(t => {
    if (t.status !== 'confirmed') return false;
    const date = new Date(t.date);
    // getMonth() retorna 0-11, month é 1-12
    return date.getUTCMonth() + 1 === month && date.getUTCFullYear() === year;
  });
}

/**
 * Calcula o resumo mensal de receitas, despesas e saldo líquido.
 */
export function calculateMonthlySummary(
  transactions: Transaction[],
  month: number,
  year: number
): { income: number; expense: number; net: number; transactionCount: number } {
  const monthTxns = filterTransactionsByMonth(transactions, month, year);

  let income = 0;
  let expense = 0;

  for (const txn of monthTxns) {
    if (txn.type === 'income') {
      income += txn.amount;
    } else if (txn.type === 'expense') {
      expense += txn.amount;
    }
    // 'transfer' entre contas próprias não afeta o resultado líquido
  }

  return {
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    net: Math.round((income - expense) * 100) / 100,
    transactionCount: monthTxns.length,
  };
}

/**
 * Agrupa despesas por categoria em um determinado mês/ano.
 */
export function calculateSpendingByCategory(
  transactions: Transaction[],
  categories: Category[],
  month: number,
  year: number
): Array<{ categoryId: string; categoryName: string; color: string; icon: string; amount: number; percentage: number }> {
  const monthTxns = filterTransactionsByMonth(transactions, month, year)
    .filter(t => t.type === 'expense');

  const categoryMap = new Map<string, Category>();
  categories.forEach(c => categoryMap.set(c.id, c));

  const spendingMap = new Map<string, number>();
  let totalExpense = 0;

  for (const txn of monthTxns) {
    totalExpense += txn.amount;
    const current = spendingMap.get(txn.categoryId) || 0;
    spendingMap.set(txn.categoryId, current + txn.amount);
  }

  const result = Array.from(spendingMap.entries()).map(([catId, amount]) => {
    const cat = categoryMap.get(catId);
    return {
      categoryId: catId,
      categoryName: cat?.name || 'Sem Categoria',
      color: cat?.color || '#94A3B8',
      icon: cat?.icon || 'Tag',
      amount: Math.round(amount * 100) / 100,
      percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 1000) / 10 : 0,
    };
  });

  return result.sort((a, b) => b.amount - a.amount);
}

/**
 * Calcula o status de alerta de orçamento:
 * - 'normal': gasto < 80% do limite
 * - 'warning': gasto entre 80% e 100% do limite
 * - 'danger': gasto > 100% (ultrapassou o limite)
 */
export function calculateBudgetStatuses(
  budgets: Budget[],
  categories: Category[],
  transactions: Transaction[],
  month: number,
  year: number
): BudgetCalculationResult[] {
  const monthTxns = filterTransactionsByMonth(transactions, month, year)
    .filter(t => t.type === 'expense');

  const categoryMap = new Map<string, Category>();
  categories.forEach(c => categoryMap.set(c.id, c));

  // Mapa de gastos reais por categoria
  const spendingMap = new Map<string, number>();
  for (const txn of monthTxns) {
    const current = spendingMap.get(txn.categoryId) || 0;
    spendingMap.set(txn.categoryId, current + txn.amount);
  }

  // Filtrar orçamentos do mês corrente ou gerais
  const activeBudgets = budgets.filter(b => b.month === month && b.year === year);

  return activeBudgets.map(budget => {
    const category = categoryMap.get(budget.categoryId);
    const spent = spendingMap.get(budget.categoryId) || 0;
    const limit = budget.monthlyLimit;
    const remaining = Math.max(0, limit - spent);
    const percentage = limit > 0 ? Math.round((spent / limit) * 1000) / 10 : 0;

    let status: 'normal' | 'warning' | 'danger' = 'normal';
    if (spent > limit) {
      status = 'danger';
    } else if (percentage >= 80) {
      status = 'warning';
    }

    return {
      categoryId: budget.categoryId,
      categoryName: category?.name || 'Geral',
      categoryIcon: category?.icon || 'Tag',
      categoryColor: category?.color || '#3B82F6',
      monthlyLimit: limit,
      spentAmount: Math.round(spent * 100) / 100,
      remainingAmount: Math.round(remaining * 100) / 100,
      percentageSpent: percentage,
      status,
    };
  });
}

/**
 * Calcula o progresso de uma meta financeira.
 */
export function calculateGoalProgress(goal: Goal, currentDate = new Date()): GoalCalculationResult {
  let daysRemaining: number | null = null;
  let isOverdue = false;

  if (goal.targetDate && goal.targetDate.trim()) {
    const targetDate = new Date(goal.targetDate);
    if (!isNaN(targetDate.getTime())) {
      const diffTime = targetDate.getTime() - currentDate.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isOverdue = daysRemaining < 0 && goal.currentAmount < goal.targetAmount;
    }
  }
  
  const percentage = goal.targetAmount > 0 
    ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 1000) / 10)
    : 0;

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

  return {
    id: goal.id,
    name: goal.name,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    remainingAmount: Math.round(remaining * 100) / 100,
    percentageCompleted: percentage,
    daysRemaining,
    isCompleted: goal.isCompleted || goal.currentAmount >= goal.targetAmount,
    isOverdue,
  };
}

export interface HistoricalMonthlyData {
  month: number; // 1 - 12
  year: number;
  label: string; // "Mai", "Jun"
  fullLabel: string; // "Mai/26"
  income: number;
  expense: number;
  net: number; // income - expense
  isSurplus: boolean; // net >= 0
  isCurrentMonth: boolean;
}

const SHORT_MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

/**
 * Calcula o resumo histórico dos últimos N meses (padrão 6 meses) para gráficos de evolução.
 */
export function calculateHistoricalMonthlySummary(
  transactions: Transaction[],
  monthCount: number = 6,
  referenceDate: Date = new Date()
): HistoricalMonthlyData[] {
  const result: HistoricalMonthlyData[] = [];
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth(); // 0-11

  for (let i = monthCount - 1; i >= 0; i--) {
    // Subtrair i meses a partir do mês de referência
    const d = new Date(refYear, refMonth - i, 1);
    const m = d.getMonth() + 1; // 1 - 12
    const y = d.getFullYear();

    const summary = calculateMonthlySummary(transactions, m, y);
    const net = Math.round((summary.income - summary.expense) * 100) / 100;
    const isCurrent = (m === (refMonth + 1)) && (y === refYear);

    result.push({
      month: m,
      year: y,
      label: SHORT_MONTHS[m - 1],
      fullLabel: `${SHORT_MONTHS[m - 1]}/${String(y).slice(-2)}`,
      income: summary.income,
      expense: summary.expense,
      net,
      isSurplus: net >= 0,
      isCurrentMonth: isCurrent,
    });
  }

  return result;
}

export interface BurnRateProjection {
  currentDay: number;
  totalDaysInMonth: number;
  elapsedDays: number;
  remainingDays: number;
  monthProgressPercent: number;
  currentExpense: number;
  currentIncome: number;
  dailyBurnRate: number; // Gasto médio diário até hoje
  projectedExpense: number; // Gasto total estimado ao final do mês
  projectedSobra: number; // Sobra estimada no dia 30/31
  recommendedDailyBudget: number; // Teto diário recomendado para os dias restantes
  paceStatus: 'surplus' | 'on_track' | 'fast_burn';
  paceMessage: string;
}

/**
 * Calcula a taxa de queima diária (Burn Rate) e projeta a Sobra Líquida ao final do mês.
 */
export function calculateBurnRateProjection(
  transactions: Transaction[],
  referenceDate: Date = new Date()
): BurnRateProjection {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1; // 1 - 12
  const currentDay = referenceDate.getDate();

  // Quantidade total de dias no mês
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const elapsedDays = Math.max(1, currentDay);
  const remainingDays = Math.max(0, totalDaysInMonth - currentDay);
  const monthProgressPercent = Math.round((currentDay / totalDaysInMonth) * 100);

  const monthlySummary = calculateMonthlySummary(transactions, month, year);
  const currentExpense = monthlySummary.expense;
  const currentIncome = monthlySummary.income;

  // Gasto médio por dia
  const dailyBurnRate = Math.round((currentExpense / elapsedDays) * 100) / 100;

  // Projeção de gastos totais do mês
  const projectedExpense = Math.round((currentExpense + (dailyBurnRate * remainingDays)) * 100) / 100;

  // Projeção da sobra (Receitas - Despesas Projetadas)
  const projectedSobra = Math.round((currentIncome - projectedExpense) * 100) / 100;

  // Saldo ainda disponível para gastar sem ficar no vermelho
  const availableToSpend = Math.max(0, currentIncome - currentExpense);
  const recommendedDailyBudget = remainingDays > 0 
    ? Math.round((availableToSpend / remainingDays) * 100) / 100 
    : 0;

  let paceStatus: BurnRateProjection['paceStatus'] = 'on_track';
  let paceMessage = '';

  if (currentIncome === 0 && currentExpense > 0) {
    paceStatus = 'fast_burn';
    paceMessage = 'Sem receitas registradas no mês até o momento.';
  } else if (projectedSobra < 0) {
    paceStatus = 'fast_burn';
    paceMessage = `No ritmo atual, as despesas ultrapassarão as receitas em R$ ${Math.abs(projectedSobra).toFixed(2).replace('.', ',')}.`;
  } else if (projectedSobra >= currentIncome * 0.25) {
    paceStatus = 'surplus';
    paceMessage = 'Excelente! Você está projetando poupar mais de 25% da sua renda este mês.';
  } else {
    paceStatus = 'on_track';
    paceMessage = 'Dentro do esperado para fechar o mês no azul com sobra positiva.';
  }

  return {
    currentDay,
    totalDaysInMonth,
    elapsedDays,
    remainingDays,
    monthProgressPercent,
    currentExpense,
    currentIncome,
    dailyBurnRate,
    projectedExpense,
    projectedSobra,
    recommendedDailyBudget,
    paceStatus,
    paceMessage,
  };
}

export interface BalanceTrendResult {
  percentageChange: number;
  isPositive: boolean;
  hasPreviousData: boolean;
  label: string;
  comparisonText: string;
}

/**
 * Calcula a tendência percentual real do mês atual em comparação com o mês anterior
 * baseado no balanço líquido de transações do usuário.
 */
export function calculateBalanceTrend(
  transactions: Transaction[],
  currentMonth: number,
  currentYear: number
): BalanceTrendResult {
  const currentSummary = calculateMonthlySummary(transactions, currentMonth, currentYear);
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const prevSummary = calculateMonthlySummary(transactions, prevMonth, prevYear);

  if (prevSummary.transactionCount === 0 && currentSummary.transactionCount === 0) {
    return {
      percentageChange: 0,
      isPositive: true,
      hasPreviousData: false,
      label: '0,0%',
      comparisonText: 'sem movimentações no período',
    };
  }

  if (prevSummary.transactionCount === 0) {
    return {
      percentageChange: 0,
      isPositive: true,
      hasPreviousData: false,
      label: 'Novo ciclo',
      comparisonText: 'primeiro mês registrado',
    };
  }

  const prevNet = prevSummary.net;
  const currNet = currentSummary.net;

  let percentageChange = 0;
  if (Math.abs(prevNet) > 0.01) {
    percentageChange = Math.round(((currNet - prevNet) / Math.abs(prevNet)) * 1000) / 10;
  } else if (prevSummary.income > 0) {
    percentageChange = Math.round(((currentSummary.income - prevSummary.income) / prevSummary.income) * 1000) / 10;
  } else {
    percentageChange = currNet >= 0 ? 100 : -100;
  }

  // Limitar valores extremos para exibição elegante
  if (percentageChange > 999) percentageChange = 999;
  if (percentageChange < -999) percentageChange = -999;

  const isPositive = percentageChange >= 0;
  const formattedSign = isPositive ? '+' : '';
  const label = `${formattedSign}${percentageChange.toFixed(1).replace('.', ',')}%`;

  return {
    percentageChange,
    isPositive,
    hasPreviousData: true,
    label,
    comparisonText: 'em relação ao mês passado',
  };
}

