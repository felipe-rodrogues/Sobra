import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFinance } from '../context/FinanceContext';
import { BurnRateProjection, calculateSafeToSpendBudget } from '../core/calculations';
import { formatBrlCurrency, parseBrlCurrency } from '../core/parsers/currencyHelper';
import { SwipeBackView } from '../components/common/SwipeBackView';
import { 
  ArrowLeft,
  Zap,
  Scale,
  Check,
  Trash2,
  Sparkles,
  Target,
  Plus,
  PiggyBank,
  Home,
  ArrowLeftRight,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Repeat,
} from 'lucide-react';

export interface DailySpendingGoal {
  mode: 'suggested' | 'target_sobra' | 'custom_daily' | 'goal_linked';
  dailyAmount: number;
  targetSobraAmount?: number;
  savedAt: string;
  month: number;
  year: number;
  savedAsAppGoal?: boolean;
  linkedGoalIds?: string[];
  cadence?: 'daily' | 'weekly';
  selectedPreset?: 'preset1' | 'preset2' | null;
  savingsPercent?: number | null;
  baselineWeeklyAmount?: number;
  committedInstallmentsAmount?: number;
  committedSubscriptionsAmount?: number;
  explanationNote?: string;
}

interface DailyBudgetGoalScreenProps {
  onBack: () => void;
  projection: BurnRateProjection;
  currentGoal?: DailySpendingGoal | null;
  onSaveGoalConfig: (goal: DailySpendingGoal) => void;
  onRemoveGoalConfig?: () => void;
  onOpenAiChat?: (prompt?: string) => void;
  onCreateGoal?: () => void;
  initialCadence?: 'daily' | 'weekly';
}

export const DailyBudgetGoalScreen: React.FC<DailyBudgetGoalScreenProps> = ({
  onBack,
  projection,
  currentGoal,
  onSaveGoalConfig,
  onRemoveGoalConfig,
  onOpenAiChat,
  onCreateGoal,
  initialCadence = 'weekly',
}) => {
  const { saveGoal, goals, transactions, accounts, subscriptions, activeInstallmentGroups } = useFinance();

  const now = new Date();
  const monthNameRaw = now.toLocaleDateString('pt-BR', { month: 'long' });
  const monthName = monthNameRaw.charAt(0).toUpperCase() + monthNameRaw.slice(1);

  // Metas ativas com prazo (exclui autorreferência de tetos diários anteriores)
  const goalsWithDeadline = useMemo(() => {
    return (goals || [])
      .filter(g => 
        !g.isCompleted && 
        g.targetDate && 
        g.targetDate.trim().length > 0 &&
        !g.name.toLowerCase().startsWith('teto diário')
      )
      .map(g => {
        const targetDateObj = new Date(g.targetDate! + 'T23:59:59');
        const diffMs = targetDateObj.getTime() - Date.now();
        const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        const remainingAmount = Math.max(0, g.targetAmount - g.currentAmount);
        const dailyNeeded = remainingAmount / daysRemaining;
        return {
          ...g,
          daysRemaining,
          remainingAmount,
          dailyNeeded,
        };
      });
  }, [goals]);

  // Cadência escolhida: herda da sessão de inspeção/planejamento ou padrão semanal
  const [cadence, setCadence] = useState<'daily' | 'weekly'>(initialCadence || 'weekly');

  useEffect(() => {
    if (initialCadence) {
      setCadence(initialCadence);
    }
  }, [initialCadence]);

  // Metas com prazo selecionadas
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>(currentGoal?.linkedGoalIds || []);

  const totalGoalsDaily = useMemo(() => {
    return goalsWithDeadline
      .filter(g => selectedGoalIds.includes(g.id))
      .reduce((acc, g) => acc + g.dailyNeeded, 0);
  }, [goalsWithDeadline, selectedGoalIds]);

  // Estado de Porcentagem de Economia (Baseline padrão de 10% com fallback seguro)
  const [savingsPercent, setSavingsPercent] = useState<number>(() => {
    if (currentGoal?.savingsPercent !== undefined && currentGoal.savingsPercent !== null) {
      return currentGoal.savingsPercent;
    }
    if (currentGoal?.selectedPreset === 'preset2') {
      return 0;
    }
    return 10;
  });

  // Estado de controle de edição e expansão
  const [isModified, setIsModified] = useState<boolean>(false);
  const [isCommittedExpanded, setIsCommittedExpanded] = useState<boolean>(false);

  // ── MOTOR SAFE-TO-SPEND (Cálculo Preciso com Parcelas e Cartões Conjuntos) ──
  const safeToSpend = useMemo(() => {
    return calculateSafeToSpendBudget({
      transactions: transactions || [],
      accounts: accounts || [],
      subscriptions: subscriptions || [],
      activeInstallmentGroups: activeInstallmentGroups || [],
      referenceDate: now,
      savingsPercent,
      goalsDailyNeeded: totalGoalsDaily,
      overrideIncome: projection.currentIncome > 0 ? projection.currentIncome : undefined,
      baselineGoal: currentGoal,
    });
  }, [transactions, accounts, subscriptions, activeInstallmentGroups, savingsPercent, totalGoalsDaily, projection.currentIncome, currentGoal]);

  const monthlyIncome = safeToSpend.monthlyIncome;
  const remainingDays = safeToSpend.remainingDays;
  const cadenceSuffix = cadence === 'weekly' ? '/sem' : '/dia';

  // Semântica de cores refinada (Pierre):
  // Parcelas de cartão são deduções e não dinheiro ganho, logo usam Laranja/Âmbar (#FB923C).
  // Se o comprometimento for crítico (> 50% da renda), escala para Coral/Vermelho (#FB7185).
  const commitmentRatio = monthlyIncome > 0 ? safeToSpend.committedTotal / monthlyIncome : 0;
  const installmentColor = commitmentRatio > 0.5 ? '#FB7185' : '#FB923C';
  const subscriptionColor = '#64748B';

  const hasInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    if (initialCadence) {
      setCadence(initialCadence);
    } else {
      const isWeekly = currentGoal?.cadence ? currentGoal.cadence === 'weekly' : true;
      setCadence(isWeekly ? 'weekly' : 'daily');
    }

    if (currentGoal?.linkedGoalIds && currentGoal.linkedGoalIds.length > 0) {
      setSelectedGoalIds(currentGoal.linkedGoalIds);
    }

    if (currentGoal?.savingsPercent !== undefined && currentGoal.savingsPercent !== null) {
      setSavingsPercent(currentGoal.savingsPercent);
    } else if (currentGoal?.selectedPreset === 'preset2') {
      setSavingsPercent(0);
    }
  }, [currentGoal, initialCadence]);

  // Seleção de porcentagem de economia (slider de 0% a 30%)
  const handleSelectSavingsPercent = (percent: number) => {
    setSavingsPercent(percent);
    setIsModified(true);
  };

  // Conversão de Cadência (Diário <-> Semanal)
  const handleCadenceChange = (newCadence: 'daily' | 'weekly') => {
    if (newCadence === cadence) return;
    setCadence(newCadence);
    setIsModified(true);
  };

  // Valor ativo (limite na cadência atual calculado reativamente a partir do Safe-to-Spend)
  const activeAmount = cadence === 'weekly' ? safeToSpend.weeklySafeBudget : safeToSpend.dailySafeBudget;
  const effectiveDailyRate = safeToSpend.dailySafeBudget;
  const burnRateInCadence = cadence === 'weekly' ? safeToSpend.actualWeeklyBurnRate : safeToSpend.actualDailyBurnRate;
  const calculatedSobra = safeToSpend.projectedSobra;
  const totalGoalsActive = cadence === 'weekly' ? totalGoalsDaily * 7 : totalGoalsDaily;
  const totalGoalsForRestOfMonth = totalGoalsDaily * remainingDays;

  // Formatação com separadores de milhar (ex: "2.100,00")
  const formattedAmountNumber = useMemo(() => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(activeAmount);
  }, [activeAmount]);

  // Formatação serena e matematicamente precisa do tempo restante
  const remainingTimeText = useMemo(() => {
    if (cadence === 'weekly' && remainingDays % 7 === 0) {
      const weeks = remainingDays / 7;
      return weeks === 1 ? 'Resta 1 semana no mês' : `Restam ${weeks} semanas no mês`;
    }
    return remainingDays === 1 ? 'Resta 1 dia no mês' : `Restam ${remainingDays} dias no mês`;
  }, [cadence, remainingDays]);

  // Toggle de cada meta com prazo
  const handleToggleGoal = (goalId: string) => {
    const isSelected = selectedGoalIds.includes(goalId);
    const newSelected = isSelected
      ? selectedGoalIds.filter(id => id !== goalId)
      : [...selectedGoalIds, goalId];

    setSelectedGoalIds(newSelected);
    setIsModified(true);
  };

  const handleSave = async () => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const goalData: DailySpendingGoal = {
      mode: selectedGoalIds.length > 0 ? 'goal_linked' : 'suggested',
      dailyAmount: Math.round(effectiveDailyRate * 100) / 100,
      targetSobraAmount: calculatedSobra > 0 ? calculatedSobra : undefined,
      savedAt: new Date().toISOString(),
      month,
      year,
      savedAsAppGoal: false,
      linkedGoalIds: selectedGoalIds.length > 0 ? selectedGoalIds : undefined,
      cadence,
      selectedPreset: savingsPercent === 0 ? 'preset2' : savingsPercent === 10 ? 'preset1' : null,
      savingsPercent,
      baselineWeeklyAmount: safeToSpend.weeklySafeBudget,
      committedInstallmentsAmount: safeToSpend.committedInstallmentsTotal,
      committedSubscriptionsAmount: safeToSpend.committedSubscriptionsTotal,
      explanationNote: safeToSpend.explanation.reasonText,
    };

    onSaveGoalConfig(goalData);
    onBack();
  };

  const handleOpenSobiHelp = () => {
    onBack();
    if (onOpenAiChat) {
      const prompt = `Olá Sobra AI! Estou planejando um limite de gastos de ${formatBrlCurrency(activeAmount)}${cadenceSuffix} para os próximos ${safeToSpend.remainingDays} dias.
- Renda considerada: ${formatBrlCurrency(safeToSpend.monthlyIncome)}
- Dinheiro já comprometido com parcelas de cartões e fixos: ${formatBrlCurrency(safeToSpend.committedTotal)} (Parcelas: ${formatBrlCurrency(safeToSpend.committedInstallmentsTotal)}, Assinaturas: ${formatBrlCurrency(safeToSpend.committedSubscriptionsTotal)})
- Meu gasto médio real de consumo até hoje: ${formatBrlCurrency(burnRateInCadence)}${cadenceSuffix}
- Sobra estimada com esse limite: ${formatBrlCurrency(calculatedSobra)}${savingsPercent !== null ? ` (objetivo de poupar ${savingsPercent}% da renda)` : ''}

Quais recomendações práticas você me dá para manter meu consumo dentro desse limite com tranquilidade?`;
      onOpenAiChat(prompt);
    }
  };


  return (
    <SwipeBackView onBack={onBack} enabled={!!onBack}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '4px 0 96px',
          maxWidth: '440px',
          margin: '0 auto',
          boxSizing: 'border-box',
          width: '100%',
        }}
      >
        {/* ── 1. HEADER (ESTILO PIERRE / FLUXO DE CAIXA) ───────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '2px 0',
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: '#181E1A',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <ArrowLeft size={19} strokeWidth={2.2} />
          </button>

          <h2
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 700,
              color: '#FFFFFF',
              fontFamily: "'Outfit', 'Inter', sans-serif",
            }}
          >
            Limite de Gastos
          </h2>

          {isModified ? (
            <button
              type="button"
              onClick={handleSave}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#08090A',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)',
                transition: 'transform 0.15s ease',
              }}
              title="Salvar alterações"
              aria-label="Salvar alterações"
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <Check size={20} strokeWidth={3} color="#08090A" />
            </button>
          ) : (
            <div style={{ width: '38px' }} />
          )}
        </div>


        {/* ── 2. HERO: VALOR PRINCIPAL DO LIMITE (ESTILO PIERRE) ──────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '2px 0' }}>
          {/* Topo do Hero: Indicador de Cadência + Renda Considerada */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleCadenceChange(cadence === 'weekly' ? 'daily' : 'weekly')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.09)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
              title="Alternar entre limite semanal e diário"
            >
              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#94A3B8', letterSpacing: '-0.01em' }}>
                {cadence === 'weekly' ? 'Limite Semanal' : 'Limite Diário'}
              </span>
              <ArrowLeftRight size={11} color="#64748B" />
            </button>

            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
              <span style={{ fontSize: '0.74rem', color: '#8E8E93', fontWeight: 500 }}>
                Renda considerada: <strong style={{ color: '#CBD5E1', fontWeight: 600 }}>{formatBrlCurrency(monthlyIncome)}</strong>
              </span>
              {safeToSpend.committedTotal > 0 && (
                <span style={{ fontSize: '0.69rem', color: '#94A3B8' }}>
                  Renda livre no mês: <strong style={{ color: '#10B981', fontWeight: 600 }}>{formatBrlCurrency(Math.max(0, monthlyIncome - safeToSpend.committedTotal))}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Valor Principal Imponente */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: '6px',
              margin: '2px 0',
              width: 'fit-content',
            }}
          >
            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#64748B' }}>
              R$
            </span>

            <span
              style={{
                fontSize: '2.8rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1,
                color: '#FFFFFF',
                fontFamily: "'Outfit', 'Inter', sans-serif",
              }}
            >
              {formattedAmountNumber}
            </span>

            <span style={{ fontSize: '1.05rem', color: '#94A3B8', fontWeight: 600, marginLeft: '2px' }}>
              {cadenceSuffix}
            </span>
          </div>

          {/* Contexto Sereno em uma linha fluida */}
          <div style={{ fontSize: '0.78rem', color: '#8E8E93', lineHeight: 1.4 }}>
            Ritmo médio real: <span style={{ color: '#CBD5E1', fontWeight: 600 }}>{formatBrlCurrency(burnRateInCadence)}{cadenceSuffix}</span> · {remainingTimeText}
          </div>
        </div>

        {/* ── 2. CARD NOBRE INTEGRADO: DINHEIRO COMPROMETIDO (PADRÃO PIERRE) ── */}
        <div
          style={{
            backgroundColor: '#121614',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Topo: Identificação + Valor Total sem quebras */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CreditCard size={16} color="#CBD5E1" strokeWidth={2.2} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '0.88rem',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Dinheiro comprometido
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: safeToSpend.explanation.direction === 'decreased'
                      ? '#FB7185'
                      : safeToSpend.explanation.direction === 'increased'
                        ? '#10B981'
                        : '#8E8E93',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {safeToSpend.explanation.primaryCause === 'stable'
                    ? 'Protegido de parcelas e fixos'
                    : safeToSpend.explanation.reasonText}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '8px' }}>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {formatBrlCurrency(safeToSpend.committedTotal)}
              </div>
              {safeToSpend.monthlyIncome > 0 && safeToSpend.committedTotal > 0 && (
                <div
                  style={{
                    fontSize: '0.69rem',
                    color: commitmentRatio > 0.5 ? '#FB7185' : '#8E8E93',
                    marginTop: '2px',
                    fontWeight: commitmentRatio > 0.5 ? 600 : 500,
                  }}
                >
                  {Math.round(commitmentRatio * 100)}% da renda
                </div>
              )}
            </div>
          </div>

          {/* Barra de Proporção Fina e Minimalista (Estilo Linear / Apple Wallet) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {safeToSpend.committedTotal > 0 && (
              <div
                style={{
                  display: 'flex',
                  height: '4px',
                  width: '100%',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, (safeToSpend.committedInstallmentsTotal / safeToSpend.committedTotal) * 100)}%`,
                    backgroundColor: installmentColor,
                    borderRadius: '9999px',
                  }}
                />
                <div
                  style={{
                    width: `${Math.min(100, (safeToSpend.committedSubscriptionsTotal / safeToSpend.committedTotal) * 100)}%`,
                    backgroundColor: subscriptionColor,
                    borderRadius: '9999px',
                  }}
                />
              </div>
            )}

            {/* Breakdown Elegante em Linhas Dedicadas (100% Imune a Quebras e Cruzamentos) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: installmentColor, flexShrink: 0 }} />
                  <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>Parcelas:</span>
                  {safeToSpend.committedTotal > 0 && (
                    <span style={{ color: '#64748B', fontSize: '0.7rem' }}>
                      ({Math.round((safeToSpend.committedInstallmentsTotal / safeToSpend.committedTotal) * 100)}%)
                    </span>
                  )}
                </div>
                <strong style={{ color: '#FFFFFF', fontWeight: 600, fontSize: '0.8rem' }}>
                  {formatBrlCurrency(safeToSpend.committedInstallmentsTotal)}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: subscriptionColor, flexShrink: 0 }} />
                  <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>Assinaturas &amp; Fixos:</span>
                  {safeToSpend.committedTotal > 0 && (
                    <span style={{ color: '#64748B', fontSize: '0.7rem' }}>
                      ({Math.round((safeToSpend.committedSubscriptionsTotal / safeToSpend.committedTotal) * 100)}%)
                    </span>
                  )}
                </div>
                <strong style={{ color: '#FFFFFF', fontWeight: 600, fontSize: '0.8rem' }}>
                  {formatBrlCurrency(safeToSpend.committedSubscriptionsTotal)}
                </strong>
              </div>
            </div>
          </div>

          {/* Accordion Minimalista com Scroll Interno (Nunca corta nem empurra o layout) */}
          {safeToSpend.committedItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '2px' }}>
              <button
                type="button"
                onClick={() => setIsCommittedExpanded(!isCommittedExpanded)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '0.74rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '6px 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
              >
                <span>
                  {isCommittedExpanded
                    ? 'Ocultar detalhes'
                    : `Ver ${safeToSpend.committedItems.length} ${safeToSpend.committedItems.length === 1 ? 'compromisso detalhado' : 'compromissos detalhados'}`}
                </span>
                {isCommittedExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {isCommittedExpanded && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    paddingTop: '8px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    scrollbarWidth: 'thin',
                    paddingRight: '4px',
                  }}
                >
                  {safeToSpend.committedItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        borderBottom: idx === safeToSpend.committedItems.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, flex: 1, paddingRight: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#E2E8F0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', color: '#64748B' }}>
                          <span>{item.type === 'installment' ? 'Parcela' : 'Assinatura'}</span>
                          {item.isShared && (
                            <span style={{ color: '#F59E0B', fontWeight: 600 }}>
                              • Cota {Math.round(item.userShareRatio * 100)}%
                            </span>
                          )}
                          {item.accountName && <span>• {item.accountName}</span>}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#F1F5F9', whiteSpace: 'nowrap' }}>
                          {formatBrlCurrency(item.userAmount)}
                        </span>
                        {item.isShared && item.userShareRatio !== 1.0 && (
                          <div style={{ fontSize: '0.64rem', color: '#64748B', whiteSpace: 'nowrap' }}>
                            de {formatBrlCurrency(item.fullAmount)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 3. CARD INTEGRADO: SOBRA ESTIMADA & OBJETIVO DE ECONOMIA ──────── */}
        <div
          style={{
            backgroundColor: '#121614',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Topo do Card: Sobra Estimada com respiro total (Título limpo + Valor amplo empilhado) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <PiggyBank size={15} color="#CBD5E1" strokeWidth={2.2} />
              </div>
              <span
                style={{
                  fontSize: '0.84rem',
                  color: '#94A3B8',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                Sobra estimada no fim do mês
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: '2px' }}>
              <span
                style={{
                  fontSize: '1.85rem',
                  fontWeight: 800,
                  color: calculatedSobra >= 0 ? '#10B981' : '#FB7185',
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                }}
              >
                {calculatedSobra >= 0 ? '+' : ''}{formatBrlCurrency(calculatedSobra)}
              </span>
            </div>
          </div>

          {/* Controle do Slider: Objetivo de Economia (Livre de aperto) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 500 }}>
                Objetivo de economia: <strong style={{ color: '#10B981', fontWeight: 700 }}>{`${savingsPercent}%`}</strong>
              </span>
            </div>

            {/* Barra do Slider com Marcadores Táteis */}
            <div style={{ position: 'relative', width: '100%', padding: '4px 0 2px' }}>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={savingsPercent}
                onChange={e => handleSelectSavingsPercent(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  accentColor: '#10B981',
                  cursor: 'pointer',
                  height: '6px',
                  backgroundColor: '#1E2420',
                  borderRadius: '4px',
                  display: 'block',
                  margin: 0,
                }}
              />

              {/* Pips / Notches na barra nos marcos 10% e 20% */}
              <div
                style={{
                  position: 'absolute',
                  top: '7px',
                  left: `${(10 / 30) * 100}%`,
                  width: '2px',
                  height: '6px',
                  backgroundColor: savingsPercent >= 10 ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.25)',
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                  borderRadius: '1px',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '7px',
                  left: `${(20 / 30) * 100}%`,
                  width: '2px',
                  height: '6px',
                  backgroundColor: savingsPercent >= 20 ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.25)',
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                  borderRadius: '1px',
                }}
              />
            </div>

            {/* Números Puros sob cada marco (0%, 10%, 20%, 30%) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 2px' }}>
              {[0, 10, 20, 30].map(val => {
                const isSelected = savingsPercent === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSelectSavingsPercent(val)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px 4px',
                      cursor: 'pointer',
                      color: isSelected ? '#10B981' : '#64748B',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 700 : 500,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {`${val}%`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Explicação Conversacional Dinâmica (Estilo Pierre) */}
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.45 }}>
              {savingsPercent !== null && savingsPercent > 0 ? (
                <>
                  Guardando <strong style={{ color: '#FFFFFF' }}>{`${savingsPercent}%`}</strong> da renda ({formatBrlCurrency(Math.round(monthlyIncome * (savingsPercent / 100)))}{savingsPercent === 10 ? ' · Reserva básica' : savingsPercent === 20 ? ' · Meta sólida' : savingsPercent === 30 ? ' · Ritmo acelerado' : ''}), você pode gastar até <strong style={{ color: '#FFFFFF' }}>{formatBrlCurrency(activeAmount)}{cadenceSuffix}</strong>.
                </>
              ) : savingsPercent === 0 ? (
                <>
                  Você pode gastar até <strong style={{ color: '#FFFFFF' }}>{formatBrlCurrency(activeAmount)}{cadenceSuffix}</strong> para fechar as contas em equilíbrio, sem guardar reserva.
                </>
              ) : (
                <>
                  Com o limite de <strong style={{ color: '#FFFFFF' }}>{formatBrlCurrency(activeAmount)}{cadenceSuffix}</strong>, a sobra estimada ao final do mês será de <strong style={{ color: calculatedSobra >= 0 ? '#10B981' : '#FB7185' }}>{formatBrlCurrency(calculatedSobra)}</strong>.
                </>
              )}
            </p>
          </div>
        </div>

        {/* ── 5. METAS COM PRAZO (MESMO PADRÃO LIMPO DA SOBRA ESTIMADA) ── */}
        <div
          style={{
            backgroundColor: '#121614',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '14px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {/* Cabeçalho do Card */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            {/* Lado esquerdo: ícone + título */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Target size={15} color="#CBD5E1" strokeWidth={2.2} />
              </div>
              <span
                style={{
                  fontSize: '0.84rem',
                  color: '#94A3B8',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                Metas com prazo
              </span>
            </div>

            {/* Lado direito: apenas o botão + Nova */}
            {onCreateGoal && (
              <button
                type="button"
                onClick={onCreateGoal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#94A3B8',
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#FFFFFF';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = '#94A3B8';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                }}
              >
                <Plus size={12} strokeWidth={2.4} />
                <span>Nova</span>
              </button>
            )}
          </div>

          {/* Conteúdo: Lista ou Estado Vazio */}
          {goalsWithDeadline.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '4px' }}>
              {goalsWithDeadline.map((g, index) => {
                const isSelected = selectedGoalIds.includes(g.id);
                const isLast = index === goalsWithDeadline.length - 1;
                const goalNeeded = cadence === 'weekly' ? g.dailyNeeded * 7 : g.dailyNeeded;
                const goalNeededMonthly = Math.round(g.dailyNeeded * 30 * 100) / 100;

                return (
                  <div
                    key={g.id}
                    onClick={() => handleToggleGoal(g.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 2px',
                      borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '5px',
                          border: isSelected ? 'none' : '1.5px solid rgba(255, 255, 255, 0.2)',
                          backgroundColor: isSelected ? '#10B981' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected && <Check size={12} color="#08090A" strokeWidth={3} />}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '0.86rem',
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? '#FFFFFF' : '#D1D5DB',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {g.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '1px' }}>
                          {g.daysRemaining} {g.daysRemaining === 1 ? 'dia restante' : 'dias restantes'}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 600, color: isSelected ? '#10B981' : '#E2E8F0' }}>
                        {formatBrlCurrency(goalNeeded)}
                        <span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#64748B' }}>{cadenceSuffix}</span>
                      </div>
                      <div style={{ fontSize: '0.66rem', color: '#64748B', marginTop: '1px' }}>
                        ≈ {formatBrlCurrency(goalNeededMonthly)}/mês
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.45 }}>
              Nenhuma meta vinculada. Reserve cotas para objetivos futuros automaticamente no seu limite de gastos.
            </p>
          )}

          {/* Rodapé sutil: resumo de impacto no limite — só aparece quando há metas selecionadas */}
          {selectedGoalIds.length > 0 && (
            <div
              style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                paddingTop: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '0.69rem', color: '#475569', fontWeight: 400 }}>
                {selectedGoalIds.length} {selectedGoalIds.length === 1 ? 'meta selecionada' : 'metas selecionadas'} •
              </span>
              <span style={{ fontSize: '0.69rem', color: '#64748B', fontWeight: 600 }}>
                {formatBrlCurrency(totalGoalsActive)}{cadenceSuffix}
              </span>
            </div>
          )}
        </div>

        {/* ── 6. AÇÕES FINAIS (PIERRE STYLE) ────────────────────────── */}
        {onOpenAiChat && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4px' }}>
            <button
              type="button"
              onClick={handleOpenSobiHelp}
              style={{
                background: 'none',
                border: 'none',
                color: '#8E8E93',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: 'pointer',
                padding: '6px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
              onMouseLeave={e => (e.currentTarget.style.color = '#8E8E93')}
            >
              <Sparkles size={16} strokeWidth={2.2} color="#94A3B8" />
              <span>Pedir recomendações ao Sobi</span>
            </button>
          </div>
        )}
      </div>
    </SwipeBackView>
  );
};
