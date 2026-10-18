import React, { useState } from 'react';
import { Bell, Eye, EyeOff } from 'lucide-react';

interface SobraTopHeaderProps {
  userName?: string;
  title?: string;
  subtitle?: string;
  onSubtitleClick?: () => void;
  subtitleActionBadge?: boolean;
  unreadNotificationsCount?: number;
  onOpenNotifications: () => void;
  onOpenAiChat?: () => void;
  isPrivacyMode?: boolean;
  onTogglePrivacy?: () => void;
}

export const SobraTopHeader: React.FC<SobraTopHeaderProps> = ({
  userName = 'Usuário',
  title,
  subtitle,
  onSubtitleClick,
  subtitleActionBadge = false,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  onOpenAiChat,
  isPrivacyMode = false,
  onTogglePrivacy,
}) => {
  const [isBellHovered, setIsBellHovered] = useState(false);
  const [isEyeHovered, setIsEyeHovered] = useState(false);

  const displayTitle = title || `Olá, ${userName}`;
  const displaySubtitle = subtitle || 'Que bom te ver por aqui!';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '2px 2px 6px',
        gap: '12px',
      }}
    >
      {/* Boas-vindas personalizadas com proteção contra overflow */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          style={{
            fontSize: '1.42rem',
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
            margin: 0,
            lineHeight: 1.2,
            fontFamily: "'Outfit', 'Inter', sans-serif",
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={displayTitle}
        >
          {displayTitle}
        </h1>
        <div
          onClick={onSubtitleClick}
          role={onSubtitleClick ? 'button' : undefined}
          tabIndex={onSubtitleClick ? 0 : undefined}
          style={{
            fontSize: '0.82rem',
            color: onSubtitleClick ? '#A7F3D0' : '#94A3B8',
            margin: '3px 0 0 0',
            fontWeight: onSubtitleClick ? 500 : 400,
            lineHeight: 1.3,
            cursor: onSubtitleClick ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '5px',
            minWidth: 0,
            transition: 'color 0.15s ease',
          }}
          title={displaySubtitle}
        >
          {subtitleActionBadge && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#4ADE80',
                display: 'inline-block',
                flexShrink: 0,
                marginTop: '5px',
              }}
            />
          )}
          <span
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              wordBreak: 'break-word',
              lineHeight: 1.25,
              minWidth: 0,
            }}
          >
            {displaySubtitle}
          </span>
        </div>
      </div>

      {/* Ações do Canto Superior Direito: Modo Privacidade & Notificações */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

        {/* Botão de Modo Privacidade (Olho) */}
        {onTogglePrivacy && (
          <button
            type="button"
            onClick={onTogglePrivacy}
            onMouseEnter={() => setIsEyeHovered(true)}
            onMouseLeave={() => setIsEyeHovered(false)}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isEyeHovered || isPrivacyMode ? '#4ADE80' : '#94A3B8',
              cursor: 'pointer',
              transform: isEyeHovered ? 'scale(1.06)' : 'scale(1)',
              transition: 'color 0.18s ease, transform 0.18s ease',
            }}
            title={isPrivacyMode ? 'Exibir valores' : 'Ocultar valores'}
          >
            {isPrivacyMode ? <EyeOff size={20} strokeWidth={1.8} /> : <Eye size={20} strokeWidth={1.8} />}
          </button>
        )}

        {/* Sino de Notificações livre (sem caixa/botão circular e sem efeito neon) */}
        <button
          type="button"
          onClick={onOpenNotifications}
          onMouseEnter={() => setIsBellHovered(true)}
          onMouseLeave={() => setIsBellHovered(false)}
          style={{
            position: 'relative',
            background: 'none',
            border: 'none',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: unreadNotificationsCount > 0 ? '#FFFFFF' : (isBellHovered ? '#FFFFFF' : '#94A3B8'),
            cursor: 'pointer',
            transform: isBellHovered ? 'scale(1.06)' : 'scale(1)',
            transition: 'color 0.18s ease, transform 0.18s ease',
          }}
          title={
            unreadNotificationsCount > 0
              ? `${unreadNotificationsCount} nova${unreadNotificationsCount > 1 ? 's' : ''} notificaç${unreadNotificationsCount > 1 ? 'ões' : 'ão'} pendente${unreadNotificationsCount > 1 ? 's' : ''}`
              : 'Ver notificações'
          }
        >
          <Bell size={20} color="currentColor" strokeWidth={unreadNotificationsCount > 0 ? 2.2 : 1.8} />
          {unreadNotificationsCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '3px',
                right: '3px',
                width: '9px',
                height: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              {/* Onda expansiva tipo radar */}
              <span className="animate-radar-wave" />
              {/* Bolinha sólida e nítida central */}
              <span
                style={{
                  position: 'relative',
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor: '#22C55E',
                  border: '1.5px solid #0A0E0C',
                  boxSizing: 'border-box',
                  boxShadow: '0 0 6px rgba(34, 197, 94, 0.8)',
                }}
              />
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
