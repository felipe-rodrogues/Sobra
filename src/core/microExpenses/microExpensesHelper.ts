/**
 * Sobra - Motor de Inteligência para Radar de Microgastos ("Efeito Cafezinho")
 * Análise sem julgamento moral, baseada em economia comportamental e pequenos ajustes graduais.
 */

import { Transaction, Category, Goal } from '../types';
import { filterTransactionsByMonth } from '../calculations';

export type MicroExpenseGroupId = 
  | 'cafes_bakeries' 
  | 'delivery_snacks' 
  | 'rides_mobility' 
  | 'bets_gaming' 
  | 'digital_micro' 
  | 'fees_others' 
  | 'convenience_retail';

export interface MicroExpenseGroup {
  id: MicroExpenseGroupId;
  label: string;
  shortLabel: string;
  emoji: string;
  count: number;
  totalAmount: number;
  transactions: Transaction[];
}

export interface MicroExpensesConfig {
  maxAmount: number; // Limite superior para considerar microgasto (padrão: R$ 30; suporta 10, 15, 20, 25, 30, 40, 50)
  minCountToTrigger: number; // Mínimo de ocorrências para exibir o card (padrão: 5)
  minTotalToTrigger: number; // Mínimo em R$ para justificar o alerta (padrão: R$ 60)
  minDayOfMonth: number; // Dia do mês a partir do qual faz sentido exibir consolidado (padrão: 5)
  ignoredTxIds?: string[]; // IDs de transações ignoradas pelo usuário (ex: marcadas como trabalho ou essencial)
  ignoredMerchants?: string[]; // Estabelecimentos ignorados (ex: padaria do pão diário)
  activeGoal?: Goal | null; // Meta financeira ativa para equivalência motivacional
  excludeWorkCommute?: boolean; // Se true (padrão), protege viagens frequentes de trabalho de entrar na meta de corte
}

export const DEFAULT_MICRO_EXPENSES_CONFIG: MicroExpensesConfig = {
  maxAmount: 30,
  minCountToTrigger: 5,
  minTotalToTrigger: 60,
  minDayOfMonth: 5,
  excludeWorkCommute: true,
};

export interface MicroExpensesAnalysis {
  eligible: boolean;
  reason?: string;
  totalCount: number;
  totalAmount: number;
  averageAmount: number;
  projectedMonthTotal: number;
  projectedAnnualTotal: number;
  suggestedSavingsCount: number;
  suggestedSavingsAmount: number;
  projectedAnnualSavings: number;
  groups: MicroExpenseGroup[];
  transactions: Transaction[];
  thresholdAmount: number;
  dayOfMonth: number;
  // Métricas inteligentes de mobilidade e trabalho
  commuteCount: number;
  commuteAmount: number;
  commuteTransactions: Transaction[];
  // Métricas de padrão temporal (fins de semana vs dias úteis)
  weekendCount: number;
  weekendAmount: number;
  weekendPercentage: number;
  // Equivalência motivacional com meta ativa
  activeGoal?: Goal | null;
  goalName?: string;
  goalImpactText?: string;
}

// Categorias e palavras-chave expressamente excluídas (nunca são cafezinho/supérfluo)
const EXCLUDED_CATEGORY_IDS = new Set([
  'cat-moradia',
  'cat-contas',
  'cat-dividas',
  'cat-saude',
  'cat-farmacia',
  'cat-educ',
  'cat-reserva',
  'cat-invest-futuro',
]);

const EXCLUDED_DESC_KEYWORDS = [
  'aluguel', 'condomínio', 'condominio', 'luz', 'água', 'agua', 'energia', 
  'internet', 'iptu', 'ipva', 'seguro', 'plano de saúde', 'remedio', 'remédio',
  'consulta', 'exame', 'escola', 'faculdade', 'curso', 'fatura', 'empréstimo',
  'emprestimo', 'financiamento', 'ônibus', 'onibus', 'metrô', 'metro', 'bilhete único',
  'recarga transporte', 'pedágio', 'pedagio', 'estacionamento mensal', 'combustivel', 'gasolina', 'etanol'
];

/**
 * Verifica se a descrição se refere a um aplicativo de carona/mobilidade urbana.
 */
export function isRideHailingApp(descLower: string): boolean {
  if (
    descLower.includes('uber eats') || 
    descLower.includes('ubereats') || 
    descLower.includes('99 food') || 
    descLower.includes('99food')
  ) {
    return false;
  }

  // Sanitiza centavos monetários para evitar falsos positivos como 6,99 ou 19,99
  const cleanDesc = descLower.replace(/,\d{2}/g, '').replace(/\.\d{2}/g, '');

  return (
    cleanDesc.includes('uber') ||
    cleanDesc.includes('99app') ||
    cleanDesc.includes('99 moto') ||
    cleanDesc.includes('99moto') ||
    cleanDesc.includes('99pop') ||
    cleanDesc.includes('99 pop') ||
    cleanDesc.includes('99 corrida') ||
    cleanDesc.includes('indrive') ||
    cleanDesc.includes('cabify') ||
    cleanDesc.includes('táxi') ||
    cleanDesc.includes('taxi') ||
    cleanDesc.includes('corrida app') ||
    /\b99\b/.test(cleanDesc)
  );
}

/**
 * Verifica se a transação corresponde a plataformas de apostas ou loterias.
 */
export function isBetOrGambling(descLower: string): boolean {
  return (
    descLower.includes('betano') ||
    descLower.includes('bet365') ||
    descLower.includes('blaze') ||
    descLower.includes('pixbet') ||
    descLower.includes('sportingbet') ||
    descLower.includes('superbet') ||
    descLower.includes('estrellabet') ||
    descLower.includes('estrela bet') ||
    descLower.includes('novibet') ||
    descLower.includes('kto') ||
    descLower.includes('betfair') ||
    descLower.includes('aposta') ||
    descLower.includes('apostas') ||
    descLower.includes('tigrinho') ||
    descLower.includes('loteria') ||
    descLower.includes('loterias caixa') ||
    descLower.includes('mega sena') ||
    descLower.includes('quina') ||
    descLower.includes('lotofacil') ||
    descLower.includes('raspadinha') ||
    /\bbet\b/.test(descLower)
  );
}

/**
 * Verifica se a transação corresponde a microcompras digitais e jogos.
 */
export function isDigitalMicroExpense(descLower: string): boolean {
  return (
    descLower.includes('google play') ||
    descLower.includes('google *') ||
    descLower.includes('g.co/helppay') ||
    descLower.includes('apple.com/bill') ||
    descLower.includes('itunes') ||
    descLower.includes('app store') ||
    descLower.includes('steam') ||
    descLower.includes('playstation') ||
    descLower.includes('psn') ||
    descLower.includes('xbox') ||
    descLower.includes('microsoft*') ||
    descLower.includes('roblox') ||
    descLower.includes('riot games') ||
    descLower.includes('epic games') ||
    descLower.includes('kindle') ||
    descLower.includes('twitch') ||
    descLower.includes('nuuvem')
  );
}

/**
 * Identifica viagens de aplicativo que configuram deslocamento habitual de trabalho
 * (dias úteis de segunda a sexta, com padrão recorrente no mês).
 */
export function identifyWorkCommuteRides(
  transactions: Transaction[],
  maxAmount: number = 30
): Set<string> {
  const commuteTxIds = new Set<string>();
  const rideTxs = transactions.filter(t => {
    if (t.type !== 'expense' || t.amount <= 0 || t.amount > maxAmount) return false;
    const descLower = (t.description || '').toLowerCase();
    return isRideHailingApp(descLower);
  });

  // Filtra viagens ocorridas em dias úteis (segunda = 1 a sexta = 5)
  const weekdayRides = rideTxs.filter(t => {
    const d = new Date(t.date);
    const day = d.getDay();
    return day >= 1 && day <= 5;
  });

  // Se houver 8 ou mais viagens em dias úteis no mês (padrão de ida/volta de trabalho),
  // blindamos essas viagens da rotina laboral
  if (weekdayRides.length >= 8) {
    for (const tx of weekdayRides) {
      commuteTxIds.add(tx.id);
    }
  }

  return commuteTxIds;
}

/**
 * Verifica se uma transação individual qualifica como um microgasto de conveniência/hábito.
 */
export function isMicroExpense(
  tx: Transaction,
  categoryMap: Map<string, Category>,
  maxAmount: number = DEFAULT_MICRO_EXPENSES_CONFIG.maxAmount,
  options?: {
    ignoredTxIds?: Set<string>;
    ignoredMerchants?: string[];
  }
): boolean {
  if (tx.type !== 'expense') return false;
  if (tx.amount <= 0 || tx.amount > maxAmount) return false;
  if (tx.isRefund || tx.isRefunded) return false;

  // Se o usuário marcou essa transação específica para ser ignorada no radar
  if (options?.ignoredTxIds && options.ignoredTxIds.has(tx.id)) {
    return false;
  }

  const descLower = (tx.description || '').toLowerCase();

  // Se o usuário escolheu ignorar esse comerciante/estabelecimento
  if (options?.ignoredMerchants && options.ignoredMerchants.some(m => m && descLower.includes(m.toLowerCase()))) {
    return false;
  }

  // Se a descrição contém termos essenciais explícitos (ex: remédio na farmácia, transporte público), exclui
  if (EXCLUDED_DESC_KEYWORDS.some(k => descLower.includes(k))) {
    return false;
  }

  const category = categoryMap.get(tx.categoryId);
  if (category) {
    if (EXCLUDED_CATEGORY_IDS.has(category.id)) {
      return false;
    }
  }

  return true;
}

/**
 * Classifica a transação em um dos sub-hábitos.
 */
export function classifyMicroExpense(tx: Transaction): MicroExpenseGroupId {
  const desc = (tx.description || '').toLowerCase();

  // 1. Cafés & Padarias
  if (
    desc.includes('caf') || 
    desc.includes('padaria') || 
    desc.includes('panificadora') || 
    desc.includes('starbucks') || 
    desc.includes('espresso') || 
    desc.includes('confeitaria') || 
    desc.includes('bolo') || 
    desc.includes('pão') || 
    desc.includes('pao ') || 
    desc.includes('croissant') || 
    desc.includes('torta') ||
    desc.includes('pingado')
  ) {
    return 'cafes_bakeries';
  }

  // 2. Apps, Lanches e Fast-Food
  if (
    desc.includes('ifood') || 
    desc.includes('rappi') || 
    desc.includes('uber eats') || 
    desc.includes('99 food') || 
    desc.includes('99food') || 
    desc.includes('lanche') || 
    desc.includes('burger') || 
    desc.includes('hamburg') || 
    desc.includes('mcdonald') || 
    desc.includes('subway') || 
    desc.includes('açaí') || 
    desc.includes('acai') || 
    desc.includes('sorvete') || 
    desc.includes('pizza') || 
    desc.includes('pastel') || 
    desc.includes('salgado') ||
    desc.includes('habib') ||
    desc.includes('esfiha') ||
    desc.includes('churros')
  ) {
    return 'delivery_snacks';
  }

  // 3. Corridas Curtas & Apps de Mobilidade
  if (isRideHailingApp(desc)) {
    return 'rides_mobility';
  }

  // 4. Apostas & Jogos (Bets e Loterias)
  if (isBetOrGambling(desc)) {
    return 'bets_gaming';
  }

  // 5. Compras Digitais & Games
  if (isDigitalMicroExpense(desc)) {
    return 'digital_micro';
  }

  // 6. Tarifas e Encargos Bancários Avulsos
  if (
    desc.includes('tarifa') || 
    desc.includes('anuidade') || 
    desc.includes('taxa ') || 
    desc.includes('ted') || 
    desc.includes('doc') || 
    desc.includes('iof')
  ) {
    return 'fees_others';
  }

  // 7. Conveniência e Pequenas Compras (default para compras menores de balcão)
  return 'convenience_retail';
}

/**
 * Analisa a volumetria de microgastos do mês de referência.
 */
export function analyzeMicroExpenses(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date = new Date(),
  customConfig?: Partial<MicroExpensesConfig>
): MicroExpensesAnalysis {
  const config: MicroExpensesConfig = {
    ...DEFAULT_MICRO_EXPENSES_CONFIG,
    ...customConfig,
  };

  const month = referenceDate.getMonth() + 1;
  const year = referenceDate.getFullYear();
  const dayOfMonth = referenceDate.getDate();

  const monthTxs = filterTransactionsByMonth(transactions, month, year);
  const categoryMap = new Map<string, Category>(categories.map(c => [c.id, c]));

  const ignoredSet = new Set<string>(config.ignoredTxIds || []);

  // Blindagem de Transporte de Trabalho: detecta viagens frequentes em dias úteis
  const commuteIds = (config.excludeWorkCommute !== false)
    ? identifyWorkCommuteRides(monthTxs, config.maxAmount)
    : new Set<string>();

  const microTxs: Transaction[] = [];
  const commuteTxs: Transaction[] = [];

  for (const tx of monthTxs) {
    if (commuteIds.has(tx.id)) {
      commuteTxs.push(tx);
      continue; // Protegido: comutação de trabalho não entra na meta de cafezinho
    }

    if (isMicroExpense(tx, categoryMap, config.maxAmount, {
      ignoredTxIds: ignoredSet,
      ignoredMerchants: config.ignoredMerchants,
    })) {
      microTxs.push(tx);
    }
  }

  // Ordena por data decrescente
  microTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  commuteTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalCount = microTxs.length;
  const totalAmount = Math.round(microTxs.reduce((sum, t) => sum + t.amount, 0) * 100) / 100;
  const averageAmount = totalCount > 0 ? Math.round((totalAmount / totalCount) * 100) / 100 : 0;

  // Projeção inteligente baseada nos dias decorridos do mês
  const daysInMonth = new Date(year, month, 0).getDate();
  const currentDay = Math.min(daysInMonth, Math.max(1, dayOfMonth));
  const projectedMonthTotal = Math.round(((totalAmount / currentDay) * daysInMonth) * 100) / 100;
  const projectedAnnualTotal = Math.round(projectedMonthTotal * 12 * 100) / 100;

  // Métricas de transporte de trabalho protegido
  const commuteCount = commuteTxs.length;
  const commuteAmount = Math.round(commuteTxs.reduce((sum, t) => sum + t.amount, 0) * 100) / 100;

  // Métricas de padrão temporal (Fim de Semana vs Dias Úteis)
  let weekendCount = 0;
  let weekendAmount = 0;
  for (const tx of microTxs) {
    const d = new Date(tx.date);
    const day = d.getDay();
    if (day === 0 || day === 6) {
      weekendCount++;
      weekendAmount += tx.amount;
    }
  }
  weekendAmount = Math.round(weekendAmount * 100) / 100;
  const weekendPercentage = totalCount > 0 ? Math.round((weekendCount / totalCount) * 100) : 0;

  // Agrupamento por sub-hábito
  const groupMap: Record<MicroExpenseGroupId, MicroExpenseGroup> = {
    cafes_bakeries: {
      id: 'cafes_bakeries',
      label: 'Padarias & Cafés',
      shortLabel: 'Cafés',
      emoji: '☕',
      count: 0,
      totalAmount: 0,
      transactions: [],
    },
    delivery_snacks: {
      id: 'delivery_snacks',
      label: 'Lanches & Delivery',
      shortLabel: 'Lanches',
      emoji: '🍔',
      count: 0,
      totalAmount: 0,
      transactions: [],
    },
    rides_mobility: {
      id: 'rides_mobility',
      label: 'Corridas Curtas & Apps',
      shortLabel: 'Corridas',
      emoji: '🛵',
      count: 0,
      totalAmount: 0,
      transactions: [],
    },
    bets_gaming: {
      id: 'bets_gaming',
      label: 'Apostas & Loterias',
      shortLabel: 'Apostas',
      emoji: '🎰',
      count: 0,
      totalAmount: 0,
      transactions: [],
    },
    digital_micro: {
      id: 'digital_micro',
      label: 'Compras Digitais & Jogos',
      shortLabel: 'Digitais',
      emoji: '📱',
      count: 0,
      totalAmount: 0,
      transactions: [],
    },
    fees_others: {
      id: 'fees_others',
      label: 'Tarifas & Micro-taxas',
      shortLabel: 'Tarifas',
      emoji: '🏦',
      count: 0,
      totalAmount: 0,
      transactions: [],
    },
    convenience_retail: {
      id: 'convenience_retail',
      label: 'Conveniência & Outros',
      shortLabel: 'Conveniência',
      emoji: '🏪',
      count: 0,
      totalAmount: 0,
      transactions: [],
    },
  };

  for (const tx of microTxs) {
    const groupId = classifyMicroExpense(tx);
    const g = groupMap[groupId];
    g.count += 1;
    g.totalAmount = Math.round((g.totalAmount + tx.amount) * 100) / 100;
    g.transactions.push(tx);
  }

  // Filtra apenas grupos com ocorrências, ordenando pelo maior valor
  const groups = Object.values(groupMap)
    .filter(g => g.count > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);

  // Sugestão de economia marginal (15% das compras ou no mínimo 2, no máximo 6)
  const suggestedSavingsCount = Math.max(2, Math.min(6, Math.round(totalCount * 0.15)));
  const suggestedSavingsAmount = Math.round(suggestedSavingsCount * averageAmount);
  const projectedAnnualSavings = suggestedSavingsAmount * 12;

  // Equivalência motivacional com meta ativa
  let goalName: string | undefined;
  let goalImpactText: string | undefined;
  if (config.activeGoal && !config.activeGoal.isCompleted && config.activeGoal.name) {
    goalName = config.activeGoal.name;
    goalImpactText = `para acelerar sua meta "${config.activeGoal.name}" 🎯`;
  } else {
    goalImpactText = 'a mais na sua reserva';
  }

  // Critérios de elegibilidade para exibição calma (sem ruído quando irrelevante)
  let eligible = true;
  let reason: string | undefined;

  if (dayOfMonth < config.minDayOfMonth && totalCount < 3) {
    eligible = false;
    reason = `Aguardando início do ciclo até o dia ${config.minDayOfMonth} do mês.`;
  } else if (totalCount < config.minCountToTrigger) {
    eligible = false;
    reason = `Poucos microgastos registrados (${totalCount} de ${config.minCountToTrigger} necessários para relevância).`;
  } else if (totalAmount < config.minTotalToTrigger) {
    eligible = false;
    reason = `Volume financeiro de microgastos baixo (R$ ${totalAmount.toFixed(2)}).`;
  }

  return {
    eligible,
    reason,
    totalCount,
    totalAmount,
    averageAmount,
    projectedMonthTotal,
    projectedAnnualTotal,
    suggestedSavingsCount,
    suggestedSavingsAmount,
    projectedAnnualSavings,
    groups,
    transactions: microTxs,
    thresholdAmount: config.maxAmount,
    dayOfMonth,
    commuteCount,
    commuteAmount,
    commuteTransactions: commuteTxs,
    weekendCount,
    weekendAmount,
    weekendPercentage,
    activeGoal: config.activeGoal,
    goalName,
    goalImpactText,
  };
}
