import React, { useState } from 'react';
import { 
  Coffee, 
  Sparkles, 
  ChevronDown, 
  X, 
  Search, 
  Target, 
  Check,
  TrendingDown
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { MicroExpensesAnalysis, MicroExpenseGroupId } from '../../core/microExpenses/microExpensesHelper';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';

interface MicroExpensesRadarCardProps {
  analysis: MicroExpensesAnalysis;
  onViewTransactions: (filterGroupId?: MicroExpenseGroupId) => void;
  onDismiss?: () => void;
  onThresholdChange?: (newThreshold: number) => void;
  onAcceptChallenge?: (savedCount: number, savedAmount: number) => void;
  isChallengeActive?: boolean;
}

export const MicroExpensesRadarCard: React.FC<MicroExpensesRadarCardProps> = ({
  analysis,
  onViewTransactions,
  onDismiss,
  onThresholdChange,
  onAcceptChallenge,
  isChallengeActive = false,
}) => {
  const { colors } = useTheme();
  const [isThresholdMenuOpen, setIsThresholdMenuOpen] = useState(false);
  const [challengeAcceptedInternal, setChallengeAcceptedInternal] = useState(isChallengeActive);

  const {
    totalCount,
    totalAmount,
    averageAmount,
    projectedAnnualTotal,
    suggestedSavingsCount,
    suggestedSavingsAmount,
    projectedAnnualSavings,
    groups,
    thresholdAmount,
  } = analysis;

  const handleToggleChallenge = () => {
    const nextState = !challengeAcceptedInternal;
    setChallengeAcceptedInternal(nextState);
    if (nextState && onAcceptChallenge) {
      onAcceptChallenge(suggestedSavingsCount, suggestedSavingsAmount);
    }
  };

  const thresholdOptions = [20, 25, 30, 40, 50];

  return (
    <div
      style={{
        backgroundColor: colors.surfaceElevated || '#131915',
        borderRadius: '22px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '20px 20px 18px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
        transition: 'all 0.2s ease',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* ── 1. Topo: Badge Pierre de Automação & Controles ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.14)',
              color: '#FBBF24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Coffee size={18} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  letterSpacing: '-0.01em',
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                }}
              >
                Radar de Microgastos
              </span>

              {/* Tag sutil de automação Pierre */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  color: '#38BDF8',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                }}
              >
                <Sparkles size={10} />
                Automático
              </span>
            </div>
          </div>
        </div>

        {/* Controles: Seletor de Teto e Botão de Ocultar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Seletor de Teto em Dropdown Amigável */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsThresholdMenuOpen(prev => !prev)}
              aria-label="Ajustar limite de microgasto"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.74rem',
                fontWeight: 600,
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                color: '#CBD5E1',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Até R$ {thresholdAmount}</span>
              <ChevronDown size={13} style={{ opacity: 0.8 }} />
            </button>

            {isThresholdMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  backgroundColor: '#1E2620',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.45)',
                  padding: '6px',
                  zIndex: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  minWidth: '120px',
                }}
              >
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: '#94A3B8',
                    padding: '4px 8px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  Teto do cafezinho
                </span>
                {thresholdOptions.map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      if (onThresholdChange) onThresholdChange(val);
                      setIsThresholdMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: thresholdAmount === val ? 700 : 500,
                      backgroundColor: thresholdAmount === val ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                      color: thresholdAmount === val ? '#4ADE80' : '#E2E8F0',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>Até R$ {val}</span>
                    {thresholdAmount === val && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Botão de Fechar / Dispensar no Mês */}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              title="Ocultar neste mês"
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                color: '#64748B',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
              onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Hero Numérico Pierre: Número Grande, Calmo e Imediato ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          paddingTop: '2px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span
              style={{
                fontSize: '1.9rem',
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                fontFamily: "'Outfit', 'Inter', sans-serif",
              }}
            >
              {formatBrlCurrency(totalAmount)}
            </span>
            <span
              style={{
                fontSize: '0.92rem',
                color: '#94A3B8',
                fontWeight: 500,
              }}
            >
              em {totalCount} comprinhas
            </span>
          </div>

          <span
            style={{
              fontSize: '0.76rem',
              color: '#64748B',
              fontWeight: 500,
              display: 'block',
              marginTop: '3px',
            }}
          >
            Média de {formatBrlCurrency(averageAmount)} por compra • {formatBrlCurrency(projectedAnnualTotal)} ao ano
          </span>
        </div>
      </div>

      {/* ── 3. Frase Conversacional Acolhedora (Zero Culpa) ── */}
      <p
        style={{
          margin: 0,
          fontSize: '0.88rem',
          lineHeight: 1.5,
          color: '#CBD5E1',
        }}
      >
        Sem neura com o cafezinho: se você economizar só{' '}
        <strong style={{ color: '#FBBF24', fontWeight: 700 }}>
          {suggestedSavingsCount} dessas compras
        </strong>{' '}
        no mês que vem, sobram{' '}
        <strong style={{ color: '#4ADE80', fontWeight: 700 }}>
          +{formatBrlCurrency(suggestedSavingsAmount)} a mais
        </strong>{' '}
        na sua reserva (ou{' '}
        <strong style={{ color: '#4ADE80', fontWeight: 700 }}>
          +{formatBrlCurrency(projectedAnnualSavings)}/ano
        </strong>
        ).
      </p>

      {/* ── 4. Pills de Sub-Hábitos (Visão Rápida sem Gráficos Pesados) ── */}
      {groups.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          {groups.map(group => (
            <button
              key={group.id}
              type="button"
              onClick={() => onViewTransactions(group.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#E2E8F0',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              <span>{group.emoji}</span>
              <span>{group.label}</span>
              <span
                style={{
                  color: '#94A3B8',
                  fontSize: '0.74rem',
                  fontWeight: 500,
                  marginLeft: '2px',
                }}
              >
                {group.count}x • {formatBrlCurrency(group.totalAmount)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── 5. Barra de Ações Rápidas (Interatividade com 1 toque) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          paddingTop: '6px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <button
          type="button"
          onClick={() => onViewTransactions()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'transparent',
            color: '#38BDF8',
            fontSize: '0.82rem',
            fontWeight: 600,
            border: 'none',
            padding: '4px 0',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#7DD3FC')}
          onMouseLeave={e => (e.currentTarget.style.color = '#38BDF8')}
        >
          <Search size={14} />
          <span>Ver as {totalCount} compras</span>
        </button>

        <button
          type="button"
          onClick={handleToggleChallenge}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '24px',
            fontSize: '0.8rem',
            fontWeight: 700,
            backgroundColor: challengeAcceptedInternal
              ? 'rgba(34, 197, 94, 0.15)'
              : 'rgba(245, 158, 11, 0.12)',
            color: challengeAcceptedInternal ? '#4ADE80' : '#FBBF24',
            border: challengeAcceptedInternal
              ? '1px solid rgba(34, 197, 94, 0.3)'
              : '1px solid rgba(245, 158, 11, 0.25)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {challengeAcceptedInternal ? (
            <>
              <Check size={14} />
              <span>Meta Suave Ativada</span>
            </>
          ) : (
            <>
              <Target size={14} />
              <span>Topar Meta (-{suggestedSavingsCount})</span>
            </>
          )}
        </button>
      </div>

      {challengeAcceptedInternal && (
        <div
          style={{
            fontSize: '0.76rem',
            color: '#4ADE80',
            backgroundColor: 'rgba(34, 197, 94, 0.08)',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(34, 197, 94, 0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Sparkles size={13} style={{ flexShrink: 0 }} />
          <span>
            Meta suave gravada! O Sobi vai acompanhar de leve no próximo mês, sem cobrança.
          </span>
        </div>
      )}
    </div>
  );
};
