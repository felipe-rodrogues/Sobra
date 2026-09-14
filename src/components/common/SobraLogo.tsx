import React, { useState } from 'react';

export interface SobraLogoProps {
  /** Tamanho do ícone em pixels (padrão 36) */
  size?: number;
  /** Variante: apenas o ícone de folha, horizontal com o nome, ou vertical */
  variant?: 'icon' | 'horizontal' | 'vertical' | 'badge';
  /** Exibir o subtítulo "MAIS DO SEU AMANHÃ" */
  showSubtitle?: boolean;
  /** Modo de cor: dark (padrão do app) ou light */
  theme?: 'dark' | 'light';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * SobraLogo - Identidade Visual Oficial do Sobra
 * 
 * Símbolo composto pelas duas folhas curvas orgânicas em verde vibrante
 * que se entrelaçam formando a letra 'S' dentro do squircle obsidian mate,
 * idêntico ao design original da marca.
 */
export const SobraLogo: React.FC<SobraLogoProps> = ({
  size = 36,
  variant = 'horizontal',
  showSubtitle = true,
  theme = 'dark',
  className = '',
  style = {},
}) => {
  const isLight = theme === 'light';
  const textColor = isLight ? '#0F172A' : '#FFFFFF';
  const subtitleColor = isLight ? '#64748B' : '#94A3B8';
  const [useSvgFallback, setUseSvgFallback] = useState(false);

  // Renderiza o ícone autêntico do Sobra
  const renderLeafIcon = (iconSize: number) => {
    const borderRadius = Math.round(iconSize * 0.28);

    if (useSvgFallback) {
      // Vetor SVG fiel ao formato orgânico das folhas em S
      return (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            borderRadius: `${borderRadius}px`,
            flexShrink: 0,
            display: 'block',
            boxShadow: isLight
              ? '0 3px 10px rgba(0, 0, 0, 0.08)'
              : '0 4px 16px rgba(0, 0, 0, 0.45)',
          }}
        >
          <defs>
            <linearGradient id="sobraLeafGradTop" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#86EFAC" />
              <stop offset="100%" stopColor="#4ADE80" />
            </linearGradient>
            <linearGradient id="sobraLeafGradBot" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4ADE80" />
              <stop offset="100%" stopColor="#22C55E" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" rx="28" fill="#0E1410" />
          {/* Folha Superior curvada */}
          <path
            d="M 27.2 44.5 C 26.5 49.5, 28.5 53.2, 32.5 53.2 C 41.5 48.5, 53.5 38.5, 71.5 21.2 C 72.2 20.6, 71.2 20.4, 69.5 20.4 C 52 20.4, 31.5 25.5, 27.2 44.5 Z"
            fill="url(#sobraLeafGradTop)"
          />
          {/* Folha Inferior (rotação simétrica de 180 graus) */}
          <g transform="rotate(180 49.35 50)">
            <path
              d="M 27.2 44.5 C 26.5 49.5, 28.5 53.2, 32.5 53.2 C 41.5 48.5, 53.5 38.5, 71.5 21.2 C 72.2 20.6, 71.2 20.4, 69.5 20.4 C 52 20.4, 31.5 25.5, 27.2 44.5 Z"
              fill="url(#sobraLeafGradBot)"
            />
          </g>
        </svg>
      );
    }

    return (
      <div
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          borderRadius: `${borderRadius}px`,
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0E1410',
          boxShadow: isLight
            ? '0 3px 10px rgba(0, 0, 0, 0.08)'
            : '0 4px 16px rgba(0, 0, 0, 0.45)',
        }}
      >
        <img
          src="/assets/sobra_icon.png"
          alt="Sobra Logo"
          width={iconSize}
          height={iconSize}
          onError={() => setUseSvgFallback(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>
    );
  };

  if (variant === 'icon') {
    return (
      <div className={className} style={{ display: 'inline-flex', alignItems: 'center', ...style }}>
        {renderLeafIcon(size)}
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${Math.round(size * 0.28)}px`,
          backgroundColor: isLight ? '#F1F5F9' : '#141C16',
          padding: '6px 14px',
          borderRadius: '9999px',
          border: `1px solid ${isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.08)'}`,
          ...style,
        }}
      >
        {renderLeafIcon(Math.round(size * 0.68))}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
              fontSize: `${Math.round(size * 0.48)}px`,
              fontWeight: 800,
              color: textColor,
              letterSpacing: '-0.035em',
              lineHeight: 1.1,
            }}
          >
            Sobra
          </span>
          {showSubtitle && (
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: `${Math.max(7.5, Math.round(size * 0.16))}px`,
                fontWeight: 600,
                color: subtitleColor,
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
              }}
            >
              Mais do seu amanhã
            </span>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'vertical') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: `${Math.max(6, Math.round(size * 0.18))}px`,
          ...style,
        }}
      >
        {renderLeafIcon(size)}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
              fontSize: `${Math.round(size * 0.58)}px`,
              fontWeight: 800,
              color: textColor,
              letterSpacing: '-0.035em',
              lineHeight: 1.1,
            }}
          >
            Sobra
          </div>
          {showSubtitle && (
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: `${Math.max(8, Math.round(size * 0.19))}px`,
                fontWeight: 600,
                color: subtitleColor,
                letterSpacing: '0.34em',
                textTransform: 'uppercase',
                marginTop: '4px',
                paddingLeft: '0.34em', // compensa visualmente o tracking para centralização perfeita
              }}
            >
              Mais do seu amanhã
            </div>
          )}
        </div>
      </div>
    );
  }

  // Padrão: 'horizontal'
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.round(size * 0.28)}px`,
        ...style,
      }}
    >
      {renderLeafIcon(size)}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
            fontSize: `${Math.round(size * 0.58)}px`,
            fontWeight: 800,
            color: textColor,
            letterSpacing: '-0.035em',
            lineHeight: 1.05,
          }}
        >
          Sobra
        </span>
        {showSubtitle && (
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: `${Math.max(7.5, Math.round(size * 0.18))}px`,
              fontWeight: 600,
              color: subtitleColor,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              marginTop: '2px',
            }}
          >
            Mais do seu amanhã
          </span>
        )}
      </div>
    </div>
  );
};
