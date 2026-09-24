import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { BurnRateProjection } from '../../core/calculations';
import { 
  Flame, 
  Gauge, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock, 
  ArrowRight,
  Sparkles,
  Pencil
} from 'lucide-react';
import { DailySpendingGoal } from '../../screens/DailyBudgetGoalScreen';

interface BurnRateProjectionCardProps {
  projection: BurnRateProjection;
  maskValue: (v: string) => string;
  onNavigate?: (tab: string) => void;
  onOpenAiChat?: (prompt?: string) => void;
}

export const BurnRateProjectionCard: React.FC<BurnRateProjectionCardProps> = ({
  projection,
  maskValue,
  onNavigate,
  onOpenAiChat,
}) => {
  const { colors } = useTheme();

  // Estado da Meta Diária Customizada
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

  const isPositive = projection.projectedSobra >= 0;

  const getPaceBadge = () => {
    switch (projection.paceStatus) {
      case 'surplus':
        return {
          label: 'Superávit Saudável',
          color: '#10B981',
          bg: 'rgba(16, 185, 129, 0.15)',
          border: 'rgba(16, 185, 129, 0.3)',
        };
      case 'on_track':
        return {
          label: 'No Ritmo Previsto',
          color: '#38BDF8',
          bg: 'rgba(56, 189, 248, 0.15)',
          border: 'rgba(56, 189, 248, 0.3)',
        };
      case 'fast_burn':
        return {
          label: 'Ritmo Acelerado',
          color: '#F43F5E',
          bg: 'rgba(244, 63, 94, 0.15)',
          border: 'rgba(244, 63, 94, 0.3)',
        };
    }
  };

  const badge = getPaceBadge();

  // Valor diário ativo exibido (personalizado ou o recomendado automaticamente)
  const activeDailyAmount = dailyGoal?.dailyAmount ?? projection.recommendedDailyBudget;

  const handleOpenSobiChat = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!onOpenAiChat) return;

    if (dailyGoal) {
      const isOver = projection.dailyBurnRate > dailyGoal.dailyAmount;
      const diff = Math.abs(projection.dailyBurnRate - dailyGoal.dailyAmount);
      const prompt = `Olá Sobi! Minha meta diária definida para os próximos ${projection.remainingDays} dias é de ${formatBrlCurrency(dailyGoal.dailyAmount)}/dia.
No entanto, meu ritmo médio atual de consumo é de ${formatBrlCurrency(projection.dailyBurnRate)}/dia (${isOver ? `estou ${formatBrlCurrency(diff)}/dia acima da meta` : `estou ${formatBrlCurrency(diff)}/dia dentro da margem`}).
Projeção de sobra no final do mês: ${formatBrlCurrency(projection.projectedSobra)}.

Você pode analisar minhas despesas e me dar um plano diário de cortes e recomendações para eu conseguir cumprir esse teto de ${formatBrlCurrency(dailyGoal.dailyAmount)}/dia até o fim do mês?`;
      onOpenAiChat(prompt);
    } else {
      const prompt = `Olá Sobi! O Sobra sugeriu uma meta diária de ${formatBrlCurrency(projection.recommendedDailyBudget)}/dia para os próximos ${projection.remainingDays} dias do mês, enquanto meu ritmo de gasto real está em ${formatBrlCurrency(projection.dailyBurnRate)}/dia (projeção de sobra: ${formatBrlCurrency(projection.projectedSobra)}).

Como você pode me ajudar a montar um plano de equilíbrio diário e onde posso cortar gastos imediatamente para não fechar o mês no vermelho?`;
      onOpenAiChat(prompt);
    }
  };

  return (
    <>
      <div
        style={{
          backgroundColor: '#121814',
          borderRadius: '24px',
          padding: '20px 22px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Luz ambiente de fundo no topo direito */}
        <div
          style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            backgroundColor: isPositive ? 'rgba(34, 197, 94, 0.07)' : 'rgba(244, 63, 94, 0.07)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />

        {/* Topo do Card */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4ADE80',
              }}
            >
              <Gauge size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em', margin: 0 }}>
                Projeção de Sobra & Burn Rate
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                Estimativa baseada no seu ritmo real de consumo
              </span>
            </div>
          </div>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: badge.bg,
              color: badge.color,
              border: `1px solid ${badge.border}`,
              fontSize: '0.73rem',
              fontWeight: 700,
            }}
          >
            {badge.label}
          </span>
        </div>

        {/* Métrica Principal: Projeção de Sobra no Fim do Mês */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '16px',
            padding: '16px 18px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Sobra Estimada no Fim do Mês ({projection.totalDaysInMonth} dias)
          </span>
          <div
            style={{
              fontSize: '1.9rem',
              fontWeight: 900,
              color: isPositive ? '#34D399' : '#FB7185',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isPositive ? <TrendingUp size={28} color="#34D399" /> : <TrendingDown size={28} color="#FB7185" />}
            <span>{isPositive ? '+' : ''}{maskValue(formatBrlCurrency(projection.projectedSobra))}</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#CBD5E1', margin: '4px 0 0' }}>
            {projection.paceMessage}
          </p>
        </div>

        {/* Barra de Progresso do Mês */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
            <span style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={13} />
              Dia {projection.currentDay} de {projection.totalDaysInMonth}
            </span>
            <span style={{ color: '#E2E8F0', fontWeight: 700 }}>
              {projection.monthProgressPercent}% do mês decorrido
            </span>
          </div>

          <div
            style={{
              width: '100%',
              height: '7px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${projection.monthProgressPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #38BDF8 0%, #10B981 100%)',
                borderRadius: '9999px',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>

        {/* 2 Métricas Comparativas: Burn Rate vs Meta Diária */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {/* Gasto Médio Diário */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '14px',
              padding: '12px 14px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Flame size={14} color="#FB7185" />
                <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>
                  Gasto Médio (Burn Rate)
                </span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF' }}>
                {maskValue(formatBrlCurrency(projection.dailyBurnRate))}
                <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 500 }}>/dia</span>
              </div>
            </div>
            <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginTop: '6px' }}>
              Média real até o dia {projection.currentDay}
            </span>
          </div>

          {/* Teto Diário Recomendado ou Meta Definida */}
          <div
            onClick={() => onNavigate?.('daily_goal')}
            style={{
              backgroundColor: dailyGoal ? 'rgba(34, 197, 94, 0.05)' : 'rgba(255, 255, 255, 0.03)',
              borderRadius: '14px',
              padding: '12px 14px',
              border: dailyGoal ? '1px solid rgba(74, 222, 128, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              position: 'relative',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.4)';
              e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = dailyGoal ? 'rgba(74, 222, 128, 0.25)' : 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.backgroundColor = dailyGoal ? 'rgba(34, 197, 94, 0.05)' : 'rgba(255, 255, 255, 0.03)';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={14} color="#34D399" />
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>
                    {dailyGoal ? 'Meta Diária' : 'Meta Diária Sugerida'}
                  </span>
                </div>
                {dailyGoal && (
                  <span
                    style={{
                      fontSize: '0.6rem',
                      padding: '1px 5px',
                      borderRadius: '5px',
                      backgroundColor: 'rgba(34, 197, 94, 0.15)',
                      color: '#4ADE80',
                      fontWeight: 700,
                      border: '1px solid rgba(74, 222, 128, 0.3)',
                    }}
                  >
                    Ativa
                  </span>
                )}
              </div>

              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#34D399' }}>
                {maskValue(formatBrlCurrency(activeDailyAmount))}
                <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 500 }}>/dia</span>
              </div>

              {/* Comparativo Dinâmico */}
              <div style={{ marginTop: '2px', fontSize: '0.68rem', lineHeight: 1.3 }}>
                {dailyGoal ? (
                  projection.dailyBurnRate > dailyGoal.dailyAmount ? (
                    <span style={{ color: '#FB7185', fontWeight: 700 }}>
                      🚨 {formatBrlCurrency(projection.dailyBurnRate - dailyGoal.dailyAmount)}/dia acima
                    </span>
                  ) : (
                    <span style={{ color: '#34D399', fontWeight: 700 }}>
                      ✅ Dentro da meta diária
                    </span>
                  )
                ) : (
                  <span style={{ color: '#64748B' }}>
                    Nos {projection.remainingDays} dias restantes
                  </span>
                )}
              </div>
            </div>

            {/* Micro-botões de Ação na base do Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '10px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate?.('daily_goal');
                }}
                style={{
                  flex: 1,
                  padding: '4px 6px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(74, 222, 128, 0.2)',
                  color: '#4ADE80',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
                title={dailyGoal ? 'Ajustar meta diária' : 'Definir meta a partir da sugestão'}
              >
                {dailyGoal ? <Pencil size={10} /> : <Target size={10} />}
                <span>{dailyGoal ? 'Ajustar' : 'Definir'}</span>
              </button>

              {onOpenAiChat && (
                <button
                  type="button"
                  onClick={handleOpenSobiChat}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    color: '#38BDF8',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                  title="Conversar com o Sobi (IA) sobre esta meta"
                >
                  <Sparkles size={11} />
                  <span>IA</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Faixa Interativa Inteligente com Sobi */}
        {onOpenAiChat && (
          <div
            onClick={handleOpenSobiChat}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '12px',
              padding: '8px 12px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.06)';
              e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.2)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={14} color="#4ADE80" />
              <span style={{ fontSize: '0.74rem', color: '#CBD5E1', fontWeight: 500 }}>
                {dailyGoal
                  ? `Como respeitar o teto de ${formatBrlCurrency(dailyGoal.dailyAmount)}/dia? Fale com a IA`
                  : `Deseja um plano para atingir os ${formatBrlCurrency(projection.recommendedDailyBudget)}/dia? Fale com o Sobi`}
              </span>
            </div>
            <ArrowRight size={13} color="#94A3B8" />
          </div>
        )}
      </div>

    </>
  );
};
