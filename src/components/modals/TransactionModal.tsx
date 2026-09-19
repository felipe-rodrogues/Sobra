import React, { useState, useEffect, useRef } from 'react';
import { ConfirmModal } from '../common/ConfirmModal';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { Transaction, PaymentMethod, SubscriptionCadence } from '../../core/types';
import { parseBrlCurrency, formatBrlCurrency } from '../../core/parsers/currencyHelper';
import { 
  ArrowLeft, 
  Repeat, 
  Sparkles, 
  Layers, 
  FileText, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  Calendar, 
  CreditCard, 
  Tag,
  Pencil,
  ChevronDown,
  Check,
  Landmark,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { Switch } from '../common/Switch';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { SwipeBackIndicator } from '../common/SwipeBackIndicator';
import { BankLogo } from '../common/BankLogo';
import { IconRenderer } from '../common/IconRenderer';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Transaction | null;
  defaultType?: 'expense' | 'income';
  defaultAccountId?: string;
  onOpenNewCategory?: () => void;
  zIndex?: number;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  initialData,
  defaultType = 'expense',
  defaultAccountId,
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

  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [isRefunded, setIsRefunded] = useState(false);
  const [refundDateStr, setRefundDateStr] = useState(() => new Date().toISOString().substring(0, 10));
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

  // Estado e Ref da Cápsula Interativa de Valor
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Estado do Bottom Sheet de Seleção de Conta/Cartão com suporte a gesto de arrasto
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetTouchStartY = useRef<number | null>(null);

  const handleSheetTouchStart = (e: React.TouchEvent) => {
    sheetTouchStartY.current = e.touches[0].clientY;
  };

  const handleSheetTouchMove = (e: React.TouchEvent) => {
    if (sheetTouchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - sheetTouchStartY.current;
    if (deltaY > 0) {
      setSheetDragY(deltaY);
    }
  };

  const handleSheetTouchEnd = () => {
    if (sheetDragY > 70) {
      setIsAccountSheetOpen(false);
    }
    setSheetDragY(0);
    sheetTouchStartY.current = null;
  };

  // Estado do Bottom Sheet de Seleção de Categoria com suporte a gesto de arrasto
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);
  const [categorySheetDragY, setCategorySheetDragY] = useState(0);
  const categorySheetTouchStartY = useRef<number | null>(null);

  const handleCategorySheetTouchStart = (e: React.TouchEvent) => {
    categorySheetTouchStartY.current = e.touches[0].clientY;
  };

  const handleCategorySheetTouchMove = (e: React.TouchEvent) => {
    if (categorySheetTouchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - categorySheetTouchStartY.current;
    if (deltaY > 0) {
      setCategorySheetDragY(deltaY);
    }
  };

  const handleCategorySheetTouchEnd = () => {
    if (categorySheetDragY > 70) {
      setIsCategorySheetOpen(false);
    }
    setCategorySheetDragY(0);
    categorySheetTouchStartY.current = null;
  };

  useEffect(() => {
    if (initialData) {
      setActiveTab(initialData.type === 'income' ? 'income' : 'expense');
      setType(initialData.type === 'income' ? 'income' : 'expense');
      setIsRefunded(!!initialData.isRefunded);
      setRefundDateStr(initialData.refundDate ? initialData.refundDate.substring(0, 10) : new Date().toISOString().substring(0, 10));
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
        } else if (initialData.type === 'income' && !initialData.isRefund) {
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
      const initialTab: 'expense' | 'income' = defaultType === 'income' ? 'income' : 'expense';
      setActiveTab(initialTab);
      setType(initialTab);
      setIsRefunded(false);
      setRefundDateStr(new Date().toISOString().substring(0, 10));
      setDescription('');
      setAmountStr('');

      let defaultAcc: typeof accounts[0] | undefined;
      if (defaultAccountId) {
        defaultAcc = accounts.find(a => a.id === defaultAccountId);
      }
      if (!defaultAcc) {
        defaultAcc = initialTab === 'income'
          ? (accounts.find(a => a.type !== 'credit_card') || accounts[0])
          : (accounts.find(a => a.type === 'credit_card') || accounts[0]);
      }

      let defaultPayment: PaymentMethod = initialTab === 'income'
        ? (defaultAcc?.type === 'cash' ? 'cash' : 'pix')
        : (defaultAcc?.type === 'credit_card' ? 'credit' : defaultAcc?.type === 'cash' ? 'cash' : 'pix');

      setAccountId(defaultAcc?.id || '');
      setCategoryId(categories.find(c => c.type === initialTab)?.id || categories[0]?.id || '');
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
  }, [initialData, isOpen, defaultType, defaultAccountId, accounts, categories, subscriptions]);

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
  const selectedCategory = categories.find(c => c.id === categoryId);
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

  const handleTabChange = (newTab: 'expense' | 'income') => {
    setActiveTab(newTab);
    if (newTab === 'expense') {
      setType('expense');
      const firstExp = categories.find(c => c.type === 'expense');
      if (firstExp) setCategoryId(firstExp.id);
      const cardAcc = accounts.find(a => a.type === 'credit_card');
      if (cardAcc && selectedAccount?.type !== 'credit_card') {
        handleAccountChange(cardAcc.id);
      }
    } else if (newTab === 'income') {
      setType('income');
      setIsInstallment(false);
      setIsRefunded(false);
      const firstInc = categories.find(c => c.type === 'income');
      if (firstInc) setCategoryId(firstInc.id);
      // Se a conta atual for cartão de crédito, muda obrigatoriamente para conta corrente/carteira
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

    // Apenas gera novo plano de parcelamento se for uma NOVA compra parcelada
    // OU se o usuário explicitamente alterou a contagem de parcelas de uma existente
    const isNewInstallmentPlan = !initialData && isInstallment && type === 'expense' && installmentCount > 1 && !isRefunded;
    const changedInstallmentCount = initialData && isInstallment && type === 'expense' && installmentCount > 1 && installmentCount !== initialData.installmentTotal && !isRefunded;

    if (isNewInstallmentPlan || changedInstallmentCount) {
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
      const isExpenseRefunded = type === 'expense' && isRefunded;
      const refundId = initialData?.refundTransactionId || `refund_${initialData?.id || Date.now()}`;

      // 1. Salva a transação original (preservando parcelamento se houver)
      const savedTx = await saveTransaction({
        id: initialData?.id,
        accountId,
        categoryId,
        amount: numericAmount,
        type,
        isRefund: false,
        isRefunded: isExpenseRefunded,
        refundDate: isExpenseRefunded ? `${refundDateStr}T12:00:00.000Z` : undefined,
        refundAmount: isExpenseRefunded ? numericAmount : undefined,
        refundTransactionId: isExpenseRefunded ? refundId : undefined,
        isInstallment: initialData?.isInstallment,
        installmentGroupId: initialData?.installmentGroupId,
        installmentNumber: initialData?.installmentNumber,
        installmentTotal: initialData?.installmentTotal,
        originalTotalAmount: initialData?.originalTotalAmount,
        description: description.trim(),
        date: `${dateStr}T12:00:00.000Z`,
        status: 'confirmed',
        paymentMethod: finalPaymentMethod,
        source: initialData?.source || 'manual',
        notes: notes.trim() || null,
      }, isSubscription ? { cadence: subscriptionCadence } : undefined);

      // 2. Se a despesa foi estornada, gera ou atualiza a transação de crédito/estorno na fatura
      if (isExpenseRefunded) {
        await saveTransaction({
          id: refundId,
          accountId,
          categoryId,
          amount: numericAmount,
          type: 'income',
          isRefund: true,
          refundedTransactionId: savedTx?.id || initialData?.id,
          description: `Estorno: ${description.trim()}`,
          date: `${refundDateStr}T12:00:00.000Z`,
          status: 'confirmed',
          paymentMethod: finalPaymentMethod,
          source: 'manual',
          notes: `Estorno referente à despesa "${description.trim()}"`,
        });
      } else if (initialData?.refundTransactionId) {
        // Se o usuário desmarcou o estorno de uma despesa que estava estornada, remove o lançamento de estorno
        await deleteTransaction(initialData.refundTransactionId);
      }
    }

    onClose();
  };

  const filteredCategories = categories.filter(c => c.type === type);

  // Swipe Back Gesture Integration (Pierre Native Feel)
  const swipeState = useSwipeBack({ onBack: onClose, enabled: isOpen });

  if (!isOpen) return null;

  return (
    <>
      <SwipeBackIndicator swipeState={swipeState} />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.78)',
          backdropFilter: 'blur(8px)',
          zIndex: zIndex || 5000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '480px',
            height: '100dvh',
            maxHeight: '100dvh',
            backgroundColor: '#0A0E0C',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            position: 'relative',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header Superior Sticky (Pierre Native Style) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'calc(var(--safe-area-top, 0px) + 14px) 20px 12px',
              position: 'sticky',
              top: 0,
              backgroundColor: '#0A0E0C',
              zIndex: 20,
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#161F18',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Voltar"
            >
              <ArrowLeft size={20} />
            </button>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                {initialData ? 'Editar Lançamento' : 'Nova Transação'}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                {type === 'expense' ? 'Registro de Despesa' : 'Registro de Receita'}
              </div>
            </div>

            {initialData ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#EF4444',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Excluir Transação"
              >
                <Trash2 size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#161F18',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Fechar"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Formulário com Área com Rolagem Suave */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '16px 20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Pill Switcher de Tipo: Despesa vs Receita vs Estorno */}
              <div
                style={{
                  display: 'flex',
                  backgroundColor: '#121814',
                  borderRadius: '14px',
                  padding: '4px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  width: '100%',
                  maxWidth: '340px',
                  margin: '0 auto',
                  gap: '4px',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleTabChange('expense')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    border: 'none',
                    backgroundColor: activeTab === 'expense' ? '#EF4444' : 'transparent',
                    color: activeTab === 'expense' ? '#FFFFFF' : '#94A3B8',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Despesa
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('income')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    border: 'none',
                    backgroundColor: activeTab === 'income' ? '#4ADE80' : 'transparent',
                    color: activeTab === 'income' ? '#0A0E0C' : '#94A3B8',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Receita
                </button>
              </div>

              {/* Alerta Proativo: Receita vinculada a Cartão de Crédito */}
              {type === 'income' && selectedAccount?.type === 'credit_card' && (
                <div
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    borderRadius: '16px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FBBF24', fontWeight: 700, fontSize: '0.84rem' }}>
                    <AlertTriangle size={17} />
                    <span>Receita vinculada a Cartão de Crédito</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#D1D5DB', margin: 0, lineHeight: 1.45 }}>
                    Este lançamento está vinculado ao cartão <strong style={{ color: '#FFFFFF' }}>{selectedAccount.name}</strong>. Se for Salário ou Pix recebido, mova para uma Conta Corrente para seu fluxo de caixa e sua fatura ficarem corretos.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                    {accounts.filter(a => a.type !== 'credit_card').slice(0, 2).map(acc => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleAccountChange(acc.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: '#F59E0B',
                          color: '#0A0E0C',
                          fontWeight: 700,
                          fontSize: '0.74rem',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>Mover para {acc.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Hero Input do Valor com Cápsula Interativa */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px 0 16px',
                  width: '100%',
                }}
              >
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: '#94A3B8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 600,
                    marginBottom: '10px',
                    textAlign: 'center',
                  }}
                >
                  {type === 'expense' ? 'Valor da Despesa' : 'Valor da Receita'}
                </span>

                <div
                  onClick={() => amountInputRef.current?.focus()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 18px',
                    borderRadius: '14px',
                    backgroundColor: isAmountFocused 
                      ? 'rgba(74, 222, 128, 0.05)' 
                      : 'rgba(255, 255, 255, 0.03)',
                    border: isAmountFocused 
                      ? '1px solid #4ADE80' 
                      : '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: isAmountFocused 
                      ? '0 0 16px rgba(74, 222, 128, 0.22)' 
                      : 'none',
                    transition: 'all 0.2s ease',
                    cursor: 'text',
                    gap: '8px',
                    margin: '0 auto',
                  }}
                >
                  <span
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: 700,
                      color: type === 'income' ? '#4ADE80' : '#FFFFFF',
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
                    required
                    placeholder="0,00"
                    value={amountStr}
                    onChange={e => setAmountStr(e.target.value)}
                    onFocus={() => setIsAmountFocused(true)}
                    onBlur={() => setIsAmountFocused(false)}
                    autoFocus={!initialData}
                    style={{
                      width: `${Math.max(3, (amountStr || '0,00').length + 0.4)}ch`,
                      minWidth: '60px',
                      maxWidth: '240px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: type === 'income' ? '#4ADE80' : '#FFFFFF',
                      fontSize: '2.5rem',
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
                  <Pencil
                    size={13}
                    color={isAmountFocused ? '#4ADE80' : '#71717A'}
                    style={{
                      flexShrink: 0,
                      marginLeft: '2px',
                      transition: 'color 0.2s ease',
                    }}
                  />
                </div>
              </div>

              {/* CARD 1: Informações Principais (Descrição, Conta e Categoria) */}
              <div
                style={{
                  backgroundColor: '#121814',
                  borderRadius: '18px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {/* Descrição */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#94A3B8',
                      marginBottom: '6px',
                    }}
                  >
                    Descrição ou Estabelecimento *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Supermercado, Salário, Restaurante"
                    value={description}
                    onChange={e => handleDescriptionChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      backgroundColor: '#161F18',
                      color: '#FFFFFF',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Conta Bancária / Cartão - Seletor Premium Pierre */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#94A3B8',
                      marginBottom: '6px',
                    }}
                  >
                    {type === 'expense' 
                      ? 'Conta Bancária ou Cartão *' 
                      : 'Receber na Conta *'}
                  </label>

                  <button
                    type="button"
                    onClick={() => setIsAccountSheetOpen(true)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      backgroundColor: '#161F18',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      {selectedAccount ? (
                        <>
                          <BankLogo bankId={selectedAccount.bankId || selectedAccount.name} size={32} />
                          <div style={{ minWidth: 0 }}>
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
                              {selectedAccount.name}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                              {getAccountTypeLabel(selectedAccount.type)}
                            </div>
                          </div>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.92rem', color: '#64748B' }}>
                          Selecione uma conta...
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Trocar</span>
                      <ChevronDown size={16} />
                    </div>
                  </button>

                  {accounts.length === 0 && (
                    <div style={{ fontSize: '0.78rem', color: '#F87171', marginTop: '6px' }}>
                      Cadastre uma conta bancária antes de registrar movimentações.
                    </div>
                  )}
                </div>

                {/* Categoria - Seletor Premium Pierre */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8' }}>
                        Categoria *
                      </label>
                      {suggestedCategoryTag && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: '#4ADE80',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'rgba(74, 222, 128, 0.12)',
                            padding: '2px 8px',
                            borderRadius: '6px',
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
                          color: '#4ADE80',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '2px 4px',
                        }}
                        title="Criar nova categoria personalizada"
                      >
                        <Plus size={13} /> Nova
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCategorySheetOpen(true)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      backgroundColor: '#161F18',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      {selectedCategory ? (
                        <>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '10px',
                              backgroundColor: `${selectedCategory.color || '#4ADE80'}20`,
                              color: selectedCategory.color || '#4ADE80',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <IconRenderer name={selectedCategory.icon || 'Tag'} size={18} />
                          </div>
                          <div style={{ minWidth: 0 }}>
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
                              {selectedCategory.name}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                              {type === 'income' ? 'Categoria de receita' : 'Categoria de despesa'}
                            </div>
                          </div>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.92rem', color: '#64748B' }}>
                          Selecione uma categoria...
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Trocar</span>
                      <ChevronDown size={16} />
                    </div>
                  </button>
                </div>
              </div>

              {/* CARD 2: Detalhes do Pagamento & Data */}
              <div
                style={{
                  backgroundColor: '#121814',
                  borderRadius: '18px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {/* Linha com Data e Atalhos Hoje/Ontem */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8' }}>
                      Data do Lançamento *
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setDateStr(todayStr)}
                        style={{
                          padding: '3px 9px',
                          borderRadius: '8px',
                          fontSize: '0.74rem',
                          fontWeight: dateStr === todayStr ? 700 : 500,
                          backgroundColor: dateStr === todayStr ? 'rgba(74, 222, 128, 0.15)' : '#161F18',
                          color: dateStr === todayStr ? '#4ADE80' : '#94A3B8',
                          border: `1px solid ${dateStr === todayStr ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        Hoje
                      </button>
                      <button
                        type="button"
                        onClick={() => setDateStr(yesterdayStr)}
                        style={{
                          padding: '3px 9px',
                          borderRadius: '8px',
                          fontSize: '0.74rem',
                          fontWeight: dateStr === yesterdayStr ? 700 : 500,
                          backgroundColor: dateStr === yesterdayStr ? 'rgba(74, 222, 128, 0.15)' : '#161F18',
                          color: dateStr === yesterdayStr ? '#4ADE80' : '#94A3B8',
                          border: `1px solid ${dateStr === yesterdayStr ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
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
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      backgroundColor: '#161F18',
                      color: '#FFFFFF',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Meio de Pagamento se for conta corrente */}
                {selectedAccount?.type === 'checking' && !isInstallment && (
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#94A3B8',
                        marginBottom: '6px',
                      }}
                    >
                      Meio de Pagamento
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: '#161F18',
                        color: '#FFFFFF',
                        fontSize: '0.95rem',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    >
                      <option value="pix">Pix</option>
                      <option value="debit">Cartão de Débito</option>
                      <option value="transfer">Transferência / TED</option>
                      <option value="other">Boleto / Outro</option>
                    </select>
                  </div>
                )}
              </div>

              {/* CARD 3: Opção Compra Parcelada no Cartão de Crédito */}
              {type === 'expense' && !isSubscription && (selectedAccount?.type === 'credit_card' || accounts.some(a => a.type === 'credit_card')) && (
                <div
                  style={{
                    padding: '16px 18px',
                    borderRadius: '18px',
                    backgroundColor: isInstallment ? 'rgba(56, 189, 248, 0.05)' : '#121814',
                    border: `1px solid ${isInstallment ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.06)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    transition: 'all 0.2s ease',
                  }}
                >
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
                          width: '38px',
                          height: '38px',
                          borderRadius: '12px',
                          backgroundColor: isInstallment ? 'rgba(56, 189, 248, 0.18)' : '#161F18',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isInstallment ? '#38BDF8' : '#94A3B8',
                          transition: 'all 0.2s',
                        }}
                      >
                        <Layers size={18} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF' }}>
                            Parcelar compra no cartão
                          </span>
                          {initialData?.isInstallment && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                                color: '#38BDF8',
                                fontWeight: 700,
                              }}
                            >
                              {initialData.installmentNumber}/{initialData.installmentTotal}x
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
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
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        paddingTop: '12px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      {/* Segmented Control: Modo de Entrada do Valor */}
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                          O valor digitado refere-se a:
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            padding: '3px',
                            borderRadius: '12px',
                            backgroundColor: '#161F18',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setInstallmentValueMode('total')}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '9px',
                              border: 'none',
                              backgroundColor: installmentValueMode === 'total' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                              color: installmentValueMode === 'total' ? '#38BDF8' : '#94A3B8',
                              fontSize: '0.8rem',
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
                              borderRadius: '9px',
                              border: 'none',
                              backgroundColor: installmentValueMode === 'parcel' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                              color: installmentValueMode === 'parcel' ? '#38BDF8' : '#94A3B8',
                              fontSize: '0.8rem',
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

                      {/* Seletor de Parcelas */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8' }}>
                            Número de parcelas
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                            (de 2x a 36x)
                          </span>
                        </div>

                        {/* Stepper Central */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#161F18',
                            borderRadius: '12px',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            padding: '4px',
                            marginBottom: '8px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setInstallmentCount(prev => Math.max(2, prev - 1))}
                            disabled={installmentCount <= 2}
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '9px',
                              border: 'none',
                              backgroundColor: '#121814',
                              color: installmentCount <= 2 ? '#64748B' : '#FFFFFF',
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
                                width: '48px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: '#38BDF8',
                                fontSize: '1.25rem',
                                fontWeight: 800,
                                textAlign: 'center',
                                outline: 'none',
                                padding: '0',
                              }}
                            />
                            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#94A3B8' }}>
                              x
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setInstallmentCount(prev => Math.min(36, prev + 1))}
                            disabled={installmentCount >= 36}
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '9px',
                              border: 'none',
                              backgroundColor: '#121814',
                              color: installmentCount >= 36 ? '#64748B' : '#FFFFFF',
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

                        {/* Atalhos Rápidos */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                          {[2, 3, 4, 6, 10, 12].map(n => {
                            const isSelected = installmentCount === n;
                            return (
                              <button
                                type="button"
                                key={n}
                                onClick={() => setInstallmentCount(n)}
                                style={{
                                  padding: '7px 0',
                                  borderRadius: '8px',
                                  border: `1px solid ${isSelected ? '#38BDF8' : 'rgba(255, 255, 255, 0.08)'}`,
                                  backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.18)' : '#161F18',
                                  color: isSelected ? '#38BDF8' : '#94A3B8',
                                  fontWeight: isSelected ? 700 : 500,
                                  fontSize: '0.8rem',
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

                      {/* Resumo do Cálculo do Parcelamento */}
                      {(() => {
                        const rawVal = parseBrlCurrency(amountStr) || 0;
                        const totalVal = installmentValueMode === 'total' ? rawVal : (rawVal * installmentCount);
                        const parcelVal = installmentValueMode === 'parcel' ? rawVal : (installmentCount > 0 ? (rawVal / installmentCount) : 0);

                        return (
                          <div
                            style={{
                              padding: '12px 14px',
                              borderRadius: '12px',
                              backgroundColor: '#161F18',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8' }}>
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
                                color: '#64748B',
                                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                paddingTop: '6px',
                                marginTop: '2px',
                              }}
                            >
                              <span>Total: <strong style={{ color: '#FFFFFF' }}>{formatBrlCurrency(totalVal)}</strong></span>
                              <span>Compromete limite do cartão</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Sugestão Conversacional de Recorrência */}
              {proactiveSuggestion?.isLikely && !isSubscription && !isInstallment && (
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(74, 222, 128, 0.08)',
                    border: '1px solid rgba(74, 222, 128, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <Sparkles size={16} color="#4ADE80" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '0.84rem', color: '#FFFFFF', fontWeight: 500, lineHeight: 1.4 }}>
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
                        color: '#64748B',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
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
                        color: '#94A3B8',
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
                        backgroundColor: '#4ADE80',
                        color: '#0A0E0C',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 2px 8px rgba(74, 222, 128, 0.25)',
                      }}
                    >
                      Sim
                    </button>
                  </div>
                </div>
              )}

              {/* CARD 4: Assinatura ou Receita Recorrente */}
              {!isInstallment && (
                <div
                  style={{
                    padding: '16px 18px',
                    borderRadius: '18px',
                    backgroundColor: isSubscription ? 'rgba(74, 222, 128, 0.05)' : '#121814',
                    border: `1px solid ${isSubscription ? '#4ADE80' : 'rgba(255, 255, 255, 0.06)'}`,
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
                          width: '38px',
                          height: '38px',
                          borderRadius: '12px',
                          backgroundColor: isSubscription ? 'rgba(74, 222, 128, 0.15)' : '#161F18',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isSubscription ? '#4ADE80' : '#94A3B8',
                          transition: 'all 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <Repeat size={18} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: '#FFFFFF',
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
                            color: '#94A3B8',
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {type === 'income' ? 'Salário ou renda mensal fixa' : 'Previsão de cobrança periódica'}
                        </div>
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, marginLeft: '8px' }}>
                      <Switch
                        checked={isSubscription}
                        onChange={handleToggleSubscription}
                        activeColor="#4ADE80"
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
                        borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
                        gap: '8px',
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500 }}>
                        Frequência
                      </span>
                      <div
                        style={{
                          display: 'inline-flex',
                          backgroundColor: '#161F18',
                          borderRadius: '10px',
                          padding: '3px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
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
                            padding: '5px 14px',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: subscriptionCadence === 'monthly' ? 700 : 500,
                            border: 'none',
                            backgroundColor: subscriptionCadence === 'monthly' ? '#4ADE80' : 'transparent',
                            color: subscriptionCadence === 'monthly' ? '#0A0E0C' : '#94A3B8',
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
                            padding: '5px 14px',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: subscriptionCadence === 'yearly' ? 700 : 500,
                            border: 'none',
                            backgroundColor: subscriptionCadence === 'yearly' ? '#4ADE80' : 'transparent',
                            color: subscriptionCadence === 'yearly' ? '#0A0E0C' : '#94A3B8',
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

              {/* CARD: Estorno desta Compra (Apenas para despesas) */}
              {type === 'expense' && (
                <div
                  style={{
                    padding: '16px 18px',
                    borderRadius: '18px',
                    backgroundColor: isRefunded ? 'rgba(56, 189, 248, 0.05)' : '#121814',
                    border: `1px solid ${isRefunded ? '#38BDF8' : 'rgba(255, 255, 255, 0.06)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div
                    onClick={() => setIsRefunded(!isRefunded)}
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
                          width: '38px',
                          height: '38px',
                          borderRadius: '12px',
                          backgroundColor: isRefunded ? 'rgba(56, 189, 248, 0.15)' : '#161F18',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isRefunded ? '#38BDF8' : '#94A3B8',
                          transition: 'all 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <RotateCcw size={18} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          Esta compra foi estornada?
                        </div>
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: '#94A3B8',
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {isRefunded ? 'Lançará crédito de estorno na fatura' : 'Marcar se a compra foi cancelada ou devolvida'}
                        </div>
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, marginLeft: '8px' }}>
                      <Switch
                        checked={isRefunded}
                        onChange={setIsRefunded}
                        activeColor="#38BDF8"
                      />
                    </div>
                  </div>

                  {isRefunded && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        paddingTop: '10px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.76rem', color: '#94A3B8', fontWeight: 600 }}>
                          Data do estorno
                        </label>
                        <input
                          type="date"
                          value={refundDateStr}
                          onChange={e => setRefundDateStr(e.target.value)}
                          style={{
                            backgroundColor: '#161F18',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            borderRadius: '12px',
                            padding: '10px 14px',
                            color: '#FFFFFF',
                            fontSize: '0.88rem',
                            outline: 'none',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: '0.76rem',
                          color: '#38BDF8',
                          backgroundColor: 'rgba(56, 189, 248, 0.08)',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                          padding: '10px 12px',
                          borderRadius: '12px',
                          lineHeight: 1.45,
                        }}
                      >
                        Um crédito de {amountStr ? `R$ ${amountStr}` : 'estorno'} será lançado na fatura na data informada, abatendo o valor correspondente no cartão.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CARD 5: Observações / Anotações */}
              <div
                style={{
                  backgroundColor: '#121814',
                  borderRadius: '18px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  padding: '14px 18px',
                }}
              >
                {!showNotes ? (
                  <button
                    type="button"
                    onClick={() => setShowNotes(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4ADE80',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '2px 0',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <FileText size={16} /> + Adicionar anotação ou observação
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                          color: '#64748B',
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
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: '#161F18',
                        color: '#FFFFFF',
                        fontSize: '0.88rem',
                        resize: 'none',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Barra Inferior Fixa com Botão de Ação (Sempre visível e acessível) */}
            <div
              style={{
                flexShrink: 0,
                padding: '14px 20px calc(14px + env(safe-area-inset-bottom, 0px))',
                backgroundColor: 'rgba(10, 14, 12, 0.98)',
                backdropFilter: 'blur(16px)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 30,
              }}
            >
              <button
                type="submit"
                style={{
                  width: '100%',
                  height: '52px',
                  borderRadius: '16px',
                  backgroundColor: '#4ADE80',
                  color: '#0A0E0C',
                  fontSize: '1rem',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(74, 222, 128, 0.25)',
                  transition: 'transform 0.15s ease, opacity 0.15s ease',
                }}
              >
                <Check size={18} strokeWidth={3} />
                <span>
                  {initialData 
                    ? 'Salvar Alterações' 
                    : isInstallment && type === 'expense' && isCardContext && installmentCount > 1
                      ? `Lançar em ${installmentCount}x`
                      : type === 'income'
                        ? 'Salvar Receita'
                        : 'Salvar Despesa'}
                </span>
              </button>
            </div>
          </form>

          {/* Modal Moderno de Confirmação de Exclusão */}
          {showDeleteConfirm && initialData && (
            <ConfirmModal
              isOpen={showDeleteConfirm}
              onClose={() => setShowDeleteConfirm(false)}
              onConfirm={async () => {
                await deleteTransaction(initialData.id);
                if (initialData.refundTransactionId) {
                  await deleteTransaction(initialData.refundTransactionId);
                }
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

          {/* Bottom Sheet Modal: Seletor Inteligente de Contas e Cartões */}
          {isAccountSheetOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.78)',
                backdropFilter: 'blur(8px)',
                zIndex: (zIndex || 5000) + 100,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}
              onClick={() => {
                setIsAccountSheetOpen(false);
                setSheetDragY(0);
              }}
            >
              <style>{`
                @keyframes accountSheetSlideUp {
                  from { transform: translateY(100%); opacity: 0; }
                  to { transform: translateY(0); opacity: 1; }
                }
              `}</style>
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  width: '100%',
                  maxWidth: '480px',
                  height: 'fit-content',
                  maxHeight: '85vh',
                  backgroundColor: '#0F1511',
                  borderTopLeftRadius: '24px',
                  borderTopRightRadius: '24px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderBottom: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  transform: sheetDragY > 0 ? `translateY(${sheetDragY}px)` : 'none',
                  transition: sheetDragY > 0 ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  animation: sheetDragY === 0 ? 'accountSheetSlideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
                }}
              >
                {/* Pull Handle & Header com suporte a arraste tátil */}
                <div
                  onTouchStart={handleSheetTouchStart}
                  onTouchMove={handleSheetTouchMove}
                  onTouchEnd={handleSheetTouchEnd}
                  style={{
                    cursor: 'grab',
                    touchAction: 'none',
                    userSelect: 'none',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '5px',
                      borderRadius: '3px',
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      margin: '12px auto 6px auto',
                    }}
                  />

                  {/* Header do Sheet (sem botão X, fechamento por gesto ou toque fora) */}
                  <div
                    style={{
                      padding: '8px 20px 14px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF' }}>
                      {type === 'income' ? 'Onde deseja receber?' : 'Conta ou Cartão'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
                      {type === 'income'
                        ? 'Selecione a conta de destino da receita'
                        : 'Selecione onde será debitado ou lançado'}
                    </div>
                  </div>
                </div>

                {/* Lista de Contas com Scroll Suave */}
                <div
                  style={{
                    padding: '16px 20px calc(48px + var(--safe-area-bottom, 0px))',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px',
                    flex: 1,
                  }}
                >
                  {/* Se for RECEITA: Somente contas que recebem saldo (Sem Cartão de Crédito) */}
                  {activeTab === 'income' ? (
                    <div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#4ADE80',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Landmark size={14} /> Contas Disponíveis para Recebimento
                      </div>

                      {accounts.filter(a => a.type !== 'credit_card').length === 0 ? (
                        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
                          Nenhuma conta corrente ou carteira cadastrada.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {accounts
                            .filter(a => a.type !== 'credit_card')
                            .map(acc => {
                              const isSelected = acc.id === accountId;
                              return (
                                <button
                                  key={acc.id}
                                  type="button"
                                  onClick={() => {
                                    handleAccountChange(acc.id);
                                    setIsAccountSheetOpen(false);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '12px 14px',
                                    borderRadius: '14px',
                                    border: `1px solid ${isSelected ? '#4ADE80' : 'rgba(255, 255, 255, 0.06)'}`,
                                    backgroundColor: isSelected ? 'rgba(74, 222, 128, 0.08)' : '#161F18',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    textAlign: 'left',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                    <BankLogo bankId={acc.bankId || acc.name} size={36} />
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF' }}>
                                        {acc.name}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
                                        {getAccountTypeLabel(acc.type)}
                                      </div>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <div
                                      style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        backgroundColor: '#4ADE80',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                      }}
                                    >
                                      <Check size={14} color="#0A0E0C" strokeWidth={3} />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      )}

                      {/* Dica para Estornos em Cartão de Crédito */}
                      {accounts.some(a => a.type === 'credit_card') && (
                        <div
                          style={{
                            padding: '12px 14px',
                            borderRadius: '14px',
                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                            border: '1px dashed rgba(255, 255, 255, 0.1)',
                            marginTop: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94A3B8', fontWeight: 600, fontSize: '0.78rem' }}>
                            <CreditCard size={15} />
                            <span>Cartões de crédito não recebem receitas</span>
                          </div>
                          <p style={{ fontSize: '0.74rem', color: '#64748B', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                            Para cancelar ou estornar uma compra do cartão, toque na compra desejada e ative a opção "Esta compra foi estornada".
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Se for DESPESA: Separar Cartões de Crédito e Contas Bancárias */
                    <>
                      {/* 1. Cartões de Crédito */}
                      {accounts.some(a => a.type === 'credit_card') && (
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '10px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: '#38BDF8',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <CreditCard size={14} /> Cartões de Crédito
                            </span>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                color: '#38BDF8',
                                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                fontWeight: 600,
                              }}
                            >
                              Fatura futura
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {accounts
                              .filter(a => a.type === 'credit_card')
                              .map(acc => {
                                const isSelected = acc.id === accountId;
                                return (
                                  <button
                                    key={acc.id}
                                    type="button"
                                    onClick={() => {
                                      handleAccountChange(acc.id);
                                      setIsAccountSheetOpen(false);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '12px 14px',
                                      borderRadius: '14px',
                                      border: `1px solid ${isSelected ? '#38BDF8' : 'rgba(255, 255, 255, 0.06)'}`,
                                      backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.08)' : '#161F18',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                      <BankLogo bankId={acc.bankId || acc.name} size={36} />
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF' }}>
                                          {acc.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
                                          Cartão de Crédito
                                        </div>
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <div
                                        style={{
                                          width: '24px',
                                          height: '24px',
                                          borderRadius: '50%',
                                          backgroundColor: '#38BDF8',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          flexShrink: 0,
                                        }}
                                      >
                                        <Check size={14} color="#0A0E0C" strokeWidth={3} />
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* 2. Contas Bancárias & Carteiras */}
                      {accounts.some(a => a.type !== 'credit_card') && (
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '10px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: '#4ADE80',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <Landmark size={14} /> Contas & Carteiras
                            </span>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                color: '#4ADE80',
                                backgroundColor: 'rgba(74, 222, 128, 0.12)',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                fontWeight: 600,
                              }}
                            >
                              Débito imediato
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {accounts
                              .filter(a => a.type !== 'credit_card')
                              .map(acc => {
                                const isSelected = acc.id === accountId;
                                return (
                                  <button
                                    key={acc.id}
                                    type="button"
                                    onClick={() => {
                                      handleAccountChange(acc.id);
                                      setIsAccountSheetOpen(false);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '12px 14px',
                                      borderRadius: '14px',
                                      border: `1px solid ${isSelected ? '#4ADE80' : 'rgba(255, 255, 255, 0.06)'}`,
                                      backgroundColor: isSelected ? 'rgba(74, 222, 128, 0.08)' : '#161F18',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                      <BankLogo bankId={acc.bankId || acc.name} size={36} />
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF' }}>
                                          {acc.name}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
                                          {getAccountTypeLabel(acc.type)}
                                        </div>
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <div
                                        style={{
                                          width: '24px',
                                          height: '24px',
                                          borderRadius: '50%',
                                          backgroundColor: '#4ADE80',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          flexShrink: 0,
                                        }}
                                      >
                                        <Check size={14} color="#0A0E0C" strokeWidth={3} />
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Sheet Modal: Seletor Inteligente de Categorias */}
          {isCategorySheetOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.78)',
                backdropFilter: 'blur(8px)',
                zIndex: (zIndex || 5000) + 100,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}
              onClick={() => {
                setIsCategorySheetOpen(false);
                setCategorySheetDragY(0);
              }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  width: '100%',
                  maxWidth: '480px',
                  height: 'fit-content',
                  maxHeight: '85vh',
                  backgroundColor: '#0F1511',
                  borderTopLeftRadius: '24px',
                  borderTopRightRadius: '24px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderBottom: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  transform: categorySheetDragY > 0 ? `translateY(${categorySheetDragY}px)` : 'none',
                  transition: categorySheetDragY > 0 ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  animation: categorySheetDragY === 0 ? 'accountSheetSlideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
                }}
              >
                {/* Pull Handle & Header com suporte a arraste tátil */}
                <div
                  onTouchStart={handleCategorySheetTouchStart}
                  onTouchMove={handleCategorySheetTouchMove}
                  onTouchEnd={handleCategorySheetTouchEnd}
                  style={{
                    cursor: 'grab',
                    touchAction: 'none',
                    userSelect: 'none',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '5px',
                      borderRadius: '3px',
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      margin: '12px auto 6px auto',
                    }}
                  />

                  {/* Header do Sheet */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 20px 14px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF' }}>
                        {type === 'income' ? 'Categoria da Receita' : 'Categoria da Despesa'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
                        {type === 'income'
                          ? 'Selecione a classificação desta entrada'
                          : 'Selecione a classificação desta saída'}
                      </div>
                    </div>

                    {onOpenNewCategory && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCategorySheetOpen(false);
                          setCategorySheetDragY(0);
                          onOpenNewCategory();
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(74, 222, 128, 0.12)',
                          border: '1px solid rgba(74, 222, 128, 0.25)',
                          color: '#4ADE80',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Plus size={14} /> Nova
                      </button>
                    )}
                  </div>
                </div>

                {/* Lista de Categorias com Scroll Suave */}
                <div
                  style={{
                    padding: '16px 20px calc(48px + var(--safe-area-bottom, 0px))',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    flex: 1,
                  }}
                >
                  {filteredCategories.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
                      Nenhuma categoria disponível para este tipo.
                    </div>
                  ) : (
                    filteredCategories.map(cat => {
                      const isSelected = cat.id === categoryId;
                      const catColor = cat.color || (type === 'income' ? '#4ADE80' : '#EF4444');
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setCategoryId(cat.id);
                            setHasManuallySelectedCategory(true);
                            setSuggestedCategoryTag(null);
                            setIsCategorySheetOpen(false);
                            setCategorySheetDragY(0);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: '14px',
                            border: `1px solid ${isSelected ? catColor : 'rgba(255, 255, 255, 0.06)'}`,
                            backgroundColor: isSelected ? `${catColor}15` : '#161F18',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '12px',
                                backgroundColor: `${catColor}20`,
                                color: catColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <IconRenderer name={cat.icon || 'Tag'} size={20} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF' }}>
                                {cat.name}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '1px' }}>
                                {type === 'income' ? 'Receita' : 'Despesa'}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <div
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: catColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Check size={14} color="#0A0E0C" strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
