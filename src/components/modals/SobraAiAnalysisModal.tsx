import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  TrendingUp, 
  CreditCard, 
  PieChart, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { SobraFullDiagnosis, SobraAction } from '../../core/ai/types';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from '../common/SwipeBackIndicator';

interface SobraAiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnosis: SobraFullDiagnosis;
  onExecuteAction: (action: SobraAction) => void;
  onOpenChat?: (prompt?: string) => void;
}

export const SobraAiAnalysisModal: React.FC<SobraAiAnalysisModalProps> = ({
  isOpen,
  onClose,
  diagnosis,
  onExecuteAction,
  onOpenChat,
}) => {
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);

  const swipeState = useSwipeBack({ onBack: onClose, enabled: isOpen });

  if (!isOpen) return null;

  const { score, strengths, vulnerabilities, pattern, actionPlan } = diagnosis;

  const getStatusColor = (val: number) => {
    if (val >= 80) return '#4ADE80';
    if (val >= 60) return '#FB923C';
    return '#F87171';
  };

  const getStatusBg = (val: number) => {
    if (val >= 80) return 'rgba(74, 222, 128, 0.12)';
    if (val >= 60) return 'rgba(251, 146, 60, 0.12)';
    return 'rgba(248, 113, 113, 0.12)';
  };

  const getStatusBorder = (val: number) => {
    if (val >= 80) return 'rgba(74, 222, 128, 0.25)';
    if (val >= 60) return 'rgba(251, 146, 60, 0.25)';
    return 'rgba(248, 113, 113, 0.25)';
  };

  const getPillarIcon = (type: string) => {
    switch (type) {
      case 'savings': return <TrendingUp size={18} />;
      case 'credit_cards': return <CreditCard size={18} />;
      case 'budgets': return <PieChart size={18} />;
      case 'liquidity': return <ShieldCheck size={18} />;
      default: return <Sparkles size={18} />;
    }
  };

  const scoreColor = getStatusColor(score.overallScore);
  const scoreBg = getStatusBg(score.overallScore);
  const scoreBorder = getStatusBorder(score.overallScore);

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
          paddingBottom: 'calc(40px + var(--safe-area-bottom, 0px))',
        }}
      >
        {/* 1. Header Minimalista estilo Pierre */}
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
          {/* Botão Voltar Circular 42px */}
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.07)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, transform 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.transform = 'scale(1.04)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Voltar"
          >
            <ArrowLeft size={19} />
          </button>

          {/* Título Central */}
          <span style={{ fontSize: '1.02rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
            Saúde Financeira
          </span>

          {/* Espaçador para centralizar o título */}
          <div style={{ width: '42px' }} />
        </header>

        {/* 2. Conteúdo Principal */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card Hero: Health Score Calmo e Imponente */}
          <div
            style={{
              backgroundColor: '#121316',
              borderRadius: '24px',
              border: '1px solid #1C1E22',
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span
                  style={{
                    fontSize: '3.2rem',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                  }}
                >
                  {score.overallScore}
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 500, color: '#64748B' }}>
                  / 100
                </span>
              </div>

              {/* Badge de Grau */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  backgroundColor: scoreBg,
                  border: `1px solid ${scoreBorder}`,
                  color: scoreColor,
                  fontSize: '0.82rem',
                  fontWeight: 700,
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
                <span>{`Grau ${score.grade}`}</span>
              </div>
            </div>

            <h3
              style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: '#FFFFFF',
                margin: '16px 0 6px 0',
                letterSpacing: '-0.02em',
              }}
            >
              {score.headline}
            </h3>

            <p style={{ fontSize: '0.86rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
              {score.summary}
            </p>
          </div>

          {/* 3. Os 4 Pilares de Avaliação (Ultra Enxuto, Organizado e Sem Cansaço) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ padding: '0 4px' }}>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#64748B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Pilares de Avaliação
              </span>
            </div>

            <div
              style={{
                backgroundColor: '#121316',
                borderRadius: '20px',
                border: '1px solid #1C1E22',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#FFFFFF' }}>
                            {pillar.name}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#8E8E93', marginTop: '2px' }}>
                            {pillar.metricValue}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.96rem', fontWeight: 700, color: pColor }}>
                          {pillar.score}
                        </span>
                        <div style={{ color: '#64748B' }}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* Feedback detalhado expansível a 1 toque */}
                    {isExpanded && (
                      <div
                        className="animate-fade-in"
                        style={{
                          padding: '0 18px 14px 70px',
                          fontSize: '0.78rem',
                          color: '#94A3B8',
                          lineHeight: 1.45,
                        }}
                      >
                        {pillar.feedback}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Visão Executiva do Sobra AI (Menos painel, mais conversa) */}
          <div
            style={{
              backgroundColor: '#121316',
              borderRadius: '20px',
              border: '1px solid #1C1E22',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(74, 222, 128, 0.12)',
                  color: '#4ADE80',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Sparkles size={16} />
              </div>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF' }}>
                Visão do Sobra AI
              </span>
            </div>

            {strengths.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CheckCircle2 size={16} color="#4ADE80" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '0.84rem', color: '#E2E8F0', lineHeight: 1.45 }}>
                  {strengths[0]}
                </span>
              </div>
            )}

            {vulnerabilities.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#FB923C',
                    marginTop: '7px',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '0.84rem', color: '#94A3B8', lineHeight: 1.45 }}>
                  {vulnerabilities[0]}
                </span>
              </div>
            )}

            {pattern.weekendExpenseRatio > 0 && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  fontSize: '0.78rem',
                  color: '#8E8E93',
                  lineHeight: 1.4,
                }}
              >
                Padrão semanal: <strong style={{ color: '#FFFFFF' }}>{`${pattern.weekendExpenseRatio}%`}</strong> das saídas acontecem aos fins de semana (pico em {pattern.peakDayName}).
              </div>
            )}
          </div>

          {/* 5. Ação Recomendada (Se houver no plano) */}
          {actionPlan.length > 0 && actionPlan[0] && (
            <div
              style={{
                backgroundColor: '#121316',
                borderRadius: '20px',
                border: '1px solid #1C1E22',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>
                  {actionPlan[0].title}
                </span>
                {actionPlan[0].estimatedImpact && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(74, 222, 128, 0.12)',
                      color: '#4ADE80',
                    }}
                  >
                    {actionPlan[0].estimatedImpact}
                  </span>
                )}
              </div>

              <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0, lineHeight: 1.45 }}>
                {actionPlan[0].description}
              </p>

              {actionPlan[0].action && (
                <button
                  type="button"
                  onClick={() => {
                    if (actionPlan[0].action) {
                      onExecuteAction(actionPlan[0].action);
                      onClose();
                    }
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: '4px',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#FFFFFF',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)')}
                >
                  <span>{actionPlan[0].action.label}</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}

          {/* 6. Botão CTA Principal: Conversar com o Sobra AI */}
          {onOpenChat && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenChat('Pode me explicar os detalhes do meu relatório de saúde financeira?');
              }}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: '16px',
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
                boxShadow: '0 4px 16px rgba(74, 222, 128, 0.25)',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.opacity = '0.95';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.opacity = '1';
              }}
            >
              <Sparkles size={18} />
              <span>Conversar com o Sobra AI</span>
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  );
};
