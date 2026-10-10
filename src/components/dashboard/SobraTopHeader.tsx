import React, { useState } from 'react';
import { Bell, Eye, EyeOff, ChevronRight } from 'lucide-react';
import { FinancialLadderProgress } from '../../core/ai/types';

interface SobraTopHeaderProps {
  userName?: string;
  unreadNotificationsCount?: number;
  onOpenNotifications: () => void;
  onOpenAiChat?: () => void;
  isPrivacyMode?: boolean;
  onTogglePrivacy?: () => void;
  ladderProgress?: FinancialLadderProgress;
  onOpenDiagnosis?: () => void;
}

export const SobraTopHeader: React.FC<SobraTopHeaderProps> = ({
  userName = 'Usuário',
  unreadNotificationsCount = 0,
  onOpenNotifications,
  onOpenAiChat,
  isPrivacyMode = false,
  onTogglePrivacy,
  ladderProgress,
  onOpenDiagnosis,
}) => {
  const [isBellHovered, setIsBellHovered] = useState(false);
  const [isEyeHovered, setIsEyeHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '2px 2px 6px',
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
          {`Olá, ${userName}`}
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

        {/* Chip da Fase da Escada Financeira */}
        {ladderProgress && onOpenDiagnosis && (
          <div style={{ marginTop: '5px' }}>
            <button
              type="button"
              onClick={onOpenDiagnosis}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 9px',
                borderRadius: '9999px',
                backgroundColor: ladderProgress.currentStage === 'debt_relief'
                  ? 'rgba(251, 113, 133, 0.12)'
                  : ladderProgress.currentStage === 'wealth_building'
                  ? 'rgba(168, 85, 247, 0.12)'
                  : 'rgba(74, 222, 128, 0.12)',
                border: `1px solid ${
                  ladderProgress.currentStage === 'debt_relief'
                    ? 'rgba(251, 113, 133, 0.25)'
                    : ladderProgress.currentStage === 'wealth_building'
                    ? 'rgba(168, 85, 247, 0.25)'
                    : 'rgba(74, 222, 128, 0.25)'
                }`,
                color: ladderProgress.currentStage === 'debt_relief'
                  ? '#FB7185'
                  : ladderProgress.currentStage === 'wealth_building'
                  ? '#C084FC'
                  : '#4ADE80',
                fontSize: '0.73rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <span>
                {ladderProgress.currentStage === 'debt_relief'
                  ? '🧱 Fase 1: Estancar Dívidas'
                  : ladderProgress.currentStage === 'wealth_building'
                  ? '🚀 Fase 3: Multiplicação'
                  : `🛡️ Fase 2: ${ladderProgress.monthsProtected.toFixed(1)}m protegidos`}
              </span>
              <ChevronRight size={12} />
            </button>
          </div>
        )}
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
