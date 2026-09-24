import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Switch } from '../common/Switch';
import { useFinance } from '../../context/FinanceContext';
import { useTheme } from '../../context/ThemeContext';
import { Subscription, SubscriptionCadence, SubscriptionStatus } from '../../core/types';
import { parseBrlCurrency } from '../../core/parsers/currencyHelper';
import { Users } from 'lucide-react';
import { SubscriptionLogo } from '../subscriptions/SubscriptionLogo';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Subscription | null;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  initialData,
}) => {
  const { accounts, categories, saveSubscription, suggestCategoryForMerchant, isPartnershipActive, partnershipSpace } = useFinance();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [cadence, setCadence] = useState<SubscriptionCadence>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [isShared, setIsShared] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setAmountStr(initialData.amount.toString().replace('.', ','));
      setCategoryId(initialData.categoryId);
      setAccountId(initialData.accountId || accounts[0]?.id || '');
      setCadence(initialData.cadence);
      setNextBillingDate(initialData.nextBillingDate.substring(0, 10));
      setStatus(initialData.status);
      const isCardShared = Boolean(accounts.find(a => a.id === initialData.accountId)?.isShared);
      setIsShared(initialData.isShared !== undefined ? initialData.isShared : isCardShared);
    } else {
      setName('');
      setAmountStr('');
      const defaultCat = categories.find(c => c.name.toLowerCase().includes('lazer')) || 
                         categories.find(c => c.type === 'expense') || 
                         categories[0];
      setCategoryId(defaultCat?.id || '');
      const firstAcc = accounts[0];
      setAccountId(firstAcc?.id || '');
      setCadence('monthly');

      // Padrão: 30 dias a partir de hoje
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      setNextBillingDate(defaultDate.toISOString().substring(0, 10));
      setStatus('active');
      setIsShared(Boolean(firstAcc?.isShared));
    }
  }, [initialData, isOpen, accounts, categories]);

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

    await saveSubscription({
      id: initialData?.id,
      name: name.trim(),
      amount: numericAmount,
      categoryId,
      accountId: accountId || undefined,
      cadence,
      nextBillingDate,
      status,
      previousAmount: initialData?.previousAmount,
      lastChargeDate: initialData?.lastChargeDate,
      isShared: isPartnershipActive ? isShared : (initialData?.isShared || false),
      ownerName: isShared ? (partnershipSpace?.ownerName || 'Você') : undefined,
    });

    onClose();
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
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
                required
                placeholder="0,00"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
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

        {/* Conta Vinculada */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '6px' }}>
            Cobrado em (Conta / Cartão)
          </label>
          <select
            value={accountId}
            onChange={e => {
              const selectedId = e.target.value;
              setAccountId(selectedId);
              const selectedAcc = accounts.find(a => a.id === selectedId);
              if (selectedAcc?.isShared) {
                setIsShared(true);
              }
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
            <option value="">Não especificado</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.type === 'credit_card' ? 'Cartão de Crédito' : 'Conta'}) {acc.isShared ? '• Conjunto' : ''}
              </option>
            ))}
          </select>
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
  );
};
