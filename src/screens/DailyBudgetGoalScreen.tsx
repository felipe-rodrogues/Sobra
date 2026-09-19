import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFinance } from '../context/FinanceContext';
import { BurnRateProjection } from '../core/calculations';
import { formatBrlCurrency, parseBrlCurrency } from '../core/parsers/currencyHelper';
import { SwipeBackView } from '../components/common/SwipeBackView';
import { Switch } from '../components/common/Switch';
import { 
  ArrowLeft,
  Zap,
  Scale,
  Check,
  Trash2,
  Sparkles,
  Pencil,
  Target,
  Plus,
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
}

interface DailyBudgetGoalScreenProps {
  onBack: () => void;
  projection: BurnRateProjection;
  currentGoal?: DailySpendingGoal | null;
  onSaveGoalConfig: (goal: DailySpendingGoal) => void;
  onRemoveGoalConfig?: () => void;
  onOpenAiChat?: (prompt?: string) => void;
  onCreateGoal?: () => void;
}

export const DailyBudgetGoalScreen: React.FC<DailyBudgetGoalScreenProps> = ({
  onBack,
  projection,
  currentGoal,
  onSaveGoalConfig,
  onRemoveGoalConfig,
  onOpenAiChat,
  onCreateGoal,
}) => {
  const { saveGoal, goals, transactions } = useFinance();

  const remainingDays = Math.max(1, projection.remainingDays);

  const now = new Date();
  const monthNameRaw = now.toLocaleDateString('pt-BR', { month: 'long' });
  const monthName = monthNameRaw.charAt(0).toUpperCase() + monthNameRaw.slice(1);

  // Metas ativas com prazo (exclui autorreferência de tetos diários anteriores)
  const goalsWithDeadline = useMemo(() => {
    return goals
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
    for (const tx of transactions) {
      if (tx.type === 'income' && tx.amount > 0) {
        const monthKey = tx.date.substring(0, 7);
        incomeByMonth.set(monthKey, (incomeByMonth.get(monthKey) || 0) + tx.amount);
      }
    }
    if (incomeByMonth.size === 0) return 0;
    const values = Array.from(incomeByMonth.values());
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  }, [projection.currentIncome, transactions]);

  // Presets inteligentes e diferenciados
  const breakEvenBudget = Math.max(0, projection.recommendedDailyBudget);
  const currentBurn = Math.max(10, Math.round(projection.dailyBurnRate));

  let preset1Amount: number;
  let preset1Label: string;
  let preset1Desc: string;

  let preset2Amount: number;
  let preset2Label: string;
  let preset2Desc: string;

  if (projection.projectedSobra > 0 && projection.dailyBurnRate > 0) {
    const comfortVal = Math.min(breakEvenBudget, Math.ceil(projection.dailyBurnRate * 1.35));
    preset1Amount = Math.max(10, comfortVal);
    preset1Label = 'Recomendado';
    preset1Desc = 'Ritmo real + 35% de folga';

    preset2Amount = Math.max(10, Math.round(breakEvenBudget));
    preset2Label = 'Teto Máximo';
    preset2Desc = 'Limite para não negativar';
  } else {
    // Cenário de aperto/déficit projetado: evita repetição de valor idêntico
    preset1Amount = breakEvenBudget;
    preset1Label = 'Equilibrar Mês';
    preset1Desc = 'Teto para zerar o déficit';

    preset2Amount = currentBurn;
    preset2Label = 'Ritmo Atual';
    preset2Desc = 'Manter consumo dos últimos dias';
  }

  // Cadência escolhida: Diário ou Semanal
  const [cadence, setCadence] = useState<'daily' | 'weekly'>(currentGoal?.cadence || 'daily');

  // Valores diários base dos presets
  const preset1Daily = preset1Amount;
  const preset2Daily = preset2Amount;

  // Valores ativos dos presets de acordo com a cadência
  const activePreset1 = cadence === 'weekly' ? Math.round(preset1Daily * 7) : preset1Daily;
  const activePreset2 = cadence === 'weekly' ? Math.round(preset2Daily * 7) : preset2Daily;

  // Estado de seleção da sugestão de limite ('preset1' | 'preset2' | null)
  const [selectedPreset, setSelectedPreset] = useState<'preset1' | 'preset2' | null>(() => {
    if (currentGoal?.selectedPreset !== undefined) {
      return currentGoal.selectedPreset;
    }
    if (currentGoal?.mode === 'suggested') {
      return 'preset1';
    }
    if (!currentGoal) {
      return 'preset1';
    }
    return null;
  });

  // Estado do limite base (referência antes de descontar metas)
  const initialBaseBudget = currentGoal?.dailyAmount
    ? (currentGoal.cadence === 'weekly' ? Math.round(currentGoal.dailyAmount * 7 * 100) / 100 : currentGoal.dailyAmount)
    : activePreset1;

  const [baseBudget, setBaseBudget] = useState<number>(initialBaseBudget);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>(currentGoal?.linkedGoalIds || []);

  const totalGoalsDaily = useMemo(() => {
    return goalsWithDeadline
      .filter(g => selectedGoalIds.includes(g.id))
      .reduce((acc, g) => acc + g.dailyNeeded, 0);
  }, [goalsWithDeadline, selectedGoalIds]);

  const totalGoalsActive = cadence === 'weekly' ? totalGoalsDaily * 7 : totalGoalsDaily;
  const burnRateInCadence = cadence === 'weekly' ? projection.dailyBurnRate * 7 : projection.dailyBurnRate;
  const cadenceSuffix = cadence === 'weekly' ? '/sem' : '/dia';

  // Estado do valor digitado
  const [customDailyInput, setCustomDailyInput] = useState<string>(() => {
    if (currentGoal?.dailyAmount) {
      return currentGoal.cadence === 'weekly'
        ? (currentGoal.dailyAmount * 7).toFixed(2).replace('.', ',')
        : currentGoal.dailyAmount.toFixed(2).replace('.', ',');
    }
    const initialTarget = Math.max(0, activePreset1 - (currentGoal?.linkedGoalIds ? totalGoalsActive : 0));
    return initialTarget.toFixed(2).replace('.', ',');
  });

  const [saveAsGoal, setSaveAsGoal] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInitializedRef = useRef<boolean>(false);

  // Sincroniza inicialização sem resets acidentais durante a sessão
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const isWeekly = currentGoal?.cadence === 'weekly';
    setCadence(isWeekly ? 'weekly' : 'daily');

    let initialPreset: 'preset1' | 'preset2' | null = null;
    if (currentGoal?.selectedPreset !== undefined) {
      initialPreset = currentGoal.selectedPreset;
    } else if (currentGoal?.mode === 'suggested' || !currentGoal) {
      initialPreset = 'preset1';
    }
    setSelectedPreset(initialPreset);

    if (currentGoal?.linkedGoalIds && currentGoal.linkedGoalIds.length > 0) {
      setSelectedGoalIds(currentGoal.linkedGoalIds);
      const savedGoalsTotalDaily = goalsWithDeadline
        .filter(g => currentGoal.linkedGoalIds?.includes(g.id))
        .reduce((acc, g) => acc + g.dailyNeeded, 0);

      const savedGoalsTotal = isWeekly ? savedGoalsTotalDaily * 7 : savedGoalsTotalDaily;
      const baseVal = isWeekly
        ? ((currentGoal.dailyAmount || preset1Daily) * 7) + savedGoalsTotal
        : (currentGoal.dailyAmount || preset1Daily) + savedGoalsTotal;

      setBaseBudget(Math.round(baseVal * 100) / 100);
    } else {
      setSelectedGoalIds([]);
      setBaseBudget(isWeekly ? Math.round((currentGoal?.dailyAmount || preset1Daily) * 7) : (currentGoal?.dailyAmount || preset1Daily));
    }

    if (currentGoal?.dailyAmount) {
      const val = isWeekly ? currentGoal.dailyAmount * 7 : currentGoal.dailyAmount;
      setCustomDailyInput(val.toFixed(2).replace('.', ','));
    } else {
      const val = isWeekly ? Math.round(preset1Daily * 7) : preset1Daily;
      setCustomDailyInput(val.toFixed(2).replace('.', ','));
    }
    setSaveAsGoal(false);
  }, [currentGoal, preset1Daily, goalsWithDeadline]);

  // Conversão de Cadência (Diário <-> Semanal)
  const handleCadenceChange = (newCadence: 'daily' | 'weekly') => {
    if (newCadence === cadence) return;
    if (selectedPreset === 'preset1') {
      const newBase = newCadence === 'weekly' ? Math.round(preset1Daily * 7) : preset1Daily;
      const newGoals = newCadence === 'weekly' ? totalGoalsDaily * 7 : totalGoalsDaily;
      const newTarget = Math.max(0, Math.round((newBase - newGoals) * 100) / 100);
      setBaseBudget(newBase);
      setCustomDailyInput(newTarget.toFixed(2).replace('.', ','));
    } else if (selectedPreset === 'preset2') {
      const newBase = newCadence === 'weekly' ? Math.round(preset2Daily * 7) : preset2Daily;
      const newGoals = newCadence === 'weekly' ? totalGoalsDaily * 7 : totalGoalsDaily;
      const newTarget = Math.max(0, Math.round((newBase - newGoals) * 100) / 100);
      setBaseBudget(newBase);
      setCustomDailyInput(newTarget.toFixed(2).replace('.', ','));
    } else {
      const currentVal = parseBrlCurrency(customDailyInput) ?? 0;
      if (newCadence === 'weekly') {
        const weeklyVal = Math.round(currentVal * 7 * 100) / 100;
        setCustomDailyInput(weeklyVal.toFixed(2).replace('.', ','));
        setBaseBudget(prev => Math.round(prev * 7 * 100) / 100);
      } else {
        const dailyVal = Math.round((currentVal / 7) * 100) / 100;
        setCustomDailyInput(dailyVal.toFixed(2).replace('.', ','));
        setBaseBudget(prev => Math.round((prev / 7) * 100) / 100);
      }
    }
    setCadence(newCadence);
  };

  const activeAmount = Math.max(0, parseBrlCurrency(customDailyInput) ?? 0);
  const effectiveDailyRate = cadence === 'weekly' ? activeAmount / 7 : activeAmount;

  // Sobra calculada rigorosamente idêntica em ambas as cadências
  const calculatedSobra = Math.round(
    (projection.currentIncome - (projection.currentExpense + (effectiveDailyRate * remainingDays))) * 100
  ) / 100;

  // Toggle da sugestão de limite (permite desmarcar e coexistir com metas)
  const handleTogglePreset = (presetKey: 'preset1' | 'preset2') => {
    const targetDaily = presetKey === 'preset1' ? preset1Daily : preset2Daily;
    const targetActive = cadence === 'weekly' ? Math.round(targetDaily * 7) : targetDaily;

    if (selectedPreset === presetKey) {
      // Desmarca com um novo clique
      setSelectedPreset(null);
      return;
    }

    // Seleciona a sugestão mantendo as metas marcadas
    setSelectedPreset(presetKey);
    setBaseBudget(targetActive);

    const targetBudget = Math.max(0, Math.round((targetActive - totalGoalsActive) * 100) / 100);
    setCustomDailyInput(targetBudget.toFixed(2).replace('.', ','));
  };

  // Toggle de cada meta com prazo
  const handleToggleGoal = (goalId: string) => {
    const isSelected = selectedGoalIds.includes(goalId);
    const newSelected = isSelected
      ? selectedGoalIds.filter(id => id !== goalId)
      : [...selectedGoalIds, goalId];

    setSelectedGoalIds(newSelected);

    const newGoalsDaily = goalsWithDeadline
      .filter(g => newSelected.includes(g.id))
      .reduce((acc, g) => acc + g.dailyNeeded, 0);

    const newGoalsActive = cadence === 'weekly' ? newGoalsDaily * 7 : newGoalsDaily;
    const targetBudget = Math.max(0, Math.round((baseBudget - newGoalsActive) * 100) / 100);
    setCustomDailyInput(targetBudget.toFixed(2).replace('.', ','));
  };

  const handleSave = async () => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const goalData: DailySpendingGoal = {
      mode: selectedGoalIds.length > 0 ? 'goal_linked' : selectedPreset !== null ? 'suggested' : 'custom_daily',
      dailyAmount: Math.round(effectiveDailyRate * 100) / 100,
      targetSobraAmount: calculatedSobra > 0 ? calculatedSobra : undefined,
      savedAt: new Date().toISOString(),
      month,
      year,
      savedAsAppGoal: saveAsGoal,
      linkedGoalIds: selectedGoalIds.length > 0 ? selectedGoalIds : undefined,
      cadence,
      selectedPreset,
    };

    if (saveAsGoal) {
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      const targetDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
      const goalTargetVal = Math.max(10, Math.round(effectiveDailyRate * remainingDays));

      await saveGoal({
        name: cadence === 'weekly'
          ? `Limite Semanal: ${formatBrlCurrency(activeAmount)}/sem`
          : `Limite Diário: ${formatBrlCurrency(activeAmount)}/dia`,
        targetAmount: goalTargetVal,
        currentAmount: Math.max(0, projection.currentIncome - projection.currentExpense),
        targetDate: targetDateStr,
        color: '#10B981',
        icon: 'Target',
        isCompleted: false,
      });
    }

    onSaveGoalConfig(goalData);
    onBack();
  };

  const handleOpenSobiHelp = () => {
    onBack();
    if (onOpenAiChat) {
      const prompt = `Olá Sobra AI! Estou planejando um limite de gastos de ${formatBrlCurrency(activeAmount)}${cadenceSuffix} para os próximos ${projection.remainingDays} dias.\n- Meu gasto médio real até hoje: ${formatBrlCurrency(burnRateInCadence)}${cadenceSuffix}\n- Sobra estimada com esse limite: ${formatBrlCurrency(calculatedSobra)}\n\nQuais recomendações práticas você me dá para manter meu consumo dentro desse limite com tranquilidade?`;
      onOpenAiChat(prompt);
    }
  };

  // Mensagem contextual inteligente e sem contradição
  let contextMessage: string;
  if (selectedGoalIds.length > 0) {
    if (calculatedSobra >= 0) {
      contextMessage = `Esse limite reserva ${formatBrlCurrency(totalGoalsActive)}${cadenceSuffix} para suas metas e mantém ${formatBrlCurrency(activeAmount)}${cadenceSuffix} para gastos livres.`;
    } else {
      contextMessage = `Reservar ${formatBrlCurrency(totalGoalsActive)}${cadenceSuffix} para as metas com esse limite pode gerar déficit de ${formatBrlCurrency(Math.abs(calculatedSobra))} no fim do mês.`;
    }
  } else if (calculatedSobra >= 0) {
    if (activeAmount >= burnRateInCadence) {
      contextMessage = `No seu ritmo atual, você tem uma folga de ${formatBrlCurrency(activeAmount - burnRateInCadence)}${cadenceSuffix} e ainda fecha o mês no positivo.`;
    } else {
      contextMessage = `Esse limite exige economizar ${formatBrlCurrency(burnRateInCadence - activeAmount)}${cadenceSuffix} sobre seu ritmo para garantir a sobra no fim do mês.`;
    }
  } else {
    contextMessage = `Com esse limite ${cadence === 'weekly' ? 'semanal' : 'diário'}, a projeção é fechar o mês com déficit de ${formatBrlCurrency(Math.abs(calculatedSobra))}.`;
  }

  return (
    <SwipeBackView onBack={onBack}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          padding: '14px 20px 100px',
          maxWidth: '460px',
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
            padding: '4px 0 4px',
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#161F18',
              border: '1px solid rgba(255, 255, 255, 0.08)',
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
            <ArrowLeft size={20} />
          </button>

          <h2
            style={{
              margin: 0,
              fontSize: '1.05rem',
              fontWeight: 700,
              color: '#FFFFFF',
              fontFamily: "'Outfit', 'Inter', sans-serif",
            }}
          >
            Limite de Gastos
          </h2>

          <div style={{ width: '40px' }} />
        </div>

        {/* ── 2. DESTAQUE NUMÉRICO PRINCIPAL (NATIVO / SEM QUADRO) ────── */}
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontSize: '0.88rem', color: '#E2E8F0', fontWeight: 600, letterSpacing: '-0.01em' }}>
              Limite de gastos em {monthName}
            </span>
            <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 400 }}>
              Baseado em {formatBrlCurrency(projection.currentIncome)} de receita no mês
            </span>
          </div>

          {/* Seletor Segmentado Nativo: Diário / Semanal */}
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: '#111519',
              borderRadius: '12px',
              padding: '3px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              width: 'fit-content',
              marginTop: '10px',
            }}
          >
            <button
              type="button"
              onClick={() => handleCadenceChange('daily')}
              style={{
                padding: '6px 16px',
                borderRadius: '9px',
                border: 'none',
                backgroundColor: cadence === 'daily' ? '#18221B' : 'transparent',
                color: cadence === 'daily' ? '#4ADE80' : '#8E8E93',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: cadence === 'daily' ? '0 1px 4px rgba(0, 0, 0, 0.5)' : 'none',
              }}
            >
              Diário
            </button>
            <button
              type="button"
              onClick={() => handleCadenceChange('weekly')}
              style={{
                padding: '6px 16px',
                borderRadius: '9px',
                border: 'none',
                backgroundColor: cadence === 'weekly' ? '#18221B' : 'transparent',
                color: cadence === 'weekly' ? '#4ADE80' : '#8E8E93',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: cadence === 'weekly' ? '0 1px 4px rgba(0, 0, 0, 0.5)' : 'none',
              }}
            >
              Semanal
            </button>
          </div>

          {/* Cápsula Interativa com bordas sutis, foco elegante e micro-lápis indicativo */}
          <div
            onClick={() => inputRef.current?.focus()}
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: '6px',
              marginTop: '10px',
              padding: '6px 14px 6px 12px',
              borderRadius: '16px',
              backgroundColor: isFocused ? 'rgba(74, 222, 128, 0.05)' : 'rgba(255, 255, 255, 0.03)',
              border: isFocused ? '1px solid rgba(74, 222, 128, 0.45)' : '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: isFocused ? '0 0 16px rgba(74, 222, 128, 0.12)' : 'none',
              cursor: 'text',
              transition: 'all 0.2s ease',
              width: 'fit-content',
            }}
          >
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: isFocused ? '#4ADE80' : '#64748B', transition: 'color 0.2s ease' }}>
              R$
            </span>

            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'baseline' }}>
              {/* Espelho invisível para medição exata da largura dos caracteres */}
              <span
                style={{
                  fontSize: '2.8rem',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  visibility: 'hidden',
                  whiteSpace: 'pre',
                  padding: 0,
                  margin: 0,
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                }}
              >
                {customDailyInput || '0,00'}
              </span>
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={customDailyInput}
                onChange={e => {
                  setCustomDailyInput(e.target.value);
                  setSelectedPreset(null);
                  const parsed = parseBrlCurrency(e.target.value);
                  if (parsed !== null && parsed > 0) {
                    setBaseBudget(parsed + totalGoalsActive);
                  }
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="0,00"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '2.8rem',
                  fontWeight: 800,
                  outline: 'none',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  padding: 0,
                  margin: 0,
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                }}
              />
            </div>

            <span style={{ fontSize: '1.05rem', color: isFocused ? '#CBD5E1' : '#64748B', fontWeight: 600, marginLeft: '2px', transition: 'color 0.2s ease' }}>
              {cadenceSuffix}
            </span>

            <Pencil
              size={13}
              strokeWidth={2}
              color={isFocused ? '#4ADE80' : '#64748B'}
              style={{
                marginLeft: '6px',
                alignSelf: 'center',
                opacity: isFocused ? 1 : 0.7,
                transition: 'all 0.2s ease',
              }}
            />
          </div>

          {/* Pontos de Resumo em Linha Única (Sobra, Ritmo e Dias Restantes) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
              marginTop: '10px',
              fontSize: '0.86rem',
              fontWeight: 600,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#E2E8F0' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: calculatedSobra >= 0 ? '#4ADE80' : '#F87171',
                  flexShrink: 0,
                }}
              />
              <span>
                Sobra estimada {calculatedSobra >= 0 ? '+' : ''}{formatBrlCurrency(calculatedSobra)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#64748B',
                  flexShrink: 0,
                }}
              />
              <span>Ritmo real {formatBrlCurrency(burnRateInCadence)}{cadenceSuffix}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#64748B',
                  flexShrink: 0,
                }}
              />
              <span>{remainingDays} {remainingDays === 1 ? 'dia restante' : 'dias restantes'}</span>
            </div>
          </div>

          {/* Microcópia conversacional honesta e sem contradição */}
          <p
            style={{
              fontSize: '0.8rem',
              color: calculatedSobra >= 0 ? '#64748B' : '#F87171',
              lineHeight: 1.45,
              margin: '10px 0 0',
            }}
          >
            {contextMessage}
          </p>
        </div>

        {/* ── 3. ESTRATÉGIAS SUGERIDAS ──────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#8E8E93', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Sugestões de limite
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* Opção 1 */}
            <button
              type="button"
              onClick={() => handleTogglePreset('preset1')}
              style={{
                backgroundColor: selectedPreset === 'preset1'
                  ? '#161D19'
                  : '#111519',
                border: selectedPreset === 'preset1'
                  ? '1px solid rgba(74, 222, 128, 0.35)'
                  : '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '16px',
                padding: '14px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: selectedPreset === 'preset1' ? '#4ADE80' : '#D1D5DB',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Zap size={13} strokeWidth={2} color={selectedPreset === 'preset1' ? '#4ADE80' : '#8E8E93'} />
                  {preset1Label}
                </span>
              </div>

              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                  {formatBrlCurrency(activePreset1)}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#8E8E93', marginTop: '2px' }}>
                  {cadence === 'weekly' ? 'Ritmo semanal + 35% de folga' : preset1Desc}
                </div>
              </div>
            </button>

            {/* Opção 2 */}
            <button
              type="button"
              onClick={() => handleTogglePreset('preset2')}
              style={{
                backgroundColor: selectedPreset === 'preset2'
                  ? '#161D19'
                  : '#111519',
                border: selectedPreset === 'preset2'
                  ? '1px solid rgba(74, 222, 128, 0.35)'
                  : '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '16px',
                padding: '14px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: selectedPreset === 'preset2' ? '#4ADE80' : '#D1D5DB',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Scale size={13} strokeWidth={2} color={selectedPreset === 'preset2' ? '#4ADE80' : '#8E8E93'} />
                  {preset2Label}
                </span>
              </div>

              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                  {formatBrlCurrency(activePreset2)}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#8E8E93', marginTop: '2px' }}>
                  {cadence === 'weekly' ? 'Limite semanal para não negativar' : preset2Desc}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* ── 4. METAS COM PRAZO (LISTA OU EMPTY STATE) ──────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#8E8E93', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Metas com prazo
            </span>
            {selectedGoalIds.length > 0 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(74, 222, 128, 0.12)',
                  color: '#4ADE80',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedGoalIds.length} {selectedGoalIds.length === 1 ? 'meta' : 'metas'} • {formatBrlCurrency(totalGoalsActive)}{cadenceSuffix}
              </span>
            )}
          </div>

          {goalsWithDeadline.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                      padding: '13px 2px',
                      borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '6px',
                          border: isSelected ? 'none' : '1.5px solid rgba(255, 255, 255, 0.2)',
                          backgroundColor: isSelected ? '#4ADE80' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected && <Check size={13} color="#08090A" strokeWidth={3} />}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '0.88rem',
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? '#FFFFFF' : '#D1D5DB',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            transition: 'color 0.15s ease',
                          }}
                        >
                          {g.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '1px' }}>
                          {g.daysRemaining} {g.daysRemaining === 1 ? 'dia restante' : 'dias restantes'}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: isSelected ? '#4ADE80' : '#E2E8F0', transition: 'color 0.15s ease' }}>
                        {formatBrlCurrency(goalNeeded)}
                        <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748B' }}>{cadenceSuffix}</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 500, color: isSelected ? 'rgba(74, 222, 128, 0.75)' : '#64748B', marginTop: '1px' }}>
                        ≈ {formatBrlCurrency(goalNeededMonthly)}/mês
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                backgroundColor: '#111519',
                border: '1px dashed rgba(255, 255, 255, 0.12)',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(74, 222, 128, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Target size={18} color="#4ADE80" strokeWidth={2} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#FFFFFF' }}>
                  Nenhuma meta com prazo vinculada
                </div>
                <div style={{ fontSize: '0.74rem', color: '#8E8E93', marginTop: '4px', lineHeight: 1.4 }}>
                  Crie metas com data limite para o Sobra reservar a quantia necessária automaticamente no seu limite de gastos.
                </div>

                {onCreateGoal && (
                  <button
                    type="button"
                    onClick={onCreateGoal}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '12px',
                      padding: '7px 12px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(74, 222, 128, 0.12)',
                      border: '1px solid rgba(74, 222, 128, 0.3)',
                      color: '#4ADE80',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    Criar meta com prazo
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── 5. ACOMPANHAR NO PLANEJAMENTO (Linha nativa sem container) ── */}
        <div
          onClick={() => setSaveAsGoal(!saveAsGoal)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            cursor: 'pointer',
            userSelect: 'none',
            padding: '14px 2px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#FFFFFF' }}>
              Acompanhar este limite no Planejamento
            </span>
            <span style={{ fontSize: '0.72rem', color: '#64748B', lineHeight: 1.35 }}>
              Cria um card para acompanhar seu consumo no dia a dia.
            </span>
          </div>
          <Switch
            checked={saveAsGoal}
            onChange={setSaveAsGoal}
            activeColor="#4ADE80"
          />
        </div>

        {/* ── 6. AÇÕES FINAIS (FIXAS OU NO FLUXO) ────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
          <button
            type="button"
            onClick={handleSave}
            style={{
              width: '100%',
              padding: '15px 20px',
              borderRadius: '16px',
              backgroundColor: '#4ADE80',
              border: 'none',
              color: '#08090A',
              fontSize: '0.94rem',
              fontWeight: 800,
              cursor: 'pointer',
              textAlign: 'center',
              letterSpacing: '-0.01em',
              transition: 'opacity 0.15s ease, transform 0.15s ease',
              boxShadow: '0 4px 16px rgba(74, 222, 128, 0.2)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.opacity = '0.92';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Confirmar limite de gastos
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: currentGoal && onRemoveGoalConfig ? 'space-between' : 'flex-end',
              padding: '2px 4px',
            }}
          >
            {currentGoal && onRemoveGoalConfig && (
              <button
                type="button"
                onClick={() => {
                  onRemoveGoalConfig();
                  onBack();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#FB7185',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <Trash2 size={13} strokeWidth={2} />
                <span>Remover limite de gastos</span>
              </button>
            )}

            {onOpenAiChat && (
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
                  padding: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
                onMouseLeave={e => (e.currentTarget.style.color = '#8E8E93')}
              >
                <Sparkles size={13} strokeWidth={2} color="#8E8E93" />
                <span>Pedir recomendações à IA</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </SwipeBackView>
  );
};
