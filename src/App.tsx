import React, { useState, useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
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
import { sobraAiEngine } from './core/ai/sobraAiEngine';
import { SobraAction } from './core/ai/types';
import { calculateBurnRateProjection } from './core/calculations';

import { 
  Home, 
  ArrowLeftRight, 
  Target, 
  SlidersHorizontal,
  Plus, 
  ArrowLeft
} from 'lucide-react';
import { Transaction, Subscription, Account, Category, Budget, Goal, AccountType, PendingNotification } from './core/types';

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
  } = useFinance();
  const { isAuthModalOpen, closeAuthModal, authModalOptions } = useAuth();

  // Tabs do app: 'dashboard' (Início), 'transactions' (Transações), 'budgets' (Planejamento), 'more' (Mais)
  // Subtelas: 'accounts', 'subscriptions', 'notifications', 'categories', 'daily_goal', 'goal_detail'
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'transactions' | 'budgets' | 'more' | 'accounts' | 'subscriptions' | 'notifications' | 'categories' | 'daily_goal' | 'goal_detail'
  >('dashboard');

  // Mapeamento dinâmico de retorno para subtelas (preserva se o usuário abriu do Início ou do Mais)
  const [subscreenReturnTab, setSubscreenReturnTab] = useState<Record<string, 'dashboard' | 'transactions' | 'budgets' | 'more'>>({
    notifications: 'dashboard',
    accounts: 'more',
    subscriptions: 'more',
    categories: 'more',
    daily_goal: 'budgets',
    goal_detail: 'budgets',
  });

  const handleNavigateToTab = (
    tab: 'dashboard' | 'transactions' | 'budgets' | 'more' | 'accounts' | 'subscriptions' | 'notifications' | 'categories' | 'daily_goal' | 'goal_detail',
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

    if (tab === 'dashboard' && activeTab === 'dashboard') {
      if (dashboardModalCloserRef.current && dashboardModalCloserRef.current()) {
        return;
      }
    }

    const origin = fromTab || (['dashboard', 'transactions', 'budgets', 'more'].includes(activeTab) ? (activeTab as any) : 'dashboard');
    if (['notifications', 'accounts', 'subscriptions', 'categories', 'daily_goal', 'goal_detail'].includes(tab)) {
      setSubscreenReturnTab(prev => ({
        ...prev,
        [tab]: origin,
      }));
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

  const handleOpenNewTransaction = (type: 'expense' | 'income' = 'expense') => {
    setEditingTransaction(null);
    setTransactionModalDefaultType(type);
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
  const [accountFormScreenData, setAccountFormScreenData] = useState<{
    isOpen: boolean;
    accountToEdit?: Account | null;
    initialBankId?: string;
    defaultType?: AccountType;
    returnTab: string;
    initialLastDigits?: string;
    pendingNotificationToLink?: PendingNotification | null;
  } | null>(null);

  const handleOpenAccountForm = (options?: {
    account?: Account | null;
    initialBankId?: string;
    defaultType?: AccountType;
    returnTab?: string;
    initialLastDigits?: string;
    pendingNotificationToLink?: PendingNotification | null;
  }) => {
    setAccountFormScreenData({
      isOpen: true,
      accountToEdit: options?.account || null,
      initialBankId: options?.initialBankId,
      defaultType: options?.defaultType || 'credit_card',
      returnTab: options?.returnTab || activeTab,
      initialLastDigits: options?.initialLastDigits,
      pendingNotificationToLink: options?.pendingNotificationToLink || null,
    });
  };

  const handleCloseAccountForm = () => {
    setAccountFormScreenData(null);
  };
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [selectedGoalIdForDetail, setSelectedGoalIdForDetail] = useState<string | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);

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

  // Diagnóstico e Modal de Relatórios de Saúde Financeira Sobra AI
  const [isSobraAiModalOpen, setIsSobraAiModalOpen] = useState(false);
  const [isBurnRateModalOpen, setIsBurnRateModalOpen] = useState(false);

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
    return calculateBurnRateProjection(transactions);
  }, [transactions]);

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
    setReviewingNotificationId(id);
    setIsReviewModalOpen(true);
  };

  // Estado rastreado para gerenciamento unificado de botão voltar (Android/Hardware/Gestos)
  const latestBackStateRef = useRef({
    accountFormScreenOpen: false,
    isQuickActionModalOpen: false,
    isTransactionModalOpen: false,
    isReviewModalOpen: false,
    isCsvModalOpen: false,
    isBudgetModalOpen: false,
    isAccountModalOpen: false,
    isTransferModalOpen: false,
    isGoalModalOpen: false,
    isCategoryModalOpen: false,
    isSubscriptionModalOpen: false,
    isSobraAiChatOpen: false,
    isSobraAiModalOpen: false,
    isBurnRateModalOpen: false,
    activeTab: 'dashboard' as string,
    subscreenReturnTab: {
      notifications: 'dashboard',
      accounts: 'more',
      subscriptions: 'more',
    } as Record<string, string>,
  });

  useEffect(() => {
    latestBackStateRef.current = {
      accountFormScreenOpen: !!accountFormScreenData?.isOpen,
      isQuickActionModalOpen,
      isTransactionModalOpen,
      isReviewModalOpen,
      isCsvModalOpen,
      isBudgetModalOpen,
      isAccountModalOpen,
      isTransferModalOpen,
      isGoalModalOpen,
      isCategoryModalOpen,
      isSubscriptionModalOpen,
      isSobraAiChatOpen,
      isSobraAiModalOpen,
      isBurnRateModalOpen,
      activeTab,
      subscreenReturnTab,
    };
  }, [
    accountFormScreenData,
    isQuickActionModalOpen,
    isTransactionModalOpen,
    isReviewModalOpen,
    isCsvModalOpen,
    isBudgetModalOpen,
    isAccountModalOpen,
    isTransferModalOpen,
    isGoalModalOpen,
    isCategoryModalOpen,
    isSubscriptionModalOpen,
    isSobraAiChatOpen,
    isSobraAiModalOpen,
    isBurnRateModalOpen,
    activeTab,
    subscreenReturnTab,
  ]);

  const dashboardModalCloserRef = useRef<(() => boolean) | null>(null);

  const handleGlobalBack = React.useCallback(() => {
    // 0. Modais e overlays internos do Dashboard (Fluxo de Caixa, Visão do Mês, Fatura, Pagamento, etc.)
    if (dashboardModalCloserRef.current && dashboardModalCloserRef.current()) {
      return;
    }

    const s = latestBackStateRef.current;

    // 1. Modais e formulários sobrepostos têm prioridade máxima de fechamento
    if (s.accountFormScreenOpen) {
      handleCloseAccountForm();
      return;
    }
    if (s.isQuickActionModalOpen) {
      setIsQuickActionModalOpen(false);
      return;
    }
    if (s.isTransactionModalOpen) {
      setIsTransactionModalOpen(false);
      return;
    }
    if (s.isReviewModalOpen) {
      setIsReviewModalOpen(false);
      return;
    }
    if (s.isCsvModalOpen) {
      setIsCsvModalOpen(false);
      return;
    }
    if (s.isBudgetModalOpen) {
      setIsBudgetModalOpen(false);
      return;
    }
    if (s.isAccountModalOpen) {
      setIsAccountModalOpen(false);
      return;
    }
    if (s.isTransferModalOpen) {
      setIsTransferModalOpen(false);
      return;
    }
    if (s.isGoalModalOpen) {
      setIsGoalModalOpen(false);
      return;
    }
    if (s.isCategoryModalOpen) {
      setIsCategoryModalOpen(false);
      return;
    }
    if (s.isSubscriptionModalOpen) {
      setIsSubscriptionModalOpen(false);
      return;
    }
    if (s.isSobraAiChatOpen) {
      setIsSobraAiChatOpen(false);
      return;
    }
    if (s.isSobraAiModalOpen) {
      setIsSobraAiModalOpen(false);
      return;
    }
    if (s.isBurnRateModalOpen) {
      setIsBurnRateModalOpen(false);
      return;
    }

    // 2. Subtelas voltam para a aba de onde foram abertas (ex: notifications aberta do Início volta para Início)
    if (s.activeTab === 'accounts' || s.activeTab === 'subscriptions' || s.activeTab === 'notifications' || s.activeTab === 'daily_goal' || s.activeTab === 'goal_detail') {
      const returnTo = (s.subscreenReturnTab && s.subscreenReturnTab[s.activeTab]) || 'budgets';
      setActiveTab(returnTo as any);
      return;
    }

    // 3. Abas secundárias ('transactions', 'budgets', 'more') voltam para 'dashboard'
    if (s.activeTab !== 'dashboard') {
      setActiveTab('dashboard');
      return;
    }

    // 4. Se já estiver no dashboard e sem modais, minimiza/sai no Android
    try {
      CapacitorApp.exitApp();
    } catch {
      // Ignora erro em navegadores
    }
  }, []);

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
        minHeight: '100vh',
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
          minHeight: '100vh',
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
        {/* Subtela Dedicada de Cadastro/Edição de Cartão ou Conta (Estilo Pierre) */}
        {accountFormScreenData?.isOpen ? (
          <CardAccountFormScreen
            onBack={() => {
              const returnTab = accountFormScreenData.returnTab;
              handleCloseAccountForm();
              if (returnTab) setActiveTab(returnTab as any);
            }}
            accountToEdit={accountFormScreenData.accountToEdit}
            initialBankId={accountFormScreenData.initialBankId}
            defaultType={accountFormScreenData.defaultType}
            initialLastDigits={accountFormScreenData.initialLastDigits}
            pendingNotificationToLink={accountFormScreenData.pendingNotificationToLink}
          />
        ) : (
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
                onEditAccount={(acc) => {
                  handleOpenAccountForm({ account: acc, returnTab: 'dashboard' });
                }}
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
              />
            )}

            {activeTab === 'transactions' && (
              <TransactionsScreen
                onBack={() => setActiveTab('dashboard')}
                onOpenNewTransaction={handleOpenNewTransaction}
                onEditTransaction={(tx) => {
                  setEditingTransaction(tx);
                  setIsTransactionModalOpen(true);
                }}
              />
            )}

            {activeTab === 'budgets' && (
              <BudgetsScreen
                onBack={() => setActiveTab('dashboard')}
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
                onOpenDailyGoal={() => handleNavigateToTab('daily_goal', 'budgets')}
              />
            )}

            {activeTab === 'more' && (
              <MoreScreen
                onBack={() => setActiveTab('dashboard')}
                onNavigateToTab={(tab: any) => handleNavigateToTab(tab, 'more')}
                onOpenCsvImport={() => setIsCsvModalOpen(true)}
                onOpenAiChat={() => handleOpenAiChat()}
                onOpenRelatorios={handleOpenRelatorios}
                onOpenProjection={() => setIsBurnRateModalOpen(true)}
              />
            )}

            {/* Subtelas acessadas a partir de Mais ou Dashboard */}
            {activeTab === 'goal_detail' && selectedGoalIdForDetail && (
              <GoalDetailScreen
                goalId={selectedGoalIdForDetail}
                onBack={() => setActiveTab((subscreenReturnTab.goal_detail as any) || 'budgets')}
                onEditGoalSettings={(goal) => {
                  setEditingGoal(goal);
                  setIsGoalModalOpen(true);
                }}
              />
            )}

            {activeTab === 'daily_goal' && (
              <DailyBudgetGoalScreen
                onBack={() => setActiveTab((subscreenReturnTab.daily_goal as any) || 'budgets')}
                projection={burnRateProjection}
                currentGoal={dailyGoal}
                onSaveGoalConfig={handleSaveDailyGoal}
                onRemoveGoalConfig={handleRemoveDailyGoal}
                onOpenAiChat={handleOpenAiChat}
                onCreateGoal={() => {
                  setEditingGoal(null);
                  setIsGoalModalOpen(true);
                }}
              />
            )}

            {activeTab === 'accounts' && (
              <AccountsScreen
                onBack={() => setActiveTab((subscreenReturnTab.accounts as any) || 'more')}
                onOpenNewAccount={(type) => {
                  handleOpenAccountForm({ returnTab: subscreenReturnTab.accounts || 'accounts', defaultType: type || 'checking' });
                }}
                onEditAccount={(acc) => {
                  handleOpenAccountForm({ account: acc, returnTab: subscreenReturnTab.accounts || 'accounts' });
                }}
              />
            )}

            {activeTab === 'subscriptions' && (
              <SubscriptionsScreen
                onBack={() => setActiveTab((subscreenReturnTab.subscriptions as any) || 'more')}
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
                onBack={() => setActiveTab((subscreenReturnTab.notifications as any) || 'dashboard')}
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
                onBack={() => setActiveTab((subscreenReturnTab.categories as any) || 'more')}
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
          </>
        )}
      </main>

      {/* Barra de Navegação Inferior Docked Fiel ao Mockup */}
      {!accountFormScreenData?.isOpen && !isTransactionModalOpen && (
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
        }}
        initialData={editingTransaction}
        defaultType={transactionModalDefaultType}
        onOpenNewCategory={() => {
          setEditingCategory(null);
          setIsCategoryModalOpen(true);
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
        }}
        editingBudget={editingBudget}
        onDelete={editingBudget ? () => {
          if (confirm(`Remover o orçamento desta categoria?`)) {
            deleteBudget(editingBudget.id);
            setIsBudgetModalOpen(false);
            setEditingBudget(null);
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
        }}
        editingGoal={editingGoal}
        onDelete={editingGoal ? () => {
          if (confirm(`Excluir a meta "${editingGoal.name}"?`)) {
            deleteGoal(editingGoal.id);
            setIsGoalModalOpen(false);
            setEditingGoal(null);
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
        }}
        initialData={editingSubscription}
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
        onOpenDailyGoal={() => {
          setIsBurnRateModalOpen(false);
          handleNavigateToTab('daily_goal', 'budgets');
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
    </div>
  );
};
