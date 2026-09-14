import React, { useState } from 'react';
import { Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { BalanceTrendResult, HistoricalMonthlyData } from '../../core/calculations';

interface SobraBalanceHeroCardProps {
  cashBalance: number;
  netSobra: number;
  creditCardDebt: number;
  trend: BalanceTrendResult;
  historicalData: HistoricalMonthlyData[];
  isPrivacyMode: boolean;
  onTogglePrivacy: () => void;
  maskValue: (v: string) => string;
}

export const SobraBalanceHeroCard: React.FC<SobraBalanceHeroCardProps> = ({
  cashBalance,
  netSobra,
  creditCardDebt,
  trend,
  historicalData,
  isPrivacyMode,
  onTogglePrivacy,
  maskValue,
}) => {
  // Permite alternar entre "Saldo em Contas" e "Sobra Líquida Real"
  const [balanceMode, setBalanceMode] = useState<'cash' | 'net'>('cash');

  const displayedValue = balanceMode === 'cash' ? cashBalance : netSobra;
  const label = balanceMode === 'cash' ? 'Seu saldo atual' : 'Sobra líquida real';

  // Obter as últimas 4 barras reais do histórico para o mini-gráfico no canto
  const miniBars = React.useMemo(() => {
    const recent = historicalData.slice(-4);
    const maxVal = Math.max(...recent.map(d => Math.max(d.income, d.expense, 1)), 1);
    return recent.map(d => {
      const heightPercent = Math.max(15, Math.min(100, Math.round((Math.max(d.income, d.expense) / maxVal) * 100)));
      return {
        ...d,
        heightPercent,
      };
    });
  }, [historicalData]);

  return (
    <div
      className="card-sobra"
      style={{
        padding: '22px 20px',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #151D18 0%, #111713 50%, #0E1410 100%)',
        border: '1px solid rgba(74, 222, 128, 0.12)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      }}
    >
      {/* Mini Gráfico de Barras no Canto Superior Direito (Baseado em dados reais do histórico) */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '5px',
          height: '42px',
          padding: '4px',
        }}
        title="Histórico dos últimos meses"
      >
        {miniBars.length > 0 ? (
          miniBars.map((bar, idx) => {
            const isLast = idx === miniBars.length - 1;
            return (
              <div
                key={bar.fullLabel || idx}
                style={{
                  width: '6px',
                  height: `${bar.heightPercent}%`,
                  borderRadius: '3px',
                  backgroundColor: isLast
                    ? '#4ADE80'
                    : bar.isSurplus
                    ? 'rgba(74, 222, 128, 0.35)'
                    : 'rgba(255, 255, 255, 0.15)',
                  boxShadow: isLast ? '0 0 8px rgba(74, 222, 128, 0.4)' : 'none',
                  transition: 'height 0.3s ease',
                }}
              />
            );
          })
        ) : (
          // Fallback sutil caso não haja histórico
          <>
            <div style={{ width: '6px', height: '30%', borderRadius: '3px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />
            <div style={{ width: '6px', height: '55%', borderRadius: '3px', backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />
            <div style={{ width: '6px', height: '75%', borderRadius: '3px', backgroundColor: 'rgba(74, 222, 128, 0.35)' }} />
            <div style={{ width: '6px', height: '100%', borderRadius: '3px', backgroundColor: '#4ADE80', boxShadow: '0 0 8px rgba(74, 222, 128, 0.4)' }} />
          </>
        )}
      </div>

      {/* Rótulo Superior com Seletor / Alternador */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span
          onClick={() => setBalanceMode(prev => prev === 'cash' ? 'net' : 'cash')}
          style={{
            fontSize: '0.84rem',
            color: '#94A3B8',
            fontWeight: 500,
            cursor: 'pointer',
            borderBottom: '1px dotted rgba(148, 163, 184, 0.4)',
          }}
          title="Clique para alternar entre Saldo em Contas e Sobra Líquida Real"
        >
          {label}
        </span>

        {creditCardDebt > 0 && balanceMode === 'cash' && (
          <span style={{ fontSize: '0.72rem', color: '#F43F5E', fontWeight: 600 }}>
            (-{maskValue(formatBrlCurrency(creditCardDebt))} em faturas)
          </span>
        )}
      </div>

      {/* Valor do Saldo Real com Olho de Privacidade */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0 14px' }}>
        <h2
          style={{
            fontSize: '2.15rem',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            color: '#FFFFFF',
            lineHeight: 1.1,
            margin: 0,
            fontFamily: "'Outfit', 'Inter', sans-serif",
          }}
        >
          {maskValue(formatBrlCurrency(displayedValue))}
        </h2>

        <button
          type="button"
          onClick={onTogglePrivacy}
          style={{
            padding: '6px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: '#94A3B8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'color 0.2s',
          }}
          title={isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores'}
        >
          {isPrivacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {/* Badge de Tendência Real (100% calculado da conta do usuário) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: trend.isPositive ? '#4ADE80' : '#FB7185',
          }}
        >
          {trend.isPositive ? (
            <ArrowUp size={14} strokeWidth={2.6} />
          ) : (
            <ArrowDown size={14} strokeWidth={2.6} />
          )}
          <span>{trend.label}</span>
        </div>

        <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
          {trend.comparisonText}
        </span>
      </div>
    </div>
  );
};
