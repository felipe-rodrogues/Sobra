import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_PAY_FIRST_CONFIG,
  getMonthKey,
  isMonthPaid,
  markMonthPaid,
  unmarkMonthPaid,
  isUnderCooldown,
  dismissForMonth,
  detectSalaryInMonth,
  evaluatePayFirstBannerVisibility,
  PAY_FIRST_STORAGE_KEY,
  PayFirstConfig,
  savePayFirstConfig,
  getPayFirstConfig,
} from '../src/core/payFirst/payFirstHelper';
import { SmartNotificationService } from '../src/core/notifications/smartNotificationService';
import { Transaction } from '../src/core/types';

// Polyfill do localStorage para ambiente Node
let mockStore: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => mockStore[key] || null,
    setItem: (key: string, val: string) => { mockStore[key] = String(val); },
    removeItem: (key: string) => { delete mockStore[key]; },
    clear: () => { mockStore = {}; },
  };
}
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (typeof (globalThis as any).window.dispatchEvent === 'undefined') {
  (globalThis as any).window.dispatchEvent = () => true;
  (globalThis as any).CustomEvent = class CustomEvent { constructor(public type: string, public detail?: any) {} };
}

describe('Sobra - Pague-se Primeiro & Notificações Inteligentes', () => {
  beforeEach(() => {
    mockStore = {};
    if (globalThis.localStorage) {
      globalThis.localStorage.clear();
    }
  });

  it('deve formatar chave de mês corretamente como YYYY-MM', () => {
    expect(getMonthKey(9, 2026)).toBe('2026-09');
    expect(getMonthKey(12, 2026)).toBe('2026-12');
    expect(getMonthKey(1, 2027)).toBe('2027-01');
  });

  it('deve carregar configuração padrão desativada (100% opcional)', () => {
    const config = getPayFirstConfig();
    expect(config.enabled).toBe(false);
    expect(config.monthlyAmount).toBe(150);
    expect(config.paidMonths).toEqual([]);
    expect(config.dismissedCount).toBe(0);
  });

  it('deve marcar e desmarcar mês como pago', () => {
    savePayFirstConfig({
      ...DEFAULT_PAY_FIRST_CONFIG,
      enabled: true,
      monthlyAmount: 200,
    });

    expect(isMonthPaid(getPayFirstConfig(), 9, 2026)).toBe(false);

    markMonthPaid(9, 2026);
    expect(isMonthPaid(getPayFirstConfig(), 9, 2026)).toBe(true);

    unmarkMonthPaid(9, 2026);
    expect(isMonthPaid(getPayFirstConfig(), 9, 2026)).toBe(false);
  });

  it('deve aplicar regra de cooldown de 60 dias após 2 dispensas', () => {
    const now = new Date('2026-09-21T12:00:00Z');

    // 1ª dispensa
    dismissForMonth(8, 2026, now);
    let cfg = getPayFirstConfig();
    expect(cfg.dismissedCount).toBe(1);
    expect(isUnderCooldown(cfg, now)).toBe(false);

    // 2ª dispensa
    dismissForMonth(9, 2026, now);
    cfg = getPayFirstConfig();
    expect(cfg.dismissedCount).toBe(2);
    expect(isUnderCooldown(cfg, now)).toBe(true);

    // 40 dias depois: ainda em cooldown
    const after40Days = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000);
    expect(isUnderCooldown(cfg, after40Days)).toBe(true);

    // 65 dias depois: cooldown expirou
    const after65Days = new Date(now.getTime() + 65 * 24 * 60 * 60 * 1000);
    expect(isUnderCooldown(cfg, after65Days)).toBe(false);
  });

  it('deve detectar salário por descrição explícita ou por valor relevante', () => {
    const txSalary: Transaction = {
      id: 'tx-sal',
      accountId: 'acc-1',
      categoryId: 'cat-sal',
      amount: 4500,
      type: 'income',
      description: 'Pagamento Salário Empresa Ltda',
      date: '2026-09-05T10:00:00Z',
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    };

    const txSmall: Transaction = {
      id: 'tx-pix',
      accountId: 'acc-1',
      categoryId: 'cat-outros',
      amount: 50,
      type: 'income',
      description: 'Pix amigo almoço',
      date: '2026-09-06T12:00:00Z',
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'manual',
      createdAt: '',
      updatedAt: '',
    };

    const detected = detectSalaryInMonth([txSmall, txSalary], 9, 2026);
    expect(detected).not.toBeNull();
    expect(detected?.id).toBe('tx-sal');

    // Sem salário ou receita acima de R$ 800
    const detectedSmall = detectSalaryInMonth([txSmall], 9, 2026);
    expect(detectedSmall).toBeNull();
  });

  it('deve avaliar a visibilidade do banner na tela inicial', () => {
    const txSalary: Transaction = {
      id: 'tx-sal',
      accountId: 'acc-1',
      categoryId: 'cat-sal',
      amount: 3000,
      type: 'income',
      description: 'Salário',
      date: '2026-09-05T10:00:00Z',
      status: 'confirmed',
      paymentMethod: 'pix',
      source: 'notification',
      createdAt: '',
      updatedAt: '',
    };

    // 1. Com salário e não pago nem dispensado: deve exibir
    const status1 = evaluatePayFirstBannerVisibility([txSalary], 9, 2026);
    expect(status1.shouldShow).toBe(true);

    // 2. Após marcar como pago: NÃO deve exibir
    markMonthPaid(9, 2026);
    const status2 = evaluatePayFirstBannerVisibility([txSalary], 9, 2026);
    expect(status2.shouldShow).toBe(false);
    expect(status2.isPaid).toBe(true);

    // 3. Se dispensar o mês corrente: NÃO deve exibir
    unmarkMonthPaid(9, 2026);
    dismissForMonth(9, 2026);
    const status3 = evaluatePayFirstBannerVisibility([txSalary], 9, 2026);
    expect(status3.shouldShow).toBe(false);
  });

  it('SmartNotificationService deve respeitar janela de horários (10h às 19h)', () => {
    const morningEarly = new Date('2026-09-21T07:30:00');
    expect(SmartNotificationService.isWithinRespectfulHours(morningEarly)).toBe(false);

    const lunchTime = new Date('2026-09-21T12:30:00');
    expect(SmartNotificationService.isWithinRespectfulHours(lunchTime)).toBe(true);

    const afternoonTime = new Date('2026-09-21T18:59:00');
    expect(SmartNotificationService.isWithinRespectfulHours(afternoonTime)).toBe(true);

    const nightTime = new Date('2026-09-21T21:30:00');
    expect(SmartNotificationService.isWithinRespectfulHours(nightTime)).toBe(false);
  });
});
