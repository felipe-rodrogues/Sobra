import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BankLogo } from '../common/BankLogo';
import { useFinance } from '../../context/FinanceContext';
import { formatBrlCurrency, parseBrlCurrency, formatCurrencyInput } from '../../core/parsers/currencyHelper';
import { ArrowRight, ArrowLeftRight, ArrowUpDown, AlertCircle, X, ChevronDown, Check } from 'lucide-react';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from '../common/SwipeBackIndicator';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSourceAccountId?: string;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  initialSourceAccountId,
}) => {
  const { accounts, saveTransaction } = useFinance();
  const [mounted, setMounted] = useState(false);

  // Apenas contas bancárias e dinheiro podem ser origem/destino de transferências
  const validAccounts = accounts.filter(a => a.type !== 'credit_card');

  const [fromAccountId, setFromAccountId] = useState<string>(() => {
    return initialSourceAccountId || validAccounts[0]?.id || '';
  });
  const [toAccountId, setToAccountId] = useState<string>(() => {
    const defaultFrom = initialSourceAccountId || validAccounts[0]?.id || '';
    return validAccounts.find(a => a.id !== defaultFrom)?.id || '';
  });
  const [amountStr, setAmountStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>(() => {
    return new Date().toISOString().substring(0, 10);
  });
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isAmountFocused, setIsAmountFocused] = useState<boolean>(false);

  // Estado do dropdown customizado de contas ('from' | 'to' | null)
  const [openPicker, setOpenPicker] = useState<'from' | 'to' | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const fromPickerRef = useRef<HTMLDivElement>(null);
  const toPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    const isTransitionToOpen = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (!isOpen) return;
    if (!isTransitionToOpen) return;

    const today = new Date().toISOString().substring(0, 10);
    setDateStr(today);
    setAmountStr('');
    setDescription('');
    setOpenPicker(null);

    const defaultFrom = initialSourceAccountId || validAccounts[0]?.id || '';
    setFromAccountId(defaultFrom);

    const defaultTo = validAccounts.find(a => a.id !== defaultFrom)?.id || '';
    setToAccountId(defaultTo);

    // Auto-foco no valor ao abrir
    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [isOpen, initialSourceAccountId]);

  // Fechar dropdown customizado ao clicar fora
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        openPicker === 'from' &&
        fromPickerRef.current &&
        !fromPickerRef.current.contains(target)
      ) {
        setOpenPicker(null);
      }
      if (
        openPicker === 'to' &&
        toPickerRef.current &&
        !toPickerRef.current.contains(target)
      ) {
        setOpenPicker(null);
      }
    };

    if (openPicker) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [openPicker]);

  // Fechar no ESC (fecha dropdown primeiro se estiver aberto)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (openPicker) {
          setOpenPicker(null);
          e.stopPropagation();
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, openPicker]);

  const swipeState = useSwipeBack({ onBack: onClose, enabled: isOpen });

  if (!isOpen) return null;

  const sourceAccount = accounts.find(a => a.id === fromAccountId);
  const destinationAccount = accounts.find(a => a.id === toAccountId);

  const numericAmount = parseBrlCurrency(amountStr) || 0;
  const isInsufficientFunds = sourceAccount ? numericAmount > sourceAccount.balance : false;

  const handleTransferAll = () => {
    if (sourceAccount && sourceAccount.balance > 0) {
      setAmountStr(formatCurrencyInput(sourceAccount.balance));
      amountInputRef.current?.focus();
    }
  };

  const handleSwapAccounts = () => {
    const temp = fromAccountId;
    setFromAccountId(toAccountId);
    setToAccountId(temp);
    setOpenPicker(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromAccountId || !toAccountId) {
      alert('Selecione a conta de origem e a conta de destino.');
      return;
    }

    if (fromAccountId === toAccountId) {
      alert('A conta de origem e de destino devem ser diferentes.');
      return;
    }

    if (!numericAmount || numericAmount <= 0) {
      alert('Informe um valor válido para a transferência.');
      return;
    }

    if (isInsufficientFunds) {
      const proceed = confirm(
        `O saldo disponível na conta de origem (${formatBrlCurrency(sourceAccount?.balance || 0)}) é menor que o valor a transferir (${formatBrlCurrency(numericAmount)}). Deseja continuar mesmo assim?`
      );
      if (!proceed) return;
    }

    setIsSubmitting(true);
    try {
      await saveTransaction({
        accountId: fromAccountId,
        destinationAccountId: toAccountId,
        categoryId: 'cat-outros-desp',
        amount: numericAmount,
        type: 'transfer',
        description: description.trim() || `Transferência de ${sourceAccount?.name || 'Conta'} para ${destinationAccount?.name || 'Conta'}`,
        date: `${dateStr}T12:00:00.000Z`,
        status: 'confirmed',
        paymentMethod: 'pix',
        source: 'manual',
      });

      onClose();
    } catch (err) {
      console.error('Erro ao realizar transferência:', err);
      alert('Ocorreu um erro ao salvar a transferência.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <>
      <style>{`
        @keyframes dropdownSlideFade {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <SwipeBackIndicator swipeState={swipeState} />
      <div
        data-modal-backdrop="true"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 'calc(var(--safe-area-top, 0px) + 16px) max(16px, var(--safe-area-right, 0px)) calc(var(--safe-area-bottom, 0px) + 16px) max(16px, var(--safe-area-left, 0px))',
          boxSizing: 'border-box',
        }}
        onClick={onClose}
      >
        <div
          className="animate-slide-up"
          style={{
            backgroundColor: '#0A0E0C',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '440px',
            maxHeight: 'calc(100dvh - var(--safe-area-top, 0px) - var(--safe-area-bottom, 0px) - 32px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            overflow: 'visible',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header Superior Limpo */}
          <div
            style={{
              padding: '16px 20px 14px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#CBD5E1',
                }}
              >
                <ArrowLeftRight size={17} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF', margin: 0, letterSpacing: '-0.01em' }}>
                Transferência
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                color: '#94A3B8',
                backgroundColor: '#161F18',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#FFFFFF';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#94A3B8';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
              title="Fechar"
            >
              <X size={16} />
            </button>
          </div>

          {/* Conteúdo com rolagem se necessário */}
          <div style={{ padding: '18px 20px 22px', overflowY: 'auto' }}>
            {validAccounts.length < 2 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94A3B8',
                  }}
                >
                  <AlertCircle size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
                    Contas insuficientes
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#94A3B8', lineHeight: 1.45, maxWidth: '280px' }}>
                    São necessárias pelo menos duas contas (corrente ou carteira) cadastradas para realizar transferências.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    marginTop: '8px',
                    padding: '8px 20px',
                    borderRadius: '12px',
                    backgroundColor: '#FFFFFF',
                    color: '#0A0E0C',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Entendido
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Hero Input do Valor (Cápsula Interativa Refinada padrão Pierre) */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px 0 8px',
                    width: '100%',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.70rem',
                      color: '#94A3B8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      fontWeight: 600,
                      marginBottom: '8px',
                      textAlign: 'center',
                    }}
                  >
                    Valor da Transferência
                  </span>

                  <div
                    onClick={() => amountInputRef.current?.focus()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px 20px',
                      borderRadius: '16px',
                      backgroundColor: isAmountFocused
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(255, 255, 255, 0.03)',
                      border: isAmountFocused
                        ? '1px solid rgba(255, 255, 255, 0.25)'
                        : '1px solid rgba(255, 255, 255, 0.10)',
                      boxShadow: isAmountFocused ? '0 4px 20px rgba(0, 0, 0, 0.4)' : 'none',
                      transition: 'all 0.2s ease',
                      cursor: 'text',
                      gap: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: '#CBD5E1',
                        fontFamily: "'Outfit', 'Inter', sans-serif",
                        lineHeight: 1,
                        userSelect: 'none',
                      }}
                    >
                      R$
                    </span>
                    <input
                      ref={amountInputRef}
                      type="text"
                      inputMode="numeric"
                      required
                      placeholder="0,00"
                      value={amountStr}
                      onChange={e => setAmountStr(formatCurrencyInput(e.target.value, amountStr))}
                      onFocus={() => setIsAmountFocused(true)}
                      onBlur={() => setIsAmountFocused(false)}
                      autoFocus
                      style={{
                        width: `${Math.max(3, (amountStr || '0,00').length + 0.3)}ch`,
                        minWidth: '60px',
                        maxWidth: '220px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#FFFFFF',
                        fontSize: '2.1rem',
                        fontWeight: 800,
                        fontFamily: "'Outfit', 'Inter', sans-serif",
                        textAlign: 'center',
                        outline: 'none',
                        padding: 0,
                        margin: 0,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.1,
                      }}
                    />
                  </div>
                </div>

                {/* Card Unificado: Origem ➔ Destino */}
                <div
                  style={{
                    backgroundColor: '#121814',
                    borderRadius: '18px',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    position: 'relative',
                  }}
                >
                  {/* Origem (De) */}
                  <div
                    ref={fromPickerRef}
                    style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          fontSize: '0.70rem',
                          fontWeight: 700,
                          color: '#94A3B8',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        De (Origem)
                      </span>
                      {sourceAccount && sourceAccount.balance > 0 && (
                        <button
                          type="button"
                          onClick={handleTransferAll}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: '#94A3B8',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            textUnderlineOffset: '2px',
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                        >
                          Transferir tudo
                        </button>
                      )}
                    </div>

                    {/* Botão Seletor de Origem */}
                    <button
                      type="button"
                      onClick={() => setOpenPicker(prev => (prev === 'from' ? null : 'from'))}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '14px',
                        backgroundColor: openPicker === 'from' ? 'rgba(255, 255, 255, 0.08)' : '#161F18',
                        border: openPicker === 'from'
                          ? '1px solid rgba(255, 255, 255, 0.22)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        {sourceAccount ? (
                          <>
                            <BankLogo bankId={sourceAccount.bankId || sourceAccount.name} size={30} />
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '0.92rem',
                                  fontWeight: 600,
                                  color: '#FFFFFF',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {sourceAccount.name}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                                Disponível:{' '}
                                <span
                                  style={{
                                    color: sourceAccount.balance >= 0 ? '#FFFFFF' : '#F87171',
                                    fontWeight: 600,
                                  }}
                                >
                                  {formatBrlCurrency(sourceAccount.balance)}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.88rem', color: '#64748B' }}>Selecione a conta</span>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          color: '#94A3B8',
                          marginLeft: '8px',
                          flexShrink: 0,
                          transform: openPicker === 'from' ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                        }}
                      >
                        <ChevronDown size={16} />
                      </div>
                    </button>

                    {/* Dropdown Customizado Pierre: Lista de Contas de Origem */}
                    {openPicker === 'from' && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 6px)',
                          left: 0,
                          right: 0,
                          zIndex: 50,
                          backgroundColor: '#141D17',
                          borderRadius: '16px',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          boxShadow: '0 14px 34px -4px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                          padding: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          animation: 'dropdownSlideFade 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                          maxHeight: '220px',
                          overflowY: 'auto',
                        }}
                      >
                        <div
                          style={{
                            padding: '6px 10px 4px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: '#64748B',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                          }}
                        >
                          Selecione a conta de origem
                        </div>

                        {validAccounts.map(acc => {
                          const isSelected = acc.id === fromAccountId;
                          const isCurrentDest = acc.id === toAccountId;

                          return (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => {
                                if (isCurrentDest) {
                                  setToAccountId(fromAccountId);
                                }
                                setFromAccountId(acc.id);
                                setOpenPicker(null);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                borderRadius: '12px',
                                backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                border: isSelected ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                width: '100%',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={e => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                              }}
                              onMouseLeave={e => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <BankLogo bankId={acc.bankId || acc.name} size={30} />
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: '0.90rem',
                                      fontWeight: 600,
                                      color: '#FFFFFF',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {acc.name}
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                                    Saldo:{' '}
                                    <span style={{ color: acc.balance >= 0 ? '#FFFFFF' : '#F87171', fontWeight: 600 }}>
                                      {formatBrlCurrency(acc.balance)}
                                    </span>
                                    {isCurrentDest && (
                                      <span style={{ marginLeft: '6px', color: '#64748B', fontSize: '0.70rem' }}>
                                        (Destino atual)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {isSelected && (
                                <div
                                  style={{
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    backgroundColor: '#FFFFFF',
                                    color: '#0A0E0C',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    marginLeft: '8px',
                                  }}
                                >
                                  <Check size={13} strokeWidth={3} />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Conector Central com Botão de Inverter */}
                  <div
                    style={{
                      position: 'relative',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '2px 0',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        height: '1px',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSwapAccounts}
                      title="Inverter contas"
                      style={{
                        position: 'relative',
                        zIndex: 2,
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: '#161F18',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#94A3B8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = '#202B23';
                        e.currentTarget.style.color = '#FFFFFF';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = '#161F18';
                        e.currentTarget.style.color = '#94A3B8';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                      }}
                    >
                      <ArrowUpDown size={14} />
                    </button>
                  </div>

                  {/* Destino (Para) */}
                  <div
                    ref={toPickerRef}
                    style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}
                  >
                    <span
                      style={{
                        fontSize: '0.70rem',
                        fontWeight: 700,
                        color: '#94A3B8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      Para (Destino)
                    </span>

                    {/* Botão Seletor de Destino */}
                    <button
                      type="button"
                      onClick={() => setOpenPicker(prev => (prev === 'to' ? null : 'to'))}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '14px',
                        backgroundColor: openPicker === 'to' ? 'rgba(255, 255, 255, 0.08)' : '#161F18',
                        border: openPicker === 'to'
                          ? '1px solid rgba(255, 255, 255, 0.22)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        {destinationAccount ? (
                          <>
                            <BankLogo bankId={destinationAccount.bankId || destinationAccount.name} size={30} />
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '0.92rem',
                                  fontWeight: 600,
                                  color: '#FFFFFF',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {destinationAccount.name}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                                Saldo atual:{' '}
                                <span
                                  style={{
                                    color: destinationAccount.balance >= 0 ? '#FFFFFF' : '#F87171',
                                    fontWeight: 600,
                                  }}
                                >
                                  {formatBrlCurrency(destinationAccount.balance)}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.88rem', color: '#64748B' }}>Selecione a conta</span>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          color: '#94A3B8',
                          marginLeft: '8px',
                          flexShrink: 0,
                          transform: openPicker === 'to' ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                        }}
                      >
                        <ChevronDown size={16} />
                      </div>
                    </button>

                    {/* Dropdown Customizado Pierre: Lista de Contas de Destino */}
                    {openPicker === 'to' && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 6px)',
                          left: 0,
                          right: 0,
                          zIndex: 50,
                          backgroundColor: '#141D17',
                          borderRadius: '16px',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          boxShadow: '0 14px 34px -4px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                          padding: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          animation: 'dropdownSlideFade 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                          maxHeight: '220px',
                          overflowY: 'auto',
                        }}
                      >
                        <div
                          style={{
                            padding: '6px 10px 4px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: '#64748B',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                          }}
                        >
                          Selecione a conta de destino
                        </div>

                        {validAccounts.map(acc => {
                          const isSelected = acc.id === toAccountId;
                          const isCurrentOrigin = acc.id === fromAccountId;

                          return (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => {
                                if (isCurrentOrigin) {
                                  setFromAccountId(toAccountId);
                                }
                                setToAccountId(acc.id);
                                setOpenPicker(null);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                borderRadius: '12px',
                                backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                border: isSelected ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                width: '100%',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={e => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                              }}
                              onMouseLeave={e => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <BankLogo bankId={acc.bankId || acc.name} size={30} />
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: '0.90rem',
                                      fontWeight: 600,
                                      color: '#FFFFFF',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {acc.name}
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                                    Saldo:{' '}
                                    <span style={{ color: acc.balance >= 0 ? '#FFFFFF' : '#F87171', fontWeight: 600 }}>
                                      {formatBrlCurrency(acc.balance)}
                                    </span>
                                    {isCurrentOrigin && (
                                      <span style={{ marginLeft: '6px', color: '#64748B', fontSize: '0.70rem' }}>
                                        (Origem atual)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {isSelected && (
                                <div
                                  style={{
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    backgroundColor: '#FFFFFF',
                                    color: '#0A0E0C',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    marginLeft: '8px',
                                  }}
                                >
                                  <Check size={13} strokeWidth={3} />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Aviso Suave de Saldo Insuficiente */}
                {isInsufficientFunds && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '14px',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: '#F87171',
                      fontSize: '0.78rem',
                      lineHeight: 1.4,
                    }}
                  >
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>
                      O valor supera o saldo disponível na conta de origem ({formatBrlCurrency(sourceAccount?.balance || 0)}).
                    </span>
                  </div>
                )}

                {/* Campos Secundários: Data e Anotação com Alinhamento Perfeito */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* Coluna 1: Data */}
                  <div>
                    <div
                      style={{
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '6px',
                      }}
                    >
                      <label
                        htmlFor="transfer-date-input"
                        style={{
                          fontSize: '0.70rem',
                          fontWeight: 700,
                          color: '#94A3B8',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          margin: 0,
                          lineHeight: 1,
                        }}
                      >
                        Data
                      </label>
                    </div>
                    <input
                      id="transfer-date-input"
                      type="date"
                      required
                      value={dateStr}
                      onChange={e => setDateStr(e.target.value)}
                      style={{
                        width: '100%',
                        height: '42px',
                        padding: '0 12px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: '#161F18',
                        color: '#FFFFFF',
                        fontSize: '0.84rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        colorScheme: 'dark',
                      }}
                    />
                  </div>

                  {/* Coluna 2: Anotação */}
                  <div>
                    <div
                      style={{
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                      }}
                    >
                      <label
                        htmlFor="transfer-desc-input"
                        style={{
                          fontSize: '0.70rem',
                          fontWeight: 700,
                          color: '#94A3B8',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          margin: 0,
                          lineHeight: 1,
                        }}
                      >
                        Anotação
                      </label>
                      <span
                        style={{
                          fontSize: '0.66rem',
                          color: '#64748B',
                          fontWeight: 500,
                          lineHeight: 1,
                        }}
                      >
                        Opcional
                      </span>
                    </div>
                    <input
                      id="transfer-desc-input"
                      type="text"
                      placeholder="Ex: Reserva, Poupança"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      style={{
                        width: '100%',
                        height: '42px',
                        padding: '0 12px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: '#161F18',
                        color: '#FFFFFF',
                        fontSize: '0.84rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Botão de Confirmação Principal (CTA Premium Branco Pierre) */}
                <div style={{ marginTop: '4px' }}>
                  <button
                    type="submit"
                    disabled={isSubmitting || !numericAmount || numericAmount <= 0}
                    style={{
                      width: '100%',
                      height: '50px',
                      borderRadius: '16px',
                      backgroundColor: '#FFFFFF',
                      color: '#0A0E0C',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: isSubmitting || !numericAmount || numericAmount <= 0 ? 'not-allowed' : 'pointer',
                      opacity: isSubmitting || !numericAmount || numericAmount <= 0 ? 0.35 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.3)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <span>
                      {isSubmitting
                        ? 'Transferindo...'
                        : numericAmount > 0
                          ? `Transferir ${formatBrlCurrency(numericAmount)}`
                          : 'Confirmar Transferência'}
                    </span>
                    <ArrowRight size={16} strokeWidth={2.4} />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return mounted && typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
