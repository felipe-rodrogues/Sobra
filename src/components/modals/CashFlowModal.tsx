import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  CreditCard, 
  DollarSign, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  X, 
  Wallet, 
  Plus, 
  Users, 
  ChevronRight,
  Receipt,
  Zap
} from 'lucide-react';
import { Transaction, Account, Category } from '../../core/types';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { BankLogo } from '../common/BankLogo';
import { IconRenderer } from '../common/IconRenderer';
import { 
  calculateCashFlow, 
  CashFlowPeriod, 
  DailyCashFlowPoint, 
  isCardPurchase, 
  isInvoicePayment 
} from '../../core/cashFlow/cashFlowHelper';
import { getEffectiveTransactionAmount } from '../../core/calculations';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from '../common/SwipeBackIndicator';
import { JoinSharedAccountModal } from './JoinSharedAccountModal';

interface CashFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  isPrivacyMode: boolean;
  onTogglePrivacy: () => void;
  onEditTransaction?: (tx: Transaction) => void;
  onOpenNewAccount?: (type?: 'checking' | 'credit_card') => void;
  onEditAccount?: (acc: Account) => void;
  selectedMonth?: number;
  selectedYear?: number;
}

export const CashFlowModal: React.FC<CashFlowModalProps> = ({
  isOpen,
  onClose,
  transactions,
  accounts,
  categories,
  isPrivacyMode,
  onTogglePrivacy,
  onEditTransaction,
  onOpenNewAccount,
  onEditAccount,
  selectedMonth,
  selectedYear,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense'>('all');
  const [period, setPeriod] = useState<CashFlowPeriod>('this_month');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const now = new Date();
  const currentMonth = selectedMonth || (now.getMonth() + 1);
  const currentYear = selectedYear || now.getFullYear();

  const summary = useMemo(() => {
    return calculateCashFlow(transactions, accounts, period, currentMonth, currentYear, isSimulating);
  }, [transactions, accounts, period, currentMonth, currentYear, isSimulating]);

  const handleClose = () => {
    setIsSimulating(false);
    onClose();
  };

  const swipeState = useSwipeBack({ onBack: handleClose, enabled: isOpen });

  const maskValue = (v: string) => (isPrivacyMode ? '••••••' : v);

  // Filtragem das transações da lista conforme a aba ativa e dia selecionado
  const displayedTransactions = useMemo(() => {
    return summary.transactions.filter(tx => {
      if (activeTab === 'income' && tx.type !== 'income') return false;
      if (activeTab === 'expense' && tx.type !== 'expense') return false;

      if (selectedDay !== null) {
        const d = new Date(tx.date);
        if (d.getUTCDate() !== selectedDay) return false;
      }

      return true;
    });
  }, [summary.transactions, activeTab, selectedDay]);

  // Formatação amigável de cabeçalho de grupo diário (estilo Pierre)
  const formatGroupHeader = (dateStr: string): string => {
    const cleanStr = dateStr.substring(0, 10);
    const [y, m, d] = cleanStr.split('-').map(Number);
    const txDate = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = today.getTime() - txDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    
    if (diffDays > 1 && diffDays <= 6) {
      const weekday = txDate.toLocaleDateString('pt-BR', { weekday: 'long' });
      return weekday.charAt(0).toUpperCase() + weekday.slice(1);
    }
    
    const monthName = txDate.toLocaleDateString('pt-BR', { month: 'long' });
    if (txDate.getFullYear() === now.getFullYear()) {
      return `${d} de ${monthName}`;
    }
    return `${d} de ${monthName} de ${txDate.getFullYear()}`;
  };

  // Formatação compacta de data e hora para exibição acima do valor
  const formatTxDateTime = (dateStr: string): string => {
    if (!dateStr) return '';
    const cleanDate = dateStr.substring(0, 10);
    const [y, m, d] = cleanDate.split('-').map(Number);
    const txDate = new Date(y, m - 1, d);
    const day = String(d).padStart(2, '0');
    const month = txDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    
    if (dateStr.includes('T') || (dateStr.includes(':') && dateStr.includes(' '))) {
      const fullDate = new Date(dateStr);
      const hours = String(fullDate.getHours()).padStart(2, '0');
      const mins = String(fullDate.getMinutes()).padStart(2, '0');
      if (hours !== '00' || mins !== '00' || dateStr.includes('T')) {
        return `${day} ${month}, ${hours}:${mins}`;
      }
    }
    return `${day} de ${month}`;
  };

  // Agrupamento cronológico diário das transações exibidas
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: { label: string; dateStr: string; txs: Transaction[] } } = {};
    
    displayedTransactions.forEach(tx => {
      const dateKey = tx.date.substring(0, 10);
      if (!groups[dateKey]) {
        groups[dateKey] = {
          label: formatGroupHeader(tx.date),
          dateStr: dateKey,
          txs: [],
        };
      }
      groups[dateKey].txs.push(tx);
    });
    
    return Object.entries(groups)
      .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
      .map(([dateKey, group]) => ({
        dateKey,
        label: group.label,
        transactions: group.txs,
      }));
  }, [displayedTransactions]);

  // Valor principal em destaque baseado na aba ativa
  let mainDisplayValue = summary.netFlow;
  let mainDisplayLabel = `Fluxo geral em ${summary.selectedMonthName}`;

  if (activeTab === 'income') {
    mainDisplayValue = summary.totalIncome;
    mainDisplayLabel = `Entradas em ${summary.selectedMonthName}`;
  } else if (activeTab === 'expense') {
    mainDisplayValue = summary.totalExpense;
    mainDisplayLabel = `Saídas em ${summary.selectedMonthName}`;
  }

  // Percentuais de decomposição de saída (Cartão vs Pix/Boletos)
  const totalExp = summary.totalExpense;
  const cardPercent = totalExp > 0 ? Math.round((summary.cardPurchasesAmount / totalExp) * 100) : 0;
  const directPercent = totalExp > 0 ? Math.round((summary.directExpensesAmount / totalExp) * 100) : 0;

  // Consulta rápida de categoria e conta
  const getCategoryInfo = (catId?: string) => {
    return categories.find(c => c.id === catId);
  };

  const getAccountInfo = (accId?: string) => {
    return accounts.find(a => a.id === accId);
  };

  if (!isOpen) return null;

  return (
    <>
      <SwipeBackIndicator swipeState={swipeState} />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 2500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0',
        }}
      onClick={handleClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          height: '100vh',
          maxHeight: '100vh',
          backgroundColor: '#0A0E0C',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflowY: 'auto',
          position: 'relative',
          paddingBottom: 'calc(100px + var(--safe-area-bottom, 0px))',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 1. Header Fiel ao Pierre: Botão Voltar + Olho de Privacidade */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'calc(var(--safe-area-top, 0px) + 14px) 20px 12px',
            position: 'sticky',
            top: 0,
            backgroundColor: '#0A0E0C',
            zIndex: 20,
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#161F18',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
          >
            <ArrowLeft size={20} />
          </button>

          <h2
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 700,
              color: '#FFFFFF',
              fontFamily: "'Outfit', 'Inter', sans-serif",
            }}
          >
            Fluxo de Caixa
          </h2>

          <button
            type="button"
            onClick={onTogglePrivacy}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#161F18',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isPrivacyMode ? '#4ADE80' : '#94A3B8',
              cursor: 'pointer',
            }}
            title={isPrivacyMode ? 'Exibir valores' : 'Ocultar valores'}
          >
            {isPrivacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Conteúdo Rolável do Modal */}
        <div style={{ padding: '0 20px 40px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* 2. Abas Segmentadas: [ Geral ] [ Entradas ] [ Saídas ] */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#141A16',
              borderRadius: '9999px',
              padding: '4px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {(['all', 'income', 'expense'] as const).map(tab => {
              const isActive = activeTab === tab;
              const labels = {
                all: 'Geral',
                income: 'Entradas',
                expense: 'Saídas',
              };

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    padding: '8px 14px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                    color: isActive ? '#0F172A' : '#94A3B8',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                  }}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* 3. Destaque Numérico Principal e Resumo de Entradas/Saídas */}
          <div>
            <span style={{ fontSize: '0.86rem', color: '#94A3B8', fontWeight: 500 }}>
              {mainDisplayLabel}
            </span>

            <div
              style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                color: activeTab === 'expense' ? '#F87171' : activeTab === 'income' ? '#4ADE80' : mainDisplayValue >= 0 ? '#FFFFFF' : '#F87171',
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                marginTop: '4px',
                fontFamily: "'Outfit', 'Inter', sans-serif",
              }}
            >
              {activeTab === 'all' && mainDisplayValue >= 0 ? '+' : ''}
              {activeTab === 'expense' && mainDisplayValue > 0 ? '-' : ''}
              {maskValue(formatBrlCurrency(Math.abs(mainDisplayValue)))}
            </div>

            {/* Pontos de Resumo Entradas vs Saídas */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginTop: '10px',
                fontSize: '0.88rem',
                fontWeight: 600,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#E2E8F0' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4ADE80' }} />
                <span>Entradas {maskValue(formatBrlCurrency(summary.totalIncome))}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#E2E8F0' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F87171' }} />
                <span>Saídas {maskValue(formatBrlCurrency(summary.totalExpense))}</span>
              </div>
            </div>

            {/* Microcópia Explicativa e Botão Simular fatura */}
            <p
              style={{
                fontSize: '0.78rem',
                color: '#64748B',
                lineHeight: 1.45,
                marginTop: '10px',
                margin: '10px 0 0',
              }}
            >
              Considera só o dinheiro que entrou e saiu da conta. Compras no cartão entram quando a fatura é paga.
            </p>

            {/* Botão de Simulação em Pílula com Iluminação Suave Branca */}
            <div style={{ marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => setIsSimulating(prev => !prev)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '9999px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  backgroundColor: isSimulating ? 'rgba(255, 255, 255, 0.12)' : '#141A16',
                  color: isSimulating ? '#FFFFFF' : '#94A3B8',
                  border: isSimulating ? '1px solid #FFFFFF' : '1px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: isSimulating ? '0 0 18px rgba(255, 255, 255, 0.4)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  letterSpacing: '-0.01em',
                }}
              >
                Simular fatura
              </button>

              {isSimulating && (
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '0.76rem',
                    color: '#E2E8F0',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    padding: '7px 12px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Faturas abertas incluídas no fluxo</span>
                  <span style={{ fontWeight: 700, color: '#FFFFFF' }}>+{maskValue(formatBrlCurrency(summary.openInvoicesAmount))}</span>
                </div>
              )}
            </div>
          </div>

          {/* 4. Decomposição das Saídas: Cartão vs Pix/Contas (Inovação Sobra) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
            }}
          >
            {/* Card 1: Compras no Cartão de Crédito */}
            <div
              style={{
                backgroundColor: '#121814',
                borderRadius: '16px',
                padding: '12px 10px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94A3B8', fontSize: '0.74rem', minWidth: 0 }}>
                <CreditCard size={13} color="#A78BFA" style={{ flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap', fontWeight: 600, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Cartão de Crédito
                </span>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF' }}>
                {maskValue(formatBrlCurrency(summary.cardPurchasesAmount))}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                {cardPercent}% das saídas
              </span>
            </div>

            {/* Card 2: Pix, Boletos e Débito Direto */}
            <div
              style={{
                backgroundColor: '#121814',
                borderRadius: '16px',
                padding: '12px 10px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94A3B8', fontSize: '0.74rem', minWidth: 0 }}>
                <DollarSign size={13} color="#4ADE80" strokeWidth={2.4} style={{ flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap', fontWeight: 600, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Pix e Boletos
                </span>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF' }}>
                {maskValue(formatBrlCurrency(summary.directExpensesAmount))}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                {directPercent}% das saídas
              </span>
            </div>
          </div>

          {/* 5. Gráfico Diário Interativo (Superando os círculos vazios do Pierre) */}
          <div
            style={{
              backgroundColor: '#121814',
              borderRadius: '20px',
              padding: '14px 16px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8' }}>
                Movimentação Diária ({summary.selectedMonthName})
              </span>
              {selectedDay !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'rgba(74, 222, 128, 0.15)',
                    color: '#4ADE80',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <span>Dia {selectedDay}</span>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Linha horizontal de dias do mês */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '5px',
                overflowX: 'auto',
                paddingBottom: '6px',
                scrollbarWidth: 'none',
              }}
            >
              {summary.dailyPoints.map(point => {
                const isSelected = selectedDay === point.day;
                const hasActivity = point.transactionCount > 0;
                const isPositive = point.net >= 0;

                // Altura proporcional da barra
                const maxDayVal = Math.max(...summary.dailyPoints.map(p => Math.max(p.income, p.expense)), 100);
                const barHeight = hasActivity
                  ? Math.max(14, Math.min(48, Math.round((Math.max(point.income, point.expense) / maxDayVal) * 48)))
                  : 4;

                const barColor = isSelected
                  ? '#FFFFFF'
                  : !hasActivity
                  ? 'rgba(255, 255, 255, 0.08)'
                  : isPositive && point.income > 0
                  ? '#4ADE80'
                  : '#F87171';

                return (
                  <div
                    key={point.day}
                    onClick={() => setSelectedDay(prev => (prev === point.day ? null : point.day))}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      width: '26px',
                    }}
                  >
                    {/* Barra vertical do dia */}
                    <div
                      style={{
                        width: '8px',
                        height: `${barHeight}px`,
                        borderRadius: '9999px',
                        backgroundColor: barColor,
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected ? '0 0 10px rgba(255, 255, 255, 0.5)' : 'none',
                      }}
                    />

                    {/* Número do dia */}
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: isSelected ? 800 : 500,
                        color: isSelected ? '#FFFFFF' : hasActivity ? '#94A3B8' : '#475569',
                      }}
                    >
                      {String(point.day).padStart(2, '0')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. Filtros Temporais em Pílula: [ Este mês ] [ 3m ] [ 6m ] [ 1a ] */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#141A16',
              borderRadius: '9999px',
              padding: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              gap: '4px',
            }}
          >
            {([
              { id: 'this_month', label: 'Este mês', flex: '1.7' },
              { id: '3m', label: '3m', flex: '1' },
              { id: '6m', label: '6m', flex: '1' },
              { id: '1y', label: '1a', flex: '1' },
            ] as const).map(p => {
              const isActive = period === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  style={{
                    flex: p.flex,
                    padding: '10px 14px',
                    borderRadius: '9999px',
                    border: 'none',
                    backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                    color: isActive ? '#0F172A' : '#CBD5E1',
                    fontSize: '0.94rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* 7. Lista de Movimentações de Caixa (Design Limpo & Minimalista Pierre) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Header da Seção */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                  Movimentações
                </span>
                {selectedDay !== null && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#4ADE80',
                      backgroundColor: 'rgba(74, 222, 128, 0.12)',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                    }}
                  >
                    Dia {selectedDay}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
                {displayedTransactions.length} {displayedTransactions.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            {displayedTransactions.length === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#121814',
                  borderRadius: '16px',
                  border: '1px dashed rgba(255, 255, 255, 0.08)',
                }}
              >
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#E2E8F0' }}>
                  Nenhum lançamento no período
                </span>
                <span style={{ fontSize: '0.78rem', color: '#64748B', maxWidth: '300px', lineHeight: 1.45 }}>
                  {selectedDay !== null
                    ? `Não há movimentações registradas no dia ${selectedDay}.`
                    : activeTab !== 'all'
                    ? `Não há ${activeTab === 'income' ? 'entradas' : 'saídas'} registradas para este filtro.`
                    : 'Nenhuma movimentação de caixa encontrada no período.'}
                </span>
                {selectedDay !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
                    style={{
                      marginTop: '8px',
                      padding: '6px 16px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(74, 222, 128, 0.1)',
                      border: '1px solid rgba(74, 222, 128, 0.25)',
                      color: '#4ADE80',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Ver mês completo
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {groupedTransactions.map(group => (
                  <div key={group.dateKey} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* Cabeçalho do Dia */}
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#8E8E93', padding: '0 4px' }}>
                      {group.label}
                    </div>

                    {/* Card Container do Dia */}
                    <div
                      style={{
                        backgroundColor: '#121814',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        overflow: 'hidden',
                      }}
                    >
                      {group.transactions.map((tx, idx) => {
                        const isIncome = tx.type === 'income';
                        const account = getAccountInfo(tx.accountId);
                        const category = getCategoryInfo(tx.categoryId);
                        const isInvoice = isInvoicePayment(tx);

                        const categoryIcon = isInvoice
                          ? 'Receipt'
                          : category?.icon || (isIncome ? 'TrendingUp' : 'ShoppingBag');

                        // Subtítulo contendo somente a categoria (e parcelas se houver)
                        const categoryName = category?.name || 'Geral';
                        const subtitle = tx.isInstallment && tx.installmentTotal
                          ? `${categoryName} • ${tx.installmentNumber}/${tx.installmentTotal}x`
                          : categoryName;

                        const effectiveAmount = getEffectiveTransactionAmount(tx, accounts);
                        const isSharedAcc = !!account?.isShared && effectiveAmount !== tx.amount;

                        return (
                          <div
                            key={tx.id}
                            onClick={() => onEditTransaction && onEditTransaction(tx)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '13px 16px',
                              borderBottom: idx < group.transactions.length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                              cursor: onEditTransaction ? 'pointer' : 'default',
                              transition: 'background-color 0.15s ease',
                            }}
                            onMouseEnter={e => {
                              if (onEditTransaction) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            {/* Lado Esquerdo: Avatar Circular com Badge do Banco Sobreposto + Textos */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                              <div style={{ position: 'relative', width: '38px', height: '38px', flexShrink: 0 }}>
                                <div
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '50%',
                                    backgroundColor: isIncome ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                                    color: isIncome ? '#4ADE80' : '#94A3B8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <IconRenderer name={categoryIcon} size={18} />
                                </div>

                                {/* Logo do Banco Sobreposto no Canto Inferior Direito do Círculo */}
                                {account && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      bottom: '-2px',
                                      right: '-2px',
                                      width: '16px',
                                      height: '16px',
                                      borderRadius: '50%',
                                      backgroundColor: '#0A0E0C',
                                      boxShadow: '0 0 0 1.5px #0A0E0C',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <BankLogo bankId={account.bankId || account.name} size={12} />
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                                <span
                                  style={{
                                    fontSize: '0.92rem',
                                    fontWeight: 600,
                                    color: '#FFFFFF',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {tx.description}
                                </span>

                                <span
                                  style={{
                                    fontSize: '0.76rem',
                                    color: '#8E8E93',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {subtitle}
                                </span>
                              </div>
                            </div>

                            {/* Lado Direito: Data e Hora acima do Valor de Destaque + Seta */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                <span
                                  style={{
                                    fontSize: '0.70rem',
                                    color: '#64748B',
                                    fontWeight: 500,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {formatTxDateTime(tx.date)}
                                </span>

                                <span
                                  style={{
                                    fontSize: '0.96rem',
                                    fontWeight: 700,
                                    color: isIncome ? '#4ADE80' : '#FFFFFF',
                                    fontFamily: "'Outfit', 'Inter', sans-serif",
                                    letterSpacing: '-0.01em',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {isIncome ? '+R$ ' : '-R$ '}
                                  {maskValue(formatBrlCurrency(effectiveAmount).replace('R$', '').trim())}
                                </span>

                                {isSharedAcc && (
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      color: '#38BDF8',
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Sua parte ({account?.splitMode === 'half' ? '50%' : `${Math.round((account?.splitRatio ?? 0.5) * 100)}%`})
                                  </span>
                                )}
                              </div>

                              {onEditTransaction && (
                                <ChevronRight size={14} color="#475569" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 8. Seção Contas Bancárias & Carteiras */}
          <div
            style={{
              backgroundColor: '#121814',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              overflow: 'hidden',
            }}
          >
            {/* Header da Seção */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px 12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={15} color="#4ADE80" />
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Contas Bancárias
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Botão Entrar com Código */}
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(74, 222, 128, 0.08)',
                    border: '1px solid rgba(74, 222, 128, 0.2)',
                    color: '#4ADE80',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.14)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.08)'; }}
                  title="Entrar em conta conjunta com código"
                >
                  <Users size={11} />
                  <span>Entrar com Código</span>
                </button>

                {/* Botão + Nova Conta */}
                {onOpenNewAccount && (
                  <button
                    type="button"
                    onClick={() => onOpenNewAccount('checking')}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: '#4ADE80',
                      border: 'none',
                      color: '#000000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(74, 222, 128, 0.3)',
                      transition: 'transform 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    title="Nova conta bancária"
                  >
                    <Plus size={15} strokeWidth={2.8} />
                  </button>
                )}
              </div>
            </div>

            {/* Lista de Contas */}
            {(() => {
              const bankAccounts = accounts.filter(a => a.type !== 'credit_card');
              const totalCash = bankAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

              if (bankAccounts.length === 0) {
                return (
                  <div
                    style={{
                      padding: '28px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      textAlign: 'center',
                    }}
                  >
                    <Wallet size={26} color="#475569" />
                    <span style={{ fontSize: '0.84rem', color: '#64748B' }}>
                      Nenhuma conta corrente ou carteira cadastrada.
                    </span>
                    {onOpenNewAccount && (
                      <button
                        type="button"
                        onClick={() => onOpenNewAccount('checking')}
                        style={{
                          padding: '7px 16px',
                          borderRadius: '9999px',
                          backgroundColor: 'rgba(74, 222, 128, 0.1)',
                          border: '1px solid rgba(74, 222, 128, 0.25)',
                          color: '#4ADE80',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        + Adicionar Conta
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Saldo Total Hero */}
                  <div
                    style={{
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 500 }}>
                      Saldo total disponível
                    </span>
                    <span
                      style={{
                        fontSize: '1.2rem',
                        fontWeight: 800,
                        color: totalCash >= 0 ? '#4ADE80' : '#F87171',
                        fontFamily: "'Outfit', 'Inter', sans-serif",
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {maskValue(formatBrlCurrency(totalCash))}
                    </span>
                  </div>

                  {/* Lista de Cada Conta */}
                  {bankAccounts.map((acc, idx) => (
                    <div
                      key={acc.id}
                      onClick={() => onEditAccount && onEditAccount(acc)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '13px 18px',
                        borderBottom: idx < bankAccounts.length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                        cursor: onEditAccount ? 'pointer' : 'default',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        if (onEditAccount) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* Logo + Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            overflow: 'hidden',
                          }}
                        >
                          <BankLogo bankId={acc.bankId || acc.name} size={23} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              color: '#FFFFFF',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {acc.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '1px' }}>
                            {acc.type === 'checking' ? 'Conta Corrente'
                              : acc.type === 'savings' ? 'Poupança / Reserva'
                              : acc.type === 'investment' ? 'Investimentos'
                              : acc.type === 'cash' ? 'Dinheiro em Espécie'
                              : 'Conta Bancária'}
                          </div>
                        </div>
                      </div>

                      {/* Saldo + Seta */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '10px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              fontSize: '0.94rem',
                              fontWeight: 800,
                              color: (acc.balance || 0) >= 0 ? '#FFFFFF' : '#F87171',
                              fontFamily: "'Outfit', 'Inter', sans-serif",
                            }}
                          >
                            {maskValue(formatBrlCurrency(acc.balance || 0))}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '1px' }}>Disponível</div>
                        </div>
                        {onEditAccount && (
                          <ChevronRight size={15} color="#475569" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

        </div>
      </div>
    </div>

    {/* Modal de Entrar em Conta Conjunta via Código */}
    <JoinSharedAccountModal
      isOpen={isJoinModalOpen}
      onClose={() => setIsJoinModalOpen(false)}
    />
    </>
  );
};
