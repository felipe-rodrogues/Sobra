import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { BankLogo } from '../common/BankLogo';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';

export type InstallmentDeleteScope = 'single' | 'following';

export interface InstallmentDeleteScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scope: InstallmentDeleteScope) => void | Promise<void>;
  transactionTitle: string;
  installmentNumber: number;
  installmentTotal: number;
  parcelAmount: number;
  /** Quantidade de parcelas cadastradas a partir desta (inclusive) até a última */
  followingCount: number;
  /** Soma dos valores das parcelas a partir desta (inclusive) */
  followingAmount: number;
  bankId?: string;
  zIndex?: number;
  isLoading?: boolean;
}

/**
 * Confirmação de exclusão de uma parcela.
 * Informa que o lançamento pertence a uma compra parcelada e deixa o usuário escolher
 * entre remover só esta parcela ou esta e as próximas. A escolha só é aplicada ao tocar em "Excluir".
 */
export const InstallmentDeleteScopeModal: React.FC<InstallmentDeleteScopeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  transactionTitle,
  installmentNumber,
  installmentTotal,
  parcelAmount,
  followingCount,
  followingAmount,
  bankId,
  zIndex = 10000,
  isLoading = false,
}) => {
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';
  const [scope, setScope] = useState<InstallmentDeleteScope>('single');

  // Sempre reabre no modo mais seguro
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

  const hasFollowing = followingCount > 1;
  const isFirst = installmentNumber <= 1;
  const isLast = installmentNumber >= installmentTotal;

  const description = !hasFollowing
    ? isLast
      ? `Esta é a última parcela de uma compra em ${installmentTotal}x. As anteriores continuam registradas.`
      : `Esta parcela faz parte de uma compra em ${installmentTotal}x. As demais continuam registradas.`
    : `Esta parcela faz parte de uma compra em ${installmentTotal}x. O que você quer excluir?`;

  const followingTitle = isFirst ? 'Toda a compra' : 'Esta e as próximas';
  const followingSubtitle = isFirst
    ? `${followingCount} parcelas · ${formatBrlCurrency(followingAmount)}`
    : `Parcelas ${installmentNumber} a ${installmentTotal} · ${formatBrlCurrency(followingAmount)}`;

  const confirmLabel = isLoading
    ? 'Excluindo...'
    : scope === 'following' && hasFollowing
      ? `Excluir ${followingCount} parcelas`
      : 'Excluir parcela';

  const options: { id: InstallmentDeleteScope; title: string; subtitle: string }[] = [
    {
      id: 'single',
      title: 'Só esta parcela',
      subtitle: `Parcela ${installmentNumber} de ${installmentTotal} · ${formatBrlCurrency(parcelAmount)}`,
    },
    { id: 'following', title: followingTitle, subtitle: followingSubtitle },
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
        aria-labelledby="installment-delete-title"
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
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 22px 20px',
          boxSizing: 'border-box',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
          <h3
            id="installment-delete-title"
            style={{
              margin: 0,
              fontFamily: 'Outfit, sans-serif',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: colors.textPrimary,
              letterSpacing: '-0.025em',
            }}
          >
            Excluir parcela
          </h3>
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

        <p style={{ margin: '0 0 16px', fontSize: '0.86rem', color: colors.textSecondary, lineHeight: 1.5 }}>
          {description}
        </p>

        {/* Micro-card da compra */}
        <div
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.03)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.07)' : '1px solid rgba(0, 0, 0, 0.06)',
            borderRadius: '16px',
            padding: '12px 14px',
            marginBottom: hasFollowing ? '14px' : '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {bankId && <BankLogo bankId={bankId} size={36} />}
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
              {transactionTitle}
            </div>
            <div style={{ fontSize: '0.75rem', color: colors.textMuted, marginTop: '2px' }}>
              {`Parcela ${installmentNumber} de ${installmentTotal}`}
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: colors.textPrimary, flexShrink: 0 }}>
            {`- ${formatBrlCurrency(parcelAmount)}`}
          </div>
        </div>

        {/* Escolha do escopo (só quando existem próximas parcelas) */}
        {hasFollowing && (
          <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {options.map(opt => {
              const selected = scope === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  id={`installment-delete-scope-${opt.id}`}
                  onClick={() => setScope(opt.id)}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
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
                  {/* Indicador de seleção */}
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
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: colors.textPrimary }}>
                      {opt.title}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.74rem', color: colors.textMuted, marginTop: '2px' }}>
                      {opt.subtitle}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Ações */}
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
            id="installment-delete-confirm"
            onClick={() => onConfirm(hasFollowing ? scope : 'single')}
            disabled={isLoading}
            style={{
              flex: 1,
              height: '46px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #E11D48 0%, #BE123C 100%)',
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
