import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowUpRight, Sparkles } from 'lucide-react';
import { BurnRateProjection } from '../../core/calculations';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { DailySpendingGoal } from '../../screens/DailyBudgetGoalScreen';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from '../common/SwipeBackIndicator';

interface BurnRateProjectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projection: BurnRateProjection;
  isPrivacyMode?: boolean;
  onOpenAiChat?: (prompt?: string) => void;
  onOpenDailyGoal?: (cadence?: 'daily' | 'weekly') => void;
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
  const [dailyGoal, setDailyGoal] = useState<DailySpendingGoal | null>(null);

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const storageKey = `sobra_daily_budget_goal_v1_${currentYear}_${currentMonth}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setDailyGoal(parsed);
      }
    } catch {
      // Ignora erro
    }
  }, [storageKey, isOpen]);

  // Cadência de visualização: padrão sempre 'weekly', mantém 'daily' apenas durante a inspeção/planejamento
  const [cadence, setCadence] = useState<'daily' | 'weekly'>('weekly');

  useEffect(() => {
    if (isOpen) {
      // Sempre reinicia para a visualização padrão semanal ao abrir o modal
      setCadence('weekly');
    }
  }, [isOpen]);

  const swipeState = useSwipeBack({ onBack: onClose, enabled: isOpen });

  if (!isOpen) return null;

  const handleSaveGoal = (goal: DailySpendingGoal) => {
    setDailyGoal(goal);
    if (goal.cadence) {
      setCadence(goal.cadence);
    }
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

  const isWeekly = cadence === 'weekly';
  const cadenceMultiplier = isWeekly ? 7 : 1;
  const suffix = isWeekly ? '/sem' : '/dia';

  const realRate = Math.round(projection.dailyBurnRate * cadenceMultiplier * 100) / 100;
  const ceilingRate = Math.round(activeDailyAmount * cadenceMultiplier * 100) / 100;

  const remainingWeeks = Math.max(1, Math.ceil(projection.remainingDays / 7));
  const elapsedWeeks = Math.max(1, Math.round(projection.elapsedDays / 7));

  const remainingPeriodText = isWeekly
    ? `Restam ${remainingWeeks} ${remainingWeeks === 1 ? 'sem' : 'sem'}`
    : `Restam ${projection.remainingDays} dias`;

  const elapsedPeriodText = isWeekly
    ? `Até hoje (${elapsedWeeks} ${elapsedWeeks === 1 ? 'sem' : 'sem'})`
    : `Até hoje (${projection.elapsedDays} dias)`;

  const handleOpenSobiChat = () => {
    if (!onOpenAiChat) return;

    const isOver = realRate > ceilingRate;
    const diff = Math.abs(realRate - ceilingRate);

    const prompt = `Olá Sobi! Minha análise de ritmo financeiro (${isWeekly ? 'semanal' : 'diária'}) para os próximos ${projection.remainingDays} dias indica:
- Gasto médio real: ${formatBrlCurrency(realRate)}${suffix}
- Teto recomendado / meta: ${formatBrlCurrency(ceilingRate)}${suffix} (${isOver ? `estou ${formatBrlCurrency(diff)}${suffix} acima do teto` : `estou com folga de ${formatBrlCurrency(diff)}${suffix}`}).
- Projeção de sobra no final do mês: ${formatBrlCurrency(projection.projectedSobra)}.

Você pode analisar minhas despesas recentes e me dar um plano ${isWeekly ? 'semanal' : 'diário'} de cortes e recomendações práticas para manter meu consumo dentro desse teto de ${formatBrlCurrency(ceilingRate)}${suffix}?`;

    onClose();
    onOpenAiChat(prompt);
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
              Ritmo de Gastos
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

            {/* Header de Comparativo de Ritmo com Seletor Diário / Semanal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px', marginBottom: '-2px' }}>
              <span style={{ fontSize: '0.80rem', fontWeight: 600, color: '#94A3B8', letterSpacing: '-0.01em' }}>
                Ritmo & Teto de Gastos
              </span>

              {/* Seletor Diário / Semanal Padrão Pierre */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px',
                  backgroundColor: '#16191E',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  gap: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCadence('daily')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '9px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    backgroundColor: cadence === 'daily' ? 'rgba(74, 222, 128, 0.18)' : 'transparent',
                    color: cadence === 'daily' ? '#4ADE80' : '#8E8E93',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Diário
                </button>
                <button
                  type="button"
                  onClick={() => setCadence('weekly')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '9px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    backgroundColor: cadence === 'weekly' ? 'rgba(74, 222, 128, 0.18)' : 'transparent',
                    color: cadence === 'weekly' ? '#4ADE80' : '#8E8E93',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Semanal
                </button>
              </div>
            </div>

            {/* 2. Comparativo de Ritmo (Layout 100% Responsivo, Sem Overflow) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
              {/* Card 1: Gasto Médio Real */}
              <div
                style={{
                  backgroundColor: '#121316',
                  borderRadius: '18px',
                  border: '1px solid #1C1E22',
                  padding: '14px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  minWidth: 0,
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '18px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#8E8E93', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Gasto médio real
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', margin: '2px 0', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                    {maskValue(formatBrlCurrency(realRate))}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 500, flexShrink: 0 }}>{suffix}</span>
                </div>

                <span style={{ fontSize: '0.70rem', color: '#64748B', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {elapsedPeriodText}
                </span>
              </div>

              {/* Card 2: Teto Sugerido / Meta (Alinhado pixel a pixel com o Card 1) */}
              <div
                onClick={() => {
                  if (onOpenDailyGoal) {
                    onClose();
                    onOpenDailyGoal(cadence);
                  }
                }}
                style={{
                  backgroundColor: '#121316',
                  borderRadius: '18px',
                  border: '1px solid #1C1E22',
                  padding: '14px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  minWidth: 0,
                  overflow: 'hidden',
                  boxSizing: 'border-box',
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', minHeight: '18px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#8E8E93', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {dailyGoal ? (isWeekly ? 'Meta semanal' : 'Meta diária') : (isWeekly ? 'Teto semanal' : 'Teto diário')}
                  </span>
                  <span style={{ fontSize: '0.66rem', color: '#4ADE80', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px', lineHeight: 1, flexShrink: 0 }}>
                    <span>Editar</span>
                    <ArrowUpRight size={10} />
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', margin: '2px 0', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                    {maskValue(formatBrlCurrency(ceilingRate))}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 500, flexShrink: 0 }}>{suffix}</span>
                </div>

                <span style={{ fontSize: '0.70rem', color: '#64748B', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {remainingPeriodText}
                </span>
              </div>
            </div>

            {/* 3. Diagnóstico Explicativo com a Inteligência do Sobi */}
            <div
              style={{
                backgroundColor: '#121316',
                borderRadius: '20px',
                border: '1px solid #1C1E22',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={15} color="#4ADE80" />
                  <span>Diagnóstico do ritmo</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>
                  {isWeekly ? 'Visão Semanal' : 'Visão Diária'}
                </span>
              </div>

              {/* Bloco 1: O que está acontecendo (Motivo) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  O que está acontecendo
                </span>
                <p style={{ fontSize: '0.85rem', color: '#CBD5E1', lineHeight: 1.55, margin: 0 }}>
                  {realRate > ceilingRate ? (
                    isWeekly ? (
                      <>
                        Nas semanas decorridas deste mês, seu gasto médio foi de <strong style={{ color: '#F87171' }}>{formatBrlCurrency(realRate)}/sem</strong>, superando o teto seguro de <strong>{formatBrlCurrency(ceilingRate)}/sem</strong>. Mantendo essa velocidade, suas despesas ultrapassarão as receitas em <strong style={{ color: '#F87171' }}>{formatBrlCurrency(Math.abs(projection.projectedSobra))}</strong> até o fim do mês.
                      </>
                    ) : (
                      <>
                        Nos últimos {projection.elapsedDays} dias, seu gasto médio foi de <strong style={{ color: '#F87171' }}>{formatBrlCurrency(realRate)}/dia</strong>, superando o teto seguro de <strong>{formatBrlCurrency(ceilingRate)}/dia</strong>. Mantendo esse ritmo, a projeção é fechar o mês com déficit de <strong style={{ color: '#F87171' }}>{formatBrlCurrency(Math.abs(projection.projectedSobra))}</strong>.
                      </>
                    )
                  ) : (
                    isWeekly ? (
                      <>
                        Seu gasto médio de <strong style={{ color: '#4ADE80' }}>{formatBrlCurrency(realRate)}/sem</strong> está com folga confortável em relação ao teto de <strong>{formatBrlCurrency(ceilingRate)}/sem</strong>. Mantendo essa consistência, você garante a sobra projetada com tranquilidade.
                      </>
                    ) : (
                      <>
                        Seu gasto diário médio de <strong style={{ color: '#4ADE80' }}>{formatBrlCurrency(realRate)}/dia</strong> está bem controlado perante o teto de <strong>{formatBrlCurrency(ceilingRate)}/dia</strong>. Mantendo esse padrão, você acumula a sobra projetada sem sobressaltos.
                      </>
                    )
                  )}
                </p>
              </div>

              {/* Bloco 2: O que fazer agora (Plano de Ação) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  O que fazer agora
                </span>
                <p style={{ fontSize: '0.85rem', color: '#CBD5E1', lineHeight: 1.55, margin: 0 }}>
                  {realRate > ceilingRate ? (
                    isWeekly ? (
                      <>
                        Restam {projection.remainingDays} dias ({remainingWeeks} {remainingWeeks === 1 ? 'semana' : 'semanas'}). Ajustando suas compras para até <strong style={{ color: '#4ADE80' }}>{formatBrlCurrency(ceilingRate)}/sem</strong> a partir de hoje, suas contas voltam para o equilíbrio sem fechar no vermelho.
                      </>
                    ) : (
                      <>
                        Restam {projection.remainingDays} dias no mês. Gastando até <strong style={{ color: '#4ADE80' }}>{formatBrlCurrency(ceilingRate)}/dia</strong> a partir de hoje, suas contas voltam para o equilíbrio com sobra positiva.
                      </>
                    )
                  ) : (
                    isWeekly ? (
                      <>
                        Você possui uma folga média de <strong style={{ color: '#4ADE80' }}>{formatBrlCurrency(ceilingRate - realRate)}/sem</strong>. Aproveite essa disciplina para direcionar a sobra para suas Metas ou Reserva de Emergência (Pague-se Primeiro).
                      </>
                    ) : (
                      <>
                        Você possui uma folga média de <strong style={{ color: '#4ADE80' }}>{formatBrlCurrency(ceilingRate - realRate)}/dia</strong>. Aproveite esse ritmo para alimentar suas Metas ou antecipar sua reserva (Pague-se Primeiro).
                      </>
                    )
                  )}
                </p>
              </div>
            </div>

            {/* 4. Assistente Sobra AI */}
            {onOpenAiChat && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
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
                    padding: '12px 16px',
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
              </div>
            )}

          </div>
        </div>
      </div>

    </>
  );
};
