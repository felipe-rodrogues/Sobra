import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Lightbulb, 
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
    const isFuture = calc.bucket === 'future';

    // Tom coral/rosa suave e dessaturado para alertas (sem estresse visual)
    const softDangerColor = '#F87171';

    const progressBarColor = isOver 
      ? softDangerColor 
      : isWarning 
      ? '#F59E0B' 
      : badgeColor;

    return (
      <div
        key={calc.bucket}
        style={{
          backgroundColor: '#12161B',
          borderRadius: '20px',
          padding: '16px 18px',
          border: isOver ? '1px solid rgba(248, 113, 113, 0.20)' : '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Linha 1: Cabeçalho com Ícone Neutro à Esquerda e Coluna de Título + Status + Tagline */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {/* Ícone Neutro Maior (cobre a altura das 2 linhas) */}
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '11px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#CBD5E1',
              flexShrink: 0,
            }}
          >
            <IconRenderer name={calc.icon} size={19} color="#CBD5E1" />
          </div>

          {/* Coluna de Informações: ocupa todo o espaço restante do card */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {/* Linha superior: Título e % na esquerda, Status/Ação na extrema direita */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#FFFFFF', margin: 0, whiteSpace: 'nowrap' }}>
                  {calc.name}
                </h3>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    color: '#94A3B8',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    padding: '1px 6px',
                    borderRadius: '6px',
                    flexShrink: 0,
                  }}
                >
                  {calc.percentageTarget}%
                </span>
              </div>

              {/* Ação alinhada à direita da linha do título */}
              {actionButton}
            </div>

            {/* Linha inferior: Tagline das categorias com 100% da largura da coluna */}
            <div
              style={{
                fontSize: '0.70rem',
                color: '#64748B',
                lineHeight: 1.25,
              }}
            >
              {calc.tagline}
            </div>
          </div>
        </div>

        {/* Linha 2: Métrica Principal e Ritmo Diário */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
          <div>
            <div
              style={{
                fontSize: '0.68rem',
                color: isOver ? softDangerColor : '#94A3B8',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 600,
              }}
            >
              {isFuture
                ? 'Guardado este mês'
                : isOver
                ? 'Estourou em'
                : 'Disponível no mês'}
            </div>
            <div
              style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: isOver ? softDangerColor : '#FFFFFF',
                fontFamily: "'Outfit', 'Inter', sans-serif",
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                marginTop: '3px',
              }}
            >
              {isOver
                ? maskValue(`- ${formatBrlCurrency(calc.spentAmount - calc.targetAmount)}`)
                : isFuture
                ? maskValue(formatBrlCurrency(calc.spentAmount))
                : maskValue(formatBrlCurrency(calc.remainingAmount))}
            </div>
          </div>

          {/* Lado Direito: Ritmo diário ou Meta */}
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '0.68rem',
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 500,
              }}
            >
              {isFuture
                ? 'Meta do mês'
                : isOver
                ? 'Ritmo diário'
                : 'Ritmo diário'}
            </div>
            <div
              style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                color: isOver ? '#64748B' : isFuture ? '#E2E8F0' : '#CBD5E1',
                marginTop: '3px',
              }}
            >
              {isFuture ? (
                maskValue(formatBrlCurrency(calc.targetAmount))
              ) : isOver ? (
                'Esgotado'
              ) : (
                `${maskValue(formatBrlCurrency(calc.dailyAvailableRestOfMonth))}/dia`
              )}
            </div>
          </div>
        </div>

        {/* Linha 3: Barra de Progresso e Apoio do Teto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
              fontSize: '0.72rem',
              color: '#64748B',
              lineHeight: 1.2,
            }}
          >
            {isFuture ? (
              <>
                <span>
                  {calc.spentAmount >= calc.targetAmount && calc.targetAmount > 0
                    ? '100% da meta alcançada 🎉'
                    : calc.spentAmount > 0
                    ? `Guardado ${maskValue(formatBrlCurrency(calc.spentAmount))} de ${maskValue(formatBrlCurrency(calc.targetAmount))}`
                    : `Alvo planejado: ${maskValue(formatBrlCurrency(calc.targetAmount))}`}
                </span>
                <span style={{ color: calc.spentAmount >= calc.targetAmount ? '#4ADE80' : '#94A3B8', fontWeight: 600 }}>
                  {calc.spentAmount >= calc.targetAmount
                    ? 'Meta batida'
                    : `Faltam ${maskValue(formatBrlCurrency(calc.remainingAmount))}`}
                </span>
              </>
            ) : (
              <>
                <span>
                  Gasto <strong style={{ color: '#E2E8F0', fontWeight: 600 }}>{maskValue(formatBrlCurrency(calc.spentAmount))}</strong> de {maskValue(formatBrlCurrency(calc.targetAmount))}
                </span>
                <span
                  style={{
                    color: isOver ? softDangerColor : isWarning ? '#F59E0B' : '#94A3B8',
                    fontWeight: 600,
                  }}
                >
                  {calc.percentageSpent}% usado
                </span>
              </>
            )}
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
              paddingTop: '8px',
              paddingBottom: '2px',
              backgroundColor: 'transparent',
              border: 'none',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              color: '#94A3B8',
              fontSize: '0.74rem',
              fontWeight: 500,
              cursor: 'pointer',
              marginTop: '4px',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
            onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
          >
            <span>
              {isExpanded ? 'Ocultar categorias' : `Ver ${calc.categories.length} ${calc.categories.length === 1 ? 'categoria' : 'categorias'}`}
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
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
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
      {(() => {
        const isPositiveSobra = summary.overallSobra >= 0;
        const hasIncome = summary.referenceIncome > 0;
        const spentPctOfIncome = hasIncome
          ? Math.round((summary.totalSpent / summary.referenceIncome) * 100)
          : 0;
        const sobraPctOfIncome = Math.max(0, 100 - spentPctOfIncome);

        // Cor de status: coral para déficit, âmbar se quase no limite (>=85%), verde se saudável
        const statusColor = !isPositiveSobra
          ? '#F87171'
          : spentPctOfIncome >= 85
          ? '#F59E0B'
          : '#4ADE80';

        const statusBg = !isPositiveSobra
          ? 'rgba(248, 113, 113, 0.10)'
          : spentPctOfIncome >= 85
          ? 'rgba(245, 158, 11, 0.12)'
          : 'rgba(74, 222, 128, 0.10)';

        const statusBorder = !isPositiveSobra
          ? 'rgba(248, 113, 113, 0.22)'
          : spentPctOfIncome >= 85
          ? 'rgba(245, 158, 11, 0.25)'
          : 'rgba(74, 222, 128, 0.22)';

        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '16px 18px',
              borderRadius: '20px',
              backgroundColor: '#12161B',
              border: !isPositiveSobra
                ? '1px solid rgba(248, 113, 113, 0.20)'
                : '1px solid rgba(255, 255, 255, 0.07)',
            }}
          >
            {/* Topo: Sobra Projetada em Destaque + Badge de Proporção Livre */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    color: !isPositiveSobra ? '#F87171' : '#94A3B8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontWeight: 600,
                  }}
                >
                  {isPositiveSobra ? 'Sobra Projetada no Mês' : 'Déficit Projetado no Mês'}
                </div>
                <div
                  style={{
                    fontSize: '1.45rem',
                    fontWeight: 800,
                    color: statusColor,
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                    marginTop: '3px',
                  }}
                >
                  {isPositiveSobra ? '+' : ''}{maskValue(formatBrlCurrency(summary.overallSobra))}
                </div>
              </div>

              {/* Badge de Proporção Livre / Comprometida */}
              {hasIncome && (
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: statusColor,
                    backgroundColor: statusBg,
                    border: `1px solid ${statusBorder}`,
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {isPositiveSobra ? `${sobraPctOfIncome}% livre` : `${spentPctOfIncome}% da renda`}
                </div>
              )}
            </div>

            {/* Barra de Progresso do Consumo da Renda */}
            {hasIncome && (
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
                    width: `${Math.min(spentPctOfIncome, 100)}%`,
                    backgroundColor: statusColor,
                    borderRadius: '9999px',
                    transition: 'width 0.35s ease',
                  }}
                />
              </div>
            )}

            {/* Rodapé: Comprometido vs Renda Base */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.72rem',
                color: '#64748B',
                lineHeight: 1.2,
              }}
            >
              <span>
                Comprometido: <strong style={{ color: '#E2E8F0', fontWeight: 600 }}>{maskValue(formatBrlCurrency(summary.totalSpent))}</strong>
              </span>
              <span>
                Renda base: <strong style={{ color: '#CBD5E1', fontWeight: 600 }}>{maskValue(formatBrlCurrency(summary.referenceIncome))}</strong>
              </span>
            </div>
          </div>
        );
      })()}

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
