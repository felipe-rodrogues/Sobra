import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { BankLogo } from '../common/BankLogo';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { PendingNotification } from '../../core/types';
import { formatBrlCurrency, parseBrlCurrency } from '../../core/parsers/currencyHelper';
import { ShieldCheck, Check, Trash2, Wallet, Repeat, Sparkles, AlertTriangle, Plus, Minus, CheckCircle2, Layers, X, Gift, RotateCcw } from 'lucide-react';

import { Switch } from '../common/Switch';
import { SubscriptionCadence } from '../../core/types';
import { getBankById } from '../../core/banks/bankCatalog';

interface NotificationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  notification: PendingNotification | null;
  onOpenNewAccount?: (bankId?: string) => void;
}

export const NotificationReviewModal: React.FC<NotificationReviewModalProps> = ({
  isOpen,
  onClose,
  notification,
  onOpenNewAccount,
}) => {
  const { 
    accounts, 
    categories, 
    subscriptions,
    approveNotification, 
    discardNotification,
    checkIfLikelySubscription,
    saveAccount,
  } = useFinance();
  const { colors } = useTheme();

  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [syncAccountBalance, setSyncAccountBalance] = useState(true);
  const [hasAnsweredPixPrompt, setHasAnsweredPixPrompt] = useState(false);

  // Estados do aviso de conta ausente e criação rápida
  const [ignoredMissingAccount, setIgnoredMissingAccount] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [createdAccountFeedback, setCreatedAccountFeedback] = useState<string | null>(null);

  // Estados de Assinatura Recorrente
  const [isSubscription, setIsSubscription] = useState(false);
  const [subscriptionCadence, setSubscriptionCadence] = useState<SubscriptionCadence>('monthly');
  const [proactiveSuggestion, setProactiveSuggestion] = useState<{
    isLikely: boolean;
    cadence: SubscriptionCadence;
    reason: string;
    serviceName?: string;
  } | null>(null);

  // Estados de Parcelamento
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(2);

  // Identificação do banco detectado da notificação
  const detectedBank = notification ? getBankById(notification.bankId) : undefined;
  const bankDisplayName = detectedBank?.shortName || detectedBank?.name || notification?.bankName || 'Banco';
  const detectedBankId = (notification?.bankId || detectedBank?.id || '').toLowerCase();

  // O app checa: existe alguma conta com bankId='[banco]' cadastrada?
  const matchingAccount = accounts.find(a => 
    (detectedBankId && a.bankId && a.bankId.toLowerCase() === detectedBankId) ||
    (notification?.suggestedAccountId && a.id === notification.suggestedAccountId) ||
    (notification?.bankName && a.name.toLowerCase().includes(notification.bankName.toLowerCase()))
  );
  const hasMatchingAccount = !!matchingAccount;

  useEffect(() => {
    if (notification) {
      setDescription(notification.parsedMerchant);
      setAmountStr(notification.parsedAmount.toString().replace('.', ','));
      setType(notification.parsedType);
      setSyncAccountBalance(notification.detectedBalance !== null && notification.detectedBalance !== undefined);
      setIgnoredMissingAccount(false);
      setCreatedAccountFeedback(null);
      setHasAnsweredPixPrompt(false);
      setIsInstallment(!!notification.isInstallment);
      setInstallmentCount(notification.installmentCount || 2);

      // SIM -> Seleciona automaticamente (como já faz hoje)
      // NÃO -> Mantém accounts[0] ou vazia se não houver
      const bankIdLower = (notification.bankId || '').toLowerCase();
      const targetAcc = accounts.find(a => 
        (bankIdLower && a.bankId && a.bankId.toLowerCase() === bankIdLower) ||
        a.id === notification.suggestedAccountId ||
        a.name.toLowerCase().includes(notification.bankName.toLowerCase())
      ) || accounts[0];
      
      setAccountId(targetAcc?.id || '');

      // Categoria sugerida
      const targetCat = categories.find(c => c.id === notification.suggestedCategoryId) || 
                        categories.find(c => c.type === notification.parsedType) || 
                        categories[0];
      setCategoryId(targetCat?.id || '');

      // Avaliação se é assinatura
      const normMerchant = notification.parsedMerchant.toLowerCase();
      const alreadySub = subscriptions.some(s => s.name.toLowerCase() === normMerchant);
      const likely = checkIfLikelySubscription(notification.parsedMerchant, notification.parsedAmount);

      setIsSubscription(alreadySub || likely.isLikely);
      setSubscriptionCadence(likely.cadence || 'monthly');
      setProactiveSuggestion(likely.isLikely ? likely : null);
    }
  }, [notification, accounts, categories, subscriptions, checkIfLikelySubscription]);

  const handleQuickCreateAccount = async () => {
    if (!notification) return;
    setIsCreatingAccount(true);
    try {
      const isCredit = notification.parsedPaymentMethod === 'credit' || notification.isInstallment;
      const targetBank = getBankById(notification.bankId);
      const newAcc = await saveAccount({
        name: targetBank?.name || bankDisplayName,
        type: isCredit ? 'credit_card' : 'checking',
        bankId: detectedBankId || targetBank?.id || 'cash',
        color: targetBank?.color || colors.primary,
        icon: detectedBankId || 'landmark',
        currency: 'BRL',
        balance: notification.detectedBalance ?? 0,
        creditLimit: isCredit ? 2000 : undefined,
        closingDay: isCredit ? 1 : undefined,
        dueDay: isCredit ? 8 : undefined,
        syncStatus: 'manual',
      });
      setAccountId(newAcc.id);
      setCreatedAccountFeedback(`Conta ${bankDisplayName} cadastrada e selecionada com sucesso!`);
    } catch (err) {
      console.error('Erro ao cadastrar conta rápida:', err);
      alert('Não foi possível cadastrar a conta automaticamente.');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  if (!notification) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseBrlCurrency(amountStr);
    if (!num || num <= 0) {
      alert('Informe um valor válido.');
      return;
    }

    await approveNotification(notification.id, {
      accountId,
      categoryId,
      amount: num,
      description: description.trim(),
      date: new Date().toISOString(),
      type,
      paymentMethod: isInstallment ? 'credit' : notification.parsedPaymentMethod,
      syncAccountBalance,
      asSubscription: isSubscription ? { cadence: subscriptionCadence } : undefined,
      isInstallment: isInstallment && type === 'expense',
      installmentCount: isInstallment ? installmentCount : undefined,
    });

    onClose();
  };

  const handleDiscard = async () => {
    if (confirm('Deseja descartar esta notificação detectada?')) {
      await discardNotification(notification.id);
      onClose();
    }
  };

  const isIncome = notification?.parsedType === 'income';
  const isCashback = notification?.notificationKind === 'cashback';
  const isRefund = notification?.notificationKind === 'refund';
  const isPix = notification?.parsedPaymentMethod === 'pix' || 
                (notification?.rawTitle || '').toLowerCase().includes('pix') || 
                (notification?.rawText || '').toLowerCase().includes('pix');
  const incomeTitle = isPix ? 'Pix Recebido' : 'Entrada Recebida';

  // ── Fluxo Cashback ── pergunta específica: "Deseja registrar como receita?"
  if (isCashback && !hasAnsweredPixPrompt) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Cashback Detectado 🎁"
        subtitle={`${notification.bankName} • ${formatBrlCurrency(notification.parsedAmount)}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0 6px' }}>
          {/* Card com logo do banco e valor */}
          <div
            style={{
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: colors.surfaceElevated,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              backgroundColor: 'rgba(250, 204, 21, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Gift size={22} color="#FACC15" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <span style={{ fontSize: '0.84rem', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {notification.parsedMerchant}
              </span>
              <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#FACC15', fontFamily: "'Outfit', sans-serif" }}>
                +{formatBrlCurrency(notification.parsedAmount)}
              </span>
            </div>
          </div>

          <div
            style={{
              textAlign: 'center',
              fontSize: '1.08rem',
              fontWeight: 700,
              color: colors.textPrimary,
              lineHeight: 1.35,
              padding: '4px 8px',
            }}
          >
            Você ganhou cashback! Deseja registrar como receita?
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.82rem', color: colors.textSecondary, margin: 0 }}>
            Será lançado na categoria <strong>Cashback / Recompensas</strong>.
          </p>

          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                await discardNotification(notification.id);
                onClose();
              }}
              style={{ width: '100%', padding: '12px' }}
            >
              Não
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => setHasAnsweredPixPrompt(true)}
              style={{ width: '100%', padding: '12px' }}
            >
              Sim, registrar
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // ── Fluxo Reembolso ── pergunta específica: "Deseja inserir como crédito na fatura?"
  if (isRefund && !hasAnsweredPixPrompt) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Reembolso / Estorno Detectado ↩️"
        subtitle={`${notification.bankName} • ${formatBrlCurrency(notification.parsedAmount)}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0 6px' }}>
          {/* Card com logo do banco e valor */}
          <div
            style={{
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: colors.surfaceElevated,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              backgroundColor: 'rgba(52, 211, 153, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <RotateCcw size={22} color="#34D399" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <span style={{ fontSize: '0.84rem', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {notification.parsedMerchant}
              </span>
              <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#34D399', fontFamily: "'Outfit', sans-serif" }}>
                +{formatBrlCurrency(notification.parsedAmount)}
              </span>
            </div>
          </div>

          <div
            style={{
              textAlign: 'center',
              fontSize: '1.08rem',
              fontWeight: 700,
              color: colors.textPrimary,
              lineHeight: 1.35,
              padding: '4px 8px',
            }}
          >
            Reembolso detectado. Deseja inserir como crédito na fatura?
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.82rem', color: colors.textSecondary, margin: 0 }}>
            O valor será lançado como <strong>crédito (entrada)</strong> na conta selecionada.
          </p>

          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                await discardNotification(notification.id);
                onClose();
              }}
              style={{ width: '100%', padding: '12px' }}
            >
              Não
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => setHasAnsweredPixPrompt(true)}
              style={{ width: '100%', padding: '12px' }}
            >
              Sim, inserir crédito
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // Pergunta Inteligente para Entradas/Pix: "Deseja adicionar esse valor às receitas do mês?"
  if (isIncome && !hasAnsweredPixPrompt) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={incomeTitle}
        subtitle={`${notification.bankName} • ${formatBrlCurrency(notification.parsedAmount)}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0 6px' }}>
          {/* Card com logo do banco e valor */}
          <div
            style={{
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: colors.surfaceElevated,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <BankLogo bankId={notification.bankId || notification.bankName} size={40} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <span style={{ fontSize: '0.84rem', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {notification.parsedMerchant}
              </span>
              <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#4ADE80', fontFamily: "'Outfit', sans-serif" }}>
                +{formatBrlCurrency(notification.parsedAmount)}
              </span>
            </div>
          </div>

          {/* Mensagem Exata Solicitada pelo Usuário */}
          <div
            style={{
              textAlign: 'center',
              fontSize: '1.08rem',
              fontWeight: 700,
              color: colors.textPrimary,
              lineHeight: 1.35,
              padding: '4px 8px',
            }}
          >
            Deseja adicionar esse valor às receitas do mês?
          </div>

          {/* Ações: Não ou Sim */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                await discardNotification(notification.id);
                onClose();
              }}
              style={{ width: '100%', padding: '12px' }}
            >
              Não
            </Button>

            <Button
              type="button"
              variant="primary"
              onClick={() => setHasAnsweredPixPrompt(true)}
              style={{ width: '100%', padding: '12px' }}
            >
              Sim
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Revisar Transação Detectada"
      subtitle="Confirme os detalhes capturados da notificação bancária"
    >
      <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Banner de Origem Local da Notificação */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            backgroundColor: colors.surfaceElevated,
            border: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BankLogo bankId={notification.bankId || notification.bankName} size={24} />
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: colors.textPrimary }}>
                {notification.bankName}
              </span>
            </div>
            <Badge variant="primary" size="sm" icon={<ShieldCheck size={12} />}>
              Processamento 100% Local
            </Badge>
          </div>
          <div style={{ fontSize: '0.8rem', color: colors.textSecondary, fontStyle: 'italic' }}>
            "{notification.rawTitle}: {notification.rawText}"
          </div>
        </div>

        {/* Banner de Alerta de Possível Cobrança Duplicada */}
        {notification.isSuspectedDuplicate && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.09)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} color="#EF4444" />
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#EF4444' }}>
                Possível Cobrança Duplicada Detectada
              </span>
            </div>

            <div style={{ fontSize: '0.82rem', color: colors.textSecondary, lineHeight: 1.45 }}>
              {notification.duplicateReason || 'Já identificamos outra cobrança recente com o mesmo valor e estabelecimento.'}
              <br />
              Esta notificação foi uma <strong>compra real separada</strong> ou trata-se de uma <strong>cobrança repetida por engano</strong>?
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={async () => {
                  await discardNotification(notification.id);
                  onClose();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.25)',
                }}
              >
                <Trash2 size={14} />
                É cobrança duplicada (Descartar)
              </button>

              <span style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                ou revise os campos abaixo e clique em Salvar se for uma compra legítima.
              </span>
            </div>
          </div>
        )}

        {/* Banner de Aviso: Conta do Banco Não Encontrada */}
        {!hasMatchingAccount && !ignoredMissingAccount && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.09)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>⚠️</span>
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#D97706' }}>
                Conta {bankDisplayName} não encontrada
              </span>
            </div>

            <div style={{ fontSize: '0.82rem', color: colors.textSecondary, lineHeight: 1.45 }}>
              Detectamos uma transação do <strong>{bankDisplayName}</strong>, mas você ainda não tem essa conta cadastrada.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={isCreatingAccount}
                onClick={handleQuickCreateAccount}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: detectedBank?.color || colors.primary,
                  color: detectedBank?.textColor || '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: isCreatingAccount ? 'not-allowed' : 'pointer',
                  opacity: isCreatingAccount ? 0.7 : 1,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                }}
              >
                <Plus size={14} />
                {isCreatingAccount ? 'Cadastrando...' : `Cadastrar conta ${bankDisplayName} agora`}
              </button>

              <button
                type="button"
                onClick={() => setIgnoredMissingAccount(true)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${colors.border}`,
                  color: colors.textSecondary,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Ignorar
              </button>

              {onOpenNewAccount && (
                <button
                  type="button"
                  onClick={() => onOpenNewAccount(detectedBankId)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.textSecondary,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    marginLeft: 'auto',
                  }}
                >
                  Personalizar cadastro
                </button>
              )}
            </div>
          </div>
        )}

        {/* Feedback de Conta Cadastrada e Vinculada */}
        {createdAccountFeedback && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={16} color="#10B981" />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: colors.textPrimary }}>
              {createdAccountFeedback}
            </span>
          </div>
        )}

        {/* Saldo da Conta Detectado (se encontrado na notificação) */}
        {notification.detectedBalance !== null && notification.detectedBalance !== undefined && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: `1px solid rgba(16, 185, 129, 0.3)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: colors.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  flexShrink: 0,
                }}
              >
                <Wallet size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: colors.primaryLight }}>
                  Saldo pós-transação detectado: {formatBrlCurrency(notification.detectedBalance)}
                </div>
                <div style={{ fontSize: '0.72rem', color: colors.textSecondary }}>
                  Atualizar saldo da conta automaticamente?
                </div>
              </div>
            </div>

            <input
              type="checkbox"
              checked={syncAccountBalance}
              onChange={e => setSyncAccountBalance(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: colors.primary, cursor: 'pointer' }}
            />
          </div>
        )}

        {/* Valor Detectado */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Valor Detectado *
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '14px', fontWeight: 700, color: type === 'expense' ? colors.expense : colors.income }}>
              R$
            </span>
            <input
              type="text"
              required
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

        {/* Estabelecimento / Nome Detectado */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Estabelecimento / Destinatário Detectado *
          </label>
          <input
            type="text"
            required
            value={description}
            onChange={e => setDescription(e.target.value)}
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

        {/* Conta de Destino */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.85rem', color: colors.textSecondary }}>
              Debitar / Creditar na Conta *
            </label>
            {hasMatchingAccount ? (
              <span style={{ fontSize: '0.75rem', color: colors.primary, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                <Check size={12} /> Conta {bankDisplayName} vinculada
              </span>
            ) : (
              !ignoredMissingAccount && (
                <span style={{ fontSize: '0.75rem', color: '#D97706', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                  ⚠️ Conta {bankDisplayName} ausente
                </span>
              )
            )}
          </div>
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: `1px solid ${!hasMatchingAccount && !ignoredMissingAccount ? 'rgba(245, 158, 11, 0.6)' : colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.95rem',
            }}
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({formatBrlCurrency(acc.balance)})
              </option>
            ))}
          </select>
        </div>

        {/* Categoria Sugerida */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                Categoria *
              </label>
              {notification.suggestedCategoryId && (
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
          </div>
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
            {categories.filter(c => c.type === type).map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sugestão Conversacional de Recorrência (Mobile-first, Pierre style) */}
        {proactiveSuggestion?.isLikely && !isSubscription && (
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
              onClick={() => setIsSubscription(!isSubscription)}
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
                  onChange={checked => setIsSubscription(checked)}
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

        {/* Opção: Compra Parcelada no Cartão */}
        {type === 'expense' && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '14px',
              backgroundColor: isInstallment ? 'rgba(56, 189, 248, 0.04)' : colors.surfaceElevated,
              border: `1px solid ${isInstallment ? 'rgba(56, 189, 248, 0.35)' : colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              onClick={() => {
                const next = !isInstallment;
                setIsInstallment(next);
                if (next) setIsSubscription(false);
              }}
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
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: colors.textPrimary }}>
                    Compra Parcelada no Cartão
                  </div>
                  <div style={{ fontSize: '0.74rem', color: colors.textSecondary, marginTop: '2px' }}>
                    Lançamento automático nas próximas faturas
                  </div>
                </div>
              </div>
              <Switch
                checked={isInstallment}
                onChange={checked => {
                  setIsInstallment(checked);
                  if (checked) setIsSubscription(false);
                }}
                activeColor="#38BDF8"
              />
            </div>

            {isInstallment && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px', borderTop: `1px solid ${colors.border}` }}>
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
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setInstallmentCount(prev => Math.max(2, prev - 1))}
                    disabled={installmentCount <= 2}
                    style={{
                      width: '32px',
                      height: '32px',
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
                  >
                    <Minus size={15} />
                  </button>

                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38BDF8' }}>
                    {installmentCount}x parcelas
                  </span>

                  <button
                    type="button"
                    onClick={() => setInstallmentCount(prev => Math.min(36, prev + 1))}
                    disabled={installmentCount >= 36}
                    style={{
                      width: '32px',
                      height: '32px',
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
                  >
                    <Plus size={15} />
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
                          padding: '5px 0',
                          borderRadius: '8px',
                          border: `1px solid ${isSelected ? '#38BDF8' : colors.border}`,
                          backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : colors.surface,
                          color: isSelected ? '#38BDF8' : colors.textSecondary,
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        {n}x
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const num = parseBrlCurrency(amountStr) || 0;
                  const pVal = installmentCount > 0 ? (num / installmentCount) : 0;
                  return (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: colors.surface,
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', color: colors.textSecondary }}>Fatura mensal:</span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#38BDF8' }}>
                        {installmentCount}x de {formatBrlCurrency(pVal)}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Ações */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            type="button"
            variant="danger"
            icon={<Trash2 size={15} />}
            onClick={handleDiscard}
            style={{
              backgroundColor: 'transparent',
              color: colors.expense,
              border: `1px solid ${colors.expense}`,
              flex: '1 1 95px',
              padding: '10px 12px',
              fontSize: '0.85rem',
            }}
          >
            Descartar
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            style={{
              flex: '1 1 75px',
              padding: '10px 12px',
              fontSize: '0.85rem',
            }}
          >
            Fechar
          </Button>

          <Button
            type="submit"
            variant="primary"
            icon={<Check size={16} />}
            style={{
              flex: '2 1 150px',
              padding: '10px 14px',
              fontSize: '0.85rem',
              whiteSpace: 'nowrap',
            }}
          >
            Confirmar e Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
};
