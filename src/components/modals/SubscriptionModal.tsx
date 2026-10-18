import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { BankLogo } from '../common/BankLogo';
import { ConfirmModal } from '../common/ConfirmModal';
import { IconRenderer } from '../common/IconRenderer';
import { SubscriptionLogo } from '../subscriptions/SubscriptionLogo';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Subscription, SubscriptionCadence, SubscriptionStatus } from '../../core/types';
import { parseBrlCurrency, formatCurrencyInput, formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { extractCardLastDigits } from '../../core/cards/cardSelectionHelper';
import { sortCategoriesIntelligently } from '../../core/categorization/categoryOrdering';
import { 
  Users, 
  ChevronDown, 
  Check, 
  X, 
  CreditCard, 
  Landmark, 
  Wallet, 
  Calendar, 
  Tag, 
  Trash2, 
  Search, 
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const getAccountTypeLabel = (type?: string) => {
  switch (type) {
    case 'credit_card':
      return 'Cartão de crédito';
    case 'checking':
      return 'Conta corrente';
    case 'savings':
      return 'Poupança';
    case 'investment':
      return 'Investimentos';
    case 'cash':
      return 'Dinheiro / Carteira';
    default:
      return 'Conta bancária';
  }
};

const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTH_NAMES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Calcula a próxima data de cobrança a partir do dia do mês desejado.
 */
function computeNextBillingDateFromDay(day: number): string {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let targetMonth = currentMonth;
  let targetYear = currentYear;

  if (day < currentDay) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }

  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const safeDay = Math.min(Math.max(1, day), daysInTargetMonth);

  const mm = String(targetMonth + 1).padStart(2, '0');
  const dd = String(safeDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Subscription | null;
  initialIsShared?: boolean;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  initialData,
  initialIsShared,
}) => {
  const { 
    accounts, 
    categories, 
    transactions, 
    saveSubscription, 
    deleteSubscription, 
    suggestCategoryForMerchant, 
    isPartnershipActive 
  } = useFinance();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [cadence, setCadence] = useState<SubscriptionCadence>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState<number>(10);
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [isShared, setIsShared] = useState(false);
  const [suggestedTag, setSuggestedTag] = useState<string | null>(null);

  // Modais e Drawers secundários
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [isDueDatePickerOpen, setIsDueDatePickerOpen] = useState(false);
  const [dueDatePickerTab, setDueDatePickerTab] = useState<'day' | 'calendar'>('day');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Navegação do calendário
  const [calendarViewYear, setCalendarViewYear] = useState(() => new Date().getFullYear());
  const [calendarViewMonth, setCalendarViewMonth] = useState(() => new Date().getMonth());

  // Swipe / Drag to dismiss para os drawers (touch mobile + mouse desktop)
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetTouchStartY = useRef<number | null>(null);

  const handleSheetPointerDown = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // noop
    }
    sheetTouchStartY.current = e.clientY;
  };

  const handleSheetPointerMove = (e: React.PointerEvent) => {
    if (sheetTouchStartY.current === null) return;
    const deltaY = e.clientY - sheetTouchStartY.current;
    if (deltaY > 0) {
      setSheetDragY(deltaY);
    }
  };

  const handleSheetPointerUp = (e: React.PointerEvent, closeCallback: () => void) => {
    if (sheetTouchStartY.current === null) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // noop
    }
    if (sheetDragY > 60) {
      closeCallback();
    }
    setSheetDragY(0);
    sheetTouchStartY.current = null;
  };

  const prevIsOpenRef = useRef(false);
  const prevInitialDataIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const isTransitionToOpen = isOpen && !prevIsOpenRef.current;
    const isInitialDataChanged = initialData?.id !== prevInitialDataIdRef.current;
    prevIsOpenRef.current = isOpen;
    prevInitialDataIdRef.current = initialData?.id;

    if (!isOpen) return;
    if (!isTransitionToOpen && !isInitialDataChanged) return;

    if (initialData) {
      setName(initialData.name);
      setAmountStr(formatCurrencyInput(initialData.amount));
      setCategoryId(initialData.categoryId);
      setAccountId(initialData.accountId || '');
      setCadence(initialData.cadence);
      const rawDate = initialData.nextBillingDate ? initialData.nextBillingDate.substring(0, 10) : '';
      setNextBillingDate(rawDate);
      
      const parsedDay = initialData.dayOfMonth || (rawDate ? parseInt(rawDate.split('-')[2], 10) : 10);
      setDayOfMonth(parsedDay || 10);
      setStatus(initialData.status);

      const linkedAcc = accounts.find(a => a.id === initialData.accountId);
      if (linkedAcc) {
        setIsShared(Boolean(linkedAcc.isShared));
      } else {
        setIsShared(initialIsShared !== undefined ? initialIsShared : Boolean(initialData.isShared));
      }
      setSuggestedTag(null);
    } else {
      setName('');
      setAmountStr('');
      const defaultCat = categories.find(c => c.name.toLowerCase().includes('lazer')) || 
                         categories.find(c => c.name.toLowerCase().includes('streaming')) ||
                         categories.find(c => c.type === 'expense') || 
                         categories[0];
      setCategoryId(defaultCat?.id || '');

      const sharedCard = accounts.find(a => a.isShared);
      const chosenAcc = (initialIsShared && sharedCard) ? sharedCard : (accounts[0] || null);
      setAccountId(chosenAcc?.id || '');
      setCadence('monthly');

      // Vencimento padrão: dia atual
      const now = new Date();
      const currentDay = now.getDate();
      setDayOfMonth(currentDay);
      setNextBillingDate(computeNextBillingDateFromDay(currentDay));
      setStatus('active');
      setIsShared(initialIsShared !== undefined ? initialIsShared : Boolean(chosenAcc?.isShared));
      setSuggestedTag(null);
    }

    setIsAccountDrawerOpen(false);
    setIsCategoryDrawerOpen(false);
    setIsDueDatePickerOpen(false);
    setDueDatePickerTab('day');
    setIsDeleteConfirmOpen(false);
    setCategorySearchQuery('');
    setSheetDragY(0);
  }, [initialData, isOpen, accounts, categories, initialIsShared]);

  // Sincronizar o mês do calendário com a data atual selecionada
  useEffect(() => {
    if (nextBillingDate) {
      const [y, m] = nextBillingDate.split('-').map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        setCalendarViewYear(y);
        setCalendarViewMonth(m - 1);
      }
    }
  }, [nextBillingDate, isDueDatePickerOpen]);

  // Sugestão de categoria ao digitar o nome
  const handleNameChange = (val: string) => {
    setName(val);
    if (!initialData && val.trim().length >= 3) {
      const suggested = suggestCategoryForMerchant(val);
      if (suggested && suggested.type === 'expense') {
        setCategoryId(suggested.id);
        setSuggestedTag(suggested.name);
      } else {
        setSuggestedTag(null);
      }
    } else {
      setSuggestedTag(null);
    }
  };

  // Alteração do dia do vencimento (1 a 31)
  const handleDaySelect = (day: number) => {
    const clampedDay = Math.min(31, Math.max(1, day));
    setDayOfMonth(clampedDay);
    if (cadence === 'monthly') {
      const computedDate = computeNextBillingDateFromDay(clampedDay);
      setNextBillingDate(computedDate);
    } else if (nextBillingDate) {
      const [y, m] = nextBillingDate.split('-');
      const daysInMo = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
      const safeD = Math.min(clampedDay, daysInMo);
      setNextBillingDate(`${y}-${m}-${String(safeD).padStart(2, '0')}`);
    }
    setIsDueDatePickerOpen(false);
  };

  // Seleção de data pontual via calendário
  const handleSelectDateFromCalendar = (dateStr: string) => {
    setNextBillingDate(dateStr);
    const day = parseInt(dateStr.split('-')[2], 10);
    if (!isNaN(day)) {
      setDayOfMonth(day);
    }
    setIsDueDatePickerOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseBrlCurrency(amountStr);
    if (!numericAmount || numericAmount <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }
    if (!name.trim()) {
      alert('Informe o nome da assinatura.');
      return;
    }
    if (!categoryId) {
      alert('Selecione uma categoria.');
      return;
    }
    if (!nextBillingDate) {
      alert('Informe a data da próxima cobrança.');
      return;
    }

    const linkedAcc = accounts.find(a => a.id === accountId);
    const effectiveIsShared = linkedAcc
      ? Boolean(linkedAcc.isShared)
      : (isPartnershipActive ? isShared : false);

    await saveSubscription({
      id: initialData?.id,
      name: name.trim(),
      amount: numericAmount,
      categoryId,
      accountId: accountId || undefined,
      cadence,
      nextBillingDate,
      dayOfMonth: dayOfMonth || (nextBillingDate ? parseInt(nextBillingDate.split('-')[2], 10) : undefined),
      status,
      previousAmount: initialData?.previousAmount,
      lastChargeDate: initialData?.lastChargeDate,
      isShared: effectiveIsShared,
      ownerId: effectiveIsShared ? (initialData?.ownerId || user?.id || 'current-user') : undefined,
      ownerName: effectiveIsShared ? (initialData?.ownerName || user?.displayName || 'Você') : undefined,
    });

    setIsAccountDrawerOpen(false);
    setIsCategoryDrawerOpen(false);
    setIsDueDatePickerOpen(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    await deleteSubscription(initialData.id);
    setIsDeleteConfirmOpen(false);
    onClose();
  };

  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === accountId),
    [accounts, accountId]
  );

  const selectedCategory = useMemo(
    () => categories.find(c => c.id === categoryId),
    [categories, categoryId]
  );

  const creditCardAccounts = useMemo(
    () => accounts.filter(a => a.type === 'credit_card'),
    [accounts]
  );

  const otherAccounts = useMemo(
    () => accounts.filter(a => a.type !== 'credit_card'),
    [accounts]
  );

  const expenseCategories = useMemo(
    () => sortCategoriesIntelligently(categories.filter(c => c.type === 'expense'), transactions),
    [categories, transactions]
  );

  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return expenseCategories;
    const q = categorySearchQuery.toLowerCase();
    return expenseCategories.filter(c => c.name.toLowerCase().includes(q));
  }, [expenseCategories, categorySearchQuery]);

  // Informações formatadas da data de cobrança
  const billingDateFormatted = useMemo(() => {
    if (!nextBillingDate) return { label: 'Não definida', full: '', short: '' };
    const [y, m, d] = nextBillingDate.split('-').map(Number);
    const monthName = MONTH_NAMES_FULL[m - 1] || '';
    const monthShort = MONTH_NAMES_SHORT[m - 1] || '';
    return {
      label: `${String(d).padStart(2, '0')} de ${monthName}`,
      full: `${String(d).padStart(2, '0')} de ${monthName} de ${y}`,
      short: `${String(d).padStart(2, '0')} ${monthShort}`,
    };
  }, [nextBillingDate]);

  // Geração da grade de dias para o calendário
  const calendarCells = useMemo(() => {
    const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(calendarViewYear, calendarViewMonth, 1).getDay();
    const prevMonthDays = new Date(calendarViewYear, calendarViewMonth, 0).getDate();

    const cells: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      dateStr: string;
      isSelected: boolean;
      isToday: boolean;
    }> = [];

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = calendarViewMonth === 0 ? 11 : calendarViewMonth - 1;
      const y = calendarViewMonth === 0 ? calendarViewYear - 1 : calendarViewYear;
      const cellDateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        dateStr: cellDateStr,
        isSelected: cellDateStr === nextBillingDate,
        isToday: cellDateStr === todayStr,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cellDateStr = `${calendarViewYear}-${String(calendarViewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        month: calendarViewMonth,
        year: calendarViewYear,
        isCurrentMonth: true,
        dateStr: cellDateStr,
        isSelected: cellDateStr === nextBillingDate,
        isToday: cellDateStr === todayStr,
      });
    }

    const remainingCells = 7 - (cells.length % 7);
    if (remainingCells < 7) {
      for (let d = 1; d <= remainingCells; d++) {
        const m = calendarViewMonth === 11 ? 0 : calendarViewMonth + 1;
        const y = calendarViewMonth === 11 ? calendarViewYear + 1 : calendarViewYear;
        const cellDateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({
          day: d,
          month: m,
          year: y,
          isCurrentMonth: false,
          dateStr: cellDateStr,
          isSelected: cellDateStr === nextBillingDate,
          isToday: cellDateStr === todayStr,
        });
      }
    }

    return cells;
  }, [calendarViewYear, calendarViewMonth, nextBillingDate]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={initialData ? 'Editar Assinatura' : 'Nova Assinatura'}
        maxWidth="440px"
        zIndex={9999}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* CARD 1: IDENTIFICAÇÃO + VALOR + FREQUÊNCIA (Clean & Minimalista) */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '16px',
              backgroundColor: '#151916',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Topo: Logo Oficial + Nome da Assinatura */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flexShrink: 0 }}>
                <SubscriptionLogo
                  name={name}
                  category={selectedCategory}
                  bankId={selectedAccount?.bankId || selectedAccount?.name}
                  size={42}
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  type="text"
                  required
                  autoFocus={!initialData}
                  placeholder="Ex: Netflix, Meli+, Spotify"
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#FFFFFF',
                    fontSize: '1.12rem',
                    fontWeight: 700,
                    padding: 0,
                    boxSizing: 'border-box',
                  }}
                />
                {suggestedTag && (
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={11} color="#94A3B8" /> {suggestedTag}
                  </div>
                )}
              </div>
            </div>

            {/* Linha Divisória Fina */}
            <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.06)' }} />

            {/* Base: Valor em Destaque + Frequência (Mensal / Anual) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              {/* Valor */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 500, color: '#94A3B8' }}>
                  R$
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="0,00"
                  value={amountStr}
                  onChange={e => setAmountStr(formatCurrencyInput(e.target.value, amountStr))}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#FFFFFF',
                    fontSize: '1.7rem',
                    fontWeight: 700,
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                    letterSpacing: '-0.02em',
                    padding: 0,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Segmented Control de Frequência Neutro */}
              <div
                style={{
                  display: 'flex',
                  padding: '3px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setCadence('monthly')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '7px',
                    border: 'none',
                    backgroundColor: cadence === 'monthly' ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
                    color: cadence === 'monthly' ? '#FFFFFF' : '#94A3B8',
                    fontSize: '0.78rem',
                    fontWeight: cadence === 'monthly' ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setCadence('yearly')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '7px',
                    border: 'none',
                    backgroundColor: cadence === 'yearly' ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
                    color: cadence === 'yearly' ? '#FFFFFF' : '#94A3B8',
                    fontSize: '0.78rem',
                    fontWeight: cadence === 'yearly' ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Anual
                </button>
              </div>
            </div>
          </div>

          {/* CARD 2: CONFIGURAÇÕES AGRUPADAS (Clean, sem cores neon) */}
          <div
            style={{
              borderRadius: '16px',
              backgroundColor: '#151916',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            {/* Linha 1: Categoria */}
            <button
              type="button"
              onClick={() => setIsCategoryDrawerOpen(true)}
              style={{
                width: '100%',
                padding: '11px 14px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                textAlign: 'left',
                boxSizing: 'border-box',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '9px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94A3B8',
                    flexShrink: 0,
                  }}
                >
                  <IconRenderer name={selectedCategory?.icon || 'Tag'} size={16} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.70rem', color: '#94A3B8', fontWeight: 500 }}>
                    Categoria
                  </div>
                  <div style={{ fontSize: '0.90rem', fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedCategory?.name || 'Selecione uma categoria'}
                  </div>
                </div>
              </div>
              <ChevronDown size={16} color="#64748B" style={{ flexShrink: 0, marginLeft: '8px' }} />
            </button>

            {/* Linha 2: Cobrado em (Conta / Cartão) com Ícone Minimalista */}
            <button
              type="button"
              onClick={() => setIsAccountDrawerOpen(true)}
              style={{
                width: '100%',
                padding: '11px 14px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                textAlign: 'left',
                boxSizing: 'border-box',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                {selectedAccount ? (
                  <>
                    <div style={{ flexShrink: 0 }}>
                      <BankLogo bankId={selectedAccount.bankId || selectedAccount.name} size={32} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.70rem', color: '#94A3B8', fontWeight: 500 }}>
                        Cobrado em
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.90rem', fontWeight: 600, color: '#FFFFFF' }}>
                          {selectedAccount.name}
                        </span>
                        {extractCardLastDigits(selectedAccount) && !selectedAccount.name.includes(extractCardLastDigits(selectedAccount)) && (
                          <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '0.80rem', fontWeight: 500 }}>
                            • {extractCardLastDigits(selectedAccount)}
                          </span>
                        )}
                        {/* Indicação minimalista com ícone suave */}
                        {selectedAccount.isShared && (
                          <span 
                            title="Conta Conjunta"
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              color: '#94A3B8',
                              marginLeft: '2px'
                            }}
                          >
                            <Users size={14} strokeWidth={2} />
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '9px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94A3B8',
                        flexShrink: 0,
                      }}
                    >
                      <Wallet size={16} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.70rem', color: '#94A3B8', fontWeight: 500 }}>
                        Cobrado em
                      </div>
                      <div style={{ fontSize: '0.90rem', fontWeight: 600, color: '#FFFFFF' }}>
                        Não especificado
                      </div>
                    </div>
                  </>
                )}
              </div>
              <ChevronDown size={16} color="#64748B" style={{ flexShrink: 0, marginLeft: '8px' }} />
            </button>

            {/* Linha 3: Vencimento (Clean, sem neon e sem corte de texto) */}
            <button
              type="button"
              onClick={() => setIsDueDatePickerOpen(true)}
              style={{
                width: '100%',
                padding: '11px 14px',
                backgroundColor: 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                textAlign: 'left',
                boxSizing: 'border-box',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '9px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94A3B8',
                    flexShrink: 0,
                  }}
                >
                  <Calendar size={16} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.70rem', color: '#94A3B8', fontWeight: 500 }}>
                    Vencimento
                  </div>
                  <div style={{ fontSize: '0.90rem', fontWeight: 600, color: '#FFFFFF' }}>
                    {cadence === 'monthly' ? `Todo dia ${dayOfMonth}` : `Anual • ${billingDateFormatted.label}`}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '10px' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#94A3B8',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontWeight: 500,
                  }}
                >
                  {cadence === 'monthly' ? `Próx: ${billingDateFormatted.short}` : billingDateFormatted.short}
                </span>
                <ChevronDown size={16} color="#64748B" />
              </div>
            </button>

            {/* Linha 4 (se edição): Status da Assinatura Integrado (Sem neon) */}
            {initialData && (
              <div
                style={{
                  padding: '11px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ fontSize: '0.86rem', fontWeight: 500, color: '#94A3B8' }}>
                  Status
                </div>

                <div
                  style={{
                    display: 'flex',
                    padding: '2px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setStatus('active')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: status === 'active' ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
                      color: status === 'active' ? '#FFFFFF' : '#64748B',
                      fontSize: '0.78rem',
                      fontWeight: status === 'active' ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Ativa
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('cancelled')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: status === 'cancelled' ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
                      color: status === 'cancelled' ? '#FFFFFF' : '#64748B',
                      fontSize: '0.78rem',
                      fontWeight: status === 'cancelled' ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Pausada
                  </button>
                </div>
              </div>
            )}
          </div>


          {/* RODAPÉ DE AÇÕES ULTRA-CLEAN (Padrão Pierre / Apple: Botão Branco Sólido + Link Discreto) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', paddingTop: '10px' }}>
            {/* Botão Principal de Ação Full Width */}
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: '#FFFFFF',
                color: '#0A0E0C',
                fontSize: '0.92rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '0.92';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              {initialData ? 'Salvar Alterações' : 'Adicionar Assinatura'}
            </button>

            {/* Ação Destrutiva Sutil e Centralizada (somente ao editar) */}
            {initialData && (
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '8px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#64748B',
                  fontSize: '0.80rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#F87171';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = '#64748B';
                }}
              >
                <Trash2 size={13} />
                <span>Excluir assinatura</span>
              </button>
            )}
          </div>
        </form>
      </Modal>

      {/* DRAWER 1: SELETOR DE CONTA / CARTÃO */}
      {isAccountDrawerOpen && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 10050,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
          onClick={() => {
            setIsAccountDrawerOpen(false);
            setSheetDragY(0);
          }}
        >
          <style>{`
            @keyframes subModalDrawerSlideUp {
              from { transform: translateY(100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '480px',
              maxHeight: '82vh',
              backgroundColor: '#0F1511',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderBottom: 'none',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              overflow: 'hidden',
              transform: sheetDragY > 0 ? `translateY(${sheetDragY}px)` : 'none',
              transition: sheetDragY > 0 ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              animation: sheetDragY === 0 ? 'subModalDrawerSlideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
            }}
          >
            {/* Pull Handle & Header (Drag to dismiss) */}
            <div
              onPointerDown={handleSheetPointerDown}
              onPointerMove={handleSheetPointerMove}
              onPointerUp={e => handleSheetPointerUp(e, () => setIsAccountDrawerOpen(false))}
              onPointerCancel={e => handleSheetPointerUp(e, () => setIsAccountDrawerOpen(false))}
              style={{ cursor: 'grab', touchAction: 'none', userSelect: 'none' }}
            >
              <div
                style={{
                  width: '38px',
                  height: '4px',
                  borderRadius: '2px',
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  margin: '12px auto 6px auto',
                }}
              />
              <div
                style={{
                  padding: '10px 20px 14px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ fontSize: '1.02rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Cobrado em qual conta?
                </div>
                <div style={{ fontSize: '0.70rem', color: '#94A3B8', marginTop: '2px', lineHeight: 1.3 }}>
                  Cartão ou conta de débito da assinatura
                </div>
              </div>
            </div>

            {/* Lista de Contas */}
            <div
              style={{
                padding: '16px 20px calc(24px + max(var(--safe-area-bottom, 0px), env(safe-area-inset-bottom, 0px)))',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Opção: Não especificado */}
              <button
                type="button"
                onClick={() => {
                  setAccountId('');
                  setIsShared(false);
                  setIsAccountDrawerOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  border: !accountId ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                  backgroundColor: !accountId ? 'rgba(255, 255, 255, 0.08)' : '#161F18',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94A3B8',
                    }}
                  >
                    <Wallet size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.94rem', fontWeight: 600, color: '#FFFFFF' }}>
                      Não especificado
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                      Não vincular a nenhuma conta ou cartão
                    </div>
                  </div>
                </div>
                {!accountId && (
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={14} color="#0A0E0C" strokeWidth={3} />
                  </div>
                )}
              </button>

              {/* Cartões de Crédito */}
              {creditCardAccounts.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: '#94A3B8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <CreditCard size={14} /> Cartões de Crédito
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {creditCardAccounts.map(acc => {
                      const isSelected = acc.id === accountId;
                      const cardDigits = extractCardLastDigits(acc);
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            setAccountId(acc.id);
                            setIsShared(Boolean(acc.isShared));
                            setIsAccountDrawerOpen(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: '14px',
                            border: isSelected ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                            backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : '#161F18',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                            <div style={{ flexShrink: 0 }}>
                              <BankLogo bankId={acc.bankId || acc.name} size={36} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: '0.94rem', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {acc.name}
                                </span>
                                {cardDigits && !acc.name.includes(cardDigits) && (
                                  <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '0.84rem', fontWeight: 500 }}>
                                    • {cardDigits}
                                  </span>
                                )}
                                {acc.isShared && (
                                  <span title="Conta Conjunta" style={{ display: 'inline-flex', alignItems: 'center', color: '#94A3B8' }}>
                                    <Users size={14} strokeWidth={2} />
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                                Cartão de crédito
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <div
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Check size={14} color="#0A0E0C" strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Contas Bancárias & Carteiras */}
              {otherAccounts.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: '#94A3B8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Landmark size={14} /> Contas & Carteiras
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {otherAccounts.map(acc => {
                      const isSelected = acc.id === accountId;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            setAccountId(acc.id);
                            setIsShared(Boolean(acc.isShared));
                            setIsAccountDrawerOpen(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: '14px',
                            border: isSelected ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                            backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : '#161F18',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                            <div style={{ flexShrink: 0 }}>
                              <BankLogo bankId={acc.bankId || acc.name} size={36} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: '0.94rem', fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {acc.name}
                                </span>
                                {acc.isShared && (
                                  <span title="Conta Conjunta" style={{ display: 'inline-flex', alignItems: 'center', color: '#94A3B8' }}>
                                    <Users size={14} strokeWidth={2} />
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                                {getAccountTypeLabel(acc.type)}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <div
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Check size={14} color="#0A0E0C" strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* DRAWER 2: SELETOR DE CATEGORIA */}
      {isCategoryDrawerOpen && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 10050,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
          onClick={() => {
            setIsCategoryDrawerOpen(false);
            setSheetDragY(0);
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '480px',
              maxHeight: '82vh',
              backgroundColor: '#0F1511',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderBottom: 'none',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              overflow: 'hidden',
              transform: sheetDragY > 0 ? `translateY(${sheetDragY}px)` : 'none',
              transition: sheetDragY > 0 ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              animation: sheetDragY === 0 ? 'subModalDrawerSlideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
            }}
          >
            {/* Pull Handle & Header (Drag to dismiss) */}
            <div
              onPointerDown={handleSheetPointerDown}
              onPointerMove={handleSheetPointerMove}
              onPointerUp={e => handleSheetPointerUp(e, () => setIsCategoryDrawerOpen(false))}
              onPointerCancel={e => handleSheetPointerUp(e, () => setIsCategoryDrawerOpen(false))}
              style={{ cursor: 'grab', touchAction: 'none', userSelect: 'none' }}
            >
              <div
                style={{
                  width: '38px',
                  height: '4px',
                  borderRadius: '2px',
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  margin: '12px auto 6px auto',
                }}
              />
              <div
                style={{
                  padding: '10px 20px 14px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ fontSize: '1.02rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Selecione a Categoria
                </div>
                <div style={{ fontSize: '0.70rem', color: '#94A3B8', marginTop: '2px', lineHeight: 1.3 }}>
                  Classifique o gasto por área
                </div>
              </div>
            </div>

            {/* Campo de Busca Rápida */}
            <div style={{ padding: '12px 20px 8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  backgroundColor: '#161F18',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Search size={16} color="#94A3B8" />
                <input
                  type="text"
                  placeholder="Buscar categoria..."
                  value={categorySearchQuery}
                  onChange={e => setCategorySearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#FFFFFF',
                    fontSize: '0.88rem',
                  }}
                />
                {categorySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCategorySearchQuery('')}
                    style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Lista de Categorias */}
            <div
              style={{
                padding: '8px 20px calc(24px + max(var(--safe-area-bottom, 0px), env(safe-area-inset-bottom, 0px)))',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {filteredCategories.map(cat => {
                const isSelected = cat.id === categoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategoryId(cat.id);
                      setIsCategoryDrawerOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '12px',
                      border: isSelected ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                      backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : '#161F18',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#94A3B8',
                        }}
                      >
                        <IconRenderer name={cat.icon || 'Tag'} size={16} />
                      </div>
                      <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#FFFFFF' }}>
                        {cat.name}
                      </span>
                    </div>

                    {isSelected && (
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={13} color="#0A0E0C" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* DRAWER 3: SELETOR DE VENCIMENTO INTUITIVO (Grid de Dias 1-31 + Calendário) */}
      {isDueDatePickerOpen && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 10060,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
          onClick={() => setIsDueDatePickerOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '360px',
              backgroundColor: '#151916',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '16px 18px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Topo do Seletor com Tabs Rápidas */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#FFFFFF' }}>
                Dia do Vencimento
              </div>

              {/* Tabs: Dia Habitual vs Calendário */}
              <div
                style={{
                  display: 'flex',
                  padding: '2px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setDueDatePickerTab('day')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: dueDatePickerTab === 'day' ? '#FFFFFF' : 'transparent',
                    color: dueDatePickerTab === 'day' ? '#0A0E0C' : '#94A3B8',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Dia do Mês
                </button>
                <button
                  type="button"
                  onClick={() => setDueDatePickerTab('calendar')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: dueDatePickerTab === 'calendar' ? '#FFFFFF' : 'transparent',
                    color: dueDatePickerTab === 'calendar' ? '#0A0E0C' : '#94A3B8',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Calendário
                </button>
              </div>
            </div>

            {/* TAB 1: SELEÇÃO RÁPIDA DE DIA (1 a 31) COM 1 TOQUE */}
            {dueDatePickerTab === 'day' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.70rem', color: '#94A3B8' }}>
                  Dia do mês em que a assinatura é debitada
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '6px',
                  }}
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
                    const isSelected = d === dayOfMonth;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleDaySelect(d)}
                        style={{
                          aspectRatio: '1',
                          borderRadius: '9px',
                          border: isSelected ? '1px solid #FFFFFF' : '1px solid rgba(255, 255, 255, 0.05)',
                          backgroundColor: isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.03)',
                          color: isSelected ? '#0A0E0C' : '#FFFFFF',
                          fontSize: '0.82rem',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.1s ease',
                        }}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* TAB 2: CALENDÁRIO COM NAVEGAÇÃO DE MÊS */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (calendarViewMonth === 0) {
                        setCalendarViewYear(y => y - 1);
                        setCalendarViewMonth(11);
                      } else {
                        setCalendarViewMonth(m => m - 1);
                      }
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: 'none',
                      borderRadius: '8px',
                      width: '30px',
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94A3B8',
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div style={{ fontSize: '0.90rem', fontWeight: 700, color: '#FFFFFF' }}>
                    {MONTH_NAMES_FULL[calendarViewMonth]} {calendarViewYear}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (calendarViewMonth === 11) {
                        setCalendarViewYear(y => y + 1);
                        setCalendarViewMonth(0);
                      } else {
                        setCalendarViewMonth(m => m + 1);
                      }
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: 'none',
                      borderRadius: '8px',
                      width: '30px',
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94A3B8',
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Dias da semana */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                    <div key={d} style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94A3B8', padding: '2px 0' }}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Grade de dias */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                  {calendarCells.map((cell, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectDateFromCalendar(cell.dateStr)}
                      style={{
                        aspectRatio: '1',
                        borderRadius: '8px',
                        border: cell.isToday ? '1px solid rgba(255, 255, 255, 0.4)' : 'none',
                        backgroundColor: cell.isSelected ? '#FFFFFF' : 'transparent',
                        color: cell.isSelected ? '#0A0E0C' : cell.isCurrentMonth ? '#FFFFFF' : '#64748B',
                        fontSize: '0.80rem',
                        fontWeight: cell.isSelected || cell.isToday ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {cell.day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <Button type="button" variant="secondary" onClick={() => setIsDueDatePickerOpen(false)} style={{ padding: '6px 14px', fontSize: '0.80rem' }}>
                Fechar
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 4: CONFIRMAÇÃO DE EXCLUSÃO */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Excluir Assinatura"
        description={`Tem certeza que deseja remover "${name}"? Ela não aparecerá mais nos próximos meses.`}
        confirmText="Excluir Assinatura"
        cancelText="Voltar"
        variant="danger"
        itemDetails={{
          title: name || 'Assinatura',
          amount: formatBrlCurrency(parseBrlCurrency(amountStr) || initialData?.amount || 0),
          subtitle: selectedAccount?.name || 'Assinatura recorrente',
          bankId: selectedAccount?.bankId || selectedAccount?.name,
          icon: <SubscriptionLogo name={name} category={selectedCategory} size={32} />,
        }}
      />
    </>
  );
};
