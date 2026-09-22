import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { SobraTopHeader } from '../components/dashboard/SobraTopHeader';
import { CreditCardWalletHero } from '../components/dashboard/CreditCardWalletHero';
import { CashFlowHeroCard } from '../components/dashboard/CashFlowHeroCard';
import { CashFlowModal } from '../components/modals/CashFlowModal';
import { MonthCategoriesModal } from '../components/modals/MonthCategoriesModal';
import { MonthOverviewCard, CategoryBreakdownItem } from '../components/dashboard/MonthOverviewCard';
import { PierreCompactCardsGrid } from '../components/dashboard/PierreCompactCardsGrid';
import { CardInvoiceModal } from '../components/modals/CardInvoiceModal';
import { PayInvoiceModal } from '../components/modals/PayInvoiceModal';
import { 
  WidgetOrganizerModal, 
  WidgetVisibilityConfig, 
  defaultWidgetConfig 
} from '../components/dashboard/WidgetOrganizerModal';
import { MonthlyBarChart } from '../components/charts/MonthlyBarChart';
import { SobraAiInsightCard } from '../components/dashboard/SobraAiInsightCard';
import { sobraAiEngine } from '../core/ai/sobraAiEngine';
import { SobraAction } from '../core/ai/types';
import { 
  calculateMonthlySummary, 
  calculateSpendingByCategory,
  calculateHistoricalMonthlySummary
} from '../core/calculations';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Account, Transaction } from '../core/types';
import { PayFirstSalaryBanner } from '../components/dashboard/PayFirstSalaryBanner';
import { PayFirstConfigModal } from '../components/modals/PayFirstConfigModal';
import { 
  getPayFirstConfig, 
  evaluatePayFirstBannerVisibility, 
  markMonthPaid, 
  dismissForMonth, 
  PayFirstConfig 
} from '../core/payFirst/payFirstHelper';
import { SmartNotificationService } from '../core/notifications/smartNotificationService';

interface DashboardScreenProps {
  onOpenNewTransaction: (type?: 'expense' | 'income') => void;
  onNavigateToTab: (tab: string) => void;
  onOpenReviewNotification?: (id: string) => void;
  onOpenNewAccount?: (type?: 'credit_card' | 'checking') => void;
  onEditAccount?: (acc: Account) => void;
  onOpenAiChat?: (prompt?: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
  onOpenTransfer?: () => void;
  onOpenRelatorios?: () => void;
  onRegisterModalCloser?: (closer: (() => boolean) | null) => void;
  onOpenProjection?: () => void;
}

const STORAGE_KEY = 'sobra_dashboard_widgets_v1';

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onOpenNewTransaction,
  onNavigateToTab,
  onOpenReviewNotification,
  onOpenNewAccount,
  onEditAccount,
  onOpenAiChat,
  onEditTransaction,
  onOpenTransfer,
  onOpenRelatorios,
  onRegisterModalCloser,
  onOpenProjection,
}) => {
  const { 
    accounts, 
    categories, 
    transactions, 
    budgets, 
    goals,
    subscriptions,
    pendingNotifications,
    isPrivacyMode, 
    togglePrivacyMode
  } = useFinance();

  const { user } = useAuth();

  // Extrai o primeiro nome do usuário logado no Google (ex: "Felipe Rodrigues" -> "Felipe")
  const firstName = React.useMemo(() => {
    if (!user?.displayName) return 'Usuário';
    const clean = user.displayName.trim();
    if (!clean) return 'Usuário';
    const first = clean.split(' ')[0];
    return first.charAt(0).toUpperCase() + first.slice(1);
  }, [user?.displayName]);

  // Estado do mês selecionado na Visão do Mês (padrão: mês atual)
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const selectedYear = currentYear;

  // Modais
  const [isOrganizerOpen, setIsOrganizerOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isCashFlowModalOpen, setIsCashFlowModalOpen] = useState(false);
  const [isMonthCategoriesModalOpen, setIsMonthCategoriesModalOpen] = useState(false);
  const [selectedCardForInvoice, setSelectedCardForInvoice] = useState<Account | null>(null);
  const [selectedCardForPayment, setSelectedCardForPayment] = useState<Account | null>(null);
  const [showAdvancedWidgets, setShowAdvancedWidgets] = useState(false);
  const [isPayFirstModalOpen, setIsPayFirstModalOpen] = useState(false);
  const [payFirstConfig, setPayFirstConfig] = useState<PayFirstConfig>(() => getPayFirstConfig());

  // Escuta atualizações de configuração do Pague-se Primeiro
  React.useEffect(() => {
    const handlePayFirstChanged = () => setPayFirstConfig(getPayFirstConfig());
    window.addEventListener('sobra:pay_first_changed', handlePayFirstChanged);
    return () => window.removeEventListener('sobra:pay_first_changed', handlePayFirstChanged);
  }, []);



  // Avalia visibilidade do banner na tela inicial
  const payFirstStatus = React.useMemo(() => {
    return evaluatePayFirstBannerVisibility(transactions, currentMonth, currentYear);
  }, [transactions, currentMonth, currentYear, payFirstConfig]);

  // Registro de fechamento de modais do Dashboard para o botão voltar do Android e tecla Escape
  React.useEffect(() => {
    if (!onRegisterModalCloser) return;

    if (isCashFlowModalOpen) {
      onRegisterModalCloser(() => {
        setIsCashFlowModalOpen(false);
        return true;
      });
    } else if (isMonthCategoriesModalOpen) {
      onRegisterModalCloser(() => {
        setIsMonthCategoriesModalOpen(false);
        return true;
      });
    } else if (isInvoiceModalOpen || selectedCardForInvoice) {
      onRegisterModalCloser(() => {
        setIsInvoiceModalOpen(false);
        setSelectedCardForInvoice(null);
        return true;
      });
    } else if (selectedCardForPayment) {
      onRegisterModalCloser(() => {
        setSelectedCardForPayment(null);
        return true;
      });
    } else if (isOrganizerOpen) {
      onRegisterModalCloser(() => {
        setIsOrganizerOpen(false);
        return true;
      });
    } else if (isPayFirstModalOpen) {
      onRegisterModalCloser(() => {
        setIsPayFirstModalOpen(false);
        return true;
      });
    } else {
      onRegisterModalCloser(null);
    }
  }, [
    onRegisterModalCloser,
    isCashFlowModalOpen,
    isMonthCategoriesModalOpen,
    isInvoiceModalOpen,
    selectedCardForInvoice,
    selectedCardForPayment,
    isOrganizerOpen,
  ]);

  // Diagnóstico do Sobra AI
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

  const handleExecuteSobraAiAction = (action: SobraAction) => {
    if (action.actionType === 'navigate_tab') {
      onNavigateToTab(action.target);
    }
  };

  const [widgetConfig, setWidgetConfig] = useState<WidgetVisibilityConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaultWidgetConfig, ...JSON.parse(saved) } : defaultWidgetConfig;
    } catch {
      return defaultWidgetConfig;
    }
  });

  const handleSaveConfig = (newConfig: WidgetVisibilityConfig) => {
    setWidgetConfig(newConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch (e) {
      console.error('Falha ao salvar configurações de widgets:', e);
    }
  };

  // Cálculos financeiros reais da conta do usuário (100% não artificiais, respeitando divisão 50/50 em contas conjuntas)
  const selectedMonthSummary = calculateMonthlySummary(transactions, selectedMonth, selectedYear, accounts);
  const selectedMonthSpending = calculateSpendingByCategory(transactions, categories, selectedMonth, selectedYear, accounts);
  const historicalData = calculateHistoricalMonthlySummary(transactions, 6);

  // Mapeamento para o MonthOverviewCard
  const monthOverviewCategories: CategoryBreakdownItem[] = selectedMonthSpending.map(c => ({
    categoryId: c.categoryId,
    categoryName: c.categoryName,
    color: c.color,
    amount: c.amount,
    percentage: c.percentage,
  }));

  // Avalia disparo de todas as notificações inteligentes do sistema (respeitando horários e deduplicação)
  React.useEffect(() => {
    SmartNotificationService.runAllSmartChecks({
      accounts,
      categories,
      transactions,
      budgets,
      subscriptions,
      totalIncome: selectedMonthSummary.income,
      totalExpenses: selectedMonthSummary.expense,
      month: currentMonth,
      year: currentYear,
      onNavigate: onNavigateToTab,
      onOpenCardInvoice: (card) => {
        setSelectedCardForInvoice(card);
        setIsInvoiceModalOpen(true);
      },
    });
  }, [accounts, categories, transactions, budgets, subscriptions, selectedMonthSummary.income, selectedMonthSummary.expense, currentMonth, currentYear, onNavigateToTab]);

  const maskValue = (formatted: string) => {
    return isPrivacyMode ? '••••••' : formatted;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '30px' }}>
      {/* 1. Header do Dashboard (Olá, {firstName} + Sino de Notificação + Sobra AI + Olho de Privacidade) */}
      <SobraTopHeader
        userName={firstName}
        unreadNotificationsCount={pendingNotifications.length}
        onOpenNotifications={() => onNavigateToTab('notifications')}
        onOpenAiChat={onOpenAiChat ? () => onOpenAiChat() : undefined}
        isPrivacyMode={isPrivacyMode}
        onTogglePrivacy={togglePrivacyMode}
      />

      {/* Banner Inteligente Pague-se Primeiro (Aparece apenas quando salário for detectado no mês) */}
      {payFirstStatus.shouldShow && (
        <PayFirstSalaryBanner
          salaryTx={payFirstStatus.salaryTx}
          monthlyAmount={payFirstStatus.monthlyAmount}
          isConfigured={payFirstStatus.isConfigured}
          onMarkAsPaid={() => markMonthPaid(currentMonth, currentYear)}
          onTransfer={() => (onOpenTransfer ? onOpenTransfer() : onNavigateToTab('accounts'))}
          onOpenConfig={() => setIsPayFirstModalOpen(true)}
          onDismiss={() => dismissForMonth(currentMonth, currentYear)}
        />
      )}

      {/* 2. Card Carteira de Faturas Estilo Pierre (Visão de Carteira e Cartões Empilhados) */}
      <CreditCardWalletHero
        cards={accounts}
        transactions={transactions}
        isPrivacyMode={isPrivacyMode}
        maskValue={maskValue}
        onOpenInvoices={() => {
          setSelectedCardForInvoice(null);
          setIsInvoiceModalOpen(true);
        }}
        onAddNewCard={() => (onOpenNewAccount ? onOpenNewAccount('credit_card') : onNavigateToTab('accounts'))}
      />

      {/* 3. Card Fluxo de Caixa nas Contas Estilo Pierre (Entradas, Saídas e Resultado Líquido) */}
      <CashFlowHeroCard
        transactions={transactions}
        accounts={accounts}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        isPrivacyMode={isPrivacyMode}
        maskValue={maskValue}
        onOpenDetails={() => setIsCashFlowModalOpen(true)}
      />

      {/* 5. Seção "Visão do mês" com Seletor de Mês, Donut Chart e Lista de Categorias */}
      <MonthOverviewCard
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onSelectMonth={setSelectedMonth}
        totalExpense={selectedMonthSummary.expense}
        categories={monthOverviewCategories}
        maskValue={maskValue}
        onOpenDetails={() => setIsMonthCategoriesModalOpen(true)}
      />

      {/* 6. Grid Compacta Estilo Pierre: Assinaturas & Ritmo de Gastos lado a lado */}
      <PierreCompactCardsGrid
        subscriptions={subscriptions}
        transactions={transactions}
        accounts={accounts}
        categories={categories}
        isPrivacyMode={isPrivacyMode}
        maskValue={maskValue}
        onOpenSubscriptions={() => onNavigateToTab('subscriptions')}
        onOpenProjection={() => (onOpenProjection ? onOpenProjection() : onNavigateToTab('daily_goal'))}
      />



      {/* Modal de Personalização dos Widgets */}
      <WidgetOrganizerModal
        isOpen={isOrganizerOpen}
        onClose={() => setIsOrganizerOpen(false)}
        config={widgetConfig}
        onSaveConfig={handleSaveConfig}
      />

      {/* Modal de Fatura Detalhada do Cartão Selecionado / Todas as Faturas (Estilo Pierre) */}
      <CardInvoiceModal
        isOpen={isInvoiceModalOpen || !!selectedCardForInvoice}
        onClose={() => {
          setIsInvoiceModalOpen(false);
          setSelectedCardForInvoice(null);
        }}
        card={selectedCardForInvoice}
        transactions={transactions}
        categories={categories}
        isPrivacyMode={isPrivacyMode}
        onAddNewCard={() => {
          setIsInvoiceModalOpen(false);
          setSelectedCardForInvoice(null);
          if (onOpenNewAccount) onOpenNewAccount('credit_card');
        }}
        onAddNewExpense={() => {
          setIsInvoiceModalOpen(false);
          setSelectedCardForInvoice(null);
          onOpenNewTransaction('expense');
        }}
        onEditTransaction={onEditTransaction}
        onPayInvoice={card => {
          setIsInvoiceModalOpen(false);
          setSelectedCardForInvoice(null);
          setSelectedCardForPayment(card);
        }}
        onEditCard={onEditAccount ? card => {
          setIsInvoiceModalOpen(false);
          setSelectedCardForInvoice(null);
          onEditAccount(card);
        } : undefined}
      />

      {/* Modal de Pagamento de Fatura de Cartão */}
      <PayInvoiceModal
        isOpen={!!selectedCardForPayment}
        onClose={() => setSelectedCardForPayment(null)}
        card={selectedCardForPayment}
      />

      {/* Modal de Fluxo de Caixa nas Contas Detalhado (Estilo Pierre Aprimorado) */}
      <CashFlowModal
        isOpen={isCashFlowModalOpen}
        onClose={() => setIsCashFlowModalOpen(false)}
        transactions={transactions}
        accounts={accounts}
        categories={categories}
        isPrivacyMode={isPrivacyMode}
        onTogglePrivacy={togglePrivacyMode}
        onEditTransaction={onEditTransaction}
        onOpenNewAccount={(type) => {
          setIsCashFlowModalOpen(false);
          // Do CashFlow, só abre conta corrente (type sempre vem como 'checking')
          if (onOpenNewAccount) onOpenNewAccount(type);
        }}
        onEditAccount={onEditAccount ? (acc) => {
          setIsCashFlowModalOpen(false);
          onEditAccount(acc);
        } : undefined}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      {/* Modal de Detalhamento por Categoria (Estilo Pierre) */}
      <MonthCategoriesModal
        isOpen={isMonthCategoriesModalOpen}
        onClose={() => setIsMonthCategoriesModalOpen(false)}
        transactions={transactions}
        accounts={accounts}
        categories={categories}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onSelectMonth={setSelectedMonth}
        isPrivacyMode={isPrivacyMode}
        onTogglePrivacy={togglePrivacyMode}
        onEditTransaction={onEditTransaction}
      />

      {/* Modal de Configuração do Pague-se Primeiro */}
      <PayFirstConfigModal
        isOpen={isPayFirstModalOpen}
        onClose={() => setIsPayFirstModalOpen(false)}
      />
    </div>
  );
};
