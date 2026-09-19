import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import { Button } from '../common/Button';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { Transaction, PaymentMethod, SubscriptionCadence } from '../../core/types';
import { parseBrlCurrency, formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { Repeat, Sparkles, Layers, FileText, Plus, Minus, Trash2, Check, X } from 'lucide-react';
import { Switch } from '../common/Switch';

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
    deleteInstallmentGroup,
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
  const [installmentValueMode, setInstallmentValueMode] = useState<'total' | 'parcel'>('total');

  // Estado de Anotações / Observações Opcionais
  const [notes, setNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    if (initialData) {
      setType(initialData.type === 'income' ? 'income' : 'expense');
      setDescription(initialData.description);
      setAccountId(initialData.accountId);
      setCategoryId(initialData.categoryId);
      setPaymentMethod(initialData.paymentMethod);
      setDateStr(initialData.date.substring(0, 10));
      setHasManuallySelectedCategory(true);
      setSuggestedCategoryTag(null);
      setIsInstallment(!!initialData.isInstallment);
      setInstallmentCount(initialData.installmentTotal || 2);
      setInstallmentValueMode('total');
      setNotes(initialData.notes || '');
      setShowNotes(!!initialData.notes);

      if (initialData.isInstallment) {
        const total = initialData.originalTotalAmount || (initialData.amount * (initialData.installmentTotal || 1));
        setAmountStr(total.toFixed(2).replace('.', ','));
      } else {
        setAmountStr(initialData.amount.toString().replace('.', ','));
      }

      // Verificar se essa transação corresponde a uma assinatura existente
      const normDesc = initialData.description.toLowerCase();
      const existingSub = subscriptions.find(s => {
        const sNorm = s.name.toLowerCase().trim();
        return normDesc.includes(sNorm) || sNorm.includes(normDesc);
      });
      setIsSubscription(!!existingSub);
      setSubscriptionCadence(existingSub?.cadence || 'monthly');
      
      if (!existingSub) {
        if (initialData.type === 'expense') {
          const likely = checkIfLikelySubscription(initialData.description, initialData.amount);
          setProactiveSuggestion(likely.isLikely ? likely : null);
          if (likely.isLikely && likely.cadence) {
            setSubscriptionCadence(likely.cadence);
          }
        } else if (initialData.type === 'income') {
          const norm = initialData.description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          const incomeKeywords = ['salario', 'pro labore', 'pro-labore', 'renda fixa', 'aluguel', 'beneficio', 'inss', 'aposentadoria', 'pensao', 'estagio', 'bolsa'];
          if (incomeKeywords.some(k => norm.includes(k))) {
            setProactiveSuggestion({
              isLikely: true,
              cadence: 'monthly',
              reason: 'Padrão comum de renda fixa ou salário mensal detectado',
              serviceName: initialData.description.trim()
            });
          } else {
            setProactiveSuggestion(null);
          }
        } else {
          setProactiveSuggestion(null);
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
      setInstallmentValueMode('total');
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

    // Avaliação proativa de recorrência / assinatura para despesas e receitas
    if (type === 'expense') {
      const numAmount = parseBrlCurrency(amountStr) || undefined;
      const likely = checkIfLikelySubscription(newDesc, numAmount);
      if (likely.isLikely && !isSubscription) {
        setProactiveSuggestion(likely);
      } else {
        setProactiveSuggestion(null);
      }
    } else if (type === 'income') {
      const norm = newDesc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const incomeKeywords = ['salario', 'pro labore', 'pro-labore', 'renda fixa', 'aluguel', 'beneficio', 'inss', 'aposentadoria', 'pensao', 'estagio', 'bolsa'];
      if (incomeKeywords.some(k => norm.includes(k)) && !isSubscription) {
        setProactiveSuggestion({
          isLikely: true,
          cadence: 'monthly',
          reason: 'Padrão comum de renda fixa ou salário mensal detectado',
          serviceName: newDesc.trim()
        });
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
      if (selectedAccount?.type !== 'credit_card') {
        const creditAcc = accounts.find(a => a.type === 'credit_card');
        if (creditAcc) {
          setAccountId(creditAcc.id);
        }
      }
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

    // Se for uma compra parcelada no cartão (seja nova ou editada)
    if (isInstallment && type === 'expense' && installmentCount > 1) {
      const finalTotalAmount = installmentValueMode === 'total' 
        ? numericAmount 
        : Math.round(numericAmount * installmentCount * 100) / 100;

      // Se estiver editando uma transação existente
      if (initialData) {
        if (initialData.installmentGroupId) {
          await deleteInstallmentGroup(initialData.installmentGroupId);
        } else {
          await deleteTransaction(initialData.id);
        }
      }

      await saveInstallmentPurchase({
        accountId,
        categoryId,
        description: description.trim(),
        totalAmount: finalTotalAmount,
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
      }, isSubscription ? { cadence: subscriptionCadence } : undefined);
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
              const firstInc = categories.find(c => c.type === 'income');
              if (firstInc) setCategoryId(firstInc.id);
              const nonCard = accounts.find(a => a.type !== 'credit_card');
              if (nonCard && selectedAccount?.type === 'credit_card') {
                handleAccountChange(nonCard.id);
              } else if (paymentMethod === 'credit') {
                setPaymentMethod('pix');
              }
              const norm = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
              const incomeKeywords = ['salario', 'pro labore', 'pro-labore', 'renda fixa', 'aluguel', 'beneficio', 'inss', 'aposentadoria', 'pensao', 'estagio', 'bolsa'];
              if (incomeKeywords.some(k => norm.includes(k)) && !isSubscription) {
                setProactiveSuggestion({
                  isLikely: true,
                  cadence: 'monthly',
                  reason: 'Padrão comum de renda fixa ou salário mensal detectado',
                  serviceName: description.trim()
                });
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
              color: accounts.length === 0 ? colors.textMuted : colors.textPrimary,
              fontSize: '0.95rem',
            }}
          >
            {accounts.length === 0 ? (
              <option value="">Nenhum cartão ou conta cadastrado</option>
            ) : (
              accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({getAccountTypeLabel(acc.type)})
                </option>
              ))
            )}
          </select>
          {accounts.length === 0 && (
            <div style={{ fontSize: '0.78rem', color: '#F87171', marginTop: '6px' }}>
              Cadastre um cartão ou conta bancária antes de registrar movimentações.
            </div>
          )}
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

        {/* Opção: Compra Parcelada no Cartão de Crédito */}
        {type === 'expense' && !isSubscription && (selectedAccount?.type === 'credit_card' || accounts.some(a => a.type === 'credit_card')) && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '14px',
              backgroundColor: isInstallment ? 'rgba(56, 189, 248, 0.04)' : colors.surfaceElevated,
              border: `1px solid ${isInstallment ? 'rgba(56, 189, 248, 0.35)' : colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Header com Switch moderno */}
            <div
              onClick={() => handleToggleInstallment(!isInstallment)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: isInstallment ? 'rgba(56, 189, 248, 0.15)' : colors.surface,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isInstallment ? '#38BDF8' : colors.textSecondary,
                    transition: 'all 0.2s',
                  }}
                >
                  <Layers size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: colors.textPrimary }}>
                      Parcelar compra no cartão
                    </span>
                    {initialData?.isInstallment && (
                      <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: '6px', backgroundColor: 'rgba(56, 189, 248, 0.2)', color: '#38BDF8', fontWeight: 700 }}>
                        {initialData.installmentNumber}/{initialData.installmentTotal}x
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: colors.textSecondary, marginTop: '2px' }}>
                    {isInstallment 
                      ? 'Lançamento automático nas próximas faturas' 
                      : 'Divida o valor em até 36 parcelas mensais'}
                  </div>
                </div>
              </div>
              <Switch
                checked={isInstallment}
                onChange={handleToggleInstallment}
                activeColor="#38BDF8"
              />
            </div>

            {isInstallment && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '12px', borderTop: `1px solid ${colors.border}` }}>
                {/* Segmented Control: Modo de Entrada do Valor */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: colors.textSecondary, marginBottom: '6px' }}>
                    O valor digitado refere-se a:
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      padding: '3px',
                      borderRadius: '10px',
                      backgroundColor: colors.surface,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setInstallmentValueMode('total')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: installmentValueMode === 'total' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                        color: installmentValueMode === 'total' ? '#38BDF8' : colors.textSecondary,
                        fontSize: '0.78rem',
                        fontWeight: installmentValueMode === 'total' ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      Total da compra
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallmentValueMode('parcel')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: installmentValueMode === 'parcel' ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                        color: installmentValueMode === 'parcel' ? '#38BDF8' : colors.textSecondary,
                        fontSize: '0.78rem',
                        fontWeight: installmentValueMode === 'parcel' ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      Valor da parcela
                    </button>
                  </div>
                </div>

                {/* Seletor de Quantidade de Parcelas: Stepper Harmonioso + Atalhos */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: colors.textSecondary }}>
                      Número de parcelas
                    </span>
                    <span style={{ fontSize: '0.72rem', color: colors.textMuted }}>
                      (de 2x a 36x)
                    </span>
                  </div>

                  {/* Stepper Central */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: colors.surface,
                      borderRadius: '10px',
                      border: `1px solid ${colors.border}`,
                      padding: '4px',
                      marginBottom: '8px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setInstallmentCount(prev => Math.max(2, prev - 1))}
                      disabled={installmentCount <= 2}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: colors.surfaceElevated,
                        color: installmentCount <= 2 ? colors.textMuted : colors.textPrimary,
                        cursor: installmentCount <= 2 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                      title="Diminuir parcela"
                    >
                      <Minus size={16} />
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <input
                        type="number"
                        min={2}
                        max={36}
                        value={installmentCount}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            setInstallmentCount(Math.max(2, Math.min(36, val)));
                          }
                        }}
                        style={{
                          width: '46px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: '#38BDF8',
                          fontSize: '1.2rem',
                          fontWeight: 800,
                          textAlign: 'center',
                          outline: 'none',
                          padding: '0',
                        }}
                      />
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: colors.textSecondary }}>
                        x
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setInstallmentCount(prev => Math.min(36, prev + 1))}
                      disabled={installmentCount >= 36}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: colors.surfaceElevated,
                        color: installmentCount >= 36 ? colors.textMuted : colors.textPrimary,
                        cursor: installmentCount >= 36 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                      title="Aumentar parcela"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Atalhos Rápidos com Espaçamento Uniforme */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                    {[2, 3, 4, 6, 10, 12].map(n => {
                      const isSelected = installmentCount === n;
                      return (
                        <button
                          type="button"
                          key={n}
                          onClick={() => setInstallmentCount(n)}
                          style={{
                            padding: '6px 0',
                            borderRadius: '8px',
                            border: `1px solid ${isSelected ? '#38BDF8' : colors.border}`,
                            backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : colors.surface,
                            color: isSelected ? '#38BDF8' : colors.textSecondary,
                            fontWeight: isSelected ? 700 : 500,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            textAlign: 'center',
                          }}
                        >
                          {n}x
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Resumo do Cálculo: Clareza Heroica e Sem Redundâncias */}
                {(() => {
                  const rawVal = parseBrlCurrency(amountStr) || 0;
                  const totalVal = installmentValueMode === 'total' ? rawVal : (rawVal * installmentCount);
                  const parcelVal = installmentValueMode === 'parcel' ? rawVal : (installmentCount > 0 ? (rawVal / installmentCount) : 0);

                  return (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        backgroundColor: colors.surface,
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: colors.textSecondary }}>
                          Plano de pagamento
                        </span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38BDF8', letterSpacing: '-0.01em' }}>
                          {installmentCount}x de {formatBrlCurrency(parcelVal)}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.74rem',
                          color: colors.textMuted,
                          borderTop: `1px solid ${colors.border}`,
                          paddingTop: '6px',
                          marginTop: '2px',
                        }}
                      >
                        <span>Total: <strong style={{ color: colors.textPrimary }}>{formatBrlCurrency(totalVal)}</strong></span>
                        <span>Compromete limite do cartão</span>
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
              <label style={{ fontSize: '0.85rem', color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                Categoria *
              </label>
              {suggestedCategoryTag && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: colors.primary,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Sparkles size={11} /> Auto
                </span>
              )}
            </div>
            {onOpenNewCategory && (
              <button
                type="button"
                onClick={onOpenNewCategory}
                style={{
                  fontSize: '0.75rem',
                  color: colors.primary,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 4px',
                  whiteSpace: 'nowrap',
                }}
                title="Criar nova categoria personalizada"
              >
                <Plus size={13} /> Nova
              </button>
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

        {/* Sugestão Conversacional de Recorrência (Mobile-first, Pierre style) */}
        {proactiveSuggestion?.isLikely && !isSubscription && !isInstallment && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '14px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: `1px solid rgba(16, 185, 129, 0.25)`,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <Sparkles size={16} color={colors.primary} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.84rem', color: colors.textPrimary, fontWeight: 500, lineHeight: 1.4 }}>
                  {type === 'income'
                    ? 'Identificamos padrão de salário mensal. Deseja registrar como receita fixa?'
                    : (proactiveSuggestion.reason ? `${proactiveSuggestion.reason}. Deseja acompanhar como assinatura?` : 'Deseja acompanhar esta cobrança todo mês?')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setProactiveSuggestion(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  opacity: 0.7,
                }}
                title="Dispensar sugestão"
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setProactiveSuggestion(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  color: colors.textSecondary,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSubscription(true);
                  setIsInstallment(false);
                  setSubscriptionCadence(proactiveSuggestion.cadence);
                  setProactiveSuggestion(null);
                }}
                style={{
                  padding: '6px 18px',
                  borderRadius: '8px',
                  backgroundColor: colors.primary,
                  color: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                }}
              >
                Sim
              </button>
            </div>
          </div>
        )}

        {/* Opção: Definir como Assinatura ou Receita Recorrente */}
        {!isInstallment && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '14px',
              backgroundColor: isSubscription ? 'rgba(16, 185, 129, 0.05)' : colors.surfaceElevated,
              border: `1px solid ${isSubscription ? colors.primary : colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              onClick={() => handleToggleSubscription(!isSubscription)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: isSubscription ? 'rgba(16, 185, 129, 0.15)' : colors.surface,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isSubscription ? colors.primary : colors.textSecondary,
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <Repeat size={18} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: colors.textPrimary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {type === 'income' ? 'Receita Recorrente' : 'Assinatura Recorrente'}
                  </div>
                  <div
                    style={{
                      fontSize: '0.74rem',
                      color: colors.textSecondary,
                      marginTop: '2px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {type === 'income' ? 'Salário ou renda mensal fixa' : 'Previsão de cobrança mensal'}
                  </div>
                </div>
              </div>
              <div style={{ flexShrink: 0, marginLeft: '8px' }}>
                <Switch
                  checked={isSubscription}
                  onChange={handleToggleSubscription}
                  activeColor={colors.primary}
                />
              </div>
            </div>

            {isSubscription && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '10px',
                  borderTop: `1px dashed ${colors.border}`,
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '0.8rem', color: colors.textSecondary, fontWeight: 500 }}>
                  Frequência
                </span>
                <div
                  style={{
                    display: 'inline-flex',
                    backgroundColor: colors.surface,
                    borderRadius: '8px',
                    padding: '3px',
                    border: `1px solid ${colors.border}`,
                    gap: '4px',
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSubscriptionCadence('monthly');
                    }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: subscriptionCadence === 'monthly' ? 700 : 500,
                      border: 'none',
                      backgroundColor: subscriptionCadence === 'monthly' ? colors.primary : 'transparent',
                      color: subscriptionCadence === 'monthly' ? '#FFFFFF' : colors.textSecondary,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSubscriptionCadence('yearly');
                    }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: subscriptionCadence === 'yearly' ? 700 : 500,
                      border: 'none',
                      backgroundColor: subscriptionCadence === 'yearly' ? colors.primary : 'transparent',
                      color: subscriptionCadence === 'yearly' ? '#FFFFFF' : colors.textSecondary,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Anual
                  </button>
                </div>
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

        {/* Ações Inferiores - Design Limpo, Espaçoso e com Clara Hierarquia (Pierre / CloudWalk) */}
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '10px' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              style={{ width: '100%' }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              style={{
                width: '100%',
                whiteSpace: 'nowrap',
                fontWeight: 700,
              }}
            >
              {initialData 
                ? 'Atualizar Transação' 
                : isInstallment && type === 'expense' && isCardContext && installmentCount > 1
                  ? `Lançar em ${installmentCount}x`
                  : type === 'income'
                    ? 'Adicionar Receita'
                    : 'Adicionar Despesa'}
            </Button>
          </div>

          {initialData && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(239, 68, 68, 0.85)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                margin: '2px auto 0 auto',
                borderRadius: '8px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#EF4444';
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'rgba(239, 68, 68, 0.85)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Trash2 size={15} /> Excluir esta transação
            </button>
          )}
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
