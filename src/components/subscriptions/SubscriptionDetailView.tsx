import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Subscription, Transaction } from '../../core/types';
import { SubscriptionLogo } from './SubscriptionLogo';
import { BankLogo } from '../common/BankLogo';
import { IconRenderer } from '../common/IconRenderer';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { isSubscriptionMatchingTransaction, getSubscriptionBillingDay } from '../../core/subscriptions/recurrenceDetector';
import { 
  ChevronLeft, 
  ChevronRight,
  Sparkles, 
  Check, 
  Pause, 
  Play, 
  Trash2, 
  Calendar,
  Layers,
  Clock,
  CheckCircle2,
  Wallet,
  Ban,
  CreditCard,
  TrendingUp,
  Users
} from 'lucide-react';

interface SubscriptionDetailViewProps {
  subscription: Subscription;
  onBack: () => void;
  onEdit: (sub: Subscription) => void;
  onPaySubscription?: (sub: Subscription) => void;
  targetMonthIndex?: number;
  targetYear?: number;
}

export const SubscriptionDetailView: React.FC<SubscriptionDetailViewProps> = ({
  subscription,
  onBack,
  onEdit,
  onPaySubscription,
  targetMonthIndex,
  targetYear,
}) => {
  const { transactions, categories, accounts, saveSubscription, deleteSubscription, isPrivacyMode } = useFinance();

  const category = categories.find(c => c.id === subscription.categoryId);
  const account = subscription.accountId ? accounts.find(a => a.id === subscription.accountId) : null;

  const maskValue = (val: string) => (isPrivacyMode ? '••••••' : val);

  // Transações históricas semelhantes (detecção inteligente de assinaturas em cartão/conta)
  const similarTransactions = useMemo(() => {
    return transactions
      .filter(t => isSubscriptionMatchingTransaction(subscription, t))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, subscription]);

  const now = new Date();
  const currentMonthIdx = targetMonthIndex !== undefined ? targetMonthIndex : now.getMonth();
  const currentYr = targetYear !== undefined ? targetYear : now.getFullYear();

  const currentMonthTx = useMemo(() => {
    return similarTransactions.find(t => {
      const td = new Date(t.date);
      const matchesLocal = td.getMonth() === currentMonthIdx && td.getFullYear() === currentYr;
      const matchesUtc = td.getUTCMonth() === currentMonthIdx && td.getUTCFullYear() === currentYr;
      return matchesLocal || matchesUtc;
    });
  }, [similarTransactions, currentMonthIdx, currentYr]);

  const isPaidThisMonth = useMemo(() => {
    const isKnownPaid = subscription.lastChargeDate
      ? (new Date(subscription.lastChargeDate).getMonth() === currentMonthIdx &&
         new Date(subscription.lastChargeDate).getFullYear() === currentYr) ||
        (new Date(subscription.lastChargeDate).getUTCMonth() === currentMonthIdx &&
         new Date(subscription.lastChargeDate).getUTCFullYear() === currentYr)
      : false;
    return Boolean(currentMonthTx || isKnownPaid);
  }, [currentMonthTx, subscription.lastChargeDate, currentMonthIdx, currentYr]);

  // Geração dos nós da Linha do Tempo (5 meses: -2, -1, atual, +1, +2)
  const timelineMonths = useMemo(() => {
    const current = new Date();
    const currentMonthIndex = current.getMonth();
    const currentYear = current.getFullYear();

    const months: Array<{
      monthIndex: number;
      year: number;
      shortLabel: string;
      fullLabel: string;
      isCurrent: boolean;
      isPast: boolean;
      isFuture: boolean;
      isPaid: boolean;
    }> = [];

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    for (let offset = -2; offset <= 2; offset++) {
      const d = new Date(currentYear, currentMonthIndex + offset, 1);
      const mIdx = d.getMonth();
      const yr = d.getFullYear();

      // Checar se houve pagamento correspondente neste mês
      const hasPaid = similarTransactions.some(t => {
        const td = new Date(t.date);
        return td.getMonth() === mIdx && td.getFullYear() === yr;
      });

      // Se for o mês da última cobrança conhecida, também marca como pago
      const isKnownPaidMonth = subscription.lastChargeDate
        ? new Date(subscription.lastChargeDate).getMonth() === mIdx &&
          new Date(subscription.lastChargeDate).getFullYear() === yr
        : false;

      const isPaid = hasPaid || isKnownPaidMonth;
      const isCurrent = offset === 0;
      const isPast = offset < 0;
      const isFuture = offset > 0;

      months.push({
        monthIndex: mIdx,
        year: yr,
        shortLabel: monthNames[mIdx],
        fullLabel: `${monthNames[mIdx]} ${yr}`,
        isCurrent,
        isPast,
        isFuture,
        isPaid,
      });
    }

    return months;
  }, [similarTransactions, subscription]);

  // Contagem de meses confirmados como pagos na linha do tempo
  const paidMonthsCount = useMemo(() => {
    return timelineMonths.filter(m => (m.isPast || m.isCurrent) && m.isPaid).length;
  }, [timelineMonths]);

  // Total real já gasto no histórico (soma de transações reais semelhantes ou meses confirmados como pagos na linha do tempo)
  const realSpentAmount = useMemo(() => {
    const fromTxs = similarTransactions.reduce((acc, t) => acc + t.amount, 0);
    const fromTimeline = paidMonthsCount * subscription.amount;
    return Math.max(fromTxs, fromTimeline);
  }, [similarTransactions, paidMonthsCount, subscription.amount]);

  // Custo previsto para 12 meses
  const projectedAnnualCost = useMemo(() => {
    return subscription.cadence === 'yearly' ? subscription.amount : subscription.amount * 12;
  }, [subscription]);

  const hasPriceChange = useMemo(() => {
    if (!subscription.previousAmount) return false;
    const prev = Number(subscription.previousAmount);
    const curr = Number(subscription.amount);
    if (isNaN(prev) || isNaN(curr) || Math.abs(prev - curr) < 0.05) return false;

    // Se houver data de registro do reajuste, a sinalização expira após 60 dias (2 ciclos mensais)
    if (subscription.priceChangedAt) {
      const changeTime = new Date(subscription.priceChangedAt).getTime();
      const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
      if (!isNaN(changeTime) && Date.now() - changeTime > sixtyDaysMs) {
        return false;
      }
    }
    return true;
  }, [subscription.previousAmount, subscription.amount, subscription.priceChangedAt]);

  // Mensagem conversacional sem jargões (conforme designer.md)
  const insightMessage = useMemo(() => {
    if (hasPriceChange && subscription.previousAmount) {
      return `Identificamos um reajuste recente de ${maskValue(formatBrlCurrency(Number(subscription.previousAmount)))} para ${maskValue(formatBrlCurrency(subscription.amount))}. O custo anual previsto é de ${maskValue(formatBrlCurrency(projectedAnnualCost))}.`;
    }
    if (realSpentAmount <= 0) {
      return `Essa assinatura representará ${maskValue(formatBrlCurrency(projectedAnnualCost))} por ano no seu orçamento.`;
    }
    const effectiveCount = Math.max(similarTransactions.length, paidMonthsCount);
    if (effectiveCount >= 12) {
      return `Você gastou ${maskValue(formatBrlCurrency(realSpentAmount))} nos últimos 12 meses mantendo essa assinatura.`;
    }
    return `Você já gastou ${maskValue(formatBrlCurrency(realSpentAmount))} com essa assinatura até agora. O custo previsto para 12 meses é de ${maskValue(formatBrlCurrency(projectedAnnualCost))}.`;
  }, [hasPriceChange, subscription.previousAmount, subscription.amount, realSpentAmount, similarTransactions.length, paidMonthsCount, projectedAnnualCost, isPrivacyMode]);

  // Helper seguro para formatar data de transação sem desvio de fuso horário
  const formatTxDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
      }
      return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  // Cálculo unificado e seguro do dia da cobrança
  const billingDay = useMemo(() => {
    return getSubscriptionBillingDay(subscription);
  }, [subscription.dayOfMonth, subscription.lastChargeDate, subscription.nextBillingDate]);

  const isCreditCard = account?.type === 'credit_card';
  const isCurrentMonth = now.getMonth() === currentMonthIdx && now.getFullYear() === currentYr;
  const isPastDue = isCurrentMonth && now.getDate() > billingDay && !isPaidThisMonth;
  const isTodayDue = isCurrentMonth && now.getDate() === billingDay && !isPaidThisMonth;
  const daysOverdue = isPastDue ? now.getDate() - billingDay : 0;
  const isManualOverdue = isPastDue && !isCreditCard;

  const handleToggleStatus = async () => {
    const nextStatus = subscription.status === 'active' ? 'cancelled' : 'active';
    await saveSubscription({
      ...subscription,
      status: nextStatus,
    });
  };

  const handleDelete = async () => {
    if (confirm(`Deseja realmente remover a assinatura "${subscription.name}"?`)) {
      await deleteSubscription(subscription.id);
      onBack();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        paddingBottom: '40px',
        color: '#FFFFFF',
      }}
    >
      {/* Barra de Navegação Superior Fiel ao Print */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Botão Voltar Circular */}
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
        >
          <ChevronLeft size={22} />
        </button>

        {/* Botão Editar */}
        <button
          type="button"
          onClick={() => onEdit(subscription)}
          style={{
            padding: '8px 16px',
            borderRadius: '20px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#FFFFFF',
            fontSize: '0.84rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
        >
          Editar
        </button>
      </div>

      {/* Bloco Hero de Identificação da Assinatura (Design Limpo e Editorial) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Linha Superior: Logo Oficial + Título e Categoria */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <SubscriptionLogo
            name={subscription.name}
            category={category}
            bankId={account?.bankId || account?.name}
            size={46}
          />

          <div style={{ minWidth: 0, flex: 1 }}>
            <h1
              style={{
                fontSize: '1.45rem',
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-0.025em',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {subscription.name}
            </h1>

            <div style={{ fontSize: '0.84rem', color: '#94A3B8', marginTop: '3px', fontWeight: 500 }}>
              {category?.name || 'Assinatura recorrente'}
            </div>
          </div>
        </div>

        {/* Linha Inferior do Hero: Valor em Destaque Absoluto + Contexto Editorial de Reajuste */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-0.035em',
                lineHeight: 1,
              }}
            >
              {maskValue(formatBrlCurrency(subscription.amount))}
            </span>
            <span style={{ fontSize: '0.92rem', color: '#94A3B8', fontWeight: 500 }}>
              {subscription.cadence === 'yearly' ? '/ano' : '/mês'}
            </span>
          </div>

          {hasPriceChange && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                color: '#94A3B8',
                fontWeight: 500,
                marginTop: '2px',
              }}
            >
              <TrendingUp size={13} strokeWidth={2.4} color="#60A5FA" />
              <span>
                Reajuste recente detectado <span style={{ color: '#CBD5E1', fontWeight: 600 }}>(era {maskValue(formatBrlCurrency(Number(subscription.previousAmount)))})</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card de Status da Cobrança */}
      {subscription.status === 'active' && (
        isCreditCard ? (
          // ASSINATURAS EM CARTÃO DE CRÉDITO: Acabamento Premium Fintech (Padrão Pierre / CloudWalk)
          <div
            style={{
              borderRadius: '18px',
              background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.045) 0%, rgba(255, 255, 255, 0.015) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderTop: '1px solid rgba(255, 255, 255, 0.14)',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.35)',
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '13px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                }}
              >
                {account ? (
                  <BankLogo bankId={account.bankId || account.name} size={24} />
                ) : (
                  <CreditCard size={20} color="#94A3B8" />
                )}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.94rem',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {account?.name || 'Cartão de crédito'}
                  </span>
                  {(account ? Boolean(account.isShared) : Boolean(subscription.isShared)) && (
                    <span
                      title="Cartão compartilhado (Finanças a Dois)"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94A3B8',
                        opacity: 0.85,
                        flexShrink: 0,
                      }}
                    >
                      <Users size={14} strokeWidth={2.2} />
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: '#94A3B8',
                    marginTop: '3px',
                    lineHeight: 1.35,
                    fontWeight: 400,
                  }}
                >
                  {isPaidThisMonth
                    ? (currentMonthTx
                        ? `Lançada em ${formatTxDate(currentMonthTx.date)} • Fatura em dia`
                        : 'Cobrança confirmada neste ciclo')
                    : `Débito todo dia ${billingDay} na fatura`}
                </div>
              </div>
            </div>

            {isPaidThisMonth && (
              <div
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(74, 222, 128, 0.1)',
                  border: '1px solid rgba(74, 222, 128, 0.22)',
                  color: '#4ADE80',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  letterSpacing: '0.01em',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#4ADE80',
                  }}
                />
                <span>Na fatura</span>
              </div>
            )}
          </div>
        ) : (
          // ASSINATURAS MANUAIS (Sem conta / Dinheiro / Boleto): Exige ação manual do usuário
          !isPaidThisMonth ? (
            <div
              style={{
                borderRadius: '16px',
                backgroundColor: '#121418',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: isManualOverdue ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.08)',
                    color: isManualOverdue ? '#F87171' : '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Clock size={18} strokeWidth={2.4} />
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.25 }}>
                    {isManualOverdue
                      ? (daysOverdue === 1 ? 'Venceu ontem' : `Atrasada há ${daysOverdue} dias`)
                      : isTodayDue
                      ? 'Vence hoje'
                      : (!subscription.accountId ? 'Sem conta vinculada' : 'Cobrança em aberto')}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '3px', lineHeight: 1.4 }}>
                    {isManualOverdue
                      ? 'Ainda não foi informado o pagamento'
                      : !subscription.accountId
                      ? 'Nenhuma conta vinculada para esta assinatura'
                      : isTodayDue
                      ? 'Ainda não foi informado o pagamento'
                      : `Vencimento programado para dia ${billingDay}`}
                  </div>
                </div>
              </div>

              {onPaySubscription && (
                <button
                  type="button"
                  onClick={() => onPaySubscription(subscription)}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: '12px',
                    backgroundColor: '#FFFFFF',
                    border: 'none',
                    color: '#0B0F0D',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                >
                  <CheckCircle2 size={16} strokeWidth={2.5} />
                  <span>Informar pagamento</span>
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                borderRadius: '16px',
                backgroundColor: '#121418',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(74, 222, 128, 0.12)',
                    color: '#4ADE80',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Check size={16} strokeWidth={2.6} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#FFFFFF' }}>
                    Pagamento deste mês confirmado
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                    {currentMonthTx 
                      ? `Registrado em ${new Date(currentMonthTx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` 
                      : 'Assinatura em dia'}
                  </div>
                </div>
              </div>

              {onPaySubscription && (
                <button
                  type="button"
                  onClick={() => onPaySubscription(subscription)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: '4px 6px',
                    textDecoration: 'underline',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                >
                  Novo pagamento
                </button>
              )}
            </div>
          )
        )
      )}

      {/* Linha do Tempo Mensal (Timeline) Fiel ao Print Original */}
      <div
        style={{
          padding: '16px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          {timelineMonths.map((item, idx) => {
            const nextItem = timelineMonths[idx + 1];
            const isConnectionPaid = item.isPaid && nextItem && nextItem.isPaid;

            return (
              <React.Fragment key={`node-${item.fullLabel}`}>
                {/* Nó do Mês */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    zIndex: 2,
                  }}
                >
                  {/* Círculo do Nó */}
                  {item.isPaid ? (
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: '#A3E635',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#000000',
                        boxShadow: '0 0 10px rgba(163, 230, 53, 0.4)',
                      }}
                    >
                      <Check size={14} strokeWidth={3} />
                    </div>
                  ) : item.isCurrent ? (
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: '2px solid #FFFFFF',
                        backgroundColor: '#0A0B0D',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#FFFFFF',
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      }}
                    />
                  )}

                  {/* Texto do Mês e Ano */}
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: item.isCurrent || item.isPaid ? 700 : 500,
                        color: item.isCurrent ? '#FFFFFF' : item.isPaid ? '#D1D5DB' : '#6B7280',
                      }}
                    >
                      {item.shortLabel}
                    </div>
                    <div
                      style={{
                        fontSize: '0.66rem',
                        color: item.isCurrent ? '#9CA3AF' : '#4B5563',
                      }}
                    >
                      {item.year}
                    </div>
                  </div>
                </div>

                {/* Linha Conectora entre os Nós */}
                {idx < timelineMonths.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: '2px',
                      backgroundColor: isConnectionPaid ? '#A3E635' : 'transparent',
                      borderTop: isConnectionPaid ? 'none' : '2px dashed rgba(255, 255, 255, 0.18)',
                      margin: '0 4px',
                      marginBottom: '26px',
                      zIndex: 1,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Card de Insight Fiel ao Print (NÃO CITA PIERRE) */}
      <div
        style={{
          borderRadius: '18px',
          backgroundColor: '#121418',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#A3E635' }}>
          <Sparkles size={16} />
          <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>Insight</span>
        </div>
        <p style={{ fontSize: '0.9rem', color: '#E5E7EB', lineHeight: 1.45, margin: 0 }}>
          {insightMessage}
        </p>
      </div>



      {/* Ações de Gestão (Pausar / Excluir) */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
        <button
          type="button"
          onClick={handleToggleStatus}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: subscription.status === 'active' ? '#9CA3AF' : '#A3E635',
            fontSize: '0.86rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)')}
        >
          {subscription.status === 'active' ? (
            <>
              <Pause size={16} />
              <span>Pausar assinatura</span>
            </>
          ) : (
            <>
              <Play size={16} />
              <span>Ativar assinatura</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          style={{
            padding: '12px 18px',
            borderRadius: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#EF4444',
            fontSize: '0.86rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.18)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)')}
        >
          <Trash2 size={16} />
          <span>Excluir</span>
        </button>
      </div>
    </div>
  );
};
