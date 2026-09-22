/**
 * Sobra - Pague-se Primeiro (Pay Yourself First)
 * Gerencia a configuração, metas mensais e estado de cumprimento da reserva antecipada.
 * 100% opcional, com respeito a regras de silêncio e cooldown de 2 toques.
 */

import { Transaction } from '../types';

export interface PayFirstConfig {
  enabled: boolean;
  monthlyAmount: number;
  notifyOnSalary: boolean;
  paidMonths: string[];         // Ex: ['2026-09', '2026-10']
  dismissedMonths: string[];    // Ex: ['2026-09']
  dismissedCount: number;       // Contador de dispensas para regra de cooldown
  lastDismissedDate?: string;   // ISO string da última dispensa
}

export const PAY_FIRST_STORAGE_KEY = 'sobra_pay_first_config';

export const DEFAULT_PAY_FIRST_CONFIG: PayFirstConfig = {
  enabled: false,
  monthlyAmount: 150,
  notifyOnSalary: true,
  paidMonths: [],
  dismissedMonths: [],
  dismissedCount: 0,
};

/**
 * Retorna a chave de mês no formato YYYY-MM
 */
export function getMonthKey(month: number, year: number): string {
  const m = month.toString().padStart(2, '0');
  return `${year}-${m}`;
}

/**
 * Obtém a configuração atual salva no localStorage
 */
export function getPayFirstConfig(): PayFirstConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_PAY_FIRST_CONFIG;
  }
  try {
    const raw = localStorage.getItem(PAY_FIRST_STORAGE_KEY);
    if (!raw) return DEFAULT_PAY_FIRST_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PAY_FIRST_CONFIG,
      ...parsed,
    };
  } catch {
    return DEFAULT_PAY_FIRST_CONFIG;
  }
}

/**
 * Salva a configuração no localStorage e emite evento para reatividade da UI
 */
export function savePayFirstConfig(config: PayFirstConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(PAY_FIRST_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('sobra:pay_first_changed', { detail: config }));
  } catch (e) {
    console.error('Falha ao salvar configuração do Pague-se Primeiro:', e);
  }
}

/**
 * Verifica se a meta de um mês específico já foi marcada como guardada
 */
export function isMonthPaid(config: PayFirstConfig, month: number, year: number): boolean {
  const key = getMonthKey(month, year);
  return config.paidMonths.includes(key);
}

/**
 * Marca o mês atual como guardado
 */
export function markMonthPaid(month: number, year: number): PayFirstConfig {
  const config = getPayFirstConfig();
  const key = getMonthKey(month, year);
  const updatedPaid = Array.from(new Set([...config.paidMonths, key]));
  const updated: PayFirstConfig = {
    ...config,
    paidMonths: updatedPaid,
    // Resetar contagem de dispensas se o usuário cumpriu a meta
    dismissedCount: 0,
  };
  savePayFirstConfig(updated);
  return updated;
}

/**
 * Desmarca o mês (caso tenha clicado por engano)
 */
export function unmarkMonthPaid(month: number, year: number): PayFirstConfig {
  const config = getPayFirstConfig();
  const key = getMonthKey(month, year);
  const updatedPaid = config.paidMonths.filter(m => m !== key);
  const updated: PayFirstConfig = {
    ...config,
    paidMonths: updatedPaid,
  };
  savePayFirstConfig(updated);
  return updated;
}

/**
 * Verifica se o usuário está sob cooldown de 60 dias (dispensou 2x seguidas)
 */
export function isUnderCooldown(config: PayFirstConfig, now: Date = new Date()): boolean {
  if (config.dismissedCount < 2) return false;
  if (!config.lastDismissedDate) return false;

  const lastDate = new Date(config.lastDismissedDate);
  const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays < 60; // 60 dias de silêncio respeitoso
}

/**
 * Dispensa o lembrete para o mês atual
 */
export function dismissForMonth(month: number, year: number, now: Date = new Date()): PayFirstConfig {
  const config = getPayFirstConfig();
  const key = getMonthKey(month, year);
  const updatedDismissed = Array.from(new Set([...config.dismissedMonths, key]));
  const newCount = config.dismissedCount + 1;

  const updated: PayFirstConfig = {
    ...config,
    dismissedMonths: updatedDismissed,
    dismissedCount: newCount,
    lastDismissedDate: now.toISOString(),
  };
  savePayFirstConfig(updated);
  return updated;
}

/**
 * Identifica se houve transação de salário ou grande receita no mês corrente
 */
export function detectSalaryInMonth(transactions: Transaction[], month: number, year: number): Transaction | null {
  const monthTxs = transactions.filter(t => {
    if (t.type !== 'income') return false;
    const d = new Date(t.date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  if (monthTxs.length === 0) return null;

  // 1. Procura por descrição com 'salário', 'pagamento', 'pro labore', 'vencimento'
  const explicitSalary = monthTxs.find(t => {
    const desc = (t.description || '').toLowerCase();
    return desc.includes('salár') || desc.includes('salar') || desc.includes('pro labore') || desc.includes('pagamento');
  });
  if (explicitSalary) return explicitSalary;

  // 2. Ou a maior entrada de dinheiro do mês (caso seja >= R$ 800)
  const sorted = [...monthTxs].sort((a, b) => b.amount - a.amount);
  if (sorted[0] && sorted[0].amount >= 800) {
    return sorted[0];
  }

  return null;
}

/**
 * Avalia se o banner de Pague-se Primeiro deve ser exibido na Home
 */
export function evaluatePayFirstBannerVisibility(
  transactions: Transaction[],
  month: number,
  year: number,
  now: Date = new Date()
): {
  shouldShow: boolean;
  isConfigured: boolean;
  isPaid: boolean;
  monthlyAmount: number;
  salaryTx: Transaction | null;
} {
  const config = getPayFirstConfig();
  const key = getMonthKey(month, year);
  const isPaid = config.paidMonths.includes(key);
  const isDismissed = config.dismissedMonths.includes(key);
  const salaryTx = detectSalaryInMonth(transactions, month, year);

  // Se o usuário já marcou como pago neste mês, ou dispensou o banner deste mês: não exibe
  if (isPaid || isDismissed) {
    return {
      shouldShow: false,
      isConfigured: config.enabled,
      isPaid,
      monthlyAmount: config.monthlyAmount,
      salaryTx,
    };
  }

  // Se o usuário está sob cooldown de 60 dias e ainda não ativou a função: respeita silêncio
  if (!config.enabled && isUnderCooldown(config, now)) {
    return {
      shouldShow: false,
      isConfigured: false,
      isPaid: false,
      monthlyAmount: config.monthlyAmount,
      salaryTx,
    };
  }

  // Se salário foi detectado:
  // - Se já está ativado: exibe lembrete funcional da meta dele
  // - Se NÃO está ativado, mas houve salário: exibe convite amigável e sutil
  const shouldShow = !!salaryTx;

  return {
    shouldShow,
    isConfigured: config.enabled,
    isPaid: false,
    monthlyAmount: config.monthlyAmount,
    salaryTx,
  };
}
