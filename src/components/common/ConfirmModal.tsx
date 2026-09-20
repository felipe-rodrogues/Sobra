import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { BankLogo } from './BankLogo';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  // Detalhes opcionais para enriquecer o modal (estilo micro-card Pierre)
  itemDetails?: {
    title: string;
    amount?: string;
    subtitle?: string;
    badge?: string;
    bankId?: string;
    icon?: React.ReactNode;
    amountLabel?: string;
    isAmountDestructive?: boolean;
  };
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar Ação',
  description = 'Tem certeza que deseja prosseguir com esta ação?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading = false,
  itemDetails,
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

  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';

  return (
    <div
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
        padding: 'calc(var(--safe-area-top, 0px) + 16px) max(16px, var(--safe-area-right, 0px)) calc(var(--safe-area-bottom, 0px) + 16px) max(16px, var(--safe-area-left, 0px))',
        boxSizing: 'border-box',
      }}
      onClick={() => !isLoading && onClose()}
    >
      <div
        className="animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '380px',
          borderRadius: '24px',
          backgroundColor: isDark ? '#141A16' : colors.surface,
          backgroundImage: isDark
            ? 'linear-gradient(180deg, rgba(24, 32, 27, 0.98) 0%, rgba(16, 21, 18, 0.98) 100%)'
            : undefined,
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: isDark
            ? '0 24px 60px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.03)'
            : '0 20px 40px -12px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          padding: '24px 22px 20px',
          boxSizing: 'border-box',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header com Título e Botão Fechar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '6px',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: 'Outfit, sans-serif',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: colors.textPrimary,
              letterSpacing: '-0.025em',
            }}
          >
            {title}
          </h3>

          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.04)',
              color: colors.textMuted,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              flexShrink: 0,
              marginLeft: '12px',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = colors.textPrimary;
              (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = colors.textMuted;
              (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
            }}
            aria-label="Fechar"
          >
            <X size={15} />
          </button>
        </div>

        <p
          style={{
            margin: '0 0 18px',
            fontSize: '0.86rem',
            color: colors.textSecondary,
            lineHeight: 1.5,
            textAlign: 'left',
          }}
        >
          {description}
        </p>

          {/* Micro-Card com Detalhes do Item (Estilo Pierre) */}
          {itemDetails && (
            <div
              style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.03)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.07)' : '1px solid rgba(0, 0, 0, 0.06)',
                borderRadius: '16px',
                padding: '12px 14px',
                marginBottom: '20px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                {/* Logo do Banco ou Ícone customizado */}
                {itemDetails.bankId ? (
                  <BankLogo bankId={itemDetails.bankId} size={36} />
                ) : itemDetails.icon ? (
                  <div style={{ flexShrink: 0 }}>{itemDetails.icon}</div>
                ) : null}

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '0.92rem',
                      color: colors.textPrimary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {itemDetails.title}
                  </div>
                  {itemDetails.subtitle && (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: colors.textMuted,
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {itemDetails.subtitle}
                    </div>
                  )}
                </div>
              </div>

              {itemDetails.amount && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {itemDetails.amountLabel && (
                    <div
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: colors.textMuted,
                        marginBottom: '2px',
                      }}
                    >
                      {itemDetails.amountLabel}
                    </div>
                  )}
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '0.92rem',
                      color: itemDetails.isAmountDestructive ? '#F43F5E' : colors.textPrimary,
                    }}
                  >
                    {itemDetails.amount}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botões de Ação */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              disabled={isLoading}
              style={{
                flex: 1,
                height: '46px',
                borderRadius: '14px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                color: colors.textPrimary,
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={e => {
                if (!isLoading) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = isDark
                    ? 'rgba(255, 255, 255, 0.09)'
                    : 'rgba(0, 0, 0, 0.08)';
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = isDark
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(0, 0, 0, 0.05)';
              }}
            >
              {cancelText}
            </button>

            <button
              onClick={onConfirm}
              disabled={isLoading}
              style={{
                flex: 1,
                height: '46px',
                borderRadius: '14px',
                background: isDanger
                  ? 'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)'
                  : isWarning
                  ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                  : 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                border: isDanger ? '1px solid rgba(255, 255, 255, 0.12)' : 'none',
                boxShadow: isDanger
                  ? '0 4px 14px rgba(225, 29, 72, 0.35)'
                  : isWarning
                  ? '0 4px 14px rgba(245, 158, 11, 0.35)'
                  : '0 4px 14px rgba(34, 197, 94, 0.35)',
                color: '#FFFFFF',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isLoading ? 0.7 : 1,
              }}
              onMouseEnter={e => {
                if (!isLoading) {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = isDanger
                    ? '0 6px 18px rgba(225, 29, 72, 0.45)'
                    : '0 6px 18px rgba(34, 197, 94, 0.45)';
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = isDanger
                  ? '0 4px 14px rgba(225, 29, 72, 0.35)'
                  : '0 4px 14px rgba(34, 197, 94, 0.35)';
              }}
            >
              {isLoading ? 'Excluindo...' : confirmText}
            </button>
          </div>
      </div>
    </div>
  );
};
