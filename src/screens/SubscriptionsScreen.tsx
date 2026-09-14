import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { IconRenderer } from '../components/common/IconRenderer';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { recurrenceDetector } from '../core/subscriptions/recurrenceDetector';
import { 
  Plus, 
  CalendarClock, 
  Layers, 
  Sparkles, 
  Check, 
  X, 
  Trash2, 
  Edit3, 
  Play, 
  Pause,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Subscription, Category } from '../core/types';

interface SubscriptionsScreenProps {
  onOpenNewSubscription: () => void;
  onEditSubscription: (sub: Subscription) => void;
}

export const SubscriptionsScreen: React.FC<SubscriptionsScreenProps> = ({
  onOpenNewSubscription,
  onEditSubscription,
}) => {
  const { 
    subscriptions, 
    subscriptionSuggestions, 
    transactions, 
    categories, 
    accounts,
    confirmSubscriptionSuggestion,
    dismissSubscriptionSuggestion,
    saveSubscription,
    deleteSubscription,
    isPrivacyMode 
  } = useFinance();
  const { colors } = useTheme();

  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'cancelled'>('all');

  const categoryMap = new Map<string, Category>(categories.map(c => [c.id, c]));
  const accountMap = new Map<string, any>(accounts.map(a => [a.id, a]));

  const maskValue = (formatted: string) => (isPrivacyMode ? '••••••' : formatted);

  // Cálculos de Totais
  const totalMonthlyCost = recurrenceDetector.calculateTotalMonthlyCost(subscriptions);
  const activeSubs = subscriptions.filter(s => s.status === 'active');
  const annualProjection = totalMonthlyCost * 12;

  // Alertas Inteligentes
  const priceChangeAlerts = recurrenceDetector.detectPriceChanges(subscriptions, transactions);
  const categoryOverlaps = recurrenceDetector.detectCategoryOverlaps(subscriptions, categories);

  // Filtragem da Lista de Assinaturas
  const filteredSubscriptions = subscriptions.filter(sub => {
    if (filterStatus === 'all') return true;
    return sub.status === filterStatus;
  });

  const formatDaysUntil = (dateStr: string): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Cobrança hoje';
    if (diffDays === 1) return 'Amanhã';
    if (diffDays < 0) return `Venceu há ${Math.abs(diffDays)} dia${Math.abs(diffDays) === 1 ? '' : 's'}`;
    return `Em ${diffDays} dias`;
  };

  const handleToggleStatus = async (sub: Subscription) => {
    const nextStatus = sub.status === 'active' ? 'cancelled' : 'active';
    await saveSubscription({
      ...sub,
      status: nextStatus,
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Deseja realmente remover a assinatura "${name}"?`)) {
      await deleteSubscription(id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: colors.textPrimary, letterSpacing: '-0.02em' }}>
            Assinaturas & Recorrências
          </h2>
          <p style={{ fontSize: '0.82rem', color: colors.textSecondary }}>
            Monitore serviços recorrentes, detecte cobranças e evite surpresas
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          icon={<Plus size={16} />}
          onClick={onOpenNewSubscription}
        >
          Nova Assinatura
        </Button>
      </div>

      {/* KPI Cards: Resumo de Gastos Recorrentes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
        <Card style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600, marginBottom: '6px' }}>
            Total Gasto por Mês
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: colors.expense }}>
            {maskValue(formatBrlCurrency(totalMonthlyCost))}
          </div>
          <div style={{ fontSize: '0.7rem', color: colors.textSecondary, marginTop: '4px' }}>
            {activeSubs.length} assinatura{activeSubs.length === 1 ? '' : 's'} ativa{activeSubs.length === 1 ? '' : 's'}
          </div>
        </Card>

        <Card style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: colors.textSecondary, fontWeight: 600, marginBottom: '6px' }}>
            Projeção Anual
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: colors.primary }}>
            {maskValue(formatBrlCurrency(annualProjection))}
          </div>
          <div style={{ fontSize: '0.7rem', color: colors.textSecondary, marginTop: '4px' }}>
            Estimativa em 12 meses
          </div>
        </Card>
      </div>

      {/* ALERTA: Reajuste de Valor em Relação à Cobrança Anterior */}
      {priceChangeAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {priceChangeAlerts.map(alert => (
            <div
              key={`alert-price-${alert.subscription.id}`}
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: alert.isIncrease ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                border: `1px solid ${alert.isIncrease ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: alert.isIncrease ? colors.expense : colors.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  flexShrink: 0,
                }}
              >
                {alert.isIncrease ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: colors.textPrimary }}>
                  Alerta de Reajuste: {alert.subscription.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                  O valor {alert.isIncrease ? 'aumentou' : 'diminuiu'} de{' '}
                  <strong>{formatBrlCurrency(alert.previousAmount)}</strong> para{' '}
                  <strong style={{ color: alert.isIncrease ? colors.expense : colors.primary }}>
                    {formatBrlCurrency(alert.currentAmount)}
                  </strong>{' '}
                  ({alert.isIncrease ? '+' : ''}{formatBrlCurrency(alert.difference)} | {alert.percentage}%).
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AVISO: Múltiplas Assinaturas na Mesma Categoria */}
      {categoryOverlaps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {categoryOverlaps.map(overlap => (
            <div
              key={`overlap-${overlap.categoryId}`}
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: overlap.categoryColor || '#F59E0B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  flexShrink: 0,
                }}
              >
                <Layers size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: colors.textPrimary }}>
                  Aviso de Sobreposição: Categoria {overlap.categoryName}
                </div>
                <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                  Você possui <strong>{overlap.subscriptions.length} assinaturas</strong> nesta mesma categoria (
                  {overlap.subscriptions.map(s => `${s.name} - ${formatBrlCurrency(s.amount)}`).join(', ')}
                  ), somando <strong>{formatBrlCurrency(overlap.totalMonthlyAmount)}/mês</strong>.
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SEÇÃO: Sugestões de Assinaturas Detectadas Automaticamente */}
      {subscriptionSuggestions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color={colors.primary} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: colors.textPrimary }}>
              Recorrências Detectadas no seu Histórico ({subscriptionSuggestions.length})
            </h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
            Identificamos despesas semelhantes que se repetem em intervalo regular. Deseja cadastrá-las como assinatura?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {subscriptionSuggestions.map(sugg => {
              const cat = categoryMap.get(sugg.categoryId);

              return (
                <Card
                  key={sugg.id}
                  style={{
                    padding: '14px 16px',
                    border: `1px solid ${colors.primary}`,
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          backgroundColor: cat?.color || colors.primary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF',
                        }}
                      >
                        <IconRenderer name={cat?.icon || 'Repeat'} size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: colors.textPrimary }}>
                          {sugg.merchantName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{cat?.name || 'Geral'}</span>
                          <span>•</span>
                          <span>Detectado a cada ~{sugg.intervalDays} dias ({sugg.cadence === 'monthly' ? 'Mensal' : 'Anual'})</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: colors.expense }}>
                        {formatBrlCurrency(sugg.amount)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: colors.textSecondary }}>
                        Próxima: {new Date(sugg.nextBillingDate).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>

                  {/* Ações da Sugestão */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<X size={14} />}
                      onClick={() => dismissSubscriptionSuggestion(sugg.merchantName)}
                      style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                    >
                      Não é assinatura
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Check size={14} />}
                      onClick={() => confirmSubscriptionSuggestion(sugg)}
                      style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                    >
                      Confirmar como Assinatura
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* SEÇÃO: Lista de Assinaturas Confirmadas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: colors.textPrimary }}>
            Assinaturas Confirmadas ({filteredSubscriptions.length})
          </h3>

          {/* Filtros Ativas / Pausadas */}
          <div style={{ display: 'flex', gap: '4px', backgroundColor: colors.surfaceElevated, padding: '3px', borderRadius: '8px' }}>
            <button
              onClick={() => setFilterStatus('all')}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: filterStatus === 'all' ? colors.surface : 'transparent',
                color: filterStatus === 'all' ? colors.textPrimary : colors.textSecondary,
                border: 'none',
              }}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: filterStatus === 'active' ? colors.surface : 'transparent',
                color: filterStatus === 'active' ? colors.primary : colors.textSecondary,
                border: 'none',
              }}
            >
              Ativas
            </button>
            <button
              onClick={() => setFilterStatus('cancelled')}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: filterStatus === 'cancelled' ? colors.surface : 'transparent',
                color: filterStatus === 'cancelled' ? colors.expense : colors.textSecondary,
                border: 'none',
              }}
            >
              Pausadas
            </button>
          </div>
        </div>

        {filteredSubscriptions.length === 0 ? (
          <Card style={{ padding: '32px', textAlign: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: colors.surfaceElevated,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                color: colors.textSecondary,
              }}
            >
              <CalendarClock size={24} />
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: colors.textPrimary }}>
              Nenhuma assinatura encontrada
            </div>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, marginTop: '4px', maxWidth: '300px', margin: '4px auto 14px' }}>
              Adicione suas assinaturas manualmente ou aguarde a detecção automática conforme você cadastra transações.
            </p>
            <Button size="sm" variant="primary" icon={<Plus size={16} />} onClick={onOpenNewSubscription}>
              Adicionar Primeira Assinatura
            </Button>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredSubscriptions.map(sub => {
              const cat = categoryMap.get(sub.categoryId);
              const acc = sub.accountId ? accountMap.get(sub.accountId) : null;
              const isActive = sub.status === 'active';
              const daysUntilText = formatDaysUntil(sub.nextBillingDate);

              return (
                <Card
                  key={sub.id}
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    opacity: isActive ? 1 : 0.65,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  {/* Ícone e Detalhes da Assinatura */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        backgroundColor: cat?.color || colors.primary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        flexShrink: 0,
                      }}
                    >
                      <IconRenderer name={cat?.icon || 'Repeat'} size={22} />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sub.name}
                        </span>
                        <Badge variant={sub.cadence === 'monthly' ? 'primary' : 'neutral'} size="sm">
                          {sub.cadence === 'monthly' ? 'Mensal' : 'Anual'}
                        </Badge>
                        {!isActive && (
                          <Badge variant="neutral" size="sm">
                            Pausada
                          </Badge>
                        )}
                      </div>

                      <div style={{ fontSize: '0.75rem', color: colors.textSecondary, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>{cat?.name || 'Geral'}</span>
                        {acc && (
                          <>
                            <span>•</span>
                            <span>{acc.name}</span>
                          </>
                        )}
                        <span>•</span>
                        <span style={{ color: colors.primary, fontWeight: 600 }}>
                          {daysUntilText} ({new Date(sub.nextBillingDate).toLocaleDateString('pt-BR')})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Valor e Ações */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: colors.expense }}>
                        {maskValue(formatBrlCurrency(sub.amount))}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: colors.textSecondary }}>
                        {sub.cadence === 'monthly' ? '/mês' : '/ano'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => handleToggleStatus(sub)}
                        title={isActive ? 'Pausar assinatura' : 'Ativar assinatura'}
                        style={{
                          padding: '6px',
                          borderRadius: '8px',
                          backgroundColor: colors.surfaceElevated,
                          color: isActive ? colors.textSecondary : colors.primary,
                          border: `1px solid ${colors.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isActive ? <Pause size={14} /> : <Play size={14} />}
                      </button>

                      <button
                        onClick={() => onEditSubscription(sub)}
                        title="Editar assinatura"
                        style={{
                          padding: '6px',
                          borderRadius: '8px',
                          backgroundColor: colors.surfaceElevated,
                          color: colors.textSecondary,
                          border: `1px solid ${colors.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Edit3 size={14} />
                      </button>

                      <button
                        onClick={() => handleDelete(sub.id, sub.name)}
                        title="Excluir assinatura"
                        style={{
                          padding: '6px',
                          borderRadius: '8px',
                          backgroundColor: colors.surfaceElevated,
                          color: colors.expense,
                          border: `1px solid ${colors.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
