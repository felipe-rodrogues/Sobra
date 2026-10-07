import React, { useEffect } from 'react';
import { X, Layers, FileText } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface InstallmentUpdateScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScope: (scope: 'single' | 'all') => void;
  installmentNumber?: number;
  installmentTotal?: number;
  transactionTitle?: string;
  zIndex?: number;
  isLoading?: boolean;
}

export const InstallmentUpdateScopeModal: React.FC<InstallmentUpdateScopeModalProps> = ({
  isOpen,
  onClose,
  onSelectScope,
  installmentNumber = 1,
  installmentTotal = 2,
  transactionTitle,
  zIndex = 10000,
  isLoading = false,
}) => {
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: 'calc(var(--safe-area-top, 0px) + 16px) max(16px, var(--safe-area-right, 0px)) calc(var(--safe-area-bottom, 0px) + 16px) max(16px, var(--safe-area-left, 0px))',
        boxSizing: 'border-box',
      }}
      onClick={() => !isLoading && onClose()}
    >
      <div
        className="animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '390px',
          borderRadius: '24px',
          backgroundColor: isDark ? '#141A16' : colors.surface,
          backgroundImage: isDark
            ? 'linear-gradient(180deg, rgba(22, 28, 24, 0.98) 0%, rgba(14, 18, 15, 0.98) 100%)'
            : undefined,
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: isDark
            ? '0 24px 60px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.03)'
            : '0 20px 40px -12px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          padding: '22px 20px 20px',
          boxSizing: 'border-box',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header com Título e Fechar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontFamily: "'Outfit', 'Inter', sans-serif",
                fontSize: '1.12rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: isDark ? '#FFFFFF' : colors.textPrimary,
              }}
            >
              Atualizar compra parcelada
            </h3>
            {transactionTitle && (
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  color: isDark ? '#94A3B8' : colors.textSecondary,
                  marginTop: '2px',
                }}
              >
                {transactionTitle}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Fechar"
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              margin: '-6px -6px 0 0',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              color: isDark ? '#64748B' : colors.textMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'all 0.15s ease',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Resumo Direto e Limpo */}
        <p
          style={{
            margin: '0 0 16px',
            fontSize: '0.84rem',
            color: isDark ? '#94A3B8' : colors.textSecondary,
            lineHeight: 1.4,
          }}
        >
          {`Esta compra tem ${installmentTotal} parcelas. Como deseja aplicar a alteração?`}
        </p>

        {/* Opções de Escopo (Pierre Cards) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Opção 1: Todas as parcelas */}
          <button
            type="button"
            onClick={() => onSelectScope('all')}
            disabled={isLoading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px 16px',
              borderRadius: '16px',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
              color: isDark ? '#FFFFFF' : colors.textPrimary,
              textAlign: 'left',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxSizing: 'border-box',
            }}
            onMouseEnter={e => {
              if (isDark) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }
            }}
            onMouseLeave={e => {
              if (isDark) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              }
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Layers size={18} color={isDark ? '#FFFFFF' : '#0F172A'} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  color: isDark ? '#FFFFFF' : colors.textPrimary,
                  letterSpacing: '-0.01em',
                }}
              >
                Todas as parcelas
              </div>
              <div
                style={{
                  fontSize: '0.74rem',
                  color: isDark ? '#94A3B8' : colors.textSecondary,
                  marginTop: '2px',
                  lineHeight: 1.3,
                }}
              >
                {`Aplica a alteração em todas as ${installmentTotal} parcelas desta compra`}
              </div>
            </div>
          </button>

          {/* Opção 2: Apenas esta parcela */}
          <button
            type="button"
            onClick={() => onSelectScope('single')}
            disabled={isLoading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px 16px',
              borderRadius: '16px',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#FFFFFF',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
              color: isDark ? '#FFFFFF' : colors.textPrimary,
              textAlign: 'left',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxSizing: 'border-box',
            }}
            onMouseEnter={e => {
              if (isDark) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              }
            }}
            onMouseLeave={e => {
              if (isDark) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
              }
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FileText size={18} color={isDark ? '#94A3B8' : '#64748B'} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  color: isDark ? '#FFFFFF' : colors.textPrimary,
                  letterSpacing: '-0.01em',
                }}
              >
                Apenas esta parcela
              </div>
              <div
                style={{
                  fontSize: '0.74rem',
                  color: isDark ? '#94A3B8' : colors.textSecondary,
                  marginTop: '2px',
                  lineHeight: 1.3,
                }}
              >
                {`Altera somente a parcela ${installmentNumber} de ${installmentTotal}`}
              </div>
            </div>
          </button>
        </div>

        {/* Botão Cancelar */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          style={{
            marginTop: '14px',
            background: 'none',
            border: 'none',
            padding: '8px',
            color: isDark ? '#64748B' : colors.textMuted,
            fontSize: '0.82rem',
            fontWeight: 500,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            textAlign: 'center',
            width: '100%',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = isDark ? '#94A3B8' : colors.textSecondary;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = isDark ? '#64748B' : colors.textMuted;
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};
