import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  color: string;
  amount: number;
  percentage: number;
}

interface MonthOverviewCardProps {
  selectedMonth: number;
  selectedYear: number;
  onSelectMonth: (month: number) => void;
  totalExpense: number;
  categories: CategoryBreakdownItem[];
  maskValue: (v: string) => string;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Paleta oficial fiel ao Mockup de referência (Visão do mês)
export const MOCKUP_PALETTE: Record<string, { name: string; color: string }> = {
  'cat-moradia': { name: 'Moradia', color: '#78BC71' },        // Verde suave do mockup
  'cat-alim': { name: 'Alimentação', color: '#E79F52' },       // Laranja quente do mockup
  'cat-transp': { name: 'Transporte', color: '#5F72CE' },      // Azul/Índigo periwinkle do mockup
  'cat-lazer': { name: 'Lazer', color: '#AA84E1' },            // Lavanda/Roxo do mockup
  'cat-outros-desp': { name: 'Outros', color: '#9EA3A9' },     // Cinza/Slate do mockup
  'cat-compras': { name: 'Compras', color: '#F97316' },
  'cat-saude': { name: 'Saúde', color: '#EF4444' },
  'cat-educ': { name: 'Educação', color: '#EC4899' },
};

export const MOCKUP_FALLBACK_COLORS = [
  '#78BC71', '#E79F52', '#5F72CE', '#AA84E1', '#9EA3A9', '#F97316', '#EF4444', '#EC4899'
];

/**
 * Normaliza o nome para a versão limpa/curta do mockup e assegura as cores oficiais.
 */
export function resolveCategoryVisual(
  cat: { categoryId: string; categoryName: string; color?: string },
  fallbackIndex = 0
) {
  // 1. Correspondência exata por ID da categoria
  if (MOCKUP_PALETTE[cat.categoryId]) {
    return MOCKUP_PALETTE[cat.categoryId];
  }

  // 2. Correspondência por palavras-chave
  const lower = cat.categoryName.toLowerCase();
  if (lower.includes('morad')) return { name: 'Moradia', color: '#78BC71' };
  if (lower.includes('alimen')) return { name: 'Alimentação', color: '#E79F52' };
  if (lower.includes('transp')) return { name: 'Transporte', color: '#5F72CE' };
  if (lower.includes('lazer') || lower.includes('entreten')) return { name: 'Lazer', color: '#AA84E1' };
  if (lower.includes('outro')) return { name: 'Outros', color: '#9EA3A9' };
  if (lower.includes('compr') || lower.includes('vestu')) return { name: 'Compras', color: '#F97316' };
  if (lower.includes('saud') || lower.includes('saúde')) return { name: 'Saúde', color: '#EF4444' };
  if (lower.includes('educa')) return { name: 'Educação', color: '#EC4899' };

  // 3. Encurtamento de nomes compostos para não truncar na legenda
  const shortName = cat.categoryName.split('&')[0].split('-')[0].trim();
  return {
    name: shortName || cat.categoryName,
    color: cat.color || MOCKUP_FALLBACK_COLORS[fallbackIndex % MOCKUP_FALLBACK_COLORS.length],
  };
}

export const MonthOverviewCard: React.FC<MonthOverviewCardProps> = ({
  selectedMonth,
  selectedYear,
  onSelectMonth,
  totalExpense,
  categories,
  maskValue,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hoveredCatId, setHoveredCatId] = useState<string | null>(null);

  // Processar categorias: nomes limpos, cores do mockup e até 5 categorias (top 4 + Outros)
  const processedCategories = React.useMemo(() => {
    if (categories.length === 0) return [];

    let list: CategoryBreakdownItem[] = [];

    if (categories.length <= 5) {
      list = categories.map((c, i) => {
        const visual = resolveCategoryVisual(c, i);
        return {
          ...c,
          categoryName: visual.name,
          color: visual.color,
        };
      });
    } else {
      const sorted = [...categories].sort((a, b) => b.amount - a.amount);
      const top4 = sorted.slice(0, 4);
      const others = sorted.slice(4);
      const othersAmount = others.reduce((acc, c) => acc + c.amount, 0);
      const othersPercentage = totalExpense > 0 ? (othersAmount / totalExpense) * 100 : 0;

      list = top4.map((c, i) => {
        const visual = resolveCategoryVisual(c, i);
        return {
          ...c,
          categoryName: visual.name,
          color: visual.color,
        };
      });

      if (othersAmount > 0) {
        list.push({
          categoryId: 'others',
          categoryName: 'Outros',
          color: '#9EA3A9',
          amount: othersAmount,
          percentage: othersPercentage,
        });
      }
    }

    // Ordenar por valor decrescente mantendo 'Outros' no fim
    const nonOthers = list.filter(c => c.categoryId !== 'others' && c.categoryName !== 'Outros');
    const othersItem = list.find(c => c.categoryId === 'others' || c.categoryName === 'Outros');
    nonOthers.sort((a, b) => b.amount - a.amount);

    return othersItem ? [...nonOthers, othersItem] : nonOthers;
  }, [categories, totalExpense]);

  // Parâmetros geométricos do Donut SVG - anel ampliado e alinhado perfeitamente à esquerda
  const size = 130;
  const center = size / 2;
  const radius = 54;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius; // ~339.29
  const gapLength = processedCategories.length > 1 ? 4.0 : 0; // Espaçamento elegante entre fatias

  let cumulativeOffset = 0;
  const activeCategory = processedCategories.find(c => c.categoryId === hoveredCatId);

  const displayValue = activeCategory
    ? maskValue(formatBrlCurrency(activeCategory.amount))
    : maskValue(formatBrlCurrency(totalExpense));

  // Escala dinâmica de tipografia para garantir 100% de legibilidade sem corte
  const getValueFontSize = (val: string) => {
    const len = val.length;
    if (len >= 16) return '0.64rem';
    if (len >= 14) return '0.70rem';
    if (len >= 12) return '0.76rem';
    if (len >= 10) return '0.82rem';
    return '0.88rem';
  };

  return (
    <div
      className="card-sobra"
      style={{
        padding: '16px 18px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {/* Header: "Visão do mês" + Seletor de Mês */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <h3
          style={{
            fontSize: '1.05rem',
            fontWeight: 800,
            color: '#FFFFFF',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Visão do mês
        </h3>

        {/* Dropdown de Mês */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(prev => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '9999px',
              backgroundColor: '#161F18',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <span>{MONTH_NAMES[selectedMonth - 1]}</span>
            <ChevronDown size={13} color="#94A3B8" />
          </button>

          {isDropdownOpen && (
            <>
              {/* Backdrop invisível para fechar */}
              <div
                onClick={() => setIsDropdownOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  width: '140px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  backgroundColor: '#161F18',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7)',
                  zIndex: 100,
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {MONTH_NAMES.map((name, index) => {
                  const m = index + 1;
                  const isSelected = m === selectedMonth;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        onSelectMonth(m);
                        setIsDropdownOpen(false);
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: isSelected ? 700 : 500,
                        backgroundColor: isSelected ? '#22C55E' : 'transparent',
                        color: isSelected ? '#000000' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s',
                      }}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Conteúdo: Donut Chart à Esquerda e Lista de Categorias à Direita */}
      {processedCategories.length === 0 || totalExpense === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '26px 10px',
            color: '#94A3B8',
            fontSize: '0.84rem',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '16px',
            border: '1px dashed rgba(255, 255, 255, 0.06)',
          }}
        >
          Nenhum gasto registrado em {MONTH_NAMES[selectedMonth - 1]}.
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          {/* Lado Esquerdo: Donut SVG com Centro Informativo e Espaçamento entre Fatias */}
          <div
            style={{
              position: 'relative',
              width: `${size}px`,
              height: `${size}px`,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '-5px',
            }}
          >
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
            >
              {processedCategories.map((cat, index) => {
                const isHovered = hoveredCatId === cat.categoryId;
                const isOtherHovered = hoveredCatId !== null && !isHovered;

                const fraction = totalExpense > 0 
                  ? cat.amount / totalExpense 
                  : (1 / processedCategories.length);
                const segLength = fraction * circumference;
                const arcLength = Math.max(1, segLength - gapLength);
                const strokeDasharray = `${arcLength} ${circumference}`;
                const strokeDashoffset = -(cumulativeOffset + gapLength / 2);

                cumulativeOffset += segLength;

                return (
                  <circle
                    key={cat.categoryId || index}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke={cat.color}
                    strokeWidth={isHovered ? strokeWidth + 2.5 : strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="butt"
                    opacity={isOtherHovered ? 0.35 : 1}
                    onMouseEnter={() => setHoveredCatId(cat.categoryId)}
                    onMouseLeave={() => setHoveredCatId(null)}
                    style={{
                      cursor: 'pointer',
                      transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                    }}
                  />
                );
              })}
            </svg>

            {/* Centro do Donut: Valor Total / Categoria e "gastos" */}
            <div
              style={{
                position: 'absolute',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                width: '94px',
                padding: '0 2px',
              }}
            >
              <span
                style={{
                  fontSize: getValueFontSize(displayValue),
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  whiteSpace: 'nowrap',
                }}
              >
                {displayValue}
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  color: '#94A3B8',
                  marginTop: '1px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                {activeCategory ? activeCategory.categoryName : 'gastos'}
              </span>
            </div>
          </div>

          {/* Lado Direito: Lista de Categorias com Ponto Colorido e Percentual Inteiro */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: processedCategories.length > 4 ? '7px' : '9px',
              flex: 1,
              minWidth: 0,
            }}
          >
            {processedCategories.map((cat) => {
              const isHovered = hoveredCatId === cat.categoryId;
              const displayPct = Math.round(
                totalExpense > 0 ? (cat.amount / totalExpense) * 100 : cat.percentage
              );

              return (
                <div
                  key={cat.categoryId}
                  onMouseEnter={() => setHoveredCatId(cat.categoryId)}
                  onMouseLeave={() => setHoveredCatId(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    cursor: 'pointer',
                    opacity: hoveredCatId !== null && !isHovered ? 0.4 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  {/* Ponto colorido + Nome da categoria limpo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        width: '7.5px',
                        height: '7.5px',
                        borderRadius: '50%',
                        backgroundColor: cat.color,
                        flexShrink: 0,
                        boxShadow: isHovered ? `0 0 8px ${cat.color}` : 'none',
                        transition: 'box-shadow 0.2s ease',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: isHovered ? 600 : 500,
                        color: isHovered ? '#FFFFFF' : '#CBD5E1',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={cat.categoryName}
                    >
                      {cat.categoryName}
                    </span>
                  </div>

                  {/* Percentual em número inteiro (ex: 42%, 20%) alinhado à direita */}
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: isHovered ? '#FFFFFF' : '#94A3B8',
                      flexShrink: 0,
                      marginLeft: '8px',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {`${displayPct}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
