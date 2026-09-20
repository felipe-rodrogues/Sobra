import React, { useState, useMemo, useRef } from 'react';
import { ConfirmModal } from '../common/ConfirmModal';
import { Button } from '../common/Button';
import { BankLogo } from '../common/BankLogo';
import { CardBrandLogo } from '../common/MastercardLogo';
import { IconRenderer } from '../common/IconRenderer';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from '../common/SwipeBackIndicator';
import { formatBrlCurrency, parseBrlCurrency } from '../../core/parsers/currencyHelper';
import { Account, Transaction, Category } from '../../core/types';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  calculateFutureInvoiceTimeline, 
  calculateInvoiceForMonth, 
  MONTH_NAMES 
} from '../../core/installments/installmentHelper';
import { calculateCardDateStatus } from '../../core/cards/cardDateHelper';
import { 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  Calendar, 
  List, 
  Plus, 
  Trash2, 
  Edit3, 
  CreditCard,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Wifi,
  TrendingDown,
  TrendingUp,
  PieChart,
  RotateCcw,
  Users
} from 'lucide-react';
import { TransactionModal } from './TransactionModal';
import { resolveCategoryVisual } from '../dashboard/MonthOverviewCard';
import { getEffectiveTransactionAmount } from '../../core/calculations';

interface CardInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  card?: Account | null;
  transactions?: Transaction[];
  categories?: Category[];
  isPrivacyMode?: boolean;
  onAddNewCard?: () => void;
  onAddNewExpense?: (accountId?: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
  onPayInvoice?: (card: Account) => void;
  onEditCard?: (card: Account) => void;
}

const MONTH_ABBR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const getCardGradient = (bankId?: string, customColor?: string) => {
  if (customColor) {
    return `linear-gradient(135deg, ${customColor} 0%, #0B0E14 100%)`;
  }
  switch (bankId?.toLowerCase()) {
    case 'nubank':
      return 'linear-gradient(135deg, #820AD1 0%, #3B0764 100%)';
    case 'inter':
      return 'linear-gradient(135deg, #FF7A00 0%, #7C2D12 100%)';
    case 'itau':
      return 'linear-gradient(135deg, #EC7000 0%, #1E3A8A 100%)';
    case 'bradesco':
      return 'linear-gradient(135deg, #CC092F 0%, #4C0519 100%)';
    case 'santander':
      return 'linear-gradient(135deg, #EC0000 0%, #450A0A 100%)';
    case 'c6':
      return 'linear-gradient(135deg, #2A2F35 0%, #111827 100%)';
    case 'btg':
      return 'linear-gradient(135deg, #0A1E3F 0%, #030712 100%)';
    case 'caixa':
      return 'linear-gradient(135deg, #005CA9 0%, #0C4A6E 100%)';
    case 'bb':
      return 'linear-gradient(135deg, #F59E0B 0%, #1E3A8A 100%)';
    default:
      return 'linear-gradient(135deg, #1E293B 0%, #090D16 100%)';
  }
};

export const CardInvoiceModal: React.FC<CardInvoiceModalProps> = ({
  isOpen,
  onClose,
  card: initialCard,
  transactions: propTxs,
  categories: propCats,
  isPrivacyMode: propPrivacy,
  onAddNewCard,
  onAddNewExpense,
  onEditTransaction,
  onPayInvoice,
  onEditCard,
}) => {
  const finance = useFinance();
  const { colors } = useTheme();

  // Estados principais
  const transactions = propTxs || finance.transactions;
  const categories = propCats || finance.categories;
  const isPrivacy = propPrivacy !== undefined ? propPrivacy : finance.isPrivacyMode;
  const togglePrivacy = finance.togglePrivacyMode;
  const accounts = finance.accounts;

  const creditCards = useMemo(() => {
    return finance.accounts.filter(a => a.type === 'credit_card');
  }, [finance.accounts]);

  // Se o modal recebeu um cartão específico, seleciona ele; senão 'all'
  const [selectedCardId, setSelectedCardId] = useState<string>(() => {
    return initialCard ? initialCard.id : 'all';
  });

  // Cartão visualizado em detalhe completo (null = visão consolidada de faturas)
  const [detailCardId, setDetailCardId] = useState<string | null>(() => {
    return initialCard ? initialCard.id : null;
  });

  // Abas estilo Pierre: 'faturas' | 'parcelas' | 'limites'
  const [activeTab, setActiveTab] = useState<'faturas' | 'parcelas' | 'limites'>('faturas');

  // Mês selecionado no gráfico (offset relativo ao mês atual: 0 = mês atual, -1 = mês anterior, etc.)
  const [selectedMonthOffset, setSelectedMonthOffset] = useState<number>(0);

  // Expansão rápida de lançamentos de cada cartão (até 3 mais recentes)
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const toggleCardExpansion = (id: string) => setExpandedCardIds(prev => ({ ...prev, [id]: !prev[id] }));


  // Modais de Edição e Exclusão de Transação
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  // Modal de Confirmação de Exclusão do Cartão
  const [isDeleteCardConfirmOpen, setIsDeleteCardConfirmOpen] = useState(false);

  // Estados de seleção/hover de categoria no Donut Chart da visão do mês do cartão
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [hoveredCatId, setHoveredCatId] = useState<string | null>(null);

  // Referência do container com rolagem interna para garantir início no topo
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Limpa seleção de categoria ao trocar de mês ou de cartão
  React.useEffect(() => {
    setSelectedCatId(null);
    setHoveredCatId(null);
  }, [selectedMonthOffset, detailCardId]);

  // Sincroniza seleção de cartão quando initialCard muda
  React.useEffect(() => {
    if (initialCard) {
      setSelectedCardId(initialCard.id);
      setDetailCardId(initialCard.id);
    } else {
      setSelectedCardId('all');
      setDetailCardId(null);
    }
  }, [initialCard, isOpen]);

  // Reseta o scroll para o topo sempre que abrir o modal, trocar de cartão ou mudar de aba
  React.useEffect(() => {
    if (isOpen) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0);
      }
      // Garante execução após o ciclo de layout do React/DOM
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      });
    }
  }, [isOpen, detailCardId, selectedCardId, activeTab]);

  // Navegação para trás: se está no detalhe do cartão, volta para a lista geral; se já está na lista, fecha o modal
  const handleBack = () => {
    if (detailCardId) {
      setDetailCardId(null);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    } else {
      onClose();
    }
  };

  const swipeState = useSwipeBack({ onBack: handleBack, enabled: isOpen });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + selectedMonthOffset, 1);
  const targetMonth = targetDate.getMonth() + 1; // 1-12
  const targetYear = targetDate.getFullYear();
  const isCurrentMonth = selectedMonthOffset === 0;

  const maskValue = (formatted: string) => (isPrivacy ? '••••••' : formatted);

  // Cartão atual para a tela detalhada
  const currentDetailCard = creditCards.find(c => c.id === detailCardId) || null;

  // Cartões a serem exibidos de acordo com o filtro selecionado (na visão consolidada)
  const displayedCards = selectedCardId === 'all' 
    ? creditCards 
    : creditCards.filter(c => c.id === selectedCardId);

  // Gera dados dos 7 meses para o gráfico de barras estilo Pierre (5 anteriores, atual, 1 futuro)
  const monthBarChartData = [-5, -4, -3, -2, -1, 0, 1].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();

    const total = displayedCards.reduce((acc, c) => {
      const monthData = calculateInvoiceForMonth(c.id, transactions, m, y);
      return acc + (offset === 0 && c.invoiceAmount !== undefined ? c.invoiceAmount : monthData.totalAmount);
    }, 0);

    return {
      offset,
      monthNum: m,
      year: y,
      label: MONTH_ABBR[m - 1],
      total,
      isSelected: offset === selectedMonthOffset,
    };
  });

  const maxMonthTotal = Math.max(...monthBarChartData.map(d => d.total), 100);

  const totalInvoicesSelectedMonth = displayedCards.reduce((acc, c) => {
    const monthData = calculateInvoiceForMonth(c.id, transactions, targetMonth, targetYear);
    const amount = isCurrentMonth && c.invoiceAmount !== undefined ? c.invoiceAmount : monthData.totalAmount;
    return acc + amount;
  }, 0);

  const nextDueDateInfo = (() => {
    if (displayedCards.length === 0) return null;

    const currentDay = now.getDate();
    let earliestDueDate: { day: number; month: number; daysLeft: number } | null = null;
    let minDays = Infinity;

    displayedCards.forEach(c => {
      const dueDay = c.dueDay || 10;
      let m = targetMonth;
      let y = targetYear;

      if (isCurrentMonth && dueDay < currentDay) {
        m = targetMonth === 12 ? 1 : targetMonth + 1;
        y = targetMonth === 12 ? targetYear + 1 : targetYear;
      }

      const dueObj = new Date(y, m - 1, dueDay);
      const diffDays = Math.ceil((dueObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays < minDays) {
        minDays = diffDays;
        earliestDueDate = { day: dueDay, month: m, daysLeft: diffDays };
      }
    });

    if (!earliestDueDate) return null;

    const pad = (n: number) => String(n).padStart(2, '0');
    const dayStr = pad((earliestDueDate as any).day);
    const monthStr = pad((earliestDueDate as any).month);
    const daysLeft = (earliestDueDate as any).daysLeft;

    return {
      text: `${dayStr}/${monthStr}`,
      daysLeftText: daysLeft === 0 ? 'Vence hoje' : daysLeft === 1 ? 'em 1 dia' : `em ${daysLeft} dias`,
    };
  })();


  // -------------------------------------------------------------
  // CÁLCULOS ESPECÍFICOS DA TELA DETALHADA DO CARTÃO
  // -------------------------------------------------------------
  const cardDetailData = (() => {
    if (!currentDetailCard) return null;

    const monthData = calculateInvoiceForMonth(currentDetailCard.id, transactions, targetMonth, targetYear);
    const cardTxs = monthData.transactions;

    const invoiceAmount = (isCurrentMonth && currentDetailCard.invoiceAmount !== undefined)
      ? currentDetailCard.invoiceAmount
      : monthData.totalAmount;

    const limit = currentDetailCard.creditLimit || 5000;
    const used = invoiceAmount;
    const available = Math.max(0, limit - used);
    const usedPercent = Math.min(100, Math.round((used / limit) * 100));

    const dateStatus = calculateCardDateStatus(
      currentDetailCard.closingDay,
      currentDetailCard.dueDay,
      now,
      currentDetailCard.invoiceAmount,
      currentDetailCard.invoiceStatus,
      currentDetailCard.openAmount
    );

    const currentDay = now.getDate();
    const dueDay = currentDetailCard.dueDay || 10;
    let m = targetMonth;
    let y = targetYear;
    if (isCurrentMonth && dueDay < currentDay) {
      m = targetMonth === 12 ? 1 : targetMonth + 1;
      y = targetMonth === 12 ? targetYear + 1 : targetYear;
    }
    const dueObj = new Date(y, m - 1, dueDay);
    const diffDays = Math.ceil((dueObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const pad = (n: number) => String(n).padStart(2, '0');
    const nextDueInfo = {
      text: `${pad(dueDay)}/${pad(m)}`,
      daysLeftText: diffDays === 0 ? 'Vence hoje' : diffDays === 1 ? 'em 1 dia' : `em ${diffDays} dias`,
    };

    const expenses = cardTxs.filter(t => t.type === 'expense');
    const incomes = cardTxs.filter(t => t.type === 'income');
    const totalExpenses = expenses.reduce((acc, t) => acc + t.amount, 0);
    const totalIncomes = incomes.reduce((acc, t) => acc + t.amount, 0);

    // Agrupamento por Categoria para visão completa
    const catMap: Record<string, { cat: Category | undefined; total: number; count: number }> = {};
    expenses.forEach(t => {
      const cId = t.categoryId || 'sem_categoria';
      if (!catMap[cId]) {
        catMap[cId] = {
          cat: categories.find(c => c.id === cId),
          total: 0,
          count: 0,
        };
      }
      catMap[cId].total += t.amount;
      catMap[cId].count += 1;
    });

    const categoryList = Object.values(catMap).sort((a, b) => b.total - a.total);

    return {
      monthData,
      cardTxs,
      invoiceAmount,
      limit,
      used,
      available,
      usedPercent,
      dateStatus,
      nextDueInfo,
      expenses,
      incomes,
      totalExpenses,
      totalIncomes,
      categoryList,
    };
  })();

  // Formatação de data amigável idêntica à Seção de Últimas Movimentações da Home
  const formatFriendlyDate = (dateStr: string) => {
    const txDate = new Date(dateStr);
    const now = new Date();
    
    const isToday = txDate.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = txDate.toDateString() === yesterday.toDateString();

    const hours = String(txDate.getHours()).padStart(2, '0');
    const minutes = String(txDate.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (isToday) return `Hoje, ${timeStr}`;
    if (isYesterday) return `Ontem, ${timeStr}`;

    return txDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  };

  // Processar categorias do cartão específico no formato e cores idênticos à Visão do Mês da Home
  const cardCategoryBreakdown = useMemo(() => {
    if (!cardDetailData || cardDetailData.expenses.length === 0) return [];

    const catMap: Record<string, { categoryId: string; categoryName: string; amount: number; color?: string }> = {};
    cardDetailData.expenses.forEach(tx => {
      const cat = categories.find(c => c.id === tx.categoryId);
      const catId = cat?.id || 'outros';
      const catName = cat?.name || 'Outros';
      if (!catMap[catId]) {
        catMap[catId] = {
          categoryId: catId,
          categoryName: catName,
          amount: 0,
          color: cat?.color,
        };
      }
      catMap[catId].amount += tx.amount;
    });

    const rawList = Object.values(catMap);
    const total = cardDetailData.totalExpenses;

    if (rawList.length <= 5) {
      return rawList.map((c, i) => {
        const visual = resolveCategoryVisual(c, i);
        return {
          ...c,
          categoryName: visual.name,
          color: visual.color,
          percentage: total > 0 ? (c.amount / total) * 100 : 0,
        };
      }).sort((a, b) => b.amount - a.amount);
    }

    const sorted = [...rawList].sort((a, b) => b.amount - a.amount);
    const top4 = sorted.slice(0, 4);
    const others = sorted.slice(4);
    const othersAmount = others.reduce((sum, c) => sum + c.amount, 0);

    const result = top4.map((c, i) => {
      const visual = resolveCategoryVisual(c, i);
      return {
        ...c,
        categoryName: visual.name,
        color: visual.color,
        percentage: total > 0 ? (c.amount / total) * 100 : 0,
      };
    });

    if (othersAmount > 0) {
      result.push({
        categoryId: 'others',
        categoryName: 'Outros',
        amount: othersAmount,
        color: '#9EA3A9',
        percentage: total > 0 ? (othersAmount / total) * 100 : 0,
      });
    }

    return result;
  }, [cardDetailData, categories]);

  const activeCatId = hoveredCatId || selectedCatId;
  const activeCategory = cardCategoryBreakdown.find(c => c.categoryId === activeCatId);
  const donutSize = 130;
  const donutCenter = donutSize / 2;
  const donutRadius = 54;
  const donutStrokeWidth = 13;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutGapLength = cardCategoryBreakdown.length > 1 ? 4.0 : 0;

  const donutDisplayValue = activeCategory
    ? maskValue(formatBrlCurrency(activeCategory.amount))
    : maskValue(formatBrlCurrency(cardDetailData?.totalExpenses || 0));

  const getDonutValueFontSize = (val: string) => {
    const len = val.length;
    if (len >= 16) return '0.64rem';
    if (len >= 14) return '0.70rem';
    if (len >= 12) return '0.76rem';
    if (len >= 10) return '0.82rem';
    return '0.88rem';
  };

  // Formatação de cabeçalho de grupo de data estilo Pierre (ex: "Hoje", "Ontem", "Sexta-feira", "18 de set.")
  const formatGroupHeader = (dateStr: string): string => {
    const d = new Date(dateStr);
    const now = new Date();
    
    const txDateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = todayOnly.getTime() - txDateOnly.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    
    if (diffDays > 1 && diffDays <= 6) {
      const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
      return weekday.charAt(0).toUpperCase() + weekday.slice(1);
    }
    
    const day = d.getDate();
    const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    
    if (d.getFullYear() === now.getFullYear()) {
      return `${day} de ${month}.`;
    }
    return `${day} de ${month}. de ${d.getFullYear()}`;
  };

  // Agrupamento cronológico das compras do cartão com detalhes de dias/datas
  const groupedCardTransactions = useMemo(() => {
    if (!cardDetailData || cardDetailData.cardTxs.length === 0) return [];

    const sortedTxs = [...cardDetailData.cardTxs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const groups: { [key: string]: { label: string; dateSub: string; txs: Transaction[] } } = {};
    
    sortedTxs.forEach(tx => {
      const d = new Date(tx.date);
      const dateKey = tx.date.substring(0, 10);
      if (!groups[dateKey]) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
        groups[dateKey] = {
          label: formatGroupHeader(tx.date),
          dateSub: `${day}/${month} • ${weekday}`,
          txs: [],
        };
      }
      groups[dateKey].txs.push(tx);
    });

    return Object.entries(groups).map(([dateKey, group]) => ({
      dateKey,
      label: group.label,
      dateSub: group.dateSub,
      transactions: group.txs,
    }));
  }, [cardDetailData]);

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
          alignItems: 'stretch',
          justifyContent: 'center',
          padding: 0,
          boxSizing: 'border-box',
        }}
        onClick={handleBack}
      >
        <div
          ref={scrollContainerRef}
          className="animate-slide-up hide-scrollbar"
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '460px',
            height: '100%',
            minHeight: '100vh',
            backgroundColor: '#0B0C0E',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            position: 'relative',
            boxSizing: 'border-box',
            paddingBottom: 'calc(100px + var(--safe-area-bottom, 0px))',
          }}
        >
          {/* ─────────────────────────────────────────────────────────────
              1. HEADER (SUPERIOR) - ADAPTA-SE CONFORME VISÃO DETALHE / GERAL
             ───────────────────────────────────────────────────────────── */}
          <header
            style={{
              padding: 'calc(var(--safe-area-top, 0px) + 12px) 20px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'sticky',
              top: 0,
              backgroundColor: '#0B0C0E',
              zIndex: 30,
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <button
              type="button"
              onClick={handleBack}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.07)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, transform 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.transform = 'scale(1.04)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title={currentDetailCard ? 'Voltar para todos os cartões' : 'Voltar'}
            >
              <ArrowLeft size={19} />
            </button>

            {/* Título Central apenas quando na listagem geral (quando em detalhe do cartão, o topo fica limpo e minimalista) */}
            {!currentDetailCard && (
              <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#FFFFFF' }}>
                Faturas & Cartões
              </div>
            )}

            {/* Ações da Direita */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={togglePrivacy}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.07)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: isPrivacy ? '#4ADE80' : '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)')}
                title={isPrivacy ? 'Mostrar valores' : 'Ocultar valores'}
              >
                {isPrivacy ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>

              {currentDetailCard ? (
                <>
                  {/* Botão de Editar Cartão */}
                  {onEditCard && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onEditCard(currentDetailCard);
                      }}
                      title="Editar Cartão"
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.07)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)')}
                    >
                      <Edit3 size={17} />
                    </button>
                  )}

                  {/* Botão de Excluir Cartão */}
                  <button
                    type="button"
                    onClick={() => setIsDeleteCardConfirmOpen(true)}
                    title="Excluir este Cartão"
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(244, 63, 94, 0.12)',
                      border: '1px solid rgba(244, 63, 94, 0.25)',
                      color: '#FB7185',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.22)';
                      e.currentTarget.style.transform = 'scale(1.04)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.12)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </>
              ) : (
                /* Botão (+) Cadastrar Novo Cartão na visão geral */
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onAddNewCard) {
                      onAddNewCard();
                    } else if (onAddNewExpense) {
                      onAddNewExpense(selectedCardId !== 'all' ? selectedCardId : undefined);
                    }
                  }}
                  title="Cadastrar Novo Cartão"
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: '#4ADE80',
                    border: 'none',
                    color: '#000000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(74, 222, 128, 0.35)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <Plus size={24} strokeWidth={2.6} />
                </button>
              )}
            </div>
          </header>

          {/* ─────────────────────────────────────────────────────────────
              SE ESTIVER NO DETALHE DE UM CARTÃO ESPECÍFICO:
              EXIBE A VISÃO COMPLETA (CARTÃO VIRTUAL + FATURA + CATEGORIAS + COMPRAS + EXCLUSÃO)
             ───────────────────────────────────────────────────────────── */}
          {currentDetailCard && cardDetailData ? (
            <div style={{ padding: '20px 20px 30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 1. MOCKUP VIRTUAL DO CARTÃO (DESIGN PREMIUM PIERRE / FINTECH) */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '1.586 / 1',
                  borderRadius: '24px',
                  background: getCardGradient(currentDetailCard.bankId, currentDetailCard.color),
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                }}
              >
                {/* Efeito Glow / Reflexo */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-30%',
                    right: '-20%',
                    width: '220px',
                    height: '220px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }}
                />

                {/* Topo do Cartão: Logo do Banco + Nome */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <BankLogo bankId={currentDetailCard.bankId} size={30} />
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                      {currentDetailCard.name}
                    </span>
                    {currentDetailCard.isShared && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '0.70rem',
                          fontWeight: 700,
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                          color: '#FFFFFF',
                          backdropFilter: 'blur(4px)',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                        }}
                      >
                        <Users size={11} />
                        {currentDetailCard.splitMode === 'half'
                          ? 'Conjunto • 50%'
                          : currentDetailCard.splitMode === 'none'
                          ? 'Conjunto • 0%'
                          : 'Conjunto'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Meio: Chip EMV Metálico com Aproximação ao lado + Número Mascarado Organizados */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', zIndex: 2 }}>
                  {/* Linha: Chip EMV + Sinal de Pagamento por Aproximação */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '28px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #FFE259 0%, #FFA751 100%)',
                        border: '1px solid rgba(0, 0, 0, 0.25)',
                        boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.5), 0 2px 4px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div style={{ width: '22px', height: '14px', border: '1px solid rgba(0, 0, 0, 0.25)', borderRadius: '3px' }} />
                    </div>

                    {/* Símbolo de Pagamento por Aproximação ao lado do Chip */}
                    <Wifi size={20} color="rgba(255, 255, 255, 0.85)" style={{ transform: 'rotate(90deg)' }} />
                  </div>

                  {/* Número Mascarado - Linha Única Perfeita */}
                  <div
                    style={{
                      fontSize: '1.05rem',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      color: 'rgba(255, 255, 255, 0.95)',
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    •••• •••• •••• {currentDetailCard.lastDigits || '4022'}
                  </div>
                </div>

                {/* Base: Ciclo + Bandeira */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', zIndex: 2 }}>
                  <div>
                    <div style={{ fontSize: '0.66rem', letterSpacing: '0.08em', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase' }}>
                      Ciclo de Faturamento
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', marginTop: '2px' }}>
                      Fecha dia {currentDetailCard.closingDay || 1} • Vence dia {currentDetailCard.dueDay || 8}
                    </div>
                  </div>

                  <CardBrandLogo brand={currentDetailCard.cardBrand || 'mastercard'} size={30} showText={false} />
                </div>
              </div>

              {/* 2. CARD HERO DE FATURA E LIMITES */}
              <div
                style={{
                  backgroundColor: '#131915',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '24px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.84rem', color: '#94A3B8', fontWeight: 500 }}>
                    Fatura de {MONTH_NAMES[targetMonth - 1]} / {targetYear}
                  </span>

                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      backgroundColor:
                        cardDetailData.dateStatus.displayStatus === 'paid'
                          ? 'rgba(74, 222, 128, 0.15)'
                          : cardDetailData.dateStatus.displayStatus === 'closed'
                          ? 'rgba(56, 189, 248, 0.15)'
                          : 'rgba(251, 146, 60, 0.18)',
                      color:
                        cardDetailData.dateStatus.displayStatus === 'paid'
                          ? '#4ADE80'
                          : cardDetailData.dateStatus.displayStatus === 'closed'
                          ? '#38BDF8'
                          : '#FB923C',
                      border: `1px solid ${
                        cardDetailData.dateStatus.displayStatus === 'paid'
                          ? 'rgba(74, 222, 128, 0.3)'
                          : cardDetailData.dateStatus.displayStatus === 'closed'
                          ? 'rgba(56, 189, 248, 0.3)'
                          : 'rgba(251, 146, 60, 0.35)'
                      }`,
                    }}
                  >
                    {cardDetailData.dateStatus.statusLabel}
                  </span>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: '2.4rem',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      fontFamily: "'Outfit', 'Inter', sans-serif",
                      letterSpacing: '-0.03em',
                      lineHeight: 1.1,
                    }}
                  >
                    {maskValue(formatBrlCurrency(cardDetailData.invoiceAmount))}
                  </div>

                  {currentDetailCard.isShared && currentDetailCard.splitMode !== 'full' && (
                    <div
                      style={{
                        fontSize: '0.82rem',
                        color: '#94A3B8',
                        marginTop: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>Sua cota na fatura:</span>
                      <strong style={{ color: '#4ADE80', fontWeight: 700, fontSize: '0.9rem' }}>
                        {maskValue(
                          formatBrlCurrency(
                            cardDetailData.invoiceAmount *
                              (currentDetailCard.splitMode === 'half'
                                ? 0.5
                                : currentDetailCard.splitMode === 'none'
                                ? 0
                                : (currentDetailCard.splitRatio ?? 1))
                          )
                        )}
                      </strong>
                      <span style={{ color: '#64748B', fontSize: '0.75rem' }}>
                        ({Math.round(
                          (currentDetailCard.splitMode === 'half'
                            ? 0.5
                            : currentDetailCard.splitMode === 'none'
                            ? 0
                            : (currentDetailCard.splitRatio ?? 1)) * 100
                        )}% da fatura do banco)
                      </span>
                    </div>
                  )}

                  <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: '#94A3B8' }}>
                    Próximo vencimento <strong style={{ color: '#E2E8F0' }}>{cardDetailData.nextDueInfo.text}</strong>{' '}
                    <span style={{ color: '#64748B' }}>({cardDetailData.nextDueInfo.daysLeftText})</span>
                  </p>
                </div>

                {/* Barra do Limite */}
                <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '8px' }}>
                    <span>Limite Usado: <strong style={{ color: '#FB923C' }}>{maskValue(formatBrlCurrency(cardDetailData.used))}</strong></span>
                    <span>Disponível: <strong style={{ color: '#4ADE80' }}>{maskValue(formatBrlCurrency(cardDetailData.available))}</strong></span>
                  </div>

                  <div style={{ width: '100%', height: '7px', borderRadius: '9999px', backgroundColor: '#1E2721', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${cardDetailData.usedPercent}%`,
                        height: '100%',
                        backgroundColor: currentDetailCard.color || '#4ADE80',
                        borderRadius: '9999px',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748B', marginTop: '6px' }}>
                    <span>Total contratado: {maskValue(formatBrlCurrency(cardDetailData.limit))}</span>
                    <span>{cardDetailData.usedPercent}% comprometido</span>
                  </div>
                </div>

                {/* Ação Pagar Fatura */}
                {onPayInvoice && cardDetailData.invoiceAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onPayInvoice(currentDetailCard);
                    }}
                    style={{
                      width: '100%',
                      padding: '13px',
                      borderRadius: '14px',
                      backgroundColor: '#1E2721',
                      border: '1px solid rgba(74, 222, 128, 0.3)',
                      color: '#4ADE80',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <CheckCircle2 size={18} />
                    <span>Pagar Fatura deste Cartão</span>
                  </button>
                )}
              </div>

              {/* 3. NAVEGADOR DE MESES PARA ESTE CARTÃO */}
              <div
                className="hide-scrollbar"
                style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '2px',
                }}
              >
                {[-3, -2, -1, 0, 1].map(offset => {
                  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
                  const m = d.getMonth() + 1;
                  const isSel = offset === selectedMonthOffset;
                  return (
                    <button
                      key={offset}
                      type="button"
                      onClick={() => setSelectedMonthOffset(offset)}
                      style={{
                        padding: '7px 16px',
                        borderRadius: '9999px',
                        backgroundColor: isSel ? '#FFFFFF' : '#161F18',
                        color: isSel ? '#0A0E0C' : '#94A3B8',
                        border: `1px solid ${isSel ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)'}`,
                        fontSize: '0.8rem',
                        fontWeight: isSel ? 700 : 500,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {MONTH_ABBR[m - 1]} {offset === 0 ? '(Atual)' : ''}
                    </button>
                  );
                })}
              </div>

              {/* 4. FLUXO FINANCEIRO: DESPESAS VS ESTORNOS/RECEITAS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div
                  style={{
                    backgroundColor: '#131915',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '20px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FB7185' }}>
                    <TrendingDown size={16} />
                    <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8' }}>Total Despesas</span>
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FB7185' }}>
                    {maskValue(formatBrlCurrency(cardDetailData.totalExpenses))}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                    {cardDetailData.expenses.length} {cardDetailData.expenses.length === 1 ? 'compra' : 'compras'}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: '#131915',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '20px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38BDF8' }}>
                      <RotateCcw size={15} />
                      <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#94A3B8' }}>Estornos</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38BDF8' }}>
                    {maskValue(formatBrlCurrency(cardDetailData.totalIncomes))}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                    {cardDetailData.incomes.length} {cardDetailData.incomes.length === 1 ? 'estorno registrado' : 'estornos registrados'}
                  </span>
                </div>
              </div>

              {/* 5. VISÃO DO MÊS (DONUT CHART & LEGENDA FIEL À HOME) */}
              <div
                className="card-sobra"
                style={{
                  padding: '18px 20px',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  background: 'linear-gradient(150deg, #131915 0%, #0d120f 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.13)',
                  borderRadius: '24px',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      margin: 0,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Visão do mês
                  </h3>

                  <span
                    style={{
                      fontSize: '0.78rem',
                      color: '#94A3B8',
                      fontWeight: 500,
                    }}
                  >
                    {cardCategoryBreakdown.length} {cardCategoryBreakdown.length === 1 ? 'categoria' : 'categorias'}
                  </span>
                </div>

                {/* Donut à esquerda + Legenda à direita */}
                {cardCategoryBreakdown.length === 0 || (cardDetailData?.totalExpenses || 0) === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '24px 10px',
                      color: '#64748B',
                      fontSize: '0.84rem',
                    }}
                  >
                    Nenhum gasto registrado nesta fatura.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '14px',
                    }}
                  >
                    {/* Lado Esquerdo: Donut SVG Interativo */}
                    <div
                      style={{
                        position: 'relative',
                        width: `${donutSize}px`,
                        height: `${donutSize}px`,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: '-5px',
                      }}
                    >
                      {(() => {
                        let cumulativeOffset = 0;
                        return (
                          <svg
                            width={donutSize}
                            height={donutSize}
                            viewBox={`0 0 ${donutSize} ${donutSize}`}
                            style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
                          >
                            {cardCategoryBreakdown.map((cat, index) => {
                              const isSelected = activeCatId === cat.categoryId;
                              const isOtherSelected = activeCatId !== null && !isSelected;

                              const fraction = (cardDetailData?.totalExpenses || 0) > 0 
                                ? cat.amount / (cardDetailData?.totalExpenses || 1) 
                                : (1 / cardCategoryBreakdown.length);
                              const segLength = fraction * donutCircumference;
                              const arcLength = Math.max(1, segLength - donutGapLength);
                              const strokeDasharray = `${arcLength} ${donutCircumference}`;
                              const strokeDashoffset = -(cumulativeOffset + donutGapLength / 2);

                              cumulativeOffset += segLength;

                              return (
                                <circle
                                  key={cat.categoryId || index}
                                  cx={donutCenter}
                                  cy={donutCenter}
                                  r={donutRadius}
                                  fill="transparent"
                                  stroke={cat.color}
                                  strokeWidth={isSelected ? donutStrokeWidth + 3 : donutStrokeWidth}
                                  strokeDasharray={strokeDasharray}
                                  strokeDashoffset={strokeDashoffset}
                                  strokeLinecap="butt"
                                  opacity={isOtherSelected ? 0.3 : 1}
                                  onClick={e => {
                                    e.stopPropagation();
                                    setSelectedCatId(prev => (prev === cat.categoryId ? null : cat.categoryId));
                                    setHoveredCatId(null);
                                  }}
                                  onMouseEnter={() => setHoveredCatId(cat.categoryId)}
                                  onMouseLeave={() => setHoveredCatId(null)}
                                  style={{
                                    cursor: 'pointer',
                                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                                    filter: isSelected ? `drop-shadow(0 0 6px ${cat.color})` : 'none',
                                  }}
                                />
                              );
                            })}
                          </svg>
                        );
                      })()}

                      {/* Centro do Donut */}
                      <div
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedCatId(null);
                          setHoveredCatId(null);
                        }}
                        style={{
                          position: 'absolute',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '94px',
                          height: '94px',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          padding: '0 2px',
                          userSelect: 'none',
                        }}
                        title="Toque para resetar o filtro"
                      >
                        <span
                          style={{
                            fontSize: getDonutValueFontSize(donutDisplayValue),
                            fontWeight: 800,
                            color: '#FFFFFF',
                            letterSpacing: '-0.03em',
                            lineHeight: 1.15,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {donutDisplayValue}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            color: activeCategory ? activeCategory.color : '#94A3B8',
                            marginTop: '1px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            maxWidth: '86px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            transition: 'color 0.2s ease',
                          }}
                        >
                          {activeCategory ? activeCategory.categoryName : 'gastos'}
                        </span>
                      </div>
                    </div>

                    {/* Lado Direito: Legenda das Categorias */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: cardCategoryBreakdown.length > 4 ? '7px' : '9px',
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {cardCategoryBreakdown.map(cat => {
                        const isSelected = activeCatId === cat.categoryId;
                        const isOtherSelected = activeCatId !== null && !isSelected;
                        const displayPct = Math.round(
                          (cardDetailData?.totalExpenses || 0) > 0 ? (cat.amount / cardDetailData.totalExpenses) * 100 : cat.percentage
                        );

                        return (
                          <div
                            key={cat.categoryId}
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedCatId(prev => (prev === cat.categoryId ? null : cat.categoryId));
                              setHoveredCatId(null);
                            }}
                            onMouseEnter={() => setHoveredCatId(cat.categoryId)}
                            onMouseLeave={() => setHoveredCatId(null)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              cursor: 'pointer',
                              opacity: isOtherSelected ? 0.35 : 1,
                              transition: 'all 0.2s ease',
                              padding: '2px 4px',
                              borderRadius: '6px',
                              backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                            }}
                          >
                            {/* Ponto colorido + Nome */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                              <span
                                style={{
                                  width: '7.5px',
                                  height: '7.5px',
                                  borderRadius: '50%',
                                  backgroundColor: cat.color,
                                  flexShrink: 0,
                                  boxShadow: isSelected ? `0 0 8px ${cat.color}` : 'none',
                                  transition: 'box-shadow 0.2s ease',
                                }}
                              />
                              <span
                                style={{
                                  fontSize: '0.82rem',
                                  fontWeight: isSelected ? 700 : 500,
                                  color: isSelected ? '#FFFFFF' : '#CBD5E1',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {cat.categoryName}
                              </span>
                            </div>

                            {/* Porcentagem */}
                            <span
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: isSelected ? 700 : 600,
                                color: isSelected ? '#FFFFFF' : '#94A3B8',
                                flexShrink: 0,
                              }}
                            >
                              {displayPct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. ÚLTIMAS MOVIMENTAÇÕES (COMPRAS DA FATURA COM SCROLL NO PADRÃO DE APP) */}
              <div
                className="card-sobra"
                style={{
                  padding: '20px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  position: 'relative',
                  background: 'linear-gradient(150deg, #131915 0%, #0d120f 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.13)',
                  borderRadius: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3
                    style={{
                      fontSize: '1.08rem',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      margin: 0,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Últimas movimentações
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 500 }}>
                    {cardDetailData.cardTxs.length} {cardDetailData.cardTxs.length === 1 ? 'registro' : 'registros'}
                  </span>
                </div>

                {cardDetailData.cardTxs.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '24px 10px',
                      color: '#64748B',
                      fontSize: '0.86rem',
                    }}
                  >
                    Nenhuma movimentação registrada nesta fatura.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      minHeight: '120px',
                      maxHeight: '520px',
                      overflowY: 'auto',
                      overscrollBehaviorY: 'contain',
                      WebkitOverflowScrolling: 'touch',
                      paddingRight: '3px',
                    }}
                    className="hide-scrollbar"
                  >
                    {groupedCardTransactions.map(group => (
                      <div key={group.dateKey} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {/* Header de Data com detalhes do dia */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 6px',
                            position: 'sticky',
                            top: 0,
                            backgroundColor: 'rgba(19, 25, 21, 0.95)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 2,
                            borderRadius: '8px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#4ADE80',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {group.label}
                          </span>
                          <span
                            style={{
                              fontSize: '0.70rem',
                              color: '#64748B',
                              fontWeight: 500,
                            }}
                          >
                            {group.dateSub}
                          </span>
                        </div>

                        {/* Transações deste dia */}
                        {group.transactions.map(tx => {
                          const cat = categories.find(c => c.id === tx.categoryId);
                          const isExpense = tx.type === 'expense';
                          const isIncome = tx.type === 'income';
                          const isRef = !!tx.isRefund;
                          const isRefd = !!tx.isRefunded;

                          const txDate = new Date(tx.date);
                          const hours = String(txDate.getHours()).padStart(2, '0');
                          const minutes = String(txDate.getMinutes()).padStart(2, '0');
                          const timeStr = `${hours}:${minutes}`;

                          const badgeBg = isRef
                            ? 'rgba(56, 189, 248, 0.18)'
                            : isExpense
                            ? 'rgba(244, 63, 94, 0.18)'
                            : 'rgba(34, 197, 94, 0.18)';

                          const iconColor = isRef
                            ? '#38BDF8'
                            : isExpense
                            ? '#FB7185'
                            : '#4ADE80';

                          return (
                            <div
                              key={tx.id}
                              onClick={() => setEditingTx(tx)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '9px 6px',
                                borderRadius: '14px',
                                cursor: 'pointer',
                                transition: 'background-color 0.15s ease',
                                opacity: isRefd ? 0.72 : 1,
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              {/* Lado Esquerdo: Avatar Circular + Descrição + Horário e Categoria */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                <div
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '50%',
                                    backgroundColor: badgeBg,
                                    color: iconColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <IconRenderer name={isRef ? 'RotateCcw' : (cat?.icon || (isExpense ? 'ShoppingBag' : 'TrendingUp'))} size={17} />
                                </div>

                                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      fontSize: '0.90rem',
                                      fontWeight: 600,
                                      color: isRefd ? '#94A3B8' : '#FFFFFF',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      textDecoration: isRefd ? 'line-through' : 'none',
                                    }}
                                  >
                                    {tx.description}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '0.73rem',
                                      color: '#64748B',
                                      marginTop: '2px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    <span>{timeStr}</span>
                                    <span>•</span>
                                    <span>{isRef ? 'Estorno no Cartão' : (cat?.name || 'Geral')}</span>
                                    {isRefd && (
                                      <span
                                        style={{
                                          color: '#38BDF8',
                                          backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.68rem',
                                          fontWeight: 700,
                                        }}
                                      >
                                        Estornada
                                      </span>
                                    )}
                                    {isRef && (
                                      <span
                                        style={{
                                          color: '#38BDF8',
                                          backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.68rem',
                                          fontWeight: 700,
                                        }}
                                      >
                                        Crédito de Estorno
                                      </span>
                                    )}
                                    {tx.installmentTotal && tx.installmentTotal > 1 && (
                                      <span style={{ color: '#4ADE80' }}>
                                        ({tx.installmentNumber}/{tx.installmentTotal})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Lado Direito: Valor Formatado sem quebras */}
                              <div
                                style={{
                                  fontSize: '0.93rem',
                                  fontWeight: 700,
                                  color: isRef ? '#38BDF8' : isIncome ? '#4ADE80' : isRefd ? '#64748B' : '#FFFFFF',
                                  textDecoration: isRefd ? 'line-through' : 'none',
                                  textAlign: 'right',
                                  flexShrink: 0,
                                  whiteSpace: 'nowrap',
                                  paddingLeft: '10px',
                                }}
                              >
                                {isExpense ? '- ' : '+ '}
                                {maskValue(formatBrlCurrency(tx.amount))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            /* ─────────────────────────────────────────────────────────────
                SE NÃO ESTIVER NO DETALHE DE UM CARTÃO:
                EXIBE A VISÃO CONSOLIDADA COM AS ABAS [FATURAS] [PARCELAS] [LIMITES]
               ───────────────────────────────────────────────────────────── */
            <>
              {/* 2. ABAS SEGMENTADAS ESTILO PIERRE: [Faturas] [Parcelas] [Limites] */}
              <div style={{ padding: '16px 20px 0' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    backgroundColor: '#161F18',
                    padding: '4px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  {(['faturas', 'parcelas', 'limites'] as const).map(tab => {
                    const isActive = activeTab === tab;
                    const labels = {
                      faturas: 'Faturas',
                      parcelas: 'Parcelas',
                      limites: 'Limites',
                    };

                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        style={{
                          padding: '8px 0',
                          borderRadius: '9999px',
                          fontSize: '0.84rem',
                          fontWeight: isActive ? 700 : 500,
                          backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                          color: isActive ? '#0A0E0C' : '#94A3B8',
                          cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                          textAlign: 'center',
                        }}
                      >
                        {labels[tab]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aba Faturas */}
              {activeTab === 'faturas' && (
                <div style={{ padding: '20px 20px 30px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
                  {/* Header do Total em Faturas */}
                  <div>
                    <span style={{ fontSize: '0.86rem', color: '#94A3B8', fontWeight: 500 }}>
                      Total em faturas em {MONTH_NAMES[targetMonth - 1]}
                    </span>

                    <div
                      style={{
                        fontSize: '2.2rem',
                        fontWeight: 800,
                        color: '#FFFFFF',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.15,
                        marginTop: '4px',
                        fontFamily: "'Outfit', 'Inter', sans-serif",
                      }}
                    >
                      {maskValue(formatBrlCurrency(totalInvoicesSelectedMonth))}
                    </div>

                    {nextDueDateInfo && (
                      <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: '#94A3B8' }}>
                        Próximo vencimento{' '}
                        <strong style={{ color: '#E2E8F0' }}>{nextDueDateInfo.text}</strong>{' '}
                        <span style={{ color: '#64748B' }}>({nextDueDateInfo.daysLeftText})</span>
                      </p>
                    )}
                  </div>

                  {/* Gráfico de Barras Mensal */}
                  <div
                    style={{
                      backgroundColor: '#121814',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '24px',
                      padding: '16px 14px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                      height: '130px',
                      boxSizing: 'border-box',
                    }}
                  >
                    {monthBarChartData.map(item => {
                      const heightPercent = Math.max(16, Math.min(70, Math.round((item.total / maxMonthTotal) * 70)));

                      return (
                        <button
                          key={item.offset}
                          type="button"
                          onClick={() => setSelectedMonthOffset(item.offset)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            flex: 1,
                          }}
                          title={`${item.label} / ${item.year}: ${formatBrlCurrency(item.total)}`}
                        >
                          <div
                            style={{
                              width: '28px',
                              height: `${heightPercent}px`,
                              borderRadius: '9999px',
                              backgroundColor: item.isSelected ? '#4ADE80' : '#232C26',
                              boxShadow: item.isSelected ? '0 0 16px rgba(74, 222, 128, 0.45)' : 'none',
                              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                            }}
                          />

                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: item.isSelected ? 800 : 500,
                              color: item.isSelected ? '#FFFFFF' : '#64748B',
                              transition: 'color 0.2s ease',
                            }}
                          >
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Filtros em Pílula */}
                  <div
                    className="hide-scrollbar"
                    style={{
                      display: 'flex',
                      gap: '8px',
                      overflowX: 'auto',
                      padding: '4px 20px 8px',
                      margin: '0 -20px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCardId('all')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        borderRadius: '9999px',
                        backgroundColor: selectedCardId === 'all' ? '#FFFFFF' : '#161F18',
                        color: selectedCardId === 'all' ? '#0A0E0C' : '#94A3B8',
                        border: `1px solid ${selectedCardId === 'all' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)'}`,
                        fontSize: '0.82rem',
                        fontWeight: selectedCardId === 'all' ? 700 : 500,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <CreditCard size={15} />
                      <span>Todos os cartões</span>
                    </button>

                    {creditCards.map(c => {
                      const isSelected = selectedCardId === c.id;
                      const cleanPillName = c.name
                        .replace(/\s*\(Final\s*[^)]+\)/i, '')
                        .replace(/\s*\(\d+\)/i, '')
                        .trim();

                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCardId(c.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 14px',
                            borderRadius: '9999px',
                            backgroundColor: isSelected ? '#FFFFFF' : '#161F18',
                            color: isSelected ? '#0A0E0C' : '#94A3B8',
                            border: `1px solid ${isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)'}`,
                            fontSize: '0.82rem',
                            fontWeight: isSelected ? 700 : 500,
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <BankLogo bankId={c.bankId} size={18} style={{ boxShadow: 'none' }} />
                          <span>{cleanPillName}</span>
                          {c.isShared && (
                            <Users size={12} style={{ opacity: 0.75, marginLeft: '2px' }} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Lista de Cards de Faturas (Clicar em um cartão abre a visão detalhada completa!) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {displayedCards.map(cardItem => {
                      const monthData = calculateInvoiceForMonth(cardItem.id, transactions, targetMonth, targetYear);
                      const invTotal = isCurrentMonth && cardItem.invoiceAmount !== undefined 
                        ? cardItem.invoiceAmount 
                        : monthData.totalAmount;

                      const limit = cardItem.creditLimit || 5000;
                      const used = invTotal;
                      const available = Math.max(0, limit - used);
                      const usedPercent = Math.min(100, Math.round((used / limit) * 100));

                      const dateStatus = calculateCardDateStatus(
                        cardItem.closingDay,
                        cardItem.dueDay,
                        now,
                        cardItem.invoiceAmount,
                        cardItem.invoiceStatus,
                        cardItem.openAmount
                      );

                      const cardAccentColor = cardItem.color || (cardItem.bankId === 'inter' ? '#FF7A00' : '#820AD1');
                      const cleanCardName = cardItem.name
                        .replace(/\s*\(Final\s*[^)]+\)/i, '')
                        .replace(/\s*\(\d+\)/i, '')
                        .trim();
                      const isExpanded = !!expandedCardIds[cardItem.id];

                      return (
                        <div
                          key={cardItem.id}
                          onClick={() => {
                            setDetailCardId(cardItem.id);
                            if (scrollContainerRef.current) {
                              scrollContainerRef.current.scrollTop = 0;
                            }
                          }}
                          style={{
                            backgroundColor: '#131915',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '24px',
                            padding: '18px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '14px',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'transform 0.15s ease, border-color 0.15s ease',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                          }}
                        >
                          {/* Faixa Diagonal de Conta Conjunta no Canto Superior Direito */}
                          {cardItem.isShared && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '16px',
                                right: '-32px',
                                width: '120px',
                                transform: 'rotate(45deg)',
                                backgroundColor: '#0284C7',
                                backgroundImage: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
                                color: '#FFFFFF',
                                fontSize: '0.60rem',
                                fontWeight: 800,
                                letterSpacing: '0.08em',
                                textAlign: 'center',
                                padding: '4px 0',
                                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
                                zIndex: 10,
                                pointerEvents: 'none',
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <span>CONJUNTO</span>
                            </div>
                          )}

                          {/* Topo do Card */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <BankLogo bankId={cardItem.bankId} size={28} />
                              <div>
                                <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>{cleanCardName}</span>
                                  {cardItem.lastDigits && (
                                    <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                                      •••• {cardItem.lastDigits}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                                  Fecha dia {cardItem.closingDay || 1} • Vence dia {cardItem.dueDay || 8}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: cardItem.isShared ? '24px' : '0px', transition: 'margin 0.2s' }}>
                              <CardBrandLogo brand={cardItem.cardBrand || 'mastercard'} size={18} showText={false} />
                              <ChevronRight size={18} color="#94A3B8" />
                            </div>
                          </div>

                          {/* Valor da Fatura + Tag de Status */}
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                            <div>
                              <div
                                style={{
                                  fontSize: '1.65rem',
                                  fontWeight: 800,
                                  color: '#FFFFFF',
                                  fontFamily: "'Outfit', 'Inter', sans-serif",
                                  letterSpacing: '-0.02em',
                                }}
                              >
                                {maskValue(formatBrlCurrency(invTotal))}
                              </div>

                              {cardItem.isShared && cardItem.splitMode !== 'full' && (
                                <div
                                  style={{
                                    fontSize: '0.76rem',
                                    color: '#94A3B8',
                                    marginTop: '3px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                  }}
                                >
                                  <span>Sua parte:</span>
                                  <strong style={{ color: '#4ADE80', fontWeight: 700 }}>
                                    {maskValue(
                                      formatBrlCurrency(
                                        invTotal *
                                          (cardItem.splitMode === 'half'
                                            ? 0.5
                                            : cardItem.splitMode === 'none'
                                            ? 0
                                            : (cardItem.splitRatio ?? 1))
                                      )
                                    )}
                                  </strong>
                                  <span style={{ color: '#64748B', fontSize: '0.70rem' }}>
                                    ({Math.round(
                                      (cardItem.splitMode === 'half'
                                        ? 0.5
                                        : cardItem.splitMode === 'none'
                                        ? 0
                                        : (cardItem.splitRatio ?? 1)) * 100
                                    )}%)
                                  </span>
                                </div>
                              )}
                            </div>

                            <span
                              style={{
                                padding: '4px 12px',
                                borderRadius: '9999px',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                backgroundColor:
                                  dateStatus.displayStatus === 'paid'
                                    ? 'rgba(74, 222, 128, 0.15)'
                                    : dateStatus.displayStatus === 'closed'
                                    ? 'rgba(56, 189, 248, 0.15)'
                                    : 'rgba(251, 146, 60, 0.18)',
                                color:
                                  dateStatus.displayStatus === 'paid'
                                    ? '#4ADE80'
                                    : dateStatus.displayStatus === 'closed'
                                    ? '#38BDF8'
                                    : '#FB923C',
                                border: `1px solid ${
                                  dateStatus.displayStatus === 'paid'
                                    ? 'rgba(74, 222, 128, 0.3)'
                                    : dateStatus.displayStatus === 'closed'
                                    ? 'rgba(56, 189, 248, 0.3)'
                                    : 'rgba(251, 146, 60, 0.35)'
                                }`,
                              }}
                            >
                              {dateStatus.statusLabel}
                            </span>
                          </div>

                          {/* Barra de Limite */}
                          <div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.76rem',
                                color: '#94A3B8',
                                marginBottom: '6px',
                              }}
                            >
                              <span>Limite</span>
                              <span>Disponível: <strong style={{ color: '#E2E8F0' }}>{maskValue(formatBrlCurrency(available))}</strong></span>
                            </div>

                            <div
                              style={{
                                width: '100%',
                                height: '6px',
                                borderRadius: '9999px',
                                backgroundColor: '#1E2721',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${usedPercent}%`,
                                  height: '100%',
                                  backgroundColor: cardAccentColor,
                                  borderRadius: '9999px',
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                          </div>

                          {/* Rodapé de Ações do Cartão */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingTop: '10px',
                              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                            }}
                          >
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                toggleCardExpansion(cardItem.id);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.80rem',
                                fontWeight: 600,
                                color: isExpanded ? '#FFFFFF' : '#94A3B8',
                                backgroundColor: isExpanded ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span>Compras</span>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {onPayInvoice && invTotal > 0 && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  onClose();
                                  onPayInvoice(cardItem);
                                }}
                                style={{
                                  padding: '6px 14px',
                                  borderRadius: '9999px',
                                  backgroundColor: '#1E2721',
                                  border: '1px solid rgba(74, 222, 128, 0.25)',
                                  color: '#4ADE80',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.15)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.backgroundColor = '#1E2721';
                                }}
                              >
                                Pagar Fatura
                              </button>
                            )}
                          </div>

                          {/* Lista Expansível de Compras (Até 3 mais recentes, flat e limpa) */}
                          {isExpanded && (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                marginTop: '4px',
                                paddingTop: '8px',
                                borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
                              }}
                            >
                              {monthData.transactions.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '12px 0', fontSize: '0.78rem', color: '#64748B' }}>
                                  Nenhum lançamento registrado nesta fatura.
                                </div>
                              ) : (
                                <>
                                  {monthData.transactions.slice(0, 3).map(tx => {
                                    const txCat = categories.find(c => c.id === tx.categoryId);
                                    const effective = getEffectiveTransactionAmount(tx, accounts);
                                    const isShared = cardItem.isShared && effective !== tx.amount;

                                    return (
                                      <div
                                        key={tx.id}
                                        onClick={e => {
                                          e.stopPropagation();
                                          setEditingTx(tx);
                                        }}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '8px 10px',
                                          borderRadius: '10px',
                                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                          cursor: 'pointer',
                                          gap: '10px',
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                          <div
                                            style={{
                                              width: '26px',
                                              height: '26px',
                                              borderRadius: '8px',
                                              backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              color: '#94A3B8',
                                              flexShrink: 0,
                                            }}
                                          >
                                            <IconRenderer name={txCat?.icon || 'Tag'} size={13} />
                                          </div>
                                          <div style={{ minWidth: 0, flex: 1 }}>
                                            <div
                                              style={{
                                                fontSize: '0.82rem',
                                                fontWeight: 600,
                                                color: '#FFFFFF',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                              }}
                                            >
                                              {tx.description}
                                            </div>
                                            <div style={{ fontSize: '0.70rem', color: '#64748B' }}>
                                              {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} • {txCat?.name || 'Geral'}
                                              {tx.installmentTotal && tx.installmentTotal > 1 && (
                                                <span style={{ color: '#4ADE80', marginLeft: '4px' }}>
                                                  ({tx.installmentNumber}/{tx.installmentTotal})
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                          <div
                                            style={{
                                              fontSize: '0.84rem',
                                              fontWeight: 700,
                                              color: tx.type === 'expense' ? '#FB7185' : '#4ADE80',
                                              whiteSpace: 'nowrap',
                                              fontFamily: "'Outfit', 'Inter', sans-serif",
                                            }}
                                          >
                                            {tx.type === 'expense' ? '-' : '+'} {maskValue(formatBrlCurrency(isShared ? effective : tx.amount))}
                                          </div>
                                          {isShared && (
                                            <div style={{ fontSize: '0.64rem', color: '#38BDF8', fontWeight: 600 }}>
                                              sua cota
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {monthData.transactions.length > 3 ? (
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation();
                                        setDetailCardId(cardItem.id);
                                        if (scrollContainerRef.current) {
                                          scrollContainerRef.current.scrollTop = 0;
                                        }
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        padding: '6px 0 2px',
                                        background: 'none',
                                        border: 'none',
                                        color: '#4ADE80',
                                        fontSize: '0.76rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <span>+ {monthData.transactions.length - 3} compras na fatura • Ver todas</span>
                                      <ChevronRight size={13} />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation();
                                        setDetailCardId(cardItem.id);
                                        if (scrollContainerRef.current) {
                                          scrollContainerRef.current.scrollTop = 0;
                                        }
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        padding: '4px 0 2px',
                                        background: 'none',
                                        border: 'none',
                                        color: '#64748B',
                                        fontSize: '0.74rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <span>Ver extrato completo</span>
                                      <ChevronRight size={13} />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Aba Parcelas */}
              {activeTab === 'parcelas' && (
                <div style={{ padding: '20px 20px 30px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>
                      Compras Parceladas Ativas
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#94A3B8' }}>
                      Acompanhe o impacto das suas compras parceladas nos próximos meses
                    </p>
                  </div>

                  {finance.activeInstallmentGroups.length === 0 ? (
                    <div
                      style={{
                        padding: '36px 20px',
                        textAlign: 'center',
                        backgroundColor: '#131915',
                        borderRadius: '20px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <Layers size={32} color="#64748B" style={{ margin: '0 auto 10px' }} />
                      <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#FFFFFF' }}>
                        Nenhuma compra parcelada ativa
                      </p>
                      <span style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
                        Ao registrar despesas no cartão, marque como parcelada para acompanhar a evolução aqui.
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {finance.activeInstallmentGroups.map(group => {
                        const card = finance.accounts.find(a => a.id === group.accountId);
                        const progress = Math.min(100, Math.round((group.paidInstallmentsCount / Math.max(1, group.installmentTotal)) * 100));

                        return (
                          <div
                            key={group.groupId}
                            style={{
                              backgroundColor: '#131915',
                              borderRadius: '20px',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              padding: '16px 18px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF' }}>
                                  {group.description}
                                </div>
                                <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: '2px' }}>
                                  {card?.name || 'Cartão'} {card?.lastDigits ? `•••• ${card.lastDigits}` : ''} • Parcela {group.paidInstallmentsCount} de {group.installmentTotal}
                                </div>
                              </div>

                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#FB7185' }}>
                                  {maskValue(formatBrlCurrency(group.monthlyAmount))} /mês
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                  Total: {maskValue(formatBrlCurrency(group.originalTotalAmount))}
                                </div>
                              </div>
                            </div>

                            <div
                              style={{
                                width: '100%',
                                height: '5px',
                                borderRadius: '9999px',
                                backgroundColor: '#1E2721',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${progress}%`,
                                  height: '100%',
                                  backgroundColor: '#4ADE80',
                                  borderRadius: '9999px',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Aba Limites */}
              {activeTab === 'limites' && (
                <div style={{ padding: '20px 20px 30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>
                      Gestão Consolidada de Limites
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#94A3B8' }}>
                      Acompanhe o comprometimento total e a saúde do seu crédito
                    </p>
                  </div>

                  {(() => {
                    const totalLimit = creditCards.reduce((acc, c) => acc + (c.creditLimit || 5000), 0);
                    const totalUsed = creditCards.reduce((acc, c) => {
                      const monthData = calculateInvoiceForMonth(c.id, transactions, currentMonth, currentYear);
                      return acc + (c.invoiceAmount !== undefined ? c.invoiceAmount : monthData.totalAmount);
                    }, 0);
                    const totalAvail = Math.max(0, totalLimit - totalUsed);
                    const percent = totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0;

                    return (
                      <div
                        style={{
                          backgroundColor: '#131915',
                          borderRadius: '24px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          padding: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                        }}
                      >
                        <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500 }}>
                          Limite Total em Cartões
                        </span>

                        <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#FFFFFF' }}>
                          {maskValue(formatBrlCurrency(totalLimit))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={{ padding: '10px 12px', borderRadius: '12px', backgroundColor: '#18201B' }}>
                            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Utilizado</span>
                            <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#FB923C', marginTop: '2px' }}>
                              {maskValue(formatBrlCurrency(totalUsed))}
                            </div>
                          </div>
                          <div style={{ padding: '10px 12px', borderRadius: '12px', backgroundColor: '#18201B' }}>
                            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Disponível</span>
                            <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#4ADE80', marginTop: '2px' }}>
                              {maskValue(formatBrlCurrency(totalAvail))}
                            </div>
                          </div>
                        </div>

                        <div style={{ width: '100%', height: '8px', borderRadius: '9999px', backgroundColor: '#1E2721', overflow: 'hidden' }}>
                          <div style={{ width: `${percent}%`, height: '100%', backgroundColor: '#4ADE80', borderRadius: '9999px' }} />
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFFFFF' }}>
                      Detalhamento por Cartão (Toque para ver detalhes)
                    </span>

                    {creditCards.map(c => {
                      const limit = c.creditLimit || 5000;
                      const monthData = calculateInvoiceForMonth(c.id, transactions, currentMonth, currentYear);
                      const used = c.invoiceAmount !== undefined ? c.invoiceAmount : monthData.totalAmount;
                      const avail = Math.max(0, limit - used);
                      const percent = Math.min(100, Math.round((used / limit) * 100));

                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setDetailCardId(c.id);
                            if (scrollContainerRef.current) {
                              scrollContainerRef.current.scrollTop = 0;
                            }
                          }}
                          style={{
                            backgroundColor: '#131915',
                            borderRadius: '18px',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            cursor: 'pointer',
                            transition: 'border-color 0.15s ease',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <BankLogo bankId={c.bankId} size={22} />
                              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF' }}>
                                {c.name} {c.lastDigits ? `•••• ${c.lastDigits}` : ''}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>
                                {maskValue(formatBrlCurrency(limit))}
                              </span>
                              <ChevronRight size={16} color="#64748B" />
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94A3B8' }}>
                            <span>Usado: <strong style={{ color: '#FB923C' }}>{maskValue(formatBrlCurrency(used))}</strong></span>
                            <span>Disponível: <strong style={{ color: '#4ADE80' }}>{maskValue(formatBrlCurrency(avail))}</strong></span>
                          </div>

                          <div style={{ width: '100%', height: '5px', borderRadius: '9999px', backgroundColor: '#1E2721', overflow: 'hidden' }}>
                            <div style={{ width: `${percent}%`, height: '100%', backgroundColor: c.color || '#4ADE80', borderRadius: '9999px' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal de Confirmação de Exclusão de Transação Individual */}
        {txToDelete && (
          <ConfirmModal
            isOpen={!!txToDelete}
            onClose={() => setTxToDelete(null)}
            onConfirm={async () => {
              await finance.deleteTransaction(txToDelete.id);
              setTxToDelete(null);
            }}
            title="Excluir Lançamento"
            description={`Deseja realmente excluir "${txToDelete.description}" desta fatura?`}
            confirmText="Sim, Excluir"
            cancelText="Cancelar"
            variant="danger"
            itemDetails={{
              title: txToDelete.description,
              amount: `- R$ ${txToDelete.amount.toFixed(2).replace('.', ',')}`,
            }}
          />
        )}

        {/* Modal de Confirmação de Exclusão do Cartão de Crédito */}
        {isDeleteCardConfirmOpen && currentDetailCard && (
          <ConfirmModal
            isOpen={isDeleteCardConfirmOpen}
            onClose={() => setIsDeleteCardConfirmOpen(false)}
            onConfirm={async () => {
              await finance.deleteAccount(currentDetailCard.id);
              setIsDeleteCardConfirmOpen(false);
              setDetailCardId(null);
              setSelectedCardId('all');
            }}
            title="Excluir cartão"
            description="Todas as faturas, compras e histórico vinculados a este cartão serão removidos permanentemente."
            confirmText="Excluir cartão"
            cancelText="Cancelar"
            variant="danger"
            itemDetails={{
              title: currentDetailCard.name,
              subtitle: currentDetailCard.lastDigits ? `Final •••• ${currentDetailCard.lastDigits}` : 'Cartão de crédito',
              bankId: currentDetailCard.bankId,
              amount: currentDetailCard.creditLimit ? formatBrlCurrency(currentDetailCard.creditLimit) : undefined,
              amountLabel: currentDetailCard.creditLimit ? 'Limite' : undefined,
              isAmountDestructive: false,
            }}
          />
        )}

        {/* Modal de Edição de Transação Selecionada */}
        {editingTx && (
          <TransactionModal
            isOpen={!!editingTx}
            onClose={() => setEditingTx(null)}
            initialData={editingTx}
            zIndex={3500}
          />
        )}


      </div>
    </>
  );
};
