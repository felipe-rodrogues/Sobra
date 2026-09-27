import React from 'react';
import { 
  ShieldCheck, 
  Check, 
  Lock, 
  AlertTriangle, 
  TrendingUp, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { FinancialLadderProgress, SobraHealthScore } from '../../core/ai/types';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';

export interface FinancialLadderHeroProps {
  score: SobraHealthScore;
  ladder?: FinancialLadderProgress;
  onActionClick?: () => void;
}

export const FinancialLadderHero: React.FC<FinancialLadderHeroProps> = ({
  score,
  ladder,
  onActionClick,
}) => {
  const currentStage = ladder?.currentStage || 'emergency_fund';
  const monthsProtected = Number(ladder?.monthsProtected || 0);
  const emergencyFundCurrent = Number(ladder?.emergencyFundCurrent || 0);
  const emergencyFundTarget = Number(ladder?.emergencyFundTarget || 0);
  const percentProgress = Math.min(100, Math.max(0, Number(ladder?.percentProgress || 0)));
  const nextMilestoneLabel = ladder?.nextMilestoneLabel || '';
  const debtAlertDetails = ladder?.debtAlertDetails;

  const getScoreStatusLabel = (status: string) => {
    switch (status) {
      case 'excelente': return 'Ritmo excelente';
      case 'bom': return 'Equilibrado';
      case 'atencao': return 'Requer atenção';
      default: return 'Atenção às contas';
    }
  };

  const getScoreBadgeColors = (status: string) => {
    switch (status) {
      case 'excelente':
        return {
          color: '#4ADE80',
          backgroundColor: 'rgba(74, 222, 128, 0.12)',
          border: '1px solid rgba(74, 222, 128, 0.22)',
        };
      case 'bom':
        return {
          color: '#38BDF8',
          backgroundColor: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.22)',
        };
      case 'atencao':
        return {
          color: '#FBBF24',
          backgroundColor: 'rgba(251, 191, 36, 0.12)',
          border: '1px solid rgba(251, 191, 36, 0.22)',
        };
      default:
        return {
          color: '#FB7185',
          backgroundColor: 'rgba(251, 113, 133, 0.12)',
          border: '1px solid rgba(251, 113, 133, 0.22)',
        };
    }
  };

  const scoreBadgeStyle = getScoreBadgeColors(score.status);

  return (
    <div
      style={{
        backgroundColor: '#121814',
        borderRadius: '22px',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Glow suave no topo direito — Filosofia Pierre */}
      <div
        style={{
          position: 'absolute',
          top: '-35px',
          right: '-35px',
          width: '130px',
          height: '130px',
          borderRadius: '50%',
          backgroundColor: currentStage === 'debt_relief' 
            ? 'rgba(251, 113, 133, 0.1)' 
            : currentStage === 'wealth_building' 
            ? 'rgba(168, 85, 247, 0.1)' 
            : 'rgba(74, 222, 128, 0.1)',
          filter: 'blur(36px)',
          pointerEvents: 'none',
        }}
      />

      {/* Header Unificado: Rótulo de Saúde + Badge de Status do Mês (Sem redundância de fases) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span
          style={{
            fontSize: '0.70rem',
            fontWeight: 600,
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Saúde Financeira
        </span>

        {/* Badge Único: Status do Mês */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2.5px 8.5px',
            borderRadius: '9999px',
            fontSize: '0.70rem',
            fontWeight: 600,
            ...scoreBadgeStyle,
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: 'currentColor',
            }}
          />
          <span>{getScoreStatusLabel(score.status)}</span>
        </div>
      </div>

      {/* Destaque Numérico Forte (Health Score) + Frase Conversacional */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
          <span
            style={{
              fontSize: '3rem',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.03em',
              lineHeight: 1,
              fontFamily: "'Outfit', 'Inter', sans-serif",
            }}
          >
            {score.overallScore}
          </span>
          <span style={{ fontSize: '1.05rem', fontWeight: 500, color: '#64748B' }}>
            / 100
          </span>
        </div>

        <h3
          style={{
            fontSize: '1.04rem',
            fontWeight: 700,
            color: '#FFFFFF',
            margin: '6px 0 2px 0',
            letterSpacing: '-0.02em',
            fontFamily: "'Outfit', 'Inter', sans-serif",
          }}
        >
          {score.headline}
        </h3>

        <p style={{ fontSize: '0.84rem', color: '#94A3B8', margin: 0, lineHeight: 1.45 }}>
          {score.summary}
        </p>
      </div>

      {/* A Escada Financeira: Ribbon Conectado em 3 Etapas (Padrão Pierre: Calmo e Enxuto) */}
      <div
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '0.67rem',
              fontWeight: 600,
              color: '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Progresso da Escada
          </span>
          <span style={{ fontSize: '0.70rem', color: '#4ADE80', fontWeight: 600 }}>
            {currentStage === 'debt_relief' 
              ? 'Foco: Estancar Juros' 
              : currentStage === 'wealth_building'
              ? 'Reserva Plena (6m+)'
              : `${monthsProtected.toFixed(1)} meses de proteção`}
          </span>
        </div>

        {/* 3 Degraus Interconectados em Grid Proporcional */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '6px',
          }}
        >
          {/* Degrau 1: Dívidas */}
          <div
            style={{
              padding: '8px 6px',
              borderRadius: '11px',
              backgroundColor: currentStage === 'debt_relief'
                ? 'rgba(251, 113, 133, 0.12)'
                : 'rgba(255, 255, 255, 0.03)',
              border: currentStage === 'debt_relief'
                ? '1px solid rgba(251, 113, 133, 0.3)'
                : '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {currentStage === 'debt_relief' ? (
                <AlertTriangle size={12} color="#FB7185" />
              ) : (
                <Check size={12} color="#4ADE80" strokeWidth={3} />
              )}
              <span
                style={{
                  fontSize: '0.70rem',
                  fontWeight: 700,
                  color: currentStage === 'debt_relief' ? '#FB7185' : '#4ADE80',
                }}
              >
                1. Dívidas
              </span>
            </div>
            <span style={{ fontSize: '0.62rem', color: currentStage === 'debt_relief' ? '#FB7185' : '#8E8E93' }}>
              {currentStage === 'debt_relief' ? 'Atenção' : 'Zeradas'}
            </span>
          </div>

          {/* Degrau 2: Reserva */}
          <div
            style={{
              padding: '8px 6px',
              borderRadius: '11px',
              backgroundColor: currentStage === 'emergency_fund'
                ? 'rgba(74, 222, 128, 0.08)'
                : currentStage === 'wealth_building'
                ? 'rgba(255, 255, 255, 0.03)'
                : 'rgba(255, 255, 255, 0.02)',
              border: currentStage === 'emergency_fund'
                ? '1px solid rgba(74, 222, 128, 0.3)'
                : '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              textAlign: 'center',
              opacity: currentStage === 'debt_relief' ? 0.45 : 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {currentStage === 'wealth_building' ? (
                <Check size={12} color="#4ADE80" strokeWidth={3} />
              ) : currentStage === 'emergency_fund' ? (
                <ShieldCheck size={12} color="#4ADE80" />
              ) : (
                <Lock size={11} color="#64748B" />
              )}
              <span
                style={{
                  fontSize: '0.70rem',
                  fontWeight: 700,
                  color: currentStage === 'emergency_fund' ? '#4ADE80' : currentStage === 'wealth_building' ? '#4ADE80' : '#94A3B8',
                }}
              >
                2. Reserva
              </span>
            </div>
            <span style={{ fontSize: '0.62rem', color: currentStage === 'emergency_fund' ? '#4ADE80' : '#8E8E93', fontWeight: currentStage === 'emergency_fund' ? 600 : 400 }}>
              {currentStage === 'wealth_building' 
                ? 'Blindada' 
                : currentStage === 'emergency_fund'
                ? `${monthsProtected.toFixed(1)} meses`
                : 'Aguardando'}
            </span>
          </div>

          {/* Degrau 3: Metas & Multiplicação */}
          <div
            style={{
              padding: '8px 6px',
              borderRadius: '11px',
              backgroundColor: currentStage === 'wealth_building'
                ? 'rgba(168, 85, 247, 0.12)'
                : 'rgba(255, 255, 255, 0.02)',
              border: currentStage === 'wealth_building'
                ? '1px solid rgba(168, 85, 247, 0.35)'
                : '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              textAlign: 'center',
              opacity: currentStage === 'wealth_building' ? 1 : 0.45,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {currentStage === 'wealth_building' ? (
                <TrendingUp size={12} color="#C084FC" />
              ) : (
                <Lock size={11} color="#64748B" />
              )}
              <span
                style={{
                  fontSize: '0.70rem',
                  fontWeight: 700,
                  color: currentStage === 'wealth_building' ? '#C084FC' : '#94A3B8',
                }}
              >
                3. Metas
              </span>
            </div>
            <span style={{ fontSize: '0.62rem', color: '#8E8E93' }}>
              {currentStage === 'wealth_building' ? 'Ativa' : 'Aguardando'}
            </span>
          </div>
        </div>

        {/* Termômetro Integrado da Reserva (Somente quando Degrau 2 ou 3) */}
        {currentStage !== 'debt_relief' && emergencyFundTarget > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
            {/* Linha de Valores com Espaçamento Amplo */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.73rem',
              }}
            >
              <span style={{ color: '#CBD5E1', fontWeight: 500 }}>
                {formatBrlCurrency(emergencyFundCurrent)} guardados
              </span>
              <span style={{ color: '#8E8E93' }}>
                Meta: <strong style={{ color: '#FFFFFF' }}>{formatBrlCurrency(emergencyFundTarget)}</strong> (6m)
              </span>
            </div>

            {/* Barra de Progresso com Nós Marcadores dos Sub-Marcos (1m, 3m, 6m) */}
            <div
              style={{
                height: '6px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${percentProgress}%`,
                  borderRadius: '9999px',
                  backgroundColor: currentStage === 'wealth_building' ? '#A855F7' : '#4ADE80',
                  boxShadow: currentStage === 'wealth_building'
                    ? '0 0 8px rgba(168, 85, 247, 0.4)'
                    : '0 0 8px rgba(74, 222, 128, 0.4)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            {/* Sub-marcos Limpos em Linha — Sem Overflow Horizontal */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.66rem',
                color: '#8E8E93',
                padding: '0 1px',
              }}
            >
              <span style={{ color: monthsProtected >= 1.0 ? '#4ADE80' : '#64748B', fontWeight: monthsProtected >= 1.0 ? 600 : 400 }}>
                {monthsProtected >= 1.0 ? '✓ ' : '○ '}1m Tampão
              </span>
              <span style={{ color: monthsProtected >= 3.0 ? '#4ADE80' : '#64748B', fontWeight: monthsProtected >= 3.0 ? 600 : 400 }}>
                {monthsProtected >= 3.0 ? '✓ ' : '○ '}3m Estabilidade
              </span>
              <span style={{ color: monthsProtected >= 6.0 ? '#4ADE80' : '#64748B', fontWeight: monthsProtected >= 6.0 ? 600 : 400 }}>
                {monthsProtected >= 6.0 ? '✓ ' : '○ '}6m Blindagem
              </span>
            </div>

            {/* Próximo Marco Conversacional — Enxuto e Elegante */}
            {nextMilestoneLabel && (
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginTop: '1px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, flex: 1 }}>
                  <Sparkles size={13} color="#4ADE80" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.74rem', color: '#CBD5E1', lineHeight: 1.35 }}>
                    {nextMilestoneLabel}
                  </span>
                </div>

                {onActionClick && (
                  <button
                    type="button"
                    onClick={onActionClick}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4ADE80',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '2px',
                      flexShrink: 0,
                    }}
                    title="Ver detalhe"
                  >
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Alerta de Dívida se estiver no Degrau 1 */}
        {currentStage === 'debt_relief' && debtAlertDetails && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(251, 113, 133, 0.08)',
              border: '1px solid rgba(251, 113, 133, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              fontSize: '0.74rem',
              color: '#FB7185',
              marginTop: '2px',
            }}
          >
            {debtAlertDetails.negativeBalanceTotal > 0 && (
              <div>• Saldo negativo em conta: {formatBrlCurrency(debtAlertDetails.negativeBalanceTotal)}</div>
            )}
            {debtAlertDetails.overdueCardsCount > 0 && (
              <div>• {debtAlertDetails.overdueCardsCount} fatura(s) com vencimento em atraso</div>
            )}
            {debtAlertDetails.uncoveredInvoicesAmount > 0 && (
              <div>• Faturas fechadas superam saldo em conta em {formatBrlCurrency(debtAlertDetails.uncoveredInvoicesAmount)}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
