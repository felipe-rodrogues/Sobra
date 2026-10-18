import React, { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { Transaction, Account, Category } from '../../core/types';
import { BrandLogo } from '../common/BrandLogo';
import { resolveTransactionAuthorBadge } from '../../core/cards/cardSelectionHelper';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { extractInstallmentFromDescription } from '../../core/parsers/csvParser';
import { useBackHandler, BACK_PRIORITY } from '../../core/navigation/backNavigation';
import { Pencil, Trash2, ArrowLeftRight } from 'lucide-react';

export interface TransactionQuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  targetRect?: DOMRect | null;
  account?: Account;
  category?: Category;
  zIndex?: number;
  showBankBadge?: boolean;
}

/**
 * Menu de Ação Rápida em Pílula Flutuante (Estilo Dynamic Island / Pierre)
 * Eleva o card da despesa com desfoque de fundo e posiciona uma cápsula horizontal
 * tátil com exatamente duas opções: [ Editar  |  Excluir ].
 */
export const TransactionQuickActionModal: React.FC<TransactionQuickActionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onEdit,
  onDelete,
  targetRect,
  account: propAccount,
  category: propCategory,
  zIndex = 9500,
  showBankBadge = true,
}) => {
  const { accounts, categories, partnershipSpace } = useFinance();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fecha o menu de contexto ao usar o gesto ou botão de voltar
  useBackHandler({
    priority: BACK_PRIORITY.DIALOG,
    enabled: isOpen && !!transaction,
    onBack: onClose,
  });

  const acc = useMemo(() => {
    if (propAccount) return propAccount;
    return accounts.find(a => a.id === transaction?.accountId);
  }, [propAccount, accounts, transaction?.accountId]);

  const cat = useMemo(() => {
    if (propCategory) return propCategory;
    return categories.find(c => c.id === transaction?.categoryId);
  }, [propCategory, categories, transaction?.categoryId]);

  const authorBadge = useMemo(() => {
    if (!transaction) return null;
    return resolveTransactionAuthorBadge({
      tx: transaction,
      account: acc,
      currentUser: user,
      partnershipSpace,
    });
  }, [transaction, acc, user, partnershipSpace]);

  if (!isOpen || !transaction) {
    return null;
  }

  const isExpense = transaction.type === 'expense';
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';

  const extracted = extractInstallmentFromDescription(transaction.description || '');
  const cleanTitle = extracted.cleanDescription || transaction.description || 'Lançamento';
  const installmentNumber = transaction.installmentNumber || extracted.installmentNumber;
  const installmentTotal = transaction.installmentTotal || extracted.installmentTotal;
  const isInstallment = Boolean((installmentNumber && installmentTotal) || extracted.isInstallment || transaction.isInstallment);
  const installmentBadge = isInstallment && installmentNumber && installmentTotal
    ? `${installmentNumber}/${installmentTotal}`
    : null;

  const categoryLabel = isTransfer ? 'Transferência' : (cat?.name || 'Geral');
  const amountColor = isExpense ? '#FB7185' : (isIncome ? '#4ADE80' : '#C084FC');
  const amountPrefix = isExpense ? '- ' : (isIncome ? '+ ' : '');

  // Dimensões do viewport e da pílula
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
  const pillWidth = Math.min(236, viewportWidth - 32);

  let isPositioned = false;
  let isBelow = true;
  let pillStyle: React.CSSProperties = {};
  let cardPositionStyle: React.CSSProperties = {};

  if (targetRect) {
    isPositioned = true;
    const spaceBelow = viewportHeight - targetRect.bottom;
    isBelow = spaceBelow >= 95;

    // Alinhamento horizontal: centraliza a pílula em relação ao card da despesa
    const cardCenterX = targetRect.left + targetRect.width / 2;
    const left = Math.max(16, Math.min(cardCenterX - pillWidth / 2, viewportWidth - pillWidth - 16));

    if (isBelow) {
      pillStyle = {
        position: 'fixed',
        top: `${targetRect.bottom + 12}px`,
        left: `${left}px`,
        width: `${pillWidth}px`,
      };
    } else {
      pillStyle = {
        position: 'fixed',
        bottom: `${viewportHeight - targetRect.top + 12}px`,
        left: `${left}px`,
        width: `${pillWidth}px`,
      };
    }

    cardPositionStyle = {
      position: 'fixed',
      top: `${targetRect.top}px`,
      left: `${targetRect.left}px`,
      width: `${targetRect.width}px`,
      height: `${targetRect.height}px`,
      zIndex: zIndex + 2,
    };
  }

  const modalElement = (
    <div
      data-modal-backdrop="true"
      data-modal-zindex={zIndex}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex,
        animation: 'fadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      {/* 1. Card da Despesa Elevado no Exato Lugar da Lista (Sem borda neon) */}
      {isPositioned ? (
        <div
          className="anim-card-lift"
          style={{
            ...cardPositionStyle,
            backgroundColor: '#121714',
            background: 'linear-gradient(155deg, #151C17 0%, #101512 100%)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 20px 48px rgba(0, 0, 0, 0.8), 0 4px 14px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            {isTransfer ? (
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(192, 132, 252, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ArrowLeftRight size={20} color="#C084FC" />
              </div>
            ) : (
              <BrandLogo
                name={cleanTitle}
                category={cat}
                bankId={showBankBadge ? (acc?.bankId || acc?.name) : undefined}
                authorBadge={showBankBadge ? authorBadge : null}
                size={42}
                fallbackIcon={isExpense ? 'ShoppingBag' : 'TrendingUp'}
              />
            )}

            <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div
                style={{
                  fontSize: '0.94rem',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {cleanTitle}
              </div>
              <div
                style={{
                  fontSize: '0.76rem',
                  color: '#8E8E93',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {categoryLabel}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <div
              style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                fontFamily: 'Outfit, sans-serif',
                color: amountColor,
                letterSpacing: '-0.01em',
              }}
            >
              {amountPrefix}{formatBrlCurrency(transaction.amount)}
            </div>

            {installmentBadge && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: '5px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#CBD5E1',
                }}
              >
                {installmentBadge}
              </span>
            )}
          </div>
        </div>
      ) : null}

      {/* 2. Pílula Horizontal Flutuante (Estilo Dynamic Island / Pierre) */}
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Ações rápidas da despesa"
        className={isPositioned ? (isBelow ? 'anim-balloon-spring' : 'anim-balloon-spring-upward') : 'anim-balloon-spring'}
        style={{
          zIndex: zIndex + 3,
          height: '64px',
          borderRadius: '9999px',
          background: 'linear-gradient(180deg, rgba(38, 46, 42, 0.95) 0%, rgba(20, 26, 23, 0.97) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.06)',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          ...(isPositioned
            ? pillStyle
            : {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: `${pillWidth}px`,
              }),
        }}
      >
        {/* Opção da Esquerda: Editar */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onEdit(transaction);
          }}
          style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            borderRadius: '9999px 0 0 9999px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.12s ease, transform 0.1s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Pencil size={18} color="#FFFFFF" strokeWidth={2} />
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#FFFFFF',
              letterSpacing: '-0.01em',
            }}
          >
            Editar
          </span>
        </button>

        {/* Divisor Vertical Elegante de 1px */}
        <div
          style={{
            width: '1px',
            height: '32px',
            backgroundColor: 'rgba(255, 255, 255, 0.14)',
            flexShrink: 0,
          }}
        />

        {/* Opção da Direita: Excluir */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onDelete(transaction);
          }}
          style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            borderRadius: '0 9999px 9999px 0',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.12s ease, transform 0.1s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.10)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Trash2 size={18} color="#F87171" strokeWidth={2} />
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#F87171',
              letterSpacing: '-0.01em',
            }}
          >
            Excluir
          </span>
        </button>
      </div>
    </div>
  );

  return mounted && typeof document !== 'undefined' ? createPortal(modalElement, document.body) : modalElement;
};
