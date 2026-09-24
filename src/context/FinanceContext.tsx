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
import { ParsedCsvRow } from '../core/parsers/csvParser';
import { categorizationEngine } from '../core/categorization/categorizationEngine';
import { merchantCleaner } from '../core/categorization/merchantCleaner';
import { recurrenceDetector } from '../core/subscriptions/recurrenceDetector';
import { 
  generateInstallmentTransactions, 
  getActiveInstallmentGroups, 
  addMonthsToDate,
  calculateInvoiceForMonth
} from '../core/installments/installmentHelper';
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
  broadcastSharedCardMemberLeft,
  fetchUserSharedAccounts,
  supabase,
  isSupabaseConfigured
} from '../services/supabase';

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
    tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    asSubscription?: { cadence: SubscriptionCadence; nextBillingDate?: string }
  ) => Promise<Transaction>;
  saveInstallmentPurchase: (params: {
    accountId: string;
    categoryId: string;
    description: string;
    totalAmount: number;
    installmentCount: number;
    startDate?: string;
    notes?: string;
  }) => Promise<Transaction[]>;
  deleteTransaction: (id: string) => Promise<void>;
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
  simulateIncomingNotification: (title: string, text: string, packageName?: string) => Promise<PendingNotification | null>;

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
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

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

      // Reconciliação e autocura automática para cartões de crédito que possuem transações no mês atual
      const reconciledAccs = accs.map(acc => {
        if (acc.type === 'credit_card') {
          const cardMonthData = calculateInvoiceForMonth(acc.id, txs, today.getMonth() + 1, today.getFullYear());
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

      // Migração suave de acc-carteira legado para Conta Principal
      const carteiraIdx = reconciledAccs.findIndex(a => a.id === 'acc-carteira');
      if (carteiraIdx >= 0) {
        const migrated: Account = {
          ...reconciledAccs[carteiraIdx],
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
          reconciledAccs[carteiraIdx] = migrated;
        } catch (err) {
          console.warn('Falha não crítica ao migrar Carteira:', err);
        }
      }

      // Garantir existência da "Conta Principal" padrão no sistema para receitas e pagamentos
      const hasCheckingOrValidAccount = reconciledAccs.some(a => a.type !== 'credit_card');
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
          reconciledAccs.unshift(defaultAccount);
        } catch (err) {
          console.warn('Falha não crítica ao auto-cadastrar Conta Principal padrão:', err);
        }
      }

      setAccounts(reconciledAccs);
      setCategories(cats);
      setTransactions(txs);
      setBudgets(bdgs);
      setGoals(goalsList);
      setGoalContributions(contribList);
      setPendingNotifications(notifs);
      setSubscriptions(subs);
      setCategoryRules(rules);
      setDescriptionRules(descRules || []);

      // Executa detecção local de recorrências sobre as transações existentes
      const suggestions = recurrenceDetector.detectRecurringSubscriptions(txs, subs, dismissed, cats);
      setSubscriptionSuggestions(suggestions);
    } catch (e) {
      console.error('Erro ao carregar dados do banco:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const processIncomingNotification = useCallback(async (parsed: ParsedBankNotification, pkg = ''): Promise<PendingNotification | null> => {
    const [cats, rules, accs, existingPending, txs, descRules] = await Promise.all([
      db.getCategories(),
      db.getCategoryRules(),
      db.getAccounts(),
      db.getPendingNotifications(),
      db.getTransactions(),
      db.getDescriptionRules(),
    ]);

    // 0. Identificação de Banco Cadastrado vs Novo Banco/Cartão
    const bankMatches = accs.some(a => 
      (parsed.bankId && a.bankId && a.bankId.toLowerCase() === parsed.bankId.toLowerCase()) ||
      (parsed.bankName && a.name.toLowerCase().includes(parsed.bankName.toLowerCase())) ||
      (parsed.cardLastDigits && a.lastDigits && a.lastDigits.trim() === parsed.cardLastDigits.trim())
    );

    const isUnregistered = !bankMatches;

    // Se o usuário optou por apenas bancos cadastrados E for uma notificação genérica/desconhecida:
    if (onlyRegisteredBanks && isUnregistered && parsed.bankId === 'generic' && !parsed.isFromSms) {
      console.log(`[Sobra] Notificação genérica de banco não cadastrado descartada: ${parsed.bankName}`);
      return null;
    }

    // 1. Descarte de re-post idêntico do sistema operacional (mesmo título e texto em menos de 10s)
    const now = Date.now();
    const isImmediateSystemDuplicate = existingPending.some(p => 
      p.rawTitle === parsed.rawTitle && 
      p.rawText === parsed.rawText &&
      (now - new Date(p.detectedAt).getTime()) < 10000
    );
    if (isImmediateSystemDuplicate) {
      return null;
    }

    const cleanedMerchant = merchantCleaner.applyRules(parsed.merchant, descRules || []).cleaned || parsed.merchant;
    const suggestedCat = categorizationEngine.suggestCategory(cleanedMerchant, cats, rules);
    const suggestedAcc = accs.find(a => 
      (parsed.bankId && a.bankId === parsed.bankId) ||
      a.name.toLowerCase().includes(parsed.bankName.toLowerCase()) || 
      (parsed.paymentMethod === 'credit' && a.type === 'credit_card')
    ) || accs[0];

    // 2. Lançamento Direto na Fatura para Compras no Cartão de Crédito de Banco Cadastrado
    const isCreditCardPurchase = parsed.type === 'expense' && (parsed.paymentMethod === 'credit' || parsed.isInstallment);
    const isTargetAccCreditCard = suggestedAcc && suggestedAcc.type === 'credit_card';

    if (!isUnregistered && autoAddCreditToInvoice && isCreditCardPurchase && isTargetAccCreditCard) {
      const pendingApproved: PendingNotification = {
        id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        bankPackage: pkg || parsed.bankId,
        bankName: parsed.bankName,
        bankId: parsed.bankId,
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
          notes: `Lançado diretamente na fatura (${parsed.installmentCount}x)`,
          source: 'notification',
        });
        createdTxId = generated[0]?.id;
        await db.saveInstallmentTransactions(generated);
        if (suggestedAcc.isShared) {
          syncAccountTransactionsToCloud(suggestedAcc.id, generated);
          generated.forEach(t => broadcastSharedTransaction(suggestedAcc.id, t, 'insert'));
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
          rawNotificationPayload: `${parsed.rawTitle} - ${parsed.rawText}`,
          notes: `Lançado diretamente na fatura do ${suggestedAcc.name}`,
          isShared: !!suggestedAcc.isShared,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        createdTxId = newDirectTx.id;
        await db.saveTransaction(newDirectTx);
        if (suggestedAcc.isShared) {
          broadcastSharedTransaction(suggestedAcc.id, newDirectTx, 'insert');
        }
      }

      pendingApproved.generatedTransactionId = createdTxId;
      await db.savePendingNotification(pendingApproved);
      await refreshData();

      // Dispara notificação local no Android confirmando inserção na fatura e permitindo edição com um toque
      const formattedVal = parsed.amount.toFixed(2).replace('.', ',');
      const cardName = suggestedAcc?.name || parsed.bankName;
      await notificationListenerBridge.sendLocalNotification({
        title: `💳 Compra no ${cardName}: R$ ${formattedVal}`,
        text: `${cleanedMerchant} lançada na fatura. Toque para editar ou conferir.`,
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

    if (matchingTx) {
      isSuspectedDuplicate = true;
      duplicateReason = `Cobrança de R$ ${parsed.amount.toFixed(2).replace('.', ',')} em "${matchingTx.description}" já foi registrada no extrato hoje.`;
    } else if (matchingPending) {
      isSuspectedDuplicate = true;
      duplicateReason = `Já existe outra notificação pendente idêntica de R$ ${parsed.amount.toFixed(2).replace('.', ',')} para "${matchingPending.parsedMerchant}".`;
    }

    const pending: PendingNotification = {
      id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      bankPackage: pkg || parsed.bankId,
      bankName: parsed.bankName,
      bankId: parsed.bankId,
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
    };

    await db.savePendingNotification(pending);
    await refreshData();

    const formattedVal = parsed.amount.toFixed(2).replace('.', ',');

    if (isUnregistered) {
      // 1. Compra de banco ou cartão ainda não cadastrado no app
      await notificationListenerBridge.sendLocalNotification({
        title: `💳 Novo cartão detectado: ${parsed.bankName}`,
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
        text: `${cleanedMerchant} (${parsed.bankName}). Toque para confirmar o lançamento como receita.`,
        notificationId: pending.id,
        amount: parsed.amount,
        merchant: cleanedMerchant,
        bankName: parsed.bankName,
        rawText: parsed.rawText,
        rawTitle: parsed.rawTitle,
        packageName: pkg,
        type: 'income',
      });
    } else if (parsed.type === 'expense') {
      // 8. Despesa/compra que aguarda aprovação manual
      await notificationListenerBridge.sendLocalNotification({
        title: `💳 Compra detectada: R$ ${formattedVal}`,
        text: `${cleanedMerchant} (${parsed.bankName}). Toque para revisar e lançar no cartão.`,
        notificationId: pending.id,
        amount: parsed.amount,
        merchant: cleanedMerchant,
        bankName: parsed.bankName,
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
              const isDifferent =
                remoteMembers.length !== currentMembers.length ||
                remoteMembers.some(rm => !currentMembers.some(cm => cm.userId === rm.userId));
              if (isDifferent) {
                const updatedAcc: Account = { ...acc, sharedMembers: remoteMembers };
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

              // 2.1 Adiciona transações remotas que faltam localmente
              for (const rtx of remoteTxs) {
                const exists = currentDbTxs.some(t => t.id === rtx.id);
                if (!exists) {
                  await db.saveTransaction(rtx);
                  hasChanges = true;
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

            // Importa cartões compartilhados válidos que faltam (ex: parceiro recém-conectado)
            for (const rInv of validSharedAccs) {
              const hasLocal = currentDbAccounts.some(a => a.id === rInv.accountId);
              if (!hasLocal) {
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
              await db.deleteTransaction(targetId);
              await refreshData();
            }
          } else if (event.action === 'batch_refresh') {
            await syncSharedData();
          } else if (event.transaction) {
            // Evita reprocessar transação se já existir com o mesmo carimbo de atualização
            const existing = await db.getTransaction(event.transaction.id);
            if (!existing || existing.updatedAt !== event.transaction.updatedAt) {
              await db.saveTransaction(event.transaction);
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
            if (!currentMembers.some(m => m.userId === memberEvent.member.userId)) {
              const updated = {
                ...acc,
                sharedMembers: [...currentMembers, memberEvent.member],
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
      }
    );

    return () => unsubscribe();
  }, [sharedAccountIdsKey, refreshData, partnershipSpace, user?.id]);

  // Inscrição dedicada ao canal do Espaço Finanças a Dois (Broadcasting de Pareamento e Cartões)
  useEffect(() => {
    if (!partnershipSpace?.code || !partnershipSpace.isActive) return;

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
        } else if (event === 'card_added' && eventPayload.card) {
          const accs = await db.getAccounts();
          const acc = accs.find(a => a.id === eventPayload.card.id);
          if (!acc) {
            await db.saveAccount(eventPayload.card);
            const remoteTxs = await fetchSharedTransactions(eventPayload.card.id);
            for (const tx of remoteTxs) {
              await db.saveTransaction({ ...tx, isShared: true });
            }
            await refreshData();
          }
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
    tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    asSubscription?: { cadence: SubscriptionCadence; nextBillingDate?: string }
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

    let createdById = tx.createdById;
    let createdByName = tx.createdByName;

    if (isSharedAccount && !createdByName) {
      const currentProfile = await getCurrentUserProfile();
      if (currentProfile) {
        createdById = currentProfile.id;
        createdByName = currentProfile.displayName;
      }
    }

    const fullTx: Transaction = {
      ...tx,
      description: finalDescription,
      id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      isShared: isSharedAccount || tx.isShared,
      createdById,
      createdByName,
      createdAt: (tx as any).createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await db.saveTransaction(fullTx);

    // Se for conta compartilhada, faz broadcast em tempo real para os outros aparelhos
    if (isSharedAccount) {
      broadcastSharedTransaction(fullTx.accountId, fullTx, 'insert');
    }

    // Aprendizado simples com as correções/escolhas do usuário
    if (fullTx.description && fullTx.categoryId) {
      const rule = categorizationEngine.createRule(fullTx.description, fullTx.categoryId);
      await db.saveCategoryRule(rule);
    }

    // Se o usuário marcou para cadastrar/atualizar como assinatura ou receita recorrente
    if (asSubscription) {
      const existingSubs = await db.getSubscriptions();
      const normDesc = categorizationEngine.normalize(fullTx.description);
      const existingSub = existingSubs.find(s => {
        const normName = categorizationEngine.normalize(s.name);
        const matchType = s.type ? s.type === fullTx.type : fullTx.type === 'expense';
        return matchType && (normName === normDesc || normName.includes(normDesc) || normDesc.includes(normName));
      });

      const nextBilling = asSubscription.nextBillingDate || (() => {
        const d = new Date(fullTx.date);
        if (asSubscription.cadence === 'monthly') d.setDate(d.getDate() + 30);
        else d.setFullYear(d.getFullYear() + 1);
        return d.toISOString().substring(0, 10);
      })();

      if (existingSub) {
        await db.saveSubscription({
          ...existingSub,
          type: fullTx.type === 'income' ? 'income' : 'expense',
          amount: fullTx.amount,
          categoryId: fullTx.categoryId,
          accountId: fullTx.accountId,
          cadence: asSubscription.cadence,
          nextBillingDate: nextBilling,
          status: 'active',
          lastChargeDate: fullTx.date,
          previousAmount: existingSub.amount !== fullTx.amount ? existingSub.amount : existingSub.previousAmount,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await db.saveSubscription({
          id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: fullTx.description,
          type: fullTx.type === 'income' ? 'income' : 'expense',
          amount: fullTx.amount,
          categoryId: fullTx.categoryId,
          accountId: fullTx.accountId,
          cadence: asSubscription.cadence,
          nextBillingDate: nextBilling,
          status: 'active',
          lastChargeDate: fullTx.date,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
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
    notes?: string;
  }) => {
    const card = accounts.find(a => a.id === params.accountId);
    const generated = generateInstallmentTransactions({
      accountId: params.accountId,
      categoryId: params.categoryId,
      description: params.description,
      totalAmount: params.totalAmount,
      installmentCount: params.installmentCount,
      startDate: params.startDate,
      notes: params.notes,
      card,
      source: 'manual',
    });

    const saved = await db.saveInstallmentTransactions(generated);

    // Se o cartão for compartilhado, sincroniza todas as parcelas na nuvem
    if (card?.isShared && saved.length > 0) {
      syncAccountTransactionsToCloud(card.id, saved);
      saved.forEach(tx => broadcastSharedTransaction(card.id, tx, 'insert'));
    }

    // Aprendizado da categoria
    if (params.description && params.categoryId) {
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
      groupTxs.forEach(tx => broadcastSharedTransaction(targetAccount.id, tx, 'delete'));
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

    await db.deleteTransaction(id);

    if (tx && isSharedAccount) {
      broadcastSharedTransaction(tx.accountId, tx, 'delete');
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

  // Contas
  const saveAccount = async (acc: Omit<Account, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const fullAcc: Account = {
      ...acc,
      id: acc.id || `acc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: (acc as any).createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await db.saveAccount(fullAcc);
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
        await broadcastSharedCardDelete(id, partnershipSpace?.code);
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
    await refreshData();
    return saved;
  };

  const deleteBudget = async (id: string) => {
    await db.deleteBudget(id);
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
      await db.saveGoalContribution({
        id: `contrib-initial-${fullGoal.id}`,
        goalId: fullGoal.id,
        amount: fullGoal.currentAmount,
        date: new Date().toISOString().substring(0, 10),
        isAutomatic: false,
        note: 'Saldo inicial da meta',
        createdAt: new Date().toISOString(),
      });
    }

    await refreshData();
    return saved;
  };

  const deleteGoal = async (id: string) => {
    await db.deleteGoal(id);
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
    if (targetGoal) {
      const newCurrentAmount = Math.round((targetGoal.currentAmount + contribution.amount) * 100) / 100;
      await db.saveGoal({
        ...targetGoal,
        currentAmount: newCurrentAmount,
        isCompleted: newCurrentAmount >= targetGoal.targetAmount,
      });
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
    if (targetGoal) {
      const newCurrentAmount = Math.max(0, Math.round((targetGoal.currentAmount + diff) * 100) / 100);
      await db.saveGoal({
        ...targetGoal,
        currentAmount: newCurrentAmount,
        isCompleted: newCurrentAmount >= targetGoal.targetAmount,
      });
    }

    await refreshData();
    return saved;
  };

  const deleteGoalContribution = async (id: string) => {
    const existing = goalContributions.find(c => c.id === id);
    if (existing) {
      await db.deleteGoalContribution(id);
      const targetGoal = goals.find(g => g.id === existing.goalId);
      if (targetGoal) {
        const newCurrentAmount = Math.max(0, Math.round((targetGoal.currentAmount - existing.amount) * 100) / 100);
        await db.saveGoal({
          ...targetGoal,
          currentAmount: newCurrentAmount,
          isCompleted: newCurrentAmount >= targetGoal.targetAmount,
        });
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
    const pending = pendingNotifications.find(p => p.id === pendingId);
    
    // 1. Criar transação definitiva (ou compras parceladas se for o caso)
    if (confirmedData.isInstallment && confirmedData.installmentCount && confirmedData.installmentCount > 1) {
      await saveInstallmentPurchase({
        accountId: confirmedData.accountId,
        categoryId: confirmedData.categoryId,
        description: confirmedData.description,
        totalAmount: confirmedData.amount,
        installmentCount: confirmedData.installmentCount,
        startDate: confirmedData.date,
        notes: `Detectado via notificação do ${pending?.bankName || 'Banco'}`,
      });
    } else {
      await saveTransaction({
        accountId: confirmedData.accountId,
        categoryId: confirmedData.categoryId,
        amount: confirmedData.amount,
        type: confirmedData.type,
        description: confirmedData.description,
        date: confirmedData.date,
        status: 'confirmed',
        paymentMethod: confirmedData.paymentMethod,
        source: 'notification',
        rawNotificationPayload: pending ? `${pending.rawTitle} - ${pending.rawText}` : null,
        notes: `Detectado automaticamente do ${pending?.bankName || 'Banco'}`,
      }, confirmedData.asSubscription);
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

  const simulateIncomingNotification = async (title: string, text: string, packageName = 'com.nu.production'): Promise<PendingNotification | null> => {
    const parsed = notificationListenerBridge.simulateNotification(title, text, packageName);
    if (!parsed) return null;
    return await processIncomingNotification(parsed, packageName);
  };

  // Ações de Assinaturas e Recorrências
  const saveSubscription = async (sub: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Subscription> => {
    const targetAccount = accounts.find(a => a.id === sub.accountId);
    const isTargetAccountShared = Boolean(targetAccount?.isShared);
    const fullSub: Subscription = {
      ...sub,
      isShared: sub.isShared !== undefined ? sub.isShared : (isTargetAccountShared ? true : undefined),
      id: sub.id || `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: (sub as any).createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await db.saveSubscription(fullSub);
    await refreshData();
    return saved;
  };

  const deleteSubscription = async (id: string): Promise<void> => {
    await db.deleteSubscription(id);
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
        const groupId = `inst-csv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const baseDate = new Date(`${row.date}T12:00:00.000Z`);
        const totalAmount = Math.round(row.amount * totalNum * 100) / 100;
        const nowIso = new Date().toISOString();

        // Salva a parcela atual constante no CSV
        const mainTx: Transaction = {
          id: `tx-csv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          accountId,
          categoryId: catId,
          amount: row.amount,
          type: row.type,
          description: `${cleanedDesc} (${curNum}/${totalNum})`,
          date: baseDate.toISOString(),
          status: 'confirmed',
          paymentMethod: isTargetCard ? 'credit' : (row.paymentMethod || 'other'),
          source: 'csv',
          notes: `Importado via extrato CSV: ${row.raw}`,
          isInstallment: true,
          installmentGroupId: groupId,
          installmentNumber: curNum,
          installmentTotal: totalNum,
          originalTotalAmount: totalAmount,
          isShared: isSharedAccount,
          createdById: currentProfile?.id,
          createdByName: currentProfile?.displayName,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await db.saveTransaction(mainTx);
        allImportedTxs.push(mainTx);
        imported++;

        // Se solicitado projeção de parcelas futuras e ainda restam parcelas
        if (projectFutureInstallments && curNum < totalNum) {
          const futureTxs: Transaction[] = [];
          for (let nextI = curNum + 1; nextI <= totalNum; nextI++) {
            const monthsAhead = nextI - curNum;
            const parcelDate = addMonthsToDate(baseDate, monthsAhead);
            futureTxs.push({
              id: `tx-inst-${groupId}-${nextI}`,
              accountId,
              categoryId: catId,
              amount: row.amount,
              type: 'expense',
              description: `${cleanedDesc} (${nextI}/${totalNum})`,
              date: parcelDate.toISOString(),
              status: 'confirmed',
              paymentMethod: isTargetCard ? 'credit' : 'other',
              source: 'csv',
              notes: `Parcela futura projetada (${nextI}/${totalNum}) a partir de importação CSV`,
              isInstallment: true,
              installmentGroupId: groupId,
              installmentNumber: nextI,
              installmentTotal: totalNum,
              originalTotalAmount: totalAmount,
              isShared: isSharedAccount,
              createdById: currentProfile?.id,
              createdByName: currentProfile?.displayName,
              createdAt: nowIso,
              updatedAt: nowIso,
            });
          }
          if (futureTxs.length > 0) {
            await db.saveInstallmentTransactions(futureTxs);
            allImportedTxs.push(...futureTxs);
            imported += futureTxs.length;
          }
        }
      } else {
        // Transação avulsa normal
        const simpleTx: Transaction = {
          id: `tx-csv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          accountId,
          categoryId: catId,
          amount: row.amount,
          type: row.type,
          description: cleanedDesc,
          date: `${row.date}T12:00:00.000Z`,
          status: 'confirmed',
          paymentMethod: isTargetCard ? 'credit' : (row.paymentMethod || 'other'),
          source: 'csv',
          notes: `Importado via extrato CSV: ${row.raw}`,
          isRefund: row.isRefund,
          isShared: isSharedAccount,
          createdById: currentProfile?.id,
          createdByName: currentProfile?.displayName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await db.saveTransaction(simpleTx);
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

  const activeInstallmentGroups = useMemo(() => {
    return getActiveInstallmentGroups(transactions);
  }, [transactions]);

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
