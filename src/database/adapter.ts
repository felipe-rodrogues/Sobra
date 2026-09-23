/**
 * Sobra - Adaptador de Banco de Dados Universal (Web / Mobile)
 */

import { Account, Category, Transaction, Budget, Goal, GoalContribution, PendingNotification, Subscription, CategoryRule, DescriptionRule } from '../core/types';
import { INITIAL_CATEGORIES } from './schema';

export interface StorageData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  goalContributions?: GoalContribution[];
  pendingNotifications: PendingNotification[];
  subscriptions: Subscription[];
  categoryRules: CategoryRule[];
  descriptionRules?: DescriptionRule[];
  dismissedSubscriptionMerchants: string[];
}

const STORAGE_KEY = 'sobra_finance_database_v2';

class DatabaseAdapter {
  private memoryData: StorageData | null = null;

  public getDemoData(): StorageData {
    const initialCategories: Category[] = INITIAL_CATEGORIES.map(c => ({
      ...c,
      createdAt: new Date().toISOString(),
    }));

    const initialAccounts: Account[] = [
      {
        id: 'acc-conta-principal',
        name: 'Conta Principal',
        bankId: 'generic',
        type: 'checking',
        balance: 0.00,
        color: '#10B981',
        icon: 'Landmark',
        currency: 'BRL',
        syncStatus: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'acc-nubank',
        name: 'Nubank Conta Corrente',
        bankId: 'nubank',
        type: 'checking',
        balance: 2450.00,
        color: '#820AD1',
        icon: 'Wallet',
        currency: 'BRL',
        syncStatus: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'acc-cartao-nu',
        name: 'Nubank',
        bankId: 'nubank',
        type: 'credit_card',
        balance: 939.40,
        creditLimit: 4200.00,
        openAmount: 1542.85,
        invoiceAmount: 939.40,
        closingDay: 1,
        dueDay: 8,
        cardBrand: 'mastercard',
        invoiceStatus: 'closed',
        color: '#820AD1',
        icon: 'CreditCard',
        currency: 'BRL',
        syncStatus: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'acc-cartao-inter',
        name: 'Inter',
        bankId: 'inter',
        type: 'credit_card',
        balance: 1420.79,
        creditLimit: 9180.00,
        openAmount: 4574.63,
        invoiceAmount: 1420.79,
        closingDay: 4,
        dueDay: 10,
        cardBrand: 'mastercard',
        invoiceStatus: 'closed',
        color: '#FF7A00',
        icon: 'CreditCard',
        currency: 'BRL',
        syncStatus: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'acc-itau',
        name: 'Itaú Reserva',
        bankId: 'itau',
        type: 'savings',
        balance: 5000.00,
        color: '#EC7000',
        icon: 'PiggyBank',
        currency: 'BRL',
        syncStatus: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const initialTransactions: Transaction[] = [
      {
        id: 'tx-init-salario',
        accountId: 'acc-nubank',
        categoryId: 'cat-salario',
        amount: 6500.00,
        type: 'income',
        description: 'Salário Mensal',
        date: new Date(currentYear, currentMonth - 1, 5).toISOString(),
        status: 'confirmed',
        paymentMethod: 'transfer',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tx-init-supermercado',
        accountId: 'acc-cartao-nu',
        categoryId: 'cat-alim',
        amount: 450.50,
        type: 'expense',
        description: 'Supermercado Pão de Açúcar',
        date: new Date(currentYear, currentMonth - 1, 8).toISOString(),
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'notification',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tx-init-combustivel',
        accountId: 'acc-cartao-nu',
        categoryId: 'cat-transp',
        amount: 230.00,
        type: 'expense',
        description: 'Posto Shell Marginal',
        date: new Date(currentYear, currentMonth - 1, 10).toISOString(),
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'notification',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tx-init-spotify-1',
        accountId: 'acc-cartao-nu',
        categoryId: 'cat-lazer',
        amount: 21.90,
        type: 'expense',
        description: 'Spotify Premium',
        date: new Date(Date.now() - 60 * 86400000).toISOString(),
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'notification',
        createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      },
      {
        id: 'tx-init-spotify-2',
        accountId: 'acc-cartao-nu',
        categoryId: 'cat-lazer',
        amount: 21.90,
        type: 'expense',
        description: 'Spotify Premium',
        date: new Date(Date.now() - 30 * 86400000).toISOString(),
        status: 'confirmed',
        paymentMethod: 'credit',
        source: 'notification',
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
    ];

    const initialBudgets: Budget[] = [
      {
        id: 'b-alim',
        categoryId: 'cat-alim',
        monthlyLimit: 800.00,
        month: currentMonth,
        year: currentYear,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'b-transp',
        categoryId: 'cat-transp',
        monthlyLimit: 300.00,
        month: currentMonth,
        year: currentYear,
        createdAt: new Date().toISOString(),
      },
    ];

    const initialGoals: Goal[] = [
      {
        id: 'g-reserva',
        name: 'Reserva de Emergência (6 meses)',
        targetAmount: 20000.00,
        currentAmount: 7450.00,
        targetDate: `${currentYear}-12-31`,
        color: '#10B981',
        icon: 'ShieldCheck',
        isCompleted: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'g-viagem',
        name: 'Viagem de Fim de Ano',
        targetAmount: 5000.00,
        currentAmount: 2100.00,
        targetDate: `${currentYear}-11-20`,
        color: '#6366F1',
        icon: 'Compass',
        isCompleted: false,
        createdAt: new Date().toISOString(),
      },
    ];

    const initialSubscriptions: Subscription[] = [
      {
        id: 'sub-netflix',
        name: 'Netflix',
        amount: 39.90,
        categoryId: 'cat-lazer',
        accountId: 'acc-cartao-nu',
        cadence: 'monthly',
        nextBillingDate: new Date(Date.now() + 12 * 86400000).toISOString().substring(0, 10),
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    return {
      accounts: initialAccounts,
      categories: initialCategories,
      transactions: initialTransactions,
      budgets: initialBudgets,
      goals: initialGoals,
      pendingNotifications: [],
      subscriptions: initialSubscriptions,
      categoryRules: [],
      dismissedSubscriptionMerchants: [],
      descriptionRules: [],
    };
  }

  private async load(): Promise<StorageData> {
    if (this.memoryData) {
      return this.memoryData;
    }

    // Limpa cache v1 antigo se existir para garantir reset real
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem('sobra_finance_database_v1');
      } catch {}

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            const initialCategories: Category[] = INITIAL_CATEGORIES.map(c => ({
              ...c,
              createdAt: new Date().toISOString(),
            }));

            this.memoryData = {
              accounts: parsed.accounts || [],
              categories: parsed.categories && parsed.categories.length > 0 ? parsed.categories : initialCategories,
              transactions: parsed.transactions || [],
              budgets: parsed.budgets || [],
              goals: parsed.goals || [],
              goalContributions: parsed.goalContributions || [],
              pendingNotifications: parsed.pendingNotifications || [],
              subscriptions: parsed.subscriptions || [],
              categoryRules: parsed.categoryRules || [],
              descriptionRules: parsed.descriptionRules || [],
              dismissedSubscriptionMerchants: parsed.dismissedSubscriptionMerchants || [],
            };
            return this.memoryData;
          }
        } catch (e) {
          console.error('Erro ao ler storage, redefinindo para base limpa...', e);
        }
      }
    }

    // Inicialização 100% LIMPA (Zero dados cadastrados para teste com contas e cartões reais)
    const initialCategories: Category[] = INITIAL_CATEGORIES.map(c => ({
      ...c,
      createdAt: new Date().toISOString(),
    }));

    this.memoryData = {
      accounts: [],
      categories: initialCategories,
      transactions: [],
      budgets: [],
      goals: [],
      goalContributions: [],
      pendingNotifications: [],
      subscriptions: [],
      categoryRules: [],
      descriptionRules: [],
      dismissedSubscriptionMerchants: [],
    };

    this.persist();
    return this.memoryData;
  }


  private persist(): void {
    if (typeof window !== 'undefined' && window.localStorage && this.memoryData) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memoryData));
    }
  }

  // --- ACCOUNTS ---
  async getAccounts(): Promise<Account[]> {
    const data = await this.load();
    return [...data.accounts];
  }

  async saveAccount(account: Account): Promise<Account> {
    const data = await this.load();
    const idx = data.accounts.findIndex(a => a.id === account.id);
    if (idx >= 0) {
      data.accounts[idx] = account;
    } else {
      data.accounts.push(account);
    }
    this.persist();
    return account;
  }

  async deleteAccount(id: string): Promise<void> {
    const data = await this.load();
    data.accounts = data.accounts.filter(a => a.id !== id);
    // Também remove ou desassocia transações
    data.transactions = data.transactions.filter(t => t.accountId !== id);
    this.persist();
  }

  // --- CATEGORIES ---
  async getCategories(): Promise<Category[]> {
    const data = await this.load();
    return [...data.categories];
  }

  async saveCategory(category: Category): Promise<Category> {
    const data = await this.load();
    const idx = data.categories.findIndex(c => c.id === category.id);
    if (idx >= 0) {
      data.categories[idx] = category;
    } else {
      data.categories.push(category);
    }
    this.persist();
    return category;
  }

  async deleteCategory(id: string): Promise<void> {
    const data = await this.load();
    const catToDelete = data.categories.find(c => c.id === id);
    if (!catToDelete) return;

    if (!catToDelete.isCustom) {
      throw new Error('Não é possível excluir categorias padrão do sistema.');
    }

    const fallbackId = catToDelete.type === 'income' ? 'cat-outras-rec' : 'cat-outros-desp';

    // Reatribui transações órfãs
    data.transactions.forEach(t => {
      if (t.categoryId === id) {
        t.categoryId = fallbackId;
        t.updatedAt = new Date().toISOString();
      }
    });

    // Remove orçamentos vinculados
    data.budgets = data.budgets.filter(b => b.categoryId !== id);

    // Remove regras de merchant vinculadas
    if (data.categoryRules) {
      data.categoryRules = data.categoryRules.filter(r => r.categoryId !== id);
    }

    // Reatribui assinaturas vinculadas
    if (data.subscriptions) {
      data.subscriptions.forEach(s => {
        if (s.categoryId === id) {
          s.categoryId = fallbackId;
          s.updatedAt = new Date().toISOString();
        }
      });
    }

    data.categories = data.categories.filter(c => c.id !== id);
    this.persist();
  }

  // --- TRANSACTIONS ---
  async getTransactions(): Promise<Transaction[]> {
    const data = await this.load();
    return [...data.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const data = await this.load();
    return data.transactions.find(t => t.id === id);
  }

  async saveTransaction(transaction: Transaction): Promise<Transaction> {
    const data = await this.load();
    const idx = data.transactions.findIndex(t => t.id === transaction.id);
    const oldTx = idx >= 0 ? data.transactions[idx] : null;

    if (idx >= 0) {
      data.transactions[idx] = transaction;
    } else {
      data.transactions.unshift(transaction);
    }

    // Se confirmada, atualizar saldo das contas
    if (transaction.status === 'confirmed') {
      // 1. Reverter impacto anterior se estiver editando
      if (oldTx && oldTx.status === 'confirmed') {
        if (oldTx.type === 'transfer') {
          const oldSrc = data.accounts.find(a => a.id === oldTx.accountId);
          if (oldSrc) oldSrc.balance = Math.round((oldSrc.balance + oldTx.amount) * 100) / 100;
          const oldDest = data.accounts.find(a => a.id === oldTx.destinationAccountId);
          if (oldDest) oldDest.balance = Math.round((oldDest.balance - oldTx.amount) * 100) / 100;
        } else {
          const oldAccount = data.accounts.find(a => a.id === oldTx.accountId);
          if (oldAccount) {
            const isCard = oldAccount.type === 'credit_card';
            if (isCard) {
              if (oldTx.type === 'expense') oldAccount.balance -= oldTx.amount;
              else if (oldTx.type === 'income') oldAccount.balance += oldTx.amount;
            } else {
              if (oldTx.type === 'income') oldAccount.balance -= oldTx.amount;
              else if (oldTx.type === 'expense') oldAccount.balance += oldTx.amount;
            }
            oldAccount.balance = Math.round(oldAccount.balance * 100) / 100;
          }
        }
      }

      // 2. Aplicar novo impacto
      if (transaction.type === 'transfer') {
        const srcAccount = data.accounts.find(a => a.id === transaction.accountId);
        if (srcAccount) {
          srcAccount.balance = Math.round((srcAccount.balance - transaction.amount) * 100) / 100;
          srcAccount.updatedAt = new Date().toISOString();
        }
        const destAccount = data.accounts.find(a => a.id === transaction.destinationAccountId);
        if (destAccount) {
          destAccount.balance = Math.round((destAccount.balance + transaction.amount) * 100) / 100;
          destAccount.updatedAt = new Date().toISOString();
        }
      } else {
        const account = data.accounts.find(a => a.id === transaction.accountId);
        if (account) {
          const isCard = account.type === 'credit_card';

          if (isCard) {
            // No cartão de crédito, uma despesa aumenta o valor da fatura em aberto!
            if (transaction.type === 'expense') {
              account.balance += transaction.amount;
            } else if (transaction.type === 'income') {
              // Pagamento de fatura ou estorno diminui o valor da fatura em aberto
              account.balance -= transaction.amount;
            }
          } else {
            // Em conta corrente/poupança: receita aumenta saldo, despesa diminui
            if (transaction.type === 'income') {
              account.balance += transaction.amount;
            } else if (transaction.type === 'expense') {
              account.balance -= transaction.amount;
            }
          }

          account.balance = Math.round(account.balance * 100) / 100;
          account.updatedAt = new Date().toISOString();
        }
      }
    }

    this.persist();
    return transaction;
  }

  async saveInstallmentTransactions(transactions: Transaction[]): Promise<Transaction[]> {
    const data = await this.load();
    if (transactions.length === 0) return [];

    const firstTx = transactions[0];
    const account = data.accounts.find(a => a.id === firstTx.accountId);
    const isCard = account && account.type === 'credit_card';

    // Adiciona todas as transações de parcelas
    for (const tx of transactions) {
      data.transactions.unshift(tx);
    }

    if (account && isCard) {
      const now = new Date();
      const curMonth = now.getUTCMonth() + 1;
      const curYear = now.getUTCFullYear();

      // Soma das parcelas do mês atual para a fatura aberta imediata
      const currentMonthAmount = transactions
        .filter(t => {
          const d = new Date(t.date);
          return d.getUTCMonth() + 1 === curMonth && d.getUTCFullYear() === curYear;
        })
        .reduce((sum, t) => sum + t.amount, 0);

      // Soma total de todas as parcelas da compra (compromete o limite total do cartão)
      const totalPurchaseAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

      account.balance = Math.round(((account.balance || 0) + currentMonthAmount) * 100) / 100;
      account.invoiceAmount = account.balance;
      const currentOpen = account.openAmount ?? (account.balance - currentMonthAmount);
      account.openAmount = Math.round((currentOpen + totalPurchaseAmount) * 100) / 100;
      account.updatedAt = new Date().toISOString();
    }

    this.persist();
    return transactions;
  }

  async deleteInstallmentGroup(groupId: string): Promise<void> {
    const data = await this.load();
    const groupTxs = data.transactions.filter(t => t.installmentGroupId === groupId);
    if (groupTxs.length === 0) return;

    const firstTx = groupTxs[0];
    const account = data.accounts.find(a => a.id === firstTx.accountId);

    if (account && account.type === 'credit_card') {
      const now = new Date();
      const curMonth = now.getUTCMonth() + 1;
      const curYear = now.getUTCFullYear();

      // Parcelas do mês atual que estavam no saldo
      const currentMonthAmount = groupTxs
        .filter(t => {
          const d = new Date(t.date);
          return d.getUTCMonth() + 1 === curMonth && d.getUTCFullYear() === curYear;
        })
        .reduce((sum, t) => sum + t.amount, 0);

      // Total de todas as parcelas do grupo
      const totalGroupAmount = groupTxs.reduce((sum, t) => sum + t.amount, 0);

      account.balance = Math.max(0, Math.round(((account.balance || 0) - currentMonthAmount) * 100) / 100);
      account.invoiceAmount = account.balance;
      if (account.openAmount !== undefined) {
        account.openAmount = Math.max(0, Math.round((account.openAmount - totalGroupAmount) * 100) / 100);
      }
      account.updatedAt = new Date().toISOString();
    }

    data.transactions = data.transactions.filter(t => t.installmentGroupId !== groupId);
    this.persist();
  }

  async deleteTransaction(id: string): Promise<void> {
    const data = await this.load();
    const tx = data.transactions.find(t => t.id === id);
    if (tx && tx.status === 'confirmed') {
      if (tx.type === 'transfer') {
        const srcAccount = data.accounts.find(a => a.id === tx.accountId);
        if (srcAccount) {
          srcAccount.balance = Math.round((srcAccount.balance + tx.amount) * 100) / 100;
          srcAccount.updatedAt = new Date().toISOString();
        }
        const destAccount = data.accounts.find(a => a.id === tx.destinationAccountId);
        if (destAccount) {
          destAccount.balance = Math.round((destAccount.balance - tx.amount) * 100) / 100;
          destAccount.updatedAt = new Date().toISOString();
        }
      } else {
        const account = data.accounts.find(a => a.id === tx.accountId);
        if (account) {
          const isCard = account.type === 'credit_card';
          if (isCard) {
            // Ao excluir uma despesa do cartão, a fatura diminui
            if (tx.type === 'expense') {
              account.balance = Math.max(0, account.balance - tx.amount);
              if (account.openAmount !== undefined) {
                account.openAmount = Math.max(0, account.openAmount - tx.amount);
              }
            } else if (tx.type === 'income') {
              account.balance += tx.amount;
            }
            account.invoiceAmount = account.balance;
          } else {
            if (tx.type === 'income') account.balance -= tx.amount;
            else if (tx.type === 'expense') account.balance += tx.amount;
          }
          account.balance = Math.round(account.balance * 100) / 100;
          account.updatedAt = new Date().toISOString();
        }
      }
    }
    data.transactions = data.transactions.filter(t => t.id !== id);
    this.persist();
  }

  // --- BUDGETS ---
  async getBudgets(month?: number, year?: number): Promise<Budget[]> {
    const data = await this.load();
    if (month && year) {
      return data.budgets.filter(b => b.month === month && b.year === year);
    }
    return [...data.budgets];
  }

  async saveBudget(budget: Budget): Promise<Budget> {
    const data = await this.load();
    const idx = data.budgets.findIndex(b => 
      b.categoryId === budget.categoryId && 
      b.month === budget.month && 
      b.year === budget.year
    );
    if (idx >= 0) {
      data.budgets[idx] = budget;
    } else {
      data.budgets.push(budget);
    }
    this.persist();
    return budget;
  }

  async deleteBudget(id: string): Promise<void> {
    const data = await this.load();
    data.budgets = data.budgets.filter(b => b.id !== id);
    this.persist();
  }

  // --- GOALS ---
  async getGoals(): Promise<Goal[]> {
    const data = await this.load();
    return [...data.goals];
  }

  async saveGoal(goal: Goal): Promise<Goal> {
    const data = await this.load();
    const idx = data.goals.findIndex(g => g.id === goal.id);
    if (idx >= 0) {
      data.goals[idx] = goal;
    } else {
      data.goals.push(goal);
    }
    this.persist();
    return goal;
  }

  async deleteGoal(id: string): Promise<void> {
    const data = await this.load();
    data.goals = data.goals.filter(g => g.id !== id);
    data.goalContributions = (data.goalContributions || []).filter(c => c.goalId !== id);
    this.persist();
  }

  // --- GOAL CONTRIBUTIONS (EXTRATO DA META) ---
  async getGoalContributions(goalId?: string): Promise<GoalContribution[]> {
    const data = await this.load();
    const list = data.goalContributions || [];
    if (goalId) {
      return list.filter(c => c.goalId === goalId);
    }
    return [...list];
  }

  async saveGoalContribution(contribution: GoalContribution): Promise<GoalContribution> {
    const data = await this.load();
    if (!data.goalContributions) data.goalContributions = [];
    const idx = data.goalContributions.findIndex(c => c.id === contribution.id);
    if (idx >= 0) {
      data.goalContributions[idx] = contribution;
    } else {
      data.goalContributions.unshift(contribution);
    }
    this.persist();
    return contribution;
  }

  async deleteGoalContribution(id: string): Promise<void> {
    const data = await this.load();
    data.goalContributions = (data.goalContributions || []).filter(c => c.id !== id);
    this.persist();
  }

  // --- PENDING NOTIFICATIONS ---
  async getPendingNotifications(): Promise<PendingNotification[]> {
    const data = await this.load();
    return data.pendingNotifications.filter(n => n.status === 'pending');
  }

  async savePendingNotification(notification: PendingNotification): Promise<PendingNotification> {
    const data = await this.load();
    const idx = data.pendingNotifications.findIndex(n => n.id === notification.id);
    if (idx >= 0) {
      data.pendingNotifications[idx] = notification;
    } else {
      data.pendingNotifications.unshift(notification);
    }
    this.persist();
    return notification;
  }

  async updatePendingNotificationStatus(id: string, status: 'approved' | 'discarded'): Promise<void> {
    const data = await this.load();
    const notif = data.pendingNotifications.find(n => n.id === id);
    if (notif) {
      notif.status = status;
      this.persist();
    }
  }

  // --- SUBSCRIPTIONS ---
  async getSubscriptions(): Promise<Subscription[]> {
    const data = await this.load();
    return [...(data.subscriptions || [])];
  }

  async saveSubscription(subscription: Subscription): Promise<Subscription> {
    const data = await this.load();
    if (!data.subscriptions) data.subscriptions = [];
    const idx = data.subscriptions.findIndex(s => s.id === subscription.id);
    if (idx >= 0) {
      data.subscriptions[idx] = subscription;
    } else {
      data.subscriptions.unshift(subscription);
    }
    this.persist();
    return subscription;
  }

  async deleteSubscription(id: string): Promise<void> {
    const data = await this.load();
    data.subscriptions = (data.subscriptions || []).filter(s => s.id !== id);
    this.persist();
  }

  // --- CATEGORY RULES (HISTÓRICO E APRENDIZADO LOCAL) ---
  async getCategoryRules(): Promise<CategoryRule[]> {
    const data = await this.load();
    return [...(data.categoryRules || [])];
  }

  async saveCategoryRule(rule: CategoryRule): Promise<CategoryRule> {
    const data = await this.load();
    if (!data.categoryRules) data.categoryRules = [];
    const idx = data.categoryRules.findIndex(r => r.merchantPattern.toLowerCase() === rule.merchantPattern.toLowerCase());
    if (idx >= 0) {
      data.categoryRules[idx] = rule;
    } else {
      data.categoryRules.push(rule);
    }
    this.persist();
    return rule;
  }

  async deleteCategoryRule(id: string): Promise<void> {
    const data = await this.load();
    data.categoryRules = (data.categoryRules || []).filter(r => r.id !== id);
    this.persist();
  }

  // --- DESCRIPTION RULES (PADRONIZAÇÃO DE NOMES E ESTABELECIMENTOS) ---
  async getDescriptionRules(): Promise<DescriptionRule[]> {
    const data = await this.load();
    return [...(data.descriptionRules || [])];
  }

  async saveDescriptionRule(rule: DescriptionRule): Promise<DescriptionRule> {
    const data = await this.load();
    if (!data.descriptionRules) data.descriptionRules = [];
    const idx = data.descriptionRules.findIndex(r => r.pattern.toLowerCase() === rule.pattern.toLowerCase());
    if (idx >= 0) {
      data.descriptionRules[idx] = rule;
    } else {
      data.descriptionRules.push(rule);
    }
    this.persist();
    return rule;
  }

  async deleteDescriptionRule(id: string): Promise<void> {
    const data = await this.load();
    data.descriptionRules = (data.descriptionRules || []).filter(r => r.id !== id);
    this.persist();
  }

  // --- DISMISSED SUBSCRIPTIONS (NÃO É ASSINATURA) ---
  async getDismissedSubscriptionMerchants(): Promise<string[]> {
    const data = await this.load();
    return [...(data.dismissedSubscriptionMerchants || [])];
  }

  async dismissSubscriptionSuggestion(merchantPattern: string): Promise<void> {
    const data = await this.load();
    if (!data.dismissedSubscriptionMerchants) data.dismissedSubscriptionMerchants = [];
    const normalized = merchantPattern.trim().toLowerCase();
    if (!data.dismissedSubscriptionMerchants.includes(normalized)) {
      data.dismissedSubscriptionMerchants.push(normalized);
      this.persist();
    }
  }

  // Reset completo
  async resetAll(mode: 'empty' | 'demo' = 'empty'): Promise<void> {
    this.memoryData = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('sobra_finance_database_v1');
      } catch {}
    }
    if (mode === 'demo') {
      this.memoryData = this.getDemoData();
      this.persist();
      return;
    }
    await this.load();
  }

  // --- BACKUP & RESTAURAÇÃO TOTAL ---
  async exportFullBackup(): Promise<StorageData> {
    const data = await this.load();
    return JSON.parse(JSON.stringify(data));
  }

  async importFullBackup(backupData: StorageData): Promise<void> {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('Formato de dados de backup inválido.');
    }
    const initialCategories: Category[] = INITIAL_CATEGORIES.map(c => ({
      ...c,
      createdAt: new Date().toISOString(),
    }));

    this.memoryData = {
      accounts: Array.isArray(backupData.accounts) ? backupData.accounts : [],
      categories: Array.isArray(backupData.categories) && backupData.categories.length > 0 ? backupData.categories : initialCategories,
      transactions: Array.isArray(backupData.transactions) ? backupData.transactions : [],
      budgets: Array.isArray(backupData.budgets) ? backupData.budgets : [],
      goals: Array.isArray(backupData.goals) ? backupData.goals : [],
      goalContributions: Array.isArray(backupData.goalContributions) ? backupData.goalContributions : [],
      pendingNotifications: Array.isArray(backupData.pendingNotifications) ? backupData.pendingNotifications : [],
      subscriptions: Array.isArray(backupData.subscriptions) ? backupData.subscriptions : [],
      categoryRules: Array.isArray(backupData.categoryRules) ? backupData.categoryRules : [],
      descriptionRules: Array.isArray(backupData.descriptionRules) ? backupData.descriptionRules : [],
      dismissedSubscriptionMerchants: Array.isArray(backupData.dismissedSubscriptionMerchants) ? backupData.dismissedSubscriptionMerchants : [],
    };
    this.persist();
  }
}

export const db = new DatabaseAdapter();
