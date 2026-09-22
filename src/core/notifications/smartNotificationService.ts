/**
 * Sobra - Serviço de Notificações Inteligentes (Smart Notifications)
 * Dispara notificações contextuais no sistema operacional/browser com alta relevância financeira.
 * 
 * Regras de Ouro:
 * 1. Janela de Respeito: Apenas entre 10h e 19h (sem perturbação noturna).
 * 2. Deduplicação Estrita: Cada evento é enviado no máximo 1x no seu respectivo ciclo.
 * 3. Permissão Explícita: Apenas se Notification.permission === 'granted'.
 * 4. Faturas Individualizadas: Cada cartão é avaliado pelo seu próprio dia de fechamento e vencimento.
 */

import { Account, Budget, Category, Subscription, Transaction } from '../types';
import { getPayFirstConfig, detectSalaryInMonth, getMonthKey, isUnderCooldown } from '../payFirst/payFirstHelper';
import { formatBrlCurrency } from '../parsers/currencyHelper';
import { RecurrenceDetector } from '../subscriptions/recurrenceDetector';

const NOTIFIED_KEYS_STORAGE = 'sobra_smart_notified_keys_v1';

export class SmartNotificationService {
  /**
   * Verifica se o navegador suporta notificações
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Status atual da permissão de notificação
   */
  static getPermission(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  /**
   * Solicita permissão para o usuário
   */
  static async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Verifica se o horário atual está dentro da janela de respeito (10h às 19h)
   */
  static isWithinRespectfulHours(now: Date = new Date()): boolean {
    const hour = now.getHours();
    return hour >= 10 && hour < 19;
  }

  /**
   * Obtém as chaves de notificações já disparadas
   */
  static getNotifiedKeys(): string[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = localStorage.getItem(NOTIFIED_KEYS_STORAGE);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Registra que uma notificação de chave específica foi disparada
   */
  static recordNotificationSent(key: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const current = this.getNotifiedKeys();
      const updated = Array.from(new Set([...current, key]));
      localStorage.setItem(NOTIFIED_KEYS_STORAGE, JSON.stringify(updated));
    } catch (e) {
      console.error('Falha ao salvar chave de notificação enviada:', e);
    }
  }

  /**
   * Verifica se uma notificação com esta chave já foi enviada
   */
  static hasBeenSent(key: string): boolean {
    return this.getNotifiedKeys().includes(key);
  }

  /**
   * Dispara uma notificação nativa com ícone e ação de clique
   */
  static emitNotification(
    key: string,
    title: string,
    body: string,
    tag: string,
    onClickAction?: () => void
  ): boolean {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return false;
    }

    try {
      const notif = new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag,
      });

      notif.onclick = () => {
        window.focus();
        if (onClickAction) onClickAction();
        notif.close();
      };

      this.recordNotificationSent(key);
      return true;
    } catch (err) {
      console.error(`Erro ao disparar notificação (${key}):`, err);
      return false;
    }
  }

  /**
   * 1. Notificação de Salário (Pague-se Primeiro)
   */
  static async checkAndNotifySalary(
    transactions: Transaction[],
    month: number,
    year: number,
    onOpenDashboard?: () => void,
    now: Date = new Date()
  ): Promise<boolean> {
    if (!this.isSupported() || Notification.permission !== 'granted' || !this.isWithinRespectfulHours(now)) {
      return false;
    }

    const monthKey = getMonthKey(month, year);
    const notificationKey = `salary_${monthKey}`;

    if (this.hasBeenSent(notificationKey)) {
      return false;
    }

    const config = getPayFirstConfig();

    if (config.enabled && !config.notifyOnSalary) {
      return false;
    }

    if (!config.enabled && isUnderCooldown(config, now)) {
      return false;
    }

    const salaryTx = detectSalaryInMonth(transactions, month, year);
    if (!salaryTx) {
      return false;
    }

    let title = '💰 Salário identificado!';
    let body = 'Que tal se pagar primeiro este mês? Separe uma parte para a sua reserva antes de começar os gastos.';

    if (config.enabled && config.monthlyAmount > 0) {
      title = '💰 Salário identificado no Sobra!';
      body = `Hora de se pagar primeiro: separe seus ${formatBrlCurrency(config.monthlyAmount)} na reserva antes dos gastos do mês.`;
    }

    return this.emitNotification(
      notificationKey,
      title,
      body,
      `sobra-salary-${monthKey}`,
      onOpenDashboard
    );
  }

  /**
   * 2. Notificação de Fechamento de Fatura (Individual por Cartão)
   * Cada cartão é avaliado pelo seu próprio dia de fechamento (closingDay) e vencimento (dueDay).
   */
  static async checkAndNotifyCardClosing(
    cards: Account[],
    transactions: Transaction[],
    month: number,
    year: number,
    onOpenCardInvoice?: (card: Account) => void,
    now: Date = new Date()
  ): Promise<number> {
    if (!this.isSupported() || Notification.permission !== 'granted' || !this.isWithinRespectfulHours(now)) {
      return 0;
    }

    const todayDay = now.getDate();
    const monthKey = getMonthKey(month, year);
    let sentCount = 0;

    const creditCards = cards.filter(c => c.type === 'credit_card' && c.closingDay);

    for (const card of creditCards) {
      // Verifica se hoje é o dia de fechamento cadastrado deste cartão
      if (card.closingDay !== todayDay) {
        continue;
      }

      const notificationKey = `card_closing_${card.id}_${monthKey}`;
      if (this.hasBeenSent(notificationKey)) {
        continue;
      }

      // Calcula o total gasto no cartão neste ciclo ou usa o saldo do cartão
      const cardExpenses = transactions
        .filter(t => t.accountId === card.id && t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const invoiceAmount = card.balance > 0 ? card.balance : cardExpenses;

      // Se a fatura for zero, não precisa alertar
      if (invoiceAmount <= 0) {
        continue;
      }

      const title = `💳 Sua fatura do ${card.name} fechou`;
      const dueInfo = card.dueDay ? ` O vencimento é dia ${card.dueDay}.` : '';
      const body = `Valor fechado: ${formatBrlCurrency(invoiceAmount)}.${dueInfo} Toque para conferir seus lançamentos.`;

      const sent = this.emitNotification(
        notificationKey,
        title,
        body,
        `sobra-invoice-${card.id}-${monthKey}`,
        onOpenCardInvoice ? () => onOpenCardInvoice(card) : undefined
      );

      if (sent) sentCount++;
    }

    return sentCount;
  }

  /**
   * 3. Notificação de Nova Assinatura Recorrente Detectada (Compromisso Mensal)
   * Analisa compras frequentes com mesmo estabelecimento que ainda não são assinaturas salvas.
   */
  static async checkAndNotifyUnlinkedSubscriptions(
    transactions: Transaction[],
    subscriptions: Subscription[],
    categories: Category[],
    onOpenSubscriptions?: () => void,
    now: Date = new Date()
  ): Promise<boolean> {
    if (!this.isSupported() || Notification.permission !== 'granted' || !this.isWithinRespectfulHours(now)) {
      return false;
    }

    const detector = new RecurrenceDetector();
    const suggestions = detector.detectRecurringSubscriptions(transactions, subscriptions, [], categories);

    if (suggestions.length === 0) {
      return false;
    }

    // Pega a primeira sugestão relevante que ainda não foi notificada
    for (const item of suggestions) {
      const merchantKey = item.merchantName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const notificationKey = `sub_detected_${merchantKey}`;
      if (this.hasBeenSent(notificationKey)) {
        continue;
      }

      const title = '📺 Nova assinatura detectada?';
      const body = `Identificamos cobrança de ${item.merchantName} (${formatBrlCurrency(item.amount)}). Quer fixar no seu Compromisso Mensal?`;

      return this.emitNotification(
        notificationKey,
        title,
        body,
        `sobra-sub-${merchantKey}`,
        onOpenSubscriptions
      );
    }

    return false;
  }

  /**
   * 4. Notificação de Fechamento do Mês & Diagnóstico do Sobi
   * Dispara no último dia do mês (ou no dia 1º do mês seguinte) com a sobra consolidada.
   */
  static async checkAndNotifyMonthClosingDiagnosis(
    totalIncome: number,
    totalExpenses: number,
    month: number,
    year: number,
    onOpenDiagnosisReport?: () => void,
    now: Date = new Date()
  ): Promise<boolean> {
    if (!this.isSupported() || Notification.permission !== 'granted' || !this.isWithinRespectfulHours(now)) {
      return false;
    }

    const todayDay = now.getDate();
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const isClosingDay = todayDay === lastDayOfMonth || todayDay === 1;

    if (!isClosingDay) {
      return false;
    }

    const monthKey = getMonthKey(month, year);
    const notificationKey = `month_closing_${monthKey}`;

    if (this.hasBeenSent(notificationKey)) {
      return false;
    }

    // Só envia se houver movimentação registrada no mês
    if (totalIncome === 0 && totalExpenses === 0) {
      return false;
    }

    const sobra = totalIncome - totalExpenses;
    const title = '📊 O mês fechou! Veja seu balanço';
    const body = sobra >= 0
      ? `Parabéns! Sua sobra final foi de ${formatBrlCurrency(sobra)}. O Sobi preparou seu relatório de saúde financeira.`
      : `Suas despesas superaram a receita em ${formatBrlCurrency(Math.abs(sobra))}. Veja as dicas do Sobi para equilibrar.`;

    return this.emitNotification(
      notificationKey,
      title,
      body,
      `sobra-month-closing-${monthKey}`,
      onOpenDiagnosisReport
    );
  }

  /**
   * 5. Alerta de Teto de Orçamento (80% e 100%)
   */
  static async checkAndNotifyBudgetThresholds(
    budgets: Budget[],
    categories: Category[],
    transactions: Transaction[],
    month: number,
    year: number,
    onOpenBudgets?: () => void,
    now: Date = new Date()
  ): Promise<number> {
    if (!this.isSupported() || Notification.permission !== 'granted' || !this.isWithinRespectfulHours(now)) {
      return 0;
    }

    const monthKey = getMonthKey(month, year);
    let sentCount = 0;

    const currentMonthExpenses = transactions.filter(t => {
      if (t.type !== 'expense') return false;
      const d = new Date(t.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });

    for (const budget of budgets) {
      if (budget.monthlyLimit <= 0) continue;

      const spent = currentMonthExpenses
        .filter(t => t.categoryId === budget.categoryId)
        .reduce((sum, t) => sum + t.amount, 0);

      const pct = Math.round((spent / budget.monthlyLimit) * 100);
      const cat = categories.find(c => c.id === budget.categoryId);
      const catName = cat?.name || 'Categoria';

      // Limiar 100% atingido ou estourado
      if (pct >= 100) {
        const key100 = `budget_100_${budget.id}_${monthKey}`;
        if (!this.hasBeenSent(key100)) {
          const title = `⚠️ Orçamento de ${catName} atingiu 100%`;
          const body = `Você consumiu ${formatBrlCurrency(spent)} do teto de ${formatBrlCurrency(budget.monthlyLimit)}. Evite novos gastos até o mês virar!`;
          const sent = this.emitNotification(key100, title, body, `sobra-budget-100-${budget.id}-${monthKey}`, onOpenBudgets);
          if (sent) sentCount++;
          continue;
        }
      }

      // Limiar 80% atingido
      if (pct >= 80 && pct < 100) {
        const key80 = `budget_80_${budget.id}_${monthKey}`;
        if (!this.hasBeenSent(key80)) {
          const title = `⚠️ Orçamento de ${catName} em ${pct}%`;
          const body = `Você já consumiu ${formatBrlCurrency(spent)} do teto de ${formatBrlCurrency(budget.monthlyLimit)}. Mantenha o ritmo para fechar no azul!`;
          const sent = this.emitNotification(key80, title, body, `sobra-budget-80-${budget.id}-${monthKey}`, onOpenBudgets);
          if (sent) sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * Executa a checagem combinada de todos os gatilhos inteligentes de forma não-bloqueante
   */
  static async runAllSmartChecks(params: {
    accounts: Account[];
    categories: Category[];
    transactions: Transaction[];
    budgets: Budget[];
    subscriptions: Subscription[];
    totalIncome: number;
    totalExpenses: number;
    month: number;
    year: number;
    onNavigate?: (tab: string) => void;
    onOpenCardInvoice?: (card: Account) => void;
    now?: Date;
  }): Promise<void> {
    const {
      accounts,
      categories,
      transactions,
      budgets,
      subscriptions,
      totalIncome,
      totalExpenses,
      month,
      year,
      onNavigate,
      onOpenCardInvoice,
      now = new Date(),
    } = params;

    // 1. Salário (Pague-se Primeiro)
    await this.checkAndNotifySalary(transactions, month, year, () => onNavigate?.('dashboard'), now);

    // 2. Fechamento de Faturas (por cartão individual)
    await this.checkAndNotifyCardClosing(accounts, transactions, month, year, onOpenCardInvoice, now);

    // 3. Assinaturas Recorrentes Detectadas
    await this.checkAndNotifyUnlinkedSubscriptions(transactions, subscriptions, categories, () => onNavigate?.('subscriptions'), now);

    // 4. Fechamento do Mês
    await this.checkAndNotifyMonthClosingDiagnosis(totalIncome, totalExpenses, month, year, () => onNavigate?.('dashboard'), now);

    // 5. Orçamentos (80% e 100%)
    await this.checkAndNotifyBudgetThresholds(budgets, categories, transactions, month, year, () => onNavigate?.('budgets'), now);
  }
}
