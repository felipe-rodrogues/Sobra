import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { notificationListenerBridge, NotificationTapPayload } from './native/notificationListener';
import { useTheme } from './context/ThemeContext';
import { useFinance } from './context/FinanceContext';
import { useAuth } from './context/AuthContext';
import { DashboardScreen } from './screens/DashboardScreen';
import { TransactionsScreen } from './screens/TransactionsScreen';
import { AccountsScreen } from './screens/AccountsScreen';
import { BudgetsScreen } from './screens/BudgetsScreen';
import { NotificationDetectorScreen } from './screens/NotificationDetectorScreen';
import { SubscriptionsScreen } from './screens/SubscriptionsScreen';
import { MoreScreen } from './screens/MoreScreen';
import { CardAccountFormScreen } from './screens/CardAccountFormScreen';
import { CategoriesScreen } from './screens/CategoriesScreen';
import { DailyBudgetGoalScreen, DailySpendingGoal } from './screens/DailyBudgetGoalScreen';
import { GoalDetailScreen } from './screens/GoalDetailScreen';
import { PartnershipHubScreen } from './screens/PartnershipHubScreen';

import { TransactionModal } from './components/modals/TransactionModal';
import { NotificationReviewModal } from './components/modals/NotificationReviewModal';
import { CsvImportModal } from './components/modals/CsvImportModal';
import { BudgetModal } from './components/modals/BudgetModal';
import { AccountModal } from './components/modals/AccountModal';
import { TransferModal } from './components/modals/TransferModal';
import { GoalModal } from './components/modals/GoalModal';
import { SubscriptionModal } from './components/modals/SubscriptionModal';
import { CategoryModal } from './components/modals/CategoryModal';
import { SobraAiChatModal } from './components/modals/SobraAiChatModal';
import { BurnRateProjectionModal } from './components/modals/BurnRateProjectionModal';
import { QuickNewActionModal } from './components/modals/QuickNewActionModal';
import { AuthModal } from './components/modals/AuthModal';
import { OfflineWarningModal } from './components/modals/OfflineWarningModal';
import { PermissionsSetupModal, PERMISSIONS_SETUP_KEY } from './components/modals/PermissionsSetupModal';
import { StartupSplashScreen } from './components/common/StartupSplashScreen';
import { SobiFloatingButton } from './components/common/SobiFloatingButton';
import { sobraAiEngine } from './core/ai/sobraAiEngine';
import { SobraAction } from './core/ai/types';
import { calculateBurnRateProjection } from './core/calculations';
import { SmartNotificationService } from './core/notifications/smartNotificationService';
import { backNavigationManager, useBackHandler, BACK_PRIORITY } from './core/navigation/backNavigation';

import { 
  Home, 
  ArrowLeftRight, 
  Target, 
  SlidersHorizontal,
  Plus, 
  ArrowLeft
} from 'lucide-react';
import { Transaction, Subscription, Account, Category, Budget, Goal, AccountType, PendingNotification } from './core/types';
import { db } from './database/adapter';

export const App: React.FC = () => {
  const { colors, mode } = useTheme();
  const { 
    accounts, 
    categories, 
    transactions, 
    budgets, 
    goals, 
    subscriptions, 
    pendingNotifications, 
    subscriptionSuggestions,
    isPrivacyMode,
    deleteBudget,
    deleteGoal,
    isLoading: isFinanceLoading,
  } = useFinance();
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    authModalOptions, 
    isOfflineWarningModalOpen, 
    isLoading: isAuthLoading 
  } = useAuth();

  // Animação de Inicialização Oficial (Splash Screen)
  const [isSplashActive, setIsSplashActive] = useState(true);

  // Modal da 2ª tela: Autorizações e Primeiras Configurações do App
  const [isPermissionsSetupOpen, setIsPermissionsSetupOpen] = useState(false);

  // Exibe a 2ª tela de autorizações e permissões logo após a tela de login inicial
  useEffect(() => {
    // Se a animação de inicialização ou autenticação ainda estão rodando, aguarda
    if (isSplashActive || isAuthLoading || isAuthModalOpen || isOfflineWarningModalOpen) return;

    // Se o usuário ainda não completou a configuração inicial de permissões
    const isCompleted = localStorage.getItem(PERMISSIONS_SETUP_KEY) === 'true';
    if (!isCompleted) {
      const timer = setTimeout(() => {
        setIsPermissionsSetupOpen(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isSplashActive, isAuthLoading, isAuthModalOpen, isOfflineWarningModalOpen]);

  // Tabs do app: 'dashboard' (Início), 'transactions' (Transações), 'budgets' (Planejamento), 'more' (Mais)
  // Subtelas: 'accounts', 'subscriptions', 'notifications', 'categories', 'daily_goal', 'goal_detail', 'partnership'
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'transactions' | 'budgets' | 'more' | 'accounts' | 'subscriptions' | 'notifications' | 'categories' | 'daily_goal' | 'goal_detail' | 'partnership'
  >('dashboard');

  // Rastreia se alguma subtela ou modal interno do Dashboard está aberto (ex: Faturas e Cartões)
  const [isDashboardModalOpen, setIsDashboardModalOpen] = useState(false);
  const dashboardResetRef = useRef<(() => void) | null>(null);

  // Mapeamento dinâmico de retorno para subtelas (preserva se o usuário abriu do Início ou do Mais)
  const [subscreenReturnTab, setSubscreenReturnTab] = useState<Record<string, 'dashboard' | 'transactions' | 'budgets' | 'more'>>({
    notifications: 'dashboard',
    accounts: 'more',
    subscriptions: 'more',
    categories: 'more',
    daily_goal: 'budgets',
    goal_detail: 'budgets',
    partnership: 'more',
  });

  // Histórico ordenado de navegação entre telas
  const screenHistoryRef = useRef<string[]>(['dashboard']);

  const handleNavigateToTab = (
    tab: 'dashboard' | 'transactions' | 'budgets' | 'more' | 'accounts' | 'subscriptions' | 'notifications' | 'categories' | 'daily_goal' | 'goal_detail' | 'partnership',
    fromTab?: 'dashboard' | 'transactions' | 'budgets' | 'more'
  ) => {
    // Fecha quaisquer modais ou sobreposições abertas ao navegar pelas abas
    setIsBurnRateModalOpen(false);
    setIsSobraAiModalOpen(false);
    setIsSobraAiChatOpen(false);
    setIsQuickActionModalOpen(false);
    setIsTransactionModalOpen(false);
    setIsBudgetModalOpen(false);
    setIsGoalModalOpen(false);
    setIsCategoryModalOpen(false);
    setIsSubscriptionModalOpen(false);
    setIsReviewModalOpen(false);
    setIsCsvModalOpen(false);
    setIsTransferModalOpen(false);

    if (tab !== 'daily_goal') {
      setReturnToProjectionFromDailyGoal(false);
      setActivePlanningCadence('weekly');
    }

    const origin = fromTab || (['dashboard', 'transactions', 'budgets', 'more'].includes(activeTab) ? (activeTab as any) : 'dashboard');
    if (['notifications', 'accounts', 'subscriptions', 'categories', 'daily_goal', 'goal_detail', 'partnership'].includes(tab)) {
      setSubscreenReturnTab(prev => ({
        ...prev,
        [tab]: origin,
      }));
    }

    // Se navegando para o Início ou alternando abas, fecha os modais/subtelas do Dashboard (ex: Faturas e Cartões)
    if (dashboardResetRef.current) {
      dashboardResetRef.current();
    }

    if (tab === 'dashboard') {
      screenHistoryRef.current = ['dashboard'];
    } else if (tab !== activeTab) {
      const history = screenHistoryRef.current;
      if (history[history.length - 1] !== tab) {
        history.push(tab);
      }
    }

    setActiveTab(tab);
  };

  // Garante que a transição entre abas/telas sempre role a tela para o topo absoluto
  useEffect(() => {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [activeTab]);

  // Modais de Ação
  const [isQuickActionModalOpen, setIsQuickActionModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionModalDefaultType, setTransactionModalDefaultType] = useState<'expense' | 'income'>('expense');
  const [transactionModalDefaultAccountId, setTransactionModalDefaultAccountId] = useState<string | undefined>(undefined);

  const handleOpenNewTransaction = (type: 'expense' | 'income' = 'expense', defaultAccountId?: string) => {
    setEditingTransaction(null);
    setTransactionModalDefaultType(type);
    setTransactionModalDefaultAccountId(defaultAccountId);
    setIsTransactionModalOpen(true);
  };
  
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingNotificationId, setReviewingNotificationId] = useState<string | null>(null);

  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountModalInitialBankId, setAccountModalInitialBankId] = useState<string | undefined>(undefined);

  // Subtela Dedicada de Adicionar / Editar Cartão e Conta (Estilo Pierre)
  const [cardIdToReopen, setCardIdToReopen] = useState<string | null>(null);
  const [accountFormScreenData, setAccountFormScreenData] = useState<{
    isOpen: boolean;
    accountToEdit?: Account | null;
    initialBankId?: string;
    defaultType?: AccountType;
    returnTab: string;
    initialLastDigits?: string;
    pendingNotificationToLink?: PendingNotification | null;
    fromPartnership?: boolean;
    initialIsShared?: boolean;
    returnToCardId?: string;
  } | null>(null);

  const handleOpenAccountForm = useCallback((options?: {
    account?: Account | null;
    initialBankId?: string;
    defaultType?: AccountType;
    returnTab?: string;
    initialLastDigits?: string;
    pendingNotificationToLink?: PendingNotification | null;
    fromPartnership?: boolean;
    initialIsShared?: boolean;
    returnToCardId?: string;
  }) => {
    setAccountFormScreenData({
      isOpen: true,
      accountToEdit: options?.account || null,
      initialBankId: options?.initialBankId,
      defaultType: options?.defaultType || 'credit_card',
      returnTab: options?.returnTab || activeTab,
      initialLastDigits: options?.initialLastDigits,
      pendingNotificationToLink: options?.pendingNotificationToLink || null,
      fromPartnership: options?.fromPartnership,
      initialIsShared: options?.initialIsShared,
      returnToCardId: options?.returnToCardId,
    });
  }, [activeTab]);

  const handleCloseAccountForm = () => {
    setAccountFormScreenData(null);
  };

  const pendingTapRef = useRef<NotificationTapPayload | null>(null);

  // Redirecionamento direto ao clicar em notificação de compra, novo cartão ou receita do app
  const handleOpenTransactionFromNotification = useCallback((payload: NotificationTapPayload): boolean => {
    if (!payload) return false;

    // 1. Tenta encontrar diretamente pelo ID da transação
    if (payload.transactionId) {
      const found = transactions.find(t => t.id === payload.transactionId);
      if (found) {
        setEditingTransaction(found);
        setIsTransactionModalOpen(true);
        return true;
      }
      // Se não encontrou no estado em memória (ex: cold start), busca direto no banco
      db.getTransaction(payload.transactionId).then(dbTx => {
        if (dbTx) {
          setEditingTransaction(dbTx);
          setIsTransactionModalOpen(true);
        }
      }).catch(() => {});
    }

    // 2. Tenta encontrar por notificationId
    if (payload.notificationId) {
      const pendingFound = pendingNotifications.find(p => p.id === payload.notificationId);
      if (pendingFound) {
        if (pendingFound.generatedTransactionId) {
          const tx = transactions.find(t => t.id === pendingFound.generatedTransactionId);
          if (tx) {
            setEditingTransaction(tx);
            setIsTransactionModalOpen(true);
            return true;
          }
          db.getTransaction(pendingFound.generatedTransactionId).then(dbTx => {
            if (dbTx) {
              setEditingTransaction(dbTx);
              setIsTransactionModalOpen(true);
            }
          }).catch(() => {});
        }
        if (pendingFound.requiresAccountRegistration) {
          handleOpenAccountForm({
            initialBankId: pendingFound.bankId,
            defaultType: pendingFound.parsedPaymentMethod === 'credit' || pendingFound.isInstallment ? 'credit_card' : 'checking',
            initialLastDigits: pendingFound.cardLastDigits,
            pendingNotificationToLink: pendingFound,
          });
          return true;
        }
        setReviewingNotificationId(pendingFound.id);
        setIsReviewModalOpen(true);
        return true;
      }
    }

    // 2.1 Se é um banco/cartão não cadastrado e não encontramos a pendência em memória
    if (payload.requiresAccountRegistration) {
      handleOpenAccountForm({
        initialBankId: payload.bankName,
        defaultType: 'credit_card',
      });
      return true;
    }

    // 3. Fallback inteligente: buscar transação correspondente a valor e estabelecimento
    if (payload.amount && payload.amount > 0) {
      const normalizedMerchant = (payload.merchant || '').toLowerCase().trim();
      const recentMatch = transactions.find(t => {
        const sameAmount = Math.abs(t.amount - payload.amount!) < 0.01;
        const tDesc = (t.description || '').toLowerCase();
        const sameMerchant = !normalizedMerchant || tDesc.includes(normalizedMerchant) || normalizedMerchant.includes(tDesc);
        return sameAmount && sameMerchant;
      });
      if (recentMatch) {
        setEditingTransaction(recentMatch);
        setIsTransactionModalOpen(true);
        return true;
      }
    }

    // 4. Se não achou nas transações confirmadas, checa se tem pendência ativa correspondente
    if (payload.rawText) {
      const pendingMatch = pendingNotifications.find(p => p.rawText === payload.rawText);
      if (pendingMatch) {
        if (pendingMatch.requiresAccountRegistration) {
          handleOpenAccountForm({
            initialBankId: pendingMatch.bankId,
            defaultType: pendingMatch.parsedPaymentMethod === 'credit' || pendingMatch.isInstallment ? 'credit_card' : 'checking',
            initialLastDigits: pendingMatch.cardLastDigits,
            pendingNotificationToLink: pendingMatch,
          });
          return true;
        }
        setReviewingNotificationId(pendingMatch.id);
        setIsReviewModalOpen(true);
        return true;
      }
    }

    // 5. Fallback para receitas ou despesas pendentes gerais
    if (payload.type === 'income' && pendingNotifications.length > 0) {
      const incomePending = pendingNotifications.find(p => p.parsedType === 'income');
      if (incomePending) {
        setReviewingNotificationId(incomePending.id);
        setIsReviewModalOpen(true);
        return true;
      }
    }

    return false;
  }, [transactions, pendingNotifications, handleOpenAccountForm]);

  // Registra ouvinte para cliques em notificações com app aberto/em segundo plano
  useEffect(() => {
    const unsub = notificationListenerBridge.onNotificationTapped((tap) => {
      const handled = handleOpenTransactionFromNotification(tap);
      if (!handled) {
        pendingTapRef.current = tap;
      }
    });
    return unsub;
  }, [handleOpenTransactionFromNotification]);

  // Checa se o app foi aberto diretamente pelo clique em uma notificação nativa ao iniciar
  useEffect(() => {
    notificationListenerBridge.getPendingNotificationTap().then(tap => {
      if (tap) {
        const handled = handleOpenTransactionFromNotification(tap);
        if (!handled) {
          pendingTapRef.current = tap;
        }
      }
    });
  }, [handleOpenTransactionFromNotification]);

  // Se havia um clique pendente aguardando carregamento de transações ou pendências
  useEffect(() => {
    if (pendingTapRef.current) {
      const handled = handleOpenTransactionFromNotification(pendingTapRef.current);
      if (handled) {
        pendingTapRef.current = null;
      }
    }
  }, [transactions, pendingNotifications, handleOpenTransactionFromNotification]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [selectedGoalIdForDetail, setSelectedGoalIdForDetail] = useState<string | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [modalInitialIsShared, setModalInitialIsShared] = useState(false);

  const [isSobraAiChatOpen, setIsSobraAiChatOpen] = useState(false);
  const [sobraAiChatPrompt, setSobraAiChatPrompt] = useState<string | undefined>(undefined);
  const [sobraAiInitialTab, setSobraAiInitialTab] = useState<'chat' | 'report'>('chat');

  const handleOpenAiChat = (prompt?: string) => {
    setSobraAiInitialTab('chat');
    setSobraAiChatPrompt(prompt);
    setIsSobraAiChatOpen(true);
  };

  const handleOpenRelatorios = () => {
    setSobraAiInitialTab('report');
    setIsSobraAiChatOpen(true);
  };

  const [isSobraAiModalOpen, setIsSobraAiModalOpen] = useState(false);
  const [isBurnRateModalOpen, setIsBurnRateModalOpen] = useState(false);
  const [returnToProjectionFromDailyGoal, setReturnToProjectionFromDailyGoal] = useState(false);
  // Cadência de inspeção ativa durante o planejamento (sempre 'weekly' por padrão)
  const [activePlanningCadence, setActivePlanningCadence] = useState<'daily' | 'weekly'>('weekly');

  const sobraAiDiagnosis = React.useMemo(() => {
    return sobraAiEngine.generateFullDiagnosis(
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      subscriptions,
      new Date()
    );
  }, [accounts, categories, transactions, budgets, goals, subscriptions]);

  const burnRateProjection = React.useMemo(() => {
    return calculateBurnRateProjection(transactions, new Date(), accounts);
  }, [transactions, accounts]);

  // Gestão de Meta Diária de Gastos compartilhada no app
  const currentNow = new Date();
  const dailyGoalStorageKey = `sobra_daily_budget_goal_v1_${currentNow.getFullYear()}_${currentNow.getMonth() + 1}`;

  const [dailyGoal, setDailyGoal] = useState<DailySpendingGoal | null>(() => {
    try {
      const saved = localStorage.getItem(dailyGoalStorageKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleSaveDailyGoal = (goal: DailySpendingGoal) => {
    setDailyGoal(goal);
    try {
      localStorage.setItem(dailyGoalStorageKey, JSON.stringify(goal));
    } catch {}
  };

  const handleRemoveDailyGoal = () => {
    setDailyGoal(null);
    try {
      localStorage.removeItem(dailyGoalStorageKey);
    } catch {}
  };

  const handleExecuteSobraAiAction = (action: SobraAction) => {
    if (action.target === 'burn_rate' || action.label === 'Ver Projeção') {
      setIsBurnRateModalOpen(true);
    } else if (action.actionType === 'navigate_tab') {
      handleNavigateToTab(action.target as any);
    }
  };

  const pendingReviewNotification = pendingNotifications.find(n => n.id === reviewingNotificationId) || pendingNotifications[0] || null;

  const handleOpenReviewNotification = (id: string) => {
    const notif = pendingNotifications.find(n => n.id === id);
    if (notif?.generatedTransactionId) {
      const tx = transactions.find(t => t.id === notif.generatedTransactionId);
      if (tx) {
        setEditingTransaction(tx);
        setIsTransactionModalOpen(true);
        return;
      }
      db.getTransaction(notif.generatedTransactionId).then(dbTx => {
        if (dbTx) {
          setEditingTransaction(dbTx);
          setIsTransactionModalOpen(true);
        } else {
          setReviewingNotificationId(id);
          setIsReviewModalOpen(true);
        }
      }).catch(() => {
        setReviewingNotificationId(id);
        setIsReviewModalOpen(true);
      });
      return;
    }
    setReviewingNotificationId(id);
    setIsReviewModalOpen(true);
  };


  // Registra cada modal aberto no App no gerenciador universal de volta (Android/Gestos/Hardware)
  useBackHandler({
    id: 'account_form_screen',
    onBack: () => {
      const returnTab = accountFormScreenData?.returnTab;
      const returnToCardId = accountFormScreenData?.returnToCardId;
      handleCloseAccountForm();
      if (returnTab) setActiveTab(returnTab as any);
      if (returnToCardId) {
        setCardIdToReopen(returnToCardId);
      }
      return true;
    },
    enabled: Boolean(accountFormScreenData?.isOpen),
    priority: BACK_PRIORITY.OVERLAY_SCREEN,
  });

  useBackHandler({
    id: 'app_quick_action_modal',
    onBack: () => {
      setIsQuickActionModalOpen(false);
      return true;
    },
    enabled: isQuickActionModalOpen,
    priority: BACK_PRIORITY.MODAL,
  });

  useBackHandler({
    id: 'app_transaction_modal',
    onBack: () => {
      setIsTransactionModalOpen(false);
      setEditingTransaction(null);
      setTransactionModalDefaultAccountId(undefined);
      return true;
    },
    enabled: isTransactionModalOpen,
    priority: BACK_PRIORITY.MODAL,
  });

  useBackHandler({
    id: 'app_review_modal',
    onBack: () => {
      setIsReviewModalOpen(false);
      setReviewingNotificationId(null);
      return true;
    },
    enabled: isReviewModalOpen,
    priority: BACK_PRIORITY.MODAL,
  });

  useBackHandler({
    id: 'app_csv_modal',
    onBack: () => {
      setIsCsvModalOpen(false);
      return true;
    },
    enabled: isCsvModalOpen,
    priority: BACK_PRIORITY.MODAL,
  });

  useBackHandler({
    id: 'app_budget_modal',
    onBack: () => {
      setIsBudgetModalOpen(false);
      setEditingBudget(null);
      setModalInitialIsShared(false);
      return true;
    },
    enabled: isBudgetModalOpen,
    priority: BACK_PRIORITY.MODAL,
  });

  useBackHandler({
    id: 'app_account_modal',
    onBack: () => {
      setIsAccountModalOpen(false);
      setEditingAccount(null);
      setAccountModalInitialBankId(undefined);
      return true;
    },
    enabled: isAccountModalOpen,
    priority: BACK_PRIORITY.MODAL,
  });

  useBackHandler({
    id: 'app_transfer_modal',
    onBack: () => {
      setIsTransferModalOpen(false);
      return true;
    },
    enabled: isTransferModalOpen,
    priority: BACK_PRIORITY.MODAL,
  });

  useBackHandler({
    id: 'app_goal_modal',
    onBack: () => {
      setIsGoalModalOpen(false);
      setEditingGoal(null);
      setModalInitialIsShared(false);
      return true;
    },
    enabled: isGoalModalOpen,
    priority: BACK_PRIORITY.MODAL,
  });

  useBackHandler({
    id: 'app_category_modal',
    onBack: () => {
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      return true;
    },
    enabled: isCategoryModalOpen,
    priority: BACK_PRIORITY.MODAL,
  });

  useBackHandler({
    id: 'app_subscription_modal',
    onBack: () => {
      setIsSubscriptionModalOpen(false);
      setEditingSubscription(null);
      setModalInitialIsShared(false);
      return true;
    },
    enabled: isSubscriptionModalOpen,
    priority: BACK_PRIORITY.MODAL,
  });

  useBackHandler({
    id: 'app_sobra_ai_chat',
    onBack: () => {
      setIsSobraAiChatOpen(false);
      setSobraAiChatPrompt(undefined);
      setSobraAiInitialTab('chat');
      return true;
    },
    enabled: isSobraAiChatOpen,
    priority: BACK_PRIORITY.MODAL,
  });

  useBackHandler({
    id: 'app_burn_rate_modal',
    onBack: () => {
      setIsBurnRateModalOpen(false);
      return true;
    },
    enabled: isBurnRateModalOpen,
    priority: BACK_PRIORITY.MODAL,
  });

  useBackHandler({
    id: 'app_permissions_modal',
    onBack: () => {
      setIsPermissionsSetupOpen(false);
      return true;
    },
    enabled: isPermissionsSetupOpen,
    priority: BACK_PRIORITY.MODAL,
  });

  const dashboardModalCloserRef = useRef<(() => boolean) | null>(null);

  useBackHandler({
    id: 'dashboard_registered_modal',
    onBack: () => {
      if (dashboardModalCloserRef.current) {
        return dashboardModalCloserRef.current();
      }
      return false;
    },
    enabled: true,
    priority: BACK_PRIORITY.MODAL - 5,
  });

  // Retorna uma tela pelo histórico ordenado ou navega para o destino padrão da subtela
  const handleGoBackScreen = useCallback(() => {
    const history = screenHistoryRef.current;
    if (history.length > 1) {
      history.pop();
      const prevTab = history[history.length - 1];
      setActiveTab(prevTab as any);
      return;
    }

    if (activeTab in subscreenReturnTab) {
      const returnTo = subscreenReturnTab[activeTab] || 'dashboard';
      screenHistoryRef.current = [returnTo];
      setActiveTab(returnTo as any);
      return;
    }

    if (activeTab !== 'dashboard') {
      screenHistoryRef.current = ['dashboard'];
      setActiveTab('dashboard');
      return;
    }

    try {
      CapacitorApp.exitApp();
    } catch {}
  }, [activeTab, subscreenReturnTab]);

  const handleGlobalBack = useCallback(() => {
    // 1. Tenta fechar o modal/overlay de maior prioridade na pilha ativa
    const handled = backNavigationManager.triggerBack();
    if (handled) return;

    // 2. Se nenhum modal estava aberto, retrocede no histórico de telas
    handleGoBackScreen();
  }, [handleGoBackScreen]);

  // Listener para botão voltar nativo do Android e teclado Escape
  useEffect(() => {
    let removeCapacitorListener: (() => void) | undefined;

    try {
      CapacitorApp.addListener('backButton', () => {
        handleGlobalBack();
      }).then((handle) => {
        removeCapacitorListener = () => handle.remove();
      }).catch(() => {
        // Ambiente de browser puro sem Capacitor bridge
      });
    } catch {
      // Ignora erro
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleGlobalBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (removeCapacitorListener) {
        removeCapacitorListener();
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleGlobalBack]);

  // Checagem inteligente de notificações (vencimentos de faturas, salários, metas) ao iniciar ou retomar o app
  useEffect(() => {
    if (isFinanceLoading || accounts.length === 0) return;

    const runChecks = () => {
      const now = new Date();
      SmartNotificationService.runAllSmartChecks({
        accounts,
        categories,
        transactions,
        budgets,
        subscriptions,
        totalIncome: 0,
        totalExpenses: 0,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        onNavigate: (tab: string) => handleNavigateToTab(tab as any),
        now,
      });
    };

    runChecks();

    let removeListener: (() => void) | undefined;
    try {
      CapacitorApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          runChecks();
        }
      }).then(handle => {
        removeListener = () => handle.remove();
      }).catch(() => {});
    } catch {}

    return () => {
      if (removeListener) removeListener();
    };
  }, [accounts, categories, transactions, budgets, subscriptions, isFinanceLoading]);

  // Itens da Barra de Navegação do Mockup: Início, Transações, (+), Planejamento, Mais
  const navLeft = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'transactions', label: 'Transações', icon: ArrowLeftRight },
  ];

  const navRight = [
    { id: 'budgets', label: 'Planejamento', icon: Target },
    { 
      id: 'more', 
      label: 'Mais', 
      icon: SlidersHorizontal, 
      badge: (pendingNotifications.length + subscriptionSuggestions.length) > 0
        ? (pendingNotifications.length + subscriptionSuggestions.length)
        : undefined
    },
  ];

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100dvh',
        backgroundColor: colors.background,
        color: colors.textPrimary,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        position: 'relative',
      }}
    >
      {/* Container Principal Responsivo: 100% no celular, largura centralizada no desktop */}
      <main
        style={{
          width: '100%',
          maxWidth: '460px',
          minHeight: '100dvh',
          paddingTop: 'calc(var(--safe-area-top, 0px) + 6px)',
          paddingBottom: 'calc(110px + var(--safe-area-bottom, 0px))',
          paddingLeft: 'max(16px, var(--safe-area-left, 0px))',
          paddingRight: 'max(16px, var(--safe-area-right, 0px))',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Telas do Aplicativo */}
        <>
            {/* Telas do Aplicativo */}
            {activeTab === 'dashboard' && (
              <DashboardScreen
                onOpenNewTransaction={handleOpenNewTransaction}
                onNavigateToTab={(tab: any) => handleNavigateToTab(tab, 'dashboard')}
                onOpenReviewNotification={handleOpenReviewNotification}
                onOpenNewAccount={(type) => {
                  handleOpenAccountForm({ returnTab: 'dashboard', defaultType: type ?? 'checking' });
                }}
                onEditAccount={(acc, options) => {
                  handleOpenAccountForm({
                    account: acc,
                    returnTab: 'dashboard',
                    returnToCardId: options?.returnToCardId,
                  });
                }}
                initialCardForInvoiceId={cardIdToReopen}
                onClearInitialCardForInvoice={() => setCardIdToReopen(null)}
                onOpenAiChat={handleOpenAiChat}
                onEditTransaction={(tx) => {
                  setEditingTransaction(tx);
                  setIsTransactionModalOpen(true);
                }}
                onOpenTransfer={() => setIsTransferModalOpen(true)}
                onOpenRelatorios={handleOpenRelatorios}
                onRegisterModalCloser={(closer) => {
                  dashboardModalCloserRef.current = closer;
                }}
                onRegisterResetView={(resetFn) => {
                  dashboardResetRef.current = resetFn;
                }}
                onModalStateChange={setIsDashboardModalOpen}
                onOpenProjection={() => setIsBurnRateModalOpen(true)}
              />
            )}

            {activeTab === 'transactions' && (
              <TransactionsScreen
                onBack={handleGoBackScreen}
                onOpenNewTransaction={handleOpenNewTransaction}
                onEditTransaction={(tx) => {
                  setEditingTransaction(tx);
                  setIsTransactionModalOpen(true);
                }}
              />
            )}

            {activeTab === 'budgets' && (
              <BudgetsScreen
                onBack={handleGoBackScreen}
                onOpenNewBudget={() => {
                  setEditingBudget(null);
                  setIsBudgetModalOpen(true);
                }}
                onEditBudget={(budget) => {
                  setEditingBudget(budget);
                  setIsBudgetModalOpen(true);
                }}
                onOpenNewGoal={() => {
                  setEditingGoal(null);
                  setIsGoalModalOpen(true);
                }}
                onEditGoal={(goal) => {
                  setSelectedGoalIdForDetail(goal.id);
                  handleNavigateToTab('goal_detail', 'budgets');
                }}
                onOpenNewCategory={() => {
                  setEditingCategory(null);
                  setIsCategoryModalOpen(true);
                }}
                onEditCategory={(cat) => {
                  setEditingCategory(cat);
                  setIsCategoryModalOpen(true);
                }}
                onOpenProjection={() => setIsBurnRateModalOpen(true)}
                onOpenSubscriptions={() => handleNavigateToTab('subscriptions', 'budgets')}
                onOpenDailyGoal={() => {
                  setReturnToProjectionFromDailyGoal(false);
                  handleNavigateToTab('daily_goal', 'budgets');
                }}
                dailyGoal={dailyGoal}
              />
            )}

            {activeTab === 'more' && (
              <MoreScreen
                onBack={handleGoBackScreen}
                onNavigateToTab={(tab: any) => handleNavigateToTab(tab, 'more')}
                onOpenCsvImport={() => setIsCsvModalOpen(true)}
                onOpenAiChat={() => handleOpenAiChat()}
                onOpenRelatorios={handleOpenRelatorios}
                onOpenProjection={() => setIsBurnRateModalOpen(true)}
                onOpenPermissionsSetup={() => setIsPermissionsSetupOpen(true)}
                onOpenPartnershipHub={() => handleNavigateToTab('partnership' as any, 'more')}
              />
            )}

            {/* Subtelas acessadas a partir de Mais ou Dashboard */}
            {activeTab === 'goal_detail' && selectedGoalIdForDetail && (
              <GoalDetailScreen
                goalId={selectedGoalIdForDetail}
                onBack={handleGoBackScreen}
                onEditGoalSettings={(goal) => {
                  setEditingGoal(goal);
                  setIsGoalModalOpen(true);
                }}
              />
            )}

            {activeTab === 'daily_goal' && (
              <DailyBudgetGoalScreen
                onBack={() => {
                  setActivePlanningCadence('weekly');
                  if (returnToProjectionFromDailyGoal) {
                    setReturnToProjectionFromDailyGoal(false);
                    handleGoBackScreen();
                    setIsBurnRateModalOpen(true);
                  } else {
                    handleGoBackScreen();
                  }
                }}
                projection={burnRateProjection}
                currentGoal={dailyGoal}
                initialCadence={activePlanningCadence}
                onSaveGoalConfig={(goal) => {
                  setActivePlanningCadence('weekly');
                  handleSaveDailyGoal(goal);
                }}
                onRemoveGoalConfig={handleRemoveDailyGoal}
                onOpenAiChat={handleOpenAiChat}
                onCreateGoal={() => {
                  setActivePlanningCadence('weekly');
                  setEditingGoal(null);
                  setIsGoalModalOpen(true);
                }}
              />
            )}

            {activeTab === 'accounts' && (
              <AccountsScreen
                onBack={handleGoBackScreen}
                onOpenNewAccount={(type) => {
                  handleOpenAccountForm({ returnTab: 'accounts', defaultType: type || 'checking' });
                }}
                onEditAccount={(acc, options) => {
                  handleOpenAccountForm({
                    account: acc,
                    returnTab: 'accounts',
                    returnToCardId: options?.returnToCardId,
                  });
                }}
                initialCardForInvoiceId={cardIdToReopen}
                onClearInitialCardForInvoice={() => setCardIdToReopen(null)}
                onOpenNewTransaction={handleOpenNewTransaction}
              />
            )}

            {activeTab === 'subscriptions' && (
              <SubscriptionsScreen
                onBack={handleGoBackScreen}
                onOpenNewSubscription={() => {
                  setEditingSubscription(null);
                  setIsSubscriptionModalOpen(true);
                }}
                onEditSubscription={(sub) => {
                  setEditingSubscription(sub);
                  setIsSubscriptionModalOpen(true);
                }}
              />
            )}

            {activeTab === 'notifications' && (
              <NotificationDetectorScreen
                onBack={handleGoBackScreen}
                onOpenReviewModal={handleOpenReviewNotification}
                onOpenCreateAccountForNotification={(pending) => {
                  handleOpenAccountForm({
                    initialBankId: pending.bankId,
                    defaultType: pending.parsedPaymentMethod === 'credit' || pending.isInstallment ? 'credit_card' : 'checking',
                    initialLastDigits: pending.cardLastDigits,
                    pendingNotificationToLink: pending,
                    returnTab: 'notifications',
                  });
                }}
              />
            )}

            {activeTab === 'categories' && (
              <CategoriesScreen
                onBack={handleGoBackScreen}
                onOpenNewCategory={() => {
                  setEditingCategory(null);
                  setIsCategoryModalOpen(true);
                }}
                onEditCategory={(cat) => {
                  setEditingCategory(cat);
                  setIsCategoryModalOpen(true);
                }}
              />
            )}

            {activeTab === 'partnership' && (
              <PartnershipHubScreen
                onBack={handleGoBackScreen}
                onOpenCardDetails={(card) => {
                  handleOpenAccountForm({ account: card, returnTab: 'partnership', fromPartnership: true });
                }}
                onOpenNewCard={() => {
                  handleOpenAccountForm({ 
                    defaultType: 'credit_card', 
                    returnTab: 'partnership', 
                    fromPartnership: true, 
                    initialIsShared: true 
                  });
                }}
                onOpenNewGoal={() => {
                  setEditingGoal(null);
                  setModalInitialIsShared(true);
                  setIsGoalModalOpen(true);
                }}
                onOpenGoalDetails={(goalId) => {
                  setSelectedGoalIdForDetail(goalId);
                  handleNavigateToTab('goal_detail' as any, 'partnership' as any);
                }}
                onOpenNewBudget={() => {
                  setEditingBudget(null);
                  setModalInitialIsShared(true);
                  setIsBudgetModalOpen(true);
                }}
                onOpenNewSubscription={() => {
                  setEditingSubscription(null);
                  setModalInitialIsShared(true);
                  setIsSubscriptionModalOpen(true);
                }}
                onOpenSubscriptionDetails={(sub) => {
                  setEditingSubscription(sub);
                  setModalInitialIsShared(true);
                  setIsSubscriptionModalOpen(true);
                }}
              />
            )}
          </>

        {/* Subtela Dedicada de Cadastro/Edição de Cartão ou Conta (Estilo Pierre) */}
        {accountFormScreenData?.isOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 3200,
              backgroundColor: colors.background,
              overflowY: 'auto',
              display: 'flex',
              justifyContent: 'center',
              paddingTop: 'calc(var(--safe-area-top, 0px) + 6px)',
              paddingBottom: 'calc(40px + var(--safe-area-bottom, 0px))',
              paddingLeft: 'max(16px, var(--safe-area-left, 0px))',
              paddingRight: 'max(16px, var(--safe-area-right, 0px))',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '460px',
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              <CardAccountFormScreen
                onBack={() => {
                  const returnTab = accountFormScreenData.returnTab;
                  const returnToCardId = accountFormScreenData.returnToCardId;
                  handleCloseAccountForm();
                  if (returnTab) setActiveTab(returnTab as any);
                  if (returnToCardId) {
                    setCardIdToReopen(returnToCardId);
                  }
                }}
                accountToEdit={accountFormScreenData.accountToEdit}
                initialBankId={accountFormScreenData.initialBankId}
                defaultType={accountFormScreenData.defaultType}
                initialLastDigits={accountFormScreenData.initialLastDigits}
                pendingNotificationToLink={accountFormScreenData.pendingNotificationToLink}
                fromPartnership={accountFormScreenData.fromPartnership}
                initialIsShared={accountFormScreenData.initialIsShared}
              />
            </div>
          </div>
        )}
      </main>

      {/* Barra de Navegação Inferior Docked Fiel ao Mockup */}
      {!accountFormScreenData?.isOpen && !isTransactionModalOpen && !isSobraAiChatOpen && (() => {
        const navElement = (
          <nav
            className="glass"
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: mode === 'dark' ? 'rgba(10, 14, 12, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderTop: `1px solid ${colors.border}`,
              zIndex: 3000,
              display: 'flex',
              justifyContent: 'center',
              paddingBottom: 'var(--safe-area-bottom, 0px)',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '460px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 18px 10px',
                position: 'relative',
              }}
            >
              {/* Lado Esquerdo: Início e Transações */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
                {navLeft.map(item => {
                  const isActive = activeTab === item.id && (!isDashboardModalOpen || item.id !== 'dashboard');
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigateToTab(item.id as any)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 6px',
                        color: isActive ? colors.primary : colors.textSecondary,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <Icon size={20} color={isActive ? colors.primary : colors.textSecondary} />
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: isActive ? 700 : 500,
                        }}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Centro: Botão Flutuante Circular Verde (+) do Mockup */}
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsBurnRateModalOpen(false);
                    setIsSobraAiModalOpen(false);
                    setIsQuickActionModalOpen(true);
                  }}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#4ADE80',
                    color: '#0A0E0C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 20px rgba(74, 222, 128, 0.5)',
                    border: 'none',
                    cursor: 'pointer',
                    transform: 'translateY(-14px)',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-16px) scale(1.08)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(-14px) scale(1)')}
                  title="Adicionar Lançamento"
                >
                  <Plus size={26} strokeWidth={2.8} />
                </button>
              </div>

              {/* Lado Direito: Planejamento e Mais */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
                {navRight.map(item => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigateToTab(item.id as any)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        position: 'relative',
                        padding: '4px 6px',
                        color: isActive ? colors.primary : colors.textSecondary,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <Icon size={20} color={isActive ? colors.primary : colors.textSecondary} />
                        {item.badge && (
                          <span
                            style={{
                              position: 'absolute',
                              top: '-4px',
                              right: '-8px',
                              backgroundColor: colors.expense,
                              color: '#FFFFFF',
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: isActive ? 700 : 500,
                        }}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
        );

        return typeof document !== 'undefined' ? createPortal(navElement, document.body) : navElement;
      })()}

      {/* Botão Flutuante do Sobi AI estilo PicPay (oculto quando qualquer modal estiver aberto) */}
      {!accountFormScreenData?.isOpen &&
        !isTransactionModalOpen &&
        !isSobraAiChatOpen &&
        !isQuickActionModalOpen &&
        !isBurnRateModalOpen &&
        !isBudgetModalOpen &&
        !isAccountModalOpen &&
        !isTransferModalOpen &&
        !isGoalModalOpen &&
        !isSubscriptionModalOpen &&
        !isCategoryModalOpen &&
        !isReviewModalOpen &&
        !isCsvModalOpen &&
        !isAuthModalOpen &&
        !isPermissionsSetupOpen &&
        !isSobraAiModalOpen &&
        !isDashboardModalOpen && (
          <SobiFloatingButton onClick={() => handleOpenAiChat()} />
      )}

      {/* Action Sheet do Botão Flutuante Central (+) */}
      <QuickNewActionModal
        isOpen={isQuickActionModalOpen}
        onClose={() => setIsQuickActionModalOpen(false)}
        onNewExpense={() => handleOpenNewTransaction('expense')}
        onNewIncome={() => handleOpenNewTransaction('income')}
        onNewTransfer={() => setIsTransferModalOpen(true)}
      />

      {/* Modais Globais do Sistema */}
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => {
          setIsTransactionModalOpen(false);
          setEditingTransaction(null);
          setTransactionModalDefaultAccountId(undefined);
        }}
        initialData={editingTransaction}
        defaultType={transactionModalDefaultType}
        defaultAccountId={transactionModalDefaultAccountId}
        onOpenNewCategory={() => {
          setEditingCategory(null);
          setIsCategoryModalOpen(true);
        }}
        onOpenNewAccount={(type) => {
          setIsTransactionModalOpen(false);
          handleOpenAccountForm({
            defaultType: type || 'checking',
            returnTab: activeTab,
          });
        }}
      />

      <NotificationReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setReviewingNotificationId(null);
        }}
        notification={pendingReviewNotification}
        onOpenNewAccount={(bankId) => {
          setIsReviewModalOpen(false);
          setReviewingNotificationId(null);
          handleOpenAccountForm({
            initialBankId: bankId || pendingReviewNotification?.bankId,
            returnTab: activeTab,
            defaultType: pendingReviewNotification?.parsedPaymentMethod === 'credit' || pendingReviewNotification?.isInstallment ? 'credit_card' : 'checking',
            initialLastDigits: pendingReviewNotification?.cardLastDigits,
            pendingNotificationToLink: pendingReviewNotification,
          });
        }}
      />

      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
      />

      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => {
          setIsBudgetModalOpen(false);
          setEditingBudget(null);
          setModalInitialIsShared(false);
        }}
        editingBudget={editingBudget}
        initialIsShared={modalInitialIsShared}
        onDelete={editingBudget ? () => {
          if (confirm(`Remover o orçamento desta categoria?`)) {
            deleteBudget(editingBudget.id);
            setIsBudgetModalOpen(false);
            setEditingBudget(null);
            setModalInitialIsShared(false);
          }
        } : undefined}
      />

      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => {
          setIsAccountModalOpen(false);
          setEditingAccount(null);
          setAccountModalInitialBankId(undefined);
        }}
        accountToEdit={editingAccount}
        initialBankId={accountModalInitialBankId}
        zIndex={10001}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
      />

      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={() => {
          setIsGoalModalOpen(false);
          setEditingGoal(null);
          setModalInitialIsShared(false);
        }}
        editingGoal={editingGoal}
        initialIsShared={modalInitialIsShared}
        onDelete={editingGoal ? () => {
          if (confirm(`Excluir a meta "${editingGoal.name}"?`)) {
            deleteGoal(editingGoal.id);
            setIsGoalModalOpen(false);
            setEditingGoal(null);
            setModalInitialIsShared(false);
            if (activeTab === 'goal_detail') {
              setActiveTab((subscreenReturnTab.goal_detail as any) || 'budgets');
            }
          }
        } : undefined}
      />

      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => {
          setIsSubscriptionModalOpen(false);
          setEditingSubscription(null);
          setModalInitialIsShared(false);
        }}
        initialData={editingSubscription}
        initialIsShared={modalInitialIsShared}
      />

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        categoryToEdit={editingCategory}
      />

      {/* Central Sobra AI Unificada: Conversa com Sobi & Relatório de Saúde Financeira */}
      <SobraAiChatModal
        isOpen={isSobraAiChatOpen}
        onClose={() => {
          setIsSobraAiChatOpen(false);
          setSobraAiChatPrompt(undefined);
          setSobraAiInitialTab('chat');
        }}
        initialPrompt={sobraAiChatPrompt}
        initialTab={sobraAiInitialTab}
        diagnosis={sobraAiDiagnosis}
        onExecuteAction={handleExecuteSobraAiAction}
      />

      {/* Modal de Projeção de Sobra & Ritmo de Gastos (Burn Rate) */}
      <BurnRateProjectionModal
        isOpen={isBurnRateModalOpen}
        onClose={() => setIsBurnRateModalOpen(false)}
        projection={burnRateProjection}
        isPrivacyMode={isPrivacyMode}
        onOpenAiChat={handleOpenAiChat}
        onOpenDailyGoal={(cadence) => {
          setReturnToProjectionFromDailyGoal(true);
          setIsBurnRateModalOpen(false);
          setActivePlanningCadence(cadence || 'weekly');
          handleNavigateToTab('daily_goal');
        }}
        onCreateGoal={() => {
          setIsBurnRateModalOpen(false);
          setEditingGoal(null);
          setIsGoalModalOpen(true);
        }}
      />

      {/* Modal de Autenticação / Boas-Vindas Google */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        title={authModalOptions?.title}
        subtitle={authModalOptions?.subtitle}
        iconType={authModalOptions?.iconType}
        hideGuestOption={authModalOptions?.hideGuestOption}
      />

      {/* Modal Educativo com Aviso de Recursos Perdidos e Exemplo de Backup */}
      <OfflineWarningModal />

      {/* 2ª Tela de Onboarding: Autorizações Críticas & Primeiras Configurações */}
      <PermissionsSetupModal
        isOpen={isPermissionsSetupOpen}
        onClose={() => setIsPermissionsSetupOpen(false)}
      />

      {/* Animação de Inicialização Oficial (Splash Screen) */}
      {isSplashActive && (
        <StartupSplashScreen
          isReady={!isAuthLoading && !isFinanceLoading}
          onFinished={() => setIsSplashActive(false)}
        />
      )}
    </div>
  );
};
