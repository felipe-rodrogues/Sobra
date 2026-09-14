import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import { Button } from '../common/Button';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { Transaction, PaymentMethod, SubscriptionCadence } from '../../core/types';
import { parseBrlCurrency, formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { Repeat, Sparkles, Layers, FileText, Plus } from 'lucide-react';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Transaction | null;
  defaultType?: 'expense' | 'income';
  onOpenNewCategory?: () => void;
  zIndex?: number;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  initialData,
  defaultType = 'expense',
  onOpenNewCategory,
  zIndex,
}) => {
  const { 
    accounts, 
    categories, 
    subscriptions,
    saveTransaction,
    deleteTransaction,
    saveInstallmentPurchase,
    suggestCategoryForMerchant,
    checkIfLikelySubscription 
  } = useFinance();
  const { colors } = useTheme();

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit');
  const [dateStr, setDateStr] = useState('');
  const [hasManuallySelectedCategory, setHasManuallySelectedCategory] = useState(false);
  const [suggestedCategoryTag, setSuggestedCategoryTag] = useState<string | null>(null);

  // Estados de Assinatura Recorrente
  const [isSubscription, setIsSubscription] = useState(false);
  const [subscriptionCadence, setSubscriptionCadence] = useState<SubscriptionCadence>('monthly');
  const [proactiveSuggestion, setProactiveSuggestion] = useState<{
    isLikely: boolean;
    cadence: SubscriptionCadence;
    reason: string;
    serviceName?: string;
  } | null>(null);

  // Estados de Compra Parcelada
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);

  // Estado de Anotações / Observações Opcionais
  const [notes, setNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    if (initialData) {
      setType(initialData.type === 'income' ? 'income' : 'expense');
      setDescription(initialData.description);
      setAmountStr(initialData.amount.toString().replace('.', ','));
      setAccountId(initialData.accountId);
      setCategoryId(initialData.categoryId);
      setPaymentMethod(initialData.paymentMethod);
      setDateStr(initialData.date.substring(0, 10));
      setHasManuallySelectedCategory(true);
      setSuggestedCategoryTag(null);
      setIsInstallment(!!initialData.isInstallment);
      setInstallmentCount(initialData.installmentTotal || 2);
      setNotes(initialData.notes || '');
      setShowNotes(!!initialData.notes);

      // Verificar se essa transação corresponde a uma assinatura existente
      const normDesc = initialData.description.toLowerCase();
      const existingSub = subscriptions.find(s => {
        const sNorm = s.name.toLowerCase().trim();
        return normDesc.includes(sNorm) || sNorm.includes(normDesc);
      });
      setIsSubscription(!!existingSub);
      setSubscriptionCadence(existingSub?.cadence || 'monthly');
      
      if (!existingSub && initialData.type === 'expense') {
        const likely = checkIfLikelySubscription(initialData.description, initialData.amount);
        setProactiveSuggestion(likely.isLikely ? likely : null);
        if (likely.isLikely && likely.cadence) {
          setSubscriptionCadence(likely.cadence);
        }
      } else {
        setProactiveSuggestion(null);
      }
    } else {
      const initialType = defaultType || 'expense';
      setType(initialType);
      setDescription('');
      setAmountStr('');

      let defaultAcc = accounts.find(a => initialType === 'income' ? a.type !== 'credit_card' : a.type === 'credit_card') || accounts[0];
      let defaultPayment: PaymentMethod = initialType === 'income'
        ? (defaultAcc?.type === 'cash' ? 'cash' : 'pix')
        : (defaultAcc?.type === 'credit_card' ? 'credit' : defaultAcc?.type === 'cash' ? 'cash' : 'pix');

      setAccountId(defaultAcc?.id || '');
      setCategoryId(categories.find(c => c.type === initialType)?.id || categories[0]?.id || '');
      setPaymentMethod(defaultPayment);
      setDateStr(new Date().toISOString().substring(0, 10));
      setHasManuallySelectedCategory(false);
      setSuggestedCategoryTag(null);
      setIsSubscription(false);
      setSubscriptionCadence('monthly');
      setProactiveSuggestion(null);
      setIsInstallment(false);
      setInstallmentCount(2);
      setNotes('');
      setShowNotes(false);
    }
  }, [initialData, isOpen, defaultType, accounts, categories, subscriptions]);

  const handleDescriptionChange = (newDesc: string) => {
    setDescription(newDesc);
    if (!initialData && !hasManuallySelectedCategory && newDesc.trim().length >= 2) {
      const suggested = suggestCategoryForMerchant(newDesc);
      if (suggested && suggested.type === type) {
        setCategoryId(suggested.id);
        setSuggestedCategoryTag(suggested.name);
      }
    }
    if (!newDesc.trim()) {
      setSuggestedCategoryTag(null);
      setProactiveSuggestion(null);
      return;
    }

    // Avaliação proativa de recorrência / assinatura apenas para despesas
    if (type === 'expense') {
      const numAmount = parseBrlCurrency(amountStr) || undefined;
      const likely = checkIfLikelySubscription(newDesc, numAmount);
      if (likely.isLikely && !isSubscription) {
        setProactiveSuggestion(likely);
      } else {
        setProactiveSuggestion(null);
      }
    } else {
      setProactiveSuggestion(null);
    }
  };

  const selectedAccount = accounts.find(a => a.id === accountId);
  const isCardContext = paymentMethod === 'credit' || selectedAccount?.type === 'credit_card';

  const todayStr = new Date().toISOString().substring(0, 10);
  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().substring(0, 10);
  };
  const yesterdayStr = getYesterdayStr();

  const getAccountTypeLabel = (accType?: string) => {
    switch (accType) {
      case 'credit_card':
        return 'Cartão de Crédito';
      case 'checking':
        return 'Conta Corrente';
      case 'savings':
        return 'Poupança / Reserva';
      case 'cash':
        return 'Dinheiro / Carteira';
      case 'investment':
        return 'Investimentos';
      default:
        return 'Conta';
    }
  };

  const handleAccountChange = (newAccountId: string) => {
    setAccountId(newAccountId);
    const acc = accounts.find(a => a.id === newAccountId);
    if (acc?.type === 'credit_card') {
      setPaymentMethod('credit');
    } else {
      setIsInstallment(false);
      if (acc?.type === 'cash') {
        setPaymentMethod('cash');
      } else {
        if (paymentMethod === 'credit' || paymentMethod === 'cash') {
          setPaymentMethod('pix');
        }
      }
    }
  };

  const handleToggleInstallment = (checked: boolean) => {
    setIsInstallment(checked);
    if (checked) {
      setIsSubscription(false);
      setProactiveSuggestion(null);
      setPaymentMethod('credit');
    }
  };

  const handleToggleSubscription = (checked: boolean) => {
    setIsSubscription(checked);
    if (checked) {
      setIsInstallment(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseBrlCurrency(amountStr);
    if (!numericAmount || numericAmount <= 0) {
      alert('Por favor, informe um valor válido maior que zero.');
      return;
    }
    if (!description.trim()) {
      alert('Por favor, informe uma descrição ou estabelecimento.');
      return;
    }
    if (!accountId) {
      alert('Por favor, selecione uma conta bancária.');
      return;
    }
    if (!categoryId) {
      alert('Por favor, selecione uma categoria.');
      return;
    }

    // Garantir que a forma de pagamento seja coerente com a conta
    let finalPaymentMethod: PaymentMethod = paymentMethod;
    if (type === 'income') {
      if (selectedAccount?.type === 'cash') {
        finalPaymentMethod = 'cash';
      } else if (finalPaymentMethod === 'credit') {
        finalPaymentMethod = 'pix';
      }
    } else {
      if (selectedAccount?.type === 'credit_card' || isInstallment) {
        finalPaymentMethod = 'credit';
      } else if (selectedAccount?.type === 'cash') {
        finalPaymentMethod = 'cash';
      }
    }

    // Se for uma nova compra parcelada no cartão
    if (!initialData && isInstallment && type === 'expense' && selectedAccount?.type === 'credit_card' && installmentCount > 1) {
      await saveInstallmentPurchase({
        accountId,
        categoryId,
        description: description.trim(),
        totalAmount: numericAmount,
        installmentCount,
        startDate: `${dateStr}T12:00:00.000Z`,
        notes: notes.trim() || undefined,
      });
    } else {
      await saveTransaction({
        id: initialData?.id,
        accountId,
        categoryId,
        amount: numericAmount,
        type,
        description: description.trim(),
        date: `${dateStr}T12:00:00.000Z`,
        status: 'confirmed',
        paymentMethod: finalPaymentMethod,
        source: initialData?.source || 'manual',
        notes: notes.trim() || null,
      }, isSubscription && type === 'expense' ? { cadence: subscriptionCadence } : undefined);
    }

    onClose();
  };

  const filteredCategories = categories.filter(c => c.type === type);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      zIndex={zIndex}
      title={initialData ? 'Editar Transação' : 'Nova Transação'}
      subtitle={initialData ? 'Altere os dados deste lançamento' : 'Cadastre uma receita ou despesa no seu controle'}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Toggle Tipo: Despesa / Receita */}
        <div
          style={{
            display: 'flex',
            backgroundColor: colors.surfaceElevated,
            borderRadius: '12px',
            padding: '4px',
            border: `1px solid ${colors.border}`,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setType('expense');
              const firstExp = categories.find(c => c.type === 'expense');
              if (firstExp) setCategoryId(firstExp.id);
              const cardAcc = accounts.find(a => a.type === 'credit_card');
              if (cardAcc && selectedAccount?.type !== 'credit_card') {
                handleAccountChange(cardAcc.id);
              }
            }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              backgroundColor: type === 'expense' ? colors.expense : 'transparent',
              color: type === 'expense' ? '#FFFFFF' : colors.textSecondary,
            }}
          >
            Despesa
          </button>
          <button
            type="button"
            onClick={() => {
              setType('income');
              setIsInstallment(false);
              setIsSubscription(false);
              setProactiveSuggestion(null);
              const firstInc = categories.find(c => c.type === 'income');
              if (firstInc) setCategoryId(firstInc.id);
              const nonCard = accounts.find(a => a.type !== 'credit_card');
              if (nonCard && selectedAccount?.type === 'credit_card') {
                handleAccountChange(nonCard.id);
              } else if (paymentMethod === 'credit') {
                setPaymentMethod('pix');
              }
            }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              backgroundColor: type === 'income' ? colors.income : 'transparent',
              color: type === 'income' ? '#FFFFFF' : colors.textSecondary,
            }}
          >
            Receita
          </button>
        </div>

        {/* Conta Bancária / Cartão (Posicionado no topo para definir o contexto imediatamente) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            {type === 'expense' ? 'Conta Bancária / Cartão *' : 'Receber em (Conta / Carteira) *'}
          </label>
          <select
            value={accountId}
            onChange={e => handleAccountChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.95rem',
            }}
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({getAccountTypeLabel(acc.type)})
              </option>
            ))}
          </select>
        </div>

        {/* Valor */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Valor (R$) *
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '14px', fontWeight: 700, color: type === 'expense' ? colors.expense : colors.income }}>
              R$
            </span>
            <input
              type="text"
              required
              placeholder="0,00"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px 12px 42px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceElevated,
                color: colors.textPrimary,
                fontSize: '1.25rem',
                fontWeight: 700,
              }}
            />
          </div>
        </div>

        {/* Opção: Compra Parcelada no Cartão de Crédito (Apenas se a conta for Cartão de Crédito) */}
        {type === 'expense' && selectedAccount?.type === 'credit_card' && !isSubscription && !initialData && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: isInstallment ? 'rgba(56, 189, 248, 0.08)' : colors.surfaceElevated,
              border: `1px solid ${isInstallment ? '#38BDF8' : colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'all 0.2s ease',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={19} color={isInstallment ? '#38BDF8' : colors.textSecondary} />
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: colors.textPrimary }}>
                    Parcelar compra no cartão
                  </div>
                  <div style={{ fontSize: '0.72rem', color: colors.textSecondary }}>
                    {isInstallment 
                      ? 'Divida o valor informado em parcelas mensais na fatura' 
                      : 'Divida em 2x a 36x nas próximas faturas'}
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isInstallment}
                onChange={e => handleToggleInstallment(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#38BDF8', cursor: 'pointer' }}
              />
            </label>

            {isInstallment && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px', borderTop: `1px dashed ${colors.border}` }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: colors.textSecondary, marginBottom: '6px' }}>
                    Número de parcelas:
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {[2, 3, 4, 5, 6, 10, 12].map(n => (
                      <button
                        type="button"
                        key={n}
                        onClick={() => setInstallmentCount(n)}
                        style={{
                          padding: '5px 11px',
                          borderRadius: '8px',
                          border: installmentCount === n ? '2px solid #38BDF8' : `1px solid ${colors.border}`,
                          backgroundColor: installmentCount === n ? 'rgba(56, 189, 248, 0.2)' : colors.surface,
                          color: installmentCount === n ? '#38BDF8' : colors.textSecondary,
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {n}x
                      </button>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                      <input
                        type="number"
                        min="2"
                        max="36"
                        value={installmentCount}
                        onChange={e => setInstallmentCount(Math.max(2, Math.min(36, parseInt(e.target.value) || 2)))}
                        style={{
                          width: '54px',
                          padding: '5px 8px',
                          borderRadius: '8px',
                          border: `1px solid ${colors.border}`,
                          backgroundColor: colors.surface,
                          color: colors.textPrimary,
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          textAlign: 'center',
                        }}
                      />
                      <span style={{ fontSize: '0.78rem', color: colors.textSecondary }}>x</span>
                    </div>
                  </div>
                </div>

                {/* Resumo do Cálculo da Parcela em Tempo Real */}
                {(() => {
                  const num = parseBrlCurrency(amountStr) || 0;
                  const parcelVal = installmentCount > 0 ? (num / installmentCount) : 0;
                  return (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        backgroundColor: colors.surface,
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', color: colors.textSecondary }}>
                          Valor da parcela ({installmentCount}x):
                        </span>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#38BDF8' }}>
                          {formatBrlCurrency(parcelVal)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: colors.textMuted }}>
                        💳 <strong>{formatBrlCurrency(parcelVal)}</strong> na fatura deste mês • <strong>{formatBrlCurrency(num)}</strong> comprometidos do limite total
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Descrição */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Descrição / Estabelecimento *
          </label>
          <input
            type="text"
            required
            placeholder="Ex: Supermercado, Salário, Aluguel"
            value={description}
            onChange={e => handleDescriptionChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.95rem',
            }}
          />
        </div>

        {/* Categoria (posicionada logo após Descrição para reagir à sugestão inteligente) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', color: colors.textSecondary }}>
                Categoria *
              </label>
              {onOpenNewCategory && (
                <button
                  type="button"
                  onClick={onOpenNewCategory}
                  style={{
                    fontSize: '0.72rem',
                    color: colors.primary,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '0 2px',
                  }}
                  title="Criar nova categoria personalizada"
                >
                  <Plus size={12} /> Nova
                </button>
              )}
            </div>
            {suggestedCategoryTag && (
              <span style={{ fontSize: '0.75rem', color: colors.primary, fontWeight: 700 }}>
                ✨ Sugerida: {suggestedCategoryTag}
              </span>
            )}
          </div>
          <select
            value={categoryId}
            onChange={e => {
              setCategoryId(e.target.value);
              setHasManuallySelectedCategory(true);
              setSuggestedCategoryTag(null);
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.95rem',
            }}
          >
            {filteredCategories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>



        {/* Linha com Data e Meio de Pagamento (Inteligente e contextual) */}
        {selectedAccount?.type === 'checking' && !isInstallment ? (
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: colors.textSecondary }}>
                  Data *
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setDateStr(todayStr)}
                    style={{
                      padding: '2px 7px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: dateStr === todayStr ? 700 : 500,
                      backgroundColor: dateStr === todayStr ? 'rgba(56, 189, 248, 0.18)' : colors.surfaceElevated,
                      color: dateStr === todayStr ? '#38BDF8' : colors.textSecondary,
                      border: `1px solid ${dateStr === todayStr ? '#38BDF8' : colors.border}`,
                      cursor: 'pointer',
                    }}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateStr(yesterdayStr)}
                    style={{
                      padding: '2px 7px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: dateStr === yesterdayStr ? 700 : 500,
                      backgroundColor: dateStr === yesterdayStr ? 'rgba(56, 189, 248, 0.18)' : colors.surfaceElevated,
                      color: dateStr === yesterdayStr ? '#38BDF8' : colors.textSecondary,
                      border: `1px solid ${dateStr === yesterdayStr ? '#38BDF8' : colors.border}`,
                      cursor: 'pointer',
                    }}
                  >
                    Ontem
                  </button>
                </div>
              </div>
              <input
                type="date"
                required
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surfaceElevated,
                  color: colors.textPrimary,
                  fontSize: '0.95rem',
                }}
              />
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
                Meio de Pagamento
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surfaceElevated,
                  color: colors.textPrimary,
                  fontSize: '0.95rem',
                }}
              >
                <option value="pix">Pix</option>
                <option value="debit">Cartão de Débito</option>
                <option value="transfer">Transferência / TED</option>
                <option value="other">Boleto / Outro</option>
              </select>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: colors.textSecondary }}>
                Data *
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setDateStr(todayStr)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: dateStr === todayStr ? 700 : 500,
                    backgroundColor: dateStr === todayStr ? 'rgba(56, 189, 248, 0.18)' : colors.surfaceElevated,
                    color: dateStr === todayStr ? '#38BDF8' : colors.textSecondary,
                    border: `1px solid ${dateStr === todayStr ? '#38BDF8' : colors.border}`,
                    cursor: 'pointer',
                  }}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setDateStr(yesterdayStr)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: dateStr === yesterdayStr ? 700 : 500,
                    backgroundColor: dateStr === yesterdayStr ? 'rgba(56, 189, 248, 0.18)' : colors.surfaceElevated,
                    color: dateStr === yesterdayStr ? '#38BDF8' : colors.textSecondary,
                    border: `1px solid ${dateStr === yesterdayStr ? '#38BDF8' : colors.border}`,
                    cursor: 'pointer',
                  }}
                >
                  Ontem
                </button>
              </div>
            </div>
            <input
              type="date"
              required
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceElevated,
                color: colors.textPrimary,
                fontSize: '0.95rem',
              }}
            />
          </div>
        )}

        {/* Sugestão Proativa de Assinatura Detectada */}
        {type === 'expense' && proactiveSuggestion?.isLikely && !isSubscription && !isInstallment && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: `1px solid rgba(16, 185, 129, 0.3)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color={colors.primary} />
              <div style={{ fontSize: '0.8rem', color: colors.textPrimary }}>
                <strong>Sugestão Proativa:</strong> {proactiveSuggestion.reason}.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsSubscription(true);
                setIsInstallment(false);
                setSubscriptionCadence(proactiveSuggestion.cadence);
                setProactiveSuggestion(null);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: colors.primary,
                color: '#FFFFFF',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Sim, é assinatura
            </button>
          </div>
        )}

        {/* Opção: Definir como Assinatura Recorrente */}
        {type === 'expense' && !isInstallment && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: isSubscription ? 'rgba(16, 185, 129, 0.08)' : colors.surfaceElevated,
              border: `1px solid ${isSubscription ? colors.primary : colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Repeat size={18} color={isSubscription ? colors.primary : colors.textSecondary} />
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: colors.textPrimary }}>
                    Acompanhar como Assinatura Recorrente
                  </div>
                  <div style={{ fontSize: '0.72rem', color: colors.textSecondary }}>
                    Adiciona à aba de Assinaturas para cálculo de custo mensal e previsão
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isSubscription}
                onChange={e => handleToggleSubscription(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: colors.primary, cursor: 'pointer' }}
              />
            </label>

            {isSubscription && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '8px', borderTop: `1px dashed ${colors.border}` }}>
                <span style={{ fontSize: '0.8rem', color: colors.textSecondary }}>
                  Frequência da cobrança:
                </span>
                <select
                  value={subscriptionCadence}
                  onChange={e => setSubscriptionCadence(e.target.value as any)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surface,
                    color: colors.textPrimary,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  <option value="monthly">Mensal (~30 dias)</option>
                  <option value="yearly">Anual (~365 dias)</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Observações / Anotações (Opcional) */}
        {!showNotes ? (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            style={{
              background: 'none',
              border: 'none',
              color: colors.primary,
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 0',
              textAlign: 'left',
              width: 'fit-content',
            }}
          >
            <FileText size={15} /> + Adicionar anotação (opcional)
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.82rem', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={15} /> Anotação / Observação
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowNotes(false);
                  setNotes('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Remover
              </button>
            </div>
            <textarea
              rows={2}
              placeholder="Ex: Dividido com Fulano, presente, reembolso..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceElevated,
                color: colors.textPrimary,
                fontSize: '0.85rem',
                resize: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        {/* Botão de Salvar & Excluir */}
        <div style={{ marginTop: '12px', display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
          {initialData ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Excluir
            </Button>
          ) : <div />}

          <div style={{ display: 'flex', gap: '10px' }}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {initialData 
                ? 'Atualizar Transação' 
                : isInstallment && type === 'expense' && isCardContext && installmentCount > 1
                  ? `Lançar Compra em ${installmentCount}x`
                  : 'Adicionar Transação'}
            </Button>
          </div>
        </div>
      </form>

      {/* Modal Moderno de Confirmação de Exclusão */}
      {showDeleteConfirm && initialData && (
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={async () => {
            await deleteTransaction(initialData.id);
            setShowDeleteConfirm(false);
            onClose();
          }}
          title="Excluir Transação"
          description="Deseja realmente remover esta transação? O saldo da conta será recalculado."
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          variant="danger"
          itemDetails={{
            title: initialData.description,
            amount: `${initialData.type === 'income' ? '+' : '-'} R$ ${initialData.amount.toFixed(2).replace('.', ',')}`,
          }}
        />
      )}
    </Modal>
  );
};
