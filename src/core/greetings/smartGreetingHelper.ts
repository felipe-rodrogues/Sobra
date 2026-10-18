import { Subscription } from '../types';

export interface SmartGreetingContext {
  userName?: string;
  now?: Date;
  pendingNotificationsCount?: number;
  hasSalaryPendingPayFirst?: boolean;
  subscriptions?: Subscription[];
  todayExpenseCount?: number;
  monthlyIncome?: number;
  monthlyExpense?: number;
}

export interface SmartGreetingResult {
  title: string;
  subtitle: string;
  action?: 'notifications' | 'pay_first' | 'subscriptions' | 'none';
}

/**
 * Gera saudações inteligentes e dinâmicas com microcópia concisa (<= 45 caracteres),
 * evitando qualquer transbordamento visual no cabeçalho e conectando-se aos recursos reais do app.
 */
export function getSmartGreeting(ctx: SmartGreetingContext): SmartGreetingResult {
  const now = ctx.now || new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  const todayDate = now.getDate();

  // 1. Título Humano e Temporal
  let timeGreeting = 'Olá';
  if (hour >= 5 && hour < 12) {
    timeGreeting = 'Bom dia';
  } else if (hour >= 12 && hour < 18) {
    timeGreeting = 'Boa tarde';
  } else {
    timeGreeting = 'Boa noite';
  }

  const cleanName = (ctx.userName || '').trim();
  const title = cleanName && cleanName !== 'Usuário'
    ? `${timeGreeting}, ${cleanName}`
    : timeGreeting;

  // 2. Subtítulo Contextual e Inteligente (por ordem estrita de relevância)

  // Prioridade 1: Lançamentos automáticos detectados aguardando revisão
  const pendingCount = ctx.pendingNotificationsCount || 0;
  if (pendingCount > 0) {
    const subtitle = pendingCount === 1
      ? '1 compra para revisar.'
      : `${pendingCount} compras para revisar.`;
    return { title, subtitle, action: 'notifications' };
  }

  // Prioridade 2: Salário caiu e Pague-se Primeiro está pendente
  if (ctx.hasSalaryPendingPayFirst) {
    return {
      title,
      subtitle: 'Salário caiu! Guarde sua meta.',
      action: 'pay_first',
    };
  }

  // Prioridade 3: Assinatura vencendo hoje ou amanhã
  if (ctx.subscriptions && ctx.subscriptions.length > 0) {
    const getSubDay = (s: Subscription): number => {
      if (s.dayOfMonth && s.dayOfMonth > 0) return s.dayOfMonth;
      if (s.nextBillingDate) {
        const parts = s.nextBillingDate.split('-');
        if (parts.length === 3) {
          const parsed = parseInt(parts[2], 10);
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
      }
      return 0;
    };
    const activeSubs = ctx.subscriptions.filter(s => s.status !== 'cancelled' && getSubDay(s) > 0);
    const subToday = activeSubs.find(s => getSubDay(s) === todayDate);
    if (subToday) {
      // Limita o nome da assinatura para manter tamanho ultra-seguro
      const safeName = subToday.name.length > 12 ? subToday.name.slice(0, 11) + '…' : subToday.name;
      return {
        title,
        subtitle: `Cobrança de ${safeName} hoje.`,
        action: 'subscriptions',
      };
    }

    const tomorrowDate = todayDate + 1;
    const subTomorrow = activeSubs.find(s => getSubDay(s) === tomorrowDate);
    if (subTomorrow) {
      const safeName = subTomorrow.name.length > 12 ? subTomorrow.name.slice(0, 11) + '…' : subTomorrow.name;
      return {
        title,
        subtitle: `Renovação de ${safeName} amanhã.`,
        action: 'subscriptions',
      };
    }
  }

  // Prioridade 4: Momentos-chave da semana (Ultra-concisos e acolhedores)
  if (dayOfWeek === 5) {
    // Sexta-feira
    return {
      title,
      subtitle: 'Sexta! Olho nos extras.',
      action: 'none',
    };
  }

  if (dayOfWeek === 6) {
    // Sábado
    return {
      title,
      subtitle: 'Fim de semana no controle.',
      action: 'none',
    };
  }

  if (dayOfWeek === 0) {
    // Domingo
    return {
      title,
      subtitle: 'Domingo calmo por aqui.',
      action: 'none',
    };
  }

  if (dayOfWeek === 1) {
    // Segunda-feira
    return {
      title,
      subtitle: 'Semana nova, tudo em ordem.',
      action: 'none',
    };
  }

  // Prioridade 5: Sem gastos registrados hoje (dia tranquilo)
  if (ctx.todayExpenseCount === 0) {
    return {
      title,
      subtitle: 'Zero gastos hoje. Tranquilo!',
      action: 'none',
    };
  }

  // Prioridade 6: Sobra positiva no mês corrente
  const income = ctx.monthlyIncome || 0;
  const expense = ctx.monthlyExpense || 0;
  if (income > expense && expense > 0) {
    return {
      title,
      subtitle: 'Contas no azul este mês.',
      action: 'none',
    };
  }

  // Fallback Acolhedor Ultra-Conciso
  return {
    title,
    subtitle: 'Tudo organizado por aqui.',
    action: 'none',
  };
}
