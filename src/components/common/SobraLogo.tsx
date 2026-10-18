import React, { useState } from 'react';
import { SOBRA_LEAF_POINTS } from './sobraIconPoints';

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
            flexShrink: 0,
            display: 'block',
            filter: isLight
              ? 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.12))'
              : 'drop-shadow(0 3px 12px rgba(74, 222, 128, 0.28))',
          }}
        >
          <defs>
            <linearGradient id="sobraLeafGradTop" x1="15%" y1="0%" x2="95%" y2="95%">
              <stop offset="0%" stopColor="#86EFAC" />
              <stop offset="30%" stopColor="#4ADE80" />
              <stop offset="75%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#15803D" />
            </linearGradient>
            <linearGradient id="sobraLeafGradBot" x1="85%" y1="5%" x2="15%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="40%" stopColor="#22C55E" />
              <stop offset="78%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
          </defs>
          <g transform="translate(50, 50) scale(1.08) translate(-50, -50)">
            <polygon points={SOBRA_LEAF_POINTS} fill="url(#sobraLeafGradTop)" />
            <g transform="rotate(180 50 50)">
              <polygon points={SOBRA_LEAF_POINTS} fill="url(#sobraLeafGradBot)" />
            </g>
          </g>
        </svg>
      );
    }

    return (
      <div
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
          filter: isLight
            ? 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.12))'
            : 'drop-shadow(0 3px 12px rgba(74, 222, 128, 0.28))',
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
            objectFit: 'contain',
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
          border: 'none',
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
