import React, { useState, useMemo, useRef } from 'react';
import { ConfirmModal } from '../common/ConfirmModal';
import { Button } from '../common/Button';
import { BankLogo } from '../common/BankLogo';
import { CardBrandLogo } from '../common/MastercardLogo';
import { IconRenderer } from '../common/IconRenderer';
import { BrandLogo } from '../common/BrandLogo';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from '../common/SwipeBackIndicator';
import { formatBrlCurrency, parseBrlCurrency } from '../../core/parsers/currencyHelper';
import { Account, Transaction, Category, ActiveInstallmentGroup } from '../../core/types';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  calculateFutureInvoiceTimeline, 
  calculateInvoiceForMonth, 
  getActiveInstallmentGroups,
  getTransactionOriginalPurchaseDate,
  MONTH_NAMES 
} from '../../core/installments/installmentHelper';
import { extractInstallmentFromDescription } from '../../core/parsers/csvParser';
import { calculateCardDateStatus, getCardActiveInvoiceInfo } from '../../core/cards/cardDateHelper';
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
  TrendingDown,
  TrendingUp,
  PieChart,
  RotateCcw,
  Users,
  UploadCloud,
  FileText,
  Receipt
} from 'lucide-react';
import { TransactionModal } from './TransactionModal';
import { CsvImportModal } from './CsvImportModal';
import { resolveCategoryVisual } from '../dashboard/MonthOverviewCard';
import { getEffectiveTransactionAmount } from '../../core/calculations';
import { useAuth } from '../../context/AuthContext';
import { getCardHolderLabelForDigits } from '../../core/cards/cardSelectionHelper';

interface CardInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  card?: Account | null;
  initialMonthOffset?: number;
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

// Identifica se uma transação veio de importação CSV/PDF
const isCardImportedTx = (t: Transaction): boolean => {
  return Boolean(
    t.source === 'csv' ||
    t.id.startsWith('tx-csv-') ||
    (t.notes && t.notes.includes('Importado via')) ||
    (t.id.startsWith('tx-inst-') && t.notes && t.notes.includes('importação'))
  );
};

// Verifica se a importação ocorreu no mesmo dia (hoje no calendário ou últimas 24h)
const isTxImportedToday = (tx: Transaction): boolean => {
  let createdDate: Date | null = null;

  if (tx.createdAt) {
    const d = new Date(tx.createdAt);
    if (!isNaN(d.getTime())) {
      createdDate = d;
    }
  }

  // Fallback: extrai timestamp do ID no formato tx-csv-<timestamp>-...
  if (!createdDate && tx.id.startsWith('tx-csv-')) {
    const parts = tx.id.split('-');
    const ts = Number(parts[2]);
    if (!isNaN(ts) && ts > 0) {
      createdDate = new Date(ts);
    }
  }

  if (!createdDate) return false;

  const now = new Date();
  const isSameCalendarDay =
    createdDate.getFullYear() === now.getFullYear() &&
    createdDate.getMonth() === now.getMonth() &&
    createdDate.getDate() === now.getDate();

  if (isSameCalendarDay) return true;

  const diffHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours < 24;
};

export const CardInvoiceModal: React.FC<CardInvoiceModalProps> = ({
  isOpen,
  onClose,
  card: initialCard,
  initialMonthOffset,
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
  const { user } = useAuth();
  const { colors } = useTheme();

  // Estados principais
  const transactions = propTxs || finance.transactions;
  const categories = propCats || finance.categories;
  const isPrivacy = propPrivacy !== undefined ? propPrivacy : finance.isPrivacyMode;
  const togglePrivacy = finance.togglePrivacyMode;
  const accounts = finance.accounts;
  const subscriptions = finance.subscriptions;

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
  const [selectedMonthOffset, setSelectedMonthOffset] = useState<number>(() => {
    if (initialMonthOffset !== undefined) return initialMonthOffset;
    return 0;
  });

  // Expansão rápida de lançamentos de cada cartão (até 3 mais recentes)
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const toggleCardExpansion = (id: string) => setExpandedCardIds(prev => ({ ...prev, [id]: !prev[id] }));


  // Modais de Edição e Exclusão de Transação
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<ActiveInstallmentGroup | null>(null);

  // Grupos consolidados de parcelamentos calculados reativamente sobre as transações
  const allInstallmentGroups = useMemo(() => {
    return getActiveInstallmentGroups(transactions, undefined, false, finance.accounts);
  }, [transactions, finance.accounts]);

  const displayedInstallmentGroups = useMemo(() => {
    if (selectedCardId && selectedCardId !== 'all') {
      return allInstallmentGroups.filter(g => g.accountId === selectedCardId);
    }
    return allInstallmentGroups;
  }, [allInstallmentGroups, selectedCardId]);

  // Modal de Confirmação de Exclusão do Cartão
  const [isDeleteCardConfirmOpen, setIsDeleteCardConfirmOpen] = useState(false);

  // Modal de Importação de Fatura para o Mês Selecionado
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Modal de Confirmação para Desfazer Pagamento de Fatura
  // Modal de Confirmação para Limpar Lançamentos Importados deste Cartão
  const [isConfirmingClearImport, setIsConfirmingClearImport] = useState(false);
  const [isClearingImport, setIsClearingImport] = useState(false);

  const [undoPaymentTarget, setUndoPaymentTarget] = useState<{ card: Account; month: number; year: number } | null>(null);
  const [isUndoingPayment, setIsUndoingPayment] = useState(false);

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

  const prevIsOpenRef = useRef(false);
  const prevInitialCardIdRef = useRef<string | undefined>(undefined);
  const creditCardsRef = useRef(creditCards);
  creditCardsRef.current = creditCards;
  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;
  const subscriptionsRef = useRef(subscriptions);
  subscriptionsRef.current = subscriptions;

  // Sincroniza seleção de cartão e offset do mês APENAS quando o modal abre ou quando o cartão inicial muda externamente
  React.useEffect(() => {
    const isOpening = isOpen && !prevIsOpenRef.current;
    const isCardChanged = initialCard?.id !== prevInitialCardIdRef.current;

    prevIsOpenRef.current = isOpen;
    prevInitialCardIdRef.current = initialCard?.id;

    if (isOpen && (isOpening || isCardChanged)) {
      if (initialCard) {
        setSelectedCardId(initialCard.id);
        setDetailCardId(initialCard.id);
      } else {
        setSelectedCardId('all');
        setDetailCardId(null);
      }

      if (initialMonthOffset !== undefined) {
        setSelectedMonthOffset(initialMonthOffset);
      } else {
        const targetCards = initialCard ? [initialCard] : creditCardsRef.current;
        const hasUnpaidClosedPrev = targetCards.some(c => {
          const info = getCardActiveInvoiceInfo(c, transactionsRef.current, new Date(), subscriptionsRef.current);
          return info.monthOffset === -1 && !info.isPaid && info.totalAmount > 0;
        });
        if (hasUnpaidClosedPrev) {
          setSelectedMonthOffset(-1);
        } else {
          setSelectedMonthOffset(0);
        }
      }
    }
  }, [isOpen, initialCard?.id, initialMonthOffset]);

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

  const swipeState = useSwipeBack({ onBack: handleBack, enabled: isOpen, allowedEdges: ['left'] });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + selectedMonthOffset, 1);
  const targetMonth = targetDate.getMonth() + 1; // 1-12
  const targetYear = targetDate.getFullYear();
  const isCurrentMonth = selectedMonthOffset === 0;

  // Padrão Bancário Brasileiro: A fatura é identificada pelo Mês de Vencimento (dueMonth)
  const dueTargetDate = new Date(now.getFullYear(), now.getMonth() + selectedMonthOffset + 1, 1);
  const dueMonth = dueTargetDate.getMonth() + 1; // 1-12 (ex: Novembro quando targetMonth é Outubro)
  const dueYear = dueTargetDate.getFullYear();

  // Localiza os lançamentos de pagamento de fatura associados ao cartão e ciclo
  const findPaymentTransactions = (card: Account, month: number, year: number): Transaction[] => {
    const cleanName = card.name
      .replace(/\s*\(Final\s*[^)]+\)/i, '')
      .replace(/\s*••••\s*\d+/i, '')
      .replace(/\s*\(\d+\)/i, '')
      .trim()
      .toLowerCase();

    const isPaymentTx = (t: Transaction) => {
      if (t.status !== 'confirmed') return false;
      if (t.type !== 'expense' && t.type !== 'transfer') return false;
      const desc = (t.description || '').toLowerCase();
      return (
        t.isInvoicePayment === true ||
        desc.includes('pagamento fatura') ||
        desc.includes('pagamento de fatura') ||
        desc.includes('fatura paga') ||
        (t.paymentMethod === 'transfer' && desc.includes('fatura'))
      );
    };

    const matchesCard = (t: Transaction) => {
      if (t.destinationAccountId && t.destinationAccountId === card.id) return true;
      const desc = (t.description || '').toLowerCase();
      if (cleanName && desc.includes(cleanName)) return true;
      if (desc.includes(card.name.toLowerCase())) return true;
      if (card.lastDigits && desc.includes(card.lastDigits)) return true;
      if (card.additionalCardLastDigits && desc.includes(card.additionalCardLastDigits)) return true;
      if (card.additionalCards?.some(ac => ac.lastDigits && desc.includes(ac.lastDigits))) return true;
      return false;
    };

    // 1. Pagamentos diretamente vinculados/nomeados para este cartão
    const cardPayments = transactions.filter(t => isPaymentTx(t) && matchesCard(t));

    if (cardPayments.length > 0) {
      const dueMonth = month === 12 ? 1 : month + 1;
      const dueYear = month === 12 ? year + 1 : year;

      const scored = cardPayments.map(t => {
        let score = 0;
        if (t.competenceMonth === month && t.competenceYear === year) score += 40;
        if (t.competenceMonth && (t.competenceMonth !== month || t.competenceYear !== year)) score -= 50;
        const d = new Date(t.date);
        const txM = d.getUTCMonth() + 1;
        const txY = d.getUTCFullYear();
        if (txM === dueMonth && txY === dueYear) score += 20;
        return { tx: t, score, time: d.getTime() };
      });

      scored.sort((a, b) => b.score - a.score || b.time - a.time);

      const topMatched = scored.filter(s => s.score >= 15).map(s => s.tx);
      if (topMatched.length > 0) return topMatched;

      // Fallback: pagamento explicitamente vinculado ao cartão (destinationAccountId) com competência divergente.
      // Evita desfazer a fatura sem remover a saída do fluxo de caixa.
      const directLinked = cardPayments
        .filter(t => t.destinationAccountId === card.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (directLinked.length > 0) return [directLinked[0]];

      return [];
    }

    // 2. Se não encontrou pelo nome do cartão, busca pagamentos genéricos de fatura no período
    const genericPayments = transactions.filter(isPaymentTx);
    if (genericPayments.length > 0) {
      const dueMonth = month === 12 ? 1 : month + 1;
      const dueYear = month === 12 ? year + 1 : year;

      const genericMatched = genericPayments.filter(t => {
        if (t.competenceMonth && (t.competenceMonth !== month || t.competenceYear !== year)) return false;
        if (t.competenceMonth === month && t.competenceYear === year) return true;
        const d = new Date(t.date);
        const txM = d.getUTCMonth() + 1;
        const txY = d.getUTCFullYear();
        return txM === dueMonth && txY === dueYear;
      });

      if (genericMatched.length > 0) {
        return genericMatched.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }

      return [];
    }

    return [];
  };

  const undoMatchingPayments = useMemo(() => {
    if (!undoPaymentTarget) return [];
    return findPaymentTransactions(undoPaymentTarget.card, undoPaymentTarget.month, undoPaymentTarget.year);
  }, [undoPaymentTarget, transactions]);

  const undoTotalPaymentAmount = useMemo(() => {
    return undoMatchingPayments.reduce((sum, t) => sum + t.amount, 0);
  }, [undoMatchingPayments]);

  const handleConfirmUndoPayment = async () => {
    if (!undoPaymentTarget) return;
    const { card, month, year } = undoPaymentTarget;
    setIsUndoingPayment(true);

    try {
      const paymentsToDelete = findPaymentTransactions(card, month, year);

      // 1. Exclui os lançamentos de pagamento da conta bancária de débito
      // Isso cancela as saídas do Fluxo de Caixa (paidInvoicesAmount) e devolve o saldo à conta
      for (const pTx of paymentsToDelete) {
        await finance.deleteTransaction(pTx.id);
      }

      // 2. Determina o ciclo correto da fatura fechada a ser restaurada
      const deletedIds = new Set(paymentsToDelete.map(p => p.id));
      const remainingTxs = transactions.filter(t => !deletedIds.has(t.id));

      const closingD = card.closingDay || 1;
      const dueD = card.dueDay || 8;
      const nowDay = now.getDate();
      let targetInvoiceMonth = month;
      let targetInvoiceYear = year;

      if (month === currentMonth && year === currentYear && closingD <= dueD && nowDay >= closingD) {
        const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
        const prevInv = calculateInvoiceForMonth(card.id, remainingTxs, prevM, prevY, subscriptions);
        if (prevInv.totalAmount > 0) {
          targetInvoiceMonth = prevM;
          targetInvoiceYear = prevY;
        }
      }

      const invoiceData = calculateInvoiceForMonth(card.id, remainingTxs, targetInvoiceMonth, targetInvoiceYear, subscriptions);

      const userRatio = card.isShared
        ? (card.splitRatio !== undefined ? card.splitRatio : card.splitMode === 'half' ? 0.5 : 1.0)
        : 1.0;
      const totalPaymentsDeleted = paymentsToDelete.reduce((s, p) => s + p.amount, 0);
      const estimatedFullFromPayment = userRatio > 0 ? Math.round((totalPaymentsDeleted / userRatio) * 100) / 100 : totalPaymentsDeleted;

      const restoredAmount = invoiceData.totalAmount > 0
        ? invoiceData.totalAmount
        : (estimatedFullFromPayment || card.invoiceAmount || 0);

      // Compras em aberto do ciclo atual
      const openCycleData = calculateInvoiceForMonth(card.id, remainingTxs, currentMonth, currentYear, subscriptions);
      const restoredOpenAmount = openCycleData.totalAmount;

      await finance.saveAccount({
        ...card,
        balance: restoredAmount,
        invoiceAmount: restoredAmount,
        openAmount: restoredOpenAmount,
        invoiceStatus: 'closed',
      });

      setUndoPaymentTarget(null);
    } catch (err) {
      console.error('Erro ao desfazer pagamento de fatura:', err);
      alert('Não foi possível desfazer o pagamento da fatura.');
    } finally {
      setIsUndoingPayment(false);
    }
  };

  const maskValue = (formatted: string) => (isPrivacy ? '••••••' : formatted);

  // Cartão atual para a tela detalhada
  const currentDetailCard = creditCards.find(c => c.id === detailCardId) || null;

  // Notifica o contexto sobre o cartão aberto atualmente na tela para auto-seleção inteligente
  React.useEffect(() => {
    if (isOpen && currentDetailCard) {
      finance.setActiveViewedCardId(currentDetailCard.id);
    } else if (!isOpen) {
      finance.setActiveViewedCardId(null);
    }
    return () => {
      finance.setActiveViewedCardId(null);
    };
  }, [isOpen, currentDetailCard?.id]);

  // Apenas o titular/criador do grupo/cartão pode excluir o cartão compartilhado
  const isDetailCardCreator = !currentDetailCard?.isShared || (
    currentDetailCard.ownerId
      ? currentDetailCard.ownerId === user?.id
      : (finance.partnershipSpace ? finance.partnershipSpace.ownerId === user?.id : true)
  );

  // Cartões a serem exibidos de acordo com o filtro selecionado (na visão consolidada)
  const displayedCards = selectedCardId === 'all' 
    ? creditCards 
    : creditCards.filter(c => c.id === selectedCardId);

  // Gera dados dos 7 meses para o gráfico de barras estilo Pierre (5 anteriores, atual, 1 futuro)
  const monthBarChartData = [-5, -4, -3, -2, -1, 0, 1].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();

    const dDue = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
    const dueM = dDue.getMonth() + 1;
    const dueY = dDue.getFullYear();

    const total = displayedCards.reduce((acc, c) => {
      const monthData = calculateInvoiceForMonth(c.id, transactions, m, y, subscriptions);
      const amount = monthData.transactions.length > 0 
        ? monthData.totalAmount 
        : (offset === 0 && c.invoiceAmount !== undefined ? c.invoiceAmount : monthData.totalAmount);
      return acc + amount;
    }, 0);

    return {
      offset,
      monthNum: dueM,
      year: dueY,
      label: MONTH_ABBR[dueM - 1],
      total,
      isSelected: offset === selectedMonthOffset,
    };
  });

  const maxMonthTotal = Math.max(...monthBarChartData.map(d => d.total), 100);

  const totalInvoicesSelectedMonth = displayedCards.reduce((acc, c) => {
    const monthData = calculateInvoiceForMonth(c.id, transactions, targetMonth, targetYear, subscriptions);
    const amount = monthData.transactions.length > 0 
      ? monthData.totalAmount 
      : (isCurrentMonth && c.invoiceAmount !== undefined ? c.invoiceAmount : monthData.totalAmount);
    return acc + amount;
  }, 0);

  const nextDueDateInfo = (() => {
    if (displayedCards.length === 0) return null;

    let earliestDueDate: { day: number; month: number; daysLeft: number } | null = null;
    let minDays = Infinity;
    let allPaid = true;

    displayedCards.forEach(c => {
      const monthData = calculateInvoiceForMonth(c.id, transactions, targetMonth, targetYear, subscriptions);
      const invTotal = monthData.transactions.length > 0
        ? monthData.totalAmount
        : (isCurrentMonth && c.invoiceAmount !== undefined ? c.invoiceAmount : monthData.totalAmount);

      const dateStatus = calculateCardDateStatus(
        c.closingDay,
        c.dueDay,
        now,
        invTotal,
        c.invoiceStatus,
        c.openAmount,
        targetMonth,
        targetYear
      );

      const isPaid = dateStatus.displayStatus === 'paid';
      if (!isPaid && invTotal > 0) {
        allPaid = false;
      }

      const dueDay = c.dueDay || 8;
      const closingDay = c.closingDay || 1;
      let m = targetMonth;
      let y = targetYear;

      if (closingDay <= dueDay) {
        m = targetMonth === 12 ? 1 : targetMonth + 1;
        y = targetMonth === 12 ? targetYear + 1 : targetYear;
      }

      const todayNoTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dueNoTime = new Date(y, m - 1, dueDay);
      const diffDays = Math.round((dueNoTime.getTime() - todayNoTime.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < minDays) {
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
      daysLeftText:
        daysLeft === 0
          ? 'Vence hoje'
          : daysLeft === 1
          ? 'em 1 dia'
          : daysLeft > 1
          ? `em ${daysLeft} dias`
          : `venceu há ${Math.abs(daysLeft)} dia${Math.abs(daysLeft) === 1 ? '' : 's'}`,
      isAllPaid: allPaid && totalInvoicesSelectedMonth > 0,
    };
  })();


  // -------------------------------------------------------------
  // CÁLCULOS ESPECÍFICOS DA TELA DETALHADA DO CARTÃO
  // -------------------------------------------------------------
  const cardDetailData = (() => {
    if (!currentDetailCard) return null;

    const monthData = calculateInvoiceForMonth(currentDetailCard.id, transactions, targetMonth, targetYear, subscriptions);
    const cardTxs = monthData.transactions;

    const invoiceAmount = monthData.transactions.length > 0
      ? monthData.totalAmount
      : ((isCurrentMonth && currentDetailCard.invoiceAmount !== undefined)
          ? currentDetailCard.invoiceAmount
          : monthData.totalAmount);

    const limit = currentDetailCard.creditLimit || 5000;
    const used = invoiceAmount;
    const available = Math.max(0, limit - used);
    const usedPercent = Math.min(100, Math.round((used / limit) * 100));

    const dateStatus = calculateCardDateStatus(
      currentDetailCard.closingDay,
      currentDetailCard.dueDay,
      now,
      invoiceAmount,
      currentDetailCard.invoiceStatus,
      currentDetailCard.openAmount,
      targetMonth,
      targetYear
    );

    const dueDay = currentDetailCard.dueDay || 10;
    const dueMonth = targetMonth === 12 ? 1 : targetMonth + 1;
    const pad = (n: number) => String(n).padStart(2, '0');
    const nextDueInfo = {
      text: `${pad(dueDay)}/${pad(dueMonth)}`,
      daysLeftText:
        dateStatus.daysUntilDue === 0
          ? 'Vence hoje'
          : dateStatus.daysUntilDue === 1
          ? 'em 1 dia'
          : dateStatus.daysUntilDue > 1
          ? `em ${dateStatus.daysUntilDue} dias`
          : `venceu há ${Math.abs(dateStatus.daysUntilDue)} dia${Math.abs(dateStatus.daysUntilDue) === 1 ? '' : 's'}`,
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

  // Transações importadas pertinentes à fatura da tela atual e que foram importadas no mesmo dia (hoje)
  const currentMonthImportedTxs = useMemo(() => {
    if (!currentDetailCard || !cardDetailData || !cardDetailData.cardTxs) return [];
    return cardDetailData.cardTxs.filter(t => {
      if (!isCardImportedTx(t)) return false;
      // Não exibe caso seja apenas uma projeção de parcela futura que caiu nesta fatura
      if (t.notes && t.notes.includes('Parcela futura projetada')) return false;
      return isTxImportedToday(t);
    });
  }, [currentDetailCard, cardDetailData]);

  const importedTxsCount = currentMonthImportedTxs.length;

  const handleClearImported = async () => {
    if (!currentDetailCard || currentMonthImportedTxs.length === 0) return;
    setIsClearingImport(true);
    try {
      // Coleta grupos parcelados vinculados para limpar tanto as compras da tela quanto suas parcelas futuras vinculadas
      const targetGroupIds = new Set(
        currentMonthImportedTxs
          .filter(t => t.isInstallment && t.installmentGroupId)
          .map(t => t.installmentGroupId!)
      );

      const allIdsToDelete = new Set(currentMonthImportedTxs.map(t => t.id));

      transactions.forEach(t => {
        if (
          t.accountId === currentDetailCard.id &&
          t.installmentGroupId &&
          targetGroupIds.has(t.installmentGroupId) &&
          isCardImportedTx(t)
        ) {
          allIdsToDelete.add(t.id);
        }
      });

      const count = await finance.deleteCardImportedTransactions(
        currentDetailCard.id,
        Array.from(allIdsToDelete)
      );
      alert(`${count} lançamentos importados foram removidos com sucesso! Você já pode reimportar a fatura corrigida.`);
      setIsConfirmingClearImport(false);
    } catch (err: any) {
      alert(`Erro ao remover lançamentos: ${err.message || 'Erro inesperado'}`);
    } finally {
      setIsClearingImport(false);
    }
  };

  // Processar categorias do cartão específico no formato e cores idênticos à Visão do Mês da Home
  const cardCategoryBreakdown = useMemo(() => {
    if (!cardDetailData || cardDetailData.expenses.length === 0) return [];

    const catMap: Record<string, { categoryId: string; categoryName: string; amount: number; color?: string }> = {};
    cardDetailData.expenses.forEach(tx => {
      const cat = categories.find(c => c.id === tx.categoryId);
      const catId = cat?.id || (tx.categoryId ? tx.categoryId : 'sem_categoria');
      const catName = cat?.name || (tx.categoryId === 'cat-outros-desp' ? 'Outras Despesas' : 'Sem Categoria');
      if (!catMap[catId]) {
        catMap[catId] = {
          categoryId: catId,
          categoryName: catName,
          amount: 0,
          color: cat?.color || (catId === 'sem_categoria' ? '#94A3B8' : undefined),
        };
      }
      catMap[catId].amount += tx.amount;
    });

    const rawList = Object.values(catMap);
    const total = cardDetailData.totalExpenses;

    // Exibe até 8 categorias completas e individuais antes de agrupar em "Outras Categorias"
    const MAX_CATEGORIES = 8;
    if (rawList.length <= MAX_CATEGORIES) {
      const mapped = rawList.map((c, i) => {
        const visual = resolveCategoryVisual(c, i);
        return {
          ...c,
          categoryName: visual.name,
          color: visual.color,
          percentage: total > 0 ? (c.amount / total) * 100 : 0,
        };
      });
      mapped.sort((a, b) => b.amount - a.amount);
      return mapped;
    }

    const sorted = [...rawList].sort((a, b) => b.amount - a.amount);
    const topCategories = sorted.slice(0, 7);
    const others = sorted.slice(7);
    const othersAmount = others.reduce((sum, c) => sum + c.amount, 0);
    const othersCatIds = others.map(c => c.categoryId);

    const result = topCategories.map((c, i) => {
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
        categoryName: 'Outras Categorias',
        amount: othersAmount,
        color: '#9EA3A9',
        percentage: total > 0 ? (othersAmount / total) * 100 : 0,
        aggregatedCatIds: othersCatIds,
      } as any);
    }

    const nonOthers = result.filter(c => c.categoryId !== 'others' && c.categoryName !== 'Outros' && c.categoryName !== 'Outras Categorias');
    const othersItem = result.find(c => c.categoryId === 'others' || c.categoryName === 'Outros' || c.categoryName === 'Outras Categorias');
    nonOthers.sort((a, b) => b.amount - a.amount);
    return othersItem ? [...nonOthers, othersItem] : nonOthers;
  }, [cardDetailData, categories]);

  // Se a categoria selecionada não existir mais após edições, reseta a seleção
  React.useEffect(() => {
    if (selectedCatId && !cardCategoryBreakdown.some(c => c.categoryId === selectedCatId)) {
      setSelectedCatId(null);
    }
  }, [cardCategoryBreakdown, selectedCatId]);

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

  // Estados e manipuladores para affordance de scroll das categorias da fatura
  const categoryListRef = useRef<HTMLDivElement>(null);
  const [canScrollCategoriesDown, setCanScrollCategoriesDown] = useState(false);
  const [canScrollCategoriesUp, setCanScrollCategoriesUp] = useState(false);
  const isDraggingCategories = useRef(false);
  const dragStartY = useRef(0);
  const dragScrollTop = useRef(0);
  const hasMovedDrag = useRef(false);

  const checkCategoryScroll = React.useCallback(() => {
    const el = categoryListRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 4;
    setCanScrollCategoriesUp(el.scrollTop > 4);
    setCanScrollCategoriesDown(hasOverflow && el.scrollTop + el.clientHeight < el.scrollHeight - 6);
  }, []);

  React.useEffect(() => {
    checkCategoryScroll();
    const timer = setTimeout(checkCategoryScroll, 80);
    return () => clearTimeout(timer);
  }, [cardCategoryBreakdown, checkCategoryScroll]);

  React.useEffect(() => {
    const onGlobalMouseUp = () => {
      isDraggingCategories.current = false;
    };
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => window.removeEventListener('mouseup', onGlobalMouseUp);
  }, []);

  const handleCategoryMouseDown = (e: React.MouseEvent) => {
    if (cardCategoryBreakdown.length <= 4) return;
    isDraggingCategories.current = true;
    hasMovedDrag.current = false;
    dragStartY.current = e.pageY;
    if (categoryListRef.current) {
      dragScrollTop.current = categoryListRef.current.scrollTop;
    }
  };

  const handleCategoryMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCategories.current || !categoryListRef.current) return;
    const diff = e.pageY - dragStartY.current;
    if (Math.abs(diff) > 3) {
      hasMovedDrag.current = true;
    }
    categoryListRef.current.scrollTop = dragScrollTop.current - diff;
    checkCategoryScroll();
  };

  const handleCategoryMouseUp = () => {
    isDraggingCategories.current = false;
  };

  // Formatação de cabeçalho de grupo de data estilo Pierre (ex: "Hoje", "Ontem", "Sexta-feira", "18 de set.")
  const formatGroupHeader = (dateStr: string): string => {
    const cleanStr = dateStr.substring(0, 10);
    const [y, m, dayNum] = cleanStr.split('-').map(Number);
    const d = new Date(y, m - 1, dayNum);
    const now = new Date();
    
    const txDateOnly = new Date(y, m - 1, dayNum);
    const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = todayOnly.getTime() - txDateOnly.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    
    if (diffDays > 1 && diffDays <= 6) {
      const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
      return weekday.charAt(0).toUpperCase() + weekday.slice(1);
    }
    
    const day = dayNum;
    const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    
    if (y === now.getFullYear()) {
      return `${day} de ${month}.`;
    }
    return `${day} de ${month}. de ${y}`;
  };

  // Lista filtrada de compras do cartão respeitando categoria selecionada no donut/legenda
  const filteredCardTransactions = useMemo(() => {
    if (!cardDetailData || cardDetailData.cardTxs.length === 0) return [];

    let txList = cardDetailData.cardTxs;

    if (selectedCatId) {
      if (selectedCatId === 'others') {
        const othersItem = cardCategoryBreakdown.find(c => c.categoryId === 'others') as any;
        const targetIds = new Set(othersItem?.aggregatedCatIds || ['others', 'cat-outros-desp']);
        txList = txList.filter(t => targetIds.has(t.categoryId) || !t.categoryId || t.categoryId === 'others' || t.categoryId === 'cat-outros-desp');
      } else if (selectedCatId === 'sem_categoria') {
        txList = txList.filter(t => !t.categoryId || t.categoryId === 'sem_categoria' || !categories.some(c => c.id === t.categoryId));
      } else {
        txList = txList.filter(t => t.categoryId === selectedCatId);
      }
    }

    return txList;
  }, [cardDetailData, selectedCatId, cardCategoryBreakdown, categories]);

  // Agrupamento cronológico das compras do cartão exibindo a data original da compra
  const groupedCardTransactions = useMemo(() => {
    if (filteredCardTransactions.length === 0) return [];

    // Data real da compra calculada uma única vez por transação (todas as parcelas de uma compra
    // compartilham a data da 1ª parcela)
    const originalDates = new Map<string, string>();
    filteredCardTransactions.forEach(tx => {
      originalDates.set(tx.id, getTransactionOriginalPurchaseDate(tx, transactions));
    });

    const sortedTxs = [...filteredCardTransactions].sort((a, b) => {
      const aOrig = originalDates.get(a.id)!;
      const bOrig = originalDates.get(b.id)!;
      return new Date(bOrig).getTime() - new Date(aOrig).getTime();
    });

    const groups: { [key: string]: { label: string; dateSub: string; txs: Transaction[] } } = {};
    
    sortedTxs.forEach(tx => {
      const origDateStr = originalDates.get(tx.id)!;
      const cleanStr = origDateStr.substring(0, 10);
      const [y, m, dayNum] = cleanStr.split('-').map(Number);
      const d = new Date(y, m - 1, dayNum);
      const dateKey = cleanStr;

      if (!groups[dateKey]) {
        const day = String(dayNum).padStart(2, '0');
        const monthNum = String(m).padStart(2, '0');
        const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
        groups[dateKey] = {
          label: formatGroupHeader(origDateStr),
          dateSub: `${day}/${monthNum} • ${weekday}`,
          txs: [],
        };
      }
      groups[dateKey].txs.push(tx);
    });

    return Object.entries(groups)
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([dateKey, group]) => ({
        dateKey,
        label: group.label,
        dateSub: group.dateSub,
        transactions: group.txs,
      }));
  }, [filteredCardTransactions, transactions]);



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
        onClick={e => {
          if (e.target === e.currentTarget) {
            handleBack();
          }
        }}
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
              {/* CARD HERO UNIFICADO DE FATURA E LIMITES (DESIGN PIERRE / FINTECH PREMIUM) */}
              <div
                className="card-sobra"
                style={{
                  padding: '22px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  background: 'linear-gradient(150deg, #131915 0%, #0d120f 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.13)',
                  borderRadius: '24px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Faixa Diagonal de Conta Conjunta no Canto Superior Direito */}
                {currentDetailCard.isShared && (
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

                {/* 1. Topo do Card: Identificação Limpa + Ciclo + Bandeira */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <BankLogo bankId={currentDetailCard.bankId} size={30} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentDetailCard.name}</span>
                        {currentDetailCard.lastDigits && (
                          <span style={{ color: '#64748B', fontFamily: 'monospace', fontSize: '0.80rem' }}>
                            •••• {currentDetailCard.lastDigits}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                        Fecha dia {currentDetailCard.closingDay || 1} • Vence dia {currentDetailCard.dueDay || 8}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginRight: currentDetailCard.isShared ? '24px' : '0px', transition: 'margin 0.2s' }}>
                    <CardBrandLogo brand={currentDetailCard.cardBrand || 'mastercard'} size={20} showText={false} />
                  </div>
                </div>

                {/* 2. Valor da Fatura + Tag de Status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div
                      style={{
                        fontSize: '1.85rem',
                        fontWeight: 800,
                        color: '#FFFFFF',
                        fontFamily: "'Outfit', 'Inter', sans-serif",
                        letterSpacing: '-0.02em',
                        lineHeight: 1,
                      }}
                    >
                      {maskValue(formatBrlCurrency(cardDetailData.invoiceAmount))}
                    </div>

                    <span
                      style={{
                        flexShrink: 0,
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        letterSpacing: '0.01em',
                        whiteSpace: 'nowrap',
                        backgroundColor:
                          cardDetailData.dateStatus.displayStatus === 'paid' || cardDetailData.dateStatus.displayStatus === 'zero'
                            ? 'rgba(74, 222, 128, 0.12)'
                            : cardDetailData.dateStatus.displayStatus === 'closed' || cardDetailData.dateStatus.displayStatus === 'open'
                            ? 'rgba(56, 189, 248, 0.12)'
                            : cardDetailData.dateStatus.statusBadgeVariant === 'warning'
                            ? 'rgba(251, 146, 60, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                        color:
                          cardDetailData.dateStatus.displayStatus === 'paid' || cardDetailData.dateStatus.displayStatus === 'zero'
                            ? '#4ADE80'
                            : cardDetailData.dateStatus.displayStatus === 'closed' || cardDetailData.dateStatus.displayStatus === 'open'
                            ? '#38BDF8'
                            : cardDetailData.dateStatus.statusBadgeVariant === 'warning'
                            ? '#FB923C'
                            : '#EF4444',
                        border: `1px solid ${
                          cardDetailData.dateStatus.displayStatus === 'paid' || cardDetailData.dateStatus.displayStatus === 'zero'
                            ? 'rgba(74, 222, 128, 0.25)'
                            : cardDetailData.dateStatus.displayStatus === 'closed' || cardDetailData.dateStatus.displayStatus === 'open'
                            ? 'rgba(56, 189, 248, 0.25)'
                            : cardDetailData.dateStatus.statusBadgeVariant === 'warning'
                            ? 'rgba(251, 146, 60, 0.3)'
                            : 'rgba(239, 68, 68, 0.3)'
                        }`,
                      }}
                    >
                      {cardDetailData.dateStatus.statusLabel}
                    </span>
                  </div>

                  {/* Cota compartilhada se houver */}
                  {currentDetailCard.isShared &&
                    currentDetailCard.splitMode !== 'full' &&
                    (currentDetailCard.splitRatio ?? 1) < 1 &&
                    currentDetailCard.splitMode !== 'none' && (
                      <div
                        style={{
                          fontSize: '0.80rem',
                          color: '#94A3B8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span>Sua parte:</span>
                        <strong style={{ color: '#38BDF8', fontWeight: 700, fontSize: '0.86rem' }}>
                          {maskValue(
                            formatBrlCurrency(
                              cardDetailData.invoiceAmount *
                                (currentDetailCard.splitMode === 'half'
                                  ? 0.5
                                  : (currentDetailCard.splitRatio ?? 1))
                            )
                          )}
                        </strong>
                        <span style={{ color: '#64748B', fontSize: '0.72rem' }}>
                          ({Math.round(
                            (currentDetailCard.splitMode === 'half'
                              ? 0.5
                              : (currentDetailCard.splitRatio ?? 1)) * 100
                          )}%)
                        </span>
                      </div>
                    )}
                </div>

                {/* 3. Barra de Limite */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontSize: '0.76rem', color: '#94A3B8', fontWeight: 500 }}>Disponível</span>
                      <strong style={{ fontSize: '0.90rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                        {maskValue(formatBrlCurrency(cardDetailData.available))}
                      </strong>
                    </div>

                    <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                      de {maskValue(formatBrlCurrency(cardDetailData.limit))}
                    </span>
                  </div>

                  <div
                    style={{
                      width: '100%',
                      height: '5px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${cardDetailData.usedPercent}%`,
                        height: '100%',
                        backgroundColor: currentDetailCard.color || '#4ADE80',
                        borderRadius: '9999px',
                        transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    />
                  </div>
                </div>

                {/* 4. Ação Pagar Fatura / Desfazer Pagamento - Linha Inteira */}
                {(() => {
                  const isDetailPaid = cardDetailData.dateStatus.displayStatus === 'paid';

                  if (isDetailPaid) {
                    return (
                      <div
                        style={{
                          paddingTop: '6px',
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setUndoPaymentTarget({ card: currentDetailCard, month: dueMonth, year: dueYear });
                          }}
                          style={{
                            width: '100%',
                            padding: '11px 18px',
                            borderRadius: '14px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#E2E8F0',
                            fontSize: '0.86rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.18s ease',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.30)';
                            e.currentTarget.style.color = '#FCA5A5';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                            e.currentTarget.style.color = '#E2E8F0';
                          }}
                          title="Desfazer o pagamento registrado para esta fatura"
                        >
                          <RotateCcw size={15} strokeWidth={2.2} />
                          <span>Desfazer pagamento</span>
                        </button>
                      </div>
                    );
                  }

                  if (onPayInvoice && cardDetailData.invoiceAmount > 0) {
                    return (
                      <div
                        style={{
                          paddingTop: '6px',
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onPayInvoice({
                              ...currentDetailCard,
                              invoiceAmount: cardDetailData.invoiceAmount,
                              balance: cardDetailData.invoiceAmount,
                              invoiceMonth: dueMonth,
                              invoiceYear: dueYear,
                            });
                          }}
                          style={{
                            width: '100%',
                            padding: '11px 18px',
                            borderRadius: '14px',
                            backgroundColor: 'rgba(34, 197, 94, 0.12)',
                            border: '1px solid rgba(34, 197, 94, 0.28)',
                            color: '#4ADE80',
                            fontSize: '0.86rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.18s ease',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.20)';
                            e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.45)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.12)';
                            e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.28)';
                          }}
                        >
                          <span>Pagar fatura</span>
                        </button>
                      </div>
                    );
                  }

                  return null;
                })()}
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
                  const dDue = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
                  const dueM = dDue.getMonth() + 1;
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
                      {MONTH_ABBR[dueM - 1]} {offset === 0 ? '(Atual)' : ''}
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

              {/* Se o mês não possui compras: exibe aviso direto e o botão de importação no lugar de Visão do Mês e Últimas Movimentações */}
              {cardDetailData.cardTxs.length === 0 ? (
                <div
                  className="card-sobra"
                  style={{
                    padding: '36px 20px',
                    borderRadius: '24px',
                    backgroundColor: '#131915',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    gap: '16px',
                  }}
                >
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '18px',
                      backgroundColor: 'rgba(192, 132, 252, 0.12)',
                      border: '1px solid rgba(192, 132, 252, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#C084FC',
                    }}
                  >
                    <UploadCloud size={26} />
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: '#FFFFFF',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      Nenhum dado nesta fatura ({MONTH_NAMES[dueMonth - 1]})
                    </div>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        color: '#94A3B8',
                        marginTop: '6px',
                        maxWidth: '290px',
                        lineHeight: 1.45,
                      }}
                    >
                      Não há nenhum gasto ou movimentação registrada para este mês.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    style={{
                      padding: '13px 22px',
                      borderRadius: '14px',
                      backgroundColor: '#C084FC',
                      color: '#0A0E0C',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '4px',
                      boxShadow: '0 4px 18px rgba(192, 132, 252, 0.35)',
                      transition: 'transform 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    <FileText size={17} />
                    <span>Importar Fatura (PDF / CSV)</span>
                  </button>
                </div>
              ) : (
                <>
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
                                  fill="none"
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
                                  onMouseEnter={() => {
                                    if (typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
                                      setHoveredCatId(cat.categoryId);
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    if (typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
                                      setHoveredCatId(null);
                                    }
                                  }}
                                  style={{
                                    cursor: 'pointer',
                                    pointerEvents: 'stroke',
                                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                                    filter: isSelected ? `drop-shadow(0 0 6px ${cat.color})` : 'none',
                                  }}
                                  aria-label={cat.categoryName}
                                  data-category={cat.categoryName}
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
                          width: '88px',
                          height: '88px',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          padding: '0 2px',
                          userSelect: 'none',
                        }}
                        title={activeCategory ? "Toque para voltar ao total da fatura" : "Toque em uma fatia para filtrar"}
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

                    {/* Lado Direito: Legenda das Categorias com scroll no padrão de app e indicador premium */}
                    <div
                      style={{
                        position: 'relative',
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        ref={categoryListRef}
                        onScroll={checkCategoryScroll}
                        onMouseDown={handleCategoryMouseDown}
                        onMouseMove={handleCategoryMouseMove}
                        onMouseUp={handleCategoryMouseUp}
                        className="app-category-scroll"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: cardCategoryBreakdown.length > 4 ? 'flex-start' : 'center',
                          gap: cardCategoryBreakdown.length > 4 ? '6px' : '8px',
                          width: '100%',
                          maxHeight: cardCategoryBreakdown.length > 4 ? '142px' : '134px',
                          overflowY: 'auto',
                          overscrollBehaviorY: 'auto',
                          WebkitOverflowScrolling: 'touch',
                          paddingRight: '5px',
                          paddingTop: '2px',
                          paddingBottom: cardCategoryBreakdown.length > 4 ? '16px' : '2px',
                          cursor: cardCategoryBreakdown.length > 4 ? (isDraggingCategories.current ? 'grabbing' : 'grab') : 'default',
                          maskImage: canScrollCategoriesDown && canScrollCategoriesUp
                            ? 'linear-gradient(to bottom, transparent 0%, black 14px, black calc(100% - 24px), transparent 100%)'
                            : canScrollCategoriesDown
                            ? 'linear-gradient(to bottom, black 0%, black calc(100% - 24px), transparent 100%)'
                            : canScrollCategoriesUp
                            ? 'linear-gradient(to bottom, transparent 0%, black 14px, black 100%)'
                            : 'none',
                          WebkitMaskImage: canScrollCategoriesDown && canScrollCategoriesUp
                            ? 'linear-gradient(to bottom, transparent 0%, black 14px, black calc(100% - 24px), transparent 100%)'
                            : canScrollCategoriesDown
                            ? 'linear-gradient(to bottom, black 0%, black calc(100% - 24px), transparent 100%)'
                            : canScrollCategoriesUp
                            ? 'linear-gradient(to bottom, transparent 0%, black 14px, black 100%)'
                            : 'none',
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
                                if (hasMovedDrag.current) return;
                                e.stopPropagation();
                                setSelectedCatId(prev => (prev === cat.categoryId ? null : cat.categoryId));
                                setHoveredCatId(null);
                              }}
                              onMouseEnter={() => {
                                if (typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
                                  setHoveredCatId(cat.categoryId);
                                }
                              }}
                              onMouseLeave={() => {
                                if (typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
                                  setHoveredCatId(null);
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                                cursor: 'pointer',
                                opacity: isOtherSelected ? 0.35 : 1,
                                transition: 'all 0.2s ease',
                                padding: '3px 6px',
                                borderRadius: '7px',
                                backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                flexShrink: 0,
                                userSelect: 'none',
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

                      {/* Micro-Affordance Flutuante: Pílula de Rolagem Premium */}
                      {(canScrollCategoriesDown || canScrollCategoriesUp) && cardCategoryBreakdown.length > 4 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!categoryListRef.current) return;
                            if (canScrollCategoriesDown) {
                              categoryListRef.current.scrollBy({ top: 68, behavior: 'smooth' });
                            } else {
                              categoryListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                          }}
                          style={{
                            position: 'absolute',
                            bottom: '-4px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 9px',
                            borderRadius: '9999px',
                            backgroundColor: '#161F18',
                            border: '1px solid rgba(255, 255, 255, 0.14)',
                            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.7)',
                            color: '#CBD5E1',
                            fontSize: '0.67rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            zIndex: 10,
                            letterSpacing: '-0.01em',
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                            userSelect: 'none',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = '#1F2C22';
                            e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.35)';
                            e.currentTarget.style.color = '#FFFFFF';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = '#161F18';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
                            e.currentTarget.style.color = '#CBD5E1';
                          }}
                        >
                          {canScrollCategoriesDown ? (
                            <>
                              <span style={{ color: '#94A3B8' }}>+{cardCategoryBreakdown.length - 4} mais</span>
                              <ChevronDown size={11} color="#22C55E" className="animate-subtle-bounce" />
                            </>
                          ) : (
                            <>
                              <ChevronUp size={11} color="#94A3B8" />
                              <span style={{ color: '#94A3B8' }}>início</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Banner de Aviso e Ação de Limpeza se houver lançamentos importados nesta fatura hoje */}
              {importedTxsCount > 0 && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.20)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.24)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FileText size={17} color="#F87171" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.92rem',
                          fontWeight: 700,
                          color: '#FFFFFF',
                          letterSpacing: '-0.01em',
                          lineHeight: 1.3,
                        }}
                      >
                        {importedTxsCount} {importedTxsCount === 1 ? 'compra importada nesta fatura' : 'compras importadas nesta fatura'}
                      </div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: '#94A3B8',
                          lineHeight: 1.45,
                        }}
                      >
                        Identificou valores incorretos? Limpe os dados desta importação para reimportar com o leitor corrigido.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearImport(true)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.28)',
                      color: '#F87171',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.22)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.40)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.28)';
                    }}
                  >
                    <Trash2 size={15} />
                    <span>Limpar importação desta fatura</span>
                  </button>
                </div>
              )}

              {/* 6. ÚLTIMAS MOVIMENTAÇÕES (COMPRAS DA FATURA COM SCROLL NO PADRÃO DE APP) */}
              <div
                className="card-sobra"
                style={{
                  padding: '16px 14px',
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}>
                  <h3
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      margin: 0,
                      letterSpacing: '-0.02em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Últimas movimentações
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                    type="button"
                    onClick={() => {
                      if (onAddNewExpense) {
                        onAddNewExpense(currentDetailCard.id);
                      } else {
                        setIsAddingExpense(true);
                      }
                    }}
                    title={`Adicionar despesa em ${currentDetailCard.name}`}
                    aria-label="Adicionar despesa"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(74, 222, 128, 0.12)',
                      border: '1px solid rgba(74, 222, 128, 0.28)',
                      color: '#4ADE80',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.22)';
                      e.currentTarget.style.transform = 'scale(1.06)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.12)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <Plus size={16} strokeWidth={2.4} />
                  </button>
                  </div>
                </div>

                {/* Badge de filtro por categoria selecionada no Donut/Legenda */}
                {selectedCatId && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      fontSize: '0.78rem',
                      color: '#FFFFFF',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: activeCategory?.color || '#4ADE80',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Filtrando por: <strong style={{ color: activeCategory?.color || '#4ADE80' }}>{activeCategory?.categoryName}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCatId(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94A3B8',
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        padding: '2px 8px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        flexShrink: 0,
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      Ver todas
                    </button>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {filteredCardTransactions.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '32px 16px',
                        color: '#94A3B8',
                        fontSize: '0.84rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span>Nenhuma compra encontrada para esta categoria na fatura.</span>
                      <button
                        type="button"
                        onClick={() => setSelectedCatId(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#4ADE80',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Limpar filtro de categoria
                      </button>
                    </div>
                  ) : (
                    groupedCardTransactions.map(group => (
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

                          const txDateObj = new Date(tx.date);
                          const isDummyTime = 
                            !tx.date.includes('T') ||
                            tx.date.includes('T12:00:00') || 
                            tx.date.includes('T00:00:00') || 
                            tx.date.includes('T03:00:00');

                          const hasSpecificTime = !isDummyTime && !isNaN(txDateObj.getTime());
                          const timeStr = hasSpecificTime
                            ? txDateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            : '';

                          const extracted = extractInstallmentFromDescription(tx.description);
                          const cleanTitle = extracted.cleanDescription || tx.description;
                          const installmentNumber = tx.installmentNumber || extracted.installmentNumber;
                          const installmentTotal = tx.installmentTotal || extracted.installmentTotal;

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
                                padding: '9px 4px',
                                borderRadius: '12px',
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
                              {/* Lado Esquerdo: Avatar Circular + Informações em 2 Linhas Limpas */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                {isRef ? (
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
                                    <IconRenderer name="RotateCcw" size={17} />
                                  </div>
                                ) : (
                                  <BrandLogo
                                    name={cleanTitle}
                                    category={cat}
                                    size={38}
                                    fallbackIcon={isExpense ? 'ShoppingBag' : 'TrendingUp'}
                                  />
                                )}

                                <div style={{ minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                  {/* Linha 1: Nome Limpo do Estabelecimento (Largura total, sem truncar nomes médios) */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                                    <span
                                      style={{
                                        fontSize: '0.92rem',
                                        fontWeight: 600,
                                        color: isRefd ? '#94A3B8' : '#FFFFFF',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        textDecoration: isRefd ? 'line-through' : 'none',
                                      }}
                                    >
                                      {cleanTitle}
                                    </span>

                                    {/* Badges de Estorno */}
                                    {isRefd && (
                                      <span
                                        style={{
                                          color: '#38BDF8',
                                          backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                          border: '1px solid rgba(56, 189, 248, 0.2)',
                                          padding: '1px 5px',
                                          borderRadius: '4px',
                                          fontSize: '0.66rem',
                                          fontWeight: 600,
                                          flexShrink: 0,
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
                                          border: '1px solid rgba(56, 189, 248, 0.2)',
                                          padding: '1px 5px',
                                          borderRadius: '4px',
                                          fontSize: '0.66rem',
                                          fontWeight: 600,
                                          flexShrink: 0,
                                        }}
                                      >
                                        Crédito
                                      </span>
                                    )}
                                    {Boolean(tx.isRecurring || tx.subscriptionId || tx.id?.startsWith('tx-sub-')) && (
                                      <span
                                        style={{
                                          color: '#C084FC',
                                          backgroundColor: 'rgba(168, 85, 247, 0.12)',
                                          border: '1px solid rgba(168, 85, 247, 0.25)',
                                          padding: '1px 5px',
                                          borderRadius: '4px',
                                          fontSize: '0.66rem',
                                          fontWeight: 600,
                                          flexShrink: 0,
                                        }}
                                      >
                                        Assinatura
                                      </span>
                                    )}
                                  </div>

                                  {/* Linha 2: Categoria única + Badge de Portador */}
                                  <div
                                    style={{
                                      fontSize: '0.75rem',
                                      color: '#8E8E93',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                    }}
                                  >
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {isRef ? 'Estorno no Cartão' : (cat?.name || 'Geral')}
                                    </span>
                                    {(() => {
                                      const digits = tx.cardLastDigits || (tx.description?.match(/(?:final|••••|\*+|\()?\s*(\d{4})\)?/i)?.[1]);
                                      const holderLabel = digits ? getCardHolderLabelForDigits(currentDetailCard, digits) : undefined;
                                      if (holderLabel && holderLabel !== 'Titular') {
                                        return (
                                          <span
                                            style={{
                                              fontSize: '0.65rem',
                                              backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                              color: '#38BDF8',
                                              border: '1px solid rgba(56, 189, 248, 0.25)',
                                              padding: '1px 5px',
                                              borderRadius: '4px',
                                              fontWeight: 600,
                                              flexShrink: 0,
                                            }}
                                          >
                                            {holderLabel}
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                </div>
                              </div>

                              {/* Lado Direito: Valor Proeminente + Informação de Parcela / Horário */}
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-end',
                                  justifyContent: 'center',
                                  gap: '2px',
                                  flexShrink: 0,
                                  marginLeft: '8px',
                                  textAlign: 'right',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '0.96rem',
                                    fontWeight: 700,
                                    color: isRef ? '#38BDF8' : isIncome ? '#4ADE80' : isRefd ? '#64748B' : '#FFFFFF',
                                    textDecoration: isRefd ? 'line-through' : 'none',
                                    whiteSpace: 'nowrap',
                                    lineHeight: 1.2,
                                  }}
                                >
                                  {isExpense ? '- ' : isIncome ? '+ ' : ''}
                                  {maskValue(formatBrlCurrency(tx.amount))}
                                </span>

                                {/* Parcela ou Horário discreto alinhado à direita */}
                                {installmentTotal && installmentTotal > 1 ? (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      fontSize: '0.67rem',
                                      fontWeight: 600,
                                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                      color: '#94A3B8',
                                      lineHeight: '1.2',
                                      border: '1px solid rgba(255, 255, 255, 0.05)',
                                    }}
                                  >
                                    {installmentNumber}/{installmentTotal}
                                  </span>
                                ) : (tx.isRecurring || tx.subscriptionId || tx.id?.startsWith('tx-sub-')) ? (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      fontSize: '0.67rem',
                                      fontWeight: 600,
                                      backgroundColor: 'rgba(168, 85, 247, 0.12)',
                                      color: '#C084FC',
                                      lineHeight: '1.2',
                                      border: '1px solid rgba(168, 85, 247, 0.25)',
                                    }}
                                  >
                                    Recorrente
                                  </span>
                                ) : timeStr ? (
                                  <span
                                    style={{
                                      fontSize: '0.70rem',
                                      color: '#64748B',
                                      fontWeight: 500,
                                      whiteSpace: 'nowrap',
                                      lineHeight: 1.2,
                                    }}
                                  >
                                    {timeStr}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                  </div>
                </div>
              </>
            )}

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
                      Total em faturas de {MONTH_NAMES[dueMonth - 1]}
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
                        {nextDueDateInfo.isAllPaid ? (
                          <>
                            Fatura quitada{' '}
                            <span style={{ color: '#4ADE80', fontWeight: 600 }}>• Vencimento em {nextDueDateInfo.text}</span>
                          </>
                        ) : (
                          <>
                            Próximo vencimento{' '}
                            <strong style={{ color: '#E2E8F0' }}>{nextDueDateInfo.text}</strong>{' '}
                            <span style={{ color: '#64748B' }}>({nextDueDateInfo.daysLeftText})</span>
                          </>
                        )}
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
                      const monthData = calculateInvoiceForMonth(cardItem.id, transactions, targetMonth, targetYear, subscriptions);
                      const invTotal = monthData.transactions.length > 0
                        ? monthData.totalAmount
                        : (isCurrentMonth && cardItem.invoiceAmount !== undefined 
                            ? cardItem.invoiceAmount 
                            : monthData.totalAmount);

                      const limit = cardItem.creditLimit || 5000;
                      const used = invTotal;
                      const available = Math.max(0, limit - used);
                      const usedPercent = Math.min(100, Math.round((used / limit) * 100));

                      const dateStatus = calculateCardDateStatus(
                        cardItem.closingDay,
                        cardItem.dueDay,
                        now,
                        invTotal,
                        cardItem.invoiceStatus,
                        cardItem.openAmount,
                        targetMonth,
                        targetYear
                      );

                      const isCardPaid = dateStatus.displayStatus === 'paid';
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
                          className="card-sobra"
                          style={{
                            background: 'linear-gradient(150deg, #131915 0%, #0d120f 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderTop: '1px solid rgba(255, 255, 255, 0.13)',
                            borderRadius: '24px',
                            padding: '20px',
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
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <BankLogo bankId={cardItem.bankId} size={30} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanCardName}</span>
                                  {cardItem.lastDigits && (
                                    <span style={{ color: '#64748B', fontFamily: 'monospace', fontSize: '0.80rem' }}>
                                      •••• {cardItem.lastDigits}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                                  Fecha dia {cardItem.closingDay || 1} • Vence dia {cardItem.dueDay || 8}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginRight: cardItem.isShared ? '24px' : '0px', transition: 'margin 0.2s' }}>
                              <CardBrandLogo brand={cardItem.cardBrand || 'mastercard'} size={20} showText={false} />
                              <ChevronRight size={18} color="#64748B" />
                            </div>
                          </div>

                          {/* Valor da Fatura + Tag de Status */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                              <div
                                style={{
                                  fontSize: '1.85rem',
                                  fontWeight: 800,
                                  color: '#FFFFFF',
                                  fontFamily: "'Outfit', 'Inter', sans-serif",
                                  letterSpacing: '-0.02em',
                                  lineHeight: 1,
                                }}
                              >
                                {maskValue(formatBrlCurrency(invTotal))}
                              </div>

                              <span
                                style={{
                                  flexShrink: 0,
                                  padding: '4px 10px',
                                  borderRadius: '9999px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  letterSpacing: '0.01em',
                                  whiteSpace: 'nowrap',
                                  backgroundColor:
                                    dateStatus.displayStatus === 'paid' || dateStatus.displayStatus === 'zero'
                                      ? 'rgba(74, 222, 128, 0.12)'
                                      : dateStatus.displayStatus === 'closed' || dateStatus.displayStatus === 'open'
                                      ? 'rgba(56, 189, 248, 0.12)'
                                      : dateStatus.statusBadgeVariant === 'warning'
                                      ? 'rgba(251, 146, 60, 0.15)'
                                      : 'rgba(239, 68, 68, 0.15)',
                                  color:
                                    dateStatus.displayStatus === 'paid' || dateStatus.displayStatus === 'zero'
                                      ? '#4ADE80'
                                      : dateStatus.displayStatus === 'closed' || dateStatus.displayStatus === 'open'
                                      ? '#38BDF8'
                                      : dateStatus.statusBadgeVariant === 'warning'
                                      ? '#FB923C'
                                      : '#EF4444',
                                  border: `1px solid ${
                                    dateStatus.displayStatus === 'paid' || dateStatus.displayStatus === 'zero'
                                      ? 'rgba(74, 222, 128, 0.25)'
                                      : dateStatus.displayStatus === 'closed' || dateStatus.displayStatus === 'open'
                                      ? 'rgba(56, 189, 248, 0.25)'
                                      : dateStatus.statusBadgeVariant === 'warning'
                                      ? 'rgba(251, 146, 60, 0.3)'
                                      : 'rgba(239, 68, 68, 0.3)'
                                  }`,
                                }}
                              >
                                {dateStatus.statusLabel}
                              </span>
                            </div>

                            {cardItem.isShared &&
                              cardItem.splitMode !== 'full' &&
                              (cardItem.splitRatio ?? 1) < 1 &&
                              cardItem.splitMode !== 'none' && (
                                <div
                                  style={{
                                    fontSize: '0.80rem',
                                    color: '#94A3B8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <span>Sua parte:</span>
                                  <strong style={{ color: '#38BDF8', fontWeight: 700, fontSize: '0.86rem' }}>
                                    {maskValue(
                                      formatBrlCurrency(
                                        invTotal *
                                          (cardItem.splitMode === 'half'
                                            ? 0.5
                                            : (cardItem.splitRatio ?? 1))
                                      )
                                    )}
                                  </strong>
                                  <span style={{ color: '#64748B', fontSize: '0.72rem' }}>
                                    ({Math.round(
                                      (cardItem.splitMode === 'half'
                                        ? 0.5
                                        : (cardItem.splitRatio ?? 1)) * 100
                                    )}%)
                                  </span>
                                </div>
                              )}
                          </div>

                          {/* Barra de Limite */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'baseline',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                <span style={{ fontSize: '0.76rem', color: '#94A3B8', fontWeight: 500 }}>Disponível</span>
                                <strong style={{ fontSize: '0.90rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                                  {maskValue(formatBrlCurrency(available))}
                                </strong>
                              </div>

                              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                                de {maskValue(formatBrlCurrency(limit))}
                              </span>
                            </div>

                            <div
                              style={{
                                width: '100%',
                                height: '5px',
                                borderRadius: '9999px',
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${usedPercent}%`,
                                  height: '100%',
                                  backgroundColor: cardAccentColor,
                                  borderRadius: '9999px',
                                  transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
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
                                background: 'transparent',
                                border: 'none',
                                padding: '4px 0',
                                cursor: 'pointer',
                                transition: 'color 0.15s ease',
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.color = '#FFFFFF';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.color = isExpanded ? '#FFFFFF' : '#94A3B8';
                              }}
                            >
                              <Receipt size={14} style={{ color: isExpanded ? '#38BDF8' : '#64748B' }} />
                              <span>
                                {monthData.transactions.length > 0
                                  ? `${monthData.transactions.length} ${monthData.transactions.length === 1 ? 'compra' : 'compras'}`
                                  : 'Compras'}
                              </span>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {onPayInvoice && invTotal > 0 && !isCardPaid && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  onPayInvoice({
                                    ...cardItem,
                                    invoiceAmount: invTotal,
                                    balance: invTotal,
                                    invoiceMonth: dueMonth,
                                    invoiceYear: dueYear,
                                  });
                                }}
                                style={{
                                  padding: '7px 16px',
                                  borderRadius: '9999px',
                                  backgroundColor: 'rgba(34, 197, 94, 0.12)',
                                  border: '1px solid rgba(34, 197, 94, 0.28)',
                                  color: '#4ADE80',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
                                  e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.45)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.12)';
                                  e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.28)';
                                }}
                              >
                                <span>Pagar fatura</span>
                              </button>
                            )}

                            {isCardPaid && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setUndoPaymentTarget({ card: cardItem, month: dueMonth, year: dueYear });
                                }}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: '9999px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  color: '#94A3B8',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.10)';
                                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                                  e.currentTarget.style.color = '#FCA5A5';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                                  e.currentTarget.style.color = '#94A3B8';
                                }}
                                title="Desfazer o pagamento desta fatura"
                              >
                                <RotateCcw size={12} strokeWidth={2.2} />
                                <span>Desfazer</span>
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

                  {/* Carrossel Horizontal de Seleção de Cartões (Pills) */}
                  <div
                    className="hide-scrollbar"
                    style={{
                      display: 'flex',
                      gap: '8px',
                      overflowX: 'auto',
                      padding: '4px 0 8px',
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
                      {allInstallmentGroups.length > 0 && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '1px 6px',
                            borderRadius: '9999px',
                            backgroundColor: selectedCardId === 'all' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
                            fontWeight: 700,
                          }}
                        >
                          {allInstallmentGroups.length}
                        </span>
                      )}
                    </button>

                    {creditCards.map(c => {
                      const isSelected = selectedCardId === c.id;
                      const countForCard = allInstallmentGroups.filter(g => g.accountId === c.id).length;
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
                            <Users size={12} style={{ opacity: 0.85, color: isSelected ? '#0284C7' : '#38BDF8', marginLeft: '2px' }} />
                          )}
                          {countForCard > 0 && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '1px 6px',
                                borderRadius: '9999px',
                                backgroundColor: isSelected ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
                                fontWeight: 700,
                              }}
                            >
                              {countForCard}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {displayedInstallmentGroups.length === 0 ? (
                    <div
                      style={{
                        padding: '36px 20px',
                        textAlign: 'center',
                        backgroundColor: '#131915',
                        borderRadius: '20px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <Layers size={32} color="#64748B" style={{ margin: '0 auto 6px' }} />
                      <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#FFFFFF' }}>
                        {selectedCardId !== 'all' 
                          ? 'Nenhuma compra parcelada neste cartão' 
                          : 'Nenhuma compra parcelada ativa'}
                      </p>
                      <span style={{ fontSize: '0.78rem', color: '#64748B', maxWidth: '320px', lineHeight: 1.4 }}>
                        {selectedCardId !== 'all'
                          ? 'Ao registrar compras neste cartão ou importar faturas, as parcelas serão projetadas aqui.'
                          : 'Ao registrar despesas no cartão, marque como parcelada para acompanhar a evolução aqui.'}
                      </span>
                      {selectedCardId !== 'all' && allInstallmentGroups.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedCardId('all')}
                          style={{
                            marginTop: '8px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '9999px',
                            padding: '6px 14px',
                            color: '#94A3B8',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Ver todos os cartões ({allInstallmentGroups.length})
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {displayedInstallmentGroups.map(group => {
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
                              gap: '12px',
                              position: 'relative',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '0.96rem', fontWeight: 700, color: '#FFFFFF', wordBreak: 'break-word' }}>
                                    {group.description}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {card && <BankLogo bankId={card.bankId} size={15} style={{ boxShadow: 'none', flexShrink: 0 }} />}
                                  <span>{card?.name || 'Cartão'} {card?.lastDigits ? `•••• ${card.lastDigits}` : ''}</span>
                                  {card?.isShared && (
                                    <span title="Cartão conjunto" style={{ display: 'inline-flex', alignItems: 'center' }}>
                                      <Users
                                        size={12}
                                        color="#38BDF8"
                                        style={{ opacity: 0.85, flexShrink: 0 }}
                                      />
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                                {group.isCompleted ? (
                                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#4ADE80', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle2 size={13} color="#4ADE80" />
                                    Quitado
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#FB7185' }}>
                                    {maskValue(formatBrlCurrency(group.monthlyAmount))} /mês
                                  </div>
                                )}
                                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                  Total: {maskValue(formatBrlCurrency(group.originalTotalAmount))}
                                </div>
                              </div>
                            </div>

                            {/* Barra de Progresso do Parcelamento com contador na extremidade direita */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  flex: 1,
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
                                    backgroundColor: progress >= 100 ? '#4ADE80' : (card?.isShared ? '#38BDF8' : '#4ADE80'),
                                    borderRadius: '9999px',
                                    transition: 'width 0.3s ease',
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  color: group.isCompleted ? '#4ADE80' : '#E2E8F0',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Parcela {group.paidInstallmentsCount} de {group.installmentTotal}
                              </span>
                            </div>

                            {/* Rodapé com detalhes de parcelas restantes */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '2px' }}>
                              <div style={{ fontSize: '0.74rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {group.remainingInstallmentsCount > 0 ? (
                                  <>
                                    <span>Restam <strong style={{ color: '#E2E8F0' }}>{group.remainingInstallmentsCount}x</strong></span>
                                    <span>•</span>
                                    <span>Pendente: <strong style={{ color: '#E2E8F0' }}>{maskValue(formatBrlCurrency(group.remainingAmount))}</strong></span>
                                    {group.nextBillingDate && (
                                      <>
                                        <span>•</span>
                                        <span>Próxima: <strong style={{ color: '#94A3B8' }}>{new Date(group.nextBillingDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</strong></span>
                                      </>
                                    )}
                                  </>
                                ) : (
                                  <span style={{ color: '#4ADE80', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    <CheckCircle2 size={13} color="#4ADE80" />
                                    Todas as parcelas pagas
                                  </span>
                                )}
                              </div>
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
                      const monthData = calculateInvoiceForMonth(c.id, transactions, currentMonth, currentYear, subscriptions);
                      const usedVal = monthData.transactions.length > 0 
                        ? monthData.totalAmount 
                        : (c.invoiceAmount !== undefined ? c.invoiceAmount : monthData.totalAmount);
                      return acc + usedVal;
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
                      const monthData = calculateInvoiceForMonth(c.id, transactions, currentMonth, currentYear, subscriptions);
                      const used = monthData.transactions.length > 0 
                        ? monthData.totalAmount 
                        : (c.invoiceAmount !== undefined ? c.invoiceAmount : monthData.totalAmount);
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

        {/* Modal de Confirmação para Limpar Lançamentos Importados */}
        {isConfirmingClearImport && currentDetailCard && (
          <ConfirmModal
            isOpen={isConfirmingClearImport}
            onClose={() => setIsConfirmingClearImport(false)}
            onConfirm={handleClearImported}
            title="Limpar Lançamentos Importados"
            description={`Deseja realmente remover os ${importedTxsCount} lançamentos importados desta fatura do cartão ${currentDetailCard.name}? Suas compras adicionadas manualmente serão preservadas, e você poderá reimportar a fatura com os dados perfeitamente reconhecidos.`}
            confirmText={isClearingImport ? "Limpando..." : "Sim, Limpar Lançamentos"}
            cancelText="Cancelar"
            variant="danger"
          />
        )}

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
        {isDeleteCardConfirmOpen && currentDetailCard && isDetailCardCreator && (
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

        {/* Modal de Confirmação de Exclusão de Compra Parcelada */}
        {groupToDelete && (
          <ConfirmModal
            isOpen={!!groupToDelete}
            onClose={() => setGroupToDelete(null)}
            onConfirm={async () => {
              await finance.deleteInstallmentGroup(groupToDelete.groupId);
              setGroupToDelete(null);
            }}
            title="Cancelar parcelamento"
            description="Todas as parcelas desta compra vinculadas a este cartão serão removidas permanentemente."
            confirmText="Cancelar parcelamento"
            cancelText="Voltar"
            variant="danger"
            itemDetails={{
              title: groupToDelete.description,
              subtitle: `Parcela ${groupToDelete.paidInstallmentsCount} de ${groupToDelete.installmentTotal}`,
              amount: formatBrlCurrency(groupToDelete.originalTotalAmount),
              amountLabel: 'Valor total',
              isAmountDestructive: true,
            }}
          />
        )}

        {/* Modal de Confirmação de Desfazer Pagamento de Fatura */}
        {undoPaymentTarget && (
          <ConfirmModal
            isOpen={!!undoPaymentTarget}
            onClose={() => !isUndoingPayment && setUndoPaymentTarget(null)}
            onConfirm={handleConfirmUndoPayment}
            title="Desfazer Pagamento de Fatura"
            description="Deseja realmente desfazer o pagamento desta fatura? O lançamento de saída será excluído do fluxo de caixa e o saldo da conta será recalculado."
            confirmText="Sim, Desfazer"
            cancelText="Voltar"
            variant="warning"
            isLoading={isUndoingPayment}
            itemDetails={{
              title: `Fatura ${undoPaymentTarget.card.name}`,
              subtitle: undoMatchingPayments.length > 0
                ? `${undoMatchingPayments.length === 1 ? '1 lançamento' : `${undoMatchingPayments.length} lançamentos`} no fluxo de caixa será${undoMatchingPayments.length === 1 ? '' : 'ão'} removido${undoMatchingPayments.length === 1 ? '' : 's'}`
                : 'A fatura será reaberta para conferência',
              bankId: undoPaymentTarget.card.bankId,
              amount: undoTotalPaymentAmount > 0 ? formatBrlCurrency(undoTotalPaymentAmount) : undefined,
              amountLabel: undoTotalPaymentAmount > 0 ? 'Valor estornado' : undefined,
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

        {/* Modal de Nova Despesa com Cartão Pré-selecionado Automaticamente */}
        {isAddingExpense && currentDetailCard && (
          <TransactionModal
            isOpen={isAddingExpense}
            onClose={() => setIsAddingExpense(false)}
            defaultType="expense"
            defaultAccountId={currentDetailCard.id}
            zIndex={3500}
          />
        )}

        {/* Modal de Importação com contexto da fatura selecionada */}
        {isImportModalOpen && currentDetailCard && (
          <CsvImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            initialAccountId={currentDetailCard.id}
            targetMonth={targetMonth}
            targetYear={targetYear}
          />
        )}

      </div>
    </>
  );
};
