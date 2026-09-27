import React, { useMemo } from 'react';
import { ChevronRight, CalendarClock } from 'lucide-react';
import { Subscription, Transaction, Account, Category } from '../../core/types';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { calculateBurnRateProjection } from '../../core/calculations';
import { SubscriptionLogo } from '../subscriptions/SubscriptionLogo';

interface PierreCompactCardsGridProps {
  subscriptions: Subscription[];
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  isPrivacyMode: boolean;
  maskValue: (v: string) => string;
  onOpenSubscriptions: () => void;
  onOpenProjection: () => void;
  onOpenDailyGoal?: () => void;
}

export const PierreCompactCardsGrid: React.FC<PierreCompactCardsGridProps> = ({
  subscriptions,
  transactions,
  accounts,
  categories,
  isPrivacyMode,
  maskValue,
  onOpenSubscriptions,
  onOpenProjection,
  onOpenDailyGoal,
}) => {
  // ── 1. CÁLCULOS DE ASSINATURAS ─────────────────────────────────────────────
  const activeSubs = useMemo(() => {
    return subscriptions.filter(s => s.status === 'active' && s.type !== 'income');
  }, [subscriptions]);

  const totalMonthlyCost = useMemo(() => {
    return activeSubs.reduce((sum, s) => {
      return sum + (s.cadence === 'yearly' ? s.amount / 12 : s.amount);
    }, 0);
  }, [activeSubs]);

  const displayedSubs = useMemo(() => activeSubs.slice(0, 3), [activeSubs]);
  const extraSubsCount = Math.max(0, activeSubs.length - 3);

  // ── 2. CÁLCULOS DE RITMO & LIMITE DE GASTOS ───────────────────────────────
  const burnRateProjection = useMemo(() => {
    return calculateBurnRateProjection(transactions, new Date(), accounts);
  }, [transactions, accounts]);

  const now = new Date();
  const storageKey = `sobra_daily_budget_goal_v1_${now.getFullYear()}_${now.getMonth() + 1}`;
  
  const resolvedGoal = useMemo(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  }, [storageKey]);

  const isWeekly = resolvedGoal?.cadence ? resolvedGoal.cadence === 'weekly' : true;
  const multiplier = isWeekly ? 7 : 1;
  const suffix = isWeekly ? '/sem' : '/dia';

  const realRate = Math.round(burnRateProjection.dailyBurnRate * multiplier * 100) / 100;
  const ceilingRate = resolvedGoal
    ? Math.round(resolvedGoal.dailyAmount * multiplier * 100) / 100
    : Math.round(burnRateProjection.recommendedDailyBudget * multiplier * 100) / 100;

  const isFast = burnRateProjection.paceStatus === 'fast_burn' || burnRateProjection.projectedSobra < 0 || (realRate > ceilingRate && ceilingRate > 0);
  const statusColor = isFast ? '#F59F15' : '#10B981';
  const statusLabel = isFast ? 'Acelerado' : 'No ritmo';

  // Progresso para o donut gauge SVG (idêntico à segunda imagem - Pierre)
  const pacePercent = ceilingRate > 0 
    ? Math.min(100, Math.max(0, Math.round((realRate / ceilingRate) * 100))) 
    : 0;

  // Donut encorpado proporcional à imagem 2 (diâmetro ~42px, stroke 8px, pontas flat)
  const gaugeRadius = 16.5;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius; // ~103.67
  const gaugeArc = (pacePercent / 100) * gaugeCircumference;
  // Cor âmbar/laranja característica da Pierre (#F59F15) ou alerta se estourado
  const gaugeColor = realRate > ceilingRate && ceilingRate > 0 ? '#FB7185' : '#F59F15';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        width: '100%',
      }}
    >
      {/* ── CARD 1: ASSINATURAS (ESTILO PIERRE) ─────────────────────────── */}
      <div
        onClick={onOpenSubscriptions}
        className="card-sobra"
        style={{
          background: 'linear-gradient(150deg, #131915 0%, #0d120f 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderTop: '1px solid rgba(255, 255, 255, 0.13)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          padding: '14px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '124px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Topo do Card: Avatares Sobrepostos ou Ícone + Seta */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', minHeight: '42px' }}>
          {displayedSubs.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', minHeight: '42px' }}>
              {displayedSubs.map((sub, idx) => (
                <div
                  key={sub.id || idx}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: '2px solid #131915',
                    marginLeft: idx > 0 ? '-9px' : '0',
                    zIndex: 4 - idx,
                    overflow: 'hidden',
                    flexShrink: 0,
                    backgroundColor: '#1E293B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SubscriptionLogo
                    name={sub.name}
                    category={categories.find(c => c.id === sub.categoryId)}
                    size={30}
                  />
                </div>
              ))}

              {extraSubsCount > 0 && (
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: '#1E293B',
                    border: '2px solid #131915',
                    marginLeft: '-9px',
                    zIndex: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#94A3B8',
                    flexShrink: 0,
                  }}
                >
                  +{extraSubsCount}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94A3B8',
                marginTop: '5px',
              }}
            >
              <CalendarClock size={16} />
            </div>
          )}

          <div style={{ paddingTop: '2px' }}>
            <ChevronRight size={15} color="#64748B" />
          </div>
        </div>

        {/* Base do Card: Nome, Valor Hero e Subtítulo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '12px' }}>
          <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 500, letterSpacing: '-0.01em' }}>
            Assinaturas
          </span>
          <span
            style={{
              fontSize: '1.14rem',
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              fontFamily: "'Outfit', 'Inter', sans-serif",
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.15,
            }}
          >
            {totalMonthlyCost > 0 ? maskValue(formatBrlCurrency(totalMonthlyCost)) : 'R$ 0,00'}
          </span>
          <span style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: 500, marginTop: '1px' }}>
            {activeSubs.length > 0 
              ? `${activeSubs.length} ${activeSubs.length === 1 ? 'assinatura' : 'assinaturas'}`
              : 'Nenhuma cadastrada'}
          </span>
        </div>
      </div>

      {/* ── CARD 2: RITMO & LIMITE DE GASTOS (ESTILO PIERRE) ───────────── */}
      <div
        onClick={onOpenProjection || onOpenDailyGoal}
        className="card-sobra"
        style={{
          background: 'linear-gradient(150deg, #131915 0%, #0d120f 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderTop: '1px solid rgba(255, 255, 255, 0.13)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          padding: '14px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '124px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Topo do Card: Donut Gauge encorpado estilo Pierre (imagem 2) + Seta */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ width: '42px', height: '42px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg
              width={42}
              height={42}
              viewBox="0 0 42 42"
              style={{ flexShrink: 0 }}
            >
              <g transform="rotate(-90 21 21)">
                {/* Trilha do anel encorpada e escura (estilo Pierre) */}
                <circle
                  cx={21}
                  cy={21}
                  r={gaugeRadius}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth={8}
                />
                {/* Arco preenchido com pontas retas (flat/butt) estilo donut da imagem 2 */}
                {pacePercent > 0 && (
                  <circle
                    cx={21}
                    cy={21}
                    r={gaugeRadius}
                    fill="none"
                    stroke={gaugeColor}
                    strokeWidth={8}
                    strokeDasharray={`${gaugeArc} ${gaugeCircumference}`}
                    strokeLinecap="butt"
                    style={{
                      transition: 'stroke-dasharray 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                )}
              </g>
            </svg>
          </div>

          <div style={{ paddingTop: '2px' }}>
            <ChevronRight size={15} color="#64748B" />
          </div>
        </div>

        {/* Base do Card: Nome, Valor Hero e Subtítulo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '12px' }}>
          <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 500, letterSpacing: '-0.01em' }}>
            Ritmo de gastos
          </span>
          <span
            style={{
              fontSize: '1.14rem',
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              fontFamily: "'Outfit', 'Inter', sans-serif",
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.15,
            }}
          >
            {maskValue(formatBrlCurrency(realRate))}{suffix}
          </span>
          <span
            style={{
              fontSize: '0.67rem',
              color: statusColor,
              fontWeight: 600,
              marginTop: '1px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '-0.01em',
            }}
          >
            {statusLabel} · Teto {maskValue(formatBrlCurrency(ceilingRate))}
          </span>
        </div>
      </div>
    </div>
  );
};
