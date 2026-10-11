import React, { useState } from 'react';
import { 
  Coffee, 
  ChevronDown, 
  X, 
  Target, 
  Check,
  Briefcase
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
  selectedGroupId?: MicroExpenseGroupId | 'all';
}

export const MicroExpensesRadarCard: React.FC<MicroExpensesRadarCardProps> = ({
  analysis,
  onViewTransactions,
  onDismiss,
  onThresholdChange,
  onAcceptChallenge,
  isChallengeActive = false,
  selectedGroupId = 'all',
}) => {
  const { colors } = useTheme();
  const [isThresholdMenuOpen, setIsThresholdMenuOpen] = useState(false);
  const [challengeAcceptedInternal, setChallengeAcceptedInternal] = useState(isChallengeActive);

  const {
    totalCount,
    totalAmount,
    suggestedSavingsCount,
    suggestedSavingsAmount,
    groups,
    thresholdAmount,
    commuteCount,
    goalName,
  } = analysis;

  const handleToggleChallenge = () => {
    const nextState = !challengeAcceptedInternal;
    setChallengeAcceptedInternal(nextState);
    if (nextState && onAcceptChallenge) {
      onAcceptChallenge(suggestedSavingsCount, suggestedSavingsAmount);
    }
  };

  const thresholdOptions = [10, 15, 20, 25, 30, 40, 50];

  return (
    <div
      style={{
        backgroundColor: colors.surfaceElevated || '#131915',
        borderRadius: '18px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '14px 16px 12px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.22)',
        transition: 'all 0.2s ease',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* ── 1. Topo Compacto: Título + Teto + Ações Rápidas ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '8px',
              backgroundColor: 'rgba(245, 158, 11, 0.14)',
              color: '#FBBF24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Coffee size={14} />
          </div>

          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#FFFFFF',
              fontFamily: "'Outfit', 'Inter', sans-serif",
            }}
          >
            Radar de Microgastos
          </span>

          {/* Seletor de Teto em Dropdown Amigável */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsThresholdMenuOpen(prev => !prev)}
              aria-label="Ajustar limite de microgasto"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 8px',
                borderRadius: '14px',
                fontSize: '0.72rem',
                fontWeight: 600,
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                color: '#CBD5E1',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
              }}
            >
              <span>Até R$ {thresholdAmount}</span>
              <ChevronDown size={11} style={{ opacity: 0.8 }} />
            </button>

            {isThresholdMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '115%',
                  left: 0,
                  backgroundColor: '#1E2620',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.45)',
                  padding: '4px',
                  zIndex: 25,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  minWidth: '115px',
                }}
              >
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
                      padding: '5px 8px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: thresholdAmount === val ? 700 : 500,
                      backgroundColor: thresholdAmount === val ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                      color: thresholdAmount === val ? '#4ADE80' : '#E2E8F0',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>Até R$ {val}</span>
                    {thresholdAmount === val && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lado Direito: Botão Meta e Fechar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={handleToggleChallenge}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '16px',
              fontSize: '0.74rem',
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
                <Check size={12} />
                <span>Meta Ativa</span>
              </>
            ) : (
              <>
                <Target size={12} />
                <span>Topar Meta (-{suggestedSavingsCount})</span>
              </>
            )}
          </button>

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              title="Fechar filtro de microgastos"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                color: '#64748B',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
              onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Destaque Numérico Limpo ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span
            style={{
              fontSize: '1.55rem',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              fontFamily: "'Outfit', 'Inter', sans-serif",
            }}
          >
            {formatBrlCurrency(totalAmount)}
          </span>
          <span
            style={{
              fontSize: '0.82rem',
              color: '#94A3B8',
              fontWeight: 500,
            }}
          >
            em {totalCount} compras
          </span>
        </div>

        {commuteCount > 0 && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 7px',
              borderRadius: '6px',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.16)',
              color: '#7DD3FC',
              fontSize: '0.7rem',
              fontWeight: 600,
            }}
          >
            <Briefcase size={10} />
            <span>{commuteCount} idas/voltas de trabalho protegidas</span>
          </div>
        )}
      </div>

      {/* ── 3. Frase Direta de Contexto (1 Linha) ── */}
      <div
        style={{
          fontSize: '0.78rem',
          lineHeight: 1.4,
          color: '#CBD5E1',
        }}
      >
        Economizar <strong style={{ color: '#FBBF24', fontWeight: 700 }}>{suggestedSavingsCount} compras</strong> guarda{' '}
        <strong style={{ color: '#4ADE80', fontWeight: 700 }}>+{formatBrlCurrency(suggestedSavingsAmount)}</strong>{' '}
        {goalName ? (
          <>
            na meta <strong style={{ color: '#38BDF8', fontWeight: 700 }}>"{goalName}"</strong> 🎯
          </>
        ) : (
          'na sua reserva'
        )}.
      </div>

      {/* ── 4. Pills de Filtro Rápido por Sub-Hábito ── */}
      {groups.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '2px',
          }}
        >
          {/* Opção Todas */}
          <button
            type="button"
            onClick={() => onViewTransactions(undefined)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 9px',
              borderRadius: '10px',
              backgroundColor: selectedGroupId === 'all' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${selectedGroupId === 'all' ? '#FBBF24' : 'rgba(255, 255, 255, 0.08)'}`,
              color: selectedGroupId === 'all' ? '#FBBF24' : '#E2E8F0',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span>Todas</span>
            <span style={{ opacity: 0.8, fontSize: '0.7rem' }}>({totalCount})</span>
          </button>

          {groups.map(group => {
            const isSelected = selectedGroupId === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => onViewTransactions(group.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 9px',
                  borderRadius: '10px',
                  backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${isSelected ? '#FBBF24' : 'rgba(255, 255, 255, 0.08)'}`,
                  color: isSelected ? '#FBBF24' : '#E2E8F0',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <span>{group.emoji}</span>
                <span>{group.shortLabel}</span>
                <span style={{ opacity: 0.8, fontSize: '0.7rem' }}>({group.count})</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
