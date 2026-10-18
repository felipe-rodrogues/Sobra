import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Subscription, Transaction } from '../../core/types';
import { SubscriptionLogo } from './SubscriptionLogo';
import { BankLogo } from '../common/BankLogo';
import { IconRenderer } from '../common/IconRenderer';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { SharedBadge } from '../common/SharedBadge';
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
  Ban
} from 'lucide-react';

interface SubscriptionDetailViewProps {
  subscription: Subscription;
  onBack: () => void;
  onEdit: (sub: Subscription) => void;
  onPaySubscription?: (sub: Subscription) => void;
}

export const SubscriptionDetailView: React.FC<SubscriptionDetailViewProps> = ({
  subscription,
  onBack,
  onEdit,
  onPaySubscription,
}) => {
  const { transactions, categories, accounts, saveSubscription, deleteSubscription, isPrivacyMode } = useFinance();

  const category = categories.find(c => c.id === subscription.categoryId);
  const account = subscription.accountId ? accounts.find(a => a.id === subscription.accountId) : null;

  const maskValue = (val: string) => (isPrivacyMode ? '••••••' : val);

  // Normalização do nome para encontrar transações associadas
  const normName = (subscription.name || '').toLowerCase().trim();

  // Transações históricas semelhantes
  const similarTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        if (t.type !== 'expense') return false;
        if (t.subscriptionId && t.subscriptionId === subscription.id) return true;
        const tDesc = (t.description || '').toLowerCase();
        return tDesc.includes(normName) || normName.includes(tDesc);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, normName, subscription.id]);

  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYr = now.getFullYear();

  const currentMonthTx = useMemo(() => {
    return similarTransactions.find(t => {
      const td = new Date(t.date);
      return td.getMonth() === currentMonthIdx && td.getFullYear() === currentYr;
    });
  }, [similarTransactions, currentMonthIdx, currentYr]);

  const isPaidThisMonth = useMemo(() => {
    const isKnownPaid = subscription.lastChargeDate
      ? new Date(subscription.lastChargeDate).getMonth() === currentMonthIdx &&
        new Date(subscription.lastChargeDate).getFullYear() === currentYr
      : false;
    return Boolean(currentMonthTx || isKnownPaid);
  }, [currentMonthTx, subscription.lastChargeDate, currentMonthIdx, currentYr]);

  // Total real já gasto no histórico
  const realSpentAmount = useMemo(() => {
    return similarTransactions.reduce((acc, t) => acc + t.amount, 0);
  }, [similarTransactions]);

  // Custo previsto para 12 meses
  const projectedAnnualCost = useMemo(() => {
    return subscription.cadence === 'yearly' ? subscription.amount : subscription.amount * 12;
  }, [subscription]);

  // Mensagem conversacional sem jargões (conforme designer.md)
  const insightMessage = useMemo(() => {
    if (similarTransactions.length === 0) {
      return `Essa assinatura representará ${maskValue(formatBrlCurrency(projectedAnnualCost))} por ano no seu orçamento.`;
    }
    if (similarTransactions.length >= 12) {
      return `Você gastou ${maskValue(formatBrlCurrency(realSpentAmount))} nos últimos 12 meses mantendo essa assinatura.`;
    }
    return `Você já gastou ${maskValue(formatBrlCurrency(realSpentAmount))} com essa assinatura até agora. O custo previsto para 12 meses é de ${maskValue(formatBrlCurrency(projectedAnnualCost))}.`;
  }, [similarTransactions.length, realSpentAmount, projectedAnnualCost, isPrivacyMode]);

  // Cálculo do dia da cobrança e data por extenso
  const billingDateObj = useMemo(() => {
    if (subscription.lastChargeDate) {
      return new Date(subscription.lastChargeDate);
    }
    if (subscription.nextBillingDate) {
      return new Date(subscription.nextBillingDate);
    }
    return new Date();
  }, [subscription]);

  const billingDay = billingDateObj.getDate();

  const isCreditCard = account?.type === 'credit_card';
  const isCurrentMonth = now.getMonth() === currentMonthIdx && now.getFullYear() === currentYr;
  const isPastDue = isCurrentMonth && now.getDate() > billingDay && !isPaidThisMonth;
  const isTodayDue = isCurrentMonth && now.getDate() === billingDay && !isPaidThisMonth;
  const daysOverdue = isPastDue ? now.getDate() - billingDay : 0;
  const isManualOverdue = isPastDue && !isCreditCard;

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

      {/* Bloco Hero de Identificação da Assinatura (Organização Limpa em 2 Linhas) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Linha Superior: Logo + Título e Recorrência */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <SubscriptionLogo
            name={subscription.name}
            category={category}
            bankId={account?.bankId || account?.name}
            size={46}
          />

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.02em',
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {subscription.name}
              </h1>
              {(account ? Boolean(account.isShared) : Boolean(subscription.isShared)) && <SharedBadge size="sm" />}
            </div>

            <div style={{ fontSize: '0.84rem', color: '#94A3B8', marginTop: '3px', fontWeight: 500 }}>
              Assinatura paga todo dia {billingDay}
            </div>
          </div>
        </div>

        {/* Linha Inferior do Hero: Valor em Destaque Absoluto + Badge de Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '12px',
            paddingTop: '2px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span
              style={{
                fontSize: '2.15rem',
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {maskValue(formatBrlCurrency(subscription.amount))}
            </span>
            <span style={{ fontSize: '0.88rem', color: '#94A3B8', fontWeight: 500 }}>
              {subscription.cadence === 'yearly' ? '/ano' : '/mês'}
            </span>
          </div>

          {/* Badge de status refinada */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '0.74rem',
              fontWeight: 600,
              backgroundColor: isPaidThisMonth
                ? 'rgba(74, 222, 128, 0.12)'
                : isManualOverdue
                ? 'rgba(239, 68, 68, 0.12)'
                : 'rgba(96, 165, 250, 0.12)',
              color: isPaidThisMonth
                ? '#4ADE80'
                : isManualOverdue
                ? '#F87171'
                : '#60A5FA',
              border: `1px solid ${
                isPaidThisMonth
                  ? 'rgba(74, 222, 128, 0.25)'
                  : isManualOverdue
                  ? 'rgba(239, 68, 68, 0.25)'
                  : 'rgba(96, 165, 250, 0.25)'
              }`,
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
            <span>
              {isPaidThisMonth
                ? 'Confirmada'
                : isManualOverdue
                ? (daysOverdue === 1 ? 'Venceu ontem' : `Venceu há ${daysOverdue}d`)
                : isTodayDue
                ? 'Vence hoje'
                : 'Em aberto'}
            </span>
          </div>
        </div>
      </div>

      {/* Card de Status da Cobrança & Ação de Pagamento (Fundo escuro neutro #121418, sem neon, sem amarelo fluorescente) */}
      {subscription.status === 'active' && (
        !isPaidThisMonth ? (
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: isManualOverdue ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.08)',
                  color: isManualOverdue ? '#F87171' : isCreditCard ? '#60A5FA' : '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Clock size={16} strokeWidth={2.4} />
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.3 }}>
                  {isManualOverdue
                    ? (!subscription.accountId ? 'Sem conta vinculada' : 'Pagamento pendente')
                    : isPastDue && isCreditCard
                    ? 'Aguardando no cartão'
                    : isTodayDue
                    ? 'Vence hoje'
                    : (!subscription.accountId ? 'Sem conta vinculada' : 'Cobrança em aberto')}
                </div>
                <div style={{ fontSize: '0.74rem', color: isManualOverdue ? '#F87171' : '#94A3B8', marginTop: '1px' }}>
                  {!subscription.accountId
                    ? 'Nenhuma conta vinculada'
                    : isManualOverdue
                    ? (daysOverdue === 1 ? 'Venceu ontem' : `Venceu há ${daysOverdue} dias`)
                    : isPastDue && isCreditCard
                    ? `Prevista para dia ${billingDay} no ${account?.name}`
                    : `Vencimento todo dia ${billingDay}`}
                </div>
              </div>
            </div>

            {onPaySubscription && (
              <button
                type="button"
                onClick={() => onPaySubscription(subscription)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#FFFFFF',
                  border: 'none',
                  color: '#0B0F0D',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
              >
                <CheckCircle2 size={15} strokeWidth={2.5} />
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
                  Cobrança deste ciclo confirmada
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                  {currentMonthTx 
                    ? `Registrada em ${new Date(currentMonthTx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` 
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

      {/* Linhas de Metadados (Categoria com Editar, Conta) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          marginTop: '6px',
        }}
      >
        {/* Linha: Categoria */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: '16px',
            backgroundColor: '#121418',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: category?.color ? `${category.color}22` : 'rgba(255, 255, 255, 0.08)',
                color: category?.color || '#38BDF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconRenderer name={category?.icon || 'GraduationCap'} size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', color: '#9CA3AF' }}>Categoria</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#FFFFFF' }}>
                {category?.name || 'Não categorizado'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onEdit(subscription)}
            style={{
              padding: '6px 14px',
              borderRadius: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
          >
            Editar
          </button>
        </div>

        {/* Linha: Conta / Cartão */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: '16px',
            backgroundColor: '#121418',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                color: '#9CA3AF',
              }}
            >
              {account ? (
                <BankLogo bankId={account.bankId || account.name} size={24} />
              ) : (
                <Ban size={18} />
              )}
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', color: '#9CA3AF' }}>Conta / Cartão</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 600, color: account ? '#FFFFFF' : '#94A3B8' }}>
                {account?.name || 'Não vinculada'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onEdit(subscription)}
            style={{
              padding: '6px 14px',
              borderRadius: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
          >
            {account ? 'Editar' : 'Vincular'}
          </button>
        </div>
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
