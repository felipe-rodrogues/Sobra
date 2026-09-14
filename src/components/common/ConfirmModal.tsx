import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { Button } from './Button';

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
  // Detalhes opcionais para enriquecer o modal
  itemDetails?: {
    title: string;
    amount?: string;
    subtitle?: string;
    badge?: string;
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
  const { colors } = useTheme();

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
  const iconColor = isDanger ? '#EF4444' : variant === 'warning' ? '#F59E0B' : colors.primary;
  const iconBg = isDanger
    ? 'rgba(239, 68, 68, 0.15)'
    : variant === 'warning'
    ? 'rgba(245, 158, 11, 0.15)'
    : 'rgba(99, 102, 241, 0.15)';
  const borderGlow = isDanger
    ? 'rgba(239, 68, 68, 0.3)'
    : variant === 'warning'
    ? 'rgba(245, 158, 11, 0.3)'
    : 'rgba(99, 102, 241, 0.3)';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
      }}
      onClick={() => !isLoading && onClose()}
    >
      <div
        className="glass animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '420px',
          borderRadius: '24px',
          backgroundColor: colors.surface,
          border: `1px solid ${borderGlow}`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 25px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Topo com botão fechar */}
        <div
          style={{
            padding: '16px 20px 0',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: 'none',
              border: 'none',
              color: colors.textSecondary,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo Central */}
        <div style={{ padding: '0 24px 24px', textAlign: 'center' }}>
          {/* Ícone com Glow */}
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '18px',
              backgroundColor: iconBg,
              border: `1px solid ${borderGlow}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            {isDanger ? (
              <Trash2 size={26} color={iconColor} />
            ) : (
              <AlertTriangle size={26} color={iconColor} />
            )}
          </div>

          <h3
            style={{
              margin: '0 0 8px',
              fontSize: '1.25rem',
              fontWeight: 800,
              color: colors.textPrimary,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h3>

          <p
            style={{
              margin: '0 0 18px',
              fontSize: '0.88rem',
              color: colors.textSecondary,
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>

          {/* Card com Detalhes do Item (se houver) */}
          {itemDetails && (
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${colors.border}`,
                borderRadius: '14px',
                padding: '12px 14px',
                marginBottom: '20px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ overflow: 'hidden', marginRight: '10px' }}>
                <div
                  style={{
                    fontWeight: 700,
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
                  <div style={{ fontSize: '0.75rem', color: colors.textSecondary, marginTop: '2px' }}>
                    {itemDetails.subtitle}
                  </div>
                )}
              </div>

              {itemDetails.amount && (
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    color: isDanger ? '#EF4444' : colors.textPrimary,
                    flexShrink: 0,
                  }}
                >
                  {itemDetails.amount}
                </div>
              )}
            </div>
          )}

          {/* Botões de Ação */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
              style={{ flex: 1, padding: '12px' }}
            >
              {cancelText}
            </Button>
            <Button
              variant={isDanger ? 'danger' : 'primary'}
              onClick={onConfirm}
              disabled={isLoading}
              style={{ flex: 1, padding: '12px', fontWeight: 700 }}
            >
              {isLoading ? 'Processando...' : confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
