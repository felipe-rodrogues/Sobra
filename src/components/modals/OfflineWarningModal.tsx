import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { HardDrive, ArrowRight } from 'lucide-react';

export const OfflineWarningModal: React.FC = () => {
  const { 
    isOfflineWarningModalOpen, 
    confirmContinueAsGuest, 
    loginWithGoogle 
  } = useAuth();

  if (!isOfflineWarningModalOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
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
          boxShadow: '0 28px 70px rgba(0, 0, 0, 0.85)',
          padding: '32px 26px 24px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        <h3
          style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            color: '#FFFFFF',
            margin: '0 0 10px 0',
            letterSpacing: '-0.02em',
          }}
        >
          Usar o Sobra offline?
        </h3>

        <p
          style={{
            fontSize: '0.86rem',
            color: '#94A3B8',
            margin: '0 0 20px 0',
            lineHeight: 1.45,
          }}
        >
          No modo sem conta, seus dados ficam salvos exclusivamente na memória deste celular.
        </p>

        {/* Ponto único e objetivo: backup manual */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.035)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: '1px',
            }}
          >
            <HardDrive size={16} />
          </div>
          <div>
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#FFFFFF' }}>
              Backup manual
            </div>
            <div style={{ fontSize: '0.78rem', color: '#8E8E93', marginTop: '3px', lineHeight: 1.4 }}>
              Se trocar de aparelho ou formatar o celular, você precisará ter exportado um backup em arquivo no menu Mais para recuperar seus lançamentos.
            </div>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={loginWithGoogle}
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: '#4ADE80',
              border: 'none',
              color: '#0A150D',
              fontSize: '0.9rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(74, 222, 128, 0.25)',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <span>Conectar com Google</span>
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            onClick={confirmContinueAsGuest}
            style={{
              width: '100%',
              height: '42px',
              borderRadius: '14px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#71717A',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#A1A1AA'}
            onMouseLeave={e => e.currentTarget.style.color = '#71717A'}
          >
            Continuar offline mesmo assim
          </button>
        </div>
      </div>
    </div>
  );
};
