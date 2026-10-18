import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useFinance } from '../../context/FinanceContext';
import { Transaction } from '../../core/types';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { BrandLogo } from '../subscriptions/SubscriptionLogo';
import { 
  resolveInstallmentNumber, 
  resolveInstallmentTotal, 
  findInstallmentSiblings 
} from '../../core/installments/installmentHelper';
import { extractInstallmentFromDescription } from '../../core/parsers/csvParser';
import { useBackHandler, BACK_PRIORITY } from '../../core/navigation/backNavigation';

export type InstallmentDeleteScope = 'single' | 'future' | 'previous' | 'all';

export interface InstallmentDeleteScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scope: InstallmentDeleteScope) => void | Promise<void>;
  transaction: Transaction;
  zIndex?: number;
  isLoading?: boolean;
  showBankBadge?: boolean;
}

export const InstallmentDeleteScopeModal: React.FC<InstallmentDeleteScopeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  transaction,
  zIndex = 10000,
  isLoading = false,
  showBankBadge = true,
}) => {
  const { colors, mode } = useTheme();
  const { accounts, categories, transactions } = useFinance();
  const isDark = mode === 'dark';

  const [scope, setScope] = useState<InstallmentDeleteScope>('single');

  useBackHandler({
    id: 'installment_delete_scope_modal',
    onBack: () => {
      if (!isLoading) {
        onClose();
        return true;
      }
      return false;
    },
    enabled: isOpen,
    priority: BACK_PRIORITY.DIALOG,
  });

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

  if (!isOpen || !transaction) return null;

  const curNum = resolveInstallmentNumber(transaction);
  const totalNum = resolveInstallmentTotal(transaction);
  const account = accounts.find(a => a.id === transaction.accountId);
  const category = categories.find(c => c.id === transaction.categoryId);

  const extracted = extractInstallmentFromDescription(transaction.description);
  const cleanTitle = extracted.cleanDescription || transaction.description;

  // Calcula o valor total do parcelamento somando as parcelas irmãs ou multiplicando
  const siblings = findInstallmentSiblings(transaction, transactions);
  const totalAmount = transaction.originalTotalAmount || (
    siblings.length > 0 
      ? siblings.reduce((sum, s) => sum + s.amount, 0)
      : transaction.amount * totalNum
  );

  interface OptionItem {
    id: InstallmentDeleteScope;
    title: string;
    subtitle: string;
  }

  const options: OptionItem[] = [];

  // Opção 1: Excluir somente esta parcela
  options.push({
    id: 'single',
    title: 'Apenas esta parcela',
    subtitle: `Remove ${formatBrlCurrency(transaction.amount)} desta fatura. As demais parcelas continuam salvas.`,
  });

  // Opção 2: Excluir esta e as próximas parcelas (quando não é a 1ª nem a última)
  if (curNum > 1 && curNum < totalNum) {
    const futureCount = totalNum - curNum + 1;
    options.push({
      id: 'future',
      title: 'Esta e as próximas parcelas',
      subtitle: `Remove esta parcela e cancela as ${futureCount - 1} futuras pendentes.`,
    });
  }

  // Opção 3: Excluir todas as parcelas do parcelamento
  options.push({
    id: 'all',
    title: 'Todas as parcelas',
    subtitle: `Cancela a compra inteira (${formatBrlCurrency(totalAmount)}) e libera o limite do cartão.`,
  });

  const modalElement = (
    <div
      data-modal-backdrop="true"
      data-modal-zindex={zIndex}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
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
        aria-labelledby="installment-delete-scope-title"
        style={{
          width: '100%',
          maxWidth: '400px',
          maxHeight: '90vh',
          borderRadius: '24px',
          backgroundColor: isDark ? '#141A16' : colors.surface,
          backgroundImage: isDark
            ? 'linear-gradient(180deg, rgba(20, 26, 22, 0.98) 0%, rgba(13, 17, 14, 0.98) 100%)'
            : undefined,
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: isDark
            ? '0 24px 60px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.03)'
            : '0 20px 40px -12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          padding: '22px 20px 20px',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho Limpo e Humano */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h3
              id="installment-delete-scope-title"
              style={{
                margin: 0,
                fontSize: '1.12rem',
                fontWeight: 700,
                fontFamily: "'Outfit', 'Inter', sans-serif",
                color: isDark ? '#FFFFFF' : colors.textPrimary,
                letterSpacing: '-0.02em',
              }}
            >
              Excluir compra parcelada
            </h3>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '0.80rem',
                color: isDark ? '#94A3B8' : colors.textSecondary,
                lineHeight: 1.4,
              }}
            >
              Esta despesa foi dividida em {totalNum}x. O que deseja excluir?
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Fechar"
            style={{
              background: 'none',
              border: 'none',
              color: isDark ? '#64748B' : colors.textMuted,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              padding: '6px',
              margin: '-6px -6px 0 0',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Card Informativo da Transação - Nunca corta dados */}
        <div
          style={{
            margin: '0 0 16px',
            padding: '14px 16px',
            borderRadius: '18px',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.035)' : '#F8FAFC',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.07)' : '1px solid rgba(0, 0, 0, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Linha superior: Logo + Estabelecimento + Conta/Cartão + Valor da Parcela */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              <BrandLogo
                name={cleanTitle}
                category={category}
                bankId={showBankBadge ? (account?.bankId || account?.name) : undefined}
                size={42}
                fallbackIcon="ShoppingBag"
              />
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div
                  style={{
                    fontSize: '0.94rem',
                    fontWeight: 600,
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                    color: isDark ? '#FFFFFF' : colors.textPrimary,
                    letterSpacing: '-0.01em',
                    lineHeight: 1.3,
                    wordBreak: 'break-word',
                  }}
                >
                  {cleanTitle}
                </div>
                {category && category.name.toLowerCase() !== cleanTitle.toLowerCase() && (
                  <div
                    style={{
                      fontSize: '0.74rem',
                      color: isDark ? '#94A3B8' : colors.textSecondary,
                    }}
                  >
                    {category.name}
                  </div>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0, paddingTop: '2px' }}>
              <div
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  color: '#FB7185',
                  letterSpacing: '-0.02em',
                }}
              >
                - {formatBrlCurrency(transaction.amount)}
              </div>
            </div>
          </div>

          {/* Linha inferior de contexto: Parcela X de Y e Valor Total */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '10px',
              borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
              fontSize: '0.74rem',
              color: isDark ? '#94A3B8' : colors.textSecondary,
            }}
          >
            <span style={{ fontWeight: 600 }}>
              Parcela {curNum} de {totalNum}
            </span>
            {totalAmount > transaction.amount && (
              <span style={{ color: isDark ? '#64748B' : colors.textMuted }}>
                Total da compra: {formatBrlCurrency(totalAmount)}
              </span>
            )}
          </div>
        </div>

        {/* Opções de Escopo (Cards Táteis e Elegantes) */}
        <div
          role="radiogroup"
          aria-label="Escopo de exclusão"
          style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}
        >
          {options.map(opt => {
            const isSelected = scope === opt.id;
            return (
              <div
                key={opt.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => !isLoading && setScope(opt.id)}
                onKeyDown={e => {
                  if ((e.key === ' ' || e.key === 'Enter') && !isLoading) {
                    e.preventDefault();
                    setScope(opt.id);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '13px 15px',
                  borderRadius: '16px',
                  backgroundColor: isSelected
                    ? isDark
                      ? 'rgba(255, 255, 255, 0.05)'
                      : '#F1F5F9'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.02)'
                    : '#FFFFFF',
                  border: isSelected
                    ? isDark
                      ? '1px solid rgba(255, 255, 255, 0.20)'
                      : '1px solid rgba(0, 0, 0, 0.20)'
                    : isDark
                    ? '1px solid rgba(255, 255, 255, 0.05)'
                    : '1px solid rgba(0, 0, 0, 0.05)',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                }}
              >
                {/* Indicador Circular de Precisão */}
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: isSelected
                      ? 'none'
                      : isDark
                      ? '1.5px solid rgba(255, 255, 255, 0.25)'
                      : '1.5px solid rgba(0, 0, 0, 0.25)',
                    backgroundColor: isSelected ? '#E11D48' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                >
                  {isSelected && (
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#FFFFFF',
                      }}
                    />
                  )}
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
                    {opt.title}
                  </div>
                  <p
                    style={{
                      fontSize: '0.73rem',
                      color: isDark ? '#94A3B8' : colors.textSecondary,
                      margin: '2px 0 0',
                      lineHeight: 1.35,
                    }}
                  >
                    {opt.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Botões de Ação na Parte Inferior - Simétricos e Elegantes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              flex: 1,
              height: '46px',
              padding: '0 16px',
              borderRadius: '14px',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
              color: isDark ? '#E2E8F0' : colors.textPrimary,
              fontSize: '0.90rem',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => onConfirm(scope)}
            disabled={isLoading}
            style={{
              flex: 1,
              height: '46px',
              padding: '0 16px',
              borderRadius: '14px',
              background: 'linear-gradient(180deg, #E11D48 0%, #BE123C 100%)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '0.90rem',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(225, 29, 72, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalElement, document.body) : modalElement;
};


