import React from 'react';
import { BankLogo } from '../common/BankLogo';
import { IconRenderer } from '../common/IconRenderer';
import { Category } from '../../core/types';
import { GraduationCap, Heart, Music, Film, Tv, Sparkles } from 'lucide-react';

interface SubscriptionLogoProps {
  name: string;
  category?: Category | null;
  bankId?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const SubscriptionLogo: React.FC<SubscriptionLogoProps> = ({
  name,
  category,
  bankId,
  size = 44,
  className = '',
  style = {},
}) => {
  const normName = (name || '').toLowerCase().trim();

  // Dimensões proporcionais
  const badgeSize = Math.max(14, Math.round(size * 0.38));
  const iconSize = Math.round(size * 0.52);

  // Renderizador específico de logos conhecidos (compatível com os prints do usuário)
  const renderBrandContent = () => {
    // 1. UVA / Universidade / Faculdade
    if (normName.includes('uva') || normName.includes('veiga') || normName.includes('faculdade') || normName.includes('universidade')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38BDF8',
          }}
        >
          <GraduationCap size={iconSize} />
        </div>
      );
    }

    // 2. Life Fit / Academia / Gym
    if (normName.includes('life fit') || normName.includes('lifefit') || normName.includes('smart fit') || normName.includes('bluefit') || normName.includes('academia')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2DD4BF',
          }}
        >
          <Heart size={iconSize} />
        </div>
      );
    }

    // 3. Claro
    if (normName.includes('claro')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              color: '#DA291C',
              fontWeight: 900,
              fontSize: `${Math.round(size * 0.28)}px`,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              letterSpacing: '-0.03em',
            }}
          >
            Claro'
          </span>
        </div>
      );
    }

    // 4. Steam
    if (normName.includes('steam')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#171A21',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.005.105.005.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.724L.437 14.77C1.867 20.076 6.48 24 12 24c6.627 0 12-5.373 12-12S18.605 0 11.979 0z" />
          </svg>
        </div>
      );
    }

    // 5. Spotify
    if (normName.includes('spotify')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#1DB954',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Music size={iconSize} color="#FFFFFF" />
        </div>
      );
    }

    // 6. Netflix
    if (normName.includes('netflix')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              color: '#E50914',
              fontWeight: 900,
              fontSize: `${Math.round(size * 0.45)}px`,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            N
          </span>
        </div>
      );
    }

    // 7. Amazon Prime
    if (normName.includes('amazon') || normName.includes('prime')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#00A8E1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
          }}
        >
          <Film size={iconSize} />
        </div>
      );
    }

    // 8. YouTube
    if (normName.includes('youtube')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#FF0000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
          }}
        >
          <Tv size={iconSize} />
        </div>
      );
    }

    // 9. Apple / iCloud
    if (normName.includes('apple') || normName.includes('icloud')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#27272A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
          }}
        >
          <Sparkles size={iconSize} />
        </div>
      );
    }

    // Fallback: Categoria ou Iniciais
    if (category) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: category.color || '#3B82F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
          }}
        >
          <IconRenderer name={category.icon || 'Repeat'} size={iconSize} />
        </div>
      );
    }

    // Fallback genérico com as primeiras letras
    const initials = (name || 'AS')
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          backgroundColor: '#374151',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F3F4F6',
          fontSize: `${Math.round(size * 0.38)}px`,
          fontWeight: 700,
        }}
      >
        {initials}
      </div>
    );
  };

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Círculo Principal do Avatar */}
      {renderBrandContent()}

      {/* Badge do Banco Sobreposto no Canto Inferior Direito */}
      {bankId && (
        <div
          style={{
            position: 'absolute',
            bottom: '-2px',
            right: '-2px',
            width: `${badgeSize}px`,
            height: `${badgeSize}px`,
            borderRadius: '50%',
            backgroundColor: '#0E0F12',
            boxShadow: '0 0 0 2px #0E0F12',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <BankLogo bankId={bankId} size={badgeSize} />
        </div>
      )}
    </div>
  );
};
