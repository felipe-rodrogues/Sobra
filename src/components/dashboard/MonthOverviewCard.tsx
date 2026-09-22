import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
  onOpenDetails?: () => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Paleta oficial fiel ao Mockup de referência (Visão do mês)
export const MOCKUP_PALETTE: Record<string, { name: string; color: string }> = {
  'cat-moradia': { name: 'Moradia', color: '#78BC71' },        // Verde suave
  'cat-alim': { name: 'Alimentação', color: '#E79F52' },       // Laranja quente
  'cat-transp': { name: 'Transporte', color: '#5F72CE' },      // Azul/Índigo periwinkle
  'cat-lazer': { name: 'Lazer', color: '#AA84E1' },            // Lavanda/Roxo
  'cat-outros-desp': { name: 'Outros', color: '#9EA3A9' },     // Cinza/Slate
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
  if (MOCKUP_PALETTE[cat.categoryId]) {
    return MOCKUP_PALETTE[cat.categoryId];
  }

  const lower = cat.categoryName.toLowerCase();
  if (lower.includes('morad')) return { name: 'Moradia', color: '#78BC71' };
  if (lower.includes('alimen')) return { name: 'Alimentação', color: '#E79F52' };
  if (lower.includes('transp')) return { name: 'Transporte', color: '#5F72CE' };
  if (lower.includes('lazer') || lower.includes('entreten')) return { name: 'Lazer', color: '#AA84E1' };
  if (lower.includes('outro')) return { name: 'Outros', color: '#9EA3A9' };
  if (lower.includes('compr') || lower.includes('vestu')) return { name: 'Compras', color: '#F97316' };
  if (lower.includes('saud') || lower.includes('saúde')) return { name: 'Saúde', color: '#EF4444' };
  if (lower.includes('educa')) return { name: 'Educação', color: '#EC4899' };

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
  onOpenDetails,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [hoveredCatId, setHoveredCatId] = useState<string | null>(null);

  // A categoria ativa prioriza o hover temporário ou o clique fixo
  const activeCatId = hoveredCatId || selectedCatId;

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

  // Parâmetros geométricos do Donut SVG (versão ampliada com proporção imersiva)
  const size = 226;
  const center = size / 2;
  const radius = 90;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius; // ~565.49
  const gapLength = processedCategories.length > 1 ? 6.0 : 0;

  let cumulativeOffset = 0;
  const activeCategory = processedCategories.find(c => c.categoryId === activeCatId);

  const displayValue = activeCategory
    ? maskValue(formatBrlCurrency(activeCategory.amount))
    : maskValue(formatBrlCurrency(totalExpense));

  const getValueFontSize = (val: string) => {
    const len = val.length;
    if (len >= 16) return '1.05rem';
    if (len >= 14) return '1.18rem';
    if (len >= 12) return '1.32rem';
    if (len >= 10) return '1.50rem';
    return '1.70rem';
  };

  const handleToggleCategory = (catId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCatId(prev => (prev === catId ? null : catId));
    setHoveredCatId(null);
  };

  return (
    <div
      className="card-sobra"
      style={{
        padding: '14px 18px 16px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: 'linear-gradient(150deg, #131915 0%, #0d120f 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderTop: '1px solid rgba(255, 255, 255, 0.13)',
        overflow: 'visible',
      }}
    >
      {/* Background layer para o glow que preserva border-radius e não corta o dropdown */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '24px',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '140px',
            height: '140px',
            borderRadius: '50%',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            filter: 'blur(42px)',
          }}
        />
      </div>

      {/* Header: "Visão do mês" com seta > + Seletor de Mês */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <div
          onClick={onOpenDetails}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: onOpenDetails ? 'pointer' : 'default',
          }}
        >
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

          {onOpenDetails && (
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94A3B8',
              }}
            >
              <ChevronRight size={15} />
            </div>
          )}
        </div>

        {/* Dropdown de Mês */}
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
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
              <div
                onClick={() => setIsDropdownOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 999 }}
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
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: '16px',
                  boxShadow: '0 16px 36px rgba(0, 0, 0, 0.85)',
                  zIndex: 1000,
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
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 0',
            position: 'relative',
          }}
        >
          {/* Donut SVG Centralizado e Ampliado */}
          <div
            style={{
              position: 'relative',
              width: `${size}px`,
              height: `${size}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
            >
              {processedCategories.map((cat, index) => {
                const isSelected = activeCatId === cat.categoryId;
                const isOtherSelected = activeCatId !== null && !isSelected;

                const fraction = totalExpense > 0 
                  ? cat.amount / totalExpense 
                  : (1 / processedCategories.length);
                const segLength = fraction * circumference;
                const arcLength = Math.max(1, segLength - gapLength);
                const strokeDasharray = `${arcLength} ${circumference}`;
                const strokeDashoffset = -(cumulativeOffset + gapLength / 2);
                const displayPct = Math.round(
                  totalExpense > 0 ? (cat.amount / totalExpense) * 100 : cat.percentage
                );

                cumulativeOffset += segLength;

                return (
                  <circle
                    key={cat.categoryId || index}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={cat.color}
                    strokeWidth={isSelected ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="butt"
                    opacity={isOtherSelected ? 0.25 : 1}
                    onClick={e => handleToggleCategory(cat.categoryId, e)}
                    onMouseEnter={() => {
                      if (typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
                        setHoveredCatId(cat.categoryId);
                      }
                    }}
                    onMouseLeave={() => {
                      if (typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
                        setHoveredCatId(null);
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      pointerEvents: 'stroke',
                      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      filter: isSelected ? `drop-shadow(0 0 10px ${cat.color})` : 'none',
                    }}
                    aria-label={`${cat.categoryName} ${displayPct}%`}
                    data-category={cat.categoryName}
                    data-percentage={`${displayPct}%`}
                  >
                    <title>{`${cat.categoryName}: ${displayPct}% (${maskValue(formatBrlCurrency(cat.amount))})`}</title>
                  </circle>
                );
              })}
            </svg>

            {/* Centro do Donut: Exibe Valor Total ou Categoria Ativa com Percentual */}
            <div
              onClick={e => {
                e.stopPropagation();
                setSelectedCatId(null);
                setHoveredCatId(null);
              }}
              style={{
                position: 'absolute',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '154px',
                height: '154px',
                borderRadius: '50%',
                cursor: 'pointer',
                padding: '0 6px',
                userSelect: 'none',
              }}
              title={activeCategory ? "Toque para voltar ao total do mês" : "Toque em uma fatia para filtrar"}
            >
              <span
                style={{
                  fontSize: getValueFontSize(displayValue),
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.12,
                  whiteSpace: 'nowrap',
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                }}
              >
                {displayValue}
              </span>

              {activeCategory ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginTop: '5px',
                    maxWidth: '130px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: activeCategory.color,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                      transition: 'color 0.2s ease',
                    }}
                  >
                    {activeCategory.categoryName}
                  </span>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      color: '#94A3B8',
                      lineHeight: 1.1,
                      marginTop: '2px',
                    }}
                  >
                    {Math.round(totalExpense > 0 ? (activeCategory.amount / totalExpense) * 100 : activeCategory.percentage)}%
                  </span>
                </div>
              ) : (
                <span
                  style={{
                    fontSize: '0.82rem',
                    color: '#94A3B8',
                    marginTop: '5px',
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                  }}
                >
                  gastos
                </span>
              )}
            </div>
          </div>

          {/* Microcópia sutil de affordance e instrução */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: '6px',
              fontSize: '0.70rem',
              color: '#64748B',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              userSelect: 'none',
            }}
          >
            <span>
              {activeCategory ? 'Toque no centro para voltar ao total' : 'Toque nas cores para mais detalhes'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
