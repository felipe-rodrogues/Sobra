import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useFinance } from '../../context/FinanceContext';
import { BurnRateProjection } from '../../core/calculations';
import { formatBrlCurrency, parseBrlCurrency } from '../../core/parsers/currencyHelper';
import { SobiAvatar } from '../common/SobiAvatar';
import { 
  Target, 
  Sparkles, 
  Flame, 
  Clock, 
  Check, 
  Sliders, 
  PiggyBank, 
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

  const [mode, setMode] = useState<'suggested' | 'target_sobra' | 'custom_daily'>(
    currentGoal?.mode || 'suggested'
  );

  // Estados dos inputs
  const [targetSobraInput, setTargetSobraInput] = useState<string>(
    currentGoal?.targetSobraAmount ? currentGoal.targetSobraAmount.toFixed(2).replace('.', ',') : '500,00'
  );
  const [customDailyInput, setCustomDailyInput] = useState<string>(
    currentGoal?.mode === 'custom_daily' && currentGoal.dailyAmount
      ? currentGoal.dailyAmount.toFixed(2).replace('.', ',')
      : Math.max(10, Math.round(projection.recommendedDailyBudget)).toString()
  );
  const [saveAsGoal, setSaveAsGoal] = useState<boolean>(false);

  // Sincroniza quando o modal abre ou a prop muda
  useEffect(() => {
    if (isOpen) {
      if (currentGoal) {
        setMode(currentGoal.mode);
        if (currentGoal.targetSobraAmount) {
          setTargetSobraInput(currentGoal.targetSobraAmount.toFixed(2).replace('.', ','));
        }
        if (currentGoal.mode === 'custom_daily') {
          setCustomDailyInput(currentGoal.dailyAmount.toFixed(2).replace('.', ','));
        }
      } else {
        setMode('suggested');
        setCustomDailyInput(
          Math.max(10, Math.round(projection.recommendedDailyBudget)).toString()
        );
      }
    }
  }, [isOpen, currentGoal, projection.recommendedDailyBudget]);

  // Cálculos dinâmicos em tempo real
  const remainingDays = Math.max(1, projection.remainingDays);

  // 1. Modo Sugerido
  const suggestedDaily = projection.recommendedDailyBudget;
  const suggestedProjectedSobra = Math.round(
    (projection.currentIncome - (projection.currentExpense + (suggestedDaily * remainingDays))) * 100
  ) / 100;

  // 2. Modo Meta de Sobra Alvo
  const parsedTargetSobra = parseBrlCurrency(targetSobraInput) ?? 0;
  const allowableFutureExpense = Math.max(
    0,
    projection.currentIncome - projection.currentExpense - parsedTargetSobra
  );
  const calculatedDailyFromSobra = remainingDays > 0 
    ? Math.round((allowableFutureExpense / remainingDays) * 100) / 100
    : 0;

  // 3. Modo Teto Diário Personalizado
  const parsedCustomDaily = parseBrlCurrency(customDailyInput) ?? 0;
  const calculatedSobraFromDaily = Math.round(
    (projection.currentIncome - (projection.currentExpense + (parsedCustomDaily * remainingDays))) * 100
  ) / 100;

  // Determina o teto diário ativo conforme a aba selecionada
  let activeDailyAmount = suggestedDaily;
  let activeProjectedSobra = suggestedProjectedSobra;

  if (mode === 'target_sobra') {
    activeDailyAmount = calculatedDailyFromSobra;
    activeProjectedSobra = parsedTargetSobra;
  } else if (mode === 'custom_daily') {
    activeDailyAmount = parsedCustomDaily;
    activeProjectedSobra = calculatedSobraFromDaily;
  }

  const handleSave = async () => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const goalData: DailySpendingGoal = {
      mode,
      dailyAmount: activeDailyAmount,
      targetSobraAmount: mode === 'target_sobra' ? parsedTargetSobra : undefined,
      savedAt: new Date().toISOString(),
      month,
      year,
      savedAsAppGoal: saveAsGoal,
    };

    // Se o usuário optou por criar uma Meta no planejamento
    if (saveAsGoal) {
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      const targetDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
      const goalTargetVal = mode === 'target_sobra' 
        ? Math.max(10, parsedTargetSobra) 
        : Math.max(10, Math.round(activeDailyAmount * remainingDays));

      await saveGoal({
        name: mode === 'target_sobra' 
          ? `Meta Sobra Fim de Mês (${formatBrlCurrency(parsedTargetSobra)})` 
          : `Teto Diário: ${formatBrlCurrency(activeDailyAmount)}/dia`,
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
      const prompt = `Olá Sobi! Estou planejando minha meta diária de gastos para os próximos ${projection.remainingDays} dias do mês.
- Ritmo atual de consumo: ${formatBrlCurrency(projection.dailyBurnRate)}/dia
- Meta diária que pretendo adotar: ${formatBrlCurrency(activeDailyAmount)}/dia
- Projeção de sobra estimada com essa meta: ${formatBrlCurrency(activeProjectedSobra)}
- Projeção sem controle (ritmo atual): ${formatBrlCurrency(projection.projectedSobra)}

Como você pode me ajudar com um plano de contenção prático? Onde estão meus maiores vazamentos de dinheiro e como distribuir esses ${formatBrlCurrency(activeDailyAmount)}/dia nas minhas categorias?`;
      onOpenAiChat(prompt);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Definir Meta Diária & Sobra"
      subtitle={`Restam ${projection.remainingDays} dias para o fechamento do mês`}
      maxWidth="500px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        
        {/* Banner de Contexto Atual do Mês */}
        <div
          style={{
            backgroundColor: '#121814',
            borderRadius: '16px',
            padding: '14px 16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Flame size={13} color="#FB7185" /> Ritmo Atual (Burn Rate)
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>
              {formatBrlCurrency(projection.dailyBurnRate)}
              <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 500 }}>/dia</span>
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={13} color="#38BDF8" /> Dias Restantes
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38BDF8' }}>
              {projection.remainingDays} dias
              <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 500 }}> (dia {projection.currentDay}/{projection.totalDaysInMonth})</span>
            </span>
          </div>
        </div>

        {/* Seletor de Abas / Modos de Definição */}
        <div>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#CBD5E1', display: 'block', marginBottom: '8px' }}>
            Como deseja estabelecer sua meta?
          </span>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              backgroundColor: '#141C16',
              borderRadius: '12px',
              padding: '4px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => setMode('suggested')}
              style={{
                padding: '8px 6px',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: mode === 'suggested' ? '#22C55E' : 'transparent',
                color: mode === 'suggested' ? '#0A0E0C' : '#94A3B8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <Target size={13} />
              <span>Sugerida</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('target_sobra')}
              style={{
                padding: '8px 6px',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: mode === 'target_sobra' ? '#22C55E' : 'transparent',
                color: mode === 'target_sobra' ? '#0A0E0C' : '#94A3B8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <PiggyBank size={13} />
              <span>Sobra Alvo</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('custom_daily')}
              style={{
                padding: '8px 6px',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: mode === 'custom_daily' ? '#22C55E' : 'transparent',
                color: mode === 'custom_daily' ? '#0A0E0C' : '#94A3B8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <Sliders size={13} />
              <span>Personalizar</span>
            </button>
          </div>
        </div>

        {/* Conteúdo Dinâmico do Modo */}
        <div
          style={{
            backgroundColor: '#161F18',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* MODO 1: Sugerido */}
          {mode === 'suggested' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>
                  Meta Diária Recomendada:
                </span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#34D399', letterSpacing: '-0.02em' }}>
                  {formatBrlCurrency(suggestedDaily)}
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 500 }}>/dia</span>
                </span>
              </div>
              <p style={{ fontSize: '0.76rem', color: '#94A3B8', margin: 0, lineHeight: 1.45 }}>
                Essa meta é calculada dividindo o saldo ainda disponível pelas receitas cadastradas até o fim do mês, garantindo que suas contas fechem sem gerar déficit.
              </p>
            </div>
          )}

          {/* MODO 2: Meta de Sobra Alvo */}
          {mode === 'target_sobra' && (
            <div>
              <label style={{ fontSize: '0.78rem', color: '#CBD5E1', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Quanto você quer que sobre no final do mês?
              </label>
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontWeight: 700, fontSize: '0.85rem' }}>
                  R$
                </span>
                <input
                  type="text"
                  value={targetSobraInput}
                  onChange={e => setTargetSobraInput(e.target.value)}
                  placeholder="0,00"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: '10px',
                    backgroundColor: '#101612',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#FFFFFF',
                    fontSize: '1rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(52, 211, 153, 0.08)',
                  border: '1px solid rgba(52, 211, 153, 0.25)',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.76rem', color: '#CBD5E1' }}>
                  Teto diário necessário para essa sobra:
                </span>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#34D399' }}>
                  {formatBrlCurrency(calculatedDailyFromSobra)}/dia
                </span>
              </div>
            </div>
          )}

          {/* MODO 3: Teto Diário Personalizado */}
          {mode === 'custom_daily' && (
            <div>
              <label style={{ fontSize: '0.78rem', color: '#CBD5E1', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Defina seu limite máximo de gasto por dia:
              </label>
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontWeight: 700, fontSize: '0.85rem' }}>
                  R$
                </span>
                <input
                  type="text"
                  value={customDailyInput}
                  onChange={e => setCustomDailyInput(e.target.value)}
                  placeholder="0,00"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: '10px',
                    backgroundColor: '#101612',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#FFFFFF',
                    fontSize: '1rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div
                style={{
                  backgroundColor: calculatedSobraFromDaily >= 0 ? 'rgba(52, 211, 153, 0.08)' : 'rgba(244, 63, 94, 0.08)',
                  border: `1px solid ${calculatedSobraFromDaily >= 0 ? 'rgba(52, 211, 153, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
                  borderRadius: '12px',
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.76rem', color: '#CBD5E1' }}>
                  Sobra resultante no fim do mês:
                </span>
                <span
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    color: calculatedSobraFromDaily >= 0 ? '#34D399' : '#FB7185',
                  }}
                >
                  {calculatedSobraFromDaily >= 0 ? '+' : ''}
                  {formatBrlCurrency(calculatedSobraFromDaily)}
                </span>
              </div>
            </div>
          )}

          {/* Comparativo Imediato com o Ritmo Atual */}
          <div
            style={{
              paddingTop: '10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.74rem',
            }}
          >
            <span style={{ color: '#94A3B8' }}>Desafio do Ritmo:</span>
            {projection.dailyBurnRate > activeDailyAmount ? (
              <span style={{ color: '#FB7185', fontWeight: 700 }}>
                Reduzir {formatBrlCurrency(projection.dailyBurnRate - activeDailyAmount)}/dia
              </span>
            ) : (
              <span style={{ color: '#34D399', fontWeight: 700 }}>
                Dentro da margem (+{formatBrlCurrency(activeDailyAmount - projection.dailyBurnRate)}/dia)
              </span>
            )}
          </div>
        </div>

        {/* Checkbox: Adicionar ao Planejamento Oficial */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            backgroundColor: '#121814',
            padding: '10px 14px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <input
            type="checkbox"
            checked={saveAsGoal}
            onChange={e => setSaveAsGoal(e.target.checked)}
            style={{
              accentColor: '#22C55E',
              width: '16px',
              height: '16px',
              cursor: 'pointer',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF' }}>
              Adicionar às Metas do Planejamento
            </span>
            <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
              Cria um registro oficial na aba Planejamento para acompanhar seu progresso
            </span>
          </div>
        </label>

        {/* Card de Ação Rápida com Sobi (IA) */}
        {onOpenAiChat && (
          <div
            onClick={handleOpenSobiHelp}
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(74, 222, 128, 0.25)',
              borderRadius: '14px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.16)';
              e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.45)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.25)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <SobiAvatar expression="pensativo" size={34} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#4ADE80' }}>
                    Consultar o Sobi (IA)
                  </span>
                  <Sparkles size={13} color="#4ADE80" />
                </div>
                <span style={{ fontSize: '0.7rem', color: '#CBD5E1' }}>
                  Pedir plano de cortes diários para cumprir esta meta
                </span>
              </div>
            </div>
            <ArrowRight size={16} color="#4ADE80" />
          </div>
        )}

        {/* Botões de Ação Inferiores */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '6px' }}>
          {currentGoal && onRemoveGoalConfig ? (
            <button
              type="button"
              onClick={() => {
                onRemoveGoalConfig();
                onClose();
              }}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#FB7185',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Trash2 size={14} />
              <span>Remover Meta</span>
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94A3B8',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                backgroundColor: '#22C55E',
                border: 'none',
                color: '#0A0E0C',
                fontSize: '0.84rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
              }}
            >
              <Check size={16} strokeWidth={2.5} />
              <span>Fixar Meta Diária</span>
            </button>
          </div>
        </div>

      </div>
    </Modal>
  );
};
