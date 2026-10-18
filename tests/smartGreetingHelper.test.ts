import { describe, it, expect } from 'vitest';
import { getSmartGreeting, SmartGreetingContext } from '../src/core/greetings/smartGreetingHelper';
import { Subscription } from '../src/core/types';

describe('SmartGreetingHelper - Saudações Inteligentes & Dinâmicas', () => {
  it('1. Deve gerar saudação temporal correta (Bom dia / Boa tarde / Boa noite)', () => {
    // Manhã às 09:00
    const morning = getSmartGreeting({
      userName: 'Felps',
      now: new Date(2026, 9, 20, 9, 0, 0), // 09:00 (Terça)
    });
    expect(morning.title).toBe('Bom dia, Felps');

    // Tarde às 15:30
    const afternoon = getSmartGreeting({
      userName: 'Felps',
      now: new Date(2026, 9, 20, 15, 30, 0), // 15:30
    });
    expect(afternoon.title).toBe('Boa tarde, Felps');

    // Noite às 21:00
    const evening = getSmartGreeting({
      userName: 'Felps',
      now: new Date(2026, 9, 20, 21, 0, 0), // 21:00
    });
    expect(evening.title).toBe('Boa noite, Felps');
  });

  it('2. Prioridade 1: Notificações automáticas pendentes para revisão', () => {
    const single = getSmartGreeting({
      userName: 'Felps',
      pendingNotificationsCount: 1,
      now: new Date(2026, 9, 20, 14, 0, 0),
    });
    expect(single.subtitle).toBe('1 compra para revisar.');
    expect(single.action).toBe('notifications');

    const multiple = getSmartGreeting({
      userName: 'Felps',
      pendingNotificationsCount: 3,
      now: new Date(2026, 9, 20, 14, 0, 0),
    });
    expect(multiple.subtitle).toBe('3 compras para revisar.');
    expect(multiple.action).toBe('notifications');
  });

  it('3. Prioridade 2: Salário detectado e Pague-se Primeiro pendente', () => {
    const res = getSmartGreeting({
      userName: 'Felps',
      pendingNotificationsCount: 0,
      hasSalaryPendingPayFirst: true,
      now: new Date(2026, 9, 20, 14, 0, 0),
    });
    expect(res.subtitle).toBe('Salário caiu! Guarde sua meta.');
    expect(res.action).toBe('pay_first');
  });

  it('4. Prioridade 3: Assinatura próxima de cobrança hoje ou amanhã', () => {
    const mockSubs: Subscription[] = [
      {
        id: 'sub-1',
        name: 'Netflix',
        amount: 55.90,
        categoryId: 'cat-1',
        cadence: 'monthly',
        nextBillingDate: '2026-10-20',
        dayOfMonth: 20,
        status: 'active',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];

    const todaySub = getSmartGreeting({
      userName: 'Felps',
      now: new Date(2026, 9, 20, 14, 0, 0), // dia 20
      subscriptions: mockSubs,
    });
    expect(todaySub.subtitle).toBe('Cobrança de Netflix hoje.');
    expect(todaySub.action).toBe('subscriptions');

    const tomorrowSub = getSmartGreeting({
      userName: 'Felps',
      now: new Date(2026, 9, 19, 14, 0, 0), // dia 19, Netflix vence dia 20
      subscriptions: mockSubs,
    });
    expect(tomorrowSub.subtitle).toBe('Renovação de Netflix amanhã.');
    expect(tomorrowSub.action).toBe('subscriptions');
  });

  it('5. Prioridade 4: Mensagens contextuais para dias da semana', () => {
    // Sexta-feira: 23 de Outubro de 2026
    const friday = getSmartGreeting({
      userName: 'Felps',
      now: new Date(2026, 9, 23, 16, 0, 0),
    });
    expect(friday.subtitle).toBe('Sexta! Olho nos extras.');

    // Sábado: 24 de Outubro de 2026
    const saturday = getSmartGreeting({
      userName: 'Felps',
      now: new Date(2026, 9, 24, 11, 0, 0),
    });
    expect(saturday.subtitle).toBe('Fim de semana no controle.');

    // Domingo: 25 de Outubro de 2026
    const sunday = getSmartGreeting({
      userName: 'Felps',
      now: new Date(2026, 9, 25, 11, 0, 0),
    });
    expect(sunday.subtitle).toBe('Domingo calmo por aqui.');

    // Segunda: 26 de Outubro de 2026
    const monday = getSmartGreeting({
      userName: 'Felps',
      now: new Date(2026, 9, 26, 11, 0, 0),
    });
    expect(monday.subtitle).toBe('Semana nova, tudo em ordem.');
  });

  it('6. Garante que nenhuma frase de subtítulo ultrapasse 35 caracteres para caber perfeitamente no cabeçalho', () => {
    const contexts: SmartGreetingContext[] = [
      { pendingNotificationsCount: 1 },
      { pendingNotificationsCount: 12 },
      { hasSalaryPendingPayFirst: true },
      { subscriptions: [{ id: '1', name: 'Spotify Premium Super Longo', amount: 30, categoryId: 'c', cadence: 'monthly', nextBillingDate: '2026-10-20', dayOfMonth: 20, status: 'active', createdAt: '', updatedAt: '' }], now: new Date(2026, 9, 20) },
      { subscriptions: [{ id: '1', name: 'Spotify Premium Super Longo', amount: 30, categoryId: 'c', cadence: 'monthly', nextBillingDate: '2026-10-21', dayOfMonth: 21, status: 'active', createdAt: '', updatedAt: '' }], now: new Date(2026, 9, 20) },
      { now: new Date(2026, 9, 23) }, // Sexta
      { now: new Date(2026, 9, 24) }, // Sábado
      { now: new Date(2026, 9, 25) }, // Domingo
      { now: new Date(2026, 9, 26) }, // Segunda
      { todayExpenseCount: 0, now: new Date(2026, 9, 21) },
      { monthlyIncome: 5000, monthlyExpense: 3200, now: new Date(2026, 9, 21) },
      { now: new Date(2026, 9, 21) }, // Fallback
    ];

    for (const ctx of contexts) {
      const res = getSmartGreeting(ctx);
      expect(res.subtitle.length).toBeLessThanOrEqual(35);
    }
  });
});
