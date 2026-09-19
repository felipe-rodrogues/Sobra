import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Users } from 'lucide-react';
import { SobraLogo } from '../common/SobraLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  iconType?: 'logo' | 'shared';
  hideGuestOption?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  title = 'Boas-vindas ao Sobra',
  subtitle = 'Organize seus gastos, contas e cartões com clareza e tranquilidade.',
  iconType = 'logo',
  hideGuestOption = false,
}) => {
  const { loginWithGoogle, continueAsGuest, isLoading } = useAuth();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '370px',
          backgroundColor: '#0F1411',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '32px',
          boxShadow: '0 28px 70px rgba(0, 0, 0, 0.85), 0 0 50px rgba(74, 222, 128, 0.06)',
          padding: '40px 28px 30px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* Glow sutil e calmo de fundo */}
        <div
          style={{
            position: 'absolute',
            top: '-70px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '200px',
            height: '140px',
            borderRadius: '50%',
            backgroundColor: 'rgba(74, 222, 128, 0.1)',
            filter: 'blur(50px)',
            pointerEvents: 'none',
          }}
        />

        {/* Botão de Fechar discreto */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '18px',
              right: '18px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: 'none',
              color: '#71717A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.color = '#71717A';
            }}
          >
            <X size={15} />
          </button>
        )}

        {/* Ícone Contextual: Compartilhamento ou Logo Sobra */}
        {iconType === 'shared' ? (
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              backgroundColor: 'rgba(74, 222, 128, 0.12)',
              border: '1px solid rgba(74, 222, 128, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4ADE80',
              marginBottom: '18px',
              boxShadow: '0 8px 24px rgba(74, 222, 128, 0.15)',
            }}
          >
            <Users size={32} strokeWidth={2.2} />
          </div>
        ) : (
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <SobraLogo size={58} variant="icon" />
          </div>
        )}

        {/* Título Principal */}
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: '#FFFFFF',
            margin: '0 0 10px 0',
            letterSpacing: '-0.03em',
            lineHeight: 1.25,
          }}
        >
          {title}
        </h2>

        {/* Subtítulo amigável e direto */}
        <p
          style={{
            fontSize: '0.88rem',
            color: '#94A3B8',
            margin: '0 0 32px 0',
            lineHeight: 1.5,
            maxWidth: '290px',
          }}
        >
          {subtitle}
        </p>

        {/* Botão de Alto Destaque: Continuar com o Google */}
        <button
          type="button"
          onClick={loginWithGoogle}
          disabled={isLoading}
          style={{
            width: '100%',
            height: '52px',
            borderRadius: '16px',
            backgroundColor: '#FFFFFF',
            border: 'none',
            color: '#111827',
            fontSize: '0.95rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 20px rgba(255, 255, 255, 0.16)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            opacity: isLoading ? 0.7 : 1,
            boxSizing: 'border-box',
          }}
          onMouseEnter={e => {
            if (!isLoading) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(255, 255, 255, 0.25)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 255, 255, 0.16)';
          }}
        >
          {/* Logo Oficial Google em SVG */}
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>{isLoading ? 'Conectando...' : 'Continuar com o Google'}</span>
        </button>

        {/* Opção Secundária Discreta */}
        {hideGuestOption ? (
          onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                marginTop: '18px',
                background: 'transparent',
                border: 'none',
                color: '#71717A',
                fontSize: '0.82rem',
                fontWeight: 500,
                cursor: 'pointer',
                padding: '8px 16px',
                borderRadius: '8px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#A1A1AA';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#71717A';
              }}
            >
              Agora não
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={continueAsGuest}
            style={{
              marginTop: '18px',
              background: 'transparent',
              border: 'none',
              color: '#71717A',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '8px',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#A1A1AA';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#71717A';
            }}
          >
            Continuar sem conta (modo offline)
          </button>
        )}
      </div>
    </div>
  );
};
