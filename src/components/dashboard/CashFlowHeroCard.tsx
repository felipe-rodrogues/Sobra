import React from 'react';
import { ChevronRight, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { calculateCashFlow } from '../../core/cashFlow/cashFlowHelper';
import { Account, Transaction } from '../../core/types';

interface CashFlowHeroCardProps {
  transactions: Transaction[];
  accounts: Account[];
  selectedMonth?: number;
  selectedYear?: number;
  isPrivacyMode: boolean;
  maskValue: (v: string) => string;
  onOpenDetails: () => void;
  onAddIncome?: () => void;
  onAddExpense?: () => void;
  onTransfer?: () => void;
}

export const CashFlowHeroCard: React.FC<CashFlowHeroCardProps> = ({
  transactions,
  accounts,
  selectedMonth = new Date().getMonth() + 1,
  selectedYear = new Date().getFullYear(),
  isPrivacyMode,
  maskValue,
  onOpenDetails,
}) => {
  // Padrão Real do Pierre: só o dinheiro movimentado nas contas bancárias
  const summary = calculateCashFlow(
    transactions,
    accounts,
    'this_month',
    selectedMonth,
    selectedYear,
    false
  );

  const { totalIncome, totalExpense, netFlow } = summary;

  // Cálculo das barras proporcionais (máximo entre entrada e saída, mínimo R$ 100)
  const maxBar = Math.max(totalIncome, totalExpense, 100);
  const incomePercent = Math.min(100, Math.max(totalIncome > 0 ? 5 : 0, (totalIncome / maxBar) * 100));
  const expensePercent = Math.min(100, Math.max(totalExpense > 0 ? 5 : 0, (totalExpense / maxBar) * 100));

  return (
    <div
      className="card-sobra"
      onClick={onOpenDetails}
      style={{
        background: 'linear-gradient(150deg, #131c16 0%, #0d120f 100%)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderTop: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 14px 36px rgba(0, 0, 0, 0.5)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient Glow sutil de fundo (Estilo Planejamento / Pierre) */}
      <div
        style={{
          position: 'absolute',
          top: '-45px',
          right: '-45px',
          width: '150px',
          height: '150px',
          borderRadius: '50%',
          backgroundColor: netFlow < 0 ? 'rgba(244, 63, 94, 0.14)' : 'rgba(74, 222, 128, 0.13)',
          filter: 'blur(42px)',
          pointerEvents: 'none',
        }}
      />

      {/* 1. Header do Card: Título em Linha Única Perfeita e Seta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0, position: 'relative' }}>
        <span
          style={{
            fontSize: '0.86rem',
            fontWeight: 500,
            color: '#94A3B8',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Fluxo de Caixa nas Contas • este mês
        </span>

        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94A3B8',
            flexShrink: 0,
            marginLeft: '8px',
          }}
        >
          <ChevronRight size={16} />
        </div>
      </div>

      {/* 2. Seção de Entradas e Saídas com Barras Proporcionais */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Linha de Entrada */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#4ADE80',
                  boxShadow: '0 0 8px rgba(74, 222, 128, 0.4)',
                }}
              />
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF' }}>
                Entrada
              </span>
            </div>
            <span
              style={{
                fontSize: '0.88rem',
                fontWeight: 600,
                color: '#E2E8F0',
                fontFamily: "'Outfit', 'Inter', sans-serif",
              }}
            >
              {maskValue(formatBrlCurrency(totalIncome))}
            </span>
          </div>

          {/* Barra de Progresso Entrada */}
          <div
            style={{
              width: '100%',
              height: '5px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${incomePercent}%`,
                backgroundColor: '#4ADE80',
                borderRadius: '9999px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        {/* Linha de Saída */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#F87171',
                  boxShadow: '0 0 8px rgba(248, 113, 113, 0.4)',
                }}
              />
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF' }}>
                Saída
              </span>
            </div>
            <span
              style={{
                fontSize: '0.88rem',
                fontWeight: 600,
                color: '#F87171',
                fontFamily: "'Outfit', 'Inter', sans-serif",
              }}
            >
              {totalExpense > 0 ? `-${maskValue(formatBrlCurrency(totalExpense))}` : maskValue(formatBrlCurrency(0))}
            </span>
          </div>

          {/* Barra de Progresso Saída */}
          <div
            style={{
              width: '100%',
              height: '5px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${expensePercent}%`,
                backgroundColor: '#F87171',
                borderRadius: '9999px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. Linha de Resultado: Resultado do mês */}
      <div
        style={{
          paddingTop: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '0.90rem', fontWeight: 600, color: '#94A3B8' }}>
          Resultado do mês
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {netFlow >= 0 ? (
            <ArrowUpRight size={16} color="#4ADE80" />
          ) : (
            <ArrowDownRight size={16} color="#F87171" />
          )}
          <span
            style={{
              fontSize: '1.02rem',
              fontWeight: 800,
              color: netFlow >= 0 ? '#4ADE80' : '#F87171',
              fontFamily: "'Outfit', 'Inter', sans-serif",
            }}
          >
            {netFlow >= 0 ? '+' : ''}{maskValue(formatBrlCurrency(netFlow))}
          </span>
        </div>
      </div>
    </div>
  );
};
