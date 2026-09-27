/**
 * Sobra - Motor de Inteligência para Radar de Microgastos ("Efeito Cafezinho")
 * Análise sem julgamento moral, baseada em economia comportamental e pequenos ajustes graduais.
 */

import { Transaction, Category } from '../types';
import { filterTransactionsByMonth } from '../calculations';

export type MicroExpenseGroupId = 'cafes_bakeries' | 'delivery_snacks' | 'convenience_retail' | 'fees_others';

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
  maxAmount: number; // Limite superior para considerar microgasto (padrão: R$ 30)
  minCountToTrigger: number; // Mínimo de ocorrências para exibir o card (padrão: 6)
  minTotalToTrigger: number; // Mínimo em R$ para justificar o alerta (padrão: R$ 80)
  minDayOfMonth: number; // Dia do mês a partir do qual faz sentido exibir (padrão: 8)
}

export const DEFAULT_MICRO_EXPENSES_CONFIG: MicroExpensesConfig = {
  maxAmount: 30,
  minCountToTrigger: 6,
  minTotalToTrigger: 80,
  minDayOfMonth: 8,
};

export interface MicroExpensesAnalysis {
  eligible: boolean;
  reason?: string;
  totalCount: number;
  totalAmount: number;
  averageAmount: number;
  projectedAnnualTotal: number;
  suggestedSavingsCount: number;
  suggestedSavingsAmount: number;
  projectedAnnualSavings: number;
  groups: MicroExpenseGroup[];
  transactions: Transaction[];
  thresholdAmount: number;
  dayOfMonth: number;
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
  'recarga transporte', 'pedágio', 'pedagio', 'estacionamento mensal'
];

/**
 * Verifica se uma transação individual qualifica como um microgasto de conveniência/hábito.
 */
export function isMicroExpense(
  tx: Transaction,
  categoryMap: Map<string, Category>,
  maxAmount: number = DEFAULT_MICRO_EXPENSES_CONFIG.maxAmount
): boolean {
  if (tx.type !== 'expense') return false;
  if (tx.amount <= 0 || tx.amount > maxAmount) return false;
  if (tx.isRefund || tx.isRefunded) return false;

  const descLower = (tx.description || '').toLowerCase();

  // Se a descrição contém termos essenciais explícitos (ex: remédio na farmácia), exclui
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
 * Classifica a transação em um dos 4 sub-hábitos acolhedores.
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
    desc.includes('torta')
  ) {
    return 'cafes_bakeries';
  }

  // 2. Apps, Lanches e Fast-Food
  if (
    desc.includes('ifood') || 
    desc.includes('rappi') || 
    desc.includes('uber eats') || 
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
    desc.includes('salgado')
  ) {
    return 'delivery_snacks';
  }

  // 3. Tarifas e Encargos Bancários Avulsos
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

  // 4. Conveniência e Pequenas Compras (default para compras menores de balcão)
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

  const microTxs: Transaction[] = [];

  for (const tx of monthTxs) {
    if (isMicroExpense(tx, categoryMap, config.maxAmount)) {
      microTxs.push(tx);
    }
  }

  // Ordena por data decrescente
  microTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalCount = microTxs.length;
  const totalAmount = Math.round(microTxs.reduce((sum, t) => sum + t.amount, 0) * 100) / 100;
  const averageAmount = totalCount > 0 ? Math.round((totalAmount / totalCount) * 100) / 100 : 0;
  const projectedAnnualTotal = Math.round(totalAmount * 12 * 100) / 100;

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
      label: 'Lanches & Apps',
      shortLabel: 'Lanches',
      emoji: '🛵',
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
    fees_others: {
      id: 'fees_others',
      label: 'Tarifas & Micro-taxas',
      shortLabel: 'Tarifas',
      emoji: '🏦',
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

  // Sugestão de economia marginal (15% das compras ou no mínimo 3, no máximo 6)
  const suggestedSavingsCount = Math.max(3, Math.min(6, Math.round(totalCount * 0.15)));
  const suggestedSavingsAmount = Math.round(suggestedSavingsCount * averageAmount);
  const projectedAnnualSavings = suggestedSavingsAmount * 12;

  // Critérios de elegibilidade para exibição calma (sem ruído quando irrelevante)
  let eligible = true;
  let reason: string | undefined;

  if (dayOfMonth < config.minDayOfMonth) {
    eligible = false;
    reason = `Aguardando acúmulo de dados até o dia ${config.minDayOfMonth} do mês.`;
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
    projectedAnnualTotal,
    suggestedSavingsCount,
    suggestedSavingsAmount,
    projectedAnnualSavings,
    groups,
    transactions: microTxs,
    thresholdAmount: config.maxAmount,
    dayOfMonth,
  };
}
