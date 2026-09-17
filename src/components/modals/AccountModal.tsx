import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import { Button } from '../common/Button';
import { BankLogo } from '../common/BankLogo';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { Account, AccountType } from '../../core/types';
import { parseBrlCurrency } from '../../core/parsers/currencyHelper';
import { MAJOR_BANKS, BankInfo, getBankById } from '../../core/banks/bankCatalog';
import { calculateBestPurchaseDay } from '../../core/cards/cardDateHelper';
import { Check, CreditCard, Wallet, Calendar, Sparkles } from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountToEdit?: Account | null;
  initialBankId?: string;
  zIndex?: number;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  accountToEdit,
  initialBankId,
  zIndex,
}) => {
  const { saveAccount, deleteAccount } = useFinance();
  const { colors } = useTheme();

  const [selectedBankId, setSelectedBankId] = useState<string>('nubank');
  const [name, setName] = useState('Nubank');
  const [type, setType] = useState<AccountType>('credit_card');
  const [balanceStr, setBalanceStr] = useState('');
  const [creditLimitStr, setCreditLimitStr] = useState('');
  const [color, setColor] = useState('#820AD1');
  const [closingDay, setClosingDay] = useState<string>('1');
  const [dueDay, setDueDay] = useState<string>('8');
  const [lastDigits, setLastDigits] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isEditing = !!accountToEdit;

  const colorOptions = [
    { label: 'Roxo Nubank', value: '#820AD1' },
    { label: 'Laranja Itaú', value: '#EC7000' },
    { label: 'Vermelho Bradesco', value: '#CC092F' },
    { label: 'Azul BB', value: '#003882' },
    { label: 'Azul Caixa', value: '#005CA9' },
    { label: 'Vermelho Santander', value: '#EC0000' },
    { label: 'Laranja Inter', value: '#FF7A00' },
    { label: 'Preto C6', value: '#1E293B' },
    { label: 'Azul Mercado Pago', value: '#009EE3' },
    { label: 'Verde PicPay', value: '#11C76F' },
    { label: 'Esmeralda', value: '#10B981' },
  ];

  const datePresets = [
    { label: 'Fecha 01 • Vence 08', closing: '1', due: '8' },
    { label: 'Fecha 10 • Vence 17', closing: '10', due: '17' },
    { label: 'Fecha 20 • Vence 28', closing: '20', due: '28' },
    { label: 'Fecha 25 • Vence 05', closing: '25', due: '5' },
  ];

  useEffect(() => {
    if (accountToEdit) {
      setName(accountToEdit.name);
      setType(accountToEdit.type);
      setColor(accountToEdit.color || '#820AD1');
      setSelectedBankId(accountToEdit.bankId || 'nubank');
      setClosingDay(accountToEdit.closingDay ? String(accountToEdit.closingDay) : '1');
      setDueDay(accountToEdit.dueDay ? String(accountToEdit.dueDay) : '8');
      setLastDigits(accountToEdit.lastDigits || '');

      if (accountToEdit.type === 'credit_card') {
        const fatura = accountToEdit.invoiceAmount ?? Math.abs(accountToEdit.balance);
        setBalanceStr(fatura > 0 ? fatura.toFixed(2).replace('.', ',') : '');
        setCreditLimitStr(accountToEdit.creditLimit ? accountToEdit.creditLimit.toFixed(2).replace('.', ',') : '');
      } else {
        setBalanceStr(accountToEdit.balance ? accountToEdit.balance.toFixed(2).replace('.', ',') : '');
        setCreditLimitStr(accountToEdit.creditLimit ? accountToEdit.creditLimit.toFixed(2).replace('.', ',') : '');
      }
    } else {
      const defaultBank = initialBankId ? (getBankById(initialBankId) || MAJOR_BANKS[0]) : MAJOR_BANKS[0];
      setSelectedBankId(defaultBank.id);
      setName(defaultBank.name);
      setType(defaultBank.id === 'cash' ? 'cash' : 'credit_card');
      setBalanceStr('');
      setCreditLimitStr('');
      setLastDigits('');
      setColor(defaultBank.color);
      setClosingDay('1');
      setDueDay('8');
    }
  }, [accountToEdit, isOpen, initialBankId]);

  const handleSelectBank = (bank: BankInfo) => {
    setSelectedBankId(bank.id);
    setName(bank.name);
    setColor(bank.color);
    if (bank.id === 'cash') {
      setType('cash');
    } else if (type === 'cash') {
      setType('credit_card');
    }
  };

  const isCreditCard = type === 'credit_card';
  const numericClosingDay = parseInt(closingDay, 10) || 1;
  const bestPurchaseDay = calculateBestPurchaseDay(numericClosingDay);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Informe o nome da conta.');
      return;
    }

    let balance = 0;
    let creditLimit: number | undefined = undefined;

    if (isCreditCard) {
      // Para cartão: a fatura atual é o valor a pagar (positivo)
      const fatura = balanceStr ? parseBrlCurrency(balanceStr) || 0 : 0;
      balance = fatura;
      if (creditLimitStr) {
        creditLimit = parseBrlCurrency(creditLimitStr) || undefined;
      }
    } else {
      // Para conta corrente, poupança, etc.: saldo disponível
      balance = balanceStr ? parseBrlCurrency(balanceStr) || 0 : 0;
      if (creditLimitStr) {
        creditLimit = parseBrlCurrency(creditLimitStr) || undefined;
      }
    }

    let icon = 'Wallet';
    if (type === 'credit_card') icon = 'CreditCard';
    else if (type === 'savings') icon = 'PiggyBank';
    else if (type === 'investment') icon = 'TrendingUp';
    else if (type === 'cash') icon = 'Banknote';

    const closingNum = isCreditCard ? Math.max(1, Math.min(31, parseInt(closingDay, 10) || 1)) : undefined;
    const dueNum = isCreditCard ? Math.max(1, Math.min(31, parseInt(dueDay, 10) || 8)) : undefined;

    await saveAccount({
      ...(accountToEdit || {}),
      id: accountToEdit?.id,
      name: name.trim(),
      type,
      balance,
      creditLimit,
      closingDay: closingNum,
      dueDay: dueNum,
      lastDigits: isCreditCard ? (lastDigits.trim() || undefined) : undefined,
      color,
      icon,
      currency: 'BRL',
      bankId: selectedBankId,
      syncStatus: accountToEdit?.syncStatus || 'manual',
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? (isCreditCard ? 'Editar Cartão de Crédito' : 'Editar Conta Bancária') : 'Nova Conta ou Carteira'}
      subtitle={isEditing ? 'Atualize os dados e limites desta conta' : 'Selecione sua instituição bancária ou carteira'}
      maxWidth="520px"
      zIndex={zIndex}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Seletor Visual dos Maiores Bancos com Logos Oficiais */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: colors.textPrimary, marginBottom: '8px' }}>
            Instituição Bancária
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              maxHeight: '170px',
              overflowY: 'auto',
              padding: '2px',
            }}
          >
            {MAJOR_BANKS.map(bank => {
              const isSelected = selectedBankId === bank.id;
              return (
                <button
                  type="button"
                  key={bank.id}
                  onClick={() => handleSelectBank(bank)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 4px',
                    borderRadius: '12px',
                    backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.12)' : colors.surfaceElevated,
                    border: isSelected ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s',
                  }}
                >
                  <BankLogo bankId={bank.id} size={30} />
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? colors.primaryLight : colors.textSecondary,
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      width: '100%',
                    }}
                  >
                    {bank.shortName}
                  </span>

                  {isSelected && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        backgroundColor: colors.primary,
                        borderRadius: '50%',
                        width: '14px',
                        height: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={9} color="#FFFFFF" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nome da Conta */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Nome da Conta / Cartão *
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BankLogo bankId={selectedBankId} size={36} />
            <input
              type="text"
              required
              placeholder="Ex: Nubank, Itaú Corrente, Carteira"
              value={name}
              onChange={e => setName(e.target.value)}
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

        {/* Tipo de Cadastro: Cartão de Crédito ou Conta com Saldo */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: colors.textPrimary, marginBottom: '8px' }}>
            O que é este cadastro? *
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setType('credit_card')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '12px 10px',
                borderRadius: '12px',
                border: type === 'credit_card' ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                backgroundColor: type === 'credit_card' ? 'rgba(16, 185, 129, 0.15)' : colors.surfaceElevated,
                color: type === 'credit_card' ? colors.primaryLight : colors.textSecondary,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <CreditCard size={22} color={type === 'credit_card' ? colors.primary : colors.textMuted} />
              <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Cartão de Crédito</span>
              <span style={{ fontSize: '0.72rem', color: colors.textMuted }}>Controle de Limite & Fatura</span>
            </button>

            <button
              type="button"
              onClick={() => setType('checking')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '12px 10px',
                borderRadius: '12px',
                border: type === 'checking' ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                backgroundColor: type === 'checking' ? 'rgba(16, 185, 129, 0.15)' : colors.surfaceElevated,
                color: type === 'checking' ? colors.primaryLight : colors.textSecondary,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Wallet size={22} color={type === 'checking' ? colors.primary : colors.textMuted} />
              <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Conta com Saldo</span>
              <span style={{ fontSize: '0.72rem', color: colors.textMuted }}>Dinheiro Disponível</span>
            </button>
          </div>
        </div>

        {/* Campos Claros e Específicos: Cartão (Limite) vs Conta (Saldo) */}
        {isCreditCard ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              padding: '16px',
              borderRadius: '14px',
              backgroundColor: colors.surfaceElevated,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} color={colors.primary} />
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: colors.textPrimary }}>
                Limite & Fatura do Cartão
              </span>
            </div>

            {/* Campo Principal: Limite Total do Cartão / Banco */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: colors.textPrimary, marginBottom: '6px' }}>
                Limite Total do Cartão (R$) *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '12px', fontWeight: 700, color: colors.primary }}>
                  R$
                </span>
                <input
                  type="text"
                  required
                  placeholder="Ex: 5.000,00"
                  value={creditLimitStr}
                  onChange={e => setCreditLimitStr(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surface,
                    color: colors.textPrimary,
                    fontSize: '1.05rem',
                    fontWeight: 700,
                  }}
                />
              </div>
            </div>

            {/* Últimos 4 dígitos para identificação visual (Opcional) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: colors.textPrimary }}>
                  Últimos 4 dígitos do cartão (opcional)
                </label>
                <span style={{ fontSize: '0.72rem', color: colors.textMuted }}>
                  Apenas identificação
                </span>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '12px', fontWeight: 700, color: colors.textSecondary, letterSpacing: '2px' }}>
                  ••••
                </span>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="2462"
                  value={lastDigits}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setLastDigits(val);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 52px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surface,
                    color: colors.textPrimary,
                    fontSize: '1rem',
                    fontWeight: 700,
                    letterSpacing: '3px',
                  }}
                />
              </div>
              <p style={{ fontSize: '0.72rem', color: colors.textSecondary, marginTop: '4px', lineHeight: 1.35 }}>
                Opcional: Apenas para você reconhecer seu cartão com facilidade no app. Nunca solicitamos senha, código de segurança (CVV) ou número completo.
              </p>
            </div>

            {/* Configuração de Datas da Fatura (Fechamento e Vencimento) */}
            <div style={{ paddingTop: '8px', borderTop: `1px dashed ${colors.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Calendar size={15} color={colors.primary} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: colors.textPrimary }}>
                  Ciclo da Fatura (Fechamento & Vencimento)
                </span>
              </div>

              {/* Chips Rápidos de Ciclo */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {datePresets.map(p => {
                  const isSelected = closingDay === p.closing && dueDay === p.due;
                  return (
                    <button
                      type="button"
                      key={p.label}
                      onClick={() => {
                        setClosingDay(p.closing);
                        setDueDay(p.due);
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: isSelected ? 700 : 500,
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        color: isSelected ? '#FFFFFF' : colors.textSecondary,
                        border: `1px solid ${isSelected ? colors.primary : colors.border}`,
                        cursor: 'pointer',
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: colors.textSecondary, marginBottom: '4px' }}>
                    Dia de Fechamento (1-31) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={closingDay}
                    onChange={e => setClosingDay(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surface,
                      color: colors.textPrimary,
                      fontWeight: 700,
                      fontSize: '0.92rem',
                    }}
                  />
                  <span style={{ fontSize: '0.68rem', color: colors.textMuted, marginTop: '2px', display: 'block' }}>
                    Fatura fecha neste dia
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: colors.textSecondary, marginBottom: '4px' }}>
                    Dia de Vencimento (1-31) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={dueDay}
                    onChange={e => setDueDay(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surface,
                      color: colors.textPrimary,
                      fontWeight: 700,
                      fontSize: '0.92rem',
                    }}
                  />
                  <span style={{ fontSize: '0.68rem', color: colors.textMuted, marginTop: '2px', display: 'block' }}>
                    Data limite p/ pagamento
                  </span>
                </div>
              </div>

              {/* Dica do Melhor Dia de Compra */}
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Sparkles size={14} color="#38BDF8" />
                <span style={{ fontSize: '0.74rem', color: '#38BDF8', fontWeight: 600 }}>
                  Melhor dia para compras: <strong>Dia {String(bestPurchaseDay).padStart(2, '0')}</strong> (ganhe até 40 dias para pagar)
                </span>
              </div>
            </div>

            {/* Campo Secundário: Fatura Inicial / Gastos já realizados */}
            <div style={{ paddingTop: '8px', borderTop: `1px dashed ${colors.border}` }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: colors.textSecondary, marginBottom: '4px' }}>
                Fatura Atual / Já gasto este mês (R$) - <span style={{ color: colors.textMuted }}>Opcional</span>
              </label>
              <input
                type="text"
                placeholder="0,00"
                value={balanceStr}
                onChange={e => setBalanceStr(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                  color: colors.expense,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              />
              <span style={{ fontSize: '0.72rem', color: colors.textMuted, marginTop: '4px', display: 'block' }}>
                💡 Conforme novas compras forem lançadas no app, a fatura aumentará automaticamente.
              </span>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: colors.surfaceElevated,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
                Saldo Disponível na Conta (R$) *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '14px', fontWeight: 700, color: colors.income }}>
                  R$
                </span>
                <input
                  type="text"
                  placeholder="0,00"
                  value={balanceStr}
                  onChange={e => setBalanceStr(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 42px',
                    borderRadius: '10px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surface,
                    color: colors.textPrimary,
                    fontSize: '1rem',
                    fontWeight: 600,
                  }}
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: colors.textSecondary, marginTop: '4px', display: 'block' }}>
                Quanto dinheiro você tem disponível nesta conta hoje.
              </span>
            </div>

            <div style={{ paddingTop: '8px', borderTop: `1px dashed ${colors.border}` }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: colors.textSecondary, marginBottom: '4px' }}>
                Limite de Cheque Especial / Crédito da Conta (R$) - <span style={{ color: colors.textMuted }}>Opcional</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 1.000,00"
                value={creditLimitStr}
                onChange={e => setCreditLimitStr(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                  color: colors.textPrimary,
                  fontSize: '0.9rem',
                }}
              />
              <span style={{ fontSize: '0.72rem', color: colors.textMuted, marginTop: '4px', display: 'block' }}>
                Caso o banco ofereça limite pré-aprovado ou cheque especial na conta.
              </span>
            </div>
          </div>
        )}

        {/* Escolha de Cor */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Cor de Identificação
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {colorOptions.map(opt => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setColor(opt.value)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: opt.value,
                  border: color === opt.value ? `3px solid ${colors.textPrimary}` : `1px solid ${colors.border}`,
                  cursor: 'pointer',
                }}
                title={opt.label}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
          {isEditing && accountToEdit ? (
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
              {isEditing ? 'Salvar Alterações' : 'Salvar Conta'}
            </Button>
          </div>
        </div>
      </form>

      {/* Confirmação de Exclusão de Conta */}
      {showDeleteConfirm && accountToEdit && (
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={async () => {
            await deleteAccount(accountToEdit.id);
            setShowDeleteConfirm(false);
            onClose();
          }}
          title="Excluir Conta"
          description={`Deseja realmente excluir a conta "${accountToEdit.name}"? As transações vinculadas a ela serão desvinculadas.`}
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          variant="danger"
        />
      )}
    </Modal>
  );
};
