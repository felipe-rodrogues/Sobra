import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Account, 
  Category, 
  Transaction, 
  Budget, 
  Goal, 
  PendingNotification,
  ParsedBankNotification,
  Subscription,
  CategoryRule,
  DescriptionRule,
  SubscriptionSuggestion,
  SubscriptionCadence,
  ActiveInstallmentGroup
} from '../core/types';
import { db } from '../database/adapter';
import { notificationListenerBridge } from '../native/notificationListener';
import { ParsedCsvRow } from '../core/parsers/csvParser';
import { categorizationEngine } from '../core/categorization/categorizationEngine';
import { merchantCleaner } from '../core/categorization/merchantCleaner';
import { recurrenceDetector } from '../core/subscriptions/recurrenceDetector';
import { generateInstallmentTransactions, getActiveInstallmentGroups } from '../core/installments/installmentHelper';

interface FinanceContextType {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
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

  // Ações de Metas
  saveGoal: (g: Omit<Goal, 'id' | 'createdAt'> & { id?: string }) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;

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
    defaultCategoryId?: string
  ) => Promise<number>;

  refreshData: () => Promise<void>;
  resetAllData: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [pendingNotifications, setPendingNotifications] = useState<PendingNotification[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);
  const [descriptionRules, setDescriptionRules] = useState<DescriptionRule[]>([]);
  const [subscriptionSuggestions, setSubscriptionSuggestions] = useState<SubscriptionSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [onlyRegisteredBanks, setOnlyRegisteredBanks] = useState(() => {
    return localStorage.getItem('sobra_only_registered_banks') !== 'false';
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

  const refreshData = useCallback(async () => {
    try {
      const [accs, cats, txs, bdgs, gls, notifs, subs, rules, dismissed, descRules] = await Promise.all([
        db.getAccounts(),
        db.getCategories(),
        db.getTransactions(),
        db.getBudgets(),
        db.getGoals(),
        db.getPendingNotifications(),
        db.getSubscriptions(),
        db.getCategoryRules(),
        db.getDismissedSubscriptionMerchants(),
        db.getDescriptionRules(),
      ]);

      setAccounts(accs);
      setCategories(cats);
      setTransactions(txs);
      setBudgets(bdgs);
      setGoals(gls);
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

    // 0. Filtro: Se o usuário optou por apenas bancos cadastrados
    const bankMatches = accs.some(a => 
      (parsed.bankId && a.bankId && a.bankId.toLowerCase() === parsed.bankId.toLowerCase()) ||
      (parsed.bankName && a.name.toLowerCase().includes(parsed.bankName.toLowerCase()))
    );

    // Se estiver com filtro ativado e não for banco cadastrado E não for SMS com oportunidade de cadastro:
    if (onlyRegisteredBanks && !bankMatches && !parsed.isFromSms) {
      console.log(`[Sobra] Notificação de banco não cadastrado descartada: ${parsed.bankName}`);
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

    // 2. Notificação Local no Android para PIX Recebido
    if (parsed.type === 'income' && parsed.paymentMethod === 'pix') {
      const formattedVal = parsed.amount.toFixed(2).replace('.', ',');
      notificationListenerBridge.sendLocalNotification(
        `Pix Recebido: R$ ${formattedVal}`,
        `Toque para confirmar o lançamento de entrada na conta ${parsed.bankName}.`
      );
    }

    // 3. Lançamento Direto na Fatura para Compras no Cartão de Crédito
    const isCreditCardPurchase = parsed.type === 'expense' && (parsed.paymentMethod === 'credit' || parsed.isInstallment);
    const isTargetAccCreditCard = suggestedAcc && suggestedAcc.type === 'credit_card';

    if (autoAddCreditToInvoice && isCreditCardPurchase && isTargetAccCreditCard) {
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
        await db.saveInstallmentTransactions(generated);
      } else {
        // Compra à vista lançada diretamente na fatura do mês
        await db.saveTransaction({
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      await db.savePendingNotification(pendingApproved);
      await refreshData();
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
      parsedPaymentMethod: parsed.paymentMethod,
      detectedBalance: parsed.detectedBalance,
      suggestedCategoryId: suggestedCat?.id,
      suggestedAccountId: suggestedAcc?.id,
      detectedAt: new Date().toISOString(),
      status: 'pending',
      isSuspectedDuplicate,
      duplicateReason,
      isInstallment: parsed.isInstallment,
      installmentCount: parsed.installmentCount,
      installmentAmount: parsed.installmentAmount,
      originalTotalAmount: parsed.originalTotalAmount,
      isFromSms: parsed.isFromSms,
    };

    await db.savePendingNotification(pending);
    await refreshData();
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

    const fullTx: Transaction = {
      ...tx,
      description: finalDescription,
      id: tx.id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: (tx as any).createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = await db.saveTransaction(fullTx);

    // Aprendizado simples com as correções/escolhas do usuário
    if (fullTx.description && fullTx.categoryId) {
      const rule = categorizationEngine.createRule(fullTx.description, fullTx.categoryId);
      await db.saveCategoryRule(rule);
    }

    // Se o usuário marcou para cadastrar/atualizar como assinatura recorrente
    if (asSubscription && fullTx.type === 'expense') {
      const existingSubs = await db.getSubscriptions();
      const normDesc = categorizationEngine.normalize(fullTx.description);
      const existingSub = existingSubs.find(s => {
        const normName = categorizationEngine.normalize(s.name);
        return normName === normDesc || normName.includes(normDesc) || normDesc.includes(normName);
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

    // Aprendizado da categoria
    if (params.description && params.categoryId) {
      const rule = categorizationEngine.createRule(params.description, params.categoryId);
      await db.saveCategoryRule(rule);
    }

    await refreshData();
    return saved;
  };

  const deleteInstallmentGroup = async (groupId: string) => {
    await db.deleteInstallmentGroup(groupId);
    await refreshData();
  };

  const deleteTransaction = async (id: string) => {
    await db.deleteTransaction(id);
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
    const fullGoal: Goal = {
      ...g,
      id: g.id || `g-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: (g as any).createdAt || new Date().toISOString(),
    };
    const saved = await db.saveGoal(fullGoal);
    await refreshData();
    return saved;
  };

  const deleteGoal = async (id: string) => {
    await db.deleteGoal(id);
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

  const simulateIncomingNotification = async (title: string, text: string, packageName = 'com.nu.production'): Promise<PendingNotification | null> => {
    const parsed = notificationListenerBridge.simulateNotification(title, text, packageName);
    if (!parsed) return null;
    return await processIncomingNotification(parsed, packageName);
  };

  // Ações de Assinaturas e Recorrências
  const saveSubscription = async (sub: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Subscription> => {
    const fullSub: Subscription = {
      ...sub,
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
    defaultCategoryId?: string
  ): Promise<number> => {
    let imported = 0;
    const fallbackCategory = defaultCategoryId || categories[0]?.id || 'cat-outros-desp';

    for (const row of rows) {
      const cleanedDesc = merchantCleaner.applyRules(row.description, descriptionRules).cleaned || row.description;
      const suggested = categorizationEngine.suggestCategory(cleanedDesc, categories, categoryRules);
      const catId = suggested ? suggested.id : fallbackCategory;

      await db.saveTransaction({
        id: `tx-csv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        accountId,
        categoryId: catId,
        amount: row.amount,
        type: row.type,
        description: cleanedDesc,
        date: `${row.date}T12:00:00.000Z`,
        status: 'confirmed',
        paymentMethod: row.paymentMethod,
        source: 'csv',
        notes: `Importado via extrato CSV: ${row.raw}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      imported++;
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
      approveNotification,
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
