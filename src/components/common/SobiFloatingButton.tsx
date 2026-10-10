import React, { useState } from 'react';

interface SobiFloatingButtonProps {
  onClick: () => void;
  visible?: boolean;
}

export const SobiFloatingButton: React.FC<SobiFloatingButtonProps> = ({
  onClick,
  visible = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        // Reposicionado mais para cima para respirar livremente acima da barra inferior
        bottom: 'calc(var(--safe-area-bottom, 0px) + 98px)',
        // Centraliza relativo ao container de 460px em telas largas, ou fixa 16px da borda no mobile
        right: 'max(16px, calc(50% - 230px + 16px))',
        zIndex: 2995,
        pointerEvents: 'auto',
      }}
    >
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsPressed(false);
        }}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onTouchStart={() => setIsPressed(true)}
        onTouchEnd={() => setIsPressed(false)}
        aria-label="Abrir Sobi AI"
        title="Conversar com o Sobi (Assistente de IA)"
        style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          // Disco escuro natural com iluminação esmeralda ambiente no canto superior direito estilo PicPay
          background: isHovered
            ? 'radial-gradient(circle at 72% 28%, #1F3F2D 0%, #121915 60%, #0A0F0C 100%)'
            : 'radial-gradient(circle at 72% 28%, #1A3626 0%, #111713 58%, #090E0B 100%)',
          border: isHovered
            ? '1px solid rgba(74, 222, 128, 0.45)'
            : '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: isHovered
            ? '0 10px 28px rgba(0, 0, 0, 0.6), 0 0 18px rgba(34, 197, 94, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.2)'
            : '0 6px 20px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.12)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          outline: 'none',
          transform: isPressed
            ? 'scale(0.94)'
            : isHovered
            ? 'scale(1.06) translateY(-2px)'
            : 'scale(1)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Símbolo de IA (estrela de 4 pontas estilo PicPay/Gemini) em cima do Sobi dentro do círculo */}
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '6px',
            right: '11px',
            zIndex: 2,
            pointerEvents: 'none',
            filter: 'drop-shadow(0 0 4px rgba(74, 222, 128, 0.8)) drop-shadow(0 0 1px rgba(255, 255, 255, 0.9))',
            transform: isHovered ? 'scale(1.15) rotate(8deg)' : 'scale(1)',
            transition: 'transform 0.2s ease',
          }}
        >
          <path
            d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z"
            fill="#FFFFFF"
          />
        </svg>

        {/* Mascote Sobi limpo sobre fundo transparente, flutuando organicamente no círculo */}
        <img
          src="/assets/sobi/sobi-head-clean.png"
          alt="Sobi AI"
          style={{
            width: '33px',
            height: '33px',
            objectFit: 'contain',
            display: 'block',
            marginTop: '3px',
            pointerEvents: 'none',
            userSelect: 'none',
            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45))',
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: isHovered ? 'scale(1.05)' : 'scale(1)',
          }}
          onError={(e) => {
            // Fallback para a imagem padrão se a versão recortada falhar
            (e.currentTarget as HTMLImageElement).src = '/assets/sobi/sobi-expr-normal.png';
          }}
        />
      </button>
    </div>
  );
};
