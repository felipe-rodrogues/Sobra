import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { SubscriptionLogo } from './SubscriptionLogo';
import { formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { Transaction, Subscription, SubscriptionCadence } from '../../core/types';
import { X, Search, Sparkles, Check, PlusCircle } from 'lucide-react';
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
  const { transactions, accounts, categories, subscriptionSuggestions, saveSubscription, isPrivacyMode } = useFinance();
  const { colors } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  if (!isOpen) return null;

  const maskValue = (val: string) => (isPrivacyMode ? '••••••' : val);

  const handleSelectTransaction = (txId: string) => {
    setSelectedTxId(txId);
    setSelectedSuggestionId(null);
  };

  const handleSelectSuggestion = (suggId: string) => {
    setSelectedSuggestionId(suggId);
    setSelectedTxId(null);
  };

  const handleConfirmAsSubscription = async () => {
    if (isSubmitting) return;

    // Se selecionou uma sugestão automática
    if (selectedSuggestionId) {
      const sugg = subscriptionSuggestions.find(s => s.id === selectedSuggestionId);
      if (!sugg) return;

      setIsSubmitting(true);
      try {
        const created = await saveSubscription({
          name: sugg.merchantName,
          amount: sugg.amount,
          categoryId: sugg.categoryId,
          accountId: sugg.accountId,
          cadence: sugg.cadence,
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
      // Calcular próxima data de cobrança (30 dias à frente a partir da data da transação ou do dia do mês)
      const txDate = new Date(tx.date);
      const nextDate = new Date(txDate);
      nextDate.setDate(nextDate.getDate() + 30);

      // Se a próxima data for no passado em relação a hoje, projetar para o próximo mês
      const today = new Date();
      while (nextDate.getTime() <= today.getTime()) {
        nextDate.setDate(nextDate.getDate() + 30);
      }

      const cadence: SubscriptionCadence = 'monthly';

      const created = await saveSubscription({
        name: tx.description,
        amount: tx.amount,
        categoryId: tx.categoryId,
        accountId: tx.accountId,
        cadence,
        nextBillingDate: nextDate.toISOString().substring(0, 10),
        status: 'active',
        lastChargeDate: tx.date,
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
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Barra Superior com Título Centralizado e Fechar X */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 14px',
            position: 'relative',
          }}
        >
          <div style={{ width: '40px' }} /> {/* Espaçador */}
          <h1
            style={{
              fontSize: '1.05rem',
              fontWeight: 600,
              color: '#FFFFFF',
              letterSpacing: '-0.01em',
              margin: 0,
              textAlign: 'center',
            }}
          >
            Assinaturas
          </h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 20px 100px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Título e Subtítulo Simplificados */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '4px 0 2px' }}>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#FFFFFF',
                lineHeight: 1.25,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Escolha uma transação
            </h2>
            <p
              style={{
                fontSize: '0.82rem',
                color: '#9CA3AF',
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              Selecione uma cobrança do extrato para definir como assinatura.
            </p>
          </div>

          {/* Campo de Busca */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={18}
              color="#6B7280"
              style={{ position: 'absolute', left: '16px', pointerEvents: 'none' }}
            />
            <input
              type="text"
              placeholder="Buscar transação"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px 14px 44px',
                borderRadius: '24px',
                backgroundColor: '#121418',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '14px',
                  background: 'none',
                  border: 'none',
                  color: '#9CA3AF',
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

          {/* Filtro por Cartão / Conta (sem cortes verticais e sem scrollbar invasiva) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              flexShrink: 0,
              padding: '4px 0 8px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedAccountId('all')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 16px',
                minHeight: '36px',
                borderRadius: '20px',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: selectedAccountId === 'all' ? '1px solid #FFFFFF' : '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                backgroundColor: selectedAccountId === 'all' ? '#FFFFFF' : '#14171D',
                color: selectedAccountId === 'all' ? '#000000' : '#9CA3AF',
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
                    gap: '8px',
                    padding: '8px 14px',
                    minHeight: '36px',
                    borderRadius: '20px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    border: isSelected ? '1px solid #FFFFFF' : '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.12)' : '#14171D',
                    color: isSelected ? '#FFFFFF' : '#9CA3AF',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <BankLogo bankId={acc.bankId || acc.name} size={16} />
                  <span>{acc.name}</span>
                </button>
              );
            })}
          </div>

          {/* Sugestões Automáticas Detectadas (se existirem) */}
          {subscriptionSuggestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#A3E635', fontSize: '0.78rem', fontWeight: 700 }}>
                <Sparkles size={14} />
                <span>Sugestões detectadas no seu histórico</span>
              </div>
              {subscriptionSuggestions.map(sugg => {
                const isSelected = selectedSuggestionId === sugg.id;
                const cat = categoryMap.get(sugg.categoryId);
                const acc = sugg.accountId ? accountMap.get(sugg.accountId) : null;

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
                      border: isSelected ? '1.5px solid #A3E635' : '1px solid rgba(163, 230, 53, 0.25)',
                      backgroundColor: isSelected ? 'rgba(163, 230, 53, 0.1)' : 'rgba(163, 230, 53, 0.04)',
                      transition: 'all 0.15s ease',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <SubscriptionLogo
                        name={sugg.merchantName}
                        category={cat}
                        bankId={acc?.bankId || acc?.name}
                        size={40}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '0.92rem',
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
                            color: '#9CA3AF',
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          Detectado ~a cada {sugg.intervalDays} dias{acc ? ` • ${acc.name}` : ''}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                        {maskValue(formatBrlCurrency(sugg.amount))}
                      </span>
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.3)',
                          backgroundColor: isSelected ? '#A3E635' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#000000',
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && <Check size={14} strokeWidth={3} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Lista de Transações para Escolha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6B7280', margin: '4px 0 2px' }}>
              Transações recentes ({filteredTransactions.length})
            </div>

            {filteredTransactions.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
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
                const dateStr = new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

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
                        size={40}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
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
                          {tx.description}
                        </div>
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: '#9CA3AF',
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {dateStr} • {cat?.name || 'Geral'}{acc ? ` • ${acc.name}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Lado Direito: Valor e Radio de Seleção */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                        {maskValue(formatBrlCurrency(tx.amount))}
                      </span>
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          border: isSelected ? 'none' : '2px solid rgba(255, 255, 255, 0.25)',
                          backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#000000',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected && <Check size={14} strokeWidth={3} />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Opção para Cadastro Manual */}
          <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenManualSubscription();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#9CA3AF',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                textDecoration: 'underline',
              }}
            >
              <PlusCircle size={14} />
              <span>Não encontrou? Cadastrar assinatura manualmente</span>
            </button>
          </div>
        </div>

        {/* Rodapé Fixo com Botão "Marcar como assinatura" Fiel ao Print */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px 24px 24px',
            background: 'linear-gradient(to top, #0A0B0D 80%, rgba(10, 11, 13, 0) 100%)',
            display: 'flex',
            justifyContent: 'center',
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
              backgroundColor: isButtonEnabled ? '#FFFFFF' : 'rgba(255, 255, 255, 0.2)',
              color: isButtonEnabled ? '#000000' : 'rgba(0, 0, 0, 0.4)',
              fontSize: '1rem',
              fontWeight: 700,
              border: 'none',
              cursor: isButtonEnabled ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s ease',
              boxShadow: isButtonEnabled ? '0 4px 18px rgba(255, 255, 255, 0.15)' : 'none',
            }}
          >
            {isSubmitting ? 'Salvando...' : 'Marcar como assinatura'}
          </button>
        </div>
      </div>
    </div>
  );
};
