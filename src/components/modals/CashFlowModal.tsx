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
  X
} from 'lucide-react';
import { Transaction, Account, Category } from '../../core/types';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { BankLogo } from '../common/BankLogo';
import { 
  calculateCashFlow, 
  CashFlowPeriod, 
  DailyCashFlowPoint, 
  isCardPurchase 
} from '../../core/cashFlow/cashFlowHelper';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from '../common/SwipeBackIndicator';

interface CashFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  isPrivacyMode: boolean;
  onTogglePrivacy: () => void;
  onEditTransaction?: (tx: Transaction) => void;
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
  selectedMonth,
  selectedYear,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense'>('all');
  const [period, setPeriod] = useState<CashFlowPeriod>('this_month');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

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

  if (!isOpen) return null;

  const maskValue = (v: string) => (isPrivacyMode ? '••••••' : v);

  // Filtragem das transações da lista conforme a aba ativa e dia selecionado
  const displayedTransactions = summary.transactions.filter(tx => {
    if (activeTab === 'income' && tx.type !== 'income') return false;
    if (activeTab === 'expense' && tx.type !== 'expense') return false;

    if (selectedDay !== null) {
      const d = new Date(tx.date);
      if (d.getUTCDate() !== selectedDay) return false;
    }

    return true;
  });

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

  // Percentuais de decomposição de saída
  const totalExp = summary.totalExpense || 1;
  const cardPercent = Math.round((summary.cardPurchasesAmount / totalExp) * 100);
  const directPercent = Math.round((summary.directExpensesAmount / totalExp) * 100);

  // Categoria de cada transação
  const getCategoryName = (catId?: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat?.name || 'Geral';
  };

  const getAccountInfo = (accId?: string) => {
    return accounts.find(a => a.id === accId);
  };

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
            padding: '18px 20px 12px',
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
          {summary.totalExpense > 0 && (
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
          )}

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

          {/* 7. Lista de Últimos Lançamentos de Caixa */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF' }}>
                Últimos lançamentos
              </span>
              <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                {displayedTransactions.length} movimentações
              </span>
            </div>

            {displayedTransactions.length === 0 ? (
              <div
                style={{
                  padding: '30px 20px',
                  textAlign: 'center',
                  color: '#64748B',
                  fontSize: '0.84rem',
                  backgroundColor: '#121814',
                  borderRadius: '16px',
                  border: '1px dashed rgba(255, 255, 255, 0.08)',
                }}
              >
                Nenhum lançamento no período ou dia selecionado.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {displayedTransactions.map(tx => {
                  const isIncome = tx.type === 'income';
                  const account = getAccountInfo(tx.accountId);
                  const isCard = isCardPurchase(tx, accounts);

                  const dateObj = new Date(tx.date);
                  const formattedDate = `${dateObj.getUTCDate()} de ${summary.selectedMonthName.slice(0, 3).toLowerCase()}`;

                  return (
                    <div
                      key={tx.id}
                      onClick={() => onEditTransaction && onEditTransaction(tx)}
                      style={{
                        backgroundColor: '#121814',
                        borderRadius: '16px',
                        padding: '12px 14px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: onEditTransaction ? 'pointer' : 'default',
                        transition: 'border-color 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.25)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <BankLogo bankId={account?.bankId} size={32} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: '0.88rem',
                              fontWeight: 700,
                              color: '#FFFFFF',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {tx.description}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#94A3B8' }}>
                            <span>{formattedDate}</span>
                            <span>•</span>
                            <span>{getCategoryName(tx.categoryId)}</span>
                            {isCard && (
                              <>
                                <span>•</span>
                                <span style={{ color: '#A78BFA' }}>Crédito</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '0.94rem',
                          fontWeight: 700,
                          color: isIncome ? '#4ADE80' : '#F87171',
                          fontFamily: "'Outfit', 'Inter', sans-serif",
                          flexShrink: 0,
                          marginLeft: '10px',
                        }}
                      >
                        {isIncome ? '+' : '-'}{maskValue(formatBrlCurrency(tx.amount))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};
