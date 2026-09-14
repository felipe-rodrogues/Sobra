import React, { useState } from 'react';
import { Bell, Sparkles } from 'lucide-react';

interface SobraTopHeaderProps {
  userName?: string;
  unreadNotificationsCount?: number;
  onOpenNotifications: () => void;
  onOpenAiChat?: () => void;
}

export const SobraTopHeader: React.FC<SobraTopHeaderProps> = ({
  userName = 'Felipe',
  unreadNotificationsCount = 0,
  onOpenNotifications,
  onOpenAiChat,
}) => {
  const [isAiHovered, setIsAiHovered] = useState(false);
  const [isBellHovered, setIsBellHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '6px 2px 8px',
      }}
    >
      {/* Boas-vindas personalizadas */}
      <div>
        <h1
          style={{
            fontSize: '1.45rem',
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
            margin: 0,
            lineHeight: 1.2,
            fontFamily: "'Outfit', 'Inter', sans-serif",
          }}
        >
          Olá, {userName}
        </h1>
        <p
          style={{
            fontSize: '0.82rem',
            color: '#94A3B8',
            margin: '2px 0 0 0',
            fontWeight: 400,
          }}
        >
          Que bom te ver por aqui!
        </p>
      </div>

      {/* Ações do Canto Superior Direito: Sobra AI & Sino Livre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {onOpenAiChat && (
          <button
            type="button"
            onClick={onOpenAiChat}
            onMouseEnter={() => setIsAiHovered(true)}
            onMouseLeave={() => setIsAiHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '9999px',
              backgroundColor: isAiHovered ? '#232E26' : '#1A231C',
              border: `1px solid ${isAiHovered ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.08)'}`,
              color: '#FFFFFF',
              fontSize: '0.78rem',
              fontWeight: 600,
              fontFamily: "'Outfit', 'Inter', sans-serif",
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              transform: isAiHovered ? 'translateY(-1px)' : 'translateY(0)',
              transition: 'all 0.18s ease',
            }}
            title="Abrir Sobra AI"
          >
            <Sparkles size={13} color="#22C55E" />
            <span>AI</span>
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
            color: isBellHovered ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
            transform: isBellHovered ? 'scale(1.06)' : 'scale(1)',
            transition: 'color 0.18s ease, transform 0.18s ease',
          }}
          title={
            unreadNotificationsCount > 0
              ? `${unreadNotificationsCount} novas notificações detectadas`
              : 'Ver notificações'
          }
        >
          <Bell size={20} color="currentColor" strokeWidth={1.8} />
          {unreadNotificationsCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '8px',
                height: '8px',
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
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#22C55E',
                  border: '1.5px solid #0A0E0C',
                  boxSizing: 'border-box',
                }}
              />
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
