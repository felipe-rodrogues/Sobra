import React, { useEffect, useState } from 'react';
import { X, Repeat } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { BankLogo } from '../common/BankLogo';
import { BrandLogo } from '../subscriptions/SubscriptionLogo';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';

export type SubscriptionDeleteScope = 'single' | 'all';

export interface SubscriptionDeleteScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scope: SubscriptionDeleteScope) => void | Promise<void>;
  subscriptionName: string;
  transactionTitle?: string;
  amount: number;
  cadence?: 'monthly' | 'yearly';
  monthLabel?: string;
  categoryName?: string;
  categoryColor?: string;
  bankId?: string;
  zIndex?: number;
  isLoading?: boolean;
}

/**
 * Modal de confirmação inteligente ao excluir uma cobrança vinculada a uma assinatura.
 * Explica que o lançamento é uma assinatura recorrente e pergunta se o usuário deseja
 * apenas excluir aquela cobrança pontual (desta fatura) ou remover a assinatura por completo.
 */
export const SubscriptionDeleteScopeModal: React.FC<SubscriptionDeleteScopeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  subscriptionName,
  transactionTitle,
  amount,
  cadence = 'monthly',
  monthLabel,
  bankId,
  zIndex = 10000,
  isLoading = false,
}) => {
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';
  const [scope, setScope] = useState<SubscriptionDeleteScope>('single');

  // Sempre reabre no modo mais seguro ('single' - apenas esta cobrança)
  useEffect(() => {
    if (isOpen) setScope('single');
  }, [isOpen]);

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

  const displayName = subscriptionName || transactionTitle || 'Assinatura';
  const cadenceText = cadence === 'yearly' ? 'Assinatura Anual' : 'Assinatura Mensal';
  const displaySubtitle = monthLabel ? `${cadenceText} • ${monthLabel}` : cadenceText;

  const confirmLabel = isLoading
    ? 'Excluindo...'
    : scope === 'all'
    ? 'Remover assinatura'
    : 'Excluir cobrança';

  const options: {
    id: SubscriptionDeleteScope;
    title: string;
    subtitle: string;
  }[] = [
    {
      id: 'single',
      title: 'Apenas esta cobrança',
      subtitle: 'Remove o lançamento desta fatura. As próximas cobranças da assinatura continuarão sendo geradas normalmente.',
    },
    {
      id: 'all',
      title: 'Remover a assinatura também',
      subtitle: 'Exclui esta cobrança e cancela a assinatura cadastrada, impedindo qualquer lançamento futuro.',
    },
  ];

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
        zIndex,
        padding: 'calc(var(--safe-area-top, 0px) + 16px) max(16px, var(--safe-area-right, 0px)) calc(var(--safe-area-bottom, 0px) + 16px) max(16px, var(--safe-area-left, 0px))',
        boxSizing: 'border-box',
      }}
      onClick={() => !isLoading && onClose()}
    >
      <div
        className="animate-scale-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sub-delete-scope-title"
        style={{
          width: '100%',
          maxWidth: '400px',
          borderRadius: '24px',
          backgroundColor: isDark ? '#141A16' : colors.surface,
          backgroundImage: isDark
            ? 'linear-gradient(180deg, rgba(24, 32, 27, 0.98) 0%, rgba(16, 21, 18, 0.98) 100%)'
            : undefined,
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: isDark
            ? '0 24px 60px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.03)'
            : '0 20px 40px -12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 22px 20px',
          boxSizing: 'border-box',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                backgroundColor: 'rgba(168, 85, 247, 0.14)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#C084FC',
              }}
            >
              <Repeat size={16} strokeWidth={2.4} />
            </div>
            <h3
              id="sub-delete-scope-title"
              style={{
                margin: 0,
                fontFamily: 'Outfit, sans-serif',
                fontSize: '1.22rem',
                fontWeight: 700,
                color: colors.textPrimary,
                letterSpacing: '-0.025em',
              }}
            >
              Cobrança de Assinatura
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Fechar"
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
              flexShrink: 0,
              marginLeft: '12px',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Descrição Explicativa */}
        <p style={{ margin: '0 0 16px', fontSize: '0.86rem', color: colors.textSecondary, lineHeight: 1.5 }}>
          Esta cobrança faz parte da assinatura recorrente de <strong style={{ color: colors.textPrimary }}>{displayName}</strong>. Como você deseja proceder com a exclusão?
        </p>

        {/* Micro-card do Lançamento */}
        <div
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.03)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.07)' : '1px solid rgba(0, 0, 0, 0.06)',
            borderRadius: '16px',
            padding: '12px 14px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            {bankId ? (
              <BankLogo bankId={bankId} size={36} />
            ) : (
              <BrandLogo name={displayName} size={36} fallbackIcon="Repeat" />
            )}
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
                {displayName}
              </div>
              <div style={{ fontSize: '0.74rem', color: colors.textMuted, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displaySubtitle}
              </div>
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#FB7185', flexShrink: 0 }}>
            {`- ${formatBrlCurrency(amount)}`}
          </div>
        </div>

        {/* Opções de Escopo (Radio Group) */}
        <div role="radiogroup" aria-label="Opções de exclusão da assinatura" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {options.map(opt => {
            const selected = scope === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={selected}
                id={`sub-delete-scope-${opt.id}`}
                onClick={() => setScope(opt.id)}
                disabled={isLoading}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  backgroundColor: selected
                    ? (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)')
                    : 'transparent',
                  border: `1px solid ${selected
                    ? (isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.18)')
                    : (isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)')}`,
                  textAlign: 'left',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.18s ease',
                  boxSizing: 'border-box',
                }}
              >
                {/* Indicador de Seleção Circular */}
                <span
                  aria-hidden="true"
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: `2px solid ${selected ? colors.textPrimary : (isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.22)')}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                    transition: 'border-color 0.18s ease',
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: colors.textPrimary,
                      transform: selected ? 'scale(1)' : 'scale(0)',
                      transition: 'transform 0.18s ease',
                    }}
                  />
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: colors.textPrimary }}>
                    {opt.title}
                  </div>
                  <span style={{ display: 'block', fontSize: '0.74rem', color: colors.textMuted, marginTop: '4px', lineHeight: 1.4 }}>
                    {opt.subtitle}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Botões de Ação */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
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
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            id="sub-delete-scope-confirm"
            onClick={() => onConfirm(scope)}
            disabled={isLoading}
            style={{
              flex: 1,
              height: '46px',
              borderRadius: '14px',
              background: scope === 'all'
                ? 'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)'
                : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 4px 14px rgba(225, 29, 72, 0.35)',
              color: '#FFFFFF',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
