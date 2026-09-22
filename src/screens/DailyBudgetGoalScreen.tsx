import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFinance } from '../context/FinanceContext';
import { BurnRateProjection } from '../core/calculations';
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
  const { saveGoal, goals, transactions } = useFinance();

  const remainingDays = Math.max(1, projection.remainingDays);

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

  // Renda mensal usual calculada com base no histórico de receitas
  const typicalMonthlyIncome = useMemo(() => {
    if (projection.currentIncome > 0) return projection.currentIncome;
    const incomeByMonth = new Map<string, number>();
    for (const tx of (transactions || [])) {
      if (tx.type === 'income' && tx.amount > 0) {
        const monthKey = tx.date.substring(0, 7);
        incomeByMonth.set(monthKey, (incomeByMonth.get(monthKey) || 0) + tx.amount);
      }
    }
    if (incomeByMonth.size === 0) return 0;
    const values = Array.from(incomeByMonth.values());
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  }, [projection.currentIncome, transactions]);

  // Renda mensal de referência (salário / entradas do mês)
  const monthlyIncome = useMemo(() => {
    if (projection.currentIncome > 0) return projection.currentIncome;
    return typicalMonthlyIncome;
  }, [projection.currentIncome, typicalMonthlyIncome]);

  // Sobra máxima possível considerando os gastos já realizados no mês
  const maxPossibleSobra = Math.max(0, monthlyIncome - projection.currentExpense);
  const maxViablePercent = monthlyIncome > 0 ? Math.floor((maxPossibleSobra / monthlyIncome) * 100) : 0;

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

  const totalGoalsActive = cadence === 'weekly' ? totalGoalsDaily * 7 : totalGoalsDaily;
  const totalGoalsForRestOfMonth = totalGoalsDaily * remainingDays;
  const burnRateInCadence = cadence === 'weekly' ? projection.dailyBurnRate * 7 : projection.dailyBurnRate;
  const cadenceSuffix = cadence === 'weekly' ? '/sem' : '/dia';

  // Estado de Porcentagem de Economia (Baseline padrão de 10% com fallback seguro se viabilidade for menor)
  const [savingsPercent, setSavingsPercent] = useState<number>(() => {
    if (currentGoal?.savingsPercent !== undefined && currentGoal.savingsPercent !== null) {
      return currentGoal.savingsPercent;
    }
    if (currentGoal?.selectedPreset === 'preset2') {
      return 0;
    }
    if (maxViablePercent < 10 && maxViablePercent >= 0) {
      return maxViablePercent;
    }
    return 10;
  });

  // Estado de controle de edição: só exibe o botão de salvar no topo se houver modificação
  const [isModified, setIsModified] = useState<boolean>(false);

  // Função utilitária para calcular o teto diário e semanal com base em uma porcentagem
  const computeBudgetFromPercent = (
    percent: number,
    goalsDaily: number,
    targetCadence: 'daily' | 'weekly'
  ) => {
    const plannedSavings = Math.round(monthlyIncome * (percent / 100) * 100) / 100;
    const availableAfterSavings = Math.max(0, monthlyIncome - projection.currentExpense - plannedSavings);
    const availableToSpend = Math.max(0, availableAfterSavings - (goalsDaily * remainingDays));
    const dailyRate = availableToSpend / remainingDays;
    return targetCadence === 'weekly'
      ? Math.round(dailyRate * 7 * 100) / 100
      : Math.round(dailyRate * 100) / 100;
  };

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
    } else if (!currentGoal) {
      const initialPct = (maxViablePercent < 10 && maxViablePercent >= 0) ? maxViablePercent : 10;
      setSavingsPercent(initialPct);
    }
  }, [currentGoal, maxViablePercent, initialCadence]);

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

  // Valor ativo (limite na cadência atual calculado reativamente)
  const activeAmount = useMemo(() => {
    return computeBudgetFromPercent(savingsPercent, totalGoalsDaily, cadence);
  }, [savingsPercent, totalGoalsDaily, cadence, monthlyIncome, projection.currentExpense, remainingDays]);

  const effectiveDailyRate = cadence === 'weekly' ? activeAmount / 7 : activeAmount;

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

  // Sobra calculada rigorosamente idêntica em ambas as cadências (descontando metas e gastos diários)
  const calculatedSobra = Math.round(
    (monthlyIncome - (projection.currentExpense + (effectiveDailyRate * remainingDays) + totalGoalsForRestOfMonth)) * 100
  ) / 100;

  const implicitPercent = monthlyIncome > 0 ? Math.round((calculatedSobra / monthlyIncome) * 100) : 0;

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
    };

    onSaveGoalConfig(goalData);
    onBack();
  };

  const handleOpenSobiHelp = () => {
    onBack();
    if (onOpenAiChat) {
      const prompt = `Olá Sobra AI! Estou planejando um limite de gastos de ${formatBrlCurrency(activeAmount)}${cadenceSuffix} para os próximos ${projection.remainingDays} dias.\n- Meu gasto médio real até hoje: ${formatBrlCurrency(burnRateInCadence)}${cadenceSuffix}\n- Sobra estimada com esse limite: ${formatBrlCurrency(calculatedSobra)}${savingsPercent !== null ? ` (objetivo de poupar ${savingsPercent}% da renda)` : ''}\n\nQuais recomendações práticas você me dá para manter meu consumo dentro desse limite com tranquilidade?`;
      onOpenAiChat(prompt);
    }
  };

  return (
    <SwipeBackView onBack={onBack} style={{ minHeight: 'auto' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '4px 16px 8px',
          maxWidth: '440px',
          margin: '0 auto',
          boxSizing: 'border-box',
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
              border: '1px solid rgba(255, 255, 255, 0.12)',
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
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#94A3B8', letterSpacing: '-0.01em' }}>
                {cadence === 'weekly' ? 'Limite Semanal' : 'Limite Diário'}
              </span>
            </div>

            <span style={{ fontSize: '0.75rem', color: '#8E8E93', fontWeight: 500 }}>
              Renda considerada: <strong style={{ color: '#CBD5E1', fontWeight: 600 }}>{formatBrlCurrency(monthlyIncome)}</strong>
            </span>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {selectedGoalIds.length > 0 && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    color: '#CBD5E1',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedGoalIds.length} {selectedGoalIds.length === 1 ? 'meta' : 'metas'} • {formatBrlCurrency(totalGoalsActive)}{cadenceSuffix}
                </span>
              )}
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
