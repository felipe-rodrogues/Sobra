import React, { useState, useMemo } from 'react';
import { ArrowLeft, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { Transaction, Account, Category } from '../../core/types';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { IconRenderer } from '../common/IconRenderer';
import { BankLogo } from '../common/BankLogo';
import { resolveCategoryVisual } from '../dashboard/MonthOverviewCard';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from '../common/SwipeBackIndicator';

interface MonthCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  selectedMonth: number;
  selectedYear: number;
  onSelectMonth: (month: number) => void;
  isPrivacyMode: boolean;
  onTogglePrivacy: () => void;
  onEditTransaction?: (tx: Transaction) => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const MonthCategoriesModal: React.FC<MonthCategoriesModalProps> = ({
  isOpen,
  onClose,
  transactions,
  accounts,
  categories,
  selectedMonth,
  selectedYear,
  onSelectMonth,
  isPrivacyMode,
  onTogglePrivacy,
  onEditTransaction,
}) => {
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);

  const swipeState = useSwipeBack({ onBack: onClose, enabled: isOpen });

  // Filtrar despesas confirmadas do mês e ano selecionados
  const monthExpenses = useMemo(() => {
    return transactions.filter(t => {
      if (t.type !== 'expense' || t.status !== 'confirmed') return false;
      const d = new Date(t.date);
      const m = d.getUTCMonth() + 1;
      const y = d.getUTCFullYear();
      return m === selectedMonth && y === selectedYear;
    });
  }, [transactions, selectedMonth, selectedYear]);

  // Total geral de gastos do mês
  const totalMonthExpense = useMemo(() => {
    return monthExpenses.reduce((sum, t) => sum + t.amount, 0);
  }, [monthExpenses]);

  // Agrupamento por categoria
  const groupedCategories = useMemo(() => {
    const map = new Map<string, { category: Category; amount: number; txs: Transaction[] }>();

    monthExpenses.forEach(tx => {
      const cat = categories.find(c => c.id === tx.categoryId) || {
        id: tx.categoryId || 'outros',
        name: 'Outros',
        type: 'expense',
        icon: 'Tag',
        color: '#9EA3A9',
        isCustom: false,
        createdAt: '',
      };

      const existing = map.get(cat.id);
      if (existing) {
        existing.amount += tx.amount;
        existing.txs.push(tx);
      } else {
        map.set(cat.id, {
          category: cat,
          amount: tx.amount,
          txs: [tx],
        });
      }
    });

    const list = Array.from(map.values()).map(item => {
      const visual = resolveCategoryVisual({
        categoryId: item.category.id,
        categoryName: item.category.name,
        color: item.category.color,
      });

      const percentage = totalMonthExpense > 0 ? (item.amount / totalMonthExpense) * 100 : 0;

      // Ordenar transações internas por data decrescente
      item.txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        categoryId: item.category.id,
        categoryName: visual.name,
        color: visual.color,
        icon: item.category.icon || 'Tag',
        amount: Math.round(item.amount * 100) / 100,
        percentage: Math.round(percentage),
        txs: item.txs,
      };
    });

    // Ordenar por valor gasto decrescente
    list.sort((a, b) => b.amount - a.amount);
    return list;
  }, [monthExpenses, categories, totalMonthExpense]);

  if (!isOpen) return null;

  const maskValue = (v: string) => (isPrivacyMode ? '••••••' : v);

  // Parâmetros do Donut Chart grande (estilo Pierre ampliado)
  const size = 280;
  const center = size / 2;
  const radius = 120;
  const strokeWidth = 15;
  const circumference = 2 * Math.PI * radius;
  const gapLength = groupedCategories.length > 1 ? 9.0 : 0;

  let cumulativeOffset = 0;
  const activeCategory = groupedCategories.find(c => c.categoryId === selectedCatId);

  const displayAmount = activeCategory ? activeCategory.amount : totalMonthExpense;
  const displayLabel = activeCategory ? activeCategory.categoryName : 'gastos esse mês';

  const handleToggleAccordion = (catId: string) => {
    setExpandedCategoryId(prev => (prev === catId ? null : catId));
    setSelectedCatId(catId);
  };

  const getAccount = (accountId?: string) => {
    return accounts.find(a => a.id === accountId);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getUTCDate();
    const monthIndex = d.getUTCMonth();
    const shortMonths = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${day} de ${shortMonths[monthIndex]}`;
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
        onClick={onClose}
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
        {/* 1. Header Fiel ao Pierre: Voltar, Pílula de Mês no Centro e Olho de Privacidade */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 10px',
            position: 'sticky',
            top: 0,
            backgroundColor: '#0A0E0C',
            zIndex: 20,
          }}
        >
          {/* Botão Voltar Circular */}
          <button
            type="button"
            onClick={onClose}
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

          {/* Pílula de Mês Centralizada estilo Pierre com Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsMonthDropdownOpen(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '9999px',
                backgroundColor: '#161F18',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: "'Outfit', 'Inter', sans-serif",
              }}
            >
              <span>{`${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}</span>
              <ChevronDown size={14} color="#94A3B8" />
            </button>

            {isMonthDropdownOpen && (
              <>
                <div
                  onClick={() => setIsMonthDropdownOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '120%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '160px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    backgroundColor: '#161F18',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '16px',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.8)',
                    zIndex: 100,
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  {MONTH_NAMES.map((name, index) => {
                    const m = index + 1;
                    const isSelected = m === selectedMonth;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          onSelectMonth(m);
                          setIsMonthDropdownOpen(false);
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: isSelected ? 700 : 500,
                          backgroundColor: isSelected ? '#22C55E' : 'transparent',
                          color: isSelected ? '#000000' : '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s',
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Botão de Privacidade */}
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
          >
            {isPrivacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* 2. Conteúdo Principal */}
        <div style={{ padding: '10px 20px 40px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Donut Chart Ampliado Central (Fiel à Imagem 2 do Pierre) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              marginTop: '8px',
            }}
          >
            {groupedCategories.length === 0 ? (
              <div
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  borderRadius: '50%',
                  border: '16px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94A3B8',
                  fontSize: '0.86rem',
                  textAlign: 'center',
                  padding: '20px',
                }}
              >
                <span>Sem gastos</span>
                <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>neste mês</span>
              </div>
            ) : (
              <div
                style={{
                  position: 'relative',
                  width: `${size}px`,
                  height: `${size}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width={size}
                  height={size}
                  viewBox={`0 0 ${size} ${size}`}
                  style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
                >
                  {groupedCategories.map((cat, index) => {
                    const isSelected = selectedCatId === cat.categoryId;
                    const isOtherSelected = selectedCatId !== null && !isSelected;

                    const fraction = totalMonthExpense > 0 
                      ? cat.amount / totalMonthExpense 
                      : (1 / groupedCategories.length);
                    const segLength = fraction * circumference;
                    const arcLength = Math.max(1, segLength - gapLength);
                    const strokeDasharray = `${arcLength} ${circumference}`;
                    const strokeDashoffset = -(cumulativeOffset + gapLength / 2);

                    cumulativeOffset += segLength;

                    return (
                      <circle
                        key={cat.categoryId || index}
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="transparent"
                        stroke={cat.color}
                        strokeWidth={isSelected ? strokeWidth + 4 : strokeWidth}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        opacity={isOtherSelected ? 0.3 : 1}
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedCatId(prev => (prev === cat.categoryId ? null : cat.categoryId));
                          setExpandedCategoryId(prev => (prev === cat.categoryId ? null : cat.categoryId));
                        }}
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          filter: isSelected ? `drop-shadow(0 0 8px ${cat.color})` : 'none',
                        }}
                      />
                    );
                  })}
                </svg>

                {/* Centro do Donut: R$ 429 / gastos esse mês */}
                <div
                  onClick={() => {
                    setSelectedCatId(null);
                    setExpandedCategoryId(null);
                  }}
                  style={{
                    position: 'absolute',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '0 16px',
                    maxWidth: '220px',
                  }}
                  title="Toque para ver o total geral"
                >
                  <span
                    style={{
                      fontSize: '2.35rem',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      letterSpacing: '-0.03em',
                      lineHeight: 1.1,
                      fontFamily: "'Outfit', 'Inter', sans-serif",
                    }}
                  >
                    {maskValue(formatBrlCurrency(displayAmount))}
                  </span>
                  <span
                    style={{
                      fontSize: '0.86rem',
                      color: activeCategory ? activeCategory.color : '#94A3B8',
                      marginTop: '6px',
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                      transition: 'color 0.2s ease',
                    }}
                  >
                    {displayLabel}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 3. Pílula Segmentada de Categorias */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'inline-flex',
                backgroundColor: '#161F18',
                borderRadius: '9999px',
                padding: '4px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <button
                type="button"
                style={{
                  padding: '7px 20px',
                  borderRadius: '9999px',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                }}
              >
                Categorias
              </button>
            </div>
          </div>

          {/* 4. Lista Agrupada com Acordeão (Fiel à Imagem 2 do Pierre) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {groupedCategories.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '30px 16px',
                  color: '#64748B',
                  fontSize: '0.88rem',
                  backgroundColor: '#111713',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                }}
              >
                Nenhuma despesa encontrada neste mês.
              </div>
            ) : (
              groupedCategories.map(item => {
                const isExpanded = expandedCategoryId === item.categoryId;
                const isSelected = selectedCatId === item.categoryId;

                return (
                  <div
                    key={item.categoryId}
                    style={{
                      backgroundColor: '#111713',
                      borderRadius: '18px',
                      border: isSelected ? `1px solid ${item.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                      boxShadow: isSelected ? `0 4px 20px rgba(0,0,0,0.5), 0 0 12px ${item.color}22` : '0 4px 14px rgba(0, 0, 0, 0.25)',
                      overflow: 'hidden',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    {/* Linha Principal da Categoria (Header do Acordeão) */}
                    <div
                      onClick={() => handleToggleAccordion(item.categoryId)}
                      style={{
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      {/* Lado Esquerdo: Ícone em Círculo Colorido + Nome + Percentual */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: `${item.color}22`,
                            border: `1px solid ${item.color}44`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <IconRenderer name={item.icon} size={20} color={item.color} />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: '0.94rem',
                              fontWeight: 700,
                              color: '#FFFFFF',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontFamily: "'Outfit', 'Inter', sans-serif",
                            }}
                          >
                            {item.categoryName}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 500 }}>
                            {`${item.percentage}%`}
                          </span>
                        </div>
                      </div>

                      {/* Lado Direito: Valor Total + Chevron Animada */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            fontFamily: "'Outfit', 'Inter', sans-serif",
                          }}
                        >
                          {maskValue(formatBrlCurrency(item.amount))}
                        </span>

                        <div
                          style={{
                            color: '#94A3B8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.25s ease',
                          }}
                        >
                          <ChevronDown size={18} />
                        </div>
                      </div>
                    </div>

                    {/* Conteúdo Expandido do Acordeão: Lista de Gastos Individuais */}
                    {isExpanded && (
                      <div
                        style={{
                          backgroundColor: 'rgba(0, 0, 0, 0.25)',
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                          padding: '8px 16px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          animation: 'fadeIn 0.2s ease',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: '#64748B',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            paddingTop: '4px',
                          }}
                        >
                          {item.txs.length} {item.txs.length === 1 ? 'gasto registrado' : 'gastos registrados'}
                        </div>

                        {item.txs.map(tx => {
                          const acc = getAccount(tx.accountId);
                          const isCard = tx.paymentMethod === 'credit' || acc?.type === 'credit_card';

                          return (
                            <div
                              key={tx.id}
                              onClick={e => {
                                e.stopPropagation();
                                onEditTransaction?.(tx);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 10px',
                                borderRadius: '12px',
                                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.04)',
                                cursor: onEditTransaction ? 'pointer' : 'default',
                                transition: 'background-color 0.15s ease',
                              }}
                              onMouseEnter={e => {
                                if (onEditTransaction) {
                                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)';
                                }
                              }}
                              onMouseLeave={e => {
                                if (onEditTransaction) {
                                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                                }
                              }}
                            >
                              {/* Logo / Banco + Descrição + Data */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                {acc?.bankId ? (
                                  <BankLogo bankId={acc.bankId} size={28} />
                                ) : (
                                  <div
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.75rem',
                                      color: '#94A3B8',
                                    }}
                                  >
                                    {isCard ? '💳' : '💸'}
                                  </div>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                  <span
                                    style={{
                                      fontSize: '0.86rem',
                                      fontWeight: 600,
                                      color: '#FFFFFF',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {tx.description || item.categoryName}
                                  </span>
                                  <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                                    {formatDate(tx.date)} {acc ? `• ${acc.name}` : ''}
                                  </span>
                                </div>
                              </div>

                              {/* Valor */}
                              <span
                                style={{
                                  fontSize: '0.88rem',
                                  fontWeight: 700,
                                  color: '#F87171',
                                  fontFamily: "'Outfit', 'Inter', sans-serif",
                                  flexShrink: 0,
                                  marginLeft: '10px',
                                }}
                              >
                                -{maskValue(formatBrlCurrency(tx.amount))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};
