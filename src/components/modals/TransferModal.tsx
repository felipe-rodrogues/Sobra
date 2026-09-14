import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { BankLogo } from '../common/BankLogo';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { formatBrlCurrency, parseBrlCurrency } from '../../core/parsers/currencyHelper';
import { ArrowRight, ArrowLeftRight, AlertCircle } from 'lucide-react';

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
  const { colors } = useTheme();

  // Apenas contas bancárias e dinheiro podem ser origem/destino de transferências
  const validAccounts = accounts.filter(a => a.type !== 'credit_card');

  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().substring(0, 10);
      setDateStr(today);
      setAmountStr('');
      setDescription('Transferência entre contas');

      const defaultFrom = initialSourceAccountId || validAccounts[0]?.id || '';
      setFromAccountId(defaultFrom);

      const defaultTo = validAccounts.find(a => a.id !== defaultFrom)?.id || '';
      setToAccountId(defaultTo);
    }
  }, [isOpen, initialSourceAccountId]);

  const sourceAccount = accounts.find(a => a.id === fromAccountId);
  const destinationAccount = accounts.find(a => a.id === toAccountId);

  const numericAmount = parseBrlCurrency(amountStr) || 0;
  const isInsufficientFunds = sourceAccount ? numericAmount > sourceAccount.balance : false;

  const quickPills = [50, 100, 200, 500];

  const handleQuickAmount = (val: number) => {
    setAmountStr(val.toFixed(2).replace('.', ','));
  };

  const handleTransferAll = () => {
    if (sourceAccount && sourceAccount.balance > 0) {
      setAmountStr(sourceAccount.balance.toFixed(2).replace('.', ','));
    }
  };

  const handleSwapAccounts = () => {
    const temp = fromAccountId;
    setFromAccountId(toAccountId);
    setToAccountId(temp);
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
        description: description.trim() || `Transferência de ${sourceAccount?.name} para ${destinationAccount?.name}`,
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transferência entre Contas"
      subtitle="Mova saldo entre suas contas próprias sem alterar receitas e despesas"
      maxWidth="500px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Bloco Visual: Origem ➔ Destino */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: '10px',
            alignItems: 'center',
            backgroundColor: colors.surfaceElevated,
            borderRadius: '16px',
            padding: '14px',
            border: `1px solid ${colors.border}`,
          }}
        >
          {/* Conta de Origem */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase' }}>
              De (Origem)
            </span>
            <select
              value={fromAccountId}
              onChange={e => {
                setFromAccountId(e.target.value);
                if (e.target.value === toAccountId) {
                  const other = validAccounts.find(a => a.id !== e.target.value);
                  if (other) setToAccountId(other.id);
                }
              }}
              style={{
                padding: '10px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
                color: colors.textPrimary,
                fontSize: '0.85rem',
                fontWeight: 600,
                width: '100%',
              }}
            >
              {validAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({formatBrlCurrency(acc.balance)})
                </option>
              ))}
            </select>
            {sourceAccount && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <BankLogo bankId={sourceAccount.bankId || sourceAccount.name} size={18} />
                <span style={{ fontSize: '0.74rem', color: colors.textMuted }}>
                  Saldo: <strong style={{ color: sourceAccount.balance >= 0 ? colors.income : colors.expense }}>{formatBrlCurrency(sourceAccount.balance)}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Botão de Inverter / Ícone central */}
          <button
            type="button"
            onClick={handleSwapAccounts}
            title="Inverter contas"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: `1px solid ${colors.primary}`,
              color: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
          >
            <ArrowLeftRight size={16} />
          </button>

          {/* Conta de Destino */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase' }}>
              Para (Destino)
            </span>
            <select
              value={toAccountId}
              onChange={e => {
                setToAccountId(e.target.value);
                if (e.target.value === fromAccountId) {
                  const other = validAccounts.find(a => a.id !== e.target.value);
                  if (other) setFromAccountId(other.id);
                }
              }}
              style={{
                padding: '10px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
                color: colors.textPrimary,
                fontSize: '0.85rem',
                fontWeight: 600,
                width: '100%',
              }}
            >
              {validAccounts.map(acc => (
                <option key={acc.id} value={acc.id} disabled={acc.id === fromAccountId}>
                  {acc.name} ({formatBrlCurrency(acc.balance)})
                </option>
              ))}
            </select>
            {destinationAccount && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <BankLogo bankId={destinationAccount.bankId || destinationAccount.name} size={18} />
                <span style={{ fontSize: '0.74rem', color: colors.textMuted }}>
                  Saldo: <strong style={{ color: destinationAccount.balance >= 0 ? colors.income : colors.expense }}>{formatBrlCurrency(destinationAccount.balance)}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Campo de Valor com Atalhos Rápidos */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: colors.textPrimary, marginBottom: '6px' }}>
            Valor da Transferência (R$) *
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '14px', fontWeight: 700, color: colors.primary, fontSize: '1.2rem' }}>
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
                padding: '12px 14px 12px 48px',
                borderRadius: '12px',
                border: `1px solid ${isInsufficientFunds ? colors.expense : colors.border}`,
                backgroundColor: colors.surfaceElevated,
                color: colors.textPrimary,
                fontSize: '1.3rem',
                fontWeight: 800,
              }}
            />
          </div>

          {/* Atalhos de Valores Rápidos */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            {quickPills.map(val => (
              <button
                type="button"
                key={val}
                onClick={() => handleQuickAmount(val)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: colors.surfaceElevated,
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                }}
              >
                +R$ {val}
              </button>
            ))}

            {sourceAccount && sourceAccount.balance > 0 && (
              <button
                type="button"
                onClick={handleTransferAll}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: colors.primary,
                  border: `1px solid ${colors.primary}`,
                  cursor: 'pointer',
                }}
              >
                Transferir Tudo ({formatBrlCurrency(sourceAccount.balance)})
              </button>
            )}
          </div>

          {isInsufficientFunds && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: colors.expense }}>
              <AlertCircle size={14} />
              <span style={{ fontSize: '0.75rem' }}>
                O valor informado ultrapassa o saldo disponível na conta de origem.
              </span>
            </div>
          )}
        </div>

        {/* Data & Atalhos de Data */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Data da Transferência
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="date"
              required
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceElevated,
                color: colors.textPrimary,
                fontSize: '0.9rem',
              }}
            />
            <button
              type="button"
              onClick={() => setDateStr(new Date().toISOString().substring(0, 10))}
              style={{
                padding: '9px 12px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceElevated,
                color: colors.textSecondary,
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Hoje
            </button>
          </div>
        </div>

        {/* Descrição / Motivo */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Descrição / Motivo (Opcional)
          </label>
          <input
            type="text"
            placeholder="Ex: Reserva de emergência, Envio para poupança"
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceElevated,
              color: colors.textPrimary,
              fontSize: '0.9rem',
            }}
          />
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting} icon={<ArrowRight size={16} />}>
            {isSubmitting ? 'Transferindo...' : 'Confirmar Transferência'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
