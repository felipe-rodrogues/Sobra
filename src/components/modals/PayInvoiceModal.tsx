import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../common/Modal';
import { BankLogo } from '../common/BankLogo';
import { CardBrandLogo } from '../common/MastercardLogo';
import { useFinance } from '../../context/FinanceContext';
import { Account } from '../../core/types';
import { formatBrlCurrency, parseBrlCurrency } from '../../core/parsers/currencyHelper';
import { CheckCircle2, AlertCircle, Calendar, Wallet, ChevronDown, Check, Briefcase, ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';

// Retorna a data local do dispositivo no formato YYYY-MM-DD (sem distorção de fuso UTC)
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

interface PayInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: Account | null;
}

export const PayInvoiceModal: React.FC<PayInvoiceModalProps> = ({
  isOpen,
  onClose,
  card,
}) => {
  const { accounts, transactions, saveTransaction, saveAccount } = useFinance();

  const [fromAccountId, setFromAccountId] = useState('');
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [dateStr, setDateStr] = useState(() => getTodayLocalDateStr());
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentState, setPaymentState] = useState<'idle' | 'processing' | 'success'>('idle');
  const [isCustomCalendarOpen, setIsCustomCalendarOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const calendarRef = useRef<HTMLDivElement>(null);

  // Contas disponíveis para pagar (contas correntes, carteiras, etc.)
  const paymentAccounts = useMemo(() => {
    return accounts.filter(a => a.type !== 'credit_card');
  }, [accounts]);

  // Detector inteligente da conta onde o salário cai
  const detectedSalaryAccountId = useMemo(() => {
    if (!card || paymentAccounts.length === 0) return '';

    // 1. Prioridade máxima: se o cartão já tem uma conta vinculada explicitamente configurada
    if (card.linkedAccountId) {
      const linked = paymentAccounts.find(a => a.id === card.linkedAccountId);
      if (linked) return linked.id;
    }

    // 2. Analisar histórico de receitas para localizar onde cai o salário
    const incomeTxs = (transactions || [])
      .filter(t => t.type === 'income')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // A. Transação com categoria oficial de salário, termo salarial ou recorrente
    const salaryTx = incomeTxs.find(t => {
      const desc = (t.description || '').toLowerCase();
      const isSalaryCat = t.categoryId === 'cat-salario';
      const hasSalaryTerm =
        desc.includes('salár') ||
        desc.includes('salar') ||
        desc.includes('pro labore') ||
        desc.includes('pro-labore') ||
        desc.includes('folha') ||
        desc.includes('remunera') ||
        desc.includes('vencimento') ||
        desc.includes('pagamento');
      return isSalaryCat || hasSalaryTerm || t.isRecurring;
    });

    if (salaryTx) {
      const acc = paymentAccounts.find(a => a.id === salaryTx.accountId);
      if (acc) return acc.id;
    }

    // B. Maior receita recente (>= R$ 800)
    const mainIncomeTx = incomeTxs.find(t => t.amount >= 800);
    if (mainIncomeTx) {
      const acc = paymentAccounts.find(a => a.id === mainIncomeTx.accountId);
      if (acc) return acc.id;
    }

    // 3. Mesma instituição bancária do cartão (ex: Cartão Nubank -> Conta Nubank)
    if (card.bankId) {
      const sameBank = paymentAccounts.find(
        a => a.bankId && a.bankId.toLowerCase() === card.bankId?.toLowerCase()
      );
      if (sameBank) return sameBank.id;
    }

    // 4. Fallback: conta com maior saldo ou a primeira disponível
    const sortedByBalance = [...paymentAccounts].sort((a, b) => b.balance - a.balance);
    return sortedByBalance[0]?.id || paymentAccounts[0]?.id || '';
  }, [card, paymentAccounts, transactions]);

  useEffect(() => {
    if (card && isOpen) {
      const rawInvoiceVal = card.invoiceAmount ?? Math.abs(card.balance);
      // Para cartões compartilhados, sugere apenas a parcela do usuário (splitRatio)
      const splitRatio = card.isShared && card.splitRatio !== undefined ? card.splitRatio : 1;
      const invoiceVal = Math.round(rawInvoiceVal * splitRatio * 100) / 100;
      setAmountStr(invoiceVal > 0 ? invoiceVal.toFixed(2).replace('.', ',') : '0,00');
      
      // Padrão: dia/momento exato em que o usuário abriu o modal no fuso horário local
      const todayLocal = getTodayLocalDateStr();
      setDateStr(todayLocal);
      setIsEditingAmount(false);
      setIsAccountDropdownOpen(false);
      setIsCustomCalendarOpen(false);
      setPaymentState('idle');

      // Pré-seleciona inteligentemente a conta onde o salário foi detectado
      if (detectedSalaryAccountId) {
        setFromAccountId(detectedSalaryAccountId);
      } else if (paymentAccounts.length > 0) {
        setFromAccountId(paymentAccounts[0].id);
      } else {
        setFromAccountId('');
      }
    }
  }, [card, isOpen, detectedSalaryAccountId, paymentAccounts]);

  // Data de vencimento calculada para o cartão
  const dueDateStr = useMemo(() => {
    if (!card?.dueDay) return null;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(card.dueDay).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  }, [card?.dueDay]);

  const todayStr = getTodayLocalDateStr();
  const yesterdayStr = getYesterdayLocalDateStr();

  const isTodaySelected = dateStr === todayStr;
  const isYesterdaySelected = dateStr === yesterdayStr;
  const isDueDateSelected = Boolean(dueDateStr && dateStr === dueDateStr);
  const isCustomDateSelected = !isTodaySelected && !isYesterdaySelected && !isDueDateSelected;

  // Formatação elegante da data selecionada em linguagem natural
  const dateDisplayInfo = useMemo(() => {
    if (!dateStr) return { label: 'Selecionar data', shortLabel: 'Outra' };
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const today = getTodayLocalDateStr();
    const yesterday = getYesterdayLocalDateStr();

    const monthShort = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const capitalizedMonth = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);

    if (dateStr === today) {
      return {
        label: `Hoje, ${d} de ${capitalizedMonth}`,
        shortLabel: 'Hoje',
      };
    }

    if (dateStr === yesterday) {
      return {
        label: `Ontem, ${d} de ${capitalizedMonth}`,
        shortLabel: 'Ontem',
      };
    }

    if (dueDateStr && dateStr === dueDateStr) {
      return {
        label: `Vencimento, ${d} de ${capitalizedMonth}`,
        shortLabel: `Dia ${d}`,
      };
    }

    return {
      label: `${String(d).padStart(2, '0')} de ${capitalizedMonth} de ${y}`,
      shortLabel: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
    };
  }, [dateStr, dueDateStr]);

  // Sincronizar o mês visualizado no calendário com a data selecionada atualmente
  useEffect(() => {
    if (dateStr) {
      const [y, m] = dateStr.split('-').map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        setViewYear(y);
        setViewMonth(m - 1);
      }
    }
  }, [dateStr, isCustomCalendarOpen]);

  // Fechar o calendário ao clicar fora dele
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

  // Grade precisa de dias para o calendário popover
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Dom, 6 = Sáb
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      dateStr: string;
    }> = [];

    // Dias do mês anterior para completar o início da grade
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      const cellDateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, month: m, year: y, isCurrentMonth: false, dateStr: cellDateStr });
    }

    // Dias do mês atual
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, month: viewMonth, year: viewYear, isCurrentMonth: true, dateStr: cellDateStr });
    }

    // Dias do próximo mês para completar as linhas da grade (múltiplo de 7)
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

  if (!card) return null;

  const rawInvoiceAmount = card.invoiceAmount ?? Math.abs(card.balance);
  // Para cartões conjuntos, exibe apenas a parcela do usuário como referência
  const splitRatio = card.isShared && card.splitRatio !== undefined ? card.splitRatio : 1;
  const invoiceAmount = Math.round(rawInvoiceAmount * splitRatio * 100) / 100;
  const currentPayVal = parseBrlCurrency(amountStr) || invoiceAmount;
  const isFullPayment = Math.abs(currentPayVal - invoiceAmount) < 0.01;
  const selectedSourceAccount = accounts.find(a => a.id === fromAccountId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payVal = parseBrlCurrency(amountStr);

    if (!payVal || payVal <= 0) {
      alert('Informe um valor de pagamento válido.');
      return;
    }

    if (!fromAccountId) {
      alert('Selecione uma conta bancária para debitar o pagamento.');
      return;
    }

    setIsSubmitting(true);
    setPaymentState('processing');
    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const targetInvoiceMonth = card.invoiceMonth || (
        card.closingDay && card.dueDay && card.closingDay <= card.dueDay && now.getDate() >= card.closingDay
          ? (currentMonth === 1 ? 12 : currentMonth - 1)
          : currentMonth
      );
      const targetInvoiceYear = card.invoiceYear || (
        card.closingDay && card.dueDay && card.closingDay <= card.dueDay && now.getDate() >= card.closingDay && currentMonth === 1
          ? currentYear - 1
          : currentYear
      );

      // 1. Registra a saída real de caixa na conta bancária de onde o dinheiro saiu
      // Isso alimenta automaticamente o Fluxo de Caixa (paidInvoicesAmount) e abate o saldo
      await saveTransaction({
        accountId: fromAccountId,
        categoryId: 'cat-outros-desp',
        amount: payVal,
        type: 'expense',
        description: `Pagamento Fatura ${card.name}`,
        date: `${dateStr}T12:00:00.000Z`,
        status: 'confirmed',
        paymentMethod: 'transfer',
        source: 'manual',
        destinationAccountId: card.id,
        isInvoicePayment: true,
        competenceMonth: targetInvoiceMonth,
        competenceYear: targetInvoiceYear,
      });

      // 2. Abater o valor da fatura do cartão
      const isFullQuotaPaid = payVal >= (invoiceAmount - 0.02);
      const newCardBalance = Math.max(0, (card.balance || 0) - payVal);
      const newInvoiceAmount = isFullQuotaPaid ? 0 : Math.max(0, (card.invoiceAmount || 0) - payVal);

      // Se pagou a fatura fechada do ciclo anterior, compras em aberto do ciclo atual permanecem intactas!
      const updatedOpenAmount = targetInvoiceMonth === currentMonth
        ? Math.max(0, (card.openAmount !== undefined ? card.openAmount : newCardBalance) - payVal)
        : (card.openAmount !== undefined ? card.openAmount : newCardBalance);

      await saveAccount({
        ...card,
        balance: newCardBalance,
        invoiceAmount: newInvoiceAmount,
        openAmount: updatedOpenAmount,
        invoiceStatus: (isFullQuotaPaid || newInvoiceAmount === 0) ? 'paid' : card.invoiceStatus,
      });

      // 3. Transição triunfante e satisfatória: Ativa o feedback de sucesso no botão
      setPaymentState('success');

      // 4. Aguarda a animação satisfatória ser vivenciada pelo usuário antes de fechar suavemente
      setTimeout(() => {
        onClose();
        setTimeout(() => {
          setPaymentState('idle');
          setIsSubmitting(false);
        }, 300);
      }, 950);
    } catch (err) {
      console.error('Erro ao registrar pagamento de fatura:', err);
      alert('Ocorreu um erro ao registrar o pagamento.');
      setPaymentState('idle');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pagar Fatura"
      subtitle={`Quitação da fatura do ${card.name}`}
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
          {/* Topo: Logo + Cartão */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <BankLogo bankId={card.bankId || card.name} size={24} />
            <span style={{ fontSize: '0.90rem', fontWeight: 700, color: '#FFFFFF' }}>
              {card.name}
            </span>
            {card.lastDigits && (
              <span style={{ color: '#64748B', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                •••• {card.lastDigits}
              </span>
            )}
            <CardBrandLogo brand={card.cardBrand || 'mastercard'} size={16} showText={false} />
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
                  {isFullPayment ? 'Valor integral da fatura' : 'Pagamento parcial'}
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
                autoFocus
                required
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
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
                    setAmountStr(invoiceAmount.toFixed(2).replace('.', ','));
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
                  Pagar total ({formatBrlCurrency(invoiceAmount)})
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

        {/* 1. Data do Pagamento (Chips Rápidos + Popover de Calendário Pierre) */}
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
                borderRadius: '10px',
                backgroundColor: isTodaySelected && !isCustomCalendarOpen ? '#FFFFFF' : 'rgba(255, 255, 255, 0.05)',
                border: isTodaySelected && !isCustomCalendarOpen ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                color: isTodaySelected && !isCustomCalendarOpen ? '#0A0E0C' : '#94A3B8',
                fontSize: '0.80rem',
                fontWeight: isTodaySelected && !isCustomCalendarOpen ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
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
                borderRadius: '10px',
                backgroundColor: isYesterdaySelected && !isCustomCalendarOpen ? '#FFFFFF' : 'rgba(255, 255, 255, 0.05)',
                border: isYesterdaySelected && !isCustomCalendarOpen ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                color: isYesterdaySelected && !isCustomCalendarOpen ? '#0A0E0C' : '#94A3B8',
                fontSize: '0.80rem',
                fontWeight: isYesterdaySelected && !isCustomCalendarOpen ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              Ontem
            </button>

            {/* Chip Vencimento (quando disponível) */}
            {dueDateStr && (
              <button
                type="button"
                onClick={() => {
                  setDateStr(dueDateStr);
                  setIsCustomCalendarOpen(false);
                }}
                style={{
                  flex: 1,
                  padding: '9px 10px',
                  borderRadius: '10px',
                  backgroundColor: isDueDateSelected && !isCustomCalendarOpen ? '#FFFFFF' : 'rgba(255, 255, 255, 0.05)',
                  border: isDueDateSelected && !isCustomCalendarOpen ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: isDueDateSelected && !isCustomCalendarOpen ? '#0A0E0C' : '#94A3B8',
                  fontSize: '0.80rem',
                  fontWeight: isDueDateSelected && !isCustomCalendarOpen ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                Venc. ({card.dueDay})
              </button>
            )}

            {/* Chip Outra Data (Abre Popover Customizado Pierre) */}
            <button
              type="button"
              onClick={() => {
                setIsCustomCalendarOpen(!isCustomCalendarOpen);
                setIsAccountDropdownOpen(false);
              }}
              style={{
                flex: isCustomDateSelected ? 1.2 : 0.9,
                padding: '9px 10px',
                borderRadius: '10px',
                backgroundColor: isCustomDateSelected || isCustomCalendarOpen ? '#FFFFFF' : 'rgba(255, 255, 255, 0.05)',
                border: isCustomDateSelected || isCustomCalendarOpen ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                color: isCustomDateSelected || isCustomCalendarOpen ? '#0A0E0C' : '#94A3B8',
                fontSize: '0.80rem',
                fontWeight: isCustomDateSelected || isCustomCalendarOpen ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              {isCustomDateSelected ? dateDisplayInfo.shortLabel : 'Outra...'}
            </button>
          </div>

          {/* Popover Flutuante do Calendário Customizado Pierre (Mesma Proporção do Popover Nativo, mas com Design Premium) */}
          {isCustomCalendarOpen && (
            <div
              ref={calendarRef}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '276px',
                maxWidth: 'calc(100vw - 48px)',
                backgroundColor: '#131715',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '16px',
                padding: '14px',
                boxShadow: '0 20px 40px -6px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(16px)',
                zIndex: 60,
                boxSizing: 'border-box',
              }}
            >
              {/* Topo do Calendário: Mês, Ano e Navegação */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
                  {monthNames[viewMonth]} de {viewYear}
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
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = '#94A3B8';
                    }}
                    aria-label="Mês anterior"
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
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = '#94A3B8';
                    }}
                    aria-label="Próximo mês"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>

              {/* Dias da Semana (D S T Q Q S S) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '2px',
                  marginBottom: '6px',
                  textAlign: 'center',
                }}
              >
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((wd, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      color: '#64748B',
                      padding: '2px 0',
                    }}
                  >
                    {wd}
                  </span>
                ))}
              </div>

              {/* Grade de Dias */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '3px',
                }}
              >
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
                          ? '1px solid rgba(255, 255, 255, 0.4)'
                          : 'none',
                        backgroundColor: isSelected
                          ? '#FFFFFF'
                          : isToday
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'transparent',
                        color: isSelected
                          ? '#0A0E0C'
                          : cell.isCurrentMonth
                          ? '#E2E8F0'
                          : '#475569',
                        fontSize: '0.78rem',
                        fontWeight: isSelected ? 700 : isToday ? 600 : cell.isCurrentMonth ? 500 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.12s ease',
                        boxShadow: isSelected ? '0 2px 6px rgba(0, 0, 0, 0.35)' : 'none',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = cell.isCurrentMonth
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(255, 255, 255, 0.04)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = isToday
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'transparent';
                        }
                      }}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>

              {/* Rodapé do Calendário */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setDateStr(todayStr);
                    setIsCustomCalendarOpen(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                >
                  Hoje ({new Date().getDate()})
                </button>

                <button
                  type="button"
                  onClick={() => setIsCustomCalendarOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#94A3B8')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. Conta de Origem (Dropdown Customizado Inteligente) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.80rem', color: '#94A3B8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wallet size={14} color="#94A3B8" />
            <span>Debitar de qual conta?</span>
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
                backgroundColor: '#151916',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                {selectedSourceAccount ? (
                  <>
                    <BankLogo bankId={selectedSourceAccount.bankId || selectedSourceAccount.name} size={26} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.90rem', fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedSourceAccount.name}
                        </span>
                        {selectedSourceAccount.id === detectedSalaryAccountId && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '1px 6px',
                              borderRadius: '9999px',
                              fontSize: '0.64rem',
                              fontWeight: 600,
                              backgroundColor: 'rgba(255, 255, 255, 0.07)',
                              color: '#CBD5E1',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Briefcase size={10} />
                            Salário
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                        Saldo: <strong style={{ color: '#FFFFFF' }}>{formatBrlCurrency(selectedSourceAccount.balance)}</strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <span style={{ fontSize: '0.86rem', color: '#94A3B8' }}>Selecione uma conta bancária...</span>
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
              <>
                <div
                  onClick={() => setIsAccountDropdownOpen(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 99,
                  }}
                />

                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    borderRadius: '16px',
                    backgroundColor: '#141715',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7)',
                    zIndex: 100,
                    maxHeight: '260px',
                    overflowY: 'auto',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                  }}
                >
                  {/* Opções das Contas Bancárias Reais */}
                  {paymentAccounts.map(acc => {
                    const isSelected = fromAccountId === acc.id;
                    const isSalaryAcc = acc.id === detectedSalaryAccountId;
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
                          padding: '11px 12px',
                          borderRadius: '10px',
                          backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <BankLogo bankId={acc.bankId || acc.name} size={28} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {acc.name}
                              </span>
                              {isSalaryAcc && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '1px 6px',
                                    borderRadius: '9999px',
                                    fontSize: '0.64rem',
                                    fontWeight: 600,
                                    backgroundColor: 'rgba(255, 255, 255, 0.07)',
                                    color: '#CBD5E1',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <Briefcase size={10} />
                                  Salário
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '2px' }}>
                              Saldo: <strong style={{ color: '#E2E8F0' }}>{formatBrlCurrency(acc.balance)}</strong>
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <Check size={16} color="#FFFFFF" strokeWidth={2.5} style={{ flexShrink: 0, marginLeft: '8px' }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* 3. Micro-card Refinado de Aviso do Débito e Fluxo de Caixa (Neutro, calmo e sem neon) */}
          {selectedSourceAccount && (
            <div
              style={{
                marginTop: '4px',
                padding: '10px 12px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '7px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px',
                }}
              >
                {selectedSourceAccount.balance >= currentPayVal ? (
                  <CheckCircle2 size={14} color="#94A3B8" strokeWidth={2.2} />
                ) : (
                  <AlertCircle size={14} color="#F59E0B" strokeWidth={2.2} />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: selectedSourceAccount.balance >= currentPayVal ? '#E2E8F0' : '#F59E0B',
                  }}
                >
                  {selectedSourceAccount.balance >= currentPayVal
                    ? 'Débito sincronizado no Fluxo de Caixa'
                    : 'Atenção: Saldo insuficiente'}
                </span>
                <span style={{ fontSize: '0.73rem', color: '#94A3B8', lineHeight: 1.35 }}>
                  {selectedSourceAccount.balance >= currentPayVal ? (
                    <>
                      O valor sairá de <strong style={{ color: '#FFFFFF' }}>{selectedSourceAccount.name}</strong> e abaterá o saldo da conta e da fatura.
                    </>
                  ) : (
                    <>
                      Saldo atual: <strong style={{ color: '#F59E0B' }}>{formatBrlCurrency(selectedSourceAccount.balance)}</strong>. O débito poderá deixar a conta no negativo.
                    </>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 4. Botão de Confirmação Pierre: Microinteração Tátil de Alta Fidelidade */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            {/* Halo de Onda Esmeralda (Expandindo suavemente ao confirmar) */}
            {paymentState === 'success' && <div className="anim-success-ring" />}

            <button
              type="submit"
              disabled={isSubmitting || paymentAccounts.length === 0 || paymentState !== 'idle'}
              className={paymentState === 'success' ? 'anim-success-pulse' : ''}
              style={{
                position: 'relative',
                width: '100%',
                height: '48px',
                padding: '0 20px',
                borderRadius: '14px',
                backgroundColor:
                  paymentAccounts.length === 0
                    ? '#1E2320'
                    : paymentState === 'success'
                    ? '#16A34A'
                    : '#FFFFFF',
                border: paymentState === 'success' ? '1px solid rgba(255, 255, 255, 0.3)' : 'none',
                color:
                  paymentAccounts.length === 0
                    ? '#64748B'
                    : paymentState === 'success'
                    ? '#FFFFFF'
                    : '#0B0F0D',
                fontSize: '0.94rem',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                cursor:
                  isSubmitting || paymentAccounts.length === 0 || paymentState !== 'idle'
                    ? 'default'
                    : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow:
                  paymentState === 'success'
                    ? '0 8px 24px -4px rgba(22, 163, 74, 0.5), 0 0 16px rgba(22, 163, 74, 0.25)'
                    : '0 2px 8px rgba(0, 0, 0, 0.2)',
                transition: 'background-color 0.28s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s ease, box-shadow 0.28s ease',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (paymentAccounts.length > 0 && paymentState === 'idle' && !isSubmitting) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={e => {
                if (paymentState === 'idle') {
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {paymentState === 'processing' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Loader2 size={18} className="animate-spin" color="#0B0F0D" />
                  <span>Confirmando pagamento...</span>
                </div>
              )}

              {paymentState === 'success' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: 800,
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="anim-check-pop"
                    style={{ flexShrink: 0 }}
                  >
                    <polyline points="20 6 9 17 4 12" className="anim-draw-check" />
                  </svg>
                  <span className="anim-success-text">Pagamento Confirmado!</span>
                </div>
              )}

              {paymentState === 'idle' && (
                <span>Confirmar Pagamento</span>
              )}
            </button>
          </div>

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
