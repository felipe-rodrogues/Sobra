/**
 * Sobra - Motor de Cálculo dos 3 Baldes (Realidade BR)
 * 
 * Regras dinâmicas adaptadas à realidade brasileira:
 * - Faixas baseadas em renda real
 * - Cascata de resolução de renda mensal (Manual -> Mês Atual -> Média Histórica -> Salário Mínimo)
 * - Proporções recomendadas acolhedoras (80/15/5 até 50/30/20)
 * - Ritmo diário de queima e alertas sem julgamento
 */

import { 
  Category, 
  Transaction, 
  Goal, 
  GoalContribution, 
  Account, 
  CategoryBucket, 
  ThreeBucketsConfig, 
  ThreeBucketsSummary, 
  BucketCalculation 
} from '../types';
import { getEffectiveTransactionAmount, filterTransactionsByMonth, isInvoicePayment } from '../calculations';

// Salário Mínimo Nacional de Referência (Base BR)
export const MINIMUM_WAGE_BR = 1518.00;

export interface RecommendedPercentages {
  essentialsPct: number;
  lifestylePct: number;
  futurePct: number;
  tierName: string;
  rationale: string;
}

/**
 * Retorna as proporções recomendadas com base na renda líquida real
 */
export function getRecommendedBucketPercentages(monthlyIncome: number): RecommendedPercentages {
  if (monthlyIncome <= 2800) {
    return {
      essentialsPct: 80,
      lifestylePct: 15,
      futurePct: 5,
      tierName: 'Proteção Básica',
      rationale: 'O foco aqui é proteger o essencial e manter as contas em dia. Guardar 5% já é uma grande conquista.',
    };
  }

  if (monthlyIncome <= 6000) {
    return {
      essentialsPct: 70,
      lifestylePct: 20,
      futurePct: 10,
      tierName: 'Construção de Fôlego',
      rationale: 'Base essencial equilibrada e início da sua Reserva de Emergência para imprevistos.',
    };
  }

  if (monthlyIncome <= 12000) {
    return {
      essentialsPct: 60,
      lifestylePct: 25,
      futurePct: 15,
      tierName: 'Consolidação',
      rationale: 'Espaço confortável para equilibrar bem-estar diário e metas financeiras consistentes.',
    };
  }

  return {
    essentialsPct: 50,
    lifestylePct: 30,
    futurePct: 20,
    tierName: 'Aceleração Patrimonial',
    rationale: 'Proporção clássica equilibrada para acelerar investimentos e conquistas de longo prazo.',
  };
}

/**
 * Resolve a renda de referência pela cascata de prioridades:
 * 1. Renda explícita informada pelo usuário na configuração
 * 2. Receitas confirmadas do mês atual
 * 3. Média histórica de receitas dos últimos 3 meses
 * 4. Salário mínimo nacional como fallback seguro
 */
export function resolveReferenceIncome(
  transactions: Transaction[],
  month: number,
  year: number,
  explicitIncome?: number,
  accounts?: Account[]
): { income: number; source: 'manual' | 'current_month' | 'historical_average' | 'minimum_wage' } {
  // 1. Renda Manual
  if (explicitIncome && explicitIncome > 0) {
    return {
      income: Math.round(explicitIncome * 100) / 100,
      source: 'manual',
    };
  }

  // 2. Receitas confirmadas no mês atual
  const currentMonthTxns = filterTransactionsByMonth(transactions, month, year)
    .filter(t => t.type === 'income');

  let currentMonthIncome = 0;
  for (const t of currentMonthTxns) {
    currentMonthIncome += getEffectiveTransactionAmount(t, accounts);
  }

  if (currentMonthIncome > 0) {
    return {
      income: Math.round(currentMonthIncome * 100) / 100,
      source: 'current_month',
    };
  }

  // 3. Média histórica de receitas dos últimos meses
  const incomeByMonth = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.status === 'confirmed' && tx.type === 'income' && tx.amount > 0) {
      const monthKey = tx.date.substring(0, 7);
      const effective = getEffectiveTransactionAmount(tx, accounts);
      incomeByMonth.set(monthKey, (incomeByMonth.get(monthKey) || 0) + effective);
    }
  }

  if (incomeByMonth.size > 0) {
    const values = Array.from(incomeByMonth.values());
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (avg > 0) {
      return {
        income: Math.round(avg * 100) / 100,
        source: 'historical_average',
      };
    }
  }

  // 4. Fallback Salário Mínimo
  return {
    income: MINIMUM_WAGE_BR,
    source: 'minimum_wage',
  };
}

export interface CalculateThreeBucketsParams {
  categories: Category[];
  transactions: Transaction[];
  goals?: Goal[];
  goalContributions?: GoalContribution[];
  month: number;
  year: number;
  accounts?: Account[];
  config?: Partial<ThreeBucketsConfig> | null;
  currentDate?: Date;
}

/**
 * Calcula o resumo consolidado dos 3 Baldes para o mês informado
 */
export function calculateThreeBucketsSummary(params: CalculateThreeBucketsParams): ThreeBucketsSummary {
  const {
    categories,
    transactions,
    goals = [],
    goalContributions = [],
    month,
    year,
    accounts = [],
    config,
    currentDate = new Date(),
  } = params;

  // 1. Resolução da Renda Base
  const { income: referenceIncome, source: incomeSource } = resolveReferenceIncome(
    transactions,
    month,
    year,
    config?.customIncome,
    accounts
  );

  // 2. Determinação das Proporções (%)
  const recommended = getRecommendedBucketPercentages(referenceIncome);
  const isCustom = Boolean(
    config?.isCustomized &&
    typeof config?.essentialsPct === 'number' &&
    typeof config?.lifestylePct === 'number' &&
    typeof config?.futurePct === 'number' &&
    Math.round(config.essentialsPct + config.lifestylePct + config.futurePct) === 100
  );

  const essentialsPct = isCustom ? config!.essentialsPct! : recommended.essentialsPct;
  const lifestylePct = isCustom ? config!.lifestylePct! : recommended.lifestylePct;
  const futurePct = isCustom ? config!.futurePct! : recommended.futurePct;

  // 3. Tetos em R$
  const essentialsTarget = Math.round(((referenceIncome * essentialsPct) / 100) * 100) / 100;
  const lifestyleTarget = Math.round(((referenceIncome * lifestylePct) / 100) * 100) / 100;
  const futureTarget = Math.round(((referenceIncome * futurePct) / 100) * 100) / 100;

  // 4. Dias restantes no mês (para cálculo do ritmo diário de queima)
  const daysInMonth = new Date(year, month, 0).getDate();
  const currentDay = currentDate.getFullYear() === year && currentDate.getMonth() + 1 === month
    ? currentDate.getDate()
    : 1;
  const remainingDays = Math.max(1, daysInMonth - currentDay + 1);

  // 5. Agrupamento de Gastos por Categoria
  const monthTxns = filterTransactionsByMonth(transactions, month, year);
  const expenseTxns = monthTxns.filter(t => t.type === 'expense' && !isInvoicePayment(t));

  const categoryMap = new Map<string, Category>();
  categories.forEach(c => categoryMap.set(c.id, c));

  const spentByCategory = new Map<string, number>();
  for (const tx of expenseTxns) {
    const effective = getEffectiveTransactionAmount(tx, accounts);
    spentByCategory.set(tx.categoryId, (spentByCategory.get(tx.categoryId) || 0) + effective);
  }

  // Separar gastos por balde
  interface BucketCategoryItem {
    categoryId: string;
    categoryName: string;
    spent: number;
    color: string;
    icon: string;
  }

  const essentialsCategories: BucketCategoryItem[] = [];
  const lifestyleCategories: BucketCategoryItem[] = [];
  const futureCategories: BucketCategoryItem[] = [];

  let essentialsSpent = 0;
  let lifestyleSpent = 0;
  let futureSpent = 0;

  // Processar categorias com gastos ou cadastradas
  for (const [catId, amount] of spentByCategory.entries()) {
    const cat = categoryMap.get(catId);
    const bucket: CategoryBucket = cat?.bucket || 'essentials';
    const item: BucketCategoryItem = {
      categoryId: catId,
      categoryName: cat?.name || 'Sem Categoria',
      spent: Math.round(amount * 100) / 100,
      color: cat?.color || '#94A3B8',
      icon: cat?.icon || 'Tag',
    };

    if (bucket === 'lifestyle') {
      lifestyleSpent += amount;
      lifestyleCategories.push(item);
    } else if (bucket === 'future') {
      futureSpent += amount;
      futureCategories.push(item);
    } else {
      essentialsSpent += amount;
      essentialsCategories.push(item);
    }
  }

  // 6. Contabilizar Aportes em Metas no Balde Futuro
  const monthContributions = goalContributions.filter(gc => {
    const gcDate = new Date(gc.date);
    return gcDate.getUTCMonth() + 1 === month && gcDate.getUTCFullYear() === year;
  });

  let goalContributionsTotal = 0;
  for (const gc of monthContributions) {
    goalContributionsTotal += gc.amount;
  }

  if (goalContributionsTotal > 0) {
    futureSpent += goalContributionsTotal;
    futureCategories.push({
      categoryId: 'meta-aportes',
      categoryName: 'Aportes em Metas',
      spent: Math.round(goalContributionsTotal * 100) / 100,
      color: '#22C55E',
      icon: 'Target',
    });
  }

  // Ordenar categorias por valor gasto decrescente
  essentialsCategories.sort((a, b) => b.spent - a.spent);
  lifestyleCategories.sort((a, b) => b.spent - a.spent);
  futureCategories.sort((a, b) => b.spent - a.spent);

  // 7. Função auxiliar para montar cada BucketCalculation
  const buildBucket = (
    bucket: CategoryBucket,
    name: string,
    tagline: string,
    icon: string,
    color: string,
    percentageTarget: number,
    targetAmount: number,
    spentAmount: number,
    catList: BucketCategoryItem[]
  ): BucketCalculation => {
    const roundedSpent = Math.round(spentAmount * 100) / 100;
    const remaining = Math.max(0, targetAmount - roundedSpent);
    const percentage = targetAmount > 0 ? Math.round((roundedSpent / targetAmount) * 100) : 0;
    const dailyAvailable = remainingDays > 0 ? Math.round((remaining / remainingDays) * 100) / 100 : 0;

    let status: 'normal' | 'warning' | 'danger' = 'normal';
    if (roundedSpent > targetAmount && targetAmount > 0) {
      status = 'danger';
    } else if (percentage >= 80) {
      status = 'warning';
    }

    return {
      bucket,
      name,
      tagline,
      icon,
      color,
      percentageTarget,
      targetAmount,
      spentAmount: roundedSpent,
      remainingAmount: Math.round(remaining * 100) / 100,
      percentageSpent: percentage,
      dailyAvailableRestOfMonth: dailyAvailable,
      status,
      categories: catList,
    };
  };

  const essentialsBucket = buildBucket(
    'essentials',
    'Essenciais',
    'Pra Viver · Moradia, saúde e mercado',
    'Home',
    '#78BC71',
    essentialsPct,
    essentialsTarget,
    essentialsSpent,
    essentialsCategories
  );

  const lifestyleBucket = buildBucket(
    'lifestyle',
    'Estilo de Vida',
    'Pra Curtir · Lazer, compras e delivery',
    'Sparkles',
    '#F97316',
    lifestylePct,
    lifestyleTarget,
    lifestyleSpent,
    lifestyleCategories
  );

  const futureBucket = buildBucket(
    'future',
    'Futuro & Sobra',
    'Pra Amanhã · Reserva e metas',
    'ShieldCheck',
    '#22C55E',
    futurePct,
    futureTarget,
    futureSpent,
    futureCategories
  );

  const totalSpent = Math.round((essentialsSpent + lifestyleSpent + futureSpent) * 100) / 100;
  const totalTarget = Math.round((essentialsTarget + lifestyleTarget + futureTarget) * 100) / 100;
  const overallSobra = Math.round((referenceIncome - totalSpent) * 100) / 100;

  return {
    referenceIncome,
    incomeSource,
    totalSpent,
    totalTarget,
    overallSobra,
    buckets: {
      essentials: essentialsBucket,
      lifestyle: lifestyleBucket,
      future: futureBucket,
    },
  };
}
