import React, { useState, useEffect } from 'react';
import { ArrowLeft, SlidersHorizontal, ArrowUpRight, Sparkles } from 'lucide-react';
import { BurnRateProjection } from '../../core/calculations';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { DailyBudgetGoalModal, DailySpendingGoal } from './DailyBudgetGoalModal';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from '../common/SwipeBackIndicator';

interface BurnRateProjectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projection: BurnRateProjection;
  isPrivacyMode?: boolean;
  onOpenAiChat?: (prompt?: string) => void;
  onOpenDailyGoal?: () => void;
  onCreateGoal?: () => void;
}

export const BurnRateProjectionModal: React.FC<BurnRateProjectionModalProps> = ({
  isOpen,
  onClose,
  projection,
  isPrivacyMode = false,
  onOpenAiChat,
  onOpenDailyGoal,
  onCreateGoal,
}) => {
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [dailyGoal, setDailyGoal] = useState<DailySpendingGoal | null>(null);

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const storageKey = `sobra_daily_budget_goal_v1_${currentYear}_${currentMonth}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setDailyGoal(JSON.parse(saved));
      }
    } catch {
      // Ignora erro
    }
  }, [storageKey]);

  const swipeState = useSwipeBack({ onBack: onClose, enabled: isOpen && !isGoalModalOpen });

  if (!isOpen) return null;

  const handleSaveGoal = (goal: DailySpendingGoal) => {
    setDailyGoal(goal);
    try {
      localStorage.setItem(storageKey, JSON.stringify(goal));
    } catch {
      // Ignora erro
    }
  };

  const handleRemoveGoal = () => {
    setDailyGoal(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignora erro
    }
  };

  const maskValue = (v: string) => isPrivacyMode ? '••••••' : v;
  const isPositive = projection.projectedSobra >= 0;

  const getPaceStatus = () => {
    switch (projection.paceStatus) {
      case 'surplus':
        return {
          label: 'Superávit saudável',
          color: '#4ADE80',
        };
      case 'on_track':
        return {
          label: 'No ritmo previsto',
          color: '#38BDF8',
        };
      case 'fast_burn':
        return {
          label: 'Ritmo acelerado',
          color: '#F87171',
        };
    }
  };

  const status = getPaceStatus();
  const activeDailyAmount = dailyGoal?.dailyAmount ?? projection.recommendedDailyBudget;

  const handleOpenSobiChat = () => {
    if (!onOpenAiChat) return;

    if (dailyGoal) {
      const isOver = projection.dailyBurnRate > dailyGoal.dailyAmount;
      const diff = Math.abs(projection.dailyBurnRate - dailyGoal.dailyAmount);
      const prompt = `Olá Sobi! Minha meta diária definida para os próximos ${projection.remainingDays} dias é de ${formatBrlCurrency(dailyGoal.dailyAmount)}/dia.
No entanto, meu ritmo médio atual de consumo é de ${formatBrlCurrency(projection.dailyBurnRate)}/dia (${isOver ? `estou ${formatBrlCurrency(diff)}/dia acima da meta` : `estou ${formatBrlCurrency(diff)}/dia dentro da margem`}).
Projeção de sobra no final do mês: ${formatBrlCurrency(projection.projectedSobra)}.

Você pode analisar minhas despesas e me dar um plano diário de cortes e recomendações para eu conseguir cumprir esse teto de ${formatBrlCurrency(dailyGoal.dailyAmount)}/dia até o fim do mês?`;
      onClose();
      onOpenAiChat(prompt);
    } else {
      const prompt = `Olá Sobi! O Sobra sugeriu uma meta diária de ${formatBrlCurrency(projection.recommendedDailyBudget)}/dia para os próximos ${projection.remainingDays} dias do mês, enquanto meu ritmo de gasto real está em ${formatBrlCurrency(projection.dailyBurnRate)}/dia (projeção de sobra: ${formatBrlCurrency(projection.projectedSobra)}).

Como você pode me ajudar a montar um plano de equilíbrio diário e onde posso cortar gastos imediatamente para não fechar o mês no vermelho?`;
      onClose();
      onOpenAiChat(prompt);
    }
  };

  return (
    <>
      <SwipeBackIndicator swipeState={swipeState} />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 2500,
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
          padding: 0,
          boxSizing: 'border-box',
        }}
        onClick={onClose}
      >
        <div
          className="animate-slide-up hide-scrollbar"
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '460px',
            height: '100%',
            minHeight: '100vh',
            backgroundColor: '#0B0C0E',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            position: 'relative',
            boxSizing: 'border-box',
            paddingBottom: 'calc(120px + var(--safe-area-bottom, 0px))',
          }}
        >
          {/* Header Pierre Limpo e Simétrico */}
          <header
            style={{
              padding: 'calc(var(--safe-area-top, 0px) + 12px) 20px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'sticky',
              top: 0,
              backgroundColor: '#0B0C0E',
              zIndex: 30,
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              title="Voltar"
            >
              <ArrowLeft size={19} />
            </button>

            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
              Projeção de Sobra
            </span>

            <div style={{ width: '42px' }} />
          </header>

          {/* Conteúdo com Respiro e Tipografia Natural */}
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* 1. Hero Card: Previsão no Fim do Mês */}
            <div
              style={{
                backgroundColor: '#121316',
                borderRadius: '24px',
                border: '1px solid #1C1E22',
                padding: '22px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {/* Contexto do Hero */}
              <span style={{ fontSize: '0.82rem', color: '#8E8E93', fontWeight: 500, letterSpacing: '-0.01em' }}>
                Previsão para o fim do mês
              </span>

              {/* Valor Principal Imponente */}
              <div style={{ display: 'flex', alignItems: 'baseline', margin: '2px 0' }}>
                <span
                  style={{
                    fontSize: '2.75rem',
                    fontWeight: 800,
                    color: isPositive ? '#FFFFFF' : '#F87171',
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                  }}
                >
                  {maskValue(
                    `${isPositive ? '+' : ''}${formatBrlCurrency(projection.projectedSobra)}`
                  )}
                </span>
              </div>

              {/* Status Sutil em Pílula Elegante */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: status.color,
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  alignSelf: 'flex-start',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
                <span>{status.label}</span>
              </div>

              <p style={{ fontSize: '0.86rem', color: '#94A3B8', margin: '2px 0 0', lineHeight: 1.5 }}>
                {projection.paceMessage}
              </p>

              {/* Linha Temporal Fina e Calma */}
              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#64748B' }}>
                  <span>{`Dia ${projection.currentDay} de ${projection.totalDaysInMonth}`}</span>
                  <span>{`${projection.monthProgressPercent}% do mês`}</span>
                </div>
                <div
                  style={{
                    height: '4px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(255, 255, 255, 0.07)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, projection.monthProgressPercent)}%`,
                      backgroundColor: '#4ADE80',
                      borderRadius: '9999px',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 2. Comparativo de Ritmo (Layout 100% Alinhado, Sem Quebra de Linhas Indesejadas) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Card 1: Gasto Médio Real */}
              <div
                style={{
                  backgroundColor: '#121316',
                  borderRadius: '20px',
                  border: '1px solid #1C1E22',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '18px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#8E8E93', whiteSpace: 'nowrap' }}>
                    Gasto médio real
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '2px 0' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    {maskValue(formatBrlCurrency(projection.dailyBurnRate))}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>/dia</span>
                </div>

                <span style={{ fontSize: '0.72rem', color: '#64748B', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                  {`Até hoje (${projection.elapsedDays} dias)`}
                </span>
              </div>

              {/* Card 2: Teto Sugerido / Meta (Alinhado pixel a pixel com o Card 1) */}
              <div
                onClick={() => {
                  if (onOpenDailyGoal) {
                    onClose();
                    onOpenDailyGoal();
                  } else {
                    setIsGoalModalOpen(true);
                  }
                }}
                style={{
                  backgroundColor: '#121316',
                  borderRadius: '20px',
                  border: '1px solid #1C1E22',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#16181C';
                  e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.25)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#121316';
                  e.currentTarget.style.borderColor = '#1C1E22';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '18px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#8E8E93', whiteSpace: 'nowrap' }}>
                    {dailyGoal ? 'Sua meta' : 'Teto diário'}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#4ADE80', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px', lineHeight: 1 }}>
                    <span>Editar</span>
                    <ArrowUpRight size={11} />
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '2px 0' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#4ADE80', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    {maskValue(formatBrlCurrency(activeDailyAmount))}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>/dia</span>
                </div>

                <span style={{ fontSize: '0.72rem', color: '#64748B', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                  {`Nos ${projection.remainingDays} dias restantes`}
                </span>
              </div>
            </div>

            {/* 3. Síntese Conversacional Natural (Sem caixas de ícones ou clichês de IA) */}
            <div
              style={{
                backgroundColor: '#121316',
                borderRadius: '20px',
                border: '1px solid #1C1E22',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#FFFFFF' }}>
                Diagnóstico do ritmo
              </div>

              <p style={{ fontSize: '0.86rem', color: '#CBD5E1', lineHeight: 1.55, margin: 0 }}>
                {projection.dailyBurnRate <= activeDailyAmount
                  ? `Seu gasto diário médio de ${formatBrlCurrency(projection.dailyBurnRate)} está com boa folga em relação ao teto de ${formatBrlCurrency(activeDailyAmount)}/dia. Mantendo esse padrão, você acumula a sobra projetada com tranquilidade.`
                  : `Seu consumo diário está um pouco acima do recomendado. Gastando até ${formatBrlCurrency(activeDailyAmount)}/dia nos próximos ${projection.remainingDays} dias, suas contas voltam ao equilíbrio com sobra positiva.`}
              </p>
            </div>

            {/* 4. Ação Principal Única (Design Focado e Sem Exageros) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setIsGoalModalOpen(true)}
                style={{
                  width: '100%',
                  padding: '13px 20px',
                  borderRadius: '14px',
                  backgroundColor: '#4ADE80',
                  border: 'none',
                  color: '#08090A',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.95')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <SlidersHorizontal size={17} />
                <span>{dailyGoal ? 'Ajustar Meta Diária de Gastos' : 'Definir Meta Diária de Gastos'}</span>
              </button>

              {onOpenAiChat && (
                <button
                  type="button"
                  onClick={handleOpenSobiChat}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    color: '#E2E8F0',
                    fontSize: '0.84rem',
                    fontWeight: 500,
                    padding: '11px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#FFFFFF';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = '#E2E8F0';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                >
                  <Sparkles size={14} color="#4ADE80" />
                  <span>Pedir recomendações ao Sobra AI</span>
                  <ArrowUpRight size={13} color="#94A3B8" />
                </button>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Modal de Configuração de Meta Diária */}
      {isGoalModalOpen && (
        <DailyBudgetGoalModal
          isOpen={isGoalModalOpen}
          onClose={() => setIsGoalModalOpen(false)}
          projection={projection}
          currentGoal={dailyGoal}
          onSaveGoalConfig={handleSaveGoal}
          onRemoveGoalConfig={handleRemoveGoal}
          onOpenAiChat={onOpenAiChat}
          onCreateGoal={() => {
            setIsGoalModalOpen(false);
            if (onCreateGoal) {
              onCreateGoal();
            }
          }}
        />
      )}
    </>
  );
};
