import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Lightbulb, 
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { ThreeBucketsSummary, BucketCalculation, CategoryBucket } from '../../core/types';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { IconRenderer } from '../common/IconRenderer';

interface ThreeBucketsViewProps {
  summary: ThreeBucketsSummary;
  isPrivacyMode: boolean;
  onOpenConfig: () => void;
  onOpenNewGoal?: () => void;
  onQuickDeposit?: () => void;
  monthName: string;
  year: number;
  daysRemainingInMonth: number;
}

export const ThreeBucketsView: React.FC<ThreeBucketsViewProps> = ({
  summary,
  isPrivacyMode,
  onOpenConfig,
  onOpenNewGoal,
  onQuickDeposit,
  monthName,
  year,
  daysRemainingInMonth,
}) => {
  const [expandedBucket, setExpandedBucket] = useState<CategoryBucket | null>(null);

  const maskValue = (val: string) => (isPrivacyMode ? '••••••' : val);

  const toggleExpand = (bucket: CategoryBucket) => {
    setExpandedBucket(prev => (prev === bucket ? null : bucket));
  };

  const renderBucketCard = (
    calc: BucketCalculation,
    badgeColor: string,
    actionButton?: React.ReactNode
  ) => {
    const isExpanded = expandedBucket === calc.bucket;
    const isOver = calc.spentAmount > calc.targetAmount && calc.targetAmount > 0;
    const isWarning = calc.percentageSpent >= 80 && !isOver;

    const progressBarColor = isOver 
      ? '#E26D6D' 
      : isWarning 
      ? '#F59E0B' 
      : badgeColor;

    return (
      <div
        key={calc.bucket}
        style={{
          backgroundColor: '#12161B',
          borderRadius: '18px',
          padding: '14px 16px',
          border: isOver ? '1px solid rgba(226, 109, 109, 0.2)' : '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Linha 1: Cabeçalho com Título na esquerda e Status/Ação na direita */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: badgeColor,
                  flexShrink: 0,
                }}
              >
                <IconRenderer name={calc.icon} size={15} color={badgeColor} />
              </div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#FFFFFF', margin: 0, whiteSpace: 'nowrap' }}>
                {calc.name}
              </h3>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: '#94A3B8',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  padding: '1px 6px',
                  borderRadius: '6px',
                  flexShrink: 0,
                }}
              >
                {calc.percentageTarget}%
              </span>
            </div>

            {/* Lado Direito: Ações e Status alinhados na linha do Título */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {actionButton}
              {isOver ? (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#E26D6D',
                    backgroundColor: 'rgba(226, 109, 109, 0.09)',
                    border: '1px solid rgba(226, 109, 109, 0.16)',
                    padding: '2px 8px',
                    borderRadius: '7px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <AlertTriangle size={12} color="#E26D6D" />
                  Acima do teto
                </span>
              ) : isWarning ? (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#F59E0B',
                    backgroundColor: 'rgba(245, 158, 11, 0.09)',
                    border: '1px solid rgba(245, 158, 11, 0.16)',
                    padding: '2px 8px',
                    borderRadius: '7px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Atenção (80%+)
                </span>
              ) : calc.bucket === 'future' ? (
                calc.spentAmount >= calc.targetAmount ? (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: '#52B788',
                      backgroundColor: 'rgba(82, 183, 136, 0.09)',
                      border: '1px solid rgba(82, 183, 136, 0.16)',
                      padding: '2px 8px',
                      borderRadius: '7px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <CheckCircle2 size={12} color="#52B788" />
                    Meta atingida
                  </span>
                ) : null
              ) : (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#94A3B8',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    padding: '2px 8px',
                    borderRadius: '7px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      backgroundColor: '#52B788',
                    }}
                  />
                  No ritmo
                </span>
              )}
            </div>
          </div>

          {/* Sublinha de Categorias: 100% da Largura Livre, alinhada com o texto do título */}
          <div
            style={{
              fontSize: '0.72rem',
              color: '#94A3B8',
              paddingLeft: '36px',
            }}
          >
            {calc.tagline}
          </div>
        </div>

        {/* Linha 2: Valores em Destaque */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              {calc.bucket === 'future'
                ? 'Guardado este mês'
                : isOver
                ? 'Saldo atual'
                : 'Disponível'}
            </div>
            <div
              style={{
                fontSize: '1.65rem',
                fontWeight: 800,
                color: isOver ? '#E26D6D' : '#FFFFFF',
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                marginTop: '2px',
              }}
            >
              {isOver
                ? maskValue(`- ${formatBrlCurrency(calc.spentAmount - calc.targetAmount)}`)
                : calc.bucket === 'future'
                ? maskValue(formatBrlCurrency(calc.spentAmount))
                : maskValue(formatBrlCurrency(calc.remainingAmount))}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 500 }}>
              {calc.bucket === 'future' ? 'Alvo planejado' : 'Teto planejado'}
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#E2E8F0', marginTop: '2px' }}>
              {maskValue(formatBrlCurrency(calc.targetAmount))}
            </div>
          </div>
        </div>

        {/* Linha 3: Barra de Progresso e Subtítulo Discreto */}
        <div>
          <div
            style={{
              height: '4px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(calc.percentageSpent, 100)}%`,
                backgroundColor: progressBarColor,
                borderRadius: '9999px',
                transition: 'width 0.35s ease',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.73rem',
              color: '#94A3B8',
              marginTop: '5px',
            }}
          >
            <span>
              {calc.bucket === 'future' ? 'Guardado: ' : 'Gasto: '}
              <strong style={{ color: '#E2E8F0', fontWeight: 600 }}>{maskValue(formatBrlCurrency(calc.spentAmount))}</strong>
              {' '}({calc.percentageSpent}%)
            </span>

            <span>
              {calc.bucket === 'future' ? (
                calc.spentAmount >= calc.targetAmount
                  ? '100% atingido'
                  : `Faltam ${maskValue(formatBrlCurrency(calc.remainingAmount))}`
              ) : isOver ? (
                'Sem saldo restante'
              ) : isWarning ? (
                `${maskValue(formatBrlCurrency(calc.dailyAvailableRestOfMonth))}/dia (ritmo alto)`
              ) : (
                `${maskValue(formatBrlCurrency(calc.dailyAvailableRestOfMonth))}/dia`
              )}
            </span>
          </div>
        </div>

        {/* Linha 4: Accordion para Categorias (Apenas se houver categorias) */}
        {calc.categories.length > 0 && (
          <button
            type="button"
            onClick={() => toggleExpand(calc.bucket)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '6px',
              paddingBottom: '2px',
              backgroundColor: 'transparent',
              border: 'none',
              borderTop: '1px solid rgba(255, 255, 255, 0.04)',
              color: '#94A3B8',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              marginTop: '2px',
            }}
          >
            <span>
              {isExpanded ? 'Ocultar' : 'Ver'} {calc.categories.length} {calc.categories.length === 1 ? 'categoria' : 'categorias'}
            </span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}

        {/* Lista de Categorias Expandida */}
        {isExpanded && calc.categories.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
            {calc.categories.map(cat => {
              const pctOfBucket = calc.spentAmount > 0 
                ? Math.round((cat.spent / calc.spentAmount) * 100) 
                : 0;

              return (
                <div
                  key={cat.categoryId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '7px',
                        backgroundColor: `${cat.color}25`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconRenderer name={cat.icon} size={14} color={cat.color} />
                    </div>
                    <span style={{ fontSize: '0.82rem', color: '#E2E8F0', fontWeight: 500 }}>
                      {cat.categoryName}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF' }}>
                      {maskValue(formatBrlCurrency(cat.spent))}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                      {pctOfBucket}% do pilar
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
      {/* 1. Pilar 1: Essenciais (Pra Viver) */}
      {renderBucketCard(summary.buckets.essentials, '#52B788')}

      {/* 2. Pilar 2: Estilo de Vida (Pra Curtir) */}
      {renderBucketCard(summary.buckets.lifestyle, '#EA580C')}

      {/* 3. Pilar 3: Futuro & Sobra (Pra Amanhã) com Botão de Aporte Rápido */}
      {renderBucketCard(
        summary.buckets.future,
        '#10B981',
        (onOpenNewGoal || onQuickDeposit) && (
          <button
            type="button"
            onClick={onQuickDeposit || onOpenNewGoal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '3px 9px',
              color: '#F1F5F9',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Plus size={12} color="#94A3B8" />
            <span>Aportar</span>
          </button>
        )
      )}

      {/* 4. Card Síntese de Sobra do Mês */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: '16px',
          backgroundColor: '#12161B',
          border: '1px solid rgba(255, 255, 255, 0.07)',
        }}
      >
        <div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', whiteSpace: 'nowrap' }}>Sobra Projetada</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: summary.overallSobra >= 0 ? '#52B788' : '#E26D6D', marginTop: '2px' }}>
            {summary.overallSobra >= 0 ? '+' : ''}{maskValue(formatBrlCurrency(summary.overallSobra))}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.72rem', color: '#9CA3AF', whiteSpace: 'nowrap' }}>Comprometido</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF', marginTop: '2px' }}>
            {maskValue(formatBrlCurrency(summary.totalSpent))} de {maskValue(formatBrlCurrency(summary.referenceIncome))}
          </div>
        </div>
      </div>

      {/* 7. Dica Educativa Minimalista no Rodapé (Calma e Respeitosa) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '6px 12px 10px',
          color: '#64748B',
          fontSize: '0.73rem',
          textAlign: 'center',
        }}
      >
        <Lightbulb size={13} color="#64748B" style={{ flexShrink: 0 }} />
        <span>Categorize suas compras com precisão para pilares 100% calibrados.</span>
      </div>
    </div>
  );
};
