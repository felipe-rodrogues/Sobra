import React, { useState } from 'react';
import { useTheme } from './context/ThemeContext';
import { useFinance } from './context/FinanceContext';
import { DashboardScreen } from './screens/DashboardScreen';
import { TransactionsScreen } from './screens/TransactionsScreen';
import { AccountsScreen } from './screens/AccountsScreen';
import { BudgetsScreen } from './screens/BudgetsScreen';
import { NotificationDetectorScreen } from './screens/NotificationDetectorScreen';
import { SubscriptionsScreen } from './screens/SubscriptionsScreen';
import { MoreScreen } from './screens/MoreScreen';

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
import { QuickNewActionModal } from './components/modals/QuickNewActionModal';

import { 
  Home, 
  ArrowLeftRight, 
  Target, 
  SlidersHorizontal,
  Plus, 
  ArrowLeft
} from 'lucide-react';
import { Transaction, Subscription, Account, Category } from './core/types';

export const App: React.FC = () => {
  const { colors } = useTheme();
  const { pendingNotifications, subscriptionSuggestions } = useFinance();

  // Tabs do app: 'dashboard' (Início), 'transactions' (Transações), 'budgets' (Planejamento), 'more' (Mais)
  // Subtelas: 'accounts', 'subscriptions', 'notifications'
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'transactions' | 'budgets' | 'more' | 'accounts' | 'subscriptions' | 'notifications'
  >('dashboard');

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
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountModalInitialBankId, setAccountModalInitialBankId] = useState<string | undefined>(undefined);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);

  const [isSobraAiChatOpen, setIsSobraAiChatOpen] = useState(false);
  const [sobraAiChatPrompt, setSobraAiChatPrompt] = useState<string | undefined>(undefined);

  const handleOpenAiChat = (prompt?: string) => {
    setSobraAiChatPrompt(prompt);
    setIsSobraAiChatOpen(true);
  };

  const pendingReviewNotification = pendingNotifications.find(n => n.id === reviewingNotificationId) || pendingNotifications[0] || null;

  const handleOpenReviewNotification = (id: string) => {
    setReviewingNotificationId(id);
    setIsReviewModalOpen(true);
  };

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
          padding: '16px 16px 110px',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Telas do Aplicativo */}
        {activeTab === 'dashboard' && (
          <DashboardScreen
            onOpenNewTransaction={handleOpenNewTransaction}
            onNavigateToTab={(tab: any) => setActiveTab(tab)}
            onOpenReviewNotification={handleOpenReviewNotification}
            onOpenNewAccount={() => {
              setEditingAccount(null);
              setIsAccountModalOpen(true);
            }}
            onEditAccount={(acc) => {
              setEditingAccount(acc);
              setIsAccountModalOpen(true);
            }}
            onOpenAiChat={handleOpenAiChat}
            onEditTransaction={(tx) => {
              setEditingTransaction(tx);
              setIsTransactionModalOpen(true);
            }}
            onOpenTransfer={() => setIsTransferModalOpen(true)}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsScreen
            onOpenNewTransaction={handleOpenNewTransaction}
            onOpenCsvImport={() => setIsCsvModalOpen(true)}
            onEditTransaction={(tx) => {
              setEditingTransaction(tx);
              setIsTransactionModalOpen(true);
            }}
          />
        )}

        {activeTab === 'budgets' && (
          <BudgetsScreen
            onOpenNewBudget={() => setIsBudgetModalOpen(true)}
            onOpenNewGoal={() => setIsGoalModalOpen(true)}
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

        {activeTab === 'more' && (
          <MoreScreen
            onNavigateToTab={(tab: any) => setActiveTab(tab)}
            onOpenCsvImport={() => setIsCsvModalOpen(true)}
            onOpenAiChat={() => handleOpenAiChat()}
          />
        )}

        {/* Subtelas acessadas a partir de Mais ou Dashboard */}
        {activeTab === 'accounts' && (
          <AccountsScreen
            onBack={() => setActiveTab('more')}
            onOpenNewAccount={() => {
              setEditingAccount(null);
              setIsAccountModalOpen(true);
            }}
            onEditAccount={(acc) => {
              setEditingAccount(acc);
              setIsAccountModalOpen(true);
            }}
            onOpenTransfer={() => setIsTransferModalOpen(true)}
            onEditTransaction={(tx) => {
              setEditingTransaction(tx);
              setIsTransactionModalOpen(true);
            }}
          />
        )}

        {activeTab === 'subscriptions' && (
          <SubscriptionsScreen
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
            onOpenReviewModal={handleOpenReviewNotification}
          />
        )}
      </main>

      {/* Barra de Navegação Inferior Docked Fiel ao Mockup */}
      <nav
        className="glass"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surfaceGlass,
          borderTop: `1px solid ${colors.border}`,
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 18px 14px',
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
                  onClick={() => setActiveTab(item.id as any)}
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
              onClick={() => setIsQuickActionModalOpen(true)}
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
                  onClick={() => setActiveTab(item.id as any)}
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

      {/* Action Sheet do Botão Flutuante Central (+) */}
      <QuickNewActionModal
        isOpen={isQuickActionModalOpen}
        onClose={() => setIsQuickActionModalOpen(false)}
        onNewExpense={() => handleOpenNewTransaction('expense')}
        onNewIncome={() => handleOpenNewTransaction('income')}
        onNewTransfer={() => setIsTransferModalOpen(true)}
        onCsvImport={() => setIsCsvModalOpen(true)}
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
          setEditingAccount(null);
          setAccountModalInitialBankId(bankId);
          setIsAccountModalOpen(true);
        }}
      />

      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
      />

      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
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
        onClose={() => setIsGoalModalOpen(false)}
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

      <SobraAiChatModal
        isOpen={isSobraAiChatOpen}
        onClose={() => {
          setIsSobraAiChatOpen(false);
          setSobraAiChatPrompt(undefined);
        }}
        initialPrompt={sobraAiChatPrompt}
      />
    </div>
  );
};
