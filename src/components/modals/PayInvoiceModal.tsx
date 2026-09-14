import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { BankLogo } from '../common/BankLogo';
import { CardBrandLogo } from '../common/MastercardLogo';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { Account } from '../../core/types';
import { formatBrlCurrency, parseBrlCurrency } from '../../core/parsers/currencyHelper';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface PayInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: Account | null;
}

export const PayInvoiceModal: React.FC<PayInvoiceModalProps> = ({
  isOpen,
  onClose,
  card,
}) => {
  const { accounts, saveTransaction, saveAccount } = useFinance();
  const { colors } = useTheme();

  const [fromAccountId, setFromAccountId] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Contas disponíveis para pagar (contas correntes, carteiras, etc.)
  const paymentAccounts = accounts.filter(a => a.type !== 'credit_card');

  useEffect(() => {
    if (card) {
      const invoiceVal = card.invoiceAmount ?? Math.abs(card.balance);
      setAmountStr(invoiceVal > 0 ? invoiceVal.toFixed(2).replace('.', ',') : '0,00');
      setDateStr(new Date().toISOString().substring(0, 10));

      // Por padrão, não seleciona conta (apenas dá baixa na fatura)
      setFromAccountId('');
    }
  }, [card, isOpen]);

  if (!card) return null;

  const invoiceAmount = card.invoiceAmount ?? Math.abs(card.balance);
  const selectedSourceAccount = accounts.find(a => a.id === fromAccountId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payVal = parseBrlCurrency(amountStr);

    if (!payVal || payVal <= 0) {
      alert('Informe um valor de pagamento válido.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Se o usuário optou por debitar de uma conta bancária cadastrada:
      if (fromAccountId) {
        await saveTransaction({
          accountId: fromAccountId,
          categoryId: 'cat-outros',
          amount: payVal,
          type: 'expense',
          description: `Pagamento Fatura ${card.name}`,
          date: `${dateStr}T12:00:00.000Z`,
          status: 'confirmed',
          paymentMethod: 'transfer',
          source: 'manual',
        });
      }

      // 2. Abater o valor da fatura do cartão
      const newCardBalance = Math.max(0, (card.balance || 0) - payVal);
      const newInvoiceAmount = Math.max(0, (card.invoiceAmount || 0) - payVal);

      await saveAccount({
        ...card,
        balance: newCardBalance,
        invoiceAmount: newInvoiceAmount,
        openAmount: card.openAmount !== undefined ? Math.max(0, card.openAmount - payVal) : newCardBalance,
        invoiceStatus: newInvoiceAmount === 0 ? 'paid' : card.invoiceStatus,
      });

      onClose();
    } catch (err) {
      console.error('Erro ao registrar pagamento de fatura:', err);
      alert('Ocorreu um erro ao registrar o pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Pagamento de Fatura"
      subtitle={`Quitação da fatura do ${card.name}`}
      maxWidth="480px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Card Resumo da Fatura */}
        <div
          style={{
            padding: '16px',
            borderRadius: '16px',
            backgroundColor: colors.surfaceElevated,
            border: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BankLogo bankId={card.bankId || card.name} size={42} />
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: colors.textPrimary }}>
                {card.name}
              </div>
              <CardBrandLogo brand={card.cardBrand || 'mastercard'} size={12} />
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.72rem', color: colors.textSecondary, textTransform: 'uppercase' }}>
              Valor da Fatura
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: colors.expense }}>
              {formatBrlCurrency(invoiceAmount)}
            </div>
          </div>
        </div>

        {/* Valor a Pagar */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Valor do Pagamento (R$) *
          </label>
          <input
            type="text"
            required
            value={amountStr}
            onChange={e => setAmountStr(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '1.2rem',
              fontWeight: 800,
            }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={() => setAmountStr(invoiceAmount.toFixed(2).replace('.', ','))}
              style={{
                fontSize: '0.75rem',
                color: colors.primary,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                textDecoration: 'underline',
              }}
            >
              Pagar valor total ({formatBrlCurrency(invoiceAmount)})
            </button>
          </div>
        </div>

        {/* Conta Bancária de Origem (Opcional) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Debitar de uma Conta (Opcional)
          </label>
          <select
            value={fromAccountId}
            onChange={e => setFromAccountId(e.target.value)}
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.95rem',
            }}
          >
            <option value="">Nenhuma — Apenas dar baixa na fatura</option>
            {paymentAccounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.name} — Saldo: {formatBrlCurrency(acc.balance)}
              </option>
            ))}
          </select>
          {!fromAccountId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#94A3B8', fontSize: '0.75rem' }}>
              <Info size={14} color="#38BDF8" />
              <span>A fatura será quitada sem alterar o saldo de nenhuma conta bancária.</span>
            </div>
          ) : (
            selectedSourceAccount && selectedSourceAccount.balance < (parseBrlCurrency(amountStr) || 0) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: colors.budgetWarning, fontSize: '0.75rem' }}>
                <AlertCircle size={14} />
                <span>Atenção: O saldo desta conta é menor que o valor a pagar.</span>
              </div>
            )
          )}
        </div>

        {/* Data do Pagamento */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Data do Pagamento *
          </label>
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

        {/* Botões de Ação */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px', justifyContent: 'flex-end' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={<CheckCircle2 size={16} />}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processando...' : 'Confirmar Pagamento'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
