import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { useFinance } from '../../context/FinanceContext';
import { BurnRateProjection } from '../../core/calculations';
import { formatBrlCurrency, parseBrlCurrency } from '../../core/parsers/currencyHelper';
import { 
  Trash2,
  ArrowRight,
  Target,
  Check,
  ChevronDown,
  ChevronUp,
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
}

interface DailyBudgetGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  projection: BurnRateProjection;
  currentGoal?: DailySpendingGoal | null;
  onSaveGoalConfig: (goal: DailySpendingGoal) => void;
  onRemoveGoalConfig?: () => void;
  onOpenAiChat?: (prompt?: string) => void;
}

export const DailyBudgetGoalModal: React.FC<DailyBudgetGoalModalProps> = ({
  isOpen,
  onClose,
  projection,
  currentGoal,
  onSaveGoalConfig,
  onRemoveGoalConfig,
  onOpenAiChat,
}) => {
  const { saveGoal, goals, transactions } = useFinance();

  const remainingDays = Math.max(1, projection.remainingDays);

  // Metas ativas que possuem data limite definida
  const goalsWithDeadline = useMemo(() => {
    return goals
      .filter(g => !g.isCompleted && g.targetDate && g.targetDate.trim().length > 0)
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

  // 1. Teto Máximo de Equilíbrio (Break-even)
  const breakEvenBudget = projection.recommendedDailyBudget;

  // 2. Teto para Guardar 20% da Renda
  const target20Sobra = Math.round(projection.currentIncome * 0.20 * 100) / 100;
  const availableFor20 = Math.max(0, projection.currentIncome - projection.currentExpense - target20Sobra);
  const save20Budget = remainingDays > 0 
    ? Math.round((availableFor20 / remainingDays) * 100) / 100 
    : 0;

  // 3. Recomendado Inteligente (Ritmo real + 35% de folga)
  let smartComfortBudget: number;
  if (projection.dailyBurnRate > 0 && projection.projectedSobra > 0) {
    const rawComfort = Math.ceil(projection.dailyBurnRate * 1.35);
    smartComfortBudget = Math.min(Math.max(10, rawComfort), breakEvenBudget);
  } else if (save20Budget > 0) {
    smartComfortBudget = save20Budget;
  } else {
    smartComfortBudget = breakEvenBudget;
  }

  // Estado do valor diário digitado e metas selecionadas
  const [customDailyInput, setCustomDailyInput] = useState<string>(
    currentGoal?.dailyAmount
      ? currentGoal.dailyAmount.toFixed(2).replace('.', ',')
      : smartComfortBudget.toFixed(2).replace('.', ',')
  );
  const [saveAsGoal, setSaveAsGoal] = useState<boolean>(false);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  // Accordion "Vincular às metas": fechado por padrão
  const [goalsExpanded, setGoalsExpanded] = useState<boolean>(false);

  // Sincroniza quando o modal abre
  useEffect(() => {
    if (isOpen) {
      if (currentGoal?.linkedGoalIds && currentGoal.linkedGoalIds.length > 0) {
        setSelectedGoalIds(currentGoal.linkedGoalIds);
        setGoalsExpanded(true); // Mostra aberto se já há metas vinculadas
      } else {
        setSelectedGoalIds([]);
        setGoalsExpanded(false);
      }
      if (currentGoal?.dailyAmount) {
        setCustomDailyInput(currentGoal.dailyAmount.toFixed(2).replace('.', ','));
      } else {
        setCustomDailyInput(smartComfortBudget.toFixed(2).replace('.', ','));
      }
      setSaveAsGoal(false);
    }
  }, [isOpen, currentGoal, smartComfortBudget]);

  const activeAmount = Math.max(0, parseBrlCurrency(customDailyInput) ?? 0);
  const calculatedSobra = Math.round(
    (projection.currentIncome - (projection.currentExpense + (activeAmount * remainingDays))) * 100
  ) / 100;

  const isCurrentAmount = (targetVal: number) => {
    return Math.abs(activeAmount - targetVal) < 0.05;
  };

  const handleSelectPreset = (amount: number) => {
    setSelectedGoalIds([]);
    setCustomDailyInput(amount.toFixed(2).replace('.', ','));
  };

  const handleToggleGoal = (goalId: string) => {
    const isSelected = selectedGoalIds.includes(goalId);
    const newSelected = isSelected
      ? selectedGoalIds.filter(id => id !== goalId)
      : [...selectedGoalIds, goalId];

    setSelectedGoalIds(newSelected);

    if (newSelected.length > 0) {
      const totalDailySavings = goalsWithDeadline
        .filter(g => newSelected.includes(g.id))
        .reduce((acc, g) => acc + g.dailyNeeded, 0);

      let targetDailyBudget: number;
      if (breakEvenBudget > 0) {
        targetDailyBudget = Math.max(0, breakEvenBudget - totalDailySavings);
      } else if (typicalMonthlyIncome > 0) {
        const dailyIncome = typicalMonthlyIncome / 30.41;
        targetDailyBudget = Math.max(0, dailyIncome - totalDailySavings);
      } else {
        targetDailyBudget = Math.max(0, projection.dailyBurnRate - totalDailySavings);
      }

      setCustomDailyInput(targetDailyBudget.toFixed(2).replace('.', ','));
    } else {
      setCustomDailyInput(smartComfortBudget.toFixed(2).replace('.', ','));
    }
  };

  const handleSave = async () => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const goalData: DailySpendingGoal = {
      mode: selectedGoalIds.length > 0 ? 'goal_linked' : isCurrentAmount(smartComfortBudget) ? 'suggested' : 'custom_daily',
      dailyAmount: activeAmount,
      targetSobraAmount: calculatedSobra > 0 ? calculatedSobra : undefined,
      savedAt: new Date().toISOString(),
      month,
      year,
      savedAsAppGoal: saveAsGoal,
      linkedGoalIds: selectedGoalIds.length > 0 ? selectedGoalIds : undefined,
    };

    if (saveAsGoal) {
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      const targetDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
      const goalTargetVal = Math.max(10, Math.round(activeAmount * remainingDays));

      await saveGoal({
        name: `Teto Diário: ${formatBrlCurrency(activeAmount)}/dia`,
        targetAmount: goalTargetVal,
        currentAmount: Math.max(0, projection.currentIncome - projection.currentExpense),
        targetDate: targetDateStr,
        color: '#10B981',
        icon: 'Target',
        isCompleted: false,
      });
    }

    onSaveGoalConfig(goalData);
    onClose();
  };

  const handleOpenSobiHelp = () => {
    onClose();
    if (onOpenAiChat) {
      const prompt = `Olá Sobra AI! Estou planejando um teto diário de gastos de ${formatBrlCurrency(activeAmount)}/dia para os próximos ${projection.remainingDays} dias.\n- Meu gasto médio real até hoje: ${formatBrlCurrency(projection.dailyBurnRate)}/dia\n- Sobra estimada com essa meta: ${formatBrlCurrency(calculatedSobra)}\n\nQuais recomendações práticas você me dá para manter meu consumo dentro desse limite com tranquilidade?`;
      onOpenAiChat(prompt);
    }
  };

  const sobraColor = calculatedSobra >= 0 ? '#4ADE80' : '#F87171';
  const isOnPace = activeAmount >= projection.dailyBurnRate;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Definir Meta Diária"
      subtitle={`${projection.remainingDays} dias restantes · R$\u00a0${projection.dailyBurnRate.toFixed(0)}/dia no seu ritmo atual`}
      maxWidth="420px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

        {/* ── 1. INPUT PRINCIPAL ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px' }}>
          {/* Valor digitável */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#8E8E93' }}>R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={customDailyInput}
              onChange={e => setCustomDailyInput(e.target.value)}
              placeholder="0,00"
              style={{
                width: '140px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '2px solid #22252A',
                color: '#4ADE80',
                fontSize: '2.6rem',
                fontWeight: 800,
                outline: 'none',
                textAlign: 'center',
                letterSpacing: '-0.02em',
                lineHeight: 1,
                padding: '0 0 4px',
              }}
            />
            <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 500 }}>/dia</span>
          </div>

          {/* Sobra estimada em destaque */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: sobraColor }}>
              {calculatedSobra >= 0 ? '+' : ''}{formatBrlCurrency(calculatedSobra)}
            </span>
            <span style={{ fontSize: '0.74rem', color: '#64748B' }}>sobra estimada no fim do mês</span>
          </div>

          {/* Linha de contexto — folga ou esforço */}
          <span
            style={{
              fontSize: '0.72rem',
              color: isOnPace ? '#4ADE80' : '#FB923C',
              backgroundColor: isOnPace ? 'rgba(74, 222, 128, 0.08)' : 'rgba(251, 146, 60, 0.08)',
              border: `1px solid ${isOnPace ? 'rgba(74, 222, 128, 0.2)' : 'rgba(251, 146, 60, 0.2)'}`,
              borderRadius: '9999px',
              padding: '3px 10px',
              fontWeight: 600,
            }}
          >
            {isOnPace
              ? `Folga de ${formatBrlCurrency(activeAmount - projection.dailyBurnRate)}/dia sobre seu ritmo`
              : `Exige economizar ${formatBrlCurrency(projection.dailyBurnRate - activeAmount)}/dia`}
          </span>
        </div>

        {/* ── 2. SUGESTÕES ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Sugestão principal: destaque verde cheio */}
          <button
            type="button"
            onClick={() => handleSelectPreset(smartComfortBudget)}
            style={{
              width: '100%',
              padding: '11px 16px',
              borderRadius: '14px',
              fontSize: '0.84rem',
              fontWeight: 700,
              backgroundColor: isCurrentAmount(smartComfortBudget) && selectedGoalIds.length === 0
                ? 'rgba(74, 222, 128, 0.15)'
                : 'rgba(255, 255, 255, 0.04)',
              border: isCurrentAmount(smartComfortBudget) && selectedGoalIds.length === 0
                ? '1px solid rgba(74, 222, 128, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.07)',
              color: isCurrentAmount(smartComfortBudget) && selectedGoalIds.length === 0 ? '#4ADE80' : '#D1D5DB',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>⚡ Recomendado</span>
            <span style={{ fontWeight: 800 }}>{formatBrlCurrency(smartComfortBudget)}</span>
          </button>

          {/* Opções secundárias discretas em linha */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleSelectPreset(save20Budget)}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '12px',
                fontSize: '0.74rem',
                fontWeight: 600,
                backgroundColor: isCurrentAmount(save20Budget) && selectedGoalIds.length === 0
                  ? 'rgba(74, 222, 128, 0.1)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: isCurrentAmount(save20Budget) && selectedGoalIds.length === 0
                  ? '1px solid rgba(74, 222, 128, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.07)',
                color: isCurrentAmount(save20Budget) && selectedGoalIds.length === 0 ? '#4ADE80' : '#8E8E93',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
              }}
            >
              <span style={{ color: isCurrentAmount(save20Budget) && selectedGoalIds.length === 0 ? '#4ADE80' : '#D1D5DB' }}>
                {formatBrlCurrency(save20Budget)}
              </span>
              <span>Poupar 20%</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPreset(breakEvenBudget)}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '12px',
                fontSize: '0.74rem',
                fontWeight: 600,
                backgroundColor: isCurrentAmount(breakEvenBudget) && selectedGoalIds.length === 0
                  ? 'rgba(74, 222, 128, 0.1)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: isCurrentAmount(breakEvenBudget) && selectedGoalIds.length === 0
                  ? '1px solid rgba(74, 222, 128, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.07)',
                color: isCurrentAmount(breakEvenBudget) && selectedGoalIds.length === 0 ? '#4ADE80' : '#8E8E93',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
              }}
            >
              <span style={{ color: isCurrentAmount(breakEvenBudget) && selectedGoalIds.length === 0 ? '#4ADE80' : '#D1D5DB' }}>
                {formatBrlCurrency(breakEvenBudget)}
              </span>
              <span>Teto máximo</span>
            </button>
          </div>
        </div>

        {/* ── 3. ACCORDION: VINCULAR A METAS ─────────────────────────── */}
        {goalsWithDeadline.length > 0 && (
          <div
            style={{
              borderRadius: '14px',
              border: selectedGoalIds.length > 0
                ? '1px solid rgba(56, 189, 248, 0.3)'
                : '1px solid rgba(255, 255, 255, 0.07)',
              overflow: 'hidden',
              transition: 'border-color 0.2s ease',
            }}
          >
            {/* Header do accordion — sempre visível */}
            <button
              type="button"
              onClick={() => setGoalsExpanded(prev => !prev)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: selectedGoalIds.length > 0
                  ? 'rgba(56, 189, 248, 0.07)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={14} color={selectedGoalIds.length > 0 ? '#38BDF8' : '#64748B'} />
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: selectedGoalIds.length > 0 ? '#E2E8F0' : '#94A3B8',
                  }}
                >
                  Vincular a metas com prazo
                </span>
                {selectedGoalIds.length > 0 && (
                  <span
                    style={{
                      fontSize: '0.66rem',
                      padding: '1px 7px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(56, 189, 248, 0.2)',
                      color: '#38BDF8',
                      fontWeight: 700,
                    }}
                  >
                    {selectedGoalIds.length} selecionada{selectedGoalIds.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div style={{ color: '#64748B', display: 'flex' }}>
                {goalsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {/* Corpo expansível */}
            {goalsExpanded && (
              <div
                className="animate-fade-in"
                style={{
                  padding: '0 14px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <p style={{ fontSize: '0.71rem', color: '#8E8E93', margin: '10px 0 4px', lineHeight: 1.35 }}>
                  Selecione as metas que deseja priorizar — o teto diário será ajustado automaticamente.
                </p>

                {/* Lista de Metas */}
                {goalsWithDeadline.map(g => {
                  const isSelected = selectedGoalIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleToggleGoal(g.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        borderRadius: '12px',
                        backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                        border: isSelected ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '5px',
                            border: isSelected ? 'none' : '1px solid rgba(255, 255, 255, 0.25)',
                            backgroundColor: isSelected ? '#38BDF8' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isSelected && <Check size={11} color="#08090A" strokeWidth={3.5} />}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: '0.84rem',
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? '#FFFFFF' : '#D1D5DB',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {g.name}
                          </div>
                          <div style={{ fontSize: '0.69rem', color: '#8E8E93', marginTop: '1px' }}>
                            {g.daysRemaining} dias restantes
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? '#38BDF8' : '#A1A1AA' }}>
                          {formatBrlCurrency(g.dailyNeeded)}
                          <span style={{ fontSize: '0.68rem', fontWeight: 500, color: '#6B7280' }}>/dia</span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Resumo quando há seleção */}
                {selectedGoalIds.length > 0 && (
                  <div
                    className="animate-fade-in"
                    style={{
                      fontSize: '0.72rem',
                      color: '#94A3B8',
                      lineHeight: 1.4,
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    💡 Guardando{' '}
                    <strong style={{ color: '#38BDF8' }}>
                      {formatBrlCurrency(
                        goalsWithDeadline
                          .filter(g => selectedGoalIds.includes(g.id))
                          .reduce((acc, g) => acc + g.dailyNeeded, 0)
                      )}/dia
                    </strong>{' '}
                    para suas metas. Seu teto de gastos é{' '}
                    <strong style={{ color: '#FFFFFF' }}>{formatBrlCurrency(activeAmount)}/dia</strong>.
                  </div>
                )}

                {/* Checkbox "Acompanhar" agora vive dentro do accordion */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontSize: '0.75rem',
                    color: '#8E8E93',
                    marginTop: '4px',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={saveAsGoal}
                    onChange={e => setSaveAsGoal(e.target.checked)}
                    style={{ accentColor: '#4ADE80', width: '14px', height: '14px', cursor: 'pointer' }}
                  />
                  <span>Acompanhar esta meta na aba Planejamento</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* ── 4. AÇÕES ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '2px' }}>
          <button
            type="button"
            onClick={handleSave}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: '14px',
              backgroundColor: '#4ADE80',
              border: 'none',
              color: '#08090A',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Salvar meta
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: currentGoal && onRemoveGoalConfig ? 'space-between' : 'flex-end',
              padding: '0 4px',
            }}
          >
            {currentGoal && onRemoveGoalConfig && (
              <button
                type="button"
                onClick={() => {
                  onRemoveGoalConfig();
                  onClose();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#F87171',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Trash2 size={13} />
                <span>Remover meta</span>
              </button>
            )}

            {onOpenAiChat && (
              <button
                type="button"
                onClick={handleOpenSobiHelp}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '0.76rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
                onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
              >
                <span>Pedir recomendações ao Sobra AI</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>

      </div>
    </Modal>
  );
};
