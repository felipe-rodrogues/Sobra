import React, { useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Transaction, Account } from '../core/types';
import { getActiveInstallmentGroups } from '../core/installments/installmentHelper';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { resolveTransactionAuthorBadge } from '../core/cards/cardSelectionHelper';
import { BrandLogo } from '../components/common/BrandLogo';
import { BankLogo } from '../components/common/BankLogo';
import { SwipeBackView } from '../components/common/SwipeBackView';
import { INSTALLMENT_SORT_OPTIONS, InstallmentSortOption } from '../components/modals/CardInvoiceModal';
import { 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  Layers, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  CreditCard,
  Landmark,
  ArrowUpDown,
  Users,
  Check
} from 'lucide-react';

interface InstallmentsHubScreenProps {
  onBack?: () => void;
  onEditTransaction?: (tx: Transaction) => void;
}

export type InstallmentSortMode = 'recent' | 'ending_soon' | 'highest_monthly' | 'highest_remaining';

export const InstallmentsHubScreen: React.FC<InstallmentsHubScreenProps> = ({
  onBack,
  onEditTransaction,
}) => {
  const { 
    transactions, 
    accounts, 
    categories, 
    isPrivacyMode, 
    togglePrivacyMode,
    partnershipSpace,
  } = useFinance();
  const { user } = useAuth();
  const { colors } = useTheme();

  // Filtro por conta / cartão ('all' | accountId | 'checking')
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<InstallmentSortOption>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = localStorage.getItem('sobra_installment_sort');
        if (saved && ['recent', 'ending_soon', 'highest_monthly', 'highest_remaining', 'longest'].includes(saved)) {
          return saved as InstallmentSortOption;
        }
      } catch {
        // ignore
      }
    }
    return 'recent';
  });
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [sortDragY, setSortDragY] = useState(0);
  const sortTouchStartY = useRef<number | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);

  const maskValue = (formatted: string) => (isPrivacyMode ? '••••••' : formatted);

  // Grupos consolidados de parcelamentos calculados sobre as transações
  const allGroups = useMemo(() => {
    return getActiveInstallmentGroups(transactions, undefined, false, accounts);
  }, [transactions, accounts]);

  // Parcelamentos ativos (com parcelas pendentes a pagar)
  const activeGroups = useMemo(() => {
    return allGroups.filter(g => !g.isCompleted && g.remainingAmount > 0);
  }, [allGroups]);

  // Parcelamentos já quitados
  const completedGroups = useMemo(() => {
    return allGroups.filter(g => g.isCompleted || g.remainingAmount <= 0);
  }, [allGroups]);

  // Métricas do Hero Card (baseadas exclusivamente nas compras ativas)
  const totalRemainingDebt = useMemo(() => {
    return activeGroups.reduce((acc, g) => acc + g.remainingAmount, 0);
  }, [activeGroups]);

  const totalMonthlyCommitment = useMemo(() => {
    return activeGroups.reduce((acc, g) => acc + g.monthlyAmount, 0);
  }, [activeGroups]);

  // Identificação de cartões e contas bancárias com compras ativas
  const { creditCardFilters, bankAccountFilters } = useMemo(() => {
    const cardMap = new Map<string, { account: Account; count: number }>();
    const bankMap = new Map<string, { account?: Account; count: number; name: string; bankId?: string }>();

    for (const g of activeGroups) {
      const acc = g.accountId ? accountMap.get(g.accountId) : undefined;
      const isCard = (acc && acc.type === 'credit_card') || (!acc && g.transactions[0]?.paymentMethod === 'credit');

      if (isCard && acc) {
        const cur = cardMap.get(acc.id) || { account: acc, count: 0 };
        cur.count += 1;
        cardMap.set(acc.id, cur);
      } else {
        const key = acc?.id || 'checking';
        const name = acc?.name || 'Conta Corrente';
        const cur = bankMap.get(key) || { account: acc, count: 0, name, bankId: acc?.bankId };
        cur.count += 1;
        bankMap.set(key, cur);
      }
    }

    return {
      creditCardFilters: Array.from(cardMap.values()),
      bankAccountFilters: Array.from(bankMap.values()),
    };
  }, [activeGroups, accountMap]);

  // Filtragem dos grupos de acordo com a pílula selecionada
  const filteredActiveGroups = useMemo(() => {
    let list = activeGroups;

    if (selectedAccountFilter === 'checking') {
      list = list.filter(g => {
        const acc = g.accountId ? accountMap.get(g.accountId) : undefined;
        return !acc || acc.type !== 'credit_card';
      });
    } else if (selectedAccountFilter !== 'all') {
      list = list.filter(g => g.accountId === selectedAccountFilter);
    }

    // Ordenação inteligente
    return [...list].sort((a, b) => {
      switch (sortMode) {
        case 'ending_soon': {
          if (a.remainingInstallmentsCount !== b.remainingInstallmentsCount) {
            return a.remainingInstallmentsCount - b.remainingInstallmentsCount;
          }
          return b.monthlyAmount - a.monthlyAmount;
        }
        case 'highest_monthly': {
          if (b.monthlyAmount !== a.monthlyAmount) {
            return b.monthlyAmount - a.monthlyAmount;
          }
          return b.remainingAmount - a.remainingAmount;
        }
        case 'highest_remaining': {
          if (b.remainingAmount !== a.remainingAmount) {
            return b.remainingAmount - a.remainingAmount;
          }
          return b.monthlyAmount - a.monthlyAmount;
        }
        case 'longest': {
          if (b.remainingInstallmentsCount !== a.remainingInstallmentsCount) {
            return b.remainingInstallmentsCount - a.remainingInstallmentsCount;
          }
          return b.originalTotalAmount - a.originalTotalAmount;
        }
        case 'recent':
        default: {
          const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
          const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
          if (dateB !== dateA) return dateB - dateA;
          return b.originalTotalAmount - a.originalTotalAmount;
        }
      }
    });
  }, [activeGroups, selectedAccountFilter, sortMode, accountMap]);

  const handleSortTouchStart = (e: React.TouchEvent) => {
    sortTouchStartY.current = e.touches[0].clientY;
  };

  const handleSortTouchMove = (e: React.TouchEvent) => {
    if (sortTouchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - sortTouchStartY.current;
    if (deltaY > 0) {
      setSortDragY(deltaY);
    }
  };

  const handleSortTouchEnd = () => {
    if (sortDragY > 70) {
      setIsSortModalOpen(false);
    }
    setSortDragY(0);
    sortTouchStartY.current = null;
  };

  const handleSelectSort = useCallback((opt: InstallmentSortOption) => {
    setSortMode(opt);
    setIsSortModalOpen(false);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('sobra_installment_sort', opt);
      }
    } catch {
      // ignore
    }
  }, []);

  const currentSortObj = useMemo(() => {
    return INSTALLMENT_SORT_OPTIONS.find(o => o.id === sortMode) || INSTALLMENT_SORT_OPTIONS[0];
  }, [sortMode]);

  return (
    <SwipeBackView onBack={onBack}>
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          margin: '0 auto',
          minHeight: '100vh',
          backgroundColor: '#0A0B0D',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          paddingBottom: 'calc(40px + var(--safe-area-bottom, 0px))',
        }}
      >
        {/* 1. Header Fixo e Compacto (sem quebra de texto) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            backgroundColor: '#0A0B0D',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background-color 0.15s ease',
                }}
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  letterSpacing: '-0.02em',
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Compras Parceladas
              </h1>
              <p
                style={{
                  fontSize: '0.74rem',
                  color: '#94A3B8',
                  margin: '1px 0 0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Planos ativos e parcelas futuras
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={togglePrivacyMode}
              title={isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores'}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isPrivacyMode ? '#F59E0B' : '#94A3B8',
                cursor: 'pointer',
                transition: 'color 0.15s ease',
              }}
            >
              {isPrivacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* 2. Conteúdo da Tela */}
        <div
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxSizing: 'border-box',
          }}
        >
          {/* Card Hero: Resumo Consolidado do Saldo a Quitar (Estrutura anti-quebra) */}
          <div
            style={{
              backgroundColor: '#121418',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <Layers size={18} color="#94A3B8" style={{ flexShrink: 0 }} />
              <span
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  color: '#94A3B8',
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Saldo a Quitar
              </span>
            </div>

            <div
              style={{
                fontSize: '2.3rem',
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                fontVariantNumeric: 'tabular-nums',
                marginTop: '6px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {maskValue(formatBrlCurrency(totalRemainingDebt))}
            </div>

            {/* Grid de Micro-Métricas: Nunca colide nem corta texto */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginTop: '14px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Comprometido
                </div>
                <div
                  style={{
                    fontSize: '0.94rem',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    fontVariantNumeric: 'tabular-nums',
                    marginTop: '2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {maskValue(formatBrlCurrency(totalMonthlyCommitment))}
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 500, marginLeft: '2px' }}>/mês</span>
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Compras ativas
                </div>
                <div
                  style={{
                    fontSize: '0.94rem',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    marginTop: '2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {activeGroups.length} {activeGroups.length === 1 ? 'compra' : 'compras'}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Fileira de Pílulas de Filtro (Estilo Fatura do Cartão de Crédito + Filtro em Dinheiro) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '2px',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {/* Pílula: Todos */}
            <button
              type="button"
              onClick={() => setSelectedAccountFilter('all')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '9999px',
                backgroundColor: selectedAccountFilter === 'all' ? '#FFFFFF' : '#16191D',
                color: selectedAccountFilter === 'all' ? '#0A0E0C' : '#94A3B8',
                border: `1px solid ${selectedAccountFilter === 'all' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)'}`,
                fontSize: '0.80rem',
                fontWeight: selectedAccountFilter === 'all' ? 700 : 500,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <Layers size={14} />
              <span>Todos</span>
              <span
                style={{
                  fontSize: '0.70rem',
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  backgroundColor: selectedAccountFilter === 'all' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.08)',
                  fontWeight: 700,
                }}
              >
                {activeGroups.length}
              </span>
            </button>

            {/* Pílulas por Cartão de Crédito com compras ativas */}
            {creditCardFilters.map(({ account, count }) => {
              const isSelected = selectedAccountFilter === account.id;

              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setSelectedAccountFilter(account.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 13px',
                    borderRadius: '9999px',
                    backgroundColor: isSelected ? '#FFFFFF' : '#16191D',
                    color: isSelected ? '#0A0E0C' : '#94A3B8',
                    border: `1px solid ${isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)'}`,
                    fontSize: '0.80rem',
                    fontWeight: isSelected ? 700 : 500,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  {account.bankId ? (
                    <BankLogo bankId={account.bankId} size={16} style={{ boxShadow: 'none' }} />
                  ) : (
                    <CreditCard size={14} />
                  )}
                  <span>{account.name}</span>
                  {account.isShared && (
                    <Users size={12} style={{ opacity: 0.85, color: isSelected ? '#64748B' : '#94A3B8', marginLeft: '2px' }} />
                  )}
                  <span
                    style={{
                      fontSize: '0.70rem',
                      padding: '1px 6px',
                      borderRadius: '9999px',
                      backgroundColor: isSelected ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.08)',
                      fontWeight: 700,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Pílulas por Contas Bancárias / Conta Corrente com compras ativas */}
            {bankAccountFilters.map(({ account, count, name, bankId }) => {
              const filterKey = account?.id || 'checking';
              const isSelected = selectedAccountFilter === filterKey;

              return (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setSelectedAccountFilter(filterKey)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 13px',
                    borderRadius: '9999px',
                    backgroundColor: isSelected ? '#FFFFFF' : '#16191D',
                    color: isSelected ? '#0A0E0C' : '#94A3B8',
                    border: `1px solid ${isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)'}`,
                    fontSize: '0.80rem',
                    fontWeight: isSelected ? 700 : 500,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  {bankId ? (
                    <BankLogo bankId={bankId} size={16} style={{ boxShadow: 'none' }} />
                  ) : (
                    <Landmark size={14} />
                  )}
                  <span>{name}</span>
                  <span
                    style={{
                      fontSize: '0.70rem',
                      padding: '1px 6px',
                      borderRadius: '9999px',
                      backgroundColor: isSelected ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.08)',
                      fontWeight: 700,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 4. Barra de Ordenação Discreta (Estilo Pierre - Alinhada à direita sem contagem redundante) */}
          {filteredActiveGroups.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                padding: '0 2px',
              }}
            >

              <button
                type="button"
                onClick={() => setIsSortModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: sortMode !== 'recent' ? 'rgba(74, 222, 128, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${sortMode !== 'recent' ? 'rgba(74, 222, 128, 0.28)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '9999px',
                  padding: '5px 12px',
                  fontSize: '0.76rem',
                  color: sortMode !== 'recent' ? '#4ADE80' : '#94A3B8',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <ArrowUpDown size={12} color={sortMode !== 'recent' ? '#4ADE80' : '#64748B'} />
                <span style={{ fontWeight: 500 }}>
                  Ordenar: <strong style={{ color: sortMode !== 'recent' ? '#4ADE80' : '#E2E8F0', fontWeight: 600 }}>{currentSortObj.label}</strong>
                </span>
                <ChevronDown size={12} color={sortMode !== 'recent' ? '#4ADE80' : '#64748B'} />
              </button>
            </div>
          )}

          {/* 5. Lista de Compras Parceladas */}
          {filteredActiveGroups.length === 0 ? (
            <div
              style={{
                padding: '44px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: '12px',
                backgroundColor: '#121418',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '23px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10B981',
                }}
              >
                <CheckCircle2 size={24} color="#10B981" />
              </div>
              <div style={{ maxWidth: '280px' }}>
                <div style={{ fontSize: '0.94rem', fontWeight: 600, color: '#FFFFFF' }}>
                  {selectedAccountFilter !== 'all'
                    ? 'Nenhuma compra ativa neste filtro'
                    : 'Nenhum parcelamento ativo'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '4px', lineHeight: 1.4 }}>
                  {selectedAccountFilter !== 'all'
                    ? 'Tente selecionar "Todos" para visualizar compras de outras contas e cartões.'
                    : 'Suas compras divididas no cartão ou em dinheiro aparecerão aqui com acompanhamento automático.'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredActiveGroups.map(group => {
                const account = group.accountId ? accountMap.get(group.accountId) : null;
                const firstTx = group.transactions[0];
                const category = firstTx?.categoryId ? categoryMap.get(firstTx.categoryId) : undefined;
                const isCard = (account && account.type === 'credit_card') || (!account && firstTx?.paymentMethod === 'credit');
                const lastDigits = account?.lastDigits || firstTx?.cardLastDigits || group.transactions.find(t => t.cardLastDigits)?.cardLastDigits;
                const isShared = Boolean(account?.isShared);
                const groupAuthorBadge = firstTx ? resolveTransactionAuthorBadge({
                  tx: firstTx,
                  account,
                  accounts,
                  currentUser: user,
                  partnershipSpace,
                }) : null;

                const progressRatio = group.installmentTotal > 0
                  ? Math.min(1, group.paidInstallmentsCount / group.installmentTotal)
                  : 1;
                const progressPercent = Math.round(progressRatio * 100);

                return (
                  <div
                    key={group.groupId}
                    onClick={() => {
                      if (firstTx) {
                        onEditTransaction?.(firstTx);
                      }
                    }}
                    style={{
                      backgroundColor: '#131915',
                      borderRadius: '18px',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      cursor: onEditTransaction ? 'pointer' : 'default',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    {/* Linha 1: Logo + Nome (com espaço total) e Valor Mensal à direita */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        minWidth: 0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div style={{ flexShrink: 0 }}>
                          <BrandLogo
                            name={group.description}
                            category={category}
                            bankId={account?.bankId}
                            authorBadge={groupAuthorBadge}
                            size={38}
                          />
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: '0.94rem',
                              fontWeight: 600,
                              color: '#FFFFFF',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {group.description}
                          </div>

                          {isCard ? (
                            (lastDigits || isShared) && (
                              <div
                                style={{
                                  fontSize: '0.74rem',
                                  color: '#94A3B8',
                                  marginTop: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {lastDigits && (
                                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    •••• {lastDigits}
                                  </span>
                                )}
                                {isShared && (
                                  <span title="Conta conjunta" style={{ display: 'inline-flex', alignItems: 'center' }}>
                                    <Users
                                      size={12}
                                      color="#64748B"
                                      style={{ opacity: 0.9, flexShrink: 0 }}
                                    />
                                  </span>
                                )}
                              </div>
                            )
                          ) : (
                            <div
                              style={{
                                fontSize: '0.74rem',
                                color: '#10B981',
                                marginTop: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <Landmark size={12} color="#10B981" style={{ flexShrink: 0 }} />
                              <span>Conta Corrente</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Coluna da Direita: Mensalidade e Total Original */}
                      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <div
                          style={{
                            fontSize: '0.96rem',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {maskValue(formatBrlCurrency(group.monthlyAmount))}
                          <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 500, marginLeft: '2px' }}>/mês</span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: '#64748B',
                            marginTop: '1px',
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Total {maskValue(formatBrlCurrency(group.originalTotalAmount))}
                        </div>
                      </div>
                    </div>

                    {/* Linha 2: Barra de Progresso Fina 100% de largura */}
                    <div
                      style={{
                        width: '100%',
                        height: '4px',
                        borderRadius: '9999px',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${progressPercent}%`,
                          height: '100%',
                          backgroundColor: progressPercent >= 100 ? '#10B981' : (account?.color || '#38BDF8'),
                          borderRadius: '9999px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>

                    {/* Linha 3: Rodapé com Parcelas Pagas e Saldo Restante */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.74rem',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                        <span style={{ whiteSpace: 'nowrap' }}>
                          {group.paidInstallmentsCount} de {group.installmentTotal} pagas
                        </span>
                        <span style={{ color: '#4B5563' }}>•</span>
                        <span style={{ color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
                          {progressPercent}%
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, color: '#94A3B8' }}>
                        <span>Restam</span>
                        <strong style={{ color: '#E2E8F0', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {maskValue(formatBrlCurrency(group.remainingAmount))}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 6. Seção Opcional de Histórico de Quitadas (Sem poluir a tela principal com abas) */}
          {completedGroups.length > 0 && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setShowCompleted(prev => !prev)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  transition: 'color 0.15s ease',
                }}
              >
                <span>{showCompleted ? 'Ocultar compras quitadas' : `Ver compras quitadas (${completedGroups.length})`}</span>
                {showCompleted ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showCompleted && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  {completedGroups.map(group => {
                    const account = group.accountId ? accountMap.get(group.accountId) : null;
                    return (
                      <div
                        key={group.groupId}
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: '14px',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          opacity: 0.75,
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '0.86rem', fontWeight: 500, color: '#E2E8F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {group.description}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '1px' }}>
                            {account?.name || 'Cartão'} • {group.installmentTotal}x pagas
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '0.76rem', color: '#10B981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} color="#10B981" />
                            Quitado
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748B', fontVariantNumeric: 'tabular-nums', marginTop: '1px' }}>
                            {maskValue(formatBrlCurrency(group.originalTotalAmount))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Bottom Sheet de Ordenação de Parcelas (Estilo Pierre / Nubank) */}
      {isSortModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Opções de ordenação de parcelas"
          onClick={() => {
            setSortDragY(0);
            setIsSortModalOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 10050,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 0,
            opacity: sortDragY > 0 ? Math.max(0, 1 - sortDragY / 260) : 1,
            transition: sortDragY > 0 ? 'none' : 'opacity 0.2s ease',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: '#111613',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
              borderRight: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '26px 26px 0 0',
              padding: '10px 18px max(24px, calc(18px + var(--safe-area-bottom, 0px)))',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 -16px 48px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.04)',
              boxSizing: 'border-box',
              transform: sortDragY > 0 ? `translateY(${sortDragY}px)` : 'none',
              transition: sortDragY > 0 ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              animation: sortDragY === 0 ? 'slideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
            }}
          >
            {/* Pílula / Handle de arrasto com área de toque confortável */}
            <div
              onTouchStart={handleSortTouchStart}
              onTouchMove={handleSortTouchMove}
              onTouchEnd={handleSortTouchEnd}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                padding: '8px 0 10px',
                cursor: 'grab',
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '4px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.22)',
                }}
              />
            </div>

            {/* Cabeçalho minimalista sem botão X */}
            <div
              onTouchStart={handleSortTouchStart}
              onTouchMove={handleSortTouchMove}
              onTouchEnd={handleSortTouchEnd}
              style={{
                padding: '2px 4px 6px',
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.08rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  letterSpacing: '-0.01em',
                }}
              >
                Ordenar parcelas
              </h3>
            </div>

            {/* Lista com scroll independente e toque fluido */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                maxHeight: 'min(58vh, 380px)',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: '8px',
              }}
            >
              {INSTALLMENT_SORT_OPTIONS.map(opt => {
                const isSelected = sortMode === opt.id;
                const Icon = opt.icon;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectSort(opt.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '13px 14px',
                      borderRadius: '14px',
                      backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.15s ease',
                      width: '100%',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <Icon
                        size={19}
                        color={isSelected ? '#FFFFFF' : '#64748B'}
                        style={{ flexShrink: 0, transition: 'color 0.15s ease' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span
                          style={{
                            fontSize: '0.92rem',
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? '#FFFFFF' : '#CBD5E1',
                            transition: 'color 0.15s ease',
                          }}
                        >
                          {opt.label}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                          {opt.desc}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <Check
                        size={18}
                        color="#4ADE80"
                        strokeWidth={2.4}
                        style={{ flexShrink: 0 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </SwipeBackView>
  );
};
