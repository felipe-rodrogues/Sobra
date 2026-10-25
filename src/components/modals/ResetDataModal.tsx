import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBackHandler, BACK_PRIORITY } from '../../core/navigation/backNavigation';

export interface ResetDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  isResetting?: boolean;
}

const CONFIRMATION_KEYWORD = 'ZERAR';

export const ResetDataModal: React.FC<ResetDataModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isResetting = false,
}) => {
  const [typedKeyword, setTypedKeyword] = useState('');

  useBackHandler({
    id: 'reset_data_modal',
    onBack: () => {
      if (!isResetting) {
        onClose();
        return true;
      }
      return false;
    },
    enabled: isOpen,
    priority: BACK_PRIORITY.DIALOG,
  });

  useEffect(() => {
    if (isOpen) {
      setTypedKeyword('');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isResetting) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isResetting, onClose]);

  if (!isOpen) return null;

  const isConfirmed = typedKeyword.trim().toUpperCase() === CONFIRMATION_KEYWORD;

  const handleConfirmAction = async () => {
    if (!isConfirmed || isResetting) return;
    await onConfirm();
  };

  const modalElement = (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={() => !isResetting && onClose()}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '360px',
          borderRadius: '16px',
          backgroundColor: '#121714',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '24px 20px 20px',
          boxSizing: 'border-box',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Título direto e calmo */}
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '1.15rem',
              fontWeight: 600,
              color: '#F8FAFC',
              letterSpacing: '-0.02em',
            }}
          >
            Zerar dados
          </h3>
          <p
            style={{
              margin: '8px 0 0 0',
              fontSize: '0.84rem',
              color: '#94A3B8',
              lineHeight: 1.5,
            }}
          >
            Todos os cartões, contas e lançamentos salvos serão apagados permanentemente deste dispositivo.
          </p>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '0.8125rem',
              color: '#E2E8F0',
              fontWeight: 500,
            }}
          >
            Esta ação não pode ser desfeita.
          </p>
        </div>

        {/* Campo de confirmação por digitação */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            htmlFor="confirm-reset-input"
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: '#94A3B8',
            }}
          >
            Digite <span style={{ color: '#F87171', fontWeight: 600 }}>{CONFIRMATION_KEYWORD}</span> para confirmar:
          </label>
          <input
            id="confirm-reset-input"
            type="text"
            autoFocus
            disabled={isResetting}
            value={typedKeyword}
            onChange={e => setTypedKeyword(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && isConfirmed && !isResetting) {
                e.preventDefault();
                handleConfirmAction();
              }
            }}
            placeholder="ZERAR"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            style={{
              width: '100%',
              height: '42px',
              padding: '0 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: isConfirmed
                ? '1px solid #F87171'
                : '1px solid rgba(255, 255, 255, 0.1)',
              color: '#F8FAFC',
              fontSize: '0.88rem',
              fontWeight: 500,
              outline: 'none',
              boxSizing: 'border-box',
              letterSpacing: '0.04em',
              transition: 'border-color 0.15s ease',
            }}
          />
        </div>

        {/* Botões de Ação (1 linha sem quebra, máx 12 caracteres cada) */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            style={{
              flex: 1,
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#CBD5E1',
              fontSize: '0.84rem',
              fontWeight: 500,
              cursor: isResetting ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              if (!isResetting) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
            }}
            onMouseLeave={e => {
              if (!isResetting) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmAction}
            disabled={!isConfirmed || isResetting}
            style={{
              flex: 1,
              height: '42px',
              borderRadius: '10px',
              backgroundColor: isConfirmed ? '#DC2626' : 'rgba(255, 255, 255, 0.04)',
              border: isConfirmed ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.07)',
              color: isConfirmed ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: isConfirmed && !isResetting ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {isResetting ? 'Zerando...' : 'Zerar dados'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalElement, document.body) : modalElement;
};
