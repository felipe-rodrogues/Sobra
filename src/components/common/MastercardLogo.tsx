import React from 'react';

interface CardBrandLogoProps {
  brand?: 'mastercard' | 'visa' | 'elo' | 'amex' | 'other' | string;
  size?: number; // height in px
  showText?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const CardBrandLogo: React.FC<CardBrandLogoProps> = ({
  brand = 'mastercard',
  size = 14,
  showText = true,
  className = '',
  style = {},
}) => {
  const norm = (brand || 'mastercard').toLowerCase();

  if (norm.includes('visa')) {
    return (
      <div
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          ...style,
        }}
      >
        <span
          style={{
            color: '#1A1F71',
            backgroundColor: '#FFFFFF',
            padding: '1px 5px',
            borderRadius: '4px',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 900,
            fontSize: `${size}px`,
            fontStyle: 'italic',
            letterSpacing: '0.04em',
            lineHeight: 1,
          }}
        >
          VISA
        </span>
      </div>
    );
  }

  if (norm.includes('elo')) {
    return (
      <div
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          ...style,
        }}
      >
        <span
          style={{
            color: '#00A4E8',
            fontWeight: 800,
            fontSize: `${size}px`,
            letterSpacing: '-0.02em',
          }}
        >
          elo
        </span>
      </div>
    );
  }

  // Padrão: MasterCard (Esferas icônicas sobrepostas Vermelho e Laranja)
  const circleRadius = size * 0.45;
  const svgWidth = circleRadius * 2 * 1.55;
  const svgHeight = circleRadius * 2;

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        ...style,
      }}
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        fill="none"
        style={{ overflow: 'visible', flexShrink: 0 }}
      >
        {/* Círculo Esquerdo - Vermelho MasterCard */}
        <circle cx={circleRadius} cy={circleRadius} r={circleRadius} fill="#EB001B" />
        {/* Círculo Direito - Amarelo/Laranja MasterCard */}
        <circle cx={svgWidth - circleRadius} cy={circleRadius} r={circleRadius} fill="#F79E1B" fillOpacity="0.9" />
        {/* Intersecção suave */}
        <path
          d={`M ${svgWidth / 2} ${circleRadius * 0.22} A ${circleRadius} ${circleRadius} 0 0 1 ${svgWidth / 2} ${circleRadius * 1.78} A ${circleRadius} ${circleRadius} 0 0 1 ${svgWidth / 2} ${circleRadius * 0.22}`}
          fill="#FF5F00"
          fillOpacity="0.8"
        />
      </svg>

      {showText && (
        <span
          style={{
            fontSize: `${Math.max(10, Math.round(size * 0.85))}px`,
            fontWeight: 600,
            color: '#94A3B8',
            letterSpacing: '0.01em',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          MasterCard
        </span>
      )}
    </div>
  );
};
