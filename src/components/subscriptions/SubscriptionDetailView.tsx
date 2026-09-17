import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Subscription, Transaction } from '../../core/types';
import { SubscriptionLogo } from './SubscriptionLogo';
import { BankLogo } from '../common/BankLogo';
import { IconRenderer } from '../common/IconRenderer';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Check, 
  Pause, 
  Play, 
  Trash2, 
  Calendar,
  Layers
} from 'lucide-react';

interface SubscriptionDetailViewProps {
  subscription: Subscription;
  onBack: () => void;
  onEdit: (sub: Subscription) => void;
}

export const SubscriptionDetailView: React.FC<SubscriptionDetailViewProps> = ({
  subscription,
  onBack,
  onEdit,
}) => {
  const { transactions, categories, accounts, saveSubscription, deleteSubscription, isPrivacyMode } = useFinance();

  const [isSimilarExpanded, setIsSimilarExpanded] = useState(false);

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
        const tDesc = (t.description || '').toLowerCase();
        return tDesc.includes(normName) || normName.includes(tDesc);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, normName]);

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

  // Formatação por extenso (ex: "Sábado, 15 de agosto de 2026")
  const fullDateFormatted = useMemo(() => {
    const weekday = billingDateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
    const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    const day = billingDateObj.getDate();
    const month = billingDateObj.toLocaleDateString('pt-BR', { month: 'long' });
    const year = billingDateObj.getFullYear();
    return `${capitalizedWeekday}, ${day} de ${month} de ${year}`;
  }, [billingDateObj]);

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

        {/* Botão Editar Transação */}
        <button
          type="button"
          onClick={() => onEdit(subscription)}
          style={{
            padding: '10px 18px',
            borderRadius: '20px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#FFFFFF',
            fontSize: '0.86rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
        >
          Editar transação
        </button>
      </div>

      {/* Bloco Hero de Identificação da Assinatura */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Avatar Grande com Badge do Banco */}
        <div style={{ marginBottom: '4px' }}>
          <SubscriptionLogo
            name={subscription.name}
            category={category}
            bankId={account?.bankId || account?.name}
            size={60}
          />
        </div>

        {/* Nome do Serviço */}
        <h1
          style={{
            fontSize: '1.65rem',
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          {subscription.name}
        </h1>

        {/* Valor em Destaque */}
        <div
          style={{
            fontSize: '1.9rem',
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-0.03em',
          }}
        >
          {maskValue(formatBrlCurrency(subscription.amount))}
        </div>

        {/* Informações de Recorrência */}
        <div style={{ fontSize: '0.92rem', color: '#9CA3AF', marginTop: '2px' }}>
          Assinatura paga todo dia {billingDay}
        </div>
        <div style={{ fontSize: '0.88rem', color: '#6B7280' }}>
          {fullDateFormatted}
        </div>
      </div>

      {/* Card de Transações Similares (Expansível) */}
      <div
        style={{
          borderRadius: '18px',
          backgroundColor: '#121418',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          overflow: 'hidden',
          transition: 'all 0.15s ease',
        }}
      >
        <div
          onClick={() => setIsSimilarExpanded(!isSimilarExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 18px',
            cursor: 'pointer',
          }}
        >
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#FFFFFF' }}>
              Transações similares
            </div>
            <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: '2px' }}>
              {`${similarTransactions.length} ${similarTransactions.length === 1 ? 'transação' : 'transações'}`}
            </div>
          </div>
          <ChevronRight
            size={18}
            color="#9CA3AF"
            style={{
              transform: isSimilarExpanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </div>

        {isSimilarExpanded && (
          <div
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              padding: '10px 18px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {similarTransactions.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: '#6B7280', padding: '6px 0' }}>
                Nenhuma transação anterior vinculada no extrato.
              </div>
            ) : (
              similarTransactions.map(tx => (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.84rem', color: '#FFFFFF', fontWeight: 500 }}>
                      {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>
                      {tx.description}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>
                    {maskValue(formatBrlCurrency(tx.amount))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Linha do Tempo Mensal (Timeline) Fiel ao Print */}
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
              }}
            >
              <BankLogo bankId={account?.bankId || account?.name || 'Inter'} size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', color: '#9CA3AF' }}>Conta</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#FFFFFF' }}>
                {account?.name || 'Não especificada'}
              </div>
            </div>
          </div>
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
