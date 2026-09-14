import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useTheme } from '../../context/ThemeContext';
import { SobraFullDiagnosis, SobraAction } from '../../core/ai/types';
import { 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ShieldCheck, 
  TrendingUp, 
  PieChart, 
  Calendar, 
  Zap 
} from 'lucide-react';

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
  const { colors } = useTheme();
  const { score, strengths, vulnerabilities, pattern, actionPlan } = diagnosis;

  const getPillarColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 65) return '#38BDF8';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  const getPillarIcon = (type: string) => {
    switch (type) {
      case 'savings': return <TrendingUp size={18} />;
      case 'credit_cards': return <Zap size={18} />;
      case 'budgets': return <PieChart size={18} />;
      case 'liquidity': return <ShieldCheck size={18} />;
      default: return <Sparkles size={18} />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Raio-X de Inteligência • Sobra AI"
      subtitle="Diagnóstico multidimensional e plano de ação estratégico para maximizar sua sobra líquida"
      maxWidth="620px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxHeight: '78vh', overflowY: 'auto', paddingRight: '4px' }}>
        {/* 1. Cockpit do Score Global */}
        <div
          style={{
            borderRadius: '20px',
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(15, 23, 42, 0.95) 50%, rgba(6, 78, 59, 0.2) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Sparkles size={18} color="#C4B5FD" />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#C4B5FD' }}>
                Sobra Health Score
              </span>
            </div>
            <h4 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px' }}>
              {score.headline}
            </h4>
            <p style={{ fontSize: '0.82rem', color: '#CBD5E1', margin: 0, lineHeight: 1.45 }}>
              {score.summary}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 20px',
              borderRadius: '16px',
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              border: `2px solid ${getPillarColor(score.overallScore)}`,
              minWidth: '100px',
            }}
          >
            <span style={{ fontSize: '2.2rem', fontWeight: 900, color: getPillarColor(score.overallScore), lineHeight: 1 }}>
              {score.overallScore}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600, marginTop: '2px' }}>
              de 100 pontos
            </span>
            <span
              style={{
                marginTop: '6px',
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: `${getPillarColor(score.overallScore)}25`,
                color: getPillarColor(score.overallScore),
                fontWeight: 800,
              }}
            >
              Grau {score.grade}
            </span>
          </div>
        </div>

        {/* 2. Decomposição dos 4 Pilares Fundamentais */}
        <div>
          <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: colors.textPrimary, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Os 4 Pilares de Avaliação</span>
          </h5>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
            {score.pillars.map(pillar => {
              const pillarColor = getPillarColor(pillar.score);
              return (
                <div
                  key={pillar.type}
                  style={{
                    backgroundColor: colors.surfaceElevated,
                    borderRadius: '14px',
                    padding: '14px 16px',
                    border: `1px solid ${colors.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: `${pillarColor}20`,
                          color: pillarColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {getPillarIcon(pillar.type)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: colors.textPrimary }}>
                          {pillar.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: colors.textSecondary }}>
                          {pillar.headline} • <strong style={{ color: colors.textPrimary }}>{pillar.metricValue}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: pillarColor }}>
                        {pillar.score}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: colors.textMuted }}>/100</span>
                    </div>
                  </div>

                  {/* Barra de Progresso do Pilar */}
                  <div
                    style={{
                      height: '6px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pillar.score}%`,
                        backgroundColor: pillarColor,
                        borderRadius: '9999px',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>

                  <div style={{ fontSize: '0.75rem', color: colors.textSecondary, lineHeight: 1.4 }}>
                    {pillar.feedback}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Matriz de Forças & Vulnerabilidades */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          {/* Pontos Fortes */}
          <div
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} color="#10B981" />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#10B981', textTransform: 'uppercase' }}>
                Pontos Fortes
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.78rem', color: colors.textPrimary, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {strengths.map((str, i) => (
                <li key={i}>{str}</li>
              ))}
            </ul>
          </div>

          {/* Vulnerabilidades */}
          <div
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} color="#F59E0B" />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#F59E0B', textTransform: 'uppercase' }}>
                Onde Ter Atenção
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.78rem', color: colors.textPrimary, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {vulnerabilities.map((vuln, i) => (
                <li key={i}>{vuln}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* 4. Raio-X Comportamental */}
        {pattern.weekendExpenseRatio > 0 && (
          <div
            style={{
              backgroundColor: colors.surfaceElevated,
              borderRadius: '16px',
              padding: '16px',
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(139, 92, 246, 0.2)',
                  color: '#A78BFA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Calendar size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: colors.textPrimary }}>
                  Padrão Semanal de Gastos
                </div>
                <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                  Dia de maior consumo: <strong style={{ color: colors.textPrimary }}>{pattern.peakDayName}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#A78BFA' }}>
                {pattern.weekendExpenseRatio}%
              </span>
              <span style={{ fontSize: '0.72rem', color: colors.textSecondary }}>
                das saídas nos fins de semana
              </span>
            </div>
          </div>
        )}

        {/* 5. Plano Estratégico em 3 Passos */}
        <div>
          <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: colors.textPrimary, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Plano de Ação Estratégico do Sobra AI</span>
            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8' }}>
              3 Passos Recomendados
            </span>
          </h5>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {actionPlan.map(step => (
              <div
                key={step.stepNumber}
                style={{
                  backgroundColor: colors.surfaceElevated,
                  borderRadius: '14px',
                  padding: '14px 16px',
                  border: `1px solid ${colors.border}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(139, 92, 246, 0.25)',
                      color: '#C4B5FD',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    {step.stepNumber}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: colors.textPrimary }}>
                      {step.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: colors.textSecondary, marginTop: '2px', lineHeight: 1.4 }}>
                      {step.description}
                    </div>
                    {step.estimatedImpact && (
                      <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700, marginTop: '4px' }}>
                        💡 Impacto estimado: {step.estimatedImpact}
                      </div>
                    )}
                  </div>
                </div>

                {step.action && (
                  <button
                    onClick={() => {
                      if (step.action) {
                        onExecuteAction(step.action);
                        onClose();
                      }
                    }}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(139, 92, 246, 0.2)',
                      border: '1px solid rgba(139, 92, 246, 0.4)',
                      color: '#C4B5FD',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      flexShrink: 0,
                      alignSelf: 'center',
                    }}
                  >
                    <span>{step.action.label}</span>
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '10px' }}>
          {onOpenChat ? (
            <button
              onClick={() => {
                onClose();
                onOpenChat('Pode me explicar com mais detalhes os pontos de atenção identificados no meu Raio-X do Sobra AI?');
              }}
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(56, 189, 248, 0.2) 100%)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                color: '#C4B5FD',
                borderRadius: '10px',
                padding: '10px 16px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Sparkles size={16} color="#A78BFA" />
              <span>Tirar Dúvidas com a IA sobre o Raio-X</span>
            </button>
          ) : <div />}

          <Button variant="primary" onClick={onClose} style={{ minWidth: '130px' }}>
            Entendido
          </Button>
        </div>
      </div>
    </Modal>
  );
};
