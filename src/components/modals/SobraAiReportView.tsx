import React, { useState } from 'react';
import { 
  TrendingUp, 
  CreditCard, 
  PieChart, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight,
  CheckCircle2,
  Sparkles,
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
    <div 
      className="hide-scrollbar animate-fade-in"
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Card Hero: Health Score */}
      <div
        style={{
          backgroundColor: '#121814',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '22px 20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow sutil ao fundo */}
        <div
          style={{
            position: 'absolute',
            top: '-30px',
            right: '-30px',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            backgroundColor: scoreColor,
            filter: 'blur(50px)',
            opacity: 0.15,
            pointerEvents: 'none',
          }}
        />

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
            fontSize: '1.15rem',
            fontWeight: 700,
            color: '#FFFFFF',
            margin: '14px 0 6px 0',
            letterSpacing: '-0.02em',
          }}
        >
          {score.headline}
        </h3>

        <p style={{ fontSize: '0.86rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
          {score.summary}
        </p>
      </div>

      {/* 2. Os 4 Pilares de Avaliação com Ação Rápida */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ padding: '0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
            Toque para detalhes
          </span>
        </div>

        <div
          style={{
            backgroundColor: '#121814',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
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

                {/* Feedback detalhado expansível */}
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
                    <p style={{ margin: '0 0 10px 0' }}>{pillar.feedback}</p>
                    
                    {onOpenChatWithPrompt && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenChatWithPrompt(`Sobi, como posso melhorar minha pontuação no pilar de "${pillar.name}"? Atualmente está com nota ${pillar.score}/100.`);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(74, 222, 128, 0.1)',
                          border: '1px solid rgba(74, 222, 128, 0.25)',
                          color: '#4ADE80',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.2)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.1)')}
                      >
                        <MessageSquare size={13} />
                        <span>Perguntar ao Sobi sobre este pilar</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Visão Analítica do Sobra AI */}
      <div
        style={{
          backgroundColor: '#121814',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
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
            Visão da Sobra AI
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

      {/* 4. Ação Recomendada */}
      {actionPlan.length > 0 && actionPlan[0] && (
        <div
          style={{
            backgroundColor: '#121814',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
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

          {actionPlan[0].action && onExecuteAction && (
            <button
              type="button"
              onClick={() => {
                if (actionPlan[0].action) {
                  onExecuteAction(actionPlan[0].action);
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

      {/* 5. CTA Principal: Chamar o Sobi para debater o relatório */}
      {onOpenChatWithPrompt && (
        <button
          type="button"
          onClick={() => {
            onOpenChatWithPrompt('Pode me explicar os pontos principais do meu relatório de saúde financeira e como melhorar meu score?');
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
            marginTop: '4px',
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
          <MessageSquare size={18} />
          <span>Conversar com o Sobi sobre este Relatório</span>
        </button>
      )}
    </div>
  );
};
