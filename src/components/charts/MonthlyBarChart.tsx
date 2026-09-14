import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { HistoricalMonthlyData } from '../../core/calculations';
import { TrendingUp, TrendingDown, Calendar, Sparkles } from 'lucide-react';

interface MonthlyBarChartProps {
  data: HistoricalMonthlyData[];
  title?: string;
  subtitle?: string;
}

export const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({
  data,
  title = 'Evolução Mensal (Últimos 6 Meses)',
  subtitle = 'Comparativo entre receitas recebidas e despesas realizadas',
}) => {
  const { colors } = useTheme();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return null;
  }

  // Encontrar o maior valor absoluto para escala proporcional das barras
  const maxVal = Math.max(
    ...data.map(d => Math.max(d.income, d.expense)),
    1000
  );

  const selectedMonth = hoveredIdx !== null ? data[hoveredIdx] : data[data.length - 1];

  return (
    <div
      style={{
        backgroundColor: '#121814',
        borderRadius: '24px',
        padding: '18px 20px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header do Card com Título e Legenda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="#4ADE80" />
            <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em', margin: 0, fontFamily: "'Outfit', sans-serif" }}>
              Evolução Mensal
            </h3>
          </div>
          <p style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '3px', margin: 0 }}>
            Últimos 6 meses de receitas e despesas
          </p>
        </div>

        {/* Legenda de Cores */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.74rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#22C55E' }} />
            <span style={{ color: '#CBD5E1', fontWeight: 600 }}>Receitas</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#FB7185' }} />
            <span style={{ color: '#CBD5E1', fontWeight: 600 }}>Despesas</span>
          </div>
        </div>
      </div>

      {/* Popover / Destaque do Mês Ativo */}
      {selectedMonth && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            padding: '12px 14px',
            borderRadius: '16px',
            backgroundColor: '#161F18',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Linha Superior: Mês Selecionado & Sobra Líquida */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  fontFamily: "'Outfit', sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedMonth.fullLabel}
              </span>
              {selectedMonth.isCurrentMonth && (
                <span
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    color: '#4ADE80',
                    border: '1px solid rgba(74, 222, 128, 0.25)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Atual
                </span>
              )}
            </div>

            {/* Resultado da Sobra (sem pílula pesada para evitar qualquer colisão) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.84rem',
                fontWeight: 800,
                color: selectedMonth.isSurplus ? '#4ADE80' : '#FB7185',
                fontFamily: "'Outfit', sans-serif",
                flexShrink: 0,
              }}
            >
              {selectedMonth.isSurplus ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>Sobra:</span>
              <span style={{ whiteSpace: 'nowrap' }}>
                {selectedMonth.isSurplus ? '+' : ''}{formatBrlCurrency(selectedMonth.net)}
              </span>
            </div>
          </div>

          {/* Linha Inferior: 2 Colunas com Rótulos Empilhados */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            {/* Coluna de Receitas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
                <span style={{ fontSize: '0.66rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Receitas
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  color: '#4ADE80',
                  fontFamily: "'Outfit', sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                +{formatBrlCurrency(selectedMonth.income)}
              </span>
            </div>

            {/* Coluna de Despesas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '0.66rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Despesas
                </span>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FB7185' }} />
              </div>
              <span
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  color: '#FB7185',
                  fontFamily: "'Outfit', sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                -{formatBrlCurrency(selectedMonth.expense)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de Barras Duplas com Alturas Perfeitamente Enquadradas */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          height: '140px',
          paddingTop: '8px',
          gap: '4px',
        }}
      >
        {data.map((item, idx) => {
          const isSelected = hoveredIdx !== null ? hoveredIdx === idx : (item.isCurrentMonth || idx === data.length - 1);
          // Altura ampliada agora que o checkmark foi removido, aproveitando o espaço para as barras
          const incomeHeight = maxVal > 0 ? (item.income / maxVal) * 98 : 0;
          const expenseHeight = maxVal > 0 ? (item.expense / maxVal) * 98 : 0;

          return (
            <div
              key={`${item.year}-${item.month}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => setHoveredIdx(idx)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                cursor: 'pointer',
                borderRadius: '12px',
                padding: '10px 2px 8px',
                backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                border: isSelected ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Barras Lado a Lado */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '100%', justifyContent: 'center' }}>
                {/* Barra de Receita */}
                <div
                  title={`Receita: ${formatBrlCurrency(item.income)}`}
                  style={{
                    width: '11px',
                    height: `${Math.max(incomeHeight, 4)}px`,
                    background: 'linear-gradient(180deg, #4ADE80 0%, #16A34A 100%)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'all 0.2s ease',
                    opacity: isSelected ? 1 : 0.65,
                  }}
                />

                {/* Barra de Despesa */}
                <div
                  title={`Despesa: ${formatBrlCurrency(item.expense)}`}
                  style={{
                    width: '11px',
                    height: `${Math.max(expenseHeight, 4)}px`,
                    background: 'linear-gradient(180deg, #FB7185 0%, #E11D48 100%)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'all 0.2s ease',
                    opacity: isSelected ? 1 : 0.65,
                  }}
                />
              </div>

              {/* Rótulo do Mês com Linha Base e Altura Idênticas para Todos os 6 Meses */}
              <div
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: isSelected ? '#4ADE80' : '#94A3B8',
                    fontWeight: isSelected ? 800 : 600,
                    lineHeight: 1,
                  }}
                >
                  {item.label}
                </span>
                <div
                  style={{
                    width: '14px',
                    height: '2px',
                    borderRadius: '1px',
                    backgroundColor: item.isCurrentMonth ? '#22C55E' : 'transparent',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
