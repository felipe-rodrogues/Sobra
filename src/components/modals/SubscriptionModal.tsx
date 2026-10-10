import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Switch } from '../common/Switch';
import { BankLogo } from '../common/BankLogo';
import { SharedBadge } from '../common/SharedBadge';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Subscription, SubscriptionCadence, SubscriptionStatus } from '../../core/types';
import { parseBrlCurrency, formatCurrencyInput } from '../../core/parsers/currencyHelper';
import { extractCardLastDigits } from '../../core/cards/cardSelectionHelper';
import { Users, ChevronDown, Check, X, CreditCard, Landmark, Wallet } from 'lucide-react';
import { SubscriptionLogo } from '../subscriptions/SubscriptionLogo';
import { sortCategoriesIntelligently } from '../../core/categorization/categoryOrdering';

const getAccountTypeLabel = (type?: string) => {
  switch (type) {
    case 'credit_card':
      return 'Cartão de crédito';
    case 'checking':
      return 'Conta corrente';
    case 'savings':
      return 'Poupança';
    case 'investment':
      return 'Investimentos';
    case 'cash':
      return 'Dinheiro / Carteira';
    default:
      return 'Conta bancária';
  }
};

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Subscription | null;
  initialIsShared?: boolean;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  initialData,
  initialIsShared,
}) => {
  const { accounts, categories, transactions, saveSubscription, suggestCategoryForMerchant, isPartnershipActive, partnershipSpace } = useFinance();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [cadence, setCadence] = useState<SubscriptionCadence>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [isShared, setIsShared] = useState(false);
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
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
      setIsAccountDrawerOpen(false);
    }
    setSheetDragY(0);
    sheetTouchStartY.current = null;
  };

  const prevIsOpenRef = useRef(false);
  const prevInitialDataIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const isTransitionToOpen = isOpen && !prevIsOpenRef.current;
    const isInitialDataChanged = initialData?.id !== prevInitialDataIdRef.current;
    prevIsOpenRef.current = isOpen;
    prevInitialDataIdRef.current = initialData?.id;

    if (!isOpen) return;
    if (!isTransitionToOpen && !isInitialDataChanged) return;

    if (initialData) {
      setName(initialData.name);
      setAmountStr(formatCurrencyInput(initialData.amount));
      setCategoryId(initialData.categoryId);
      setAccountId(initialData.accountId || '');
      setCadence(initialData.cadence);
      setNextBillingDate(initialData.nextBillingDate.substring(0, 10));
      setStatus(initialData.status);
      const linkedAcc = accounts.find(a => a.id === initialData.accountId);
      if (linkedAcc) {
        setIsShared(Boolean(linkedAcc.isShared));
      } else {
        setIsShared(initialIsShared !== undefined ? initialIsShared : Boolean(initialData.isShared));
      }
    } else {
      setName('');
      setAmountStr('');
      const defaultCat = categories.find(c => c.name.toLowerCase().includes('lazer')) || 
                         categories.find(c => c.type === 'expense') || 
                         categories[0];
      setCategoryId(defaultCat?.id || '');
      const sharedCard = accounts.find(a => a.isShared);
      const chosenAcc = (initialIsShared && sharedCard) ? sharedCard : (accounts[0] || null);
      setAccountId(chosenAcc?.id || '');
      setCadence('monthly');

      // Padrão: 30 dias a partir de hoje
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      setNextBillingDate(defaultDate.toISOString().substring(0, 10));
      setStatus('active');
      setIsShared(initialIsShared !== undefined ? initialIsShared : Boolean(chosenAcc?.isShared));
    }
    setIsAccountDrawerOpen(false);
    setSheetDragY(0);
  }, [initialData, isOpen, accounts, categories, initialIsShared]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!initialData && val.trim().length >= 3) {
      const suggested = suggestCategoryForMerchant(val);
      if (suggested && suggested.type === 'expense') {
        setCategoryId(suggested.id);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseBrlCurrency(amountStr);
    if (!numericAmount || numericAmount <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }
    if (!name.trim()) {
      alert('Informe o nome da assinatura.');
      return;
    }
    if (!categoryId) {
      alert('Selecione uma categoria.');
      return;
    }
    if (!nextBillingDate) {
      alert('Informe a data da próxima cobrança.');
      return;
    }

    const linkedAcc = accounts.find(a => a.id === accountId);
    const effectiveIsShared = linkedAcc
      ? Boolean(linkedAcc.isShared)
      : (isPartnershipActive ? isShared : false);

    await saveSubscription({
      id: initialData?.id,
      name: name.trim(),
      amount: numericAmount,
      categoryId,
      accountId: accountId || undefined,
      cadence,
      nextBillingDate,
      dayOfMonth: initialData?.dayOfMonth || (nextBillingDate ? parseInt(nextBillingDate.split('-')[2], 10) : undefined),
      status,
      previousAmount: initialData?.previousAmount,
      lastChargeDate: initialData?.lastChargeDate,
      isShared: effectiveIsShared,
      ownerId: effectiveIsShared ? (initialData?.ownerId || user?.id || 'current-user') : undefined,
      ownerName: effectiveIsShared ? (initialData?.ownerName || user?.displayName || 'Você') : undefined,
    });

    setIsAccountDrawerOpen(false);
    onClose();
  };

  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === accountId),
    [accounts, accountId]
  );

  const creditCardAccounts = useMemo(
    () => accounts.filter(a => a.type === 'credit_card'),
    [accounts]
  );

  const otherAccounts = useMemo(
    () => accounts.filter(a => a.type !== 'credit_card'),
    [accounts]
  );

  const expenseCategories = useMemo(
    () => sortCategoriesIntelligently(categories.filter(c => c.type === 'expense'), transactions),
    [categories, transactions]
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={initialData ? 'Editar Assinatura' : 'Nova Assinatura'}
        subtitle="Gerencie suas despesas recorrentes e serviços contratados"
      >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Nome do Serviço */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Nome do Serviço / Assinatura *
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <SubscriptionLogo
              name={name}
              category={categories.find(c => c.id === categoryId)}
              size={42}
            />
            <input
              type="text"
              required
              placeholder="Ex: Netflix, Spotify, Academia, Internet"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceElevated,
                color: colors.textPrimary,
                fontSize: '0.95rem',
              }}
            />
          </div>
        </div>

        {/* Valor e Cadência */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
              Valor *
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '12px', fontWeight: 700, color: colors.expense }}>
                R$
              </span>
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="0,00"
                value={amountStr}
                onChange={e => setAmountStr(formatCurrencyInput(e.target.value, amountStr))}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: '10px',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surfaceElevated,
                  color: colors.textPrimary,
                  fontSize: '1.1rem',
                  fontWeight: 700,
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
              Frequência *
            </label>
            <select
              value={cadence}
              onChange={e => setCadence(e.target.value as SubscriptionCadence)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceElevated,
                color: colors.textPrimary,
                fontSize: '0.95rem',
              }}
            >
              <option value="monthly">Mensal (~30 dias)</option>
              <option value="yearly">Anual (~365 dias)</option>
            </select>
          </div>
        </div>

        {/* Categoria */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Categoria *
          </label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
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
            {expenseCategories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Conta Vinculada - Seletor Premium com Gaveta (Drawer) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Cobrado em (Conta / Cartão)
          </label>
          <button
            type="button"
            onClick={() => setIsAccountDrawerOpen(true)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              border: `1px solid ${selectedAccount ? 'rgba(255, 255, 255, 0.12)' : colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              {selectedAccount ? (
                <>
                  <div style={{ flexShrink: 0 }}>
                    <BankLogo bankId={selectedAccount.bankId || selectedAccount.name} size={30} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#FFFFFF' }}>
                        {selectedAccount.name}
                      </span>
                      {extractCardLastDigits(selectedAccount) && !selectedAccount.name.includes(extractCardLastDigits(selectedAccount)) && (
                        <span style={{ color: '#38BDF8', fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 600 }}>
                          • {extractCardLastDigits(selectedAccount)}
                        </span>
                      )}
                      {selectedAccount.isShared && (
                        <SharedBadge size="sm" />
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: colors.textSecondary, marginTop: '2px' }}>
                      {getAccountTypeLabel(selectedAccount.type)}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: colors.textSecondary,
                      flexShrink: 0,
                    }}
                  >
                    <Wallet size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 500, color: colors.textPrimary }}>
                      Não especificado
                    </div>
                    <div style={{ fontSize: '0.74rem', color: colors.textSecondary }}>
                      Nenhuma conta ou cartão vinculado
                    </div>
                  </div>
                </>
              )}
            </div>

            <ChevronDown size={18} color={colors.textSecondary} style={{ flexShrink: 0, marginLeft: '8px' }} />
          </button>
        </div>

        {/* Toggle Assinatura Conjunta (Finanças a Dois) */}
        {(isPartnershipActive || isShared) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: isShared ? 'rgba(74, 222, 128, 0.05)' : colors.surfaceElevated,
              border: isShared ? '1px solid rgba(74, 222, 128, 0.35)' : `1px solid ${colors.border}`,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  backgroundColor: isShared ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isShared ? '#4ADE80' : colors.textSecondary,
                }}
              >
                <Users size={16} strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: colors.textPrimary }}>
                  Assinatura da Casa (Finanças a Dois)
                </div>
                <div style={{ fontSize: '0.73rem', color: colors.textSecondary, marginTop: '2px' }}>
                  {accounts.find(a => a.id === accountId)?.isShared 
                    ? 'Detectada automaticamente pelo cartão conjunto' 
                    : 'Compartilhar custo fixo com o parceiro(a)'}
                </div>
              </div>
            </div>

            <Switch
              checked={isShared}
              onChange={setIsShared}
              activeColor="#4ADE80"
            />
          </div>
        )}

        {/* Próxima Cobrança */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Próxima Cobrança Prevista *
          </label>
          <input
            type="date"
            required
            value={nextBillingDate}
            onChange={e => setNextBillingDate(e.target.value)}
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

        {/* Status (Ativa / Pausada) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Status da Assinatura
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setStatus('active')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.88rem',
                backgroundColor: status === 'active' ? 'rgba(16, 185, 129, 0.15)' : colors.surfaceElevated,
                color: status === 'active' ? colors.primary : colors.textSecondary,
                border: `1px solid ${status === 'active' ? colors.primary : colors.border}`,
              }}
            >
              Ativa
            </button>
            <button
              type="button"
              onClick={() => setStatus('cancelled')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.88rem',
                backgroundColor: status === 'cancelled' ? 'rgba(239, 68, 68, 0.15)' : colors.surfaceElevated,
                color: status === 'cancelled' ? colors.expense : colors.textSecondary,
                border: `1px solid ${status === 'cancelled' ? colors.expense : colors.border}`,
              }}
            >
              Cancelada / Pausada
            </button>
          </div>
        </div>

        {/* Botões de Ação */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            {initialData ? 'Salvar Alterações' : 'Adicionar Assinatura'}
          </Button>
        </div>
      </form>
    </Modal>

    {/* Gaveta (Bottom Sheet Drawer) Premium para Seleção de Conta / Cartão */}
    {isAccountDrawerOpen && typeof document !== 'undefined' && createPortal(
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.78)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 10050,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
        onClick={() => {
          setIsAccountDrawerOpen(false);
          setSheetDragY(0);
        }}
      >
        <style>{`
          @keyframes subAccountDrawerSlideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '480px',
            maxHeight: '82vh',
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
            animation: sheetDragY === 0 ? 'subAccountDrawerSlideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
          }}
        >
          {/* Pull Handle & Header com gesto de arrasto */}
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

            <div
              style={{
                padding: '10px 20px 14px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF' }}>
                  Cobrado em qual conta?
                </div>
                <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: '2px' }}>
                  Selecione o cartão ou conta de onde a assinatura é debitada
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAccountDrawerOpen(false);
                  setSheetDragY(0);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#94A3B8',
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Lista com rolagem suave */}
          <div
            style={{
              padding: '16px 20px calc(24px + max(var(--safe-area-bottom, 0px), env(safe-area-inset-bottom, 0px)))',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Opção: Não especificado */}
            <div>
              <button
                type="button"
                onClick={() => {
                  setAccountId('');
                  setIsShared(false);
                  setIsAccountDrawerOpen(false);
                  setSheetDragY(0);
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  border: !accountId ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                  backgroundColor: !accountId ? 'rgba(255, 255, 255, 0.08)' : '#161F18',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94A3B8',
                    }}
                  >
                    <Wallet size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.94rem', fontWeight: 600, color: '#FFFFFF' }}>
                      Não especificado
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '2px' }}>
                      Não vincular a nenhuma conta ou cartão
                    </div>
                  </div>
                </div>

                {!accountId && (
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
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
            </div>

            {/* 1. Cartões de Crédito */}
            {creditCardAccounts.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#38BDF8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <CreditCard size={14} /> Cartões de Crédito
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {creditCardAccounts.map(acc => {
                    const isSelected = acc.id === accountId;
                    const cardDigits = extractCardLastDigits(acc);
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setAccountId(acc.id);
                          setIsShared(Boolean(acc.isShared));
                          setIsAccountDrawerOpen(false);
                          setSheetDragY(0);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: '14px',
                          border: isSelected ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.06)',
                          backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.08)' : '#161F18',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                          <div style={{ flexShrink: 0 }}>
                            <BankLogo bankId={acc.bankId || acc.name} size={36} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flexShrink: 1 }}>
                                {acc.name}
                              </span>
                              {cardDigits && !acc.name.includes(cardDigits) && (
                                <span style={{ color: '#38BDF8', fontFamily: 'monospace', fontSize: '0.84rem', fontWeight: 600, flexShrink: 0 }}>
                                  • {cardDigits}
                                </span>
                              )}
                              {acc.isShared && (
                                <SharedBadge size="sm" />
                              )}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '2px' }}>
                              Cartão de crédito
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
                              marginLeft: '10px',
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
            {otherAccounts.length > 0 && (
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
                  <Landmark size={14} /> Contas & Carteiras
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {otherAccounts.map(acc => {
                    const isSelected = acc.id === accountId;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setAccountId(acc.id);
                          setIsShared(Boolean(acc.isShared));
                          setIsAccountDrawerOpen(false);
                          setSheetDragY(0);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: '14px',
                          border: isSelected ? '1px solid #4ADE80' : '1px solid rgba(255, 255, 255, 0.06)',
                          backgroundColor: isSelected ? 'rgba(74, 222, 128, 0.08)' : '#161F18',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                          <div style={{ flexShrink: 0 }}>
                            <BankLogo bankId={acc.bankId || acc.name} size={36} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flexShrink: 1 }}>
                                {acc.name}
                              </span>
                              {acc.isShared && (
                                <SharedBadge size="sm" />
                              )}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '2px' }}>
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
                              marginLeft: '10px',
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
          </div>
        </div>
      </div>,
      document.body
    )}
  </>
  );
};
