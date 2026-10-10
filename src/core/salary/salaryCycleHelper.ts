/**
 * Sobra - Utilitário de Ciclo Salarial e Competência Financeira
 * 
 * Permite que receitas recebidas no final do mês (ex: dias 25 a 31),
 * como salário antecipado ou pro-labore recorrente, sejam alocadas
 * com precisão na competência do mês seguinte.
 */

import { Transaction, Subscription, Category } from '../types';

export const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const MONTH_NAMES_SHORT_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export interface SalaryAdvanceDetectionResult {
  isAdvance: boolean;
  competenceMonth: number; // 1 - 12
  competenceYear: number;  // YYYY
  targetMonthName: string; // Ex: 'Novembro'
  reason: string;
  matchedSubscription?: Subscription;
}

/**
 * Calcula o próximo mês e ano a partir de uma data de referência
 */
export function getNextMonthAndYear(date: Date): { month: number; year: number } {
  const currentMonth = date.getMonth() + 1; // 1 - 12
  const currentYear = date.getFullYear();

  if (currentMonth === 12) {
    return { month: 1, year: currentYear + 1 };
  }
  return { month: currentMonth + 1, year: currentYear };
}

/**
 * Retorna o mês e ano efetivos de competência de uma transação.
 * Se a transação tiver competenceMonth/Year definidos, usa-os;
 * caso contrário, extrai da data UTC da transação.
 */
export function getEffectiveTransactionCompetence(tx: Transaction): { month: number; year: number } {
  if (tx.competenceMonth && tx.competenceYear) {
    return {
      month: tx.competenceMonth,
      year: tx.competenceYear,
    };
  }

  const d = new Date(tx.date);
  return {
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
  };
}

/**
 * Detecta de forma inteligente se uma receita recebida no final do mês
 * corresponde ao salário do ciclo seguinte.
 */
export function detectSalaryAdvance(
  tx: Partial<Transaction>,
  subscriptions: Subscription[] = [],
  categories: Category[] = []
): SalaryAdvanceDetectionResult {
  if (!tx.date || tx.type !== 'income' || !tx.amount || tx.amount <= 0) {
    const fallbackDate = tx.date ? new Date(tx.date) : new Date();
    return {
      isAdvance: false,
      competenceMonth: fallbackDate.getMonth() + 1,
      competenceYear: fallbackDate.getFullYear(),
      targetMonthName: MONTH_NAMES_PT[fallbackDate.getMonth()] || '',
      reason: 'Não é receita ou valor inválido',
    };
  }

  const date = new Date(tx.date);
  const day = date.getDate();
  const nextCycle = getNextMonthAndYear(date);
  const targetMonthName = MONTH_NAMES_PT[nextCycle.month - 1] || '';

  // Só avalia antecipação a partir do dia 25 do mês
  if (day < 25) {
    return {
      isAdvance: false,
      competenceMonth: date.getMonth() + 1,
      competenceYear: date.getFullYear(),
      targetMonthName: MONTH_NAMES_PT[date.getMonth()] || '',
      reason: 'Receita recebida antes do dia 25 (ciclo corrente)',
    };
  }

  const descLower = (tx.description || '').toLowerCase();
  const cat = categories.find(c => c.id === tx.categoryId);
  const isSalaryCategory = cat ? cat.name.toLowerCase().includes('salár') || cat.name.toLowerCase().includes('salar') : false;

  // 1. Procura match com Assinatura / Recorrência de Receita Ativa (Salário)
  const activeIncomeSubs = subscriptions.filter(s => s.status === 'active' && s.type === 'income');
  for (const sub of activeIncomeSubs) {
    const diff = Math.abs(sub.amount - tx.amount);
    const tolerance = Math.max(15, sub.amount * 0.08); // Tolerância de até 8% por variações de descontos/INSS

    if (diff <= tolerance) {
      return {
        isAdvance: true,
        competenceMonth: nextCycle.month,
        competenceYear: nextCycle.year,
        targetMonthName,
        reason: `Valor compatível com sua receita recorrente "${sub.name}"`,
        matchedSubscription: sub,
      };
    }
  }

  // 2. Procura termos explícitos de salário ou pro-labore no texto ou categoria
  const salaryKeywords = [
    'salár',
    'salar',
    'pro labore',
    'pro-labore',
    'folha de pagamento',
    'folha salarial',
    'holerite',
    'remunera',
    'vencimento salarial',
    'adiantamento salarial',
  ];
  const hasSalaryKeyword = salaryKeywords.some(kw => descLower.includes(kw));

  if (hasSalaryKeyword || isSalaryCategory) {
    return {
      isAdvance: true,
      competenceMonth: nextCycle.month,
      competenceYear: nextCycle.year,
      targetMonthName,
      reason: isSalaryCategory ? 'Categoria de salário no fim do mês' : 'Identificado termo salarial na transação',
    };
  }

  // 3. Receita relevante (>= R$ 1.500) nos últimos 4 dias do mês (dias 28 a 31)
  if (day >= 28 && tx.amount >= 1500) {
    return {
      isAdvance: true,
      competenceMonth: nextCycle.month,
      competenceYear: nextCycle.year,
      targetMonthName,
      reason: `Receita expressiva no dia ${day} típica de fechamento salarial`,
    };
  }

  return {
    isAdvance: false,
    competenceMonth: date.getMonth() + 1,
    competenceYear: date.getFullYear(),
    targetMonthName: MONTH_NAMES_PT[date.getMonth()] || '',
    reason: 'Receita pontual mantida no mês atual',
  };
}

/**
 * Formata o rótulo de competência (ex: "Renda de Novembro/2026")
 */
export function formatCompetenceLabel(month: number, year: number): string {
  const mName = MONTH_NAMES_PT[month - 1] || `Mês ${month}`;
  return `${mName}/${year}`;
}
