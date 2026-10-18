import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Subscription, Account, Category } from '../../core/types';
import { SubscriptionLogo } from '../subscriptions/SubscriptionLogo';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { useBackHandler, BACK_PRIORITY } from '../../core/navigation/backNavigation';
import { Pencil, Trash2, Users } from 'lucide-react';

export interface SubscriptionQuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: Subscription | null;
  targetRect?: DOMRect | null;
  onEdit: (sub: Subscription) => void;
  onDelete: (sub: Subscription) => void;
  statusSubtitle?: string;
  isPaidThisMonth?: boolean;
  isManualOverdue?: boolean;
  category?: Category;
  account?: Account | null;
  zIndex?: number;
  maskValue?: (val: string) => string;
}

/**
 * Menu de Ação Rápida em Pílula Flutuante para Assinaturas (Estilo Dynamic Island / Pierre)
 * Eleva o card da assinatura no local exato da lista e posiciona uma cápsula horizontal
 * com exatamente duas opções: [ Editar  |  Excluir ].
 */
export const SubscriptionQuickActionModal: React.FC<SubscriptionQuickActionModalProps> = ({
  isOpen,
  onClose,
  subscription,
  targetRect,
  onEdit,
  onDelete,
  statusSubtitle,
  isPaidThisMonth = false,
  isManualOverdue = false,
  category,
  account,
  zIndex = 9500,
  maskValue,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fecha o menu de contexto ao usar o gesto ou botão de voltar
  useBackHandler({
    priority: BACK_PRIORITY.DIALOG,
    enabled: isOpen && !!subscription,
    onBack: onClose,
  });

  if (!isOpen || !subscription) {
    return null;
  }

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

    // Alinhamento horizontal: centraliza a pílula em relação ao card da assinatura
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

  const formattedAmount = maskValue
    ? maskValue(formatBrlCurrency(subscription.amount))
    : formatBrlCurrency(subscription.amount);

  const isShared = account ? Boolean(account.isShared) : Boolean(subscription.isShared);

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
      {/* 1. Card da Assinatura Elevado no Exato Lugar da Lista */}
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
            padding: '10px 12px',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        >
          {/* Lado Esquerdo: Logo com Badge Bancário */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
            <SubscriptionLogo
              name={subscription.name}
              category={category}
              bankId={account?.bankId || account?.name}
              size={44}
            />

            {/* Textos Centrais: Nome e Subtítulo de Status */}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  letterSpacing: '-0.01em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {subscription.name}
                </span>
                {isShared && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94A3B8',
                      opacity: 0.85,
                      flexShrink: 0,
                    }}
                  >
                    <Users size={14} strokeWidth={2.2} />
                  </span>
                )}
              </div>

              {statusSubtitle && (
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: isPaidThisMonth || isManualOverdue ? 600 : 500,
                    color: isPaidThisMonth ? '#4ADE80' : isManualOverdue ? '#FBBF24' : '#9CA3AF',
                    marginTop: '2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {statusSubtitle}
                </div>
              )}
            </div>
          </div>

          {/* Lado Direito: Valor da Assinatura Puro e Elegante */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#FFFFFF',
                fontFamily: "'Outfit', 'Inter', sans-serif",
                letterSpacing: '-0.01em',
              }}
            >
              {formattedAmount}
            </span>
          </div>
        </div>
      ) : null}

      {/* 2. Pílula Horizontal Flutuante (Estilo Dynamic Island / Pierre) */}
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Ações rápidas da assinatura"
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
            onEdit(subscription);
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
            onDelete(subscription);
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
