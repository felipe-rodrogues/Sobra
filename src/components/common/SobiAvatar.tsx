import React from 'react';

export type SobiExpression = 'normal' | 'feliz' | 'pensativo' | 'surpreso' | 'confiante' | 'animado' | 'main';

interface SobiAvatarProps {
  expression?: SobiExpression;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  showBorder?: boolean;
}

const SOBI_IMAGE_MAP: Record<SobiExpression, string> = {
  normal: '/assets/sobi/sobi-expr-normal.png',
  feliz: '/assets/sobi/sobi-expr-feliz.png',
  pensativo: '/assets/sobi/sobi-expr-pensativo.png',
  surpreso: '/assets/sobi/sobi-expr-surpreso.png',
  confiante: '/assets/sobi/sobi-expr-confiante.png',
  animado: '/assets/sobi/sobi-expr-animado.png',
  main: '/assets/sobi/sobi-avatar.png',
};

export const SobiAvatar: React.FC<SobiAvatarProps> = ({
  expression = 'normal',
  size = 42,
  className = '',
  style = {},
  showBorder = true,
}) => {
  const imageSrc = SOBI_IMAGE_MAP[expression] || SOBI_IMAGE_MAP.normal;

  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: size > 40 ? '14px' : '11px',
        backgroundColor: '#111714',
        border: showBorder ? '1px solid rgba(74, 222, 128, 0.15)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        padding: size >= 36 ? '2px' : '1px',
        boxShadow: showBorder ? '0 2px 8px rgba(0, 0, 0, 0.35)' : 'none',
        ...style,
      }}
      title={`Sobi (${expression})`}
    >
      <img
        src={imageSrc}
        alt={`Sobi - ${expression}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          userSelect: 'none',
        }}
        onError={(e) => {
          // Fallback seguro caso imagem falhe
          (e.currentTarget as HTMLElement).style.display = 'none';
        }}
      />
    </div>
  );
};
