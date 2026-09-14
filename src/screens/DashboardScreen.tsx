import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { SobraTopHeader } from '../components/dashboard/SobraTopHeader';
import { SobraBalanceHeroCard } from '../components/dashboard/SobraBalanceHeroCard';
import { QuickActionPills } from '../components/dashboard/QuickActionPills';
import { MonthOverviewCard, CategoryBreakdownItem } from '../components/dashboard/MonthOverviewCard';
import { RecentTransactionsSection } from '../components/dashboard/RecentTransactionsSection';
import { FeatureShortcutsSection } from '../components/dashboard/FeatureShortcutsSection';
import { CardsSummarySection } from '../components/dashboard/CardsSummarySection';
import { CardInvoiceModal } from '../components/modals/CardInvoiceModal';
import { PayInvoiceModal } from '../components/modals/PayInvoiceModal';
import { 
  WidgetOrganizerModal, 
  WidgetVisibilityConfig, 
  defaultWidgetConfig 
} from '../components/dashboard/WidgetOrganizerModal';
import { MonthlyBarChart } from '../components/charts/MonthlyBarChart';
import { BurnRateProjectionCard } from '../components/dashboard/BurnRateProjectionCard';
import { SobraAiInsightCard } from '../components/dashboard/SobraAiInsightCard';
import { SobraAiAnalysisModal } from '../components/modals/SobraAiAnalysisModal';
import { sobraAiEngine } from '../core/ai/sobraAiEngine';
import { SobraAction } from '../core/ai/types';
import { 
  calculateFinancialSummary,
  calculateMonthlySummary, 
  calculateSpendingByCategory,
  calculateHistoricalMonthlySummary,
  calculateBurnRateProjection,
  calculateBalanceTrend
} from '../core/calculations';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Account, Transaction } from '../core/types';

interface DashboardScreenProps {
  onOpenNewTransaction: (type?: 'expense' | 'income') => void;
  onNavigateToTab: (tab: string) => void;
  onOpenReviewNotification?: (id: string) => void;
  onOpenNewAccount?: () => void;
  onEditAccount?: (acc: Account) => void;
  onOpenAiChat?: (prompt?: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
  onOpenTransfer?: () => void;
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
    togglePrivacyMode,
    deleteAccount
  } = useFinance();

  // Estado do mês selecionado na Visão do Mês (padrão: mês atual)
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const selectedYear = currentYear;

  // Modais
  const [isOrganizerOpen, setIsOrganizerOpen] = useState(false);
  const [selectedCardForInvoice, setSelectedCardForInvoice] = useState<Account | null>(null);
  const [selectedCardForPayment, setSelectedCardForPayment] = useState<Account | null>(null);
  const [isSobraAiModalOpen, setIsSobraAiModalOpen] = useState(false);
  const [showAdvancedWidgets, setShowAdvancedWidgets] = useState(false);

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

  // Cálculos financeiros reais da conta do usuário (100% não artificiais)
  const financialSummary = calculateFinancialSummary(accounts);
  const selectedMonthSummary = calculateMonthlySummary(transactions, selectedMonth, selectedYear);
  const selectedMonthSpending = calculateSpendingByCategory(transactions, categories, selectedMonth, selectedYear);
  const trend = calculateBalanceTrend(transactions, selectedMonth, selectedYear);
  const historicalData = calculateHistoricalMonthlySummary(transactions, 6);
  const burnRateProjection = calculateBurnRateProjection(transactions);

  // Mapeamento para o MonthOverviewCard
  const monthOverviewCategories: CategoryBreakdownItem[] = selectedMonthSpending.map(c => ({
    categoryId: c.categoryId,
    categoryName: c.categoryName,
    color: c.color,
    amount: c.amount,
    percentage: c.percentage,
  }));

  // Cartões de Crédito
  const creditCards = accounts.filter(a => a.type === 'credit_card');

  const maskValue = (formatted: string) => {
    return isPrivacyMode ? '••••••' : formatted;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '30px' }}>
      {/* 1. Header do Dashboard (Olá, Felipe + Sino de Notificação + Sobra AI) */}
      <SobraTopHeader
        userName="Felipe"
        unreadNotificationsCount={pendingNotifications.length}
        onOpenNotifications={() => onNavigateToTab('notifications')}
        onOpenAiChat={onOpenAiChat ? () => onOpenAiChat() : undefined}
      />

      {/* 2. Card "Seu saldo atual" (Fiel ao Mockup com Dados 100% Reais do Usuário) */}
      <SobraBalanceHeroCard
        cashBalance={financialSummary.cashBalance}
        netSobra={financialSummary.netSobra}
        creditCardDebt={financialSummary.creditCardDebt}
        trend={trend}
        historicalData={historicalData}
        isPrivacyMode={isPrivacyMode}
        onTogglePrivacy={togglePrivacyMode}
        maskValue={maskValue}
      />

      {/* 4. Pílulas de Ação Rápida: [ ↑ Receita ] [ ↓ Despesa ] [ ⇄ Transferir ] */}
      <QuickActionPills
        onAddIncome={() => onOpenNewTransaction('income')}
        onAddExpense={() => onOpenNewTransaction('expense')}
        onTransfer={() => (onOpenTransfer ? onOpenTransfer() : onNavigateToTab('accounts'))}
      />

      {/* 5. Seção "Visão do mês" com Seletor de Mês, Donut Chart e Lista de Categorias */}
      <MonthOverviewCard
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onSelectMonth={setSelectedMonth}
        totalExpense={selectedMonthSummary.expense}
        categories={monthOverviewCategories}
        maskValue={maskValue}
      />

      {/* 6. Seção "Últimas movimentações" com Avatares Circulares e link Ver todas > */}
      <RecentTransactionsSection
        transactions={transactions}
        categories={categories}
        maskValue={maskValue}
        onViewAll={() => onNavigateToTab('transactions')}
        onSelectTransaction={onEditTransaction}
      />

      {/* 7. Cards de Descoberta / Atalhos do Mockup: Metas, Relatórios e Contas */}
      <FeatureShortcutsSection
        onNavigateToMetas={() => onNavigateToTab('budgets')}
        onNavigateToRelatorios={() => setIsSobraAiModalOpen(true)}
        onNavigateToContas={() => onNavigateToTab('accounts')}
      />

      {/* 8. Botão de Expansão para Widgets Adicionais (Cartões, Burn Rate, Sobra AI, Gráfico Semestral) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
        <button
          type="button"
          onClick={() => setShowAdvancedWidgets(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '9999px',
            backgroundColor: '#161F18',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#94A3B8',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.25)';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = '#94A3B8';
          }}
        >
          <span>{showAdvancedWidgets ? 'Ocultar análises adicionais' : 'Ver cartões, raio-x e projeções'}</span>
          {showAdvancedWidgets ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAdvancedWidgets && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Cartões de Crédito */}
            {creditCards.length > 0 && (
              <CardsSummarySection
                cards={creditCards}
                maskValue={maskValue}
                showFullHeader={true}
                onSelectCard={card => setSelectedCardForInvoice(card)}
                onPayInvoice={card => setSelectedCardForPayment(card)}
                onAddNewCard={() => (onOpenNewAccount ? onOpenNewAccount() : onNavigateToTab('accounts'))}
                onAddNewExpenseForCard={() => onOpenNewTransaction('expense')}
                onEditCard={onEditAccount}
                onDeleteCard={id => deleteAccount(id)}
              />
            )}

            {/* Raio-X Sobra AI */}
            <SobraAiInsightCard
              diagnosis={sobraAiDiagnosis}
              onOpenFullAnalysis={() => setIsSobraAiModalOpen(true)}
              onExecuteAction={handleExecuteSobraAiAction}
              onOpenChat={onOpenAiChat}
            />

            {/* Projeção de Burn Rate */}
            <BurnRateProjectionCard
              projection={burnRateProjection}
              maskValue={maskValue}
              onNavigate={onNavigateToTab}
              onOpenAiChat={onOpenAiChat}
            />

            {/* Histórico 6 Meses */}
            <MonthlyBarChart data={historicalData} />
          </div>
        )}
      </div>

      {/* Modal de Personalização dos Widgets */}
      <WidgetOrganizerModal
        isOpen={isOrganizerOpen}
        onClose={() => setIsOrganizerOpen(false)}
        config={widgetConfig}
        onSaveConfig={handleSaveConfig}
      />

      {/* Modal de Fatura Detalhada do Cartão Selecionado */}
      <CardInvoiceModal
        isOpen={!!selectedCardForInvoice}
        onClose={() => setSelectedCardForInvoice(null)}
        card={selectedCardForInvoice}
        transactions={transactions}
        categories={categories}
        isPrivacyMode={isPrivacyMode}
        onAddNewExpense={() => {
          setSelectedCardForInvoice(null);
          onOpenNewTransaction('expense');
        }}
        onEditTransaction={onEditTransaction}
      />

      {/* Modal de Pagamento de Fatura de Cartão */}
      <PayInvoiceModal
        isOpen={!!selectedCardForPayment}
        onClose={() => setSelectedCardForPayment(null)}
        card={selectedCardForPayment}
      />

      {/* Modal de Raio-X Financeiro do Sobra AI */}
      <SobraAiAnalysisModal
        isOpen={isSobraAiModalOpen}
        onClose={() => setIsSobraAiModalOpen(false)}
        diagnosis={sobraAiDiagnosis}
        onExecuteAction={handleExecuteSobraAiAction}
        onOpenChat={onOpenAiChat}
      />
    </div>
  );
};
