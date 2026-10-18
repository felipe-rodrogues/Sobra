import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../common/Modal';
import { BankLogo } from '../common/BankLogo';
import { CardBrandLogo } from '../common/MastercardLogo';
import { SubscriptionLogo } from '../subscriptions/SubscriptionLogo';
import { SharedBadge } from '../common/SharedBadge';
import { useFinance } from '../../context/FinanceContext';
import { Subscription, Account, PaymentMethod } from '../../core/types';
import { formatBrlCurrency, parseBrlCurrency, formatCurrencyInput } from '../../core/parsers/currencyHelper';
import { 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Wallet, 
  ChevronDown, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Sparkles,
  CreditCard,
  Ban,
  Clock,
  ArrowRight
} from 'lucide-react';

// Retorna a data local do dispositivo no formato YYYY-MM-DD
function getTodayLocalDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Retorna a data local de ontem no formato YYYY-MM-DD
function getYesterdayLocalDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

interface PaySubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: Subscription | null;
  targetMonthIndex?: number; // 0-11
  targetYear?: number;
}

export const PaySubscriptionModal: React.FC<PaySubscriptionModalProps> = ({
  isOpen,
  onClose,
  subscription,
  targetMonthIndex,
  targetYear,
}) => {
  const { accounts, categories, saveTransaction, saveSubscription } = useFinance();

  const [fromAccountId, setFromAccountId] = useState(''); // '' = Não especificado
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [dateStr, setDateStr] = useState(() => getTodayLocalDateStr());
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentState, setPaymentState] = useState<'idle' | 'processing' | 'success'>('idle');
  const [isCustomCalendarOpen, setIsCustomCalendarOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => targetYear || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => targetMonthIndex !== undefined ? targetMonthIndex : new Date().getMonth());
  const [setAsDefault, setSetAsDefault] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const category = useMemo(() => {
    return categories.find(c => c.id === subscription?.categoryId);
  }, [categories, subscription?.categoryId]);

  // Contas disponíveis (contas correntes, carteiras e cartões de crédito)
  const availableAccounts = useMemo(() => {
    return accounts;
  }, [accounts]);

  const selectedSourceAccount = useMemo(() => {
    return accounts.find(a => a.id === fromAccountId);
  }, [accounts, fromAccountId]);

  // Data prevista de cobrança no mês alvo
  const expectedDueDateStr = useMemo(() => {
    if (!subscription) return null;
    const now = new Date();
    const yr = targetYear || now.getFullYear();
    const mo = targetMonthIndex !== undefined ? targetMonthIndex : now.getMonth();

    let day = subscription.dayOfMonth;
    if (!day && subscription.nextBillingDate) {
      day = parseInt(subscription.nextBillingDate.split('-')[2], 10);
    }
    if (!day) day = 1;

    const daysInMonth = new Date(yr, mo + 1, 0).getDate();
    const safeDay = Math.min(day, daysInMonth);

    const monthStr = String(mo + 1).padStart(2, '0');
    const dayStr = String(safeDay).padStart(2, '0');
    return `${yr}-${monthStr}-${dayStr}`;
  }, [subscription, targetMonthIndex, targetYear]);

  const prevIsOpenRef = useRef(false);
  const prevSubIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const isTransitionToOpen = isOpen && !prevIsOpenRef.current;
    const isSubChanged = subscription?.id !== prevSubIdRef.current;
    prevIsOpenRef.current = isOpen;
    prevSubIdRef.current = subscription?.id;

    if (!subscription || !isOpen) return;
    if (!isTransitionToOpen && !isSubChanged) return;

    setAmountStr(formatCurrencyInput(subscription.amount > 0 ? subscription.amount : undefined));
    setIsEditingAmount(false);
    setIsAccountDropdownOpen(false);
    setIsCustomCalendarOpen(false);
    setPaymentState('idle');
    setIsSubmitting(false);

    // Inicialização da conta de débito:
    // Se a assinatura já tem uma conta vinculada, pré-seleciona ela.
    // Se não tem ("Não especificado"), inicia com '' (Não especificado)
    if (subscription.accountId) {
      setFromAccountId(subscription.accountId);
      setSetAsDefault(false);
    } else {
      setFromAccountId('');
      setSetAsDefault(true); // Se o usuário escolher uma conta, sugere salvar como padrão
    }

    // Inicialização da data:
    // Se targetMonthIndex/targetYear coincidem com hoje, usa hoje; senão usa a data prevista do vencimento
    const today = getTodayLocalDateStr();
    if (expectedDueDateStr) {
      const now = new Date();
      const isTargetCurrentMonth = (targetMonthIndex === undefined || targetMonthIndex === now.getMonth()) &&
                                   (targetYear === undefined || targetYear === now.getFullYear());
      setDateStr(isTargetCurrentMonth ? today : expectedDueDateStr);
    } else {
      setDateStr(today);
    }
  }, [subscription, isOpen, targetMonthIndex, targetYear, expectedDueDateStr]);

  const todayStr = getTodayLocalDateStr();
  const yesterdayStr = getYesterdayLocalDateStr();

  const isTodaySelected = dateStr === todayStr;
  const isYesterdaySelected = dateStr === yesterdayStr;
  const isDueDateSelected = Boolean(expectedDueDateStr && dateStr === expectedDueDateStr);

  // Formatação em linguagem natural da data
  const dateDisplayInfo = useMemo(() => {
    if (!dateStr) return { label: 'Selecionar data', shortLabel: 'Outra' };
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    const monthShort = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const capitalizedMonth = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);

    if (dateStr === todayStr) {
      return {
        label: `Hoje, ${d} de ${capitalizedMonth}`,
        shortLabel: 'Hoje',
      };
    }

    if (dateStr === yesterdayStr) {
      return {
        label: `Ontem, ${d} de ${capitalizedMonth}`,
        shortLabel: 'Ontem',
      };
    }

    if (expectedDueDateStr && dateStr === expectedDueDateStr) {
      return {
        label: `Vencimento, ${d} de ${capitalizedMonth}`,
        shortLabel: `Dia ${d}`,
      };
    }

    return {
      label: `${String(d).padStart(2, '0')} de ${capitalizedMonth} de ${y}`,
      shortLabel: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
    };
  }, [dateStr, todayStr, yesterdayStr, expectedDueDateStr]);

  // Sincronizar o mês visualizado no calendário popover
  useEffect(() => {
    if (dateStr) {
      const [y, m] = dateStr.split('-').map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        setViewYear(y);
        setViewMonth(m - 1);
      }
    }
  }, [dateStr, isCustomCalendarOpen]);

  // Fechar calendário ao clicar fora
  useEffect(() => {
    if (!isCustomCalendarOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setIsCustomCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCustomCalendarOpen]);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewYear(y => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewYear(y => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  // Grade de dias para o calendário popover
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      dateStr: string;
    }> = [];

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      const cellDateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, month: m, year: y, isCurrentMonth: false, dateStr: cellDateStr });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cellDateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, month: viewMonth, year: viewYear, isCurrentMonth: true, dateStr: cellDateStr });
    }

    const remainingCells = 7 - (cells.length % 7);
    if (remainingCells < 7) {
      for (let d = 1; d <= remainingCells; d++) {
        const m = viewMonth === 11 ? 0 : viewMonth + 1;
        const y = viewMonth === 11 ? viewYear + 1 : viewYear;
        const cellDateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ day: d, month: m, year: y, isCurrentMonth: false, dateStr: cellDateStr });
      }
    }

    return cells;
  }, [viewYear, viewMonth]);

  if (!subscription) return null;

  const currentPayVal = parseBrlCurrency(amountStr) || subscription.amount;
  const isFullPayment = Math.abs(currentPayVal - subscription.amount) < 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payVal = parseBrlCurrency(amountStr);

    if (!payVal || payVal <= 0) {
      alert('Informe um valor de pagamento válido.');
      return;
    }

    setIsSubmitting(true);
    setPaymentState('processing');

    try {
      const selectedAcc = fromAccountId ? accounts.find(a => a.id === fromAccountId) : null;
      const isCreditCard = selectedAcc?.type === 'credit_card';

      // 1. Determina a forma de pagamento correspondente à conta escolhida
      const paymentMethod: PaymentMethod = isCreditCard
        ? 'credit'
        : selectedAcc?.type === 'cash'
        ? 'cash'
        : selectedAcc
        ? 'debit'
        : 'other';

      const txDate = `${dateStr}T12:00:00.000Z`;

      // 2. Registra a transação de despesa da assinatura
      // Se fromAccountId estiver preenchido, saveTransaction e adapter debitam o saldo da conta selecionada
      // Se fromAccountId for '' (Não especificado), registra a transação sem abater de nenhuma conta!
      await saveTransaction({
        accountId: fromAccountId || '',
        categoryId: subscription.categoryId,
        amount: payVal,
        type: 'expense',
        description: subscription.name,
        date: txDate,
        status: 'confirmed',
        paymentMethod,
        source: 'manual',
        subscriptionId: subscription.id,
        isRecurring: true,
        recurringCadence: subscription.cadence,
        recurringDayOfMonth: subscription.dayOfMonth || parseInt(dateStr.split('-')[2], 10),
        isShared: selectedAcc?.isShared !== undefined ? Boolean(selectedAcc.isShared) : Boolean(subscription.isShared),
        notes: fromAccountId 
          ? `Pagamento de assinatura debitado em ${selectedAcc?.name || 'conta'}`
          : 'Pagamento de assinatura informado (sem conta vinculada)',
      });

      // 3. Atualizar a assinatura:
      // - lastChargeDate passa a ser a data do pagamento
      // - avança nextBillingDate para o próximo ciclo
      // - se setAsDefault for true e uma conta tiver sido escolhida, atualiza accountId da assinatura
      const nextDate = new Date(dateStr);
      if (subscription.cadence === 'yearly') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      } else {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      const updatedNextBilling = nextDate.toISOString().substring(0, 10);

      const updatedSub: Subscription = {
        ...subscription,
        lastChargeDate: txDate,
        nextBillingDate: updatedNextBilling,
        accountId: (setAsDefault && fromAccountId) ? fromAccountId : subscription.accountId,
      };
      await saveSubscription(updatedSub);

      setPaymentState('success');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error('Erro ao registrar pagamento de assinatura:', err);
      alert('Ocorreu um erro ao salvar o pagamento da assinatura.');
      setPaymentState('idle');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Informar Pagamento"
      subtitle={`Pagamento da assinatura ${subscription.name}`}
      maxWidth="420px"
      zIndex={10050}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '4px' }}>
        {/* Hero do Pagamento: Identificação + Valor em Destaque Direto */}
        <div
          style={{
            padding: '20px 18px',
            borderRadius: '20px',
            backgroundColor: '#151916',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          {/* Topo: Logo + Nome da Assinatura */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <SubscriptionLogo
              name={subscription.name}
              category={category}
              bankId={selectedSourceAccount?.bankId || selectedSourceAccount?.name}
              size={36}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                {subscription.name}
              </span>
              {subscription.isShared && <SharedBadge size="sm" />}
            </div>
          </div>

          {/* Valor Principal em Destaque */}
          {!isEditingAmount ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '4px 0 2px' }}>
              <div
                style={{
                  fontSize: '2.3rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                {formatBrlCurrency(currentPayVal)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.78rem' }}>
                <span style={{ color: '#94A3B8' }}>
                  {isFullPayment ? 'Valor integral da mensalidade' : 'Valor personalizado'}
                </span>
                <span style={{ color: '#475569' }}>•</span>
                <button
                  type="button"
                  onClick={() => setIsEditingAmount(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    fontWeight: 600,
                    padding: 0,
                    textDecoration: 'underline',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                >
                  Alterar valor
                </button>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', margin: '6px 0 2px' }}>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                required
                value={amountStr}
                onChange={e => setAmountStr(formatCurrencyInput(e.target.value, amountStr))}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: '#1B211D',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '8px', fontSize: '0.76rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setAmountStr(formatCurrencyInput(subscription.amount));
                    setIsEditingAmount(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline',
                  }}
                >
                  Valor padrão ({formatBrlCurrency(subscription.amount)})
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingAmount(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                  }}
                >
                  Concluir edição
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 1. Data do Pagamento (Chips Rápidos + Popover de Calendário) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.80rem', color: '#94A3B8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} color="#94A3B8" />
              <span>Data do pagamento</span>
            </label>
            <span style={{ fontSize: '0.78rem', color: '#E2E8F0', fontWeight: 600 }}>
              {dateDisplayInfo.label}
            </span>
          </div>

          {/* Chips Horizontais Rápidos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Chip Hoje */}
            <button
              type="button"
              onClick={() => {
                setDateStr(todayStr);
                setIsCustomCalendarOpen(false);
              }}
              style={{
                flex: 1,
                padding: '9px 10px',
                borderRadius: '12px',
                border: isTodaySelected && !isCustomCalendarOpen ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: isTodaySelected && !isCustomCalendarOpen ? '#FFFFFF' : 'rgba(255, 255, 255, 0.04)',
                color: isTodaySelected && !isCustomCalendarOpen ? '#0A0E0C' : '#94A3B8',
                fontSize: '0.78rem',
                fontWeight: isTodaySelected && !isCustomCalendarOpen ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isTodaySelected && !isCustomCalendarOpen ? '0 2px 6px rgba(0, 0, 0, 0.2)' : 'none',
              }}
            >
              Hoje
            </button>

            {/* Chip Ontem */}
            <button
              type="button"
              onClick={() => {
                setDateStr(yesterdayStr);
                setIsCustomCalendarOpen(false);
              }}
              style={{
                flex: 1,
                padding: '9px 10px',
                borderRadius: '12px',
                border: isYesterdaySelected && !isCustomCalendarOpen ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: isYesterdaySelected && !isCustomCalendarOpen ? '#FFFFFF' : 'rgba(255, 255, 255, 0.04)',
                color: isYesterdaySelected && !isCustomCalendarOpen ? '#0A0E0C' : '#94A3B8',
                fontSize: '0.78rem',
                fontWeight: isYesterdaySelected && !isCustomCalendarOpen ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isYesterdaySelected && !isCustomCalendarOpen ? '0 2px 6px rgba(0, 0, 0, 0.2)' : 'none',
              }}
            >
              Ontem
            </button>

            {/* Chip Vencimento (se aplicável) */}
            {expectedDueDateStr && (
              <button
                type="button"
                onClick={() => {
                  setDateStr(expectedDueDateStr);
                  setIsCustomCalendarOpen(false);
                }}
                style={{
                  flex: 1,
                  padding: '9px 10px',
                  borderRadius: '12px',
                  border: isDueDateSelected && !isCustomCalendarOpen ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                  backgroundColor: isDueDateSelected && !isCustomCalendarOpen ? '#FFFFFF' : 'rgba(255, 255, 255, 0.04)',
                  color: isDueDateSelected && !isCustomCalendarOpen ? '#0A0E0C' : '#94A3B8',
                  fontSize: '0.78rem',
                  fontWeight: isDueDateSelected && !isCustomCalendarOpen ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isDueDateSelected && !isCustomCalendarOpen ? '0 2px 6px rgba(0, 0, 0, 0.2)' : 'none',
                }}
              >
                Vencimento
              </button>
            )}

            {/* Botão de Outra Data / Calendário Popover */}
            {(() => {
              const isOtherSelected = (!isTodaySelected && !isYesterdaySelected && !isDueDateSelected) || isCustomCalendarOpen;
              return (
                <button
                  type="button"
                  onClick={() => setIsCustomCalendarOpen(!isCustomCalendarOpen)}
                  style={{
                    flex: 1,
                    padding: '9px 10px',
                    borderRadius: '12px',
                    border: isOtherSelected ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundColor: isOtherSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.04)',
                    color: isOtherSelected ? '#0A0E0C' : '#94A3B8',
                    fontSize: '0.78rem',
                    fontWeight: isOtherSelected ? 700 : 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                    boxShadow: isOtherSelected ? '0 2px 6px rgba(0, 0, 0, 0.2)' : 'none',
                  }}
                >
                  <Calendar size={13} color={isOtherSelected ? '#0A0E0C' : '#94A3B8'} />
                  <span>{(!isTodaySelected && !isYesterdaySelected && !isDueDateSelected) ? dateDisplayInfo.shortLabel : 'Outra'}</span>
                </button>
              );
            })()}
          </div>

          {/* Popover Flutuante do Calendário Matrix */}
          {isCustomCalendarOpen && (
            <div
              ref={calendarRef}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '8px',
                padding: '14px',
                borderRadius: '16px',
                backgroundColor: '#161A18',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
                zIndex: 100,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>
                  {monthNames[viewMonth]} {viewYear}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#94A3B8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#94A3B8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>

              {/* Dias da Semana (D S T Q Q S S) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '6px', textAlign: 'center' }}>
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((wd, idx) => (
                  <span key={idx} style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748B', padding: '2px 0' }}>
                    {wd}
                  </span>
                ))}
              </div>

              {/* Grade de Dias */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
                {calendarDays.map((cell, idx) => {
                  const isSelected = cell.dateStr === dateStr;
                  const isToday = cell.dateStr === todayStr;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setDateStr(cell.dateStr);
                        setIsCustomCalendarOpen(false);
                      }}
                      style={{
                        height: '32px',
                        borderRadius: '8px',
                        border: isSelected
                          ? 'none'
                          : isToday
                          ? '1px solid rgba(255, 255, 255, 0.35)'
                          : 'none',
                        backgroundColor: isSelected
                          ? '#FFFFFF'
                          : cell.isCurrentMonth
                          ? 'rgba(255, 255, 255, 0.04)'
                          : 'transparent',
                        color: isSelected
                          ? '#0A0E0C'
                          : cell.isCurrentMonth
                          ? '#FFFFFF'
                          : '#475569',
                        fontSize: '0.80rem',
                        fontWeight: isSelected ? 700 : isToday ? 600 : cell.isCurrentMonth ? 500 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isSelected ? '0 2px 6px rgba(0, 0, 0, 0.35)' : 'none',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 2. Debitar de qual conta/carteira? (CERNE DO PEDIDO DO USUÁRIO) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.80rem', color: '#94A3B8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wallet size={14} color="#94A3B8" />
            <span>Debitar de qual conta/carteira?</span>
          </label>

          <div style={{ position: 'relative' }}>
            {/* Gatilho do Dropdown Customizado */}
            <button
              type="button"
              onClick={() => {
                setIsAccountDropdownOpen(!isAccountDropdownOpen);
                setIsCustomCalendarOpen(false);
              }}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '14px',
                backgroundColor: '#121418',
                border: `1px solid ${isAccountDropdownOpen ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxSizing: 'border-box',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                {selectedSourceAccount ? (
                  <>
                    <BankLogo bankId={selectedSourceAccount.bankId || selectedSourceAccount.name} size={28} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.90rem', fontWeight: 600, color: '#FFFFFF' }}>
                          {selectedSourceAccount.name}
                        </span>
                        {selectedSourceAccount.isShared && <SharedBadge size="sm" />}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                        {selectedSourceAccount.type === 'credit_card' ? (
                          <span>Lança na fatura do cartão</span>
                        ) : (
                          <span>Saldo: <strong style={{ color: '#FFFFFF' }}>{formatBrlCurrency(selectedSourceAccount.balance)}</strong></span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94A3B8',
                        flexShrink: 0,
                      }}
                    >
                      <Ban size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.90rem', fontWeight: 600, color: '#FFFFFF' }}>
                        Não especificado
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                        Registra sem abater saldo de nenhuma conta
                      </div>
                    </div>
                  </>
                )}
              </div>

              <ChevronDown
                size={18}
                color="#94A3B8"
                style={{
                  transform: isAccountDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  flexShrink: 0,
                  marginLeft: '8px',
                }}
              />
            </button>

            {/* Menu Popover Flutuante Customizado */}
            {isAccountDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '8px',
                  borderRadius: '16px',
                  backgroundColor: '#161A18',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.7)',
                  zIndex: 100,
                  maxHeight: '280px',
                  overflowY: 'auto',
                  padding: '6px',
                }}
              >
                {/* Opção 1: Não Especificado (Conforme solicitado pelo usuário) */}
                <button
                  type="button"
                  onClick={() => {
                    setFromAccountId('');
                    setIsAccountDropdownOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: fromAccountId === '' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    if (fromAccountId !== '') e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  }}
                  onMouseLeave={e => {
                    if (fromAccountId !== '') e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94A3B8',
                      }}
                    >
                      <Ban size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#FFFFFF' }}>
                        Não especificado
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                        Não debitar de nenhuma conta ou cartão
                      </div>
                    </div>
                  </div>
                  {fromAccountId === '' && <Check size={16} color="#FFFFFF" strokeWidth={2.4} />}
                </button>

                {/* Divisor */}
                <div
                  style={{
                    height: '1px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    margin: '6px 4px',
                  }}
                />

                {/* Lista de Contas e Cartões Disponíveis */}
                {availableAccounts.map(acc => {
                  const isSelected = fromAccountId === acc.id;
                  const isCard = acc.type === 'credit_card';

                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setFromAccountId(acc.id);
                        setIsAccountDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: 'none',
                        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <BankLogo bankId={acc.bankId || acc.name} size={28} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {acc.name}
                            </span>
                            {acc.isShared && <SharedBadge size="sm" />}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '1px' }}>
                            {isCard ? (
                              <span>Cartão de crédito</span>
                            ) : (
                              <span>Saldo: <strong style={{ color: '#E2E8F0' }}>{formatBrlCurrency(acc.balance)}</strong></span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isSelected && <Check size={16} color="#FFFFFF" strokeWidth={2.4} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 3. Opção de Definir como Padrão (se escolheu uma conta real e a assinatura não tinha) */}
        {fromAccountId !== '' && (!subscription.accountId || subscription.accountId !== fromAccountId) && (
          <div
            onClick={() => setSetAsDefault(!setAsDefault)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '6px',
                border: setAsDefault ? 'none' : '1.5px solid rgba(255, 255, 255, 0.3)',
                backgroundColor: setAsDefault ? '#FFFFFF' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0B0F0D',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              {setAsDefault && <Check size={12} strokeWidth={3} />}
            </div>
            <div style={{ fontSize: '0.80rem', color: '#D1D5DB' }}>
              Vincular como conta padrão para as próximas cobranças
            </div>
          </div>
        )}

        {/* Resumo do Impacto Financeiro (Discreto e Calmo) */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '14px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '0.80rem',
            color: '#94A3B8',
            lineHeight: 1.45,
          }}
        >
          {fromAccountId && selectedSourceAccount ? (
            selectedSourceAccount.type === 'credit_card' ? (
              <span>
                💳 A despesa de <strong style={{ color: '#FFFFFF' }}>{formatBrlCurrency(currentPayVal)}</strong> será adicionada à fatura do cartão <strong style={{ color: '#FFFFFF' }}>{selectedSourceAccount.name}</strong>.
              </span>
            ) : (
              <span>
                🏦 O valor de <strong style={{ color: '#FFFFFF' }}>{formatBrlCurrency(currentPayVal)}</strong> será debitado do saldo da conta <strong style={{ color: '#FFFFFF' }}>{selectedSourceAccount.name}</strong>.
              </span>
            )
          ) : (
            <span>
              ℹ️ A assinatura será marcada como paga este mês no seu controle, sem abater saldo de nenhuma conta bancária específica.
            </span>
          )}
        </div>

        {/* Botão de Confirmação & Cancelar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <button
            type="submit"
            disabled={isSubmitting || paymentState === 'success'}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '16px',
              backgroundColor: paymentState === 'success' ? '#16A34A' : '#FFFFFF',
              border: paymentState === 'success' ? '1px solid rgba(255, 255, 255, 0.3)' : 'none',
              color: paymentState === 'success' ? '#FFFFFF' : '#0B0F0D',
              fontSize: '0.94rem',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              cursor: isSubmitting || paymentState !== 'idle' ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: paymentState === 'success'
                ? '0 8px 24px -4px rgba(22, 163, 74, 0.5), 0 0 16px rgba(22, 163, 74, 0.25)'
                : '0 2px 8px rgba(0, 0, 0, 0.2)',
              transition: 'background-color 0.2s ease, transform 0.15s ease',
            }}
            onMouseEnter={e => {
              if (paymentState === 'idle' && !isSubmitting) {
                e.currentTarget.style.backgroundColor = '#F1F5F9';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={e => {
              if (paymentState === 'idle') {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.transform = 'none';
              }
            }}
          >
            {paymentState === 'processing' ? (
              <>
                <Loader2 size={18} className="animate-spin" color="#0B0F0D" />
                <span>Registrando pagamento...</span>
              </>
            ) : paymentState === 'success' ? (
              <>
                <CheckCircle2 size={18} strokeWidth={2.4} />
                <span>Pagamento registrado!</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={18} strokeWidth={2.4} />
                <span>
                  {fromAccountId 
                    ? `Confirmar e debitar ${formatBrlCurrency(currentPayVal)}`
                    : `Confirmar pagamento (${formatBrlCurrency(currentPayVal)})`}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || paymentState !== 'idle'}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748B',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: isSubmitting || paymentState !== 'idle' ? 'default' : 'pointer',
              alignSelf: 'center',
              padding: '6px 12px',
              transition: 'all 0.2s ease',
              opacity: paymentState === 'success' ? 0 : 1,
              pointerEvents: paymentState === 'success' ? 'none' : 'auto',
            }}
            onMouseEnter={e => {
              if (paymentState === 'idle') e.currentTarget.style.color = '#94A3B8';
            }}
            onMouseLeave={e => {
              if (paymentState === 'idle') e.currentTarget.style.color = '#64748B';
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
};
