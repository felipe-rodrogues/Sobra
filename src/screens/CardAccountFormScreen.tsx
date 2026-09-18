import React, { useState, useEffect, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { Account, AccountType } from '../core/types';
import { parseBrlCurrency } from '../core/parsers/currencyHelper';
import { MAJOR_BANKS, BankInfo, getBankById } from '../core/banks/bankCatalog';
import { calculateBestPurchaseDay } from '../core/cards/cardDateHelper';
import { BankLogo } from '../components/common/BankLogo';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { SwipeBackView } from '../components/common/SwipeBackView';
import { 
  ArrowLeft, 
  Check, 
  CreditCard, 
  Wallet, 
  Calendar, 
  Search, 
  Trash2,
  Wifi,
  AlertCircle
} from 'lucide-react';

interface CardAccountFormScreenProps {
  onBack: () => void;
  accountToEdit?: Account | null;
  initialBankId?: string;
  defaultType?: AccountType;
}

const COLOR_OPTIONS = [
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
  { label: 'Esmeralda Sobra', value: '#10B981' },
  { label: 'Dourado / Safra', value: '#C9A84C' },
];

export const CardAccountFormScreen: React.FC<CardAccountFormScreenProps> = ({
  onBack,
  accountToEdit,
  initialBankId,
  defaultType = 'credit_card',
}) => {
  const { saveAccount, deleteAccount } = useFinance();
  const { colors } = useTheme();

  const isEditing = !!accountToEdit;

  // Estados principais
  const [selectedBankId, setSelectedBankId] = useState<string>('nubank');
  const [name, setName] = useState('Nubank');
  const [type, setType] = useState<AccountType>(defaultType);
  const [balanceStr, setBalanceStr] = useState('');
  const [creditLimitStr, setCreditLimitStr] = useState('');
  const [color, setColor] = useState('#820AD1');
  const [closingDay, setClosingDay] = useState<string>('1');
  const [dueDay, setDueDay] = useState<string>('8');
  const [lastDigits, setLastDigits] = useState('');
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicialização e preenchimento ao editar ou carregar
  useEffect(() => {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

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
      setType(defaultBank.id === 'cash' ? 'cash' : defaultType);
      setColor(defaultBank.color);
      setBalanceStr('');
      setCreditLimitStr('');
      setLastDigits('');
      setClosingDay('1');
      setDueDay('8');
    }
  }, [accountToEdit, initialBankId, defaultType]);

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
  const numericClosingDay = Math.max(1, Math.min(31, parseInt(closingDay, 10) || 1));
  const numericDueDay = Math.max(1, Math.min(31, parseInt(dueDay, 10) || 8));
  const bestPurchaseDay = calculateBestPurchaseDay(numericClosingDay);

  // Ajuste inteligente: ao mudar o fechamento, ajusta automaticamente o vencimento para +7 dias (padrão mais comum nos bancos)
  const handleClosingDayChange = (val: string) => {
    setClosingDay(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= 31) {
      let autoDue = num + 7;
      if (autoDue > 30) {
        autoDue = autoDue - 30;
      }
      setDueDay(String(autoDue));
    }
  };

  // Cálculo da distância/intervalo real entre fechamento e vencimento
  const intervalDays = useMemo(() => {
    const c = parseInt(closingDay, 10);
    const d = parseInt(dueDay, 10);
    if (isNaN(c) || isNaN(d) || c < 1 || c > 31 || d < 1 || d > 31) return null;
    
    let diff = d - c;
    if (diff <= 0) {
      diff += 30; // virada de mês
    }
    return diff;
  }, [closingDay, dueDay]);

  // Intervalos absurdos que não existem em nenhum banco comercial (< 4 dias ou > 16 dias)
  const isAbsurdInterval = isCreditCard && intervalDays !== null && (intervalDays < 4 || intervalDays > 16);

  // Filtro de instituições bancárias com busca inteligente
  const filteredBanks = useMemo(() => {
    if (!bankSearchQuery.trim()) return MAJOR_BANKS;
    const q = bankSearchQuery.toLowerCase().trim();
    return MAJOR_BANKS.filter(b => 
      b.name.toLowerCase().includes(q) ||
      b.shortName.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q)
    );
  }, [bankSearchQuery]);

  const currentBankInfo = getBankById(selectedBankId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Informe o nome da conta ou cartão.');
      return;
    }

    setIsSubmitting(true);
    try {
      let balance = 0;
      let creditLimit: number | undefined = undefined;

      if (isCreditCard) {
        const fatura = balanceStr ? parseBrlCurrency(balanceStr) || 0 : 0;
        balance = fatura;
        if (creditLimitStr) {
          creditLimit = parseBrlCurrency(creditLimitStr) || undefined;
        }
      } else {
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

      await saveAccount({
        ...(accountToEdit || {}),
        id: accountToEdit?.id,
        name: name.trim(),
        type,
        balance,
        creditLimit,
        closingDay: isCreditCard ? numericClosingDay : undefined,
        dueDay: isCreditCard ? numericDueDay : undefined,
        lastDigits: isCreditCard ? (lastDigits.trim() || undefined) : undefined,
        color,
        icon,
        currency: 'BRL',
        bankId: selectedBankId,
        syncStatus: accountToEdit?.syncStatus || 'manual',
      });

      onBack();
    } catch (err) {
      console.error('Erro ao salvar conta:', err);
      alert('Erro ao salvar os dados. Verifique os campos e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SwipeBackView onBack={onBack}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', paddingBottom: '50px' }}>
      {/* ─────────────────────────────────────────────────────────────
          1. CABEÇALHO SUPERIOR PADRÃO SOBRA (VOLTAR + TÍTULOS)
         ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingTop: '6px' }}>
        <button
          type="button"
          onClick={onBack}
          title="Voltar"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.07)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background-color 0.15s ease, transform 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
            e.currentTarget.style.transform = 'scale(1.04)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <ArrowLeft size={19} />
        </button>

        <div>
          <h1
            style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              color: '#FFFFFF',
              margin: 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {isEditing 
              ? (isCreditCard ? 'Editar Cartão' : 'Editar Conta') 
              : (isCreditCard ? 'Adicionar Cartão de Crédito' : 'Nova Conta ou Carteira')
            }
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#8E8E93', margin: '3px 0 0 0' }}>
            {isCreditCard 
              ? 'Acompanhe limites, datas de fatura e notificações automaticamente' 
              : 'Gerencie saldo disponível e movimentações em tempo real'
            }
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* ─────────────────────────────────────────────────────────────
            3. SELETOR DE TIPO (CARTÃO DE CRÉDITO vs CONTA COM SALDO)
           ───────────────────────────────────────────────────────────── */}
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>
            Tipo de Cadastro
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              backgroundColor: '#121614',
              padding: '4px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <button
              type="button"
              onClick={() => setType('credit_card')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 14px',
                borderRadius: '12px',
                border: type === 'credit_card' ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid transparent',
                backgroundColor: type === 'credit_card' ? '#1A231C' : 'transparent',
                color: type === 'credit_card' ? '#4ADE80' : '#8E8E93',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <CreditCard size={18} />
              <span>Cartão de Crédito</span>
            </button>

            <button
              type="button"
              onClick={() => setType('checking')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 14px',
                borderRadius: '12px',
                border: type === 'checking' ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid transparent',
                backgroundColor: type === 'checking' ? '#1A231C' : 'transparent',
                color: type === 'checking' ? '#4ADE80' : '#8E8E93',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Wallet size={18} />
              <span>Conta Corrente</span>
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            4. INSTITUIÇÕES BANCÁRIAS (REDESENHADO: SEM CORTE, COM BUSCA)
           ───────────────────────────────────────────────────────────── */}
        <div
          style={{
            backgroundColor: '#121614',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '18px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>
              Selecione a Instituição
            </label>
            <span style={{ fontSize: '0.74rem', color: '#8E8E93' }}>
              {filteredBanks.length} disponíveis
            </span>
          </div>

          {/* Campo de Busca Rápida de Banco */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <Search size={16} color="#8E8E93" style={{ position: 'absolute', left: '12px' }} />
            <input
              type="text"
              placeholder="Buscar banco ou carteira..."
              value={bankSearchQuery}
              onChange={e => setBankSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 38px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: '#18201B',
                color: '#FFFFFF',
                fontSize: '0.86rem',
                outline: 'none',
              }}
            />
            {bankSearchQuery && (
              <button
                type="button"
                onClick={() => setBankSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  color: '#8E8E93',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Grid de Bancos com corte visual nativo (affordance sem barra de scroll) */}
          <div
            className="no-scrollbar"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))',
              gap: '10px',
              maxHeight: '215px',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 28px), transparent 100%)',
              maskImage: 'linear-gradient(to bottom, black calc(100% - 28px), transparent 100%)',
              paddingBottom: '16px',
            }}
          >
            {filteredBanks.map(bank => {
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
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 6px',
                    borderRadius: '14px',
                    backgroundColor: isSelected ? 'rgba(74, 222, 128, 0.12)' : '#18201B',
                    border: isSelected ? '2px solid #4ADE80' : '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                  }}
                >
                  <BankLogo bankId={bank.id} size={32} />
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: isSelected ? 800 : 500,
                      color: isSelected ? '#4ADE80' : '#E2E8F0',
                      textAlign: 'center',
                      lineHeight: 1.15,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      width: '100%',
                      padding: '0 2px',
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
                        backgroundColor: '#4ADE80',
                        borderRadius: '50%',
                        width: '14px',
                        height: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={9} color="#000000" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            5. NOME DO CARTÃO / CONTA
           ───────────────────────────────────────────────────────────── */}
        <div
          style={{
            backgroundColor: '#121614',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '18px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>
              Nome de Identificação *
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BankLogo bankId={selectedBankId} size={38} />
              <input
                type="text"
                required
                placeholder="Ex: Nubank Ultravioleta, Itaú Click, etc."
                value={name}
                onChange={e => setName(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: '#18201B',
                  color: '#FFFFFF',
                  fontSize: '0.96rem',
                  fontWeight: 600,
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Paleta de Cores para o Cartão */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#8E8E93', marginBottom: '8px' }}>
              Cor Visual do Cartão
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {COLOR_OPTIONS.map(opt => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setColor(opt.value)}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: opt.value,
                    border: color === opt.value ? '3px solid #FFFFFF' : '1px solid rgba(255, 255, 255, 0.15)',
                    cursor: 'pointer',
                    transform: color === opt.value ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.15s ease',
                  }}
                  title={opt.label}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            6. CAMPOS ESPECÍFICOS: CARTÃO DE CRÉDITO (LIMITE & CICLO)
           ───────────────────────────────────────────────────────────── */}
        {isCreditCard ? (
          <>
            {/* Limite Total e Últimos 4 Dígitos */}
            <div
              style={{
                backgroundColor: '#121614',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '18px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>
                  Limite Total do Cartão (R$) *
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '14px', fontWeight: 800, color: '#4ADE80', fontSize: '1.05rem' }}>
                    R$
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="5.000,00"
                    value={creditLimitStr}
                    onChange={e => setCreditLimitStr(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 46px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: '#18201B',
                      color: '#FFFFFF',
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Últimos 4 Dígitos */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF' }}>
                    Últimos 4 dígitos do cartão
                  </label>
                  <span style={{ fontSize: '0.68rem', color: '#8E8E93' }}>
                    Opcional
                  </span>
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '14px', fontWeight: 700, color: '#8E8E93', letterSpacing: '3px' }}>
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
                      padding: '10px 14px 10px 58px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: '#18201B',
                      color: '#FFFFFF',
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      letterSpacing: '4px',
                      outline: 'none',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: '#8E8E93', marginTop: '6px', display: 'block', lineHeight: 1.35 }}>
                  Facilita identificar e diferenciar seus cartões no aplicativo.
                </span>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                CICLO DA FATURA (COMPACTO E DIRETO - ESTILO PIERRE)
               ───────────────────────────────────────────────────────────── */}
            <div
              style={{
                backgroundColor: '#121614',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={17} color="#4ADE80" />
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Ciclo da Fatura
                </span>
              </div>

              {/* Dias de Fechamento e Vencimento lado a lado */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div
                  style={{
                    backgroundColor: isAbsurdInterval ? 'rgba(244, 63, 94, 0.05)' : '#18201B',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: isAbsurdInterval 
                      ? '1px solid rgba(244, 63, 94, 0.35)' 
                      : '1px solid rgba(255, 255, 255, 0.06)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <label style={{ display: 'block', fontSize: '0.74rem', color: isAbsurdInterval ? '#FDA4AF' : '#8E8E93', marginBottom: '5px', fontWeight: 600 }}>
                    Dia do Fechamento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={closingDay}
                    onChange={e => handleClosingDayChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: isAbsurdInterval 
                        ? '1px solid rgba(244, 63, 94, 0.5)' 
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: '#121614',
                      color: isAbsurdInterval ? '#FB7185' : '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                    }}
                  />
                </div>

                <div
                  style={{
                    backgroundColor: isAbsurdInterval ? 'rgba(244, 63, 94, 0.05)' : '#18201B',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: isAbsurdInterval 
                      ? '1px solid rgba(244, 63, 94, 0.35)' 
                      : '1px solid rgba(255, 255, 255, 0.06)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <label style={{ display: 'block', fontSize: '0.74rem', color: isAbsurdInterval ? '#FDA4AF' : '#8E8E93', marginBottom: '5px', fontWeight: 600 }}>
                    Dia do Vencimento
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
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: isAbsurdInterval 
                        ? '1px solid rgba(244, 63, 94, 0.5)' 
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: '#121614',
                      color: isAbsurdInterval ? '#FB7185' : '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                    }}
                  />
                </div>
              </div>

              {/* Balão de aviso para intervalo de dias inconsistente / absurdo */}
              {isAbsurdInterval && (
                <div
                  style={{
                    position: 'relative',
                    marginTop: '2px',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(244, 63, 94, 0.1)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  {/* Ponta / bico do balão apontando para cima */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '25%',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#1C1315',
                      borderLeft: '1px solid rgba(244, 63, 94, 0.3)',
                      borderTop: '1px solid rgba(244, 63, 94, 0.3)',
                      transform: 'rotate(45deg)',
                    }}
                  />
                  <AlertCircle size={15} color="#FB7185" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '0.74rem', lineHeight: 1.35, color: '#FDA4AF' }}>
                    {intervalDays !== null && intervalDays > 16
                      ? `Intervalo de ${intervalDays} dias é incomum. A fatura costuma fechar cerca de 7 a 10 dias antes do vencimento.`
                      : `Intervalo de ${intervalDays} dias é muito curto. Geralmente há pelo menos 7 dias entre o fechamento e o vencimento.`
                    }
                  </span>
                </div>
              )}

              {/* Melhor dia de compra simples e discreto */}
              <p style={{ fontSize: '0.72rem', color: '#8E8E93', margin: '-2px 0 0 0' }}>
                Melhor dia de compra: Dia {String(bestPurchaseDay).padStart(2, '0')}
              </p>

              {/* Fatura Atual Opcional com Breve Explicação */}
              <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', color: '#E2E8F0', fontWeight: 600 }}>
                    Fatura atual em aberto (R$)
                  </label>
                  <span style={{ fontSize: '0.68rem', color: '#8E8E93' }}>Opcional</span>
                </div>
                <input
                  type="text"
                  placeholder="0,00"
                  value={balanceStr}
                  onChange={e => setBalanceStr(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: '#18201B',
                    color: '#FB7185',
                    fontWeight: 700,
                    fontSize: '0.94rem',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: '#8E8E93', marginTop: '6px', display: 'block', lineHeight: 1.35 }}>
                  Gasto acumulado neste ciclo antes de usar o app. Novas compras registradas somarão automaticamente.
                </span>
              </div>
            </div>
          </>
        ) : (
          /* ─────────────────────────────────────────────────────────────
              CAMPOS ESPECÍFICOS: CONTA CORRENTE COM SALDO
             ───────────────────────────────────────────────────────────── */
          <div
            style={{
              backgroundColor: '#121614',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '18px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>
                Saldo Disponível na Conta (R$) *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '14px', fontWeight: 800, color: '#4ADE80', fontSize: '1.05rem' }}>
                  R$
                </span>
                <input
                  type="text"
                  placeholder="0,00"
                  value={balanceStr}
                  onChange={e => setBalanceStr(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 46px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: '#18201B',
                    color: '#FFFFFF',
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    outline: 'none',
                  }}
                />
              </div>
              <span style={{ fontSize: '0.74rem', color: '#8E8E93', marginTop: '4px', display: 'block' }}>
                Quanto dinheiro você tem disponível nesta conta hoje.
              </span>
            </div>

            <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#8E8E93', marginBottom: '6px' }}>
                Limite de Cheque Especial / Crédito da Conta (R$) - <span style={{ color: '#64748B' }}>Opcional</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 1.000,00"
                value={creditLimitStr}
                onChange={e => setCreditLimitStr(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: '#18201B',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '0.94rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            7. PRÉVIA DO CARTÃO / CONTA (NO FINAL DA PÁGINA)
           ───────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.82rem', color: '#8E8E93', fontWeight: 600 }}>
            Prévia do {isCreditCard ? 'Cartão' : 'Conta'}
          </label>
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '185px',
              borderRadius: '24px',
              backgroundColor: color || '#820AD1',
              backgroundImage: `linear-gradient(135deg, ${color} 0%, rgba(10, 15, 12, 0.92) 100%)`,
              border: '1px solid rgba(255, 255, 255, 0.18)',
              boxShadow: '0 18px 38px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
              padding: '20px 22px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Marca d'água de textura no cartão */}
            <div
              style={{
                position: 'absolute',
                top: '-30px',
                right: '-30px',
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                pointerEvents: 'none',
              }}
            />

            {/* Linha 1: Logo do Banco + Nome / Categoria + Ícone Contactless */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BankLogo bankId={selectedBankId} size={34} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} />
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                    {name || currentBankInfo?.shortName || 'Novo Cartão'}
                  </div>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'rgba(255, 255, 255, 0.7)',
                    }}
                  >
                    {isCreditCard ? 'Cartão de Crédito' : 'Conta Bancária'}
                  </span>
                </div>
              </div>

              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                }}
              >
                <Wifi size={17} style={{ transform: 'rotate(90deg)' }} />
              </div>
            </div>

            {/* Linha 2: Chip Metálico Estilizado + Dígitos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', zIndex: 2 }}>
              <div
                style={{
                  width: '34px',
                  height: '24px',
                  borderRadius: '5px',
                  backgroundColor: '#D4AF37',
                  backgroundImage: 'linear-gradient(135deg, #FFE259 0%, #D4AF37 100%)',
                  boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4), 0 1px 3px rgba(0,0,0,0.4)',
                  border: '1px solid rgba(0,0,0,0.2)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', top: '7px', left: 0, right: 0, height: '1px', backgroundColor: 'rgba(0,0,0,0.3)' }} />
                <div style={{ position: 'absolute', top: '15px', left: 0, right: 0, height: '1px', backgroundColor: 'rgba(0,0,0,0.3)' }} />
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '16px', width: '1px', backgroundColor: 'rgba(0,0,0,0.3)' }} />
              </div>

              <div
                style={{
                  fontSize: '0.96rem',
                  fontWeight: 700,
                  letterSpacing: '3px',
                  color: '#FFFFFF',
                  fontFamily: 'monospace, sans-serif',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                }}
              >
                •••• •••• •••• {lastDigits ? lastDigits : '••••'}
              </div>
            </div>

            {/* Linha 3: Limite & Ciclo ou Saldo */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', zIndex: 2 }}>
              <div>
                <span style={{ fontSize: '0.66rem', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {isCreditCard ? 'Limite Total' : 'Saldo Disponível'}
                </span>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', marginTop: '1px' }}>
                  R$ {isCreditCard ? (creditLimitStr || '0,00') : (balanceStr || '0,00')}
                </div>
              </div>

              {isCreditCard && (
                <div
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.35)',
                    backdropFilter: 'blur(8px)',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    textAlign: 'right',
                  }}
                >
                  <span style={{ fontSize: '0.64rem', color: 'rgba(255, 255, 255, 0.7)', display: 'block' }}>
                    Ciclo Mensal
                  </span>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#4ADE80' }}>
                    Fecha {String(numericClosingDay).padStart(2, '0')} • Vence {String(numericDueDay).padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            8. BOTÕES DE AÇÃO (SALVAR / CANCELAR / EXCLUIR)
           ───────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: '#4ADE80',
              border: 'none',
              color: '#000000',
              fontWeight: 800,
              fontSize: '1.02rem',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              boxShadow: '0 4px 18px rgba(74, 222, 128, 0.35)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={e => {
              if (!isSubmitting) e.currentTarget.style.transform = 'scale(1.01)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {isSubmitting 
              ? 'Salvando...' 
              : isEditing 
                ? 'Salvar Alterações' 
                : (isCreditCard ? 'Cadastrar Cartão de Crédito' : 'Cadastrar Conta')
            }
          </button>

          {isEditing && accountToEdit && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                color: '#FB7185',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.08)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Trash2 size={16} />
              <span>Excluir {isCreditCard ? 'Cartão' : 'Conta'}</span>
            </button>
          )}
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
            onBack();
          }}
          title={isCreditCard ? 'Excluir Cartão' : 'Excluir Conta'}
          description={`Deseja realmente excluir "${accountToEdit.name}"? As transações vinculadas a este cadastro serão desvinculadas.`}
          confirmText="Sim, Excluir"
          cancelText="Cancelar"
          variant="danger"
        />
      )}
      </div>
    </SwipeBackView>
  );
};
