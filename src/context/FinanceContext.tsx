import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Account, 
  Category, 
  Transaction, 
  Budget, 
  Goal, 
  GoalContribution,
  PendingNotification,
  ParsedBankNotification,
  Subscription,
  CategoryRule,
  DescriptionRule,
  SubscriptionSuggestion,
  SubscriptionCadence,
  ActiveInstallmentGroup,
  PartnershipSpace,
  UserProfile
} from '../core/types';
import { 
  getLocalPartnershipSpace, 
  activatePartnershipSpace, 
  joinPartnershipSpaceWithCode, 
  updatePartnershipSpace,
  deactivatePartnershipSpace,
  saveLocalPartnershipSpace
} from '../services/partnershipService';
import { useAuth } from './AuthContext';
import { db, StorageData } from '../database/adapter';
import { notificationListenerBridge } from '../native/notificationListener';
import { ParsedCsvRow, isRefundDescription, extractInstallmentFromDescription, isInvoicePaymentDescription } from '../core/parsers/csvParser';
import { categorizationEngine } from '../core/categorization/categorizationEngine';
import { merchantCleaner } from '../core/categorization/merchantCleaner';
import { recurrenceDetector } from '../core/subscriptions/recurrenceDetector';
import { accountMatchesCardDigits } from '../core/cards/cardSelectionHelper';
import { getBankByPackage, getBankById } from '../core/banks/bankCatalog';
import { 
  generateInstallmentTransactions, 
  getActiveInstallmentGroups, 
  addMonthsToDate,
  calculateInvoiceForMonth
} from '../core/installments/installmentHelper';
import { detectSalaryAdvance } from '../core/salary/salaryCycleHelper';
import { 
  broadcastSharedTransaction, 
  subscribeToSharedCards, 
  getCurrentUserProfile,
  fetchSharedAccountMembers,
  fetchSharedTransactions,
  syncAccountTransactionsToCloud,
  deleteSharedTransactionsBatchFromCloud,
  subscribeToPartnershipSpace,
  broadcastSharedCardDelete,
  broadcastSharedCardUpdate,
  broadcastSharedCardMemberLeft,
  fetchUserSharedAccounts,
  broadcastPartnershipEvent,
  supabase,
  isSupabaseConfigured
} from '../services/supabase';
import {
  syncSharedGoalToCloud,
  deleteSharedGoalFromCloud,
  syncSharedBudgetToCloud,
  deleteSharedBudgetFromCloud,
  syncSharedSubscriptionToCloud,
  deleteSharedSubscriptionFromCloud,
  syncSharedContributionToCloud,
  deleteSharedContributionFromCloud,
  syncSharedCardToCloud,
  deleteSharedCardFromCloud,
  syncAllLocalSharedItemsWithCloud,
} from '../services/sharedItemsSyncService';
import { normalizeSharedMembers } from '../services/partnershipService';

interface FinanceContextType {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  goalContributions: GoalContribution[];
  pendingNotifications: PendingNotification[];
  subscriptions: Subscription[];
  categoryRules: CategoryRule[];
  descriptionRules: DescriptionRule[];
  subscriptionSuggestions: SubscriptionSuggestion[];
  activeInstallmentGroups: ActiveInstallmentGroup[];
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  isLoading: boolean;
  onlyRegisteredBanks: boolean;
  autoAddCreditToInvoice: boolean;
  toggleOnlyRegisteredBanks: (enabled?: boolean) => void;
  toggleAutoAddCreditToInvoice: (enabled?: boolean) => void;

  // Ações de Transação
  saveTransaction: (
    tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string },
    asSubscription?: { cadence: SubscriptionCadence; nextBillingDate?: string },
    options?: { learnCategory?: boolean; syncInstallmentSiblings?: boolean }
  ) => Promise<Transaction>;
  saveInstallmentPurchase: (params: {
    accountId: string;
    categoryId: string;
    description: string;
    totalAmount: number;
    installmentCount: number;
    startDate?: string;
    cardLastDigits?: string;
    notes?: string;
    learnCategory?: boolean;
  }) => Promise<Transaction[]>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteTransactionsBatch?: (ids: string[]) => Promise<void>;
  deleteInstallmentGroup: (groupId: string) => Promise<void>;

  // Ações de Contas
  saveAccount: (acc: Omit<Account, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<Account>;
  deleteAccount: (id: string) => Promise<void>;

  // Ações de Categorias
  saveCategory: (cat: Omit<Category, 'id' | 'createdAt'> & { id?: string; isCustom?: boolean }) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;

  // Ações de Orçamento
  saveBudget: (b: Omit<Budget, 'id' | 'createdAt'> & { id?: string }) => Promise<Budget>;
  deleteBudget: (id: string) => Promise<void>;

  // Ações de Metas e Aportes
  saveGoal: (g: Omit<Goal, 'id' | 'createdAt'> & { id?: string }) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;
  addGoalContribution: (contribution: Omit<GoalContribution, 'id' | 'createdAt'>) => Promise<GoalContribution>;
  updateGoalContribution: (id: string, newAmount: number, newDate?: string, note?: string) => Promise<GoalContribution>;
  deleteGoalContribution: (id: string) => Promise<void>;

  // Ações de Notificações
  approveNotification: (
    pendingId: string, 
    confirmedData: { 
      accountId: string; 
      categoryId: string; 
      amount: number; 
      description: string;
      date: string;
      type: 'income' | 'expense';
      paymentMethod: any;
      syncAccountBalance?: boolean;
      asSubscription?: { cadence: SubscriptionCadence; nextBillingDate?: string };
      isInstallment?: boolean;
      installmentCount?: number;
    }
  ) => Promise<void>;
  approveNotificationWithNewAccount: (
    pendingId: string,
    account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    customCategory?: string
  ) => Promise<{ account: Account }>;
  discardNotification: (pendingId: string) => Promise<void>;
  simulateIncomingNotification: (title: string, text: string, packageName?: string, bypassDuplicateCheck?: boolean) => Promise<PendingNotification | null>;

  // Ações de Assinaturas e Recorrências
  saveSubscription: (sub: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<Subscription>;
  deleteSubscription: (id: string) => Promise<void>;
  confirmSubscriptionSuggestion: (suggestion: SubscriptionSuggestion) => Promise<Subscription>;
  dismissSubscriptionSuggestion: (merchantPattern: string) => Promise<void>;
  checkIfLikelySubscription: (description: string, amount?: number) => { isLikely: boolean; cadence: SubscriptionCadence; reason: string; serviceName?: string };

  // Aprendizado e Sugestão Inteligente de Categorias
  recordCategoryLearning: (merchant: string, categoryId: string) => Promise<void>;
  suggestCategoryForMerchant: (merchantName: string) => Category | undefined;

  // Regras de Padronização de Nomes / Descrições
  saveDescriptionRule: (rule: DescriptionRule) => Promise<DescriptionRule>;
  deleteDescriptionRule: (id: string) => Promise<void>;
  cleanTransactionDescription: (rawDescription: string) => string;

  // Importação CSV em Lote
  importCsvTransactions: (
    rows: ParsedCsvRow[], 
    accountId: string, 
    options?: {
      defaultCategoryId?: string;
      ignoreInvoicePayments?: boolean;
      projectFutureInstallments?: boolean;
    } | string
  ) => Promise<number>;
  deleteCardImportedTransactions: (cardId: string, transactionIds?: string[]) => Promise<number>;

  refreshData: () => Promise<void>;
  resetAllData: () => Promise<void>;
  exportFullBackup: () => Promise<StorageData>;
  importFullBackup: (backupData: StorageData) => Promise<void>;

  // Finanças a Dois (Modo Parceiro)
  partnershipSpace: PartnershipSpace | null;
  isPartnershipActive: boolean;
  activatePartnership: () => Promise<PartnershipSpace>;
  joinPartnershipWithCode: (code: string) => Promise<PartnershipSpace>;
  updatePartnershipSettings: (updates: Partial<PartnershipSpace>) => void;
  disconnectPartnership: () => void;

  // Cartão visualizado atualmente em tela/fatura
  activeViewedCardId: string | null;
  setActiveViewedCardId: (id: string | null) => void;
}

export const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const useFinanceOptional = () => {
  return useContext(FinanceContext);
};

/**
 * Autocura e deduplicação inteligente de assinaturas duplicadas
 */
async function deduplicateSubscriptions(
  subs: Subscription[],
  transactions: Transaction[],
  partnershipCode?: string
): Promise<{ subscriptions: Subscription[]; transactions: Transaction[] }> {
  if (!subs || subs.length === 0) return { subscriptions: subs || [], transactions };

  const canonicalList: Subscription[] = [];
  const idRedirectionMap = new Map<string, string>(); // dupId -> canonicalId

  for (const sub of subs) {
    if (sub.type === 'income') {
      canonicalList.push(sub);
      continue;
    }

    const normName = categorizationEngine.normalize(sub.name);
    if (!normName) {
      canonicalList.push(sub);
      continue;
    }

    // Procura match com assinatura já analisada
    const matchIndex = canonicalList.findIndex(existing => {
      if (existing.type === 'income') return false;
      const existingNorm = categorizationEngine.normalize(existing.name);
      const isNameMatch =
        existingNorm === normName ||
        (existingNorm.length >= 3 && normName.length >= 3 && (existingNorm.includes(normName) || normName.includes(existingNorm)));
      if (!isNameMatch) return false;

      // Se ambas tiverem conta especificada e forem contas distintas, não considera duplicata
      if (sub.accountId && existing.accountId && sub.accountId !== existing.accountId) {
        return false;
      }
      return true;
    });

    if (matchIndex >= 0) {
      const canonical = canonicalList[matchIndex];
      const subTime = new Date(sub.updatedAt || sub.createdAt || 0).getTime();
      const canTime = new Date(canonical.updatedAt || canonical.createdAt || 0).getTime();

      let winner = canonical;
      let loser = sub;

      if (sub.lastChargeDate && !canonical.lastChargeDate) {
        winner = sub;
        loser = canonical;
      } else if (subTime > canTime && sub.amount > 0) {
        winner = sub;
        loser = canonical;
      }

      const mergedBillingDay =
        winner.dayOfMonth ||
        loser.dayOfMonth ||
        (winner.nextBillingDate ? new Date(winner.nextBillingDate).getUTCDate() : undefined) ||
        (loser.nextBillingDate ? new Date(loser.nextBillingDate).getUTCDate() : undefined) ||
        1;

      const merged: Subscription = {
        ...winner,
        accountId: winner.accountId || loser.accountId,
        categoryId: winner.categoryId || loser.categoryId,
        amount: winner.amount || loser.amount,
        cadence: winner.cadence || loser.cadence || 'monthly',
        dayOfMonth: mergedBillingDay,
        lastChargeDate: winner.lastChargeDate || loser.lastChargeDate,
        nextBillingDate: winner.nextBillingDate || loser.nextBillingDate,
        status: (winner.status === 'active' || loser.status === 'active') ? 'active' : 'cancelled',
        isShared: Boolean(winner.isShared || loser.isShared),
        updatedAt: new Date().toISOString(),
      };

      canonicalList[matchIndex] = merged;
      idRedirectionMap.set(loser.id, merged.id);

      try {
        await db.deleteSubscription(loser.id);
        if (loser.isShared && partnershipCode) {
          deleteSharedSubscriptionFromCloud(partnershipCode, loser.id).catch(() => {});
          broadcastPartnershipEvent(partnershipCode, 'subscription_deleted', { subscriptionId: loser.id }).catch(() => {});
        }
      } catch (err) {
        console.warn('[FinanceContext] Falha ao remover assinatura duplicada:', err);
      }
    } else {
      canonicalList.push(sub);
    }
  }

  // Persiste as alterações canônicas
  for (const sub of canonicalList) {
    try {
      await db.saveSubscription(sub);
    } catch {}
  }

  // Re-aponta transações que faziam referência às assinaturas duplicadas excluídas
  let updatedTxs = transactions;
  if (idRedirectionMap.size > 0) {
    updatedTxs = transactions.map(t => {
      if (t.subscriptionId && idRedirectionMap.has(t.subscriptionId)) {
        const canonicalId = idRedirectionMap.get(t.subscriptionId)!;
        const modified = { ...t, subscriptionId: canonicalId, isRecurring: true };
        db.saveTransaction(modified).catch(() => {});
        return modified;
      }
      return t;
    });
  }

  return { subscriptions: canonicalList, transactions: updatedTxs };
}

/**
 * Sincroniza lançamentos de assinaturas ativas garantindo que apareçam
 * nas faturas de cartão no dia programado sem duplicações.
 */
async function syncSubscriptionTransactions(
  subs: Subscription[],
  transactions: Transaction[],
  accounts: Account[]
): Promise<Transaction[]> {
  const activeExpenseSubs = subs.filter(s => s.status === 'active' && s.type !== 'income' && s.accountId);
  if (activeExpenseSubs.length === 0) return transactions;

  const currentTxs = [...transactions];
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();
  const nowMs = Date.now();

  let modified = false;

  // Auto-limpeza de lançamentos pré-gerados com data futura:
  // Assinaturas em cartão/banco não devem ser pré-lançadas antes do necessário,
  // pois a cobrança real é detectada no dia pelo app via notificação/extrato.
  const ghostFutureTxs = currentTxs.filter(t => 
    t.id.startsWith('tx-sub-') && 
    !t.rawNotificationPayload && 
    new Date(t.date).getTime() > nowMs
  );

  if (ghostFutureTxs.length > 0) {
    const ghostIds = new Set(ghostFutureTxs.map(g => g.id));
    for (const ghost of ghostFutureTxs) {
      try {
        await db.deleteTransaction(ghost.id);
      } catch (err) {
        console.warn('[FinanceContext] Erro ao limpar lançamento futuro de assinatura:', err);
      }
    }
    const remaining = currentTxs.filter(t => !ghostIds.has(t.id));
    currentTxs.length = 0;
    currentTxs.push(...remaining);
    modified = true;
  }

  for (const sub of activeExpenseSubs) {
    const acc = accounts.find(a => a.id === sub.accountId);
    if (!acc) continue;

    // Determina o dia da cobrança
    const startDate = sub.lastChargeDate ? new Date(sub.lastChargeDate) : (sub.createdAt ? new Date(sub.createdAt) : now);
    const billingDay = sub.dayOfMonth || (sub.nextBillingDate ? new Date(sub.nextBillingDate).getUTCDate() : startDate.getUTCDate()) || 1;

    // Determina o intervalo de meses a sincronizar:
    // Do mês de início da assinatura até o mês atual (e próximo mês se a fatura já estiver aberta)
    const startM = (!isNaN(startDate.getTime())) ? startDate.getUTCMonth() + 1 : currentMonth;
    const startY = (!isNaN(startDate.getTime())) ? startDate.getUTCFullYear() : currentYear;

    const monthsToSync: { month: number; year: number }[] = [];
    let iterY = startY;
    let iterM = startM;

    // Limite de segurança: não recuar mais de 4 meses no passado
    const minPastYear = currentMonth <= 4 ? currentYear - 1 : currentYear;
    const minPastMonth = currentMonth <= 4 ? (currentMonth + 12 - 4) : (currentMonth - 4);
    if (iterY < minPastYear || (iterY === minPastYear && iterM < minPastMonth)) {
      iterY = minPastYear;
      iterM = minPastMonth;
    }

    // Se o fechamento do cartão já passou no mês atual, a fatura em aberto é a do próximo mês
    const closingDay = acc.closingDay || 1;
    const isPastClosing = now.getDate() >= closingDay;
    const maxMonth = isPastClosing ? (currentMonth === 12 ? 1 : currentMonth + 1) : currentMonth;
    const maxYear = isPastClosing && currentMonth === 12 ? currentYear + 1 : currentYear;

    while (iterY < maxYear || (iterY === maxYear && iterM <= maxMonth)) {
      monthsToSync.push({ month: iterM, year: iterY });
      iterM++;
      if (iterM > 12) {
        iterM = 1;
        iterY++;
      }
    }

    for (const { month, year } of monthsToSync) {
      // Se este mês foi pontualmente excluído da assinatura, não sincroniza
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      if (sub.excludedMonths && sub.excludedMonths.includes(monthKey)) {
        continue;
      }

      // Se anual, só sincroniza no mês devido
      if (sub.cadence === 'yearly') {
        const dueM = sub.nextBillingDate ? new Date(sub.nextBillingDate).getUTCMonth() + 1 : startM;
        if (dueM !== month) continue;
      }

      // Verifica se já existe transação efetiva para esta assinatura neste mês
      const normSubName = categorizationEngine.normalize(sub.name);
      const existingTxIndex = currentTxs.findIndex(t => {
        if (t.accountId !== sub.accountId) return false;
        if (t.status !== 'confirmed') return false;
        const d = new Date(t.date);
        if (d.getUTCMonth() + 1 !== month || d.getUTCFullYear() !== year) return false;

        if (t.subscriptionId && t.subscriptionId === sub.id) return true;
        if (t.id === `tx-sub-${sub.id}-${year}-${String(month).padStart(2, '0')}`) return true;

        if (t.type === 'expense') {
          const normDesc = categorizationEngine.normalize(t.description);
          return normDesc === normSubName || normDesc.includes(normSubName) || normSubName.includes(normDesc);
        }
        return false;
      });

      if (existingTxIndex >= 0) {
        const existingTx = currentTxs[existingTxIndex];
        let txChanged = false;

        // Se o valor ou dados mudaram na assinatura e a transação foi gerada automaticamente:
        if (existingTx.id.startsWith(`tx-sub-${sub.id}-`) && existingTx.amount !== sub.amount) {
          existingTx.amount = sub.amount;
          txChanged = true;
        }

        // Se o nome mudou na assinatura e a transação foi gerada automaticamente ou está vinculada:
        if ((existingTx.id.startsWith(`tx-sub-${sub.id}-`) || existingTx.subscriptionId === sub.id) && existingTx.description !== sub.name) {
          existingTx.description = sub.name;
          txChanged = true;
        }

        if (!existingTx.subscriptionId || !existingTx.isRecurring || !existingTx.recurringDayOfMonth) {
          existingTx.subscriptionId = sub.id;
          existingTx.isRecurring = true;
          existingTx.recurringCadence = sub.cadence;
          existingTx.recurringDayOfMonth = billingDay;
          txChanged = true;
        }

        if (txChanged) {
          currentTxs[existingTxIndex] = { ...existingTx };
          db.saveTransaction(existingTx).catch(() => {});
          modified = true;
        }
      }
      // NOTA: Se não existe lançamento ainda neste mês, NÃO geramos transação sintética antecipada.
      // A assinatura será lançada no crédito e detectada automaticamente pelo app no dia da cobrança.
    }
  }

  return modified ? currentTxs : transactions;
}

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalContributions, setGoalContributions] = useState<GoalContribution[]>([]);
  const [pendingNotifications, setPendingNotifications] = useState<PendingNotification[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);
  const [descriptionRules, setDescriptionRules] = useState<DescriptionRule[]>([]);
  const [subscriptionSuggestions, setSubscriptionSuggestions] = useState<SubscriptionSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [activeViewedCardId, setActiveViewedCardId] = useState<string | null>(null);
  const isSharedSyncingRef = useRef<boolean>(false);
  const [onlyRegisteredBanks, setOnlyRegisteredBanks] = useState(() => {
    return localStorage.getItem('sobra_only_registered_banks') === 'true';
  });
  const [autoAddCreditToInvoice, setAutoAddCreditToInvoice] = useState(() => {
    return localStorage.getItem('sobra_auto_add_credit_to_invoice') !== 'false';
  });

  const toggleOnlyRegisteredBanks = (enabled?: boolean) => {
    const nextVal = enabled !== undefined ? enabled : !onlyRegisteredBanks;
    setOnlyRegisteredBanks(nextVal);
    localStorage.setItem('sobra_only_registered_banks', nextVal ? 'true' : 'false');
  };

  const toggleAutoAddCreditToInvoice = (enabled?: boolean) => {
    const nextVal = enabled !== undefined ? enabled : !autoAddCreditToInvoice;
    setAutoAddCreditToInvoice(nextVal);
    localStorage.setItem('sobra_auto_add_credit_to_invoice', nextVal ? 'true' : 'false');
  };

  // Espaço Finanças a Dois
  const [partnershipSpace, setPartnershipSpace] = useState<PartnershipSpace | null>(() => {
    return getLocalPartnershipSpace();
  });

  useEffect(() => {
    if (!partnershipSpace && accounts.length > 0) {
      const space = getLocalPartnershipSpace(accounts);
      if (space) {
        setPartnershipSpace(space);
      }
    }
  }, [accounts, partnershipSpace]);

  const isPartnershipActive = Boolean(partnershipSpace && partnershipSpace.isActive);

  const activatePartnership = async (): Promise<PartnershipSpace> => {
    const currentUser: UserProfile = user || {
      id: 'usr-local',
      displayName: 'Você',
      email: '',
    };
    const space = await activatePartnershipSpace(currentUser);
    setPartnershipSpace(space);
    return space;
  };

  const joinPartnershipWithCode = async (code: string): Promise<PartnershipSpace> => {
    const currentUser: UserProfile = user || {
      id: 'usr-local',
      displayName: 'Você',
      email: '',
    };
    const space = await joinPartnershipSpaceWithCode(code, currentUser);
    setPartnershipSpace(space);

    // Se o convite trouxe uma conta de cartão associada, salva localmente e baixa transações
    if (space.accountToImport) {
      try {
        const accs = await db.getAccounts();
        const existingAcc = accs.find(a => a.id === space.accountToImport!.id);
        if (!existingAcc) {
          await db.saveAccount(space.accountToImport as Account);
        }
        // Puxa transações existentes na nuvem
        const remoteTxs = await fetchSharedTransactions(space.accountToImport.id);
        if (remoteTxs && remoteTxs.length > 0) {
          for (const tx of remoteTxs) {
            await db.saveTransaction({
              ...tx,
              isShared: true,
            });
          }
        }
      } catch (importErr) {
        console.warn('Aviso ao importar dados do cartão no Finanças a Dois:', importErr);
      }
    }

    // Puxa e sincroniza metas, orçamentos, assinaturas e aportes do espaço conectado
    try {
      const [currentGoals, currentBudgets, currentSubs, currentContribs, currentAccs] = await Promise.all([
        db.getGoals(),
        db.getBudgets(),
        db.getSubscriptions(),
        db.getGoalContributions(),
        db.getAccounts(),
      ]);
      const sharedAccIds = currentAccs.filter(a => a.isShared).map(a => a.id);
      await syncAllLocalSharedItemsWithCloud(space.code, {
        goals: currentGoals,
        budgets: currentBudgets,
        subscriptions: currentSubs,
        contributions: currentContribs,
        sharedAccountIds: sharedAccIds,
      });
    } catch (itemsErr) {
      console.warn('Aviso ao sincronizar itens do espaço conectado:', itemsErr);
    }

    await refreshData();
    return space;
  };

  const disconnectPartnership = () => {
    deactivatePartnershipSpace(partnershipSpace?.code, user?.id);
    setPartnershipSpace(null);
  };

  const updatePartnershipSettings = (updates: Partial<PartnershipSpace>) => {
    const updated = updatePartnershipSpace(updates);
    if (updated) {
      setPartnershipSpace(updated);
    }
  };

  const refreshData = useCallback(async () => {
    try {
      const [accs, cats, txs, bdgs, gls, contribs, notifs, subs, rules, dismissed, descRules] = await Promise.all([
        db.getAccounts(),
        db.getCategories(),
        db.getTransactions(),
        db.getBudgets(),
        db.getGoals(),
        db.getGoalContributions(),
        db.getPendingNotifications(),
        db.getSubscriptions(),
        db.getCategoryRules(),
        db.getDismissedSubscriptionMerchants(),
        db.getDescriptionRules(),
      ]);

      // Higienização automática de transações antigas salvas com ruído bruto de notificação bancária
      for (const t of txs) {
        if (t.description && (
          t.description.toLowerCase().includes('crédito aprovada') ||
          t.description.toLowerCase().includes('credito aprovada') ||
          (t.description.toLowerCase().includes('compra de r$') && t.description.toLowerCase().includes('aprovada em'))
        )) {
          const cleanedDesc = merchantCleaner.stripBankNoise(t.description);
          if (cleanedDesc && cleanedDesc !== t.description) {
            t.description = cleanedDesc;
            db.saveTransaction(t).catch(e => console.warn('Erro ao atualizar descrição limpa:', e));
          }
        }
      }

      // Processamento de Aportes Automáticos Mensais de Metas
      const today = new Date();
      const currentMonthKey = today.toISOString().substring(0, 7); // YYYY-MM
      const todayDateStr = today.toISOString().substring(0, 10);

      const contribList = [...contribs];
      const goalsList = [...gls];

      for (let i = 0; i < goalsList.length; i++) {
        const goal = goalsList[i];
        if (!goal.autoContributionEnabled || goal.isCompleted) continue;

        const alreadyContributed = contribList.some(
          c => c.goalId === goal.id && c.isAutomatic && c.date.substring(0, 7) === currentMonthKey
        ) || (goal.lastAutoContributionDate && goal.lastAutoContributionDate.substring(0, 7) === currentMonthKey);

        if (!alreadyContributed) {
          const monthlyAmount = goal.monthlyContributionAmount && goal.monthlyContributionAmount > 0
            ? goal.monthlyContributionAmount
            : (goal.targetDate ? (() => {
                const targetDateObj = new Date(goal.targetDate + 'T23:59:59');
                const diffMs = targetDateObj.getTime() - today.getTime();
                const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
                const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
                return Math.round((remaining / days) * 30 * 100) / 100;
              })() : Math.round((goal.targetAmount / 12) * 100) / 100);

          if (monthlyAmount > 0) {
            const newContrib: GoalContribution = {
              id: `contrib-auto-${goal.id}-${currentMonthKey}`,
              goalId: goal.id,
              amount: monthlyAmount,
              date: todayDateStr,
              isAutomatic: true,
              note: 'Aporte automático da economia',
              createdAt: new Date().toISOString(),
            };

            await db.saveGoalContribution(newContrib);
            contribList.unshift(newContrib);

            const newCurrent = Math.round((goal.currentAmount + monthlyAmount) * 100) / 100;
            const updatedGoal: Goal = {
              ...goal,
              currentAmount: newCurrent,
              lastAutoContributionDate: todayDateStr,
              isCompleted: newCurrent >= goal.targetAmount,
            };

            await db.saveGoal(updatedGoal);
            goalsList[i] = updatedGoal;
          }
        }
      }

      // Mapeamento de grupos de parcelas para unificar parcelas pertencentes à mesma compra
      const descGroupMap = new Map<string, string>();
      for (const t of txs) {
        const detected = extractInstallmentFromDescription(t.description);
        const idMatch = t.id?.match(/^tx-inst-(.+)-(\d+)$/);
        const groupId = t.installmentGroupId || (idMatch ? idMatch[1] : undefined);
        const total = t.installmentTotal || detected.installmentTotal;
        const cleanDesc = (detected.cleanDescription || t.description.replace(/\s*\(\d+\/\d+\)$/, '')).toLowerCase().trim();
        if (groupId && total) {
          const key = `${t.accountId}|${cleanDesc}|${total}|${Math.round(t.amount * 100)}`;
          if (!descGroupMap.has(key)) descGroupMap.set(key, groupId);
        }
      }

      // Autocura de transações de reembolso e compras parceladas em cartões de crédito
      let txsModified = false;
      const healedTxs = await Promise.all(
        txs.map(async t => {
          const acc = accs.find(a => a.id === t.accountId);
          const isCard = acc?.type === 'credit_card';
          let modified = false;
          let currentTx = t;

          const isRefundLike = t.isRefund || isRefundDescription(t.description);
          if (isCard && isRefundLike && t.type === 'expense') {
            currentTx = {
              ...currentTx,
              type: 'income',
              isRefund: true,
            };
            modified = true;
          }

          // Autocura de compras parceladas que perderam flags (ex: sync compartilhado ou importação direta)
          const detectedInst = extractInstallmentFromDescription(currentTx.description);
          const idMatch = currentTx.id?.match(/^tx-inst-(.+)-(\d+)$/);
          if ((detectedInst.isInstallment || idMatch) && (!currentTx.isInstallment || !currentTx.installmentGroupId || !currentTx.installmentTotal || !currentTx.installmentNumber)) {
            const num = currentTx.installmentNumber || (idMatch ? parseInt(idMatch[2], 10) : undefined) || detectedInst.installmentNumber || 1;
            const total = currentTx.installmentTotal || detectedInst.installmentTotal || (idMatch ? parseInt(idMatch[2], 10) : num);
            const cleanDesc = (detectedInst.cleanDescription || currentTx.description.replace(/\s*\(\d+\/\d+\)$/, '')).toLowerCase().trim();
            const descKey = `${currentTx.accountId}|${cleanDesc}|${total}|${Math.round(currentTx.amount * 100)}`;
            const groupId = currentTx.installmentGroupId || descGroupMap.get(descKey) || (idMatch ? idMatch[1] : `inst-auto-${currentTx.accountId}-${cleanDesc.replace(/[^a-z0-9]/g, '-')}-${total}-${Math.round(currentTx.amount * 100)}`);
            descGroupMap.set(descKey, groupId);

            currentTx = {
              ...currentTx,
              isInstallment: true,
              installmentGroupId: groupId,
              installmentNumber: num,
              installmentTotal: total,
              originalTotalAmount: currentTx.originalTotalAmount || (total && currentTx.amount ? Math.round(currentTx.amount * total * 100) / 100 : undefined),
              isShared: currentTx.isShared || (acc?.isShared ?? false),
            };
            modified = true;
          }

          if (modified) {
            txsModified = true;
            try {
              await db.saveTransaction(currentTx);
            } catch {}
          }
          return currentTx;
        })
      );
      const effectiveTxs = txsModified ? healedTxs : txs;

      // Auto-cura de duplicatas decorrentes do bug de edição de notificação ou re-execução de notificação
      const duplicateIdsToDelete = new Set<string>();
      const notifsList = notifs || [];

      for (let i = 0; i < effectiveTxs.length; i++) {
        const t1 = effectiveTxs[i];
        if (duplicateIdsToDelete.has(t1.id)) continue;

        for (let j = i + 1; j < effectiveTxs.length; j++) {
          const t2 = effectiveTxs[j];
          if (duplicateIdsToDelete.has(t2.id)) continue;

          // Mesma conta, mesmo valor, mesmo tipo 'expense'
          if (t1.accountId !== t2.accountId) continue;
          if (t1.type !== 'expense' || t2.type !== 'expense') continue;
          if (Math.abs(t1.amount - t2.amount) >= 0.01) continue;

          // Mesma data ou menos de 24h de diferença
          const timeDiff = Math.abs(new Date(t1.createdAt || t1.date).getTime() - new Date(t2.createdAt || t2.date).getTime());
          if (timeDiff > 24 * 60 * 60 * 1000) continue;

          // Checa se pertencem à mesma notificação ou se um é lançamento direto e o outro editado
          const sharesRawPayload = Boolean(
            t1.rawNotificationPayload && 
            t2.rawNotificationPayload && 
            t1.rawNotificationPayload === t2.rawNotificationPayload
          );
          
          const t1IsPendingGen = notifsList.some(p => p.generatedTransactionId === t1.id);
          const t2IsPendingGen = notifsList.some(p => p.generatedTransactionId === t2.id);

          const isDirectAndEditedDuplicate = (
            (t1IsPendingGen && (t2.source === 'notification' || Boolean(t2.rawNotificationPayload))) ||
            (t2IsPendingGen && (t1.source === 'notification' || Boolean(t1.rawNotificationPayload))) ||
            sharesRawPayload
          );

          if (isDirectAndEditedDuplicate) {
            let txToDelete = t1;
            let txToKeep = t2;

            if (t1IsPendingGen && !t2IsPendingGen) {
              // t1 era o gerado original, t2 é o criado pela aprovação/edição posterior
              txToDelete = t1;
              txToKeep = t2;
            } else if (t2IsPendingGen && !t1IsPendingGen) {
              txToDelete = t2;
              txToKeep = t1;
            } else {
              // Preserva a transação que tiver updatedAt ou createdAt mais recente (editada)
              const d1 = new Date(t1.updatedAt || t1.createdAt || t1.date).getTime();
              const d2 = new Date(t2.updatedAt || t2.createdAt || t2.date).getTime();
              if (d1 < d2) {
                txToDelete = t1;
                txToKeep = t2;
              } else {
                txToDelete = t2;
                txToKeep = t1;
              }
            }

            duplicateIdsToDelete.add(txToDelete.id);
            try {
              await db.deleteTransaction(txToDelete.id);
              const acc = accs.find(a => a.id === txToDelete.accountId);
              if (acc?.isShared || txToDelete.isShared) {
                broadcastSharedTransaction(txToDelete.accountId, txToDelete, 'delete', partnershipSpace?.code);
              }
            } catch (err) {
              console.warn('Falha ao remover duplicata curada:', err);
            }
            break;
          }
        }
      }

      const deduplicatedTxs = duplicateIdsToDelete.size > 0 
        ? effectiveTxs.filter(t => !duplicateIdsToDelete.has(t.id))
        : effectiveTxs;

      // Autocura e deduplicação inteligente de assinaturas duplicadas
      const { subscriptions: healedSubs, transactions: subsHealedTxs } = await deduplicateSubscriptions(
        subs,
        deduplicatedTxs,
        partnershipSpace?.code
      );

      // Migração suave de acc-carteira legado para Conta Principal
      const currentAccs = [...accs];
      const carteiraIdx = currentAccs.findIndex(a => a.id === 'acc-carteira');
      if (carteiraIdx >= 0) {
        const migrated: Account = {
          ...currentAccs[carteiraIdx],
          id: 'acc-conta-principal',
          name: 'Conta Principal',
          type: 'checking',
          bankId: 'generic',
          icon: 'Landmark',
          color: '#10B981',
        };
        try {
          await db.saveAccount(migrated);
          await db.deleteAccount('acc-carteira');
          currentAccs[carteiraIdx] = migrated;
        } catch (err) {
          console.warn('Falha não crítica ao migrar Carteira:', err);
        }
      }

      // Garantir existência da "Conta Principal" padrão no sistema para receitas e pagamentos
      const hasCheckingOrValidAccount = currentAccs.some(a => a.type !== 'credit_card');
      if (!hasCheckingOrValidAccount) {
        const defaultAccount: Account = {
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
        };
        try {
          await db.saveAccount(defaultAccount);
          currentAccs.unshift(defaultAccount);
        } catch (err) {
          console.warn('Falha não crítica ao auto-cadastrar Conta Principal padrão:', err);
        }
      }

      // Auto-cura: se algum cartão de crédito tiver os 4 dígitos no nome mas não no campo lastDigits
      for (let i = 0; i < currentAccs.length; i++) {
        const acc = currentAccs[i];
        if (acc.type === 'credit_card' && !acc.lastDigits) {
          const match = (acc.name || '').match(/(?:final|••••|\.\.\.\.)\s*(\d{4})/i) || (acc.name || '').match(/\((\d{4})\)/);
          if (match && match[1]) {
            const healedAcc = { ...acc, lastDigits: match[1] };
            currentAccs[i] = healedAcc;
            try {
              await db.saveAccount(healedAcc);
            } catch (err) {
              console.warn('Falha não crítica ao auto-curar lastDigits do cartão:', err);
            }
          }
        }
      }

      // Sincronização inteligente de assinaturas ativas com as faturas e extrato
      const syncedTxs = await syncSubscriptionTransactions(
        healedSubs,
        subsHealedTxs,
        currentAccs
      );

      // Reconciliação e autocura automática para cartões de crédito que possuem transações no mês atual
      const reconciledAccs = currentAccs.map(acc => {
        if (acc.type === 'credit_card') {
          const cardMonthData = calculateInvoiceForMonth(acc.id, syncedTxs, today.getMonth() + 1, today.getFullYear(), healedSubs);
          if (cardMonthData.transactions.length > 0 && acc.balance !== cardMonthData.totalAmount) {
            return {
              ...acc,
              balance: cardMonthData.totalAmount,
              invoiceAmount: cardMonthData.totalAmount,
            };
          }
        }
        return acc;
      });

      // Sanitiza regras de categoria para auto-curar falsos positivos e contaminações legadas
      const sanitizedRules = categorizationEngine.sanitizeUserRules(rules, cats);
      if (JSON.stringify(sanitizedRules) !== JSON.stringify(rules)) {
        for (const r of sanitizedRules) {
          await db.saveCategoryRule(r);
        }
        const currentIds = new Set(sanitizedRules.map(r => r.id));
        for (const oldRule of rules) {
          if (!currentIds.has(oldRule.id)) {
            await db.deleteCategoryRule(oldRule.id);
          }
        }
      }

      setAccounts(reconciledAccs);
      setCategories(cats);
      setTransactions(syncedTxs);
      setBudgets(bdgs);
      setGoals(goalsList);
      setGoalContributions(contribList);
      setPendingNotifications(notifs);
      setSubscriptions(healedSubs);
      setCategoryRules(sanitizedRules);
      setDescriptionRules(descRules || []);

      // Executa detecção local de recorrências sobre as transações existentes
      const suggestions = recurrenceDetector.detectRecurringSubscriptions(syncedTxs, healedSubs, dismissed, cats);
      setSubscriptionSuggestions(suggestions);
    } catch (e) {
      console.error('Erro ao carregar dados do banco:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const processIncomingNotification = useCallback(async (parsed: ParsedBankNotification, pkg = '', bypassDuplicateCheck = false): Promise<PendingNotification | null> => {
    const [cats, rules, accs, existingPending, txs, descRules, allSubs] = await Promise.all([
      db.getCategories(),
      db.getCategoryRules(),
      db.getAccounts(),
      db.getPendingNotifications(),
      db.getTransactions(),
      db.getDescriptionRules(),
      db.getSubscriptions(),
    ]);

    // 0. Identificação Robusta do Banco com prioridade para packageName do Android
    const detectedBank = getBankByPackage(pkg) || getBankById(parsed.bankId);
    const targetBankId = (detectedBank?.id || parsed.bankId || '').toLowerCase();
    const targetBankName = (detectedBank?.name || parsed.bankName || '').toLowerCase();
    const targetBankShort = (detectedBank?.shortName || '').toLowerCase();
    const effectiveBankName = detectedBank?.name || parsed.bankName;

    // 1.1 Resolução Inteligente de Conta / Cartão
    // Prioridade 1: Match exato dos últimos 4 dígitos do cartão (titular ou adicional)
    let matchedByDigits: Account | undefined = undefined;
    if (parsed.cardLastDigits) {
      matchedByDigits = accs.find(a => accountMatchesCardDigits(a, parsed.cardLastDigits));
    }

    // Identificar contas candidatas do banco detectado
    const bankCandidates = accs.filter(a => {
      const aBankId = (a.bankId || '').toLowerCase();
      const aName = a.name.toLowerCase();
      return (targetBankId && targetBankId !== 'generic' && aBankId === targetBankId) ||
             (targetBankName && targetBankName !== 'outro banco' && aName.includes(targetBankName)) ||
             (targetBankShort && aName.includes(targetBankShort)) ||
             (targetBankId && targetBankId !== 'generic' && aName.includes(targetBankId));
    });

    const isBankIdentified = Boolean(targetBankId && targetBankId !== 'generic');
    const bankMatches = Boolean(matchedByDigits || bankCandidates.length > 0);
    const isUnregistered = !bankMatches;

    // Se o usuário optou por apenas bancos cadastrados E for uma notificação de banco não cadastrado:
    if (onlyRegisteredBanks && isUnregistered && (!isBankIdentified || parsed.bankId === 'generic') && !parsed.isFromSms) {
      console.log(`[Sobra] Notificação de banco não cadastrado descartada: ${effectiveBankName}`);
      return null;
    }

    // 1. Descarte de re-post idêntico do sistema operacional ou reprocessamento
    const now = Date.now();
    const rawPayload = `${parsed.rawTitle} - ${parsed.rawText}`;

    // Checa se já existe notificação pendente ou aprovada com mesmo conteúdo recente (< 60s)
    const isPendingDuplicate = !bypassDuplicateCheck && existingPending.some(p => 
      p.rawTitle === parsed.rawTitle && 
      p.rawText === parsed.rawText &&
      (now - new Date(p.detectedAt).getTime()) < 60000
    );
    if (isPendingDuplicate) {
      return null;
    }

    // Checa se já existe transação gravada no banco com o mesmo payload bruto de notificação
    const isTxAlreadyCreated = txs.some(t => 
      t.rawNotificationPayload === rawPayload ||
      (t.source === 'notification' && 
       Math.abs(t.amount - parsed.amount) < 0.01 && 
       (now - new Date(t.createdAt || t.date).getTime()) < 60000)
    );
    if (isTxAlreadyCreated) {
      return null;
    }

    const cleanedMerchant = merchantCleaner.applyRules(parsed.merchant, descRules || []).cleaned || parsed.merchant;
    const suggestedCat = categorizationEngine.suggestCategory(cleanedMerchant, cats, rules);

    const normParsedMerchant = categorizationEngine.normalize(cleanedMerchant || '');
    const notifDate = new Date();
    const notifMonth = notifDate.getUTCMonth() + 1;
    const notifYear = notifDate.getUTCFullYear();

    const isCreditCardPurchase = parsed.type === 'expense' && (parsed.paymentMethod === 'credit' || parsed.isInstallment);

    const creditCandidates = bankCandidates.filter(a => a.type === 'credit_card');

    let suggestedAcc: Account | undefined = undefined;
    let isAmbiguousCard = false;

    if (matchedByDigits) {
      // 1. Certeza pelo cartão correspondente aos 4 dígitos
      suggestedAcc = matchedByDigits;
      isAmbiguousCard = false;
    } else if (isCreditCardPurchase && creditCandidates.length > 1) {
      // 2. Múltiplos cartões do mesmo banco (ex: um pessoal e um conjunto)
      isAmbiguousCard = true;
      // Lança preferencialmente no cartão pessoal (não compartilhado), ou no primeiro cadastrado
      suggestedAcc = creditCandidates.find(a => !a.isShared) || creditCandidates[0];
    } else if (isCreditCardPurchase && creditCandidates.length === 1) {
      // 3. Exatamente 1 cartão de crédito do banco encontrado
      suggestedAcc = creditCandidates[0];
    } else if (bankCandidates.length > 0) {
      // 4. Se não tem cartão de crédito deste banco mas tem conta do banco (ex: débito/Pix)
      if (parsed.type === 'income' || parsed.paymentMethod === 'pix') {
        suggestedAcc = bankCandidates.find(a => a.type === 'checking') || bankCandidates[0];
      } else {
        suggestedAcc = bankCandidates[0];
      }
    } else if (!isBankIdentified) {
      // 5. Fallback SOMENTE se o banco NÃO foi identificado (notificação genérica sem package ou banco conhecido)
      suggestedAcc = accs.find(a => (isCreditCardPurchase && a.type === 'credit_card')) || accs[0];
    } else {
      // 6. O banco FOI identificado (ex: Banco Inter), mas o usuário NÃO possui conta/cartão desse banco cadastrado.
      // NUNCA associar a um cartão de outro banco (ex: Nubank)!
      suggestedAcc = undefined;
    }

    const isTargetAccCreditCard = suggestedAcc && suggestedAcc.type === 'credit_card';

    // Procura se corresponde a uma assinatura ativa cadastrada para o cartão/banco
    const matchingActiveSub = allSubs.find(sub => {
      if (sub.status !== 'active' || sub.type === 'income') return false;
      if (suggestedAcc && sub.accountId && sub.accountId !== suggestedAcc.id) {
        const subAcc = accs.find(a => a.id === sub.accountId);
        if (!subAcc || !suggestedAcc.bankId || subAcc.bankId !== suggestedAcc.bankId) {
          return false;
        }
      }
      const diff = Math.abs(sub.amount - parsed.amount);
      if (diff > 0.10 && (diff / sub.amount) > 0.20 && diff > 15.0) return false;
      const normSubName = categorizationEngine.normalize(sub.name || '');
      return normSubName.length >= 2 && (
        normSubName === normParsedMerchant ||
        normParsedMerchant.includes(normSubName) ||
        normSubName.includes(normParsedMerchant)
      );
    });

    // Procura se já existe transação de assinatura cadastrada nesta fatura/mês
    const matchingSubTx = txs.find(t => {
      if (suggestedAcc && t.accountId !== suggestedAcc.id) return false;
      const diff = Math.abs(t.amount - parsed.amount);
      if (diff > 0.10 && (diff / t.amount) > 0.20 && diff > 15.0) return false;
      const tDate = new Date(t.date);
      if (tDate.getUTCMonth() + 1 !== notifMonth || tDate.getUTCFullYear() !== notifYear) return false;

      if (matchingActiveSub && t.subscriptionId === matchingActiveSub.id) return true;
      if (matchingActiveSub && t.id.startsWith(`tx-sub-${matchingActiveSub.id}-`)) return true;

      if (t.isRecurring || t.subscriptionId || t.id.startsWith('tx-sub-')) {
        const normDesc = categorizationEngine.normalize(t.description || '');
        return normDesc.includes(normParsedMerchant) || normParsedMerchant.includes(normDesc);
      }
      return false;
    });

    // 2. Lançamento Direto na Fatura para Compras no Cartão de Crédito de Banco Cadastrado
    // As compras com cartão de crédito de banco cadastrado são sempre lançadas automaticamente na fatura.
    // A notificação enviada é informativa, permitindo ao usuário conferir ou editar a compra com 1 toque.
    const canAutoAddToInvoice = autoAddCreditToInvoice;

    if (!isUnregistered && canAutoAddToInvoice && isCreditCardPurchase && isTargetAccCreditCard && suggestedAcc) {
      const pendingApproved: PendingNotification = {
        id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        bankPackage: pkg || targetBankId || parsed.bankId,
        bankName: effectiveBankName,
        bankId: targetBankId || parsed.bankId,
        rawTitle: parsed.rawTitle,
        rawText: parsed.rawText,
        parsedAmount: parsed.amount,
        parsedMerchant: cleanedMerchant,
        parsedType: 'expense',
        parsedPaymentMethod: 'credit',
        detectedBalance: parsed.detectedBalance,
        suggestedCategoryId: suggestedCat?.id,
        suggestedAccountId: suggestedAcc.id,
        detectedAt: new Date().toISOString(),
        status: 'approved',
        isInstallment: parsed.isInstallment,
        installmentCount: parsed.installmentCount,
        installmentAmount: parsed.installmentAmount,
        originalTotalAmount: parsed.originalTotalAmount,
        isFromSms: parsed.isFromSms,
      };

      let createdTxId: string | undefined;

      if (parsed.isInstallment && parsed.installmentCount && parsed.installmentCount > 1) {
        // Compra parcelada lançada diretamente em todas as faturas futuras
        const generated = generateInstallmentTransactions({
          accountId: suggestedAcc.id,
          categoryId: suggestedCat?.id || cats[0]?.id,
          description: cleanedMerchant,
          totalAmount: parsed.originalTotalAmount || parsed.amount,
          installmentCount: parsed.installmentCount,
          startDate: new Date().toISOString(),
          card: suggestedAcc,
          cardLastDigits: parsed.cardLastDigits,
          notes: `Lançado diretamente na fatura (${parsed.installmentCount}x)`,
          source: 'notification',
        });
        createdTxId = generated[0]?.id;
        await db.saveInstallmentTransactions(generated);
        if (suggestedAcc.isShared) {
          syncAccountTransactionsToCloud(suggestedAcc.id, generated);
          generated.forEach(t => broadcastSharedTransaction(suggestedAcc.id, t, 'insert', partnershipSpace?.code));
        }
      } else if (matchingSubTx) {
        // A assinatura já foi lançada na fatura. A notificação apenas confirma e reconcilia a cobrança sem duplicar!
        createdTxId = matchingSubTx.id;
        const updatedSubTx: Transaction = {
          ...matchingSubTx,
          cardLastDigits: parsed.cardLastDigits || matchingSubTx.cardLastDigits,
          rawNotificationPayload: `${parsed.rawTitle} - ${parsed.rawText}`,
          notes: matchingSubTx.notes ? `${matchingSubTx.notes} (Confirmado via notificação)` : 'Cobrança de assinatura confirmada via notificação',
          status: 'confirmed',
          date: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await db.saveTransaction(updatedSubTx);
        if (matchingActiveSub) {
          await db.saveSubscription({
            ...matchingActiveSub,
            lastChargeDate: new Date().toISOString(),
          });
        }
      } else if (matchingActiveSub) {
        // A assinatura está cadastrada mas a transação do mês ainda não havia sido gerada
        const daysInMonth = new Date(notifYear, notifMonth, 0).getDate();
        const safeDay = Math.min(Math.max(1, matchingActiveSub.dayOfMonth || notifDate.getUTCDate()), daysInMonth);
        const subTxId = `tx-sub-${matchingActiveSub.id}-${notifYear}-${String(notifMonth).padStart(2, '0')}`;
        const newSubTx: Transaction = {
          id: subTxId,
          accountId: suggestedAcc.id,
          categoryId: matchingActiveSub.categoryId || suggestedCat?.id || cats[0]?.id,
          amount: parsed.amount,
          type: 'expense',
          description: matchingActiveSub.name || cleanedMerchant,
          date: new Date().toISOString(),
          status: 'confirmed',
          paymentMethod: 'credit',
          source: 'notification',
          cardLastDigits: parsed.cardLastDigits,
          rawNotificationPayload: `${parsed.rawTitle} - ${parsed.rawText}`,
          notes: 'Cobrança de assinatura confirmada via notificação',
          isRecurring: true,
          recurringCadence: matchingActiveSub.cadence,
          recurringDayOfMonth: safeDay,
          subscriptionId: matchingActiveSub.id,
          isShared: !!suggestedAcc.isShared,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        createdTxId = newSubTx.id;
        await db.saveTransaction(newSubTx);
        await db.saveSubscription({
          ...matchingActiveSub,
          lastChargeDate: new Date().toISOString(),
        });
        if (suggestedAcc.isShared) {
          broadcastSharedTransaction(suggestedAcc.id, newSubTx, 'insert', partnershipSpace?.code);
        }
      } else {
        // Compra à vista lançada diretamente na fatura do mês
        const newDirectTx: Transaction = {
          id: crypto.randomUUID(),
          accountId: suggestedAcc.id,
          categoryId: suggestedCat?.id || cats[0]?.id,
          amount: parsed.amount,
          type: 'expense',
          description: cleanedMerchant,
          date: new Date().toISOString(),
          status: 'confirmed',
          paymentMethod: 'credit',
          source: 'notification',
          cardLastDigits: parsed.cardLastDigits,
          rawNotificationPayload: `${parsed.rawTitle} - ${parsed.rawText}`,
          notes: `Lançado diretamente na fatura do ${suggestedAcc.name}`,
          isShared: !!suggestedAcc.isShared,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        createdTxId = newDirectTx.id;
        await db.saveTransaction(newDirectTx);
        if (suggestedAcc.isShared) {
          broadcastSharedTransaction(suggestedAcc.id, newDirectTx, 'insert', partnershipSpace?.code);
        }
      }

      pendingApproved.generatedTransactionId = createdTxId;
      await db.savePendingNotification(pendingApproved);
      await refreshData();

      // Dispara notificação local no Android confirmando inserção na fatura e permitindo edição com um toque
      const formattedVal = parsed.amount.toFixed(2).replace('.', ',');
      const cardName = suggestedAcc?.name || parsed.bankName;
      const isSubConfirmed = Boolean(matchingSubTx || matchingActiveSub);
      const subTitle = matchingActiveSub?.name || cleanedMerchant;

      await notificationListenerBridge.sendLocalNotification({
        title: isSubConfirmed ? `💳 Assinatura no ${cardName}: R$ ${formattedVal}` : `💳 Compra no ${cardName}: R$ ${formattedVal}`,
        text: isSubConfirmed
          ? `Cobrança de ${subTitle} confirmada na fatura sem duplicar.`
          : `${cleanedMerchant} lançada na fatura. Toque para editar ou conferir.`,
        transactionId: createdTxId,
        notificationId: pendingApproved.id,
        amount: parsed.amount,
        merchant: cleanedMerchant,
        bankName: cardName,
        rawText: parsed.rawText,
        rawTitle: parsed.rawTitle,
        packageName: pkg,
      });

      return pendingApproved;
    }

    // 4. Detecção Inteligente de Cobrança Duplicada
    const todayStr = new Date().toISOString().slice(0, 10);
    const normalizedMerchant = cleanedMerchant.toLowerCase().trim();

    // Checa transações confirmadas nas últimas 24h
    const matchingTx = txs.find(t => {
      const isSameAmount = Math.abs(t.amount - parsed.amount) < 0.01;
      const isRecent = t.date === todayStr || (now - new Date(t.date).getTime()) < 24 * 60 * 60 * 1000;
      const tDesc = (t.description || '').toLowerCase();
      const isSimilarMerchant = tDesc.includes(normalizedMerchant) || normalizedMerchant.includes(tDesc);
      return isSameAmount && isRecent && isSimilarMerchant;
    });

    // Checa outras pendências ativas
    const matchingPending = existingPending.find(p => {
      const isSameAmount = Math.abs(p.parsedAmount - parsed.amount) < 0.01;
      const pDesc = (p.parsedMerchant || '').toLowerCase();
      const isSimilarMerchant = pDesc.includes(normalizedMerchant) || normalizedMerchant.includes(pDesc);
      return isSameAmount && isSimilarMerchant;
    });

    let isSuspectedDuplicate = false;
    let duplicateReason: string | undefined = undefined;

    if (matchingSubTx) {
      isSuspectedDuplicate = false;
      duplicateReason = `Assinatura "${matchingSubTx.description}" reconhecida. Ao confirmar, o lançamento existente na fatura será conciliado sem duplicar.`;
    } else if (matchingTx) {
      isSuspectedDuplicate = true;
      const isIncome = parsed.type === 'income' || parsed.paymentMethod === 'pix';
      duplicateReason = isIncome
        ? `Uma entrada de R$ ${parsed.amount.toFixed(2).replace('.', ',')} de "${matchingTx.description}" já foi registrada no extrato hoje.`
        : `Cobrança de R$ ${parsed.amount.toFixed(2).replace('.', ',')} em "${matchingTx.description}" já foi registrada no extrato hoje.`;
    } else if (matchingPending) {
      isSuspectedDuplicate = true;
      const isIncome = parsed.type === 'income' || parsed.paymentMethod === 'pix';
      duplicateReason = isIncome
        ? `Já identificamos outra transferência de R$ ${parsed.amount.toFixed(2).replace('.', ',')} de "${matchingPending.parsedMerchant}" agora há pouco.`
        : `Já identificamos outra compra de R$ ${parsed.amount.toFixed(2).replace('.', ',')} em "${matchingPending.parsedMerchant}" agora há pouco.`;
    } else if (isAmbiguousCard) {
      duplicateReason = `Detectamos mais de um cartão ${effectiveBankName || 'deste banco'} cadastrado. Confirme em qual cartão a compra foi feita.`;
    }

    const pending: PendingNotification = {
      id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      bankPackage: pkg || targetBankId || parsed.bankId,
      bankName: effectiveBankName,
      bankId: targetBankId || parsed.bankId,
      rawTitle: parsed.rawTitle,
      rawText: parsed.rawText,
      parsedAmount: parsed.amount,
      parsedMerchant: cleanedMerchant,
      parsedType: parsed.type,
      notificationKind: parsed.notificationKind,
      parsedPaymentMethod: parsed.paymentMethod,
      detectedBalance: parsed.detectedBalance,
      suggestedCategoryId: suggestedCat?.id,
      suggestedAccountId: isUnregistered ? undefined : suggestedAcc?.id,
      detectedAt: new Date().toISOString(),
      status: 'pending',
      isSuspectedDuplicate,
      duplicateReason,
      isInstallment: parsed.isInstallment,
      installmentCount: parsed.installmentCount,
      installmentAmount: parsed.installmentAmount,
      originalTotalAmount: parsed.originalTotalAmount,
      isFromSms: parsed.isFromSms,
      cardLastDigits: parsed.cardLastDigits,
      requiresAccountRegistration: isUnregistered,
      isUnregisteredBank: isUnregistered,
      generatedTransactionId: matchingSubTx?.id,
    };

    await db.savePendingNotification(pending);
    await refreshData();

    const formattedVal = parsed.amount.toFixed(2).replace('.', ',');

    if (isUnregistered) {
      // 1. Compra de banco ou cartão ainda não cadastrado no app
      await notificationListenerBridge.sendLocalNotification({
        title: `💳 Novo cartão detectado: ${effectiveBankName}`,
        text: `Compra de R$ ${formattedVal} em ${cleanedMerchant}. Toque para cadastrar o cartão e incluir o gasto.`,
        notificationId: pending.id,
        amount: parsed.amount,
        merchant: cleanedMerchant,
        bankName: parsed.bankName,
        rawText: parsed.rawText,
        rawTitle: parsed.rawTitle,
        packageName: pkg,
        requiresAccountRegistration: true,
        type: 'expense',
      });
    } else if (matchingSubTx) {
      // 2. Notificação de assinatura já prevista na fatura
      await notificationListenerBridge.sendLocalNotification({
        title: `✨ Assinatura: R$ ${formattedVal}`,
        text: `Cobrança de ${matchingSubTx.description} identificada na fatura. Toque para conferir.`,
        notificationId: pending.id,
        amount: parsed.amount,
        merchant: cleanedMerchant,
        bankName: parsed.bankName,
        rawText: parsed.rawText,
        rawTitle: parsed.rawTitle,
        packageName: pkg,
        type: 'expense',
      });
    } else if (isSuspectedDuplicate) {
      // 2. Suspeita de cobrança duplicada
      await notificationListenerBridge.sendLocalNotification({
        title: `⚠️ Cobrança duplicada suspeita: R$ ${formattedVal}`,
        text: `${cleanedMerchant} já foi cobrado hoje. Toque para revisar se deseja manter ou descartar.`,
        notificationId: pending.id,
        amount: parsed.amount,
        merchant: cleanedMerchant,
        bankName: parsed.bankName,
        rawText: parsed.rawText,
        rawTitle: parsed.rawTitle,
        packageName: pkg,
        type: 'expense',
      });
    } else if (parsed.notificationKind === 'cashback') {
      // 5. Cashback: receita especial que aguarda confirmação específica
      await notificationListenerBridge.sendLocalNotification({
        title: `🎁 Cashback ${parsed.bankName}: R$ ${formattedVal}`,
        text: `${cleanedMerchant} (${parsed.bankName}). Toque para confirmar o lançamento como receita.`,
        notificationId: pending.id,
        amount: parsed.amount,
        merchant: cleanedMerchant,
        bankName: parsed.bankName,
        rawText: parsed.rawText,
        rawTitle: parsed.rawTitle,
        packageName: pkg,
        type: 'cashback' as any,
      });
    } else if (parsed.notificationKind === 'refund') {
      // 6. Reembolso/Estorno: pergunta se quer inserir como crédito na fatura
      await notificationListenerBridge.sendLocalNotification({
        title: `↩️ Reembolso ${parsed.bankName}: R$ ${formattedVal}`,
        text: `${cleanedMerchant} (${parsed.bankName}). Toque para inserir como crédito na fatura.`,
        notificationId: pending.id,
        amount: parsed.amount,
        merchant: cleanedMerchant,
        bankName: parsed.bankName,
        rawText: parsed.rawText,
        rawTitle: parsed.rawTitle,
        packageName: pkg,
        type: 'refund' as any,
      });
    } else if (parsed.type === 'income') {
      // 7. Receita / Pix / Transferência / Salário recebido aguardando confirmação
      const isPix = parsed.paymentMethod === 'pix' || parsed.rawTitle.toLowerCase().includes('pix') || parsed.rawText.toLowerCase().includes('pix');
      const titlePrefix = isPix ? '💰 Pix Recebido' : '💰 Entrada Detectada';
      await notificationListenerBridge.sendLocalNotification({
        title: `${titlePrefix}: R$ ${formattedVal}`,
        text: `${cleanedMerchant} (${effectiveBankName}). Toque para confirmar o lançamento como receita.`,
        notificationId: pending.id,
        amount: parsed.amount,
        merchant: cleanedMerchant,
        bankName: effectiveBankName,
        rawText: parsed.rawText,
        rawTitle: parsed.rawTitle,
        packageName: pkg,
        type: 'income',
      });
    } else if (parsed.type === 'expense') {
      // 8. Despesa/compra que aguarda aprovação manual
      const notifTitle = isAmbiguousCard 
        ? `💳 Confirmar Cartão (${effectiveBankName}): R$ ${formattedVal}` 
        : `💳 Compra detectada: R$ ${formattedVal}`;
      const notifText = isAmbiguousCard
        ? `Mais de um cartão ${effectiveBankName} detectado. Toque para confirmar o correto.`
        : `${cleanedMerchant} (${effectiveBankName}). Toque para revisar e lançar no cartão.`;

      await notificationListenerBridge.sendLocalNotification({
        title: notifTitle,
        text: notifText,
        notificationId: pending.id,
        amount: parsed.amount,
        merchant: cleanedMerchant,
        bankName: effectiveBankName,
        rawText: parsed.rawText,
        rawTitle: parsed.rawTitle,
        packageName: pkg,
        type: 'expense',
      });
    }

    return pending;
  }, [refreshData, onlyRegisteredBanks, autoAddCreditToInvoice]);

  useEffect(() => {
    refreshData();

    // Inscrição para eventos de notificação recebidos (nativos ou simulados)
    const unsubscribe = notificationListenerBridge.subscribe(async (parsed: ParsedBankNotification, packageName?: string) => {
      await processIncomingNotification(parsed, packageName);
    });

    return () => unsubscribe();
  }, [refreshData, processIncomingNotification]);

  // Limpeza de notificações residuais do teste de Pix recém-concluído
  useEffect(() => {
    const cleanupTestPix = async () => {
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sobra_pix_test_seeded_v2');
          localStorage.removeItem('sobra_pix_test_seeded');
          const existing = await db.getPendingNotifications();
          const testPixs = existing.filter(p => p.rawText?.includes('Jéssica Furtado Alves'));
          for (const item of testPixs) {
            await db.updatePendingNotificationStatus(item.id, 'discarded');
          }
          if (testPixs.length > 0) {
            setPendingNotifications(prev => prev.filter(p => !p.rawText?.includes('Jéssica Furtado Alves')));
          }
        }
      } catch (err) {
        console.warn('[FinanceContext] Erro ao limpar Pix de teste:', err);
      }
    };
    cleanupTestPix();
  }, []);

  // Sincronização em tempo real para contas e cartões compartilhados (Supabase Realtime)
  // Utiliza chave estável de IDs para evitar loops infinitos e desmontagens desnecessárias do canal
  const sharedAccountIdsKey = useMemo(() => {
    return accounts
      .filter(a => a.isShared)
      .map(a => a.id)
      .sort()
      .join(',');
  }, [accounts]);

  useEffect(() => {
    if (!sharedAccountIdsKey) return;
    const sharedAccountIds = sharedAccountIdsKey.split(',').filter(Boolean);
    if (sharedAccountIds.length === 0) return;

    // Sincronização segura de dados de membros e transações sem depender de closures obsoletas
    const syncSharedData = async () => {
      if (isSharedSyncingRef.current) return;
      isSharedSyncingRef.current = true;

      try {
        let hasChanges = false;
        const [currentDbAccounts, currentDbTxs] = await Promise.all([
          db.getAccounts(),
          db.getTransactions(),
        ]);
        const currentSharedAccounts = currentDbAccounts.filter(a => a.isShared && sharedAccountIds.includes(a.id));

        for (const acc of currentSharedAccounts) {
          // 1. Sincroniza lista oficial de membros
          try {
            const remoteMembers = await fetchSharedAccountMembers(acc.id);
            if (remoteMembers && remoteMembers.length > 0) {
              const currentMembers = acc.sharedMembers || [];
              const normalized = normalizeSharedMembers(
                remoteMembers,
                acc.ownerId || partnershipSpace?.ownerId,
                acc.ownerName || partnershipSpace?.ownerName,
                partnershipSpace?.partnerId,
                partnershipSpace?.partnerName
              );
              const isDifferent =
                normalized.length !== currentMembers.length ||
                normalized.some(rm => !currentMembers.some(cm => cm.userId === rm.userId && cm.role === rm.role));
              if (isDifferent) {
                const updatedAcc: Account = { ...acc, sharedMembers: normalized };
                await db.saveAccount(updatedAcc);
                hasChanges = true;
              }

              // Se o espaço ativo não tem parceiro registrado, mas a conta compartilhada tem, sincroniza!
              if (partnershipSpace && (!partnershipSpace.partnerId || !partnershipSpace.partnerName)) {
                const partnerMember = remoteMembers.find(m => m.userId !== partnershipSpace.ownerId);
                if (partnerMember) {
                  const updatedSpace: PartnershipSpace = {
                    ...partnershipSpace,
                    partnerId: partnerMember.userId,
                    partnerName: partnerMember.displayName,
                    partnerEmail: partnerMember.email,
                    partnerAvatarUrl: partnerMember.avatarUrl || partnershipSpace.partnerAvatarUrl,
                    joinedAt: partnerMember.joinedAt,
                  };
                  saveLocalPartnershipSpace(updatedSpace);
                  setPartnershipSpace(updatedSpace);
                }
              }
            }
          } catch {}

          // 2. Sincroniza transações da nuvem para o banco local
          try {
            const remoteTxs = await fetchSharedTransactions(acc.id);
            if (remoteTxs && remoteTxs.length > 0) {
              const remoteMap = new Set(remoteTxs.map(t => t.id));

              // 2.1 Adiciona transações remotas que faltam ou atualiza lançamentos editados pelo parceiro
              for (const rtx of remoteTxs) {
                const localTx = currentDbTxs.find(t => t.id === rtx.id);
                if (!localTx) {
                  await db.saveTransaction({ ...rtx, isShared: true });
                  hasChanges = true;
                } else {
                  const isTxDiff =
                    localTx.description !== rtx.description ||
                    localTx.amount !== rtx.amount ||
                    localTx.type !== rtx.type ||
                    localTx.categoryId !== rtx.categoryId ||
                    localTx.date !== rtx.date ||
                    localTx.status !== rtx.status ||
                    localTx.paymentMethod !== rtx.paymentMethod ||
                    (rtx.updatedAt && localTx.updatedAt !== rtx.updatedAt);
                  if (isTxDiff) {
                    const localTime = localTx.updatedAt ? new Date(localTx.updatedAt).getTime() : 0;
                    const remoteTime = rtx.updatedAt ? new Date(rtx.updatedAt).getTime() : 0;

                    if (localTime > remoteTime) {
                      // Versão local do usuário é mais recente: garante que a nuvem receba a edição
                      await broadcastSharedTransaction(acc.id, localTx, 'update', partnershipSpace?.code);
                    } else {
                      // Versão da nuvem é mais recente ou igual: atualiza o banco local
                      await db.saveTransaction({
                        ...localTx,
                        ...rtx,
                        isInstallment: localTx.isInstallment ?? rtx.isInstallment,
                        installmentGroupId: localTx.installmentGroupId || rtx.installmentGroupId,
                        installmentNumber: localTx.installmentNumber || rtx.installmentNumber,
                        installmentTotal: localTx.installmentTotal || rtx.installmentTotal,
                        originalTotalAmount: localTx.originalTotalAmount || rtx.originalTotalAmount,
                        isShared: true,
                      });
                      hasChanges = true;
                    }
                  }
                }
              }

              // 2.2 Reconciliação apenas para transações compartilhadas locais se a nuvem tiver itens
              const localCardTxs = currentDbTxs.filter(t => t.accountId === acc.id && t.isShared);
              for (const localTx of localCardTxs) {
                if (!remoteMap.has(localTx.id)) {
                  await db.deleteTransaction(localTx.id);
                  hasChanges = true;
                }
              }

              // 2.3 Se houve alterações nas transações do cartão de crédito, recalcula fatura e saldo
              if (hasChanges && acc.type === 'credit_card') {
                const freshTxs = await db.getTransactions();
                const now = new Date();
                const invoiceData = calculateInvoiceForMonth(acc.id, freshTxs, now.getUTCMonth() + 1, now.getUTCFullYear());
                await db.saveAccount({
                  ...acc,
                  balance: invoiceData.totalAmount,
                  invoiceAmount: invoiceData.totalAmount,
                  updatedAt: new Date().toISOString(),
                });
              }
            }
          } catch (syncErr) {
            console.warn('Erro ao sincronizar transações da conta compartilhada:', syncErr);
          }
        }

        // 3. Sincroniza informações de parceiro do espaço no Supabase se ainda não tivermos parceiro
        if (partnershipSpace && (!partnershipSpace.partnerId || !partnershipSpace.partnerName)) {
          try {
            const spaceMembers = await fetchSharedAccountMembers(`space-${partnershipSpace.code}`);
            const partnerCandidate = spaceMembers.find(m => m.userId !== partnershipSpace.ownerId);
            if (partnerCandidate) {
              const updatedSpace: PartnershipSpace = {
                ...partnershipSpace,
                partnerId: partnerCandidate.userId,
                partnerName: partnerCandidate.displayName,
                partnerEmail: partnerCandidate.email,
                partnerAvatarUrl: partnerCandidate.avatarUrl || partnershipSpace.partnerAvatarUrl,
                joinedAt: partnerCandidate.joinedAt,
              };
              saveLocalPartnershipSpace(updatedSpace);
              setPartnershipSpace(updatedSpace);
            }
          } catch {}
        }

        // 4. Sincroniza cartões compartilhados na nuvem e limpa cartões órfãos excluídos
        if (user?.id) {
          try {
            const userSharedAccs = await fetchUserSharedAccounts(user.id);

            // Filtra contas válidas: se o usuário está em um espaço Finanças a Dois ativo,
            // apenas os cartões deste espaço ou cartões com convites válidos ativos na nuvem são considerados
            const validSharedAccs = userSharedAccs.filter(rInv => {
              if (partnershipSpace?.code) {
                // Se pertence ao código do espaço do casal ativo
                if (rInv.code === partnershipSpace.code) return true;
              }
              // Se o usuário é o titular e não tem mais localmente, não ressuscita
              if (rInv.ownerId === user.id && !currentDbAccounts.some(a => a.id === rInv.accountId)) {
                return false;
              }
              return true;
            });

            const validCloudAccountIds = new Set(validSharedAccs.map(a => a.accountId));

            // Importa ou atualiza cartões compartilhados válidos da nuvem
            for (const rInv of validSharedAccs) {
              const localAcc = currentDbAccounts.find(a => a.id === rInv.accountId);
              if (!localAcc) {
                const newAcc: Account = {
                  id: rInv.accountId,
                  name: rInv.accountName,
                  type: rInv.type || 'credit_card',
                  balance: 0,
                  creditLimit: rInv.creditLimit,
                  color: rInv.color || '#820AD1',
                  icon: 'CreditCard',
                  currency: 'BRL',
                  bankId: rInv.bankId || 'nubank',
                  syncStatus: 'synced',
                  isShared: true,
                  ownerId: rInv.ownerId,
                  ownerName: rInv.ownerName,
                  inviteCode: rInv.code,
                  createdAt: rInv.createdAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                await db.saveAccount(newAcc);
                const rTxs = await fetchSharedTransactions(rInv.accountId);
                for (const rtx of rTxs) {
                  await db.saveTransaction({ ...rtx, isShared: true });
                }
                hasChanges = true;
              } else {
                // Se já existe localmente, atualiza caso haja divergência nos dados (edições feitas pelo parceiro)
                const isDiff = localAcc.name !== rInv.accountName ||
                               localAcc.creditLimit !== rInv.creditLimit ||
                               localAcc.color !== rInv.color ||
                               localAcc.bankId !== rInv.bankId;
                if (isDiff) {
                  await db.saveAccount({
                    ...localAcc,
                    name: rInv.accountName,
                    creditLimit: rInv.creditLimit,
                    color: rInv.color || localAcc.color,
                    bankId: rInv.bankId || localAcc.bankId,
                    updatedAt: new Date().toISOString(),
                  });
                  hasChanges = true;
                }
              }
            }

            // Limpa do banco local cartões compartilhados que já foram excluídos na nuvem
            // (evita que cartões antigos de testes fiquem presos ou duplicados localmente)
            const sharedLocalAccounts = currentDbAccounts.filter(a => a.isShared);
            for (const localAcc of sharedLocalAccounts) {
              if (!validCloudAccountIds.has(localAcc.id)) {
                console.log('[FinanceContext] Removendo cartão compartilhado órfão antigo do banco local:', localAcc.id, localAcc.name);
                await db.deleteAccount(localAcc.id);
                hasChanges = true;
              }
            }
          } catch (e) {
            console.warn('[FinanceContext] Erro ao sincronizar cartões compartilhados:', e);
          }
        }

        // 5. Sincroniza Metas, Orçamentos, Assinaturas, Aportes e Cartões Compartilhados do Espaço Finanças a Dois
        if (partnershipSpace?.code && partnershipSpace.isActive) {
          try {
            const [currentGoals, currentBudgets, currentSubs, currentContribs, currentAccs] = await Promise.all([
              db.getGoals(),
              db.getBudgets(),
              db.getSubscriptions(),
              db.getGoalContributions(),
              db.getAccounts(),
            ]);
            const itemsRes = await syncAllLocalSharedItemsWithCloud(partnershipSpace.code, {
              goals: currentGoals,
              budgets: currentBudgets,
              subscriptions: currentSubs,
              contributions: currentContribs,
              sharedAccountIds: sharedAccountIds,
              accounts: currentAccs,
            });
            if (itemsRes.hasChanges) {
              hasChanges = true;
            }
          } catch (itemsErr) {
            console.warn('[FinanceContext] Erro ao sincronizar itens compartilhados da parceria:', itemsErr);
          }
        }

        if (hasChanges) {
          await refreshData();
        }
      } finally {
        isSharedSyncingRef.current = false;
      }
    };

    syncSharedData();

    const unsubscribe = subscribeToSharedCards(
      sharedAccountIds,
      async (event) => {
        try {
          if (event.action === 'delete') {
            const targetId = event.transaction?.id;
            if (targetId) {
              const existing = await db.getTransaction(targetId);
              await db.deleteTransaction(targetId);
              const accs = await db.getAccounts();
              const targetAccId = event.accountId || existing?.accountId || event.transaction?.accountId;
              const targetCard = accs.find(a => a.id === targetAccId);
              if (targetCard && targetCard.type === 'credit_card') {
                const freshTxs = await db.getTransactions();
                const now = new Date();
                const invoiceData = calculateInvoiceForMonth(targetCard.id, freshTxs, now.getUTCMonth() + 1, now.getUTCFullYear());
                await db.saveAccount({
                  ...targetCard,
                  balance: invoiceData.totalAmount,
                  invoiceAmount: invoiceData.totalAmount,
                  updatedAt: new Date().toISOString(),
                });
              }
              await refreshData();
            }
          } else if (event.action === 'batch_refresh') {
            await syncSharedData();
          } else if (event.transaction) {
            const remoteTx = event.transaction;
            const existing = await db.getTransaction(remoteTx.id);
            const isDiff = !existing ||
              existing.description !== remoteTx.description ||
              existing.amount !== remoteTx.amount ||
              existing.type !== remoteTx.type ||
              existing.categoryId !== remoteTx.categoryId ||
              existing.date !== remoteTx.date ||
              existing.status !== remoteTx.status ||
              existing.paymentMethod !== remoteTx.paymentMethod ||
              (remoteTx.updatedAt && existing.updatedAt !== remoteTx.updatedAt);

            if (isDiff) {
              const detected = extractInstallmentFromDescription(remoteTx.description);
              const idMatch = remoteTx.id?.match(/^tx-inst-(.+)-(\d+)$/);
              const isInst = (existing?.isInstallment ?? remoteTx.isInstallment) || detected.isInstallment || !!idMatch;
              const num = existing?.installmentNumber || remoteTx.installmentNumber || (idMatch ? parseInt(idMatch[2], 10) : undefined) || detected.installmentNumber;
              const total = existing?.installmentTotal || remoteTx.installmentTotal || (idMatch ? parseInt(idMatch[2], 10) : undefined) || detected.installmentTotal;
              const groupId = existing?.installmentGroupId || remoteTx.installmentGroupId || (idMatch ? idMatch[1] : undefined);

              await db.saveTransaction({
                ...(existing || {}),
                ...remoteTx,
                isInstallment: isInst || undefined,
                installmentGroupId: groupId,
                installmentNumber: num,
                installmentTotal: total,
                originalTotalAmount: existing?.originalTotalAmount || remoteTx.originalTotalAmount || (total && remoteTx.amount ? Math.round(remoteTx.amount * total * 100) / 100 : undefined),
                isShared: true,
              });
              const accs = await db.getAccounts();
              const targetCard = accs.find(a => a.id === (remoteTx.accountId || event.accountId));
              if (targetCard && targetCard.type === 'credit_card') {
                const freshTxs = await db.getTransactions();
                const now = new Date();
                const invoiceData = calculateInvoiceForMonth(targetCard.id, freshTxs, now.getUTCMonth() + 1, now.getUTCFullYear());
                await db.saveAccount({
                  ...targetCard,
                  balance: invoiceData.totalAmount,
                  invoiceAmount: invoiceData.totalAmount,
                  updatedAt: new Date().toISOString(),
                });
              }
              await refreshData();
            }
          }
        } catch (e) {
          console.warn('Erro ao processar transação compartilhada recebida:', e);
        }
      },
      async (memberEvent) => {
        try {
          const currentAccs = await db.getAccounts();
          const acc = currentAccs.find(a => a.id === memberEvent.accountId);
          if (acc) {
            const currentMembers = acc.sharedMembers || [];
            const merged = normalizeSharedMembers(
              [...currentMembers, memberEvent.member],
              acc.ownerId || partnershipSpace?.ownerId,
              acc.ownerName || partnershipSpace?.ownerName,
              partnershipSpace?.partnerId,
              partnershipSpace?.partnerName
            );
            const updated = {
              ...acc,
              sharedMembers: merged,
            };
            await db.saveAccount(updated);

              // Atualiza o espaço Finanças a Dois se ainda não tiver parceiro registrado
              if (partnershipSpace && (!partnershipSpace.partnerId || !partnershipSpace.partnerName)) {
                if (memberEvent.member.userId !== partnershipSpace.ownerId) {
                  const updatedSpace: PartnershipSpace = {
                    ...partnershipSpace,
                    partnerId: memberEvent.member.userId,
                    partnerName: memberEvent.member.displayName,
                    partnerEmail: memberEvent.member.email,
                    partnerAvatarUrl: memberEvent.member.avatarUrl || partnershipSpace.partnerAvatarUrl,
                    joinedAt: memberEvent.member.joinedAt,
                  };
                  saveLocalPartnershipSpace(updatedSpace);
                  setPartnershipSpace(updatedSpace);
                }
              }

              await refreshData();
            }
        } catch (e) {
          console.warn('Erro ao processar membro compartilhado recebido:', e);
        }
      },
      async (deletedAccId) => {
        try {
          const accs = await db.getAccounts();
          const acc = accs.find(a => a.id === deletedAccId);
          if (acc) {
            await db.deleteAccount(deletedAccId);
            await refreshData();
          }
        } catch {}
      },
      async (leftEvent) => {
        try {
          const accs = await db.getAccounts();
          const acc = accs.find(a => a.id === leftEvent.accountId);
          if (acc) {
            const currentMembers = acc.sharedMembers || [];
            const filtered = currentMembers.filter((m: any) => m.userId !== leftEvent.userId);
            await db.saveAccount({ ...acc, sharedMembers: filtered });
            if (partnershipSpace?.partnerId === leftEvent.userId) {
              const updatedSpace: PartnershipSpace = {
                ...partnershipSpace,
                partnerId: undefined,
                partnerName: undefined,
                partnerEmail: undefined,
                partnerAvatarUrl: undefined,
                joinedAt: undefined,
              };
              saveLocalPartnershipSpace(updatedSpace);
              setPartnershipSpace(updatedSpace);
            }
            await refreshData();
          }
        } catch {}
      },
      async (updatedCard) => {
        try {
          const accs = await db.getAccounts();
          const localAcc = accs.find(a => a.id === updatedCard.id);
          if (localAcc) {
            await db.saveAccount({
              ...localAcc,
              ...updatedCard,
              balance: (updatedCard.balance !== undefined && updatedCard.balance !== 0) ? updatedCard.balance : localAcc.balance,
              invoiceAmount: localAcc.invoiceAmount,
              isShared: true,
              updatedAt: new Date().toISOString(),
            });
            await refreshData();
          }
        } catch (e) {
          console.warn('[FinanceContext] Erro ao processar atualização de cartão recebida:', e);
        }
      }
    );

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncSharedData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [sharedAccountIdsKey, refreshData, partnershipSpace, user?.id]);

  // Inscrição dedicada ao canal do Espaço Finanças a Dois (Broadcasting de Pareamento, Cartões, Metas, Orçamentos e Assinaturas)
  useEffect(() => {
    if (!partnershipSpace?.code || !partnershipSpace.isActive) return;

    // Sincronização inicial de Metas, Orçamentos, Assinaturas, Aportes e Cartões do Espaço
    const initialSyncSpace = async () => {
      try {
        const [gls, bdgs, subs, contribs, accs] = await Promise.all([
          db.getGoals(),
          db.getBudgets(),
          db.getSubscriptions(),
          db.getGoalContributions(),
          db.getAccounts(),
        ]);
        const sharedAccIds = accs.filter(a => a.isShared).map(a => a.id);
        const res = await syncAllLocalSharedItemsWithCloud(partnershipSpace.code, {
          goals: gls,
          budgets: bdgs,
          subscriptions: subs,
          contributions: contribs,
          sharedAccountIds: sharedAccIds,
          accounts: accs,
        });
        if (res.hasChanges) {
          await refreshData();
        }
      } catch (err) {
        console.warn('[FinanceContext] Erro na sincronização inicial do espaço:', err);
      }
    };
    initialSyncSpace();

    const unsubscribe = subscribeToPartnershipSpace(partnershipSpace.code, async (eventPayload) => {
      try {
        const { event } = eventPayload;

        if (event === 'partner_joined' && eventPayload.partner) {
          const p = eventPayload.partner;
          if (p.userId !== user?.id) {
            setPartnershipSpace(prev => {
              if (!prev) return null;
              const updated: PartnershipSpace = {
                ...prev,
                partnerId: p.userId,
                partnerName: p.displayName,
                partnerEmail: p.email,
                partnerAvatarUrl: p.avatarUrl || prev.partnerAvatarUrl,
                joinedAt: p.joinedAt || new Date().toISOString(),
              };
              saveLocalPartnershipSpace(updated);
              return updated;
            });
            await refreshData();
          }
        } else if (event === 'partner_left') {
          if (eventPayload.userId !== user?.id) {
            if (partnershipSpace.ownerId === user?.id) {
              setPartnershipSpace(prev => {
                if (!prev) return null;
                const updated: PartnershipSpace = {
                  ...prev,
                  partnerId: undefined,
                  partnerName: undefined,
                  partnerEmail: undefined,
                  partnerAvatarUrl: undefined,
                  joinedAt: undefined,
                };
                saveLocalPartnershipSpace(updated);
                return updated;
              });
            } else {
              setPartnershipSpace(null);
            }
            await refreshData();
          }
        } else if (event === 'card_deleted' && eventPayload.accountId) {
          const accs = await db.getAccounts();
          const acc = accs.find(a => a.id === eventPayload.accountId);
          if (acc) {
            await db.deleteAccount(eventPayload.accountId);
            await refreshData();
          }
        } else if ((event === 'card_updated' || event === 'card_added') && eventPayload.card) {
          const targetCard = eventPayload.card as Account;
          const accs = await db.getAccounts();
          const acc = accs.find(a => a.id === targetCard.id);
          if (acc) {
            await db.saveAccount({
              ...acc,
              ...targetCard,
              lastDigits: targetCard.lastDigits || acc.lastDigits,
              balance: (targetCard.balance !== undefined && targetCard.balance !== 0) ? targetCard.balance : acc.balance,
              invoiceAmount: acc.invoiceAmount,
              isShared: true,
              updatedAt: new Date().toISOString(),
            });
            await refreshData();
          } else {
            await db.saveAccount({
              ...targetCard,
              isShared: true,
            });
            const remoteTxs = await fetchSharedTransactions(targetCard.id);
            for (const tx of remoteTxs) {
              await db.saveTransaction({ ...tx, isShared: true });
            }
            await refreshData();
          }
        } else if (event === 'goal_saved' && eventPayload.goal) {
          await db.saveGoal({ ...eventPayload.goal, isShared: true });
          await refreshData();
        } else if (event === 'goal_deleted' && eventPayload.goalId) {
          await db.deleteGoal(eventPayload.goalId);
          await refreshData();
        } else if (event === 'budget_saved' && eventPayload.budget) {
          await db.saveBudget({ ...eventPayload.budget, isShared: true });
          await refreshData();
        } else if (event === 'budget_deleted' && eventPayload.budgetId) {
          await db.deleteBudget(eventPayload.budgetId);
          await refreshData();
        } else if (event === 'subscription_saved' && eventPayload.subscription) {
          await db.saveSubscription({ ...eventPayload.subscription, isShared: true });
          await refreshData();
        } else if (event === 'subscription_deleted' && eventPayload.subscriptionId) {
          await db.deleteSubscription(eventPayload.subscriptionId);
          await refreshData();
        } else if (event === 'goal_contribution_saved' && eventPayload.contribution) {
          await db.saveGoalContribution(eventPayload.contribution);
          if (eventPayload.updatedGoal) {
            await db.saveGoal(eventPayload.updatedGoal);
          }
          await refreshData();
        } else if (event === 'goal_contribution_deleted' && eventPayload.contributionId) {
          await db.deleteGoalContribution(eventPayload.contributionId);
          if (eventPayload.updatedGoal) {
            await db.saveGoal(eventPayload.updatedGoal);
          }
          await refreshData();
        } else if (event === 'transaction_saved' && eventPayload.transaction) {
          const remoteTx = eventPayload.transaction as Transaction;
          const existing = await db.getTransaction(remoteTx.id);
          const isDiff = !existing ||
            existing.description !== remoteTx.description ||
            existing.amount !== remoteTx.amount ||
            existing.type !== remoteTx.type ||
            existing.categoryId !== remoteTx.categoryId ||
            existing.date !== remoteTx.date ||
            existing.status !== remoteTx.status ||
            existing.paymentMethod !== remoteTx.paymentMethod ||
            (remoteTx.updatedAt && existing.updatedAt !== remoteTx.updatedAt);

          if (isDiff) {
            await db.saveTransaction({
              ...(existing || {}),
              ...remoteTx,
              isShared: true,
            });
            const accs = await db.getAccounts();
            const targetCard = accs.find(a => a.id === remoteTx.accountId);
            if (targetCard && targetCard.type === 'credit_card') {
              const freshTxs = await db.getTransactions();
              const now = new Date();
              const invoiceData = calculateInvoiceForMonth(targetCard.id, freshTxs, now.getUTCMonth() + 1, now.getUTCFullYear());
              await db.saveAccount({
                ...targetCard,
                balance: invoiceData.totalAmount,
                invoiceAmount: invoiceData.totalAmount,
                updatedAt: new Date().toISOString(),
              });
            }
            await refreshData();
          }
        } else if (event === 'transaction_deleted' && (eventPayload.transactionId || eventPayload.transaction?.id)) {
          const targetId = eventPayload.transactionId || eventPayload.transaction?.id;
          const existing = await db.getTransaction(targetId);
          if (existing) {
            await db.deleteTransaction(targetId);
            const accs = await db.getAccounts();
            const targetAccId = eventPayload.accountId || existing.accountId;
            const targetCard = accs.find(a => a.id === targetAccId);
            if (targetCard && targetCard.type === 'credit_card') {
              const freshTxs = await db.getTransactions();
              const now = new Date();
              const invoiceData = calculateInvoiceForMonth(targetCard.id, freshTxs, now.getUTCMonth() + 1, now.getUTCFullYear());
              await db.saveAccount({
                ...targetCard,
                balance: invoiceData.totalAmount,
                invoiceAmount: invoiceData.totalAmount,
                updatedAt: new Date().toISOString(),
              });
            }
            await refreshData();
          }
        } else if (event === 'partnership_sync_request') {
          await initialSyncSpace();
        }
      } catch (err) {
        console.warn('Erro ao processar evento da parceria:', err);
      }
    });

    return () => unsubscribe();
  }, [partnershipSpace?.code, partnershipSpace?.isActive, user?.id, refreshData]);

  const togglePrivacyMode = () => setIsPrivacyMode(prev => !prev);

  // Aprendizado e Sugestão Inteligente de Categorias (100% Local)
  const suggestCategoryForMerchant = useCallback((merchantName: string): Category | undefined => {
    return categorizationEngine.suggestCategory(merchantName, categories, categoryRules);
  }, [categories, categoryRules]);

  const recordCategoryLearning = async (merchant: string, categoryId: string) => {
    if (!merchant || !categoryId) return;
    const rule = categorizationEngine.createRule(merchant, categoryId);
    await db.saveCategoryRule(rule);
    await refreshData();
  };

  // Regras de Padronização de Nomes e Estabelecimentos
  const saveDescriptionRule = async (rule: DescriptionRule) => {
    const saved = await db.saveDescriptionRule(rule);
    await refreshData();
    return saved;
  };

  const deleteDescriptionRule = async (id: string) => {
    await db.deleteDescriptionRule(id);
    await refreshData();
  };

  const cleanTransactionDescription = useCallback((rawDescription: string): string => {
    return merchantCleaner.applyRules(rawDescription, descriptionRules).cleaned;
  }, [descriptionRules]);

  // Avaliação proativa de recorrência / assinatura
  const checkIfLikelySubscription = useCallback((description: string, amount = 0) => {
    return recurrenceDetector.checkIfLikelySubscription(description, amount, transactions);
  }, [transactions]);

  // Transação
  const saveTransaction = async (
    tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string },
    asSubscription?: { cadence: SubscriptionCadence; nextBillingDate?: string },
    options?: { learnCategory?: boolean; syncInstallmentSiblings?: boolean }
  ) => {
    // Se for novo lançamento, aplica padronização se casar com regra ativa
    let finalDescription = tx.description;
    if (!tx.id && tx.description) {
      const match = merchantCleaner.applyRules(tx.description, descriptionRules);
      if (match.matchedRule) {
        finalDescription = match.cleaned;
      }
    }

    // Verifica se a conta vinculada é compartilhada
    const targetAccount = accounts.find(a => a.id === tx.accountId);
    const isSharedAccount = !!targetAccount?.isShared;

    // Se for edição de transação existente, busca os dados anteriores para preservar autoria e criação
    const existingTx = tx.id ? transactions.find(t => t.id === tx.id) : undefined;

    let createdById = tx.createdById || existingTx?.createdById;
    let createdByName = tx.createdByName || existingTx?.createdByName;

    if (isSharedAccount && !createdByName) {
      const currentProfile = await getCurrentUserProfile();
      if (currentProfile) {
        createdById = currentProfile.id;
        createdByName = currentProfile.displayName;
      }
    }

    // Se for uma receita sem competência definida explicitamente, detecta se é adiantamento salarial para o próximo mês
    let isSalaryAdvance = tx.isSalaryAdvance ?? existingTx?.isSalaryAdvance;
    let competenceMonth = tx.competenceMonth ?? existingTx?.competenceMonth;
    let competenceYear = tx.competenceYear ?? existingTx?.competenceYear;

    if (tx.type === 'income' && competenceMonth === undefined && isSalaryAdvance === undefined) {
      const advanceResult = detectSalaryAdvance(tx, subscriptions, categories);
      if (advanceResult.isAdvance) {
        isSalaryAdvance = true;
        competenceMonth = advanceResult.competenceMonth;
        competenceYear = advanceResult.competenceYear;
      }
    }

    const fullTx: Transaction = {
      ...tx,
      description: finalDescription,
      id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      isShared: isSharedAccount || tx.isShared || Boolean(existingTx?.isShared),
      createdById,
      createdByName,
      isSalaryAdvance,
      competenceMonth,
      competenceYear,
      isRecurring: tx.isRecurring !== undefined ? tx.isRecurring : (asSubscription ? true : Boolean(existingTx?.isRecurring)),
      recurringCadence: tx.recurringCadence || asSubscription?.cadence || existingTx?.recurringCadence,
      createdAt: (tx as any).createdAt || existingTx?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await db.saveTransaction(fullTx);

    // Se a transação pertencer a um parcelamento, sincroniza os dados nas demais parcelas do mesmo grupo se explicitamente solicitado
    if (fullTx.installmentGroupId && options?.syncInstallmentSiblings) {
      const allDbTxs = await db.getTransactions();
      const siblings = allDbTxs.filter(t => t.installmentGroupId === fullTx.installmentGroupId && t.id !== fullTx.id);
      const curNum = fullTx.installmentNumber || 1;
      const baseDate = fullTx.date ? new Date(fullTx.date) : null;

      for (const sibling of siblings) {
        let changed = false;
        const updatedSibling = { ...sibling };
        if (fullTx.categoryId && updatedSibling.categoryId !== fullTx.categoryId) {
          updatedSibling.categoryId = fullTx.categoryId;
          changed = true;
        }
        if (fullTx.description && updatedSibling.description !== fullTx.description) {
          updatedSibling.description = fullTx.description;
          changed = true;
        }
        if (fullTx.originalTotalAmount && updatedSibling.originalTotalAmount !== fullTx.originalTotalAmount) {
          updatedSibling.originalTotalAmount = fullTx.originalTotalAmount;
          updatedSibling.amount = fullTx.amount;
          changed = true;
        } else if (fullTx.amount && updatedSibling.amount !== fullTx.amount) {
          updatedSibling.amount = fullTx.amount;
          changed = true;
        }
        if (updatedSibling.accountId !== fullTx.accountId) {
          updatedSibling.accountId = fullTx.accountId;
          changed = true;
        }
        if (fullTx.paymentMethod && updatedSibling.paymentMethod !== fullTx.paymentMethod) {
          updatedSibling.paymentMethod = fullTx.paymentMethod;
          changed = true;
        }
        if (fullTx.notes !== undefined && updatedSibling.notes !== fullTx.notes) {
          updatedSibling.notes = fullTx.notes;
          changed = true;
        }
        if (baseDate && updatedSibling.installmentNumber && !isNaN(baseDate.getTime())) {
          const sibNum = updatedSibling.installmentNumber;
          const offsetMonths = sibNum - curNum;
          const newSibDate = addMonthsToDate(baseDate, offsetMonths).toISOString();
          if (updatedSibling.date !== newSibDate) {
            updatedSibling.date = newSibDate;
            changed = true;
          }
        }
        if (changed) {
          updatedSibling.updatedAt = new Date().toISOString();
          await db.saveTransaction(updatedSibling);
          if (isSharedAccount || updatedSibling.isShared) {
            broadcastSharedTransaction(updatedSibling.accountId, updatedSibling, 'update', partnershipSpace?.code);
          }
        }
      }
    }

    // Se a transação já existia em outra conta e mudou de conta (ex: do cartão pessoal para o conjunto ou vice-versa):
    if (existingTx && existingTx.accountId !== fullTx.accountId) {
      const oldAccount = accounts.find(a => a.id === existingTx.accountId);
      if (oldAccount?.isShared || existingTx.isShared) {
        broadcastSharedTransaction(existingTx.accountId, { ...existingTx, id: existingTx.id }, 'delete', partnershipSpace?.code);
      }
    }

    // Se for conta compartilhada, faz broadcast em tempo real para os outros aparelhos
    if (isSharedAccount || fullTx.isShared) {
      const action = (existingTx && existingTx.accountId === fullTx.accountId) ? 'update' : 'insert';
      broadcastSharedTransaction(fullTx.accountId, fullTx, action, partnershipSpace?.code);
    }

    // Aprendizado apenas quando o usuário realizou escolha/confirmação explícita (evita contaminar regras com defaults não revisados)
    const shouldLearn = options?.learnCategory ?? false;
    if (shouldLearn && fullTx.description && fullTx.categoryId && !fullTx.isRefund) {
      const rule = categorizationEngine.createRule(fullTx.description, fullTx.categoryId);
      await db.saveCategoryRule(rule);
    }

    // Assinaturas de serviços contratados (APENAS PARA DESPESAS: Netflix, Spotify, Academia, etc.)
    // Receitas recorrentes (como salário) ficam cadastradas na transação como recorrente, sem entrar na tela de assinaturas
    const existingSubs = await db.getSubscriptions();

    // 0. Detecção inteligente de assinatura: se a despesa lançada (seja manual, importação ou notificação)
    // coincide com uma assinatura ativa cadastrada, vincula automaticamente para manter sincronia e permitir edição!
    let matchedActiveSub: Subscription | undefined;
    if (fullTx.type === 'expense' && !fullTx.subscriptionId && !existingTx?.subscriptionId) {
      const normDesc = categorizationEngine.normalize(fullTx.description || '');
      if (normDesc.length >= 2) {
        matchedActiveSub = existingSubs.find(s => {
          if (s.status !== 'active' || s.type === 'income') return false;

          // Se a assinatura tiver conta associada e a transação tiver conta:
          if (s.accountId && fullTx.accountId && s.accountId !== fullTx.accountId) {
            const txAcc = accounts.find(a => a.id === fullTx.accountId);
            const subAcc = accounts.find(a => a.id === s.accountId);
            const isSameBank = txAcc && subAcc && txAcc.bankId && subAcc.bankId && txAcc.bankId === subAcc.bankId;
            if (!isSameBank) return false;
          }

          // Verificação de nome (ex: "Meli+", "Netflix", "Spotify", "Amazon Prime"):
          const normName = categorizationEngine.normalize(s.name || '');
          if (!normName) return false;
          const isNameMatch = 
            normName === normDesc ||
            normDesc.startsWith(normName) ||
            normName.startsWith(normDesc) ||
            (normName.length >= 3 && normDesc.includes(normName)) ||
            (normDesc.length >= 3 && normName.includes(normDesc));
          if (!isNameMatch) return false;

          // Tolerância de valor: exato ou variação razoável (até 25% ou R$ 15,00)
          const diff = Math.abs(s.amount - fullTx.amount);
          return diff < 0.05 || (s.amount > 0 && (diff / s.amount) <= 0.25) || diff <= 15.0;
        });
      }
    }

    const isSubscriptionExpense = fullTx.type === 'expense' && (
      asSubscription ||
      fullTx.subscriptionId ||
      existingTx?.subscriptionId ||
      fullTx.id.startsWith('tx-sub-') ||
      fullTx.id.startsWith('proj-sub-') ||
      (existingTx?.id && (existingTx.id.startsWith('tx-sub-') || existingTx.id.startsWith('proj-sub-'))) ||
      Boolean(fullTx.isRecurring) ||
      Boolean(matchedActiveSub)
    );

    if (isSubscriptionExpense) {
      // 1. Tenta encontrar a assinatura vinculada por ID
      const targetSubId = fullTx.subscriptionId || 
        existingTx?.subscriptionId ||
        fullTx.id.match(/^(?:tx-sub|proj-sub)-(.+)-\d{4}-\d{2}$/)?.[1] ||
        (existingTx?.id ? existingTx.id.match(/^(?:tx-sub|proj-sub)-(.+)-\d{4}-\d{2}$/)?.[1] : undefined);

      let existingSub: Subscription | undefined;
      if (targetSubId) {
        existingSub = existingSubs.find(s => s.id === targetSubId);
      }
      if (!existingSub && matchedActiveSub) {
        existingSub = matchedActiveSub;
      }

      // 2. Se não encontrou por ID, tenta pela descrição anterior da transação (caso o usuário tenha acabado de renomear!)
      if (!existingSub && existingTx?.description) {
        const normOldDesc = categorizationEngine.normalize(existingTx.description);
        existingSub = existingSubs.find(s => {
          if (s.type === 'income') return false;
          const normName = categorizationEngine.normalize(s.name);
          const isMatch = normName === normOldDesc || (normName.length >= 3 && normOldDesc.length >= 3 && (normName.includes(normOldDesc) || normOldDesc.includes(normName)));
          if (!isMatch) return false;
          if (fullTx.accountId && s.accountId && s.accountId !== fullTx.accountId) return false;
          return true;
        });
      }

      // 3. Se ainda não encontrou, tenta pela descrição atual da transação
      if (!existingSub) {
        const normDesc = categorizationEngine.normalize(fullTx.description);
        existingSub = existingSubs.find(s => {
          if (s.type === 'income') return false;
          const normName = categorizationEngine.normalize(s.name);
          const isMatch = normName === normDesc || (normName.length >= 3 && normDesc.length >= 3 && (normName.includes(normDesc) || normDesc.includes(normName)));
          if (!isMatch) return false;
          if (fullTx.accountId && s.accountId && s.accountId !== fullTx.accountId) return false;
          return true;
        });
      }

      // Se temos uma assinatura existente OU foi explicitamente marcada como nova assinatura (asSubscription)
      if (existingSub || asSubscription) {
        const txDate = new Date(fullTx.date);
        const billingDay = fullTx.recurringDayOfMonth || (!isNaN(txDate.getTime()) ? txDate.getUTCDate() : (existingSub?.dayOfMonth || 1));

        const subCadence = asSubscription?.cadence || existingSub?.cadence || fullTx.recurringCadence || 'monthly';

        const nextBilling = asSubscription?.nextBillingDate || existingSub?.nextBillingDate || (() => {
          const d = new Date(fullTx.date);
          if (subCadence === 'monthly') d.setMonth(d.getMonth() + 1);
          else d.setFullYear(d.getFullYear() + 1);
          return d.toISOString().substring(0, 10);
        })();

        const linkedTxAcc = fullTx.accountId ? accounts.find(a => a.id === fullTx.accountId) : null;
        const isSubShared = linkedTxAcc ? Boolean(linkedTxAcc.isShared) : Boolean(fullTx.isShared || existingSub?.isShared);

        let savedSubId: string;
        const previousSubName = existingSub?.name;

        if (existingSub) {
          savedSubId = existingSub.id;

          const isAutoNotification = fullTx.source === 'notification' && Boolean(fullTx.rawNotificationPayload);
          const effectiveSubName = (isAutoNotification && existingSub.name) ? existingSub.name : fullTx.description.trim();
          if (isAutoNotification && existingSub.name && fullTx.description !== existingSub.name) {
            fullTx.description = existingSub.name;
          }

          const updatedSub: Subscription = {
            ...existingSub,
            name: effectiveSubName, // Sincroniza o novo nome da fatura/transação para a assinatura
            type: 'expense',
            amount: fullTx.amount,
            categoryId: fullTx.categoryId || existingSub.categoryId,
            accountId: fullTx.accountId || existingSub.accountId,
            cadence: subCadence,
            dayOfMonth: billingDay,
            nextBillingDate: nextBilling,
            status: 'active',
            lastChargeDate: fullTx.date,
            previousAmount: existingSub.amount !== fullTx.amount ? existingSub.amount : existingSub.previousAmount,
            isShared: isSubShared,
            updatedAt: new Date().toISOString(),
          };
          await db.saveSubscription(updatedSub);
          if (isSubShared && partnershipSpace?.code) {
            syncSharedSubscriptionToCloud(partnershipSpace.code, updatedSub).catch(() => {});
            broadcastPartnershipEvent(partnershipSpace.code, 'subscription_saved', { subscription: updatedSub }).catch(() => {});
          }

          // Sincroniza a mudança de nome para todas as outras transações vinculadas a esta assinatura (faturas passadas/futuras)
          const allDbTxs = await db.getTransactions();
          const otherLinkedTxs = allDbTxs.filter(t => 
            t.id !== fullTx.id && (
              t.subscriptionId === savedSubId ||
              t.id.startsWith(`tx-sub-${savedSubId}-`) ||
              t.id.startsWith(`proj-sub-${savedSubId}-`) ||
              (previousSubName && t.description?.trim().toLowerCase() === previousSubName.trim().toLowerCase() && (t.accountId === fullTx.accountId || t.isRecurring))
            )
          );
          for (const otherTx of otherLinkedTxs) {
            if (otherTx.description !== fullTx.description.trim() || otherTx.subscriptionId !== savedSubId) {
              otherTx.description = fullTx.description.trim();
              otherTx.subscriptionId = savedSubId;
              otherTx.updatedAt = new Date().toISOString();
              await db.saveTransaction(otherTx);
              if (isSubShared && partnershipSpace?.code) {
                broadcastSharedTransaction(otherTx.accountId, otherTx, 'update', partnershipSpace.code);
              }
            }
          }
        } else {
          savedSubId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          const newSub: Subscription = {
            id: savedSubId,
            name: fullTx.description.trim(),
            type: 'expense',
            amount: fullTx.amount,
            categoryId: fullTx.categoryId,
            accountId: fullTx.accountId,
            cadence: subCadence,
            dayOfMonth: billingDay,
            nextBillingDate: nextBilling,
            status: 'active',
            lastChargeDate: fullTx.date,
            isShared: isSubShared,
            ownerId: fullTx.createdById,
            ownerName: fullTx.createdByName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await db.saveSubscription(newSub);
          if (isSubShared && partnershipSpace?.code) {
            syncSharedSubscriptionToCloud(partnershipSpace.code, newSub).catch(() => {});
            broadcastPartnershipEvent(partnershipSpace.code, 'subscription_saved', { subscription: newSub }).catch(() => {});
          }
        }

        // Vincula a transação salva à assinatura correspondente
        if (fullTx.subscriptionId !== savedSubId || !fullTx.isRecurring || !fullTx.recurringDayOfMonth) {
          fullTx.subscriptionId = savedSubId;
          fullTx.isRecurring = true;
          fullTx.recurringCadence = subCadence;
          fullTx.recurringDayOfMonth = billingDay;
          if (!fullTx.categoryId && existingSub?.categoryId) {
            fullTx.categoryId = existingSub.categoryId;
          }
          await db.saveTransaction(fullTx);
        }
      }
    }

    // Se for receita (ex: salário marcado como recorrente):
    // Garante que NENHUMA assinatura de receita resida na tabela de assinaturas
    if (fullTx.type === 'income') {
      const existingSubs = await db.getSubscriptions();
      const normDesc = categorizationEngine.normalize(fullTx.description);
      const residualIncomeSubs = existingSubs.filter(s => {
        const normName = categorizationEngine.normalize(s.name);
        return s.type === 'income' || normName === normDesc || (normDesc.includes('salario') && normName.includes('salario'));
      });
      for (const sub of residualIncomeSubs) {
        await db.deleteSubscription(sub.id);
      }
    }

    // Se for cartão de crédito, reconcilia saldo e fatura com as transações atualizadas
    if (targetAccount && targetAccount.type === 'credit_card') {
      const freshTxs = await db.getTransactions();
      const freshSubs = await db.getSubscriptions();
      const now = new Date();
      const curMonth = now.getUTCMonth() + 1;
      const curYear = now.getUTCFullYear();
      const invoiceData = calculateInvoiceForMonth(targetAccount.id, freshTxs, curMonth, curYear, freshSubs);
      await db.saveAccount({
        ...targetAccount,
        balance: invoiceData.totalAmount,
        invoiceAmount: invoiceData.totalAmount,
        updatedAt: new Date().toISOString(),
      });
    }

    await refreshData();
    return saved;
  };

  const saveInstallmentPurchase = async (params: {
    accountId: string;
    categoryId: string;
    description: string;
    totalAmount: number;
    installmentCount: number;
    startDate?: string;
    cardLastDigits?: string;
    notes?: string;
    learnCategory?: boolean;
  }) => {
    const card = accounts.find(a => a.id === params.accountId);
    const generated = generateInstallmentTransactions({
      accountId: params.accountId,
      categoryId: params.categoryId,
      description: params.description,
      totalAmount: params.totalAmount,
      installmentCount: params.installmentCount,
      startDate: params.startDate,
      card,
      cardLastDigits: params.cardLastDigits,
      notes: params.notes,
      source: 'manual',
    });

    const currentProfile = await getCurrentUserProfile();
    const resolvedUserId = currentProfile?.id || user?.id;
    const resolvedUserName = currentProfile?.displayName || user?.displayName || user?.email?.split('@')[0];
    const prepared = generated.map(tx => ({
      ...tx,
      isShared: Boolean(card?.isShared),
      createdById: resolvedUserId || tx.createdById,
      createdByName: resolvedUserName || tx.createdByName,
    }));

    const saved = await db.saveInstallmentTransactions(prepared);

    // Se o cartão for compartilhado, sincroniza todas as parcelas na nuvem
    if (card?.isShared && saved.length > 0) {
      syncAccountTransactionsToCloud(card.id, saved);
      saved.forEach(tx => broadcastSharedTransaction(card.id, tx, 'insert', partnershipSpace?.code));
    }

    // Aprendizado da categoria apenas se o usuário selecionou/confirmou manualmente
    if (params.learnCategory && params.description && params.categoryId) {
      const rule = categorizationEngine.createRule(params.description, params.categoryId);
      await db.saveCategoryRule(rule);
    }

    await refreshData();
    return saved;
  };

  const deleteInstallmentGroup = async (groupId: string) => {
    const groupTxs = transactions.filter(t => t.installmentGroupId === groupId);
    const firstTx = groupTxs[0];
    const targetAccount = firstTx ? accounts.find(a => a.id === firstTx.accountId) : null;
    const isSharedAccount = !!targetAccount?.isShared;

    await db.deleteInstallmentGroup(groupId);

    if (isSharedAccount && targetAccount && groupTxs.length > 0) {
      const txIds = groupTxs.map(t => t.id);
      await deleteSharedTransactionsBatchFromCloud(targetAccount.id, txIds);
      groupTxs.forEach(tx => broadcastSharedTransaction(targetAccount.id, tx, 'delete', partnershipSpace?.code));
    }

    // Se for cartão, reconcilia saldo e fatura com as transações restantes
    if (targetAccount && targetAccount.type === 'credit_card') {
      const freshTxs = await db.getTransactions();
      const now = new Date();
      const curMonth = now.getUTCMonth() + 1;
      const curYear = now.getUTCFullYear();
      const invoiceData = calculateInvoiceForMonth(targetAccount.id, freshTxs, curMonth, curYear);
      await db.saveAccount({
        ...targetAccount,
        balance: invoiceData.totalAmount,
        invoiceAmount: invoiceData.totalAmount,
        updatedAt: new Date().toISOString(),
      });
    }

    await refreshData();
  };

  const deleteTransaction = async (id: string) => {
    const tx = transactions.find(t => t.id === id);
    const targetAccount = tx ? accounts.find(a => a.id === tx.accountId) : null;
    const isSharedAccount = !!(tx?.isShared || targetAccount?.isShared);

    // Auto-proteção contra ressurreição ao excluir cobrança pontual de assinatura ativa
    let subId: string | undefined = tx?.subscriptionId;
    let chargeYear: number | undefined;
    let chargeMonth: number | undefined;

    const subIdMatch = id.match(/^(?:tx-sub|proj-sub)-(.+)-(\d{4})-(\d{2})$/);
    if (subIdMatch) {
      if (!subId) subId = subIdMatch[1];
      chargeYear = parseInt(subIdMatch[2], 10);
      chargeMonth = parseInt(subIdMatch[3], 10);
    } else if (tx) {
      const d = new Date(tx.date);
      if (!isNaN(d.getTime())) {
        chargeYear = d.getUTCFullYear();
        chargeMonth = d.getUTCMonth() + 1;
      }
    }

    if (subId && chargeYear && chargeMonth) {
      const allSubs = await db.getSubscriptions();
      const targetSub = allSubs.find(s => s.id === subId);
      if (targetSub && targetSub.status === 'active') {
        const monthKey = `${chargeYear}-${String(chargeMonth).padStart(2, '0')}`;
        const currentExcluded = targetSub.excludedMonths || [];
        if (!currentExcluded.includes(monthKey)) {
          const updatedSub: Subscription = {
            ...targetSub,
            excludedMonths: [...currentExcluded, monthKey],
            updatedAt: new Date().toISOString(),
          };
          await db.saveSubscription(updatedSub);
          if (updatedSub.isShared && partnershipSpace?.code) {
            syncSharedSubscriptionToCloud(partnershipSpace.code, updatedSub).catch(() => {});
          }
        }
      }
    }

    await db.deleteTransaction(id);

    if (tx && isSharedAccount) {
      broadcastSharedTransaction(tx.accountId, tx, 'delete', partnershipSpace?.code);
    }

    // Se for cartão de crédito, reconcilia saldo e fatura com as transações restantes
    if (targetAccount && targetAccount.type === 'credit_card') {
      const freshTxs = await db.getTransactions();
      const now = new Date();
      const curMonth = now.getUTCMonth() + 1;
      const curYear = now.getUTCFullYear();
      const invoiceData = calculateInvoiceForMonth(targetAccount.id, freshTxs, curMonth, curYear);
      await db.saveAccount({
        ...targetAccount,
        balance: invoiceData.totalAmount,
        invoiceAmount: invoiceData.totalAmount,
        updatedAt: new Date().toISOString(),
      });
    }

    await refreshData();
  };

  const deleteTransactionsBatch = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const targetAccounts = new Set<string>();

    for (const id of ids) {
      const tx = transactions.find(t => t.id === id);
      if (tx) {
        targetAccounts.add(tx.accountId);
        const targetAccount = accounts.find(a => a.id === tx.accountId);
        const isSharedAccount = !!(tx.isShared || targetAccount?.isShared);

        await db.deleteTransaction(id);

        if (isSharedAccount) {
          broadcastSharedTransaction(tx.accountId, tx, 'delete', partnershipSpace?.code);
        }
      } else {
        await db.deleteTransaction(id);
      }
    }

    for (const accId of targetAccounts) {
      const targetAccount = accounts.find(a => a.id === accId);
      if (targetAccount && targetAccount.type === 'credit_card') {
        const freshTxs = await db.getTransactions();
        const now = new Date();
        const curMonth = now.getUTCMonth() + 1;
        const curYear = now.getUTCFullYear();
        const invoiceData = calculateInvoiceForMonth(targetAccount.id, freshTxs, curMonth, curYear);
        await db.saveAccount({
          ...targetAccount,
          balance: invoiceData.totalAmount,
          invoiceAmount: invoiceData.totalAmount,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await refreshData();
  };

  // Contas
  const saveAccount = async (acc: Omit<Account, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const fullAcc: Account = {
      ...acc,
      id: acc.id || `acc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: (acc as any).createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await db.saveAccount(fullAcc);

    // Se for conta/cartão compartilhado, sincroniza na nuvem e notifica o parceiro
    if (fullAcc.isShared) {
      const spaceCode = partnershipSpace?.code || fullAcc.inviteCode;
      if (spaceCode) {
        syncSharedCardToCloud(spaceCode, fullAcc).catch(() => {});
        broadcastPartnershipEvent(spaceCode, 'card_updated', { card: fullAcc }).catch(() => {});
      }
      broadcastSharedCardUpdate(fullAcc, spaceCode).catch(() => {});
    }

    await refreshData();
    return saved;
  };

  const deleteAccount = async (id: string) => {
    try {
      const acc = accounts.find(a => a.id === id);
      if (acc?.isShared) {
        const isOwner = acc.ownerId
          ? acc.ownerId === user?.id
          : (partnershipSpace ? partnershipSpace.ownerId === user?.id : true);

        if (!isOwner) {
          console.warn('[FinanceContext] Bloqueada tentativa de exclusão de cartão compartilhado por não-titular.');
          alert('Apenas o titular/criador do grupo pode excluir este cartão compartilhado.');
          return;
        }

        // O titular/criador do grupo excluiu o cartão
        if (supabase && isSupabaseConfigured()) {
          try {
            await supabase.from('card_invites').delete().eq('account_id', id);
            await supabase.from('shared_transactions').delete().eq('account_id', id);
            await supabase.from('shared_account_members').delete().eq('account_id', id);
          } catch (e) {
            console.warn('[Supabase] Erro ao remover cartão compartilhado:', e);
          }
        }
        const spaceCode = partnershipSpace?.code || acc.inviteCode;
        if (spaceCode) {
          deleteSharedCardFromCloud(spaceCode, id).catch(() => {});
          broadcastPartnershipEvent(spaceCode, 'card_deleted', { accountId: id }).catch(() => {});
        }
        await broadcastSharedCardDelete(id, spaceCode);
      }
    } catch (err) {
      console.warn('Erro ao processar exclusão de cartão compartilhado na nuvem:', err);
    }

    await db.deleteAccount(id);
    await refreshData();
  };

  // Categorias
  const saveCategory = async (cat: Omit<Category, 'id' | 'createdAt'> & { id?: string; isCustom?: boolean }) => {
    const existing = cat.id ? categories.find(c => c.id === cat.id) : null;
    const fullCat: Category = {
      ...cat,
      id: cat.id || `cat-custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      isCustom: cat.isCustom !== undefined ? cat.isCustom : (existing ? existing.isCustom : true),
      createdAt: existing?.createdAt || (cat as any).createdAt || new Date().toISOString(),
    };
    const saved = await db.saveCategory(fullCat);
    await refreshData();
    return saved;
  };

  const deleteCategory = async (id: string) => {
    await db.deleteCategory(id);
    await refreshData();
  };

  // Orçamentos
  const saveBudget = async (b: Omit<Budget, 'id' | 'createdAt'> & { id?: string }) => {
    const fullBudget: Budget = {
      ...b,
      id: b.id || `b-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: (b as any).createdAt || new Date().toISOString(),
    };
    const saved = await db.saveBudget(fullBudget);
    if (fullBudget.isShared && partnershipSpace?.code) {
      syncSharedBudgetToCloud(partnershipSpace.code, fullBudget).catch(err => {
        console.warn('[FinanceContext] Erro ao sincronizar orçamento na nuvem:', err);
      });
      broadcastPartnershipEvent(partnershipSpace.code, 'budget_saved', { budget: fullBudget }).catch(() => {});
    }
    await refreshData();
    return saved;
  };

  const deleteBudget = async (id: string) => {
    const targetBudget = budgets.find(bg => bg.id === id);
    await db.deleteBudget(id);
    if (targetBudget?.isShared && partnershipSpace?.code) {
      deleteSharedBudgetFromCloud(partnershipSpace.code, id).catch(() => {});
      broadcastPartnershipEvent(partnershipSpace.code, 'budget_deleted', { budgetId: id }).catch(() => {});
    }
    await refreshData();
  };

  // Metas
  const saveGoal = async (g: Omit<Goal, 'id' | 'createdAt'> & { id?: string }) => {
    const isNew = !g.id;
    const fullGoal: Goal = {
      ...g,
      id: g.id || `g-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: (g as any).createdAt || new Date().toISOString(),
    };
    const saved = await db.saveGoal(fullGoal);

    // Se for uma nova meta e o usuário informou um saldo inicial > 0, cria o aporte inicial no extrato
    if (isNew && fullGoal.currentAmount > 0) {
      const initialContrib: GoalContribution = {
        id: `contrib-initial-${fullGoal.id}`,
        goalId: fullGoal.id,
        amount: fullGoal.currentAmount,
        date: new Date().toISOString().substring(0, 10),
        isAutomatic: false,
        note: 'Saldo inicial da meta',
        createdAt: new Date().toISOString(),
      };
      await db.saveGoalContribution(initialContrib);
      if (fullGoal.isShared && partnershipSpace?.code) {
        syncSharedContributionToCloud(partnershipSpace.code, initialContrib).catch(() => {});
        broadcastPartnershipEvent(partnershipSpace.code, 'goal_contribution_saved', { contribution: initialContrib }).catch(() => {});
      }
    }

    if (fullGoal.isShared && partnershipSpace?.code) {
      syncSharedGoalToCloud(partnershipSpace.code, fullGoal).catch(err => {
        console.warn('[FinanceContext] Erro ao sincronizar meta na nuvem:', err);
      });
      broadcastPartnershipEvent(partnershipSpace.code, 'goal_saved', { goal: fullGoal }).catch(() => {});
    }

    await refreshData();
    return saved;
  };

  const deleteGoal = async (id: string) => {
    const targetGoal = goals.find(gl => gl.id === id);
    await db.deleteGoal(id);
    if (targetGoal?.isShared && partnershipSpace?.code) {
      deleteSharedGoalFromCloud(partnershipSpace.code, id).catch(() => {});
      broadcastPartnershipEvent(partnershipSpace.code, 'goal_deleted', { goalId: id }).catch(() => {});
    }
    await refreshData();
  };

  // Aportes da Meta (Extrato)
  const addGoalContribution = async (contribution: Omit<GoalContribution, 'id' | 'createdAt'>) => {
    const newContrib: GoalContribution = {
      ...contribution,
      id: `contrib-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString(),
    };
    const saved = await db.saveGoalContribution(newContrib);

    const targetGoal = goals.find(g => g.id === contribution.goalId);
    let updatedGoal: Goal | undefined;
    if (targetGoal) {
      const newCurrentAmount = Math.round((targetGoal.currentAmount + contribution.amount) * 100) / 100;
      updatedGoal = {
        ...targetGoal,
        currentAmount: newCurrentAmount,
        isCompleted: newCurrentAmount >= targetGoal.targetAmount,
      };
      await db.saveGoal(updatedGoal);
    }

    if (targetGoal?.isShared && partnershipSpace?.code) {
      syncSharedContributionToCloud(partnershipSpace.code, newContrib).catch(() => {});
      if (updatedGoal) {
        syncSharedGoalToCloud(partnershipSpace.code, updatedGoal).catch(() => {});
      }
      broadcastPartnershipEvent(partnershipSpace.code, 'goal_contribution_saved', { contribution: newContrib, updatedGoal }).catch(() => {});
    }

    await refreshData();
    return saved;
  };

  const updateGoalContribution = async (id: string, newAmount: number, newDate?: string, note?: string) => {
    const existing = goalContributions.find(c => c.id === id);
    if (!existing) throw new Error('Aporte não encontrado');

    const diff = Math.round((newAmount - existing.amount) * 100) / 100;
    const updatedContrib: GoalContribution = {
      ...existing,
      amount: newAmount,
      date: newDate || existing.date,
      note: note !== undefined ? note : existing.note,
    };

    const saved = await db.saveGoalContribution(updatedContrib);

    const targetGoal = goals.find(g => g.id === existing.goalId);
    let updatedGoal: Goal | undefined;
    if (targetGoal) {
      const newCurrentAmount = Math.max(0, Math.round((targetGoal.currentAmount + diff) * 100) / 100);
      updatedGoal = {
        ...targetGoal,
        currentAmount: newCurrentAmount,
        isCompleted: newCurrentAmount >= targetGoal.targetAmount,
      };
      await db.saveGoal(updatedGoal);
    }

    if (targetGoal?.isShared && partnershipSpace?.code) {
      syncSharedContributionToCloud(partnershipSpace.code, updatedContrib).catch(() => {});
      if (updatedGoal) {
        syncSharedGoalToCloud(partnershipSpace.code, updatedGoal).catch(() => {});
      }
      broadcastPartnershipEvent(partnershipSpace.code, 'goal_contribution_saved', { contribution: updatedContrib, updatedGoal }).catch(() => {});
    }

    await refreshData();
    return saved;
  };

  const deleteGoalContribution = async (id: string) => {
    const existing = goalContributions.find(c => c.id === id);
    if (existing) {
      await db.deleteGoalContribution(id);
      const targetGoal = goals.find(g => g.id === existing.goalId);
      let updatedGoal: Goal | undefined;
      if (targetGoal) {
        const newCurrentAmount = Math.max(0, Math.round((targetGoal.currentAmount - existing.amount) * 100) / 100);
        updatedGoal = {
          ...targetGoal,
          currentAmount: newCurrentAmount,
          isCompleted: newCurrentAmount >= targetGoal.targetAmount,
        };
        await db.saveGoal(updatedGoal);
      }

      if (targetGoal?.isShared && partnershipSpace?.code) {
        deleteSharedContributionFromCloud(partnershipSpace.code, id).catch(() => {});
        if (updatedGoal) {
          syncSharedGoalToCloud(partnershipSpace.code, updatedGoal).catch(() => {});
        }
        broadcastPartnershipEvent(partnershipSpace.code, 'goal_contribution_deleted', { contributionId: id, updatedGoal }).catch(() => {});
      }
    }
    await refreshData();
  };

  // Notificações
  const approveNotification = async (
    pendingId: string, 
    confirmedData: { 
      accountId: string; 
      categoryId: string; 
      amount: number; 
      description: string; 
      date: string; 
      type: 'income' | 'expense'; 
      paymentMethod: any; 
      syncAccountBalance?: boolean; 
      asSubscription?: { cadence: SubscriptionCadence; nextBillingDate?: string };
      isInstallment?: boolean;
      installmentCount?: number;
    }
  ) => {
    const [allPending, allDbTxs] = await Promise.all([
      db.getPendingNotifications(),
      db.getTransactions(),
    ]);
    const pending = allPending.find(p => p.id === pendingId) || pendingNotifications.find(p => p.id === pendingId);

    // Identifica transação preexistente gerada automaticamente por esta notificação
    let existingTx: Transaction | undefined;
    if (pending?.generatedTransactionId) {
      existingTx = allDbTxs.find(t => t.id === pending.generatedTransactionId);
    }
    if (!existingTx && pending) {
      const rawPayload = `${pending.rawTitle} - ${pending.rawText}`;
      existingTx = allDbTxs.find(t => t.rawNotificationPayload === rawPayload);
    }
    if (!existingTx && pending) {
      // Fallback: transação gerada por notificação nas últimas 24h com mesma conta e valor
      existingTx = allDbTxs.find(t => {
        if (t.source !== 'notification') return false;
        if (Math.abs(t.amount - pending.parsedAmount) > 0.01) return false;
        const diffMs = Math.abs(new Date(t.createdAt || t.date).getTime() - new Date(pending.detectedAt).getTime());
        return diffMs < 24 * 60 * 60 * 1000;
      });
    }
    if (!existingTx && pending) {
      // Fallback: transação de assinatura já lançada ou prevista nesta fatura/mês
      const normPendingMerchant = categorizationEngine.normalize(pending.parsedMerchant || '');
      const pDate = new Date(pending.detectedAt);
      const pMonth = pDate.getUTCMonth() + 1;
      const pYear = pDate.getUTCFullYear();

      existingTx = allDbTxs.find(t => {
        if (!t.subscriptionId && !t.isRecurring && !t.id.startsWith('tx-sub-')) return false;
        if (t.accountId !== (confirmedData.accountId || pending.suggestedAccountId)) return false;
        const diff = Math.abs(t.amount - pending.parsedAmount);
        if (diff > 0.10 && (diff / t.amount) > 0.05) return false;
        const tDate = new Date(t.date);
        if (tDate.getUTCMonth() + 1 !== pMonth || tDate.getUTCFullYear() !== pYear) return false;
        const normDesc = categorizationEngine.normalize(t.description || '');
        return normDesc.includes(normPendingMerchant) || normPendingMerchant.includes(normDesc);
      });
    }

    const targetAccount = accounts.find(a => a.id === confirmedData.accountId);
    const isSharedAccount = !!targetAccount?.isShared;

    if (existingTx) {
      // ATUALIZAÇÃO IN-PLACE: A compra já está lançada na fatura.
      // Modifica diretamente a transação existente sem gerar novas duplicatas.

      // Se a conta vinculada mudou (ex: do cartão pessoal para o conjunto ou vice-versa):
      if (existingTx.accountId !== confirmedData.accountId) {
        const oldAccount = accounts.find(a => a.id === existingTx.accountId);
        if (oldAccount?.isShared || existingTx.isShared) {
          broadcastSharedTransaction(existingTx.accountId, { ...existingTx, id: existingTx.id }, 'delete', partnershipSpace?.code);
        }
      }

      if (confirmedData.isInstallment && confirmedData.installmentCount && confirmedData.installmentCount > 1) {
        // Conversão para parcelamento
        if (existingTx.installmentGroupId) {
          const siblings = allDbTxs.filter(t => t.installmentGroupId === existingTx.installmentGroupId);
          for (const s of siblings) {
            await db.deleteTransaction(s.id);
            if (s.isShared) {
              broadcastSharedTransaction(s.accountId, s, 'delete', partnershipSpace?.code);
            }
          }
        } else {
          await db.deleteTransaction(existingTx.id);
          if (existingTx.isShared) {
            broadcastSharedTransaction(existingTx.accountId, existingTx, 'delete', partnershipSpace?.code);
          }
        }
        await saveInstallmentPurchase({
          accountId: confirmedData.accountId,
          categoryId: confirmedData.categoryId,
          description: confirmedData.description,
          totalAmount: confirmedData.amount,
          installmentCount: confirmedData.installmentCount,
          startDate: confirmedData.date,
          cardLastDigits: pending?.cardLastDigits || existingTx.cardLastDigits,
          notes: `Detectado via notificação do ${pending?.bankName || 'Banco'}`,
          learnCategory: true,
        });
      } else {
        // Atualiza a transação existente preservando seu id original e dados de assinatura
        await saveTransaction({
          id: existingTx.id,
          accountId: confirmedData.accountId,
          categoryId: confirmedData.categoryId,
          amount: confirmedData.amount,
          type: confirmedData.type,
          description: confirmedData.description,
          date: existingTx.date || confirmedData.date,
          status: 'confirmed',
          paymentMethod: confirmedData.paymentMethod,
          source: 'notification',
          cardLastDigits: pending?.cardLastDigits || existingTx.cardLastDigits,
          rawNotificationPayload: pending ? `${pending.rawTitle} - ${pending.rawText}` : existingTx.rawNotificationPayload,
          notes: existingTx.notes || `Detectado automaticamente do ${pending?.bankName || 'Banco'}`,
          isShared: isSharedAccount,
          createdAt: existingTx.createdAt,
          isRecurring: existingTx.isRecurring || Boolean(confirmedData.asSubscription),
          recurringCadence: existingTx.recurringCadence || confirmedData.asSubscription?.cadence,
          recurringDayOfMonth: existingTx.recurringDayOfMonth,
          subscriptionId: existingTx.subscriptionId,
        }, confirmedData.asSubscription, { learnCategory: true });

        // Se era uma assinatura, atualiza lastChargeDate na assinatura
        if (existingTx.subscriptionId) {
          const currentSubs = await db.getSubscriptions();
          const targetSub = currentSubs.find(s => s.id === existingTx?.subscriptionId);
          if (targetSub) {
            await db.saveSubscription({
              ...targetSub,
              lastChargeDate: new Date().toISOString(),
            });
          }
        }
      }
    } else {
      // 1. Criar transação definitiva (apenas se ainda não existia na fatura)
      if (confirmedData.isInstallment && confirmedData.installmentCount && confirmedData.installmentCount > 1) {
        await saveInstallmentPurchase({
          accountId: confirmedData.accountId,
          categoryId: confirmedData.categoryId,
          description: confirmedData.description,
          totalAmount: confirmedData.amount,
          installmentCount: confirmedData.installmentCount,
          startDate: confirmedData.date,
          cardLastDigits: pending?.cardLastDigits,
          notes: `Detectado via notificação do ${pending?.bankName || 'Banco'}`,
          learnCategory: true,
        });
      } else {
        const saved = await saveTransaction({
          accountId: confirmedData.accountId,
          categoryId: confirmedData.categoryId,
          amount: confirmedData.amount,
          type: confirmedData.type,
          description: confirmedData.description,
          date: confirmedData.date,
          status: 'confirmed',
          paymentMethod: confirmedData.paymentMethod,
          source: 'notification',
          cardLastDigits: pending?.cardLastDigits,
          rawNotificationPayload: pending ? `${pending.rawTitle} - ${pending.rawText}` : null,
          notes: `Detectado automaticamente do ${pending?.bankName || 'Banco'}`,
          isShared: isSharedAccount,
        }, confirmedData.asSubscription, { learnCategory: true });
        if (pending && saved) {
          pending.generatedTransactionId = saved.id;
        }
      }
    }

    // 1.1 Se o usuário optou por sincronizar o saldo capturado na notificação
    if (confirmedData.syncAccountBalance && pending?.detectedBalance !== null && pending?.detectedBalance !== undefined) {
      const acc = accounts.find(a => a.id === confirmedData.accountId);
      if (acc) {
        await saveAccount({
          ...acc,
          balance: pending.detectedBalance,
        });
      }
    }

    // 2. Marcar notificação como aprovada
    await db.updatePendingNotificationStatus(pendingId, 'approved');
    await refreshData();
  };

  const discardNotification = async (pendingId: string) => {
    const allPending = await db.getPendingNotifications();
    const pending = allPending.find(p => p.id === pendingId) || pendingNotifications.find(p => p.id === pendingId);
    if (pending?.generatedTransactionId) {
      await deleteTransaction(pending.generatedTransactionId);
    }
    await db.updatePendingNotificationStatus(pendingId, 'discarded');
    await refreshData();
  };

  const approveNotificationWithNewAccount = async (
    pendingId: string,
    account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    customCategory?: string
  ): Promise<{ account: Account }> => {
    // 1. Salvar nova conta
    const savedAccount = await saveAccount(account);
    const pending = pendingNotifications.find(p => p.id === pendingId);

    if (pending) {
      const defaultCat = categories.find(c => c.id === pending.suggestedCategoryId) || categories[0];
      const isInstallment = !!(pending.isInstallment && pending.installmentCount && pending.installmentCount > 1);

      if (isInstallment) {
        await saveInstallmentPurchase({
          accountId: savedAccount.id,
          categoryId: customCategory || defaultCat?.id || '',
          description: pending.parsedMerchant,
          totalAmount: pending.originalTotalAmount || pending.parsedAmount,
          installmentCount: pending.installmentCount || 2,
          startDate: pending.detectedAt || new Date().toISOString(),
          cardLastDigits: pending.cardLastDigits,
          notes: `Lançado automaticamente ao cadastrar cartão ${savedAccount.name}`,
        });
      } else {
        await saveTransaction({
          accountId: savedAccount.id,
          categoryId: customCategory || defaultCat?.id || '',
          amount: pending.parsedAmount,
          type: pending.parsedType,
          description: pending.parsedMerchant,
          date: pending.detectedAt || new Date().toISOString(),
          status: 'confirmed',
          paymentMethod: pending.parsedPaymentMethod,
          source: 'notification',
          cardLastDigits: pending.cardLastDigits,
          rawNotificationPayload: `${pending.rawTitle} - ${pending.rawText}`,
          notes: `Lançado automaticamente ao cadastrar cartão ${savedAccount.name}`,
        });
      }

      // 2. Se a notificação detectou saldo, sincroniza com a conta
      if (pending.detectedBalance !== null && pending.detectedBalance !== undefined) {
        await saveAccount({
          ...savedAccount,
          balance: pending.detectedBalance,
        });
      }

      // 3. Marcar pendência como aprovada
      await db.updatePendingNotificationStatus(pendingId, 'approved');
      await refreshData();
    }

    return { account: savedAccount };
  };

  const simulateIncomingNotification = async (
    title: string,
    text: string,
    packageName = 'com.nu.production',
    bypassDuplicateCheck = true
  ): Promise<PendingNotification | null> => {
    const parsed = notificationListenerBridge.simulateNotification(title, text, packageName);
    if (!parsed) return null;
    return await processIncomingNotification(parsed, packageName, bypassDuplicateCheck);
  };

  // Ações de Assinaturas e Recorrências
  const saveSubscription = async (sub: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Subscription> => {
    const targetAccount = accounts.find(a => a.id === sub.accountId);
    const isTargetAccountShared = Boolean(targetAccount?.isShared);

    // Evita duplicação quando não é passado id explícito
    let targetId = sub.id;
    let existingSub: Subscription | undefined;
    if (!targetId) {
      const normName = categorizationEngine.normalize(sub.name);
      existingSub = subscriptions.find(s => {
        if (s.type === 'income') return false;
        const sNorm = categorizationEngine.normalize(s.name);
        const isMatch = sNorm === normName || (sNorm.length >= 3 && normName.length >= 3 && (sNorm.includes(normName) || normName.includes(sNorm)));
        if (!isMatch) return false;
        if (sub.accountId && s.accountId && s.accountId !== sub.accountId) return false;
        return true;
      });
      if (existingSub) {
        targetId = existingSub.id;
      }
    } else {
      existingSub = subscriptions.find(s => s.id === targetId);
    }

    const billingDay = sub.dayOfMonth || (sub.nextBillingDate ? new Date(sub.nextBillingDate).getUTCDate() : undefined) || existingSub?.dayOfMonth || 1;

    const linkedAcc = accounts.find(a => a.id === sub.accountId);
    const effectiveIsShared = linkedAcc
      ? Boolean(linkedAcc.isShared)
      : (sub.isShared !== undefined ? sub.isShared : (isTargetAccountShared ? true : undefined));

    const fullSub: Subscription = {
      ...(existingSub || {}),
      ...sub,
      id: targetId || `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      dayOfMonth: billingDay,
      isShared: effectiveIsShared,
      createdAt: (sub as any).createdAt || existingSub?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await db.saveSubscription(fullSub);
    if (fullSub.isShared && partnershipSpace?.code) {
      syncSharedSubscriptionToCloud(partnershipSpace.code, fullSub).catch(err => {
        console.warn('[FinanceContext] Erro ao sincronizar assinatura na nuvem:', err);
      });
      broadcastPartnershipEvent(partnershipSpace.code, 'subscription_saved', { subscription: fullSub }).catch(() => {});
    }

    // Sincronização bidirecional com transações e faturas de cartão:
    // Se o nome da assinatura mudou (ou se já existem transações vinculadas),
    // atualiza a descrição de todas as transações vinculadas na fatura / conta
    const oldSubName = existingSub?.name?.trim();
    const newSubName = fullSub.name.trim();
    const allDbTxs = await db.getTransactions();
    const linkedTxs = allDbTxs.filter(t => 
      t.subscriptionId === fullSub.id ||
      t.id.startsWith(`tx-sub-${fullSub.id}-`) ||
      t.id.startsWith(`proj-sub-${fullSub.id}-`) ||
      (oldSubName && t.description?.trim().toLowerCase() === oldSubName.toLowerCase() && (t.accountId === fullSub.accountId || t.isRecurring))
    );

    for (const linkedTx of linkedTxs) {
      let txModified = false;
      if (linkedTx.description !== newSubName) {
        linkedTx.description = newSubName;
        txModified = true;
      }
      if (linkedTx.subscriptionId !== fullSub.id) {
        linkedTx.subscriptionId = fullSub.id;
        txModified = true;
      }
      if (fullSub.accountId && linkedTx.accountId !== fullSub.accountId && linkedTx.id.startsWith(`tx-sub-${fullSub.id}-`)) {
        linkedTx.accountId = fullSub.accountId;
        txModified = true;
      }
      if (txModified) {
        linkedTx.updatedAt = new Date().toISOString();
        await db.saveTransaction(linkedTx);
        if (fullSub.isShared && partnershipSpace?.code) {
          broadcastSharedTransaction(linkedTx.accountId, linkedTx, 'update', partnershipSpace.code);
        }
      }
    }

    await refreshData();
    return saved;
  };

  const deleteSubscription = async (id: string): Promise<void> => {
    const targetSub = subscriptions.find(s => s.id === id);
    const isShared = targetSub?.isShared || Boolean(accounts.find(a => a.id === targetSub?.accountId)?.isShared);
    await db.deleteSubscription(id);

    // Remove também lançamentos gerados automaticamente vinculados a esta assinatura
    const freshTxs = await db.getTransactions();
    const generatedToDelete = freshTxs.filter(t => t.id.startsWith(`tx-sub-${id}-`) || t.id.startsWith(`proj-sub-${id}-`) || t.subscriptionId === id);
    for (const genTx of generatedToDelete) {
      try {
        await db.deleteTransaction(genTx.id);
        if (isShared && partnershipSpace?.code) {
          broadcastSharedTransaction(genTx.accountId, genTx, 'delete', partnershipSpace.code);
        }
      } catch {}
    }

    if (isShared && partnershipSpace?.code) {
      deleteSharedSubscriptionFromCloud(partnershipSpace.code, id).catch(() => {});
      broadcastPartnershipEvent(partnershipSpace.code, 'subscription_deleted', { subscriptionId: id }).catch(() => {});
    }
    await refreshData();
  };

  const confirmSubscriptionSuggestion = async (suggestion: SubscriptionSuggestion): Promise<Subscription> => {
    const newSub: Subscription = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: suggestion.merchantName,
      amount: suggestion.amount,
      previousAmount: suggestion.previousAmount,
      categoryId: suggestion.categoryId,
      accountId: suggestion.accountId,
      cadence: suggestion.cadence,
      nextBillingDate: suggestion.nextBillingDate,
      status: 'active',
      lastChargeDate: suggestion.lastDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return await saveSubscription(newSub);
  };

  const dismissSubscriptionSuggestion = async (merchantPattern: string): Promise<void> => {
    await db.dismissSubscriptionSuggestion(merchantPattern);
    await refreshData();
  };

  // Importar CSV em Lote
  const importCsvTransactions = async (
    rows: ParsedCsvRow[], 
    accountId: string, 
    options?: {
      defaultCategoryId?: string;
      ignoreInvoicePayments?: boolean;
      projectFutureInstallments?: boolean;
    } | string
  ): Promise<number> => {
    let imported = 0;
    const opts = typeof options === 'string' 
      ? { defaultCategoryId: options, ignoreInvoicePayments: true, projectFutureInstallments: true } 
      : (options || {});

    const {
      defaultCategoryId,
      ignoreInvoicePayments = true,
      projectFutureInstallments = true,
    } = opts;

    const fallbackCategory = defaultCategoryId || categories[0]?.id || 'cat-outros-desp';
    const targetAccount = accounts.find(a => a.id === accountId);
    const isTargetCard = targetAccount?.type === 'credit_card';
    const isSharedAccount = !!targetAccount?.isShared;

    let currentProfile: any = null;
    if (isSharedAccount) {
      try {
        currentProfile = await getCurrentUserProfile();
      } catch {}
    }

    const allImportedTxs: Transaction[] = [];
    const currentDbTxs = await db.getTransactions();

    for (const row of rows) {
      // Se for pagamento de fatura anterior e o usuário optou por ignorar
      if (row.isInvoicePayment && ignoreInvoicePayments) {
        continue;
      }

      const rawBaseDesc = row.cleanDescription || row.description;
      const cleanedDesc = merchantCleaner.applyRules(rawBaseDesc, descriptionRules).cleaned || rawBaseDesc;
      const suggested = categorizationEngine.suggestCategory(cleanedDesc, categories, categoryRules);
      const catId = suggested ? suggested.id : fallbackCategory;

      const isInstallment = !!(row.isInstallment && row.installmentTotal && row.installmentTotal > 1);

      if (isInstallment && row.installmentNumber && row.installmentTotal) {
        const curNum = row.installmentNumber;
        const totalNum = row.installmentTotal;
        const cleanIncoming = merchantCleaner.stripBankNoise(cleanedDesc).toLowerCase().replace(/\(\d+\/\d+\)/g, '').trim();

        // 1. Busca se já existe um grupo deste mesmo parcelamento cadastrado no mesmo cartão.
        // O usuário pode ter renomeado a compra, então o cartão + total de parcelas (ex: 10x) + valor idêntico (ex: R$ 89,90) é a chave de correspondência.
        const matchingGroups = currentDbTxs.filter(t => {
          if (t.accountId !== accountId) return false;
          if (!t.isInstallment || !t.installmentGroupId) return false;
          if (t.installmentTotal !== totalNum) return false;
          return Math.abs(t.amount - row.amount) <= 0.05;
        });

        // Se houver mais de um parcelamento idêntico no mesmo cartão, usa similaridade de nome como desempate; senão usa o matching encontrado
        const existingGroupTx = matchingGroups.find(t => {
          const cleanExisting = merchantCleaner.stripBankNoise(t.description).toLowerCase().replace(/\(\d+\/\d+\)/g, '').trim();
          return cleanExisting === cleanIncoming || cleanExisting.includes(cleanIncoming) || cleanIncoming.includes(cleanExisting);
        }) || matchingGroups[0];

        const targetGroupId = existingGroupTx?.installmentGroupId || `inst-csv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const groupTransactions = currentDbTxs.filter(t => t.installmentGroupId === targetGroupId);
        const existingParcelNumbers = new Set(groupTransactions.map(t => t.installmentNumber));

        // Se a parcela exata (ex: 2/10) já existe cadastrada, ignora para não duplicar
        if (existingParcelNumbers.has(curNum)) {
          continue;
        }

        const baseDate = new Date(`${row.date}T12:00:00.000Z`);
        const totalAmount = existingGroupTx?.originalTotalAmount || (Math.round(row.amount * totalNum * 100) / 100);
        const resolvedCatId = existingGroupTx?.categoryId || catId;
        const nowIso = new Date().toISOString();
        const origDate = row.originalPurchaseDate
          ? new Date(row.originalPurchaseDate + 'T12:00:00.000Z').toISOString()
          : (curNum === 1
            ? baseDate.toISOString()
            : (existingGroupTx?.originalDate || addMonthsToDate(baseDate, -(curNum - 1)).toISOString()));

        // Salva a parcela atual constante no CSV/PDF vinculada ao grupo existente ou novo
        const mainTx: Transaction = {
          id: `tx-csv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          accountId,
          categoryId: resolvedCatId,
          amount: row.amount,
          type: row.type,
          description: cleanedDesc,
          date: baseDate.toISOString(),
          status: 'confirmed',
          paymentMethod: isTargetCard ? 'credit' : (row.paymentMethod || 'other'),
          source: 'csv',
          cardLastDigits: row.cardLastDigits,
          notes: existingGroupTx
            ? `Importado via fatura anterior (vinculado ao parcelamento existente ${curNum}/${totalNum}): ${row.raw}`
            : `Importado via extrato CSV/PDF: ${row.raw}`,
          isInstallment: true,
          installmentGroupId: targetGroupId,
          installmentNumber: curNum,
          installmentTotal: totalNum,
          originalTotalAmount: totalAmount,
          originalDate: origDate,
          isShared: isSharedAccount,
          createdById: currentProfile?.id,
          createdByName: currentProfile?.displayName,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await db.saveTransaction(mainTx);
        currentDbTxs.push(mainTx);
        allImportedTxs.push(mainTx);
        imported++;

        // Se solicitado projeção de parcelas futuras e ainda restam parcelas
        // PROJETA SOMENTE as parcelas que ainda NÃO existem no grupo!
        if (projectFutureInstallments && curNum < totalNum) {
          const futureTxs: Transaction[] = [];
          for (let nextI = curNum + 1; nextI <= totalNum; nextI++) {
            if (existingParcelNumbers.has(nextI)) {
              // Parcela já existe (ex: usuário já havia lançado a partir de 3/10 em Setembro)
              continue;
            }
            const monthsAhead = nextI - curNum;
            const parcelDate = addMonthsToDate(baseDate, monthsAhead);
            const futureTx: Transaction = {
              id: `tx-inst-${targetGroupId}-${nextI}`,
              accountId,
              categoryId: resolvedCatId,
              amount: row.amount,
              type: 'expense',
              description: cleanedDesc,
              date: parcelDate.toISOString(),
              status: 'confirmed',
              paymentMethod: isTargetCard ? 'credit' : 'other',
              source: 'csv',
              cardLastDigits: row.cardLastDigits,
              notes: `Parcela futura projetada (${nextI}/${totalNum}) a partir de importação`,
              isInstallment: true,
              installmentGroupId: targetGroupId,
              installmentNumber: nextI,
              installmentTotal: totalNum,
              originalTotalAmount: totalAmount,
              originalDate: origDate,
              isShared: isSharedAccount,
              createdById: currentProfile?.id,
              createdByName: currentProfile?.displayName,
              createdAt: nowIso,
              updatedAt: nowIso,
            };
            futureTxs.push(futureTx);
            currentDbTxs.push(futureTx);
          }
          if (futureTxs.length > 0) {
            await db.saveInstallmentTransactions(futureTxs);
            allImportedTxs.push(...futureTxs);
            imported += futureTxs.length;
          }
        }
      } else {
        // Transação avulsa normal
        const isRowRefund = Boolean(row.isRefund || (isTargetCard && isRefundDescription(row.description)));
        const finalType = isRowRefund ? 'income' : row.type;

        // Previne duplicar transação que já existe no mesmo dia com mesmo valor e descrição
        const isDuplicate = currentDbTxs.some(t =>
          t.accountId === accountId &&
          t.type === finalType &&
          Math.abs(t.amount - row.amount) < 0.01 &&
          t.date.substring(0, 10) === row.date &&
          merchantCleaner.stripBankNoise(t.description).toLowerCase().trim() === merchantCleaner.stripBankNoise(cleanedDesc).toLowerCase().trim()
        );
        if (isDuplicate) {
          continue;
        }

        const simpleTx: Transaction = {
          id: `tx-csv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          accountId,
          categoryId: catId,
          amount: row.amount,
          type: finalType,
          description: cleanedDesc,
          date: `${row.date}T12:00:00.000Z`,
          status: 'confirmed',
          paymentMethod: isTargetCard ? 'credit' : (row.paymentMethod || 'other'),
          source: 'csv',
          cardLastDigits: row.cardLastDigits,
          notes: `Importado via extrato CSV: ${row.raw}`,
          isRefund: isRowRefund,
          isInvoicePayment: Boolean(row.isInvoicePayment || isInvoicePaymentDescription(cleanedDesc)),
          isShared: isSharedAccount,
          createdById: currentProfile?.id,
          createdByName: currentProfile?.displayName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await db.saveTransaction(simpleTx);
        currentDbTxs.push(simpleTx);
        allImportedTxs.push(simpleTx);
        imported++;
      }
    }

    // Se a conta for compartilhada, envia todo o lote para o Supabase e notifica outros aparelhos
    if (isSharedAccount && allImportedTxs.length > 0) {
      await syncAccountTransactionsToCloud(accountId, allImportedTxs);
      broadcastSharedTransaction(accountId, allImportedTxs[0], 'insert');
    }

    // Reconcilia o saldo e a fatura do cartão com as transações calculadas
    if (isTargetCard && targetAccount) {
      const freshTxs = await db.getTransactions();
      const now = new Date();
      const curMonth = now.getUTCMonth() + 1;
      const curYear = now.getUTCFullYear();
      const invoiceData = calculateInvoiceForMonth(accountId, freshTxs, curMonth, curYear);
      await db.saveAccount({
        ...targetAccount,
        balance: invoiceData.totalAmount,
        invoiceAmount: invoiceData.totalAmount,
        updatedAt: new Date().toISOString(),
      });
    }

    await refreshData();
    return imported;
  };

  // Remove transações importadas via PDF / CSV de um cartão específico (ou IDs específicos)
  const deleteCardImportedTransactions = async (cardId: string, transactionIds?: string[]): Promise<number> => {
    const currentDbTxs = await db.getTransactions();
    const toDelete = currentDbTxs.filter(t => 
      t.accountId === cardId && (
        transactionIds && transactionIds.length > 0
          ? transactionIds.includes(t.id)
          : (
            t.source === 'csv' || 
            t.id.startsWith('tx-csv-') || 
            (t.notes && t.notes.includes('Importado via')) ||
            (t.id.startsWith('tx-inst-') && t.notes && t.notes.includes('importação'))
          )
      )
    );

    if (toDelete.length === 0) return 0;

    for (const t of toDelete) {
      await db.deleteTransaction(t.id);
    }

    const targetAccount = accounts.find(a => a.id === cardId);
    if (targetAccount && targetAccount.type === 'credit_card') {
      const freshTxs = await db.getTransactions();
      const now = new Date();
      const curMonth = now.getUTCMonth() + 1;
      const curYear = now.getUTCFullYear();
      const invoiceData = calculateInvoiceForMonth(targetAccount.id, freshTxs, curMonth, curYear);
      await db.saveAccount({
        ...targetAccount,
        balance: invoiceData.totalAmount,
        invoiceAmount: invoiceData.totalAmount,
        openAmount: invoiceData.totalAmount,
        updatedAt: new Date().toISOString(),
      });
    }

    await refreshData();
    return toDelete.length;
  };

  const activeInstallmentGroups = useMemo(() => {
    return getActiveInstallmentGroups(transactions, undefined, false, accounts);
  }, [transactions, accounts]);

  const resetAllData = useCallback(async () => {
    await db.resetAll('empty');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem('sobra_sobi_chat_history_v1');
        localStorage.removeItem('sobra_burn_rate_goal_v1');
      } catch {}
    }
    await refreshData();
  }, [refreshData]);

  const exportFullBackup = useCallback(async () => {
    return await db.exportFullBackup();
  }, []);

  const importFullBackup = useCallback(async (backupData: StorageData) => {
    await db.importFullBackup(backupData);
    await refreshData();
  }, [refreshData]);

  return (
    <FinanceContext.Provider value={{
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      pendingNotifications,
      subscriptions,
      categoryRules,
      descriptionRules,
      subscriptionSuggestions,
      activeInstallmentGroups,
      isPrivacyMode,
      togglePrivacyMode,
      isLoading,
      onlyRegisteredBanks,
      autoAddCreditToInvoice,
      toggleOnlyRegisteredBanks,
      toggleAutoAddCreditToInvoice,
      saveTransaction,
      saveInstallmentPurchase,
      deleteTransaction,
      deleteTransactionsBatch,
      deleteInstallmentGroup,
      saveAccount,
      deleteAccount,
      saveCategory,
      deleteCategory,
      saveBudget,
      deleteBudget,
      saveGoal,
      deleteGoal,
      goalContributions,
      addGoalContribution,
      updateGoalContribution,
      deleteGoalContribution,
      approveNotification,
      approveNotificationWithNewAccount,
      discardNotification,
      simulateIncomingNotification,
      saveSubscription,
      deleteSubscription,
      confirmSubscriptionSuggestion,
      dismissSubscriptionSuggestion,
      recordCategoryLearning,
      suggestCategoryForMerchant,
      saveDescriptionRule,
      deleteDescriptionRule,
      cleanTransactionDescription,
      checkIfLikelySubscription,
      importCsvTransactions,
      deleteCardImportedTransactions,
      refreshData,
      resetAllData,
      exportFullBackup,
      importFullBackup,
      partnershipSpace,
      isPartnershipActive,
      activatePartnership,
      joinPartnershipWithCode,
      updatePartnershipSettings,
      disconnectPartnership,
      activeViewedCardId,
      setActiveViewedCardId,
    }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance deve ser usado dentro de um FinanceProvider');
  }
  return context;
};
