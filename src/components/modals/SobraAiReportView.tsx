import React, { useState } from 'react';
import { 
  TrendingUp, 
  CreditCard, 
  PieChart, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight,
  MessageSquare
} from 'lucide-react';
import { SobraFullDiagnosis, SobraAction } from '../../core/ai/types';

interface SobraAiReportViewProps {
  diagnosis: SobraFullDiagnosis;
  onExecuteAction?: (action: SobraAction) => void;
  onOpenChatWithPrompt?: (prompt: string) => void;
}

export const SobraAiReportView: React.FC<SobraAiReportViewProps> = ({
  diagnosis,
  onExecuteAction,
  onOpenChatWithPrompt,
}) => {
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);

  const { score, actionPlan } = diagnosis;

  const getStatusColor = (val: number) => {
    if (val >= 80) return '#4ADE80';
    if (val >= 60) return '#FB923C';
    return '#F87171';
  };

  const getScoreStatusLabel = (status: string) => {
    switch (status) {
      case 'excelente': return 'Ritmo excelente';
      case 'bom': return 'Equilibrado';
      case 'atencao': return 'Requer atenção';
      default: return 'Atenção às contas';
    }
  };

  const getScoreStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'excelente':
        return {
          color: '#4ADE80',
          backgroundColor: 'rgba(74, 222, 128, 0.1)',
          border: '1px solid rgba(74, 222, 128, 0.2)',
        };
      case 'bom':
        return {
          color: '#38BDF8',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
        };
      case 'atencao':
        return {
          color: '#FBBF24',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.2)',
        };
      default:
        return {
          color: '#FB7185',
          backgroundColor: 'rgba(251, 113, 133, 0.1)',
          border: '1px solid rgba(251, 113, 133, 0.2)',
        };
    }
  };

  const getPillarIcon = (type: string) => {
    switch (type) {
      case 'savings': return <TrendingUp size={17} />;
      case 'credit_cards': return <CreditCard size={17} />;
      case 'budgets': return <PieChart size={17} />;
      case 'liquidity': return <ShieldCheck size={17} />;
      default: return <TrendingUp size={17} />;
    }
  };

  const badgeStyle = getScoreStatusBadgeStyle(score.status);

  return (
    <div 
      className="hide-scrollbar animate-fade-in"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '16px 20px calc(48px + var(--safe-area-bottom, 0px))',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Hero: Health Score (Padrão Pierre: Tipografia forte, sem alarmismo de notas) */}
      <div
        style={{
          backgroundColor: '#121814',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '22px 20px',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Saúde Financeira
          </span>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '0.74rem',
              fontWeight: 600,
              ...badgeStyle,
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'currentColor',
              }}
            />
            <span>{getScoreStatusLabel(score.status)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '4px 0 10px' }}>
          <span
            style={{
              fontSize: '3.2rem',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.03em',
              lineHeight: 1,
              fontFamily: "'Outfit', 'Inter', sans-serif",
            }}
          >
            {score.overallScore}
          </span>
          <span style={{ fontSize: '1.1rem', fontWeight: 500, color: '#64748B' }}>
            / 100
          </span>
        </div>

        <h3
          style={{
            fontSize: '1.08rem',
            fontWeight: 700,
            color: '#FFFFFF',
            margin: '0 0 6px 0',
            letterSpacing: '-0.02em',
            fontFamily: "'Outfit', 'Inter', sans-serif",
          }}
        >
          {score.headline}
        </h3>

        <p style={{ fontSize: '0.85rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
          {score.summary}
        </p>
      </div>

      {/* 2. Ação Recomendada (Elevada para o topo, logo abaixo do Hero) */}
      {actionPlan.length > 0 && actionPlan[0] && (
        <div
          style={{
            backgroundColor: '#121814',
            borderRadius: '18px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Ação Recomendada
          </span>

          <div
            style={{
              fontSize: '0.96rem',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.01em',
              fontFamily: "'Outfit', 'Inter', sans-serif",
            }}
          >
            {actionPlan[0].title}
          </div>

          <p style={{ fontSize: '0.84rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
            {actionPlan[0].description}
          </p>

          {/* Badge de Impacto (Entre a descrição e o botão, com largura total e sem truncar) */}
          {actionPlan[0].estimatedImpact && (
            <div style={{ marginTop: '4px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(74, 222, 128, 0.1)',
                  color: '#4ADE80',
                  border: '1px solid rgba(74, 222, 128, 0.18)',
                }}
              >
                {actionPlan[0].estimatedImpact}
              </span>
            </div>
          )}

          {/* Botão de Ação: Alinhado à direita no rodapé */}
          {actionPlan[0].action && onExecuteAction && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  if (actionPlan[0].action) {
                    onExecuteAction(actionPlan[0].action);
                  }
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
              >
                <span>{actionPlan[0].action.label}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Os 4 Pilares de Avaliação (Padrão Pierre: Clean, Direto, Conversacional) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
        <div style={{ padding: '0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Pilares de Avaliação
          </span>
          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
            Toque para detalhes
          </span>
        </div>

        <div
          style={{
            backgroundColor: '#121814',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            overflow: 'hidden',
          }}
        >
          {score.pillars.map((pillar, idx) => {
            const isExpanded = expandedPillar === pillar.type;
            const isLast = idx === score.pillars.length - 1;
            const pColor = getStatusColor(pillar.score);

            return (
              <div
                key={pillar.type}
                style={{
                  borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div
                  onClick={() => setExpandedPillar(isExpanded ? null : pillar.type)}
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '11px',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {getPillarIcon(pillar.type)}
                    </div>

                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#FFFFFF' }}>
                        {pillar.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#8E8E93', marginTop: '1px' }}>
                        {pillar.metricValue}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.94rem', fontWeight: 700, color: pColor }}>
                      {pillar.score}
                    </span>
                    <div style={{ color: '#64748B' }}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Feedback detalhado expansível */}
                {isExpanded && (
                  <div
                    className="animate-fade-in"
                    style={{
                      padding: '0 18px 14px 66px',
                      fontSize: '0.8rem',
                      color: '#94A3B8',
                      lineHeight: 1.5,
                    }}
                  >
                    <p style={{ margin: '0 0 10px 0' }}>{pillar.feedback}</p>
                    
                    {onOpenChatWithPrompt && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenChatWithPrompt(`Sobi, como posso melhorar minha pontuação em "${pillar.name}"?`);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          color: '#CBD5E1',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.09)';
                          e.currentTarget.style.color = '#FFFFFF';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.color = '#CBD5E1';
                        }}
                      >
                        <MessageSquare size={13} />
                        <span>Conversar com o Sobi sobre isso</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
