import React, { useState, useMemo, useRef } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { SubscriptionLogo } from './SubscriptionLogo';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { getSubscriptionBillingDay } from '../../core/subscriptions/recurrenceDetector';
import { Transaction, Subscription, SubscriptionCadence } from '../../core/types';
import { X, Search, Sparkles, Check, PlusCircle, Plus, ChevronRight } from 'lucide-react';
import { BankLogo } from '../common/BankLogo';

interface SubscriptionTransactionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscriptionCreated?: (sub: Subscription) => void;
  onOpenManualSubscription: () => void;
}

export const SubscriptionTransactionPickerModal: React.FC<SubscriptionTransactionPickerModalProps> = ({
  isOpen,
  onClose,
  onSubscriptionCreated,
  onOpenManualSubscription,
}) => {
  const { transactions, accounts, categories, subscriptions, subscriptionSuggestions, saveSubscription, saveTransaction, isPrivacyMode } = useFinance();
  const { colors } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Swipe / Drag to dismiss para transformar em gaveta tátil moderna
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetTouchStartY = useRef<number | null>(null);

  const handleSheetPointerDown = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // noop
    }
    sheetTouchStartY.current = e.clientY;
  };

  const handleSheetPointerMove = (e: React.PointerEvent) => {
    if (sheetTouchStartY.current === null) return;
    const deltaY = e.clientY - sheetTouchStartY.current;
    if (deltaY > 0) {
      setSheetDragY(deltaY);
    }
  };

  const handleSheetPointerUp = (e: React.PointerEvent) => {
    if (sheetTouchStartY.current === null) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // noop
    }
    if (sheetDragY > 75) {
      onClose();
    }
    setSheetDragY(0);
    sheetTouchStartY.current = null;
  };

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);

  // Apenas despesas confirmadas
  const expenseTransactions = useMemo(() => {
    return transactions.filter(t => t.type === 'expense' && t.amount > 0);
  }, [transactions]);

  // Filtragem por busca e conta/cartão
  const filteredTransactions = useMemo(() => {
    return expenseTransactions.filter(tx => {
      if (selectedAccountId !== 'all' && tx.accountId !== selectedAccountId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const desc = (tx.description || '').toLowerCase();
        const cat = categoryMap.get(tx.categoryId)?.name.toLowerCase() || '';
        const acc = accountMap.get(tx.accountId)?.name.toLowerCase() || '';
        if (!desc.includes(q) && !cat.includes(q) && !acc.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [expenseTransactions, selectedAccountId, searchQuery, categoryMap, accountMap]);

  const selectedSuggestion = useMemo(() => {
    if (!selectedSuggestionId) return null;
    return subscriptionSuggestions.find(s => s.id === selectedSuggestionId) || null;
  }, [selectedSuggestionId, subscriptionSuggestions]);

  const selectedTx = useMemo(() => {
    if (!selectedTxId) return null;
    return expenseTransactions.find(t => t.id === selectedTxId) || null;
  }, [selectedTxId, expenseTransactions]);

  const selectedItemSummary = useMemo(() => {
    if (selectedSuggestion) {
      return {
        name: selectedSuggestion.merchantName,
        amount: selectedSuggestion.amount,
      };
    }
    if (selectedTx) {
      return {
        name: selectedTx.description,
        amount: selectedTx.amount,
      };
    }
    return null;
  }, [selectedSuggestion, selectedTx]);

  if (!isOpen) return null;

  const maskValue = (val: string) => (isPrivacyMode ? '••••••' : val);

  const handleSelectTransaction = (txId: string) => {
    if (selectedTxId === txId) {
      setSelectedTxId(null);
    } else {
      setSelectedTxId(txId);
      setSelectedSuggestionId(null);
    }
  };

  const handleSelectSuggestion = (suggId: string) => {
    if (selectedSuggestionId === suggId) {
      setSelectedSuggestionId(null);
    } else {
      setSelectedSuggestionId(suggId);
      setSelectedTxId(null);
    }
  };

  const handleConfirmAsSubscription = async () => {
    if (isSubmitting) return;

    // Se selecionou uma sugestão automática
    if (selectedSuggestionId) {
      const sugg = subscriptionSuggestions.find(s => s.id === selectedSuggestionId);
      if (!sugg) return;

      setIsSubmitting(true);
      try {
        const normName = (sugg.merchantName || '').toLowerCase().trim();
        const existingSub = subscriptions.find(s => {
          if (s.type === 'income') return false;
          const sNorm = (s.name || '').toLowerCase().trim();
          const isMatch = sNorm === normName || (sNorm.length >= 3 && normName.length >= 3 && (sNorm.includes(normName) || normName.includes(sNorm)));
          if (!isMatch) return false;
          if (sugg.accountId && s.accountId && s.accountId !== sugg.accountId) return false;
          return true;
        });

        const billingDay = getSubscriptionBillingDay({
          dayOfMonth: sugg.dayOfMonth,
          lastChargeDate: sugg.lastDate,
          nextBillingDate: sugg.nextBillingDate,
        });

        const created = await saveSubscription({
          id: existingSub?.id,
          name: existingSub?.name || sugg.merchantName,
          amount: sugg.amount,
          categoryId: sugg.categoryId,
          accountId: sugg.accountId,
          cadence: sugg.cadence,
          dayOfMonth: billingDay,
          nextBillingDate: sugg.nextBillingDate,
          status: 'active',
          lastChargeDate: sugg.lastDate,
          previousAmount: sugg.previousAmount,
        });

        onSubscriptionCreated?.(created);
        onClose();
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Se selecionou uma transação do extrato
    if (!selectedTxId) return;
    const tx = expenseTransactions.find(t => t.id === selectedTxId);
    if (!tx) return;

    setIsSubmitting(true);
    try {
      const txDate = new Date(tx.date);
      const billingDay = !isNaN(txDate.getTime()) ? txDate.getUTCDate() : 1;

      // Calcular próxima data de cobrança (30 dias à frente a partir da data da transação ou do dia do mês)
      const nextDate = new Date(txDate);
      nextDate.setDate(nextDate.getDate() + 30);

      // Se a próxima data for no passado em relação a hoje, projetar para o próximo mês
      const today = new Date();
      while (nextDate.getTime() <= today.getTime()) {
        nextDate.setDate(nextDate.getDate() + 30);
      }

      const cadence: SubscriptionCadence = 'monthly';

      const normDesc = (tx.description || '').toLowerCase().trim();
      const existingSub = subscriptions.find(s => {
        if (s.type === 'income') return false;
        const sNorm = (s.name || '').toLowerCase().trim();
        const isMatch = sNorm === normDesc || (sNorm.length >= 3 && normDesc.length >= 3 && (sNorm.includes(normDesc) || normDesc.includes(sNorm)));
        if (!isMatch) return false;
        if (tx.accountId && s.accountId && s.accountId !== tx.accountId) return false;
        return true;
      });

      const created = await saveSubscription({
        id: existingSub?.id,
        name: existingSub?.name || tx.description,
        amount: tx.amount,
        categoryId: tx.categoryId,
        accountId: tx.accountId,
        cadence,
        dayOfMonth: billingDay,
        nextBillingDate: nextDate.toISOString().substring(0, 10),
        status: 'active',
        lastChargeDate: tx.date,
      });

      // Atualiza a transação original para vincular diretamente à assinatura
      await saveTransaction({
        ...tx,
        isRecurring: true,
        recurringCadence: cadence,
        recurringDayOfMonth: billingDay,
        subscriptionId: created.id,
      });

      onSubscriptionCreated?.(created);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isButtonEnabled = !!selectedTxId || !!selectedSuggestionId;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          height: '92vh',
          maxHeight: '92vh',
          margin: '0 auto',
          backgroundColor: '#0A0B0D',
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.8)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          transform: sheetDragY > 0 ? `translateY(${sheetDragY}px)` : 'none',
          transition: sheetDragY > 0 ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Puxador Superior de Arraste (Pull Handle para Drag to Dismiss) */}
        <div
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={handleSheetPointerUp}
          onPointerCancel={handleSheetPointerUp}
          style={{
            padding: '12px 20px 6px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '42px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: 'rgba(255, 255, 255, 0.28)',
            }}
          />
        </div>

        {/* Barra Superior com Título e Botão "+ Criar manual" */}
        <div
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={handleSheetPointerUp}
          onPointerCancel={handleSheetPointerUp}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '2px 20px 14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            flexShrink: 0,
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          <h1
            style={{
              fontSize: '1.24rem',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Assinaturas
          </h1>

          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onClose();
              onOpenManualSubscription();
            }}
            style={{
              padding: '7px 13px',
              borderRadius: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#FFFFFF',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
            }}
          >
            <PlusCircle size={14} />
            <span>Criar manual</span>
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px 120px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Campo de Busca */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={17}
              color="#6B7280"
              style={{ position: 'absolute', left: '16px', pointerEvents: 'none' }}
            />
            <input
              type="text"
              placeholder="Buscar transação por nome ou valor..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px 12px 42px',
                borderRadius: '20px',
                backgroundColor: '#121418',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'border-color 0.15s ease, background-color 0.15s ease',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)';
                e.currentTarget.style.backgroundColor = '#161920';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.backgroundColor = '#121418';
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpar busca"
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtro por Cartão / Conta */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              flexShrink: 0,
              padding: '2px 0 6px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedAccountId('all')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '7px 14px',
                minHeight: '34px',
                borderRadius: '18px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: selectedAccountId === 'all' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.07)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                backgroundColor: selectedAccountId === 'all' ? 'rgba(255, 255, 255, 0.15)' : '#14171D',
                color: selectedAccountId === 'all' ? '#FFFFFF' : '#94A3B8',
                transition: 'all 0.15s ease',
              }}
            >
              Todos os cartões
            </button>
            {accounts.map(acc => {
              const isSelected = selectedAccountId === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setSelectedAccountId(acc.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '7px 14px',
                    minHeight: '34px',
                    borderRadius: '18px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: isSelected ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.07)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.15)' : '#14171D',
                    color: isSelected ? '#FFFFFF' : '#94A3B8',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <BankLogo bankId={acc.bankId || acc.name} size={15} />
                  <span>{acc.name}</span>
                </button>
              );
            })}
          </div>

          {/* Título explicativo logo acima das transações/sugestões */}
          <div style={{ paddingLeft: '2px', marginBottom: '-4px' }}>
            <p
              style={{
                fontSize: '0.84rem',
                color: '#9CA3AF',
                fontWeight: 500,
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              Escolha uma transação do extrato para acompanhar
            </p>
          </div>

          {/* Sugestões Automáticas Detectadas (se existirem) */}
          {subscriptionSuggestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 600, paddingLeft: '2px' }}>
                <Sparkles size={13} color="#4ADE80" />
                <span>Sugestões detectadas no seu histórico</span>
              </div>
              {subscriptionSuggestions.map(sugg => {
                const isSelected = selectedSuggestionId === sugg.id;
                const cat = categoryMap.get(sugg.categoryId);
                const acc = sugg.accountId ? accountMap.get(sugg.accountId) : null;
                const lastDateStr = sugg.lastDate
                  ? new Date(sugg.lastDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
                  : '';

                return (
                  <div
                    key={sugg.id}
                    onClick={() => handleSelectSuggestion(sugg.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid #4ADE80' : '1px solid rgba(255, 255, 255, 0.07)',
                      backgroundColor: isSelected ? 'rgba(74, 222, 128, 0.08)' : '#12151B',
                      boxShadow: isSelected ? '0 4px 16px rgba(74, 222, 128, 0.1)' : 'none',
                      transition: 'all 0.15s ease',
                      gap: '12px',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#171B22';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#12151B';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <SubscriptionLogo
                        name={sugg.merchantName}
                        category={cat}
                        bankId={acc?.bankId || acc?.name}
                        size={42}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '0.94rem',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {sugg.merchantName}
                        </div>
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: '#8E8E93',
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cat?.name || 'Recorrente'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                        }}
                      >
                        <span style={{ fontSize: '0.96rem', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                          {maskValue(formatBrlCurrency(sugg.amount))}
                        </span>
                        {lastDateStr && (
                          <span style={{ fontSize: '0.72rem', color: '#8E8E93', marginTop: '2px', whiteSpace: 'nowrap' }}>
                            {lastDateStr}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <div
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            backgroundColor: '#4ADE80',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#000000',
                            flexShrink: 0,
                            animation: 'fadeIn 0.15s ease',
                          }}
                        >
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Lista de Transações para Escolha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748B', margin: '4px 0 2px', paddingLeft: '2px' }}>
              Transações recentes ({filteredTransactions.length})
            </div>

            {filteredTransactions.length === 0 ? (
              <div
                style={{
                  padding: '36px 16px',
                  textAlign: 'center',
                  color: '#6B7280',
                  fontSize: '0.88rem',
                }}
              >
                Nenhuma transação encontrada com esses critérios.
              </div>
            ) : (
              filteredTransactions.slice(0, 40).map(tx => {
                const isSelected = selectedTxId === tx.id;
                const cat = categoryMap.get(tx.categoryId);
                const acc = accountMap.get(tx.accountId);
                const dateStr = new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

                return (
                  <div
                    key={tx.id}
                    onClick={() => handleSelectTransaction(tx.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid #FFFFFF' : '1px solid rgba(255, 255, 255, 0.06)',
                      backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : '#111419',
                      transition: 'all 0.15s ease',
                      gap: '12px',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#161920';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#111419';
                    }}
                  >
                    {/* Lado Esquerdo: Logo da Assinatura com Badge Bancário */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <SubscriptionLogo
                        name={tx.description}
                        category={cat}
                        bankId={acc?.bankId || acc?.name}
                        size={42}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '0.94rem',
                            fontWeight: 600,
                            color: '#FFFFFF',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {tx.description}
                        </div>
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: '#8E8E93',
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cat?.name || 'Geral'}
                        </div>
                      </div>
                    </div>

                    {/* Lado Direito: Valor, Data e Check se selecionado */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.96rem',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            whiteSpace: 'nowrap',
                            fontFamily: "'Outfit', 'Inter', sans-serif",
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {maskValue(formatBrlCurrency(tx.amount))}
                        </span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: '#8E8E93',
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {dateStr}
                        </span>
                      </div>
                      {isSelected && (
                        <div
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            backgroundColor: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#000000',
                            flexShrink: 0,
                            animation: 'fadeIn 0.15s ease',
                          }}
                        >
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Opção para Cadastro Manual ao Final do Feed */}
          <div style={{ padding: '6px 0 24px' }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenManualSubscription();
              }}
              style={{
                width: '100%',
                padding: '13px 16px',
                borderRadius: '16px',
                backgroundColor: '#111419',
                border: '1px dashed rgba(255, 255, 255, 0.14)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#161920';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = '#111419';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  flexShrink: 0,
                }}
              >
                <Plus size={16} strokeWidth={2.5} />
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Cadastrar manualmente
                </div>
                <div
                  style={{
                    fontSize: '0.74rem',
                    color: '#8E8E93',
                    marginTop: '2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Não encontrou no extrato?
                </div>
              </div>

              <ChevronRight size={16} color="#6B7280" style={{ flexShrink: 0 }} />
            </button>
          </div>
        </div>

        {/* Rodapé Fixo com Botão "Marcar como assinatura" com zIndex elevado (impede vazamento de ícones) */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            padding: '16px 20px 24px',
            background: 'linear-gradient(to top, #0A0B0D 75%, rgba(10, 11, 13, 0.94) 88%, rgba(10, 11, 13, 0) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}
        >
          <button
            type="button"
            disabled={!isButtonEnabled || isSubmitting}
            onClick={handleConfirmAsSubscription}
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '16px',
              borderRadius: '28px',
              backgroundColor: isButtonEnabled ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)',
              color: isButtonEnabled ? '#000000' : '#6B7280',
              fontSize: '0.98rem',
              fontWeight: 700,
              border: isButtonEnabled ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
              cursor: isButtonEnabled ? 'pointer' : 'not-allowed',
              transition: 'all 0.18s ease',
              boxShadow: isButtonEnabled ? '0 6px 24px rgba(255, 255, 255, 0.18)' : 'none',
              transform: isButtonEnabled ? 'translateY(-1px)' : 'none',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {isSubmitting ? 'Salvando...' : 'Marcar como assinatura'}
          </button>
        </div>
      </div>
    </div>
  );
};
