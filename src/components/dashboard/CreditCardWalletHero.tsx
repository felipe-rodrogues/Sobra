import React from 'react';
import { Account, Transaction } from '../../core/types';
import { BankLogo } from '../common/BankLogo';
import { getBankById } from '../../core/banks/bankCatalog';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { calculateInvoiceForMonth, MONTH_NAMES } from '../../core/installments/installmentHelper';
import { getCardActiveInvoiceInfo } from '../../core/cards/cardDateHelper';
import { extractCardLastDigits } from '../../core/cards/cardSelectionHelper';
import { CreditCard, ChevronRight, Plus } from 'lucide-react';

interface CreditCardWalletHeroProps {
  cards: Account[];
  transactions: Transaction[];
  isPrivacyMode: boolean;
  maskValue: (v: string) => string;
  onOpenInvoices: (card?: Account | null, monthOffset?: number) => void;
  onAddNewCard: () => void;
}

export const CreditCardWalletHero: React.FC<CreditCardWalletHeroProps> = ({
  cards,
  transactions,
  isPrivacyMode,
  maskValue,
  onOpenInvoices,
  onAddNewCard,
}) => {
  const now = React.useMemo(() => new Date(), []);
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Filtrar apenas cartões de crédito
  const creditCards = cards.filter(c => c.type === 'credit_card');

  // Calcula com precisão a fatura ativa/em foco de cada cartão
  const activeCardsInfo = React.useMemo(() => {
    return creditCards.map(card => {
      const info = getCardActiveInvoiceInfo(card, transactions, now);
      return { card, info };
    });
  }, [creditCards, transactions, now]);

  // Total de faturas somadas ativas
  const totalInvoices = React.useMemo(() => {
    return activeCardsInfo.reduce((acc, item) => acc + item.info.totalAmount, 0);
  }, [activeCardsInfo]);

  // Total proporcional da cota do usuário
  const userTotalInvoices = React.useMemo(() => {
    return activeCardsInfo.reduce((acc, item) => acc + item.info.userAmount, 0);
  }, [activeCardsInfo]);

  const hasSharedSplitCard = creditCards.some(
    c => c.isShared && (c.splitRatio !== undefined ? c.splitRatio !== 1 : c.splitMode !== 'full')
  );

  // Determinar próximo vencimento mais próximo
  const nextDueDateInfo = React.useMemo(() => {
    if (activeCardsInfo.length === 0) return null;

    // Prioriza faturas pendentes (não pagas com valor > 0)
    const pendingInvoices = activeCardsInfo.filter(item => !item.info.isPaid && item.info.totalAmount > 0);
    const candidates = pendingInvoices.length > 0 ? pendingInvoices : activeCardsInfo;

    let earliest: { day: number; month: number; daysLeft: number } | null = null;
    let minDays = Infinity;

    candidates.forEach(item => {
      const diff = item.info.daysUntilDue;
      if (diff < minDays) {
        minDays = diff;
        earliest = {
          day: item.info.dueDay,
          month: item.info.dueMonth,
          daysLeft: diff,
        };
      }
    });

    if (!earliest) return null;

    return `${(earliest as any).day} de ${MONTH_NAMES[(earliest as any).month - 1]}`;
  }, [activeCardsInfo]);

  const handleOpenHeroClick = () => {
    // Abre a tela consolidada de todos os cartões, com o mês correspondente à fatura ativa/pendente
    const priority = activeCardsInfo.find(item => !item.info.isPaid && item.info.totalAmount > 0) || activeCardsInfo[0];
    onOpenInvoices(null, priority?.info.monthOffset);
  };

  // Se o usuário ainda não tiver nenhum cartão cadastrado
  if (creditCards.length === 0) {
    return (
      <div
        className="card-sobra"
        onClick={onAddNewCard}
        style={{
          position: 'relative',
          padding: '22px 20px',
          background: 'linear-gradient(150deg, #141c16 0%, #0d120f 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderTop: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '24px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        {/* Ambient Glow sutil */}
        <div
          style={{
            position: 'absolute',
            top: '-35px',
            right: '-35px',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            backgroundColor: 'rgba(74, 222, 128, 0.10)',
            filter: 'blur(35px)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              backgroundColor: 'rgba(74, 222, 128, 0.12)',
              color: '#4ADE80',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CreditCard size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
              Cadastrar Cartão de Crédito
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
              Acompanhe suas faturas e limites estilo carteira
            </p>
          </div>
        </div>
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: '#1A231C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4ADE80',
            position: 'relative',
          }}
        >
          <Plus size={18} />
        </div>
      </div>
    );
  }

  // Pegamos até 3 cartões para compor a pilha visual da carteira
  const stackCards = creditCards.slice(0, 3);
  const stackCount = stackCards.length;

  // Altura visível de cada aba de cartão na pilha
  const STRIP_HEIGHT = stackCount > 2 ? 30 : 34;
  const BASE_TOP = 8;
  const pocketEdgeY = BASE_TOP + stackCount * STRIP_HEIGHT;
  const stackContainerHeight = pocketEdgeY + 16;

  // Paleta de contraste para cor do texto e dígitos do cartão
  const getCardTextColor = (bgColor: string) => {
    const hex = bgColor.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 155 ? '#0F172A' : '#FFFFFF';
    }
    return '#FFFFFF';
  };

  return (
    <div
      className="card-sobra"
      onClick={handleOpenHeroClick}
      style={{
        position: 'relative',
        background: 'linear-gradient(150deg, #131a15 0%, #0d120f 100%)',
        borderRadius: '26px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderTop: '1px solid rgba(255, 255, 255, 0.14)',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.55)',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {/* Ambient Glow sutil na carteira */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '150px',
          height: '150px',
          borderRadius: '50%',
          backgroundColor: 'rgba(74, 222, 128, 0.09)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      {/* ─────────────────────────────────────────────────────────────
          1. ESTRUTURA DA CARTEIRA: CARTÕES EMPILHADOS NO TOPO
         ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          height: `${stackContainerHeight}px`,
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {stackCards.map((card, idx) => {
          const cardTop = BASE_TOP + idx * STRIP_HEIGHT;
          const bankInfo = getBankById(card.bankId);
          const cardColor = card.color || bankInfo?.color || (card.bankId === 'inter' ? '#FF7A00' : card.bankId === 'nubank' ? '#820AD1' : '#22C55E');
          const textColor = bankInfo?.textColor || getCardTextColor(cardColor);
          const zIndex = idx + 1;
          const displayName = card.name || bankInfo?.shortName || bankInfo?.name || 'Cartão';

          return (
            <div
              key={card.id}
              style={{
                position: 'absolute',
                top: `${cardTop}px`,
                left: '14px',
                right: '14px',
                height: '62px',
                borderRadius: '14px 14px 0 0',
                backgroundColor: cardColor,
                backgroundImage: `linear-gradient(135deg, ${cardColor} 0%, rgba(0, 0, 0, 0.22) 100%)`,
                boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.25)',
                zIndex,
                boxSizing: 'border-box',
                borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
                borderRight: '1px solid rgba(255, 255, 255, 0.12)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: `${STRIP_HEIGHT}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 12px',
                  boxSizing: 'border-box',
                }}
              >
                {/* Lado Esquerdo: Logo do Banco + Nome sempre visíveis */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <BankLogo bankId={card.bankId} size={20} style={{ boxShadow: 'none' }} />
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: textColor,
                      letterSpacing: '-0.01em',
                      textTransform: 'capitalize',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {displayName.length > 20 ? `${displayName.slice(0, 20)}...` : displayName}
                  </span>
                </div>

                {/* Lado Direito: Final do cartão opcional */}
                {(() => {
                  const digits = extractCardLastDigits(card);
                  if (!digits) return null;
                  return (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: textColor,
                        opacity: 0.92,
                        fontFamily: 'monospace',
                        letterSpacing: '0.04em',
                        flexShrink: 0,
                      }}
                    >
                      <span>••••</span>
                      <span>{digits}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}

        {/* Recorte curvo frontal do bolso da carteira (Thumb notch) */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '24px',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <svg
            viewBox="0 0 360 24"
            fill="none"
            preserveAspectRatio="none"
            style={{ width: '100%', height: '24px', display: 'block' }}
          >
            <path
              d="M0 8 L140 8 C158 8 164 22 180 22 C196 22 202 8 220 8 L360 8 L360 24 L0 24 Z"
              fill="#111713"
            />
            <path
              d="M0 8 L140 8 C158 8 164 22 180 22 C196 22 202 8 220 8 L360 8"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="1.2"
              fill="none"
            />
          </svg>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. INFORMAÇÕES DE FATURA: TOTAL E VENCIMENTO (FIEL AO PIERRE)
         ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '12px 20px 16px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#111713',
          position: 'relative',
          zIndex: 11,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span
              style={{
                fontSize: '0.82rem',
                color: '#94A3B8',
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              Total em faturas
            </span>

            <div
              style={{
                fontSize: '1.85rem',
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-0.03em',
                lineHeight: 1.2,
                marginTop: '4px',
                fontFamily: "'Outfit', 'Inter', sans-serif",
              }}
            >
              {maskValue(formatBrlCurrency(userTotalInvoices))}
            </div>

            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '0.8rem',
                color: '#94A3B8',
                fontWeight: 400,
              }}
            >
              {nextDueDateInfo ? (
                <>
                  Próximo vencimento: <strong style={{ color: '#E2E8F0' }}>{nextDueDateInfo}</strong>
                </>
              ) : (
                'Nenhuma fatura pendente'
              )}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              color: '#94A3B8',
              transition: 'transform 0.2s',
            }}
          >
            <ChevronRight size={18} />
          </div>
        </div>
      </div>
    </div>
  );
};
