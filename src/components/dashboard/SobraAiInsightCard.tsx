import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { SobraFullDiagnosis, SobraAction } from '../../core/ai/types';
import { SobiAvatar } from '../common/SobiAvatar';
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight,
  MessageSquare
} from 'lucide-react';

interface SobraAiInsightCardProps {
  diagnosis: SobraFullDiagnosis;
  onOpenFullAnalysis: () => void;
  onExecuteAction: (action: SobraAction) => void;
  onOpenChat?: (prompt?: string) => void;
}

export const SobraAiInsightCard: React.FC<SobraAiInsightCardProps> = ({
  diagnosis,
  onOpenFullAnalysis,
  onExecuteAction,
  onOpenChat,
}) => {
  const { colors } = useTheme();
  const [currentInsightIdx, setCurrentInsightIdx] = useState(0);

  const { score, insights } = diagnosis;
  const totalInsights = insights.length;
  const activeInsight = totalInsights > 0 ? insights[currentInsightIdx % totalInsights] : null;

  const handleNext = () => {
    setCurrentInsightIdx(prev => (prev + 1) % totalInsights);
  };

  const handlePrev = () => {
    setCurrentInsightIdx(prev => (prev - 1 + totalInsights) % totalInsights);
  };

  const getScoreColor = (status: string) => {
    switch (status) {
      case 'excelente': return '#22C55E';
      case 'bom': return '#38BDF8';
      case 'atencao': return '#F59E0B';
      default: return '#EF4444';
    }
  };

  const scoreColor = getScoreColor(score.status);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <span
            style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#FB7185',
              fontWeight: 700,
              border: '1px solid rgba(239, 68, 68, 0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            🚨 Crítico
          </span>
        );
      case 'warning':
        return (
          <span
            style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#FBBF24',
              fontWeight: 700,
              border: '1px solid rgba(245, 158, 11, 0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            ⚡ Atenção
          </span>
        );
      case 'opportunity':
        return (
          <span
            style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              color: '#4ADE80',
              fontWeight: 700,
              border: '1px solid rgba(74, 222, 128, 0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            💡 Oportunidade
          </span>
        );
      case 'achievement':
        return (
          <span
            style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              color: '#4ADE80',
              fontWeight: 700,
              border: '1px solid rgba(74, 222, 128, 0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            🎉 Conquista
          </span>
        );
      case 'pattern':
        return (
          <span
            style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              color: '#38BDF8',
              fontWeight: 700,
              border: '1px solid rgba(56, 189, 248, 0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            📈 Padrão
          </span>
        );
      default:
        return (
          <span
            style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(148, 163, 184, 0.12)',
              color: '#CBD5E1',
              fontWeight: 700,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              whiteSpace: 'nowrap',
            }}
          >
            Diagnóstico
          </span>
        );
    }
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        borderRadius: '24px',
        padding: '18px',
        backgroundColor: '#121814',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
        color: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Luz ambiente suave esmeralda */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '140px',
          height: '140px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34, 197, 94, 0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Topo: Identidade do Sobi & Health Score (Linha única sem quebras) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          marginBottom: '14px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <SobiAvatar
            expression={
              score.status === 'excelente'
                ? 'animado'
                : score.status === 'bom'
                ? 'confiante'
                : score.status === 'atencao'
                ? 'pensativo'
                : 'surpreso'
            }
            size={40}
          />

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif" }}>
                Sobi
              </span>
              <span
                style={{
                  fontSize: '0.64rem',
                  padding: '1px 7px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  color: '#4ADE80',
                  fontWeight: 700,
                  border: '1px solid rgba(74, 222, 128, 0.2)',
                  whiteSpace: 'nowrap',
                }}
              >
                Diagnóstico
              </span>
            </div>
            <div
              style={{
                fontSize: '0.74rem',
                color: '#94A3B8',
                marginTop: '1px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={score.headline}
            >
              {score.headline}
            </div>
          </div>
        </div>

        {/* Health Score Pill - Compacto, alinhado e elegante */}
        <div
          onClick={onOpenFullAnalysis}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#101612',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '6px 10px',
            borderRadius: '12px',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.3)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          title="Ver análise completa de saúde financeira"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', fontWeight: 700 }}>
              Health
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 900, color: scoreColor, fontFamily: "'Outfit', sans-serif", lineHeight: 1.1 }}>
                {score.overallScore}
              </span>
              <span style={{ fontSize: '0.64rem', color: '#64748B', fontWeight: 600 }}>
                /100
              </span>
            </div>
          </div>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: `${scoreColor}18`,
              color: scoreColor,
              border: `1px solid ${scoreColor}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.76rem',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            {score.grade}
          </div>
        </div>
      </div>

      {/* Caixa do Insight Ativo */}
      {activeInsight ? (
        <div
          style={{
            backgroundColor: '#161F18',
            borderRadius: '16px',
            padding: '14px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            position: 'relative',
          }}
        >
          {/* Cabeçalho do Insight & Navegador de Slides */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
              {getSeverityBadge(activeInsight.severity)}
              {activeInsight.highlightValue && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#F1F5F9',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeInsight.highlightValue}
                </span>
              )}
            </div>

            {totalInsights > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <button
                  onClick={handlePrev}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#CBD5E1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)')}
                  title="Insight anterior"
                >
                  <ChevronLeft size={13} />
                </button>

                <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 700, padding: '0 2px', whiteSpace: 'nowrap' }}>
                  {currentInsightIdx + 1}/{totalInsights}
                </span>

                <button
                  onClick={handleNext}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#CBD5E1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)')}
                  title="Próximo insight"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Título e Mensagem Narrativa */}
          <div>
            <h5 style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', margin: '0 0 5px', letterSpacing: '-0.01em', fontFamily: "'Outfit', sans-serif", lineHeight: 1.35 }}>
              {activeInsight.title}
            </h5>
            <p style={{ fontSize: '0.82rem', color: '#CBD5E1', margin: 0, lineHeight: 1.45 }}>
              {activeInsight.message}
            </p>
          </div>

          {/* Ação Recomendada */}
          {activeInsight.action && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '2px' }}>
              <button
                onClick={() => activeInsight.action && onExecuteAction(activeInsight.action)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(74, 222, 128, 0.25)',
                  color: '#4ADE80',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#22C55E';
                  e.currentTarget.style.color = '#0A0E0C';
                  e.currentTarget.style.borderColor = '#22C55E';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.12)';
                  e.currentTarget.style.color = '#4ADE80';
                  e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.25)';
                }}
              >
                <span>{activeInsight.action.label}</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: '#161F18',
            borderRadius: '16px',
            padding: '16px',
            textAlign: 'center',
            color: '#94A3B8',
            fontSize: '0.84rem',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          Nenhuma anomalia detectada no momento. Suas contas e orçamentos estão sob controle saudável!
        </div>
      )}

      {/* Barra Inferior com Análise e Ações */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginTop: '14px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <span
          style={{
            fontSize: '0.72rem',
            color: '#94A3B8',
            lineHeight: 1.3,
          }}
        >
          Análise baseada no seu histórico recente
        </span>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          {onOpenChat && (
            <button
              onClick={() => onOpenChat()}
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(74, 222, 128, 0.25)',
                color: '#4ADE80',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 14px',
                borderRadius: '10px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.25)';
              }}
            >
              <MessageSquare size={14} color="#4ADE80" />
              <span>Conversar com o Sobi</span>
            </button>
          )}

          <button
            onClick={onOpenFullAnalysis}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '7px 4px',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
            onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
          >
            <span>Raio-X Completo</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
