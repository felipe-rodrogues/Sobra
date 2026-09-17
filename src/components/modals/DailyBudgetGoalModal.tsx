import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useFinance } from '../../context/FinanceContext';
import { BurnRateProjection } from '../../core/calculations';
import { formatBrlCurrency, parseBrlCurrency } from '../../core/parsers/currencyHelper';
import { 
  Trash2,
  ArrowRight
} from 'lucide-react';

export interface DailySpendingGoal {
  mode: 'suggested' | 'target_sobra' | 'custom_daily';
  dailyAmount: number;
  targetSobraAmount?: number;
  savedAt: string;
  month: number;
  year: number;
  savedAsAppGoal?: boolean;
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
  const { saveGoal } = useFinance();

  const remainingDays = Math.max(1, projection.remainingDays);

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

  // Estado do valor diário digitado
  const [customDailyInput, setCustomDailyInput] = useState<string>(
    currentGoal?.dailyAmount
      ? currentGoal.dailyAmount.toFixed(2).replace('.', ',')
      : smartComfortBudget.toFixed(2).replace('.', ',')
  );
  const [saveAsGoal, setSaveAsGoal] = useState<boolean>(false);

  // Sincroniza quando o modal abre
  useEffect(() => {
    if (isOpen) {
      if (currentGoal?.dailyAmount) {
        setCustomDailyInput(currentGoal.dailyAmount.toFixed(2).replace('.', ','));
      } else {
        setCustomDailyInput(smartComfortBudget.toFixed(2).replace('.', ','));
      }
    }
  }, [isOpen, currentGoal, smartComfortBudget]);

  const activeAmount = Math.max(0, parseBrlCurrency(customDailyInput) ?? 0);
  const calculatedSobra = Math.round(
    (projection.currentIncome - (projection.currentExpense + (activeAmount * remainingDays))) * 100
  ) / 100;

  const isCurrentAmount = (targetVal: number) => {
    return Math.abs(activeAmount - targetVal) < 0.05;
  };

  const handleSave = async () => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const goalData: DailySpendingGoal = {
      mode: isCurrentAmount(smartComfortBudget) ? 'suggested' : 'custom_daily',
      dailyAmount: activeAmount,
      targetSobraAmount: calculatedSobra > 0 ? calculatedSobra : undefined,
      savedAt: new Date().toISOString(),
      month,
      year,
      savedAsAppGoal: saveAsGoal,
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
      const prompt = `Olá Sobra AI! Estou planejando um teto diário de gastos de ${formatBrlCurrency(activeAmount)}/dia para os próximos ${projection.remainingDays} dias.
- Meu gasto médio real até hoje: ${formatBrlCurrency(projection.dailyBurnRate)}/dia
- Sobra estimada com essa meta: ${formatBrlCurrency(calculatedSobra)}

Quais recomendações práticas você me dá para manter meu consumo dentro desse limite com tranquilidade?`;
      onOpenAiChat(prompt);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Definir Meta Diária"
      subtitle={`Gasto real até hoje: ${formatBrlCurrency(projection.dailyBurnRate)}/dia • Restam ${projection.remainingDays} dias para o fim do mês`}
      maxWidth="420px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* Bloco Central Limpo: Valor + Consequência (Sem caixas aninhadas) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '6px 0 2px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#8E8E93' }}>
              R$
            </span>
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
                fontSize: '2.4rem',
                fontWeight: 800,
                outline: 'none',
                textAlign: 'center',
                letterSpacing: '-0.02em',
                lineHeight: 1,
                padding: '0 0 2px',
              }}
            />
            <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 500 }}>
              /dia
            </span>
          </div>

          <span style={{ fontSize: '0.84rem', color: '#94A3B8', marginTop: '10px' }}>
            sobra estimada no fim do mês:{' '}
            <strong style={{ color: calculatedSobra >= 0 ? '#4ADE80' : '#F87171', fontWeight: 700 }}>
              {calculatedSobra >= 0 ? '+' : ''}{formatBrlCurrency(calculatedSobra)}
            </strong>
          </span>

          <span style={{ fontSize: '0.74rem', color: activeAmount >= projection.dailyBurnRate ? '#4ADE80' : '#F87171', marginTop: '3px' }}>
            {activeAmount >= projection.dailyBurnRate
              ? `Folga de ${formatBrlCurrency(activeAmount - projection.dailyBurnRate)}/dia sobre seu ritmo atual`
              : `Exigirá economizar ${formatBrlCurrency(projection.dailyBurnRate - activeAmount)}/dia sobre seu ritmo atual`}
          </span>
        </div>

        {/* Atalhos Rápidos Discretos em Pílula Horizontal */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setCustomDailyInput(smartComfortBudget.toFixed(2).replace('.', ','))}
            style={{
              padding: '6px 12px',
              borderRadius: '9999px',
              fontSize: '0.74rem',
              fontWeight: 600,
              backgroundColor: isCurrentAmount(smartComfortBudget) ? 'rgba(74, 222, 128, 0.12)' : '#121316',
              border: isCurrentAmount(smartComfortBudget) ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid #1C1E22',
              color: isCurrentAmount(smartComfortBudget) ? '#4ADE80' : '#8E8E93',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Recomendado: {formatBrlCurrency(smartComfortBudget)}
          </button>

          <button
            type="button"
            onClick={() => setCustomDailyInput(save20Budget.toFixed(2).replace('.', ','))}
            style={{
              padding: '6px 12px',
              borderRadius: '9999px',
              fontSize: '0.74rem',
              fontWeight: 600,
              backgroundColor: isCurrentAmount(save20Budget) ? 'rgba(74, 222, 128, 0.12)' : '#121316',
              border: isCurrentAmount(save20Budget) ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid #1C1E22',
              color: isCurrentAmount(save20Budget) ? '#4ADE80' : '#8E8E93',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Poupar 20%: {formatBrlCurrency(save20Budget)}
          </button>

          <button
            type="button"
            onClick={() => setCustomDailyInput(breakEvenBudget.toFixed(2).replace('.', ','))}
            style={{
              padding: '6px 12px',
              borderRadius: '9999px',
              fontSize: '0.74rem',
              fontWeight: 600,
              backgroundColor: isCurrentAmount(breakEvenBudget) ? 'rgba(74, 222, 128, 0.12)' : '#121316',
              border: isCurrentAmount(breakEvenBudget) ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid #1C1E22',
              color: isCurrentAmount(breakEvenBudget) ? '#4ADE80' : '#8E8E93',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Teto máximo: {formatBrlCurrency(breakEvenBudget)}
          </button>
        </div>

        {/* Checkbox Discreto de 1 Linha */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: '0.78rem',
            color: '#8E8E93',
            margin: '2px 0',
          }}
        >
          <input
            type="checkbox"
            checked={saveAsGoal}
            onChange={e => setSaveAsGoal(e.target.checked)}
            style={{
              accentColor: '#4ADE80',
              width: '15px',
              height: '15px',
              cursor: 'pointer',
            }}
          />
          <span>Acompanhar esta meta na aba Planejamento</span>
        </label>

        {/* Ação Primária & Secundárias */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.92')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Salvar meta
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: currentGoal && onRemoveGoalConfig ? 'space-between' : 'center',
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
