import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { Account, AccountType, PendingNotification } from '../core/types';
import { parseBrlCurrency, formatBrlCurrency } from '../core/parsers/currencyHelper';
import { parseBankCsv, ParsedCsvRow } from '../core/parsers/csvParser';
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
  AlertCircle,
  Sparkles,
  UploadCloud,
  CheckCircle2,
  X,
  Users,
  Share2,
  Copy,
  CheckCheck,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  createOrGetCardInvite, 
  updateCardInvite, 
  registerSharedAccountMember, 
  fetchSharedAccountMembers, 
  syncAccountTransactionsToCloud,
  subscribeToSharedCards
} from '../services/supabase';

interface CardAccountFormScreenProps {
  onBack: () => void;
  accountToEdit?: Account | null;
  initialBankId?: string;
  defaultType?: AccountType;
  initialLastDigits?: string;
  pendingNotificationToLink?: PendingNotification | null;
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
  initialLastDigits,
  pendingNotificationToLink,
}) => {
  const { saveAccount, deleteAccount, approveNotificationWithNewAccount, importCsvTransactions, transactions } = useFinance();
  const { colors } = useTheme();

  const isEditing = !!accountToEdit;
  // ID estável para garantir paridade 100% entre titular, convite e convidados
  const [currentAccountId] = useState<string>(() => accountToEdit?.id || `acc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`);

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

  // Estados de Compartilhamento / Conta Conjunta
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const [isShared, setIsShared] = useState<boolean>(accountToEdit?.isShared || false);
  const [inviteCode, setInviteCode] = useState<string>(accountToEdit?.inviteCode || '');
  const [sharedMembers, setSharedMembers] = useState(accountToEdit?.sharedMembers || []);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [splitMode, setSplitMode] = useState<'half' | 'full' | 'none'>(
    accountToEdit?.splitMode || (accountToEdit?.splitRatio === 1 ? 'full' : accountToEdit?.splitRatio === 0 ? 'none' : 'half')
  );

  // Estados para importação de CSV da fatura do cartão
  const [csvRows, setCsvRows] = useState<ParsedCsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvError, setCsvError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCardCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      const result = parseBankCsv(content);
      if (!result.success || result.rows.length === 0) {
        setCsvError(result.errors.join('. ') || 'Não foi possível ler as compras do arquivo.');
        setCsvRows([]);
        setCsvFileName('');
      } else {
        setCsvRows(result.rows);
        setCsvFileName(file.name);
        setCsvError(null);
        const effectiveTotal = result.rows
          .filter(r => !r.isInvoicePayment)
          .reduce((acc, r) => acc + (r.type === 'expense' ? r.amount : -r.amount), 0);
        if (effectiveTotal > 0) {
          setBalanceStr(effectiveTotal.toFixed(2).replace('.', ','));
        }
      }
    };
    reader.readAsText(file);
  };

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
      setIsShared(!!accountToEdit.isShared);
      setInviteCode(accountToEdit.inviteCode || '');
      setSharedMembers(accountToEdit.sharedMembers || []);
      setSplitMode(accountToEdit.splitMode || (accountToEdit.splitRatio === 1 ? 'full' : accountToEdit.splitRatio === 0 ? 'none' : 'half'));

      if (accountToEdit.type === 'credit_card') {
        const fatura = accountToEdit.invoiceAmount ?? Math.abs(accountToEdit.balance);
        setBalanceStr(fatura > 0 ? fatura.toFixed(2).replace('.', ',') : '');
        setCreditLimitStr(accountToEdit.creditLimit ? accountToEdit.creditLimit.toFixed(2).replace('.', ',') : '');
      } else {
        setBalanceStr(accountToEdit.balance ? accountToEdit.balance.toFixed(2).replace('.', ',') : '');
        setCreditLimitStr(accountToEdit.creditLimit ? accountToEdit.creditLimit.toFixed(2).replace('.', ',') : '');
      }

      // Sincroniza lista oficial de membros da nuvem
      if (accountToEdit.isShared && accountToEdit.id) {
        fetchSharedAccountMembers(accountToEdit.id).then(remoteMembers => {
          if (remoteMembers && remoteMembers.length > 0) {
            setSharedMembers(prev => {
              const map = new Map<string, any>();
              prev.forEach(m => map.set(m.userId, m));
              remoteMembers.forEach(m => map.set(m.userId, m));
              return Array.from(map.values());
            });
          }
        });
      }
    } else {
      const defaultBank = initialBankId ? (getBankById(initialBankId) || MAJOR_BANKS[0]) : MAJOR_BANKS[0];
      setSelectedBankId(defaultBank.id);
      setName(
        initialLastDigits && defaultType === 'credit_card'
          ? `${defaultBank.name} (Final ${initialLastDigits})`
          : defaultBank.name
      );
      setType(defaultBank.id === 'cash' ? 'cash' : defaultType);
      setColor(defaultBank.color);
      setBalanceStr('');
      setCreditLimitStr('');
      setLastDigits(initialLastDigits || '');
      setClosingDay('1');
      setDueDay('8');
    }
  }, [accountToEdit, initialBankId, defaultType, initialLastDigits]);

  // Escuta novos membros ingressando no cartão em tempo real enquanto a tela estiver aberta
  useEffect(() => {
    if (!isShared || !currentAccountId) return;
    try {
      const unsub = subscribeToSharedCards(
        [currentAccountId],
        () => {},
        (event) => {
          if (event.accountId === currentAccountId && event.member) {
            setSharedMembers(prev => {
              if (prev.some(m => m.userId === event.member.userId)) return prev;
              return [...prev, event.member];
            });
          }
        }
      );
      return () => {
        try { unsub(); } catch {}
      };
    } catch (e) {
      console.warn('Falha não crítica ao subscrever membros no formulário:', e);
    }
  }, [isShared, currentAccountId]);

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

  const totalInvoiceCsvAmount = useMemo(() => {
    return csvRows
      .filter(row => !row.isInvoicePayment)
      .reduce((acc, row) => acc + (row.type === 'expense' ? row.amount : -row.amount), 0);
  }, [csvRows]);

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

  // Manipulação de Conta Conjunta / Compartilhada
  const handleToggleShared = async (enabled: boolean) => {
    if (enabled && (!isAuthenticated || !user)) {
      openAuthModal({
        title: 'Cartão Compartilhado',
        subtitle: 'Para usar essa função e sincronizar gastos em tempo real entre dois celulares, é necessário criar uma conta.',
        iconType: 'shared',
        hideGuestOption: true,
      });
      return;
    }
    setIsShared(enabled);
    if (enabled && user) {
      try {
        const parsedLimit = creditLimitStr ? parseBrlCurrency(creditLimitStr) || undefined : undefined;
        const tempAcc: Account = {
          id: currentAccountId,
          name: name.trim() || 'Cartão Compartilhado',
          type,
          balance: balanceStr ? parseBrlCurrency(balanceStr) || 0 : 0,
          creditLimit: parsedLimit,
          closingDay: isCreditCard ? numericClosingDay : undefined,
          dueDay: isCreditCard ? numericDueDay : undefined,
          color,
          icon: 'CreditCard',
          currency: 'BRL',
          bankId: selectedBankId,
          syncStatus: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const invite = await createOrGetCardInvite(tempAcc, user);
        setInviteCode(invite.code);
        if (sharedMembers.length === 0) {
          setSharedMembers([
            {
              userId: user.id,
              displayName: user.displayName,
              email: user.email,
              avatarUrl: user.avatarUrl,
              role: 'owner',
              joinedAt: new Date().toISOString(),
            },
          ]);
        }
      } catch (err) {
        console.error('Erro ao gerar código de convite:', err);
      }
    }
  };

  const handleCopyInvite = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2200);
  };

  const handleShareWhatsapp = () => {
    if (!inviteCode) return;
    const text = encodeURIComponent(
      `Olá! Estou compartilhando o controle dos gastos do cartão "${name}" com você no Sobra.\n\n` +
      `Código de convite: *${inviteCode}*\n\n` +
      `Abra o Sobra, vá em Contas > Entrar em Cartão Conjunto e digite o código para sincronizarmos os gastos em tempo real!`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

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

      let savedAccountId = currentAccountId;

      if (pendingNotificationToLink) {
        const res = await approveNotificationWithNewAccount(
          pendingNotificationToLink.id,
          {
            ...(accountToEdit || {}),
            id: currentAccountId,
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
            isShared,
            inviteCode: isShared ? inviteCode : undefined,
            ownerId: accountToEdit?.ownerId || (isShared ? user?.id : undefined),
            ownerName: accountToEdit?.ownerName || (isShared ? user?.displayName : undefined),
            sharedMembers: isShared ? sharedMembers : undefined,
            splitMode: isShared ? splitMode : undefined,
            splitRatio: isShared ? (splitMode === 'half' ? 0.5 : splitMode === 'none' ? 0 : 1.0) : undefined,
          }
        );
        savedAccountId = res.account?.id || currentAccountId;
      } else {
        const saved = await saveAccount({
          ...(accountToEdit || {}),
          id: currentAccountId,
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
          isShared,
          inviteCode: isShared ? inviteCode : undefined,
          ownerId: accountToEdit?.ownerId || (isShared ? user?.id : undefined),
          ownerName: accountToEdit?.ownerName || (isShared ? user?.displayName : undefined),
          sharedMembers: isShared ? sharedMembers : undefined,
          splitMode: isShared ? splitMode : undefined,
          splitRatio: isShared ? (splitMode === 'half' ? 0.5 : splitMode === 'none' ? 0 : 1.0) : undefined,
        });
        savedAccountId = saved?.id || currentAccountId;
      }

      // Se for compartilhado, atualiza convite na nuvem e sincroniza membros e transações
      if (isShared && inviteCode) {
        try {
          await updateCardInvite(inviteCode, {
            accountId: savedAccountId,
            accountName: name.trim(),
            bankId: selectedBankId,
            color,
            creditLimit,
            type,
          });

          if (user) {
            await registerSharedAccountMember(savedAccountId, {
              userId: user.id,
              displayName: user.displayName,
              email: user.email,
              avatarUrl: user.avatarUrl,
              role: 'owner',
              joinedAt: new Date().toISOString(),
            });
          }

          if (transactions && transactions.length > 0) {
            await syncAccountTransactionsToCloud(savedAccountId, transactions);
          }
        } catch (cloudErr) {
          console.warn('Erro ao atualizar convite/membros na nuvem:', cloudErr);
        }
      }

      if (isCreditCard && csvRows.length > 0 && savedAccountId) {
        await importCsvTransactions(csvRows, savedAccountId, {
          ignoreInvoicePayments: true,
          projectFutureInstallments: true,
        });
      }

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
        {/* Banner de Vinculação de Compra Pendente */}
        {pendingNotificationToLink && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '16px',
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              border: '1.5px solid rgba(34, 197, 94, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 4px 16px rgba(34, 197, 94, 0.12)',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '11px',
                backgroundColor: '#22C55E',
                color: '#0A0E0C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={20} strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.25 }}>
                Vinculando Compra Detectada
              </div>
              <div style={{ fontSize: '0.78rem', color: '#86EFAC', marginTop: '2px', lineHeight: 1.4 }}>
                Ao cadastrar este cartão, a compra de <strong>{formatBrlCurrency(pendingNotificationToLink.parsedAmount)}</strong> em <strong>{pendingNotificationToLink.parsedMerchant}</strong> será lançada automaticamente na fatura!
              </div>
            </div>
          </div>
        )}
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

              {/* Importar Fatura Atual (Extrato CSV) */}
              <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.78rem', color: '#E2E8F0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UploadCloud size={14} color="#C084FC" />
                    Fatura Atual em Aberto (Extrato CSV)
                  </label>
                  <span style={{ fontSize: '0.68rem', color: '#8E8E93' }}>Opcional</span>
                </div>

                {/* Input invisível para upload do CSV */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={handleCardCsvUpload}
                />

                {csvRows.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '14px',
                      borderRadius: '14px',
                      border: '1px dashed rgba(192, 132, 252, 0.35)',
                      backgroundColor: 'rgba(192, 132, 252, 0.05)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(192, 132, 252, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(192, 132, 252, 0.6)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(192, 132, 252, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(192, 132, 252, 0.35)';
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(192, 132, 252, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <UploadCloud size={19} color="#C084FC" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#FFFFFF' }}>
                        Importar fatura via extrato CSV
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#8E8E93', marginTop: '2px', lineHeight: 1.3 }}>
                        Cadastra automaticamente as compras em aberto deste cartão
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1px solid rgba(74, 222, 128, 0.35)',
                      backgroundColor: 'rgba(74, 222, 128, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <CheckCircle2 size={20} color="#4ADE80" style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {csvFileName || 'Extrato Carregado'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#4ADE80', marginTop: '1px', fontWeight: 600 }}>
                          {csvRows.filter(r => !r.isInvoicePayment).length} compras identificadas • Total: {formatBrlCurrency(Math.max(0, totalInvoiceCsvAmount))}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCsvRows([]);
                        setCsvFileName('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#8E8E93',
                        cursor: 'pointer',
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                      }}
                      title="Remover arquivo"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Prévia inteligente das compras da fatura */}
                {csvRows.length > 0 && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '12px',
                      backgroundColor: '#18201B',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: '#8E8E93', fontWeight: 600 }}>
                      <span>Prévia inteligente das compras</span>
                      <span style={{ color: '#4ADE80' }}>Nomes limpos e parcelas detectadas</span>
                    </div>

                    <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {csvRows.slice(0, 6).map((row, rIdx) => (
                        <div
                          key={rIdx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.74rem',
                            padding: '4px 6px',
                            borderRadius: '6px',
                            backgroundColor: row.isInvoicePayment ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                            opacity: row.isInvoicePayment ? 0.6 : 1,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <span style={{ color: '#8E8E93', fontSize: '0.7rem' }}>{row.date.slice(5)}</span>
                            <span style={{ color: '#FFFFFF', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.cleanDescription}
                            </span>
                            {row.isInstallment && (
                              <span style={{ fontSize: '0.64rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', fontWeight: 700 }}>
                                {row.installmentNumber}/{row.installmentTotal}
                              </span>
                            )}
                            {row.isInvoicePayment && (
                              <span style={{ fontSize: '0.64rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', fontWeight: 700 }}>
                                Quitação (ignorada)
                              </span>
                            )}
                          </div>
                          <span style={{ fontWeight: 700, color: row.isInvoicePayment ? '#8E8E93' : '#FFFFFF', marginLeft: '8px' }}>
                            {formatBrlCurrency(row.amount)}
                          </span>
                        </div>
                      ))}
                      {csvRows.length > 6 && (
                        <span style={{ fontSize: '0.68rem', color: '#8E8E93', textAlign: 'center', paddingTop: '2px' }}>
                          + {csvRows.length - 6} outras compras no extrato
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {csvError && (
                  <div style={{ fontSize: '0.72rem', color: '#FB7185', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <AlertCircle size={13} />
                    {csvError}
                  </div>
                )}

                {/* Opção alternativa caso não tenha o CSV em mãos */}
                {csvRows.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setShowManualInput(prev => !prev)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#8E8E93',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: '2px 0',
                      textDecoration: 'underline',
                    }}
                  >
                    {showManualInput ? 'Ocultar valor manual' : 'Não tem o CSV? Digitar valor da fatura manualmente'}
                  </button>
                )}

                {showManualInput && csvRows.length === 0 && (
                  <div style={{ marginTop: '2px' }}>
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
                    <span style={{ fontSize: '0.70rem', color: '#8E8E93', marginTop: '4px', display: 'block' }}>
                      Valor total aproximado da fatura atual em aberto
                    </span>
                  </div>
                )}
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
              aspectRatio: '1.586 / 1',
              minHeight: '205px',
              borderRadius: '24px',
              backgroundColor: color || '#820AD1',
              backgroundImage: `linear-gradient(135deg, ${color} 0%, rgba(10, 15, 12, 0.92) 100%)`,
              border: '1px solid rgba(255, 255, 255, 0.18)',
              boxShadow: '0 18px 38px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
              padding: '22px 22px 20px',
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

            {/* Linha 1: Logo do Banco + Nome à esquerda | Tipo (Conta Bancária / Cartão de Crédito) no Topo Direito */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BankLogo bankId={selectedBankId} size={34} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} />
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                  {name || currentBankInfo?.shortName || 'Novo Cartão'}
                </div>
              </div>

              {/* Tag no Topo Direito */}
              <span
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'rgba(255, 255, 255, 0.85)',
                  backgroundColor: 'rgba(255, 255, 255, 0.14)',
                  padding: '3px 9px',
                  borderRadius: '9999px',
                  backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  whiteSpace: 'nowrap',
                }}
              >
                {isCreditCard ? 'Cartão de Crédito' : 'Conta Bancária'}
              </span>
            </div>

            {/* Linha 2: Chip Metálico com Aproximação ao lado + Dígitos em linha própria */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', zIndex: 2, margin: '10px 0 6px' }}>
              {/* Linha do Chip + Ícone Contactless desimpedido */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '30px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #FFE259 0%, #FFA751 100%)',
                    border: '1px solid rgba(0, 0, 0, 0.25)',
                    boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.5), 0 2px 5px rgba(0, 0, 0, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ width: '24px', height: '16px', border: '1px solid rgba(0, 0, 0, 0.25)', borderRadius: '3px' }} />
                </div>

                {/* Símbolo de Pagamento por Aproximação limpo e integrado */}
                <Wifi size={20} color="rgba(255, 255, 255, 0.85)" style={{ transform: 'rotate(90deg)' }} />
              </div>

              {/* Número Mascarado em Linha Única */}
              <div
                style={{
                  fontSize: '0.96rem',
                  fontWeight: 700,
                  letterSpacing: '2.5px',
                  color: 'rgba(255, 255, 255, 0.95)',
                  fontFamily: 'monospace, sans-serif',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
                  whiteSpace: 'nowrap',
                }}
              >
                •••• •••• •••• {lastDigits ? lastDigits : '••••'}
              </div>
            </div>

            {/* Linha 3: Limite & Ciclo ou Saldo */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', zIndex: 2, paddingBottom: '2px' }}>
              <div>
                <span style={{ fontSize: '0.66rem', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  {isCreditCard ? 'Limite Total' : 'Saldo Disponível'}
                </span>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', marginTop: '2px' }}>
                  R$ {isCreditCard ? (creditLimitStr || '0,00') : (balanceStr || '0,00')}
                </div>
              </div>

              {isCreditCard && (
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.66rem', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', fontWeight: 600 }}>
                    Ciclo Mensal
                  </span>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF', marginTop: '2px', display: 'block' }}>
                    Fecha {String(numericClosingDay).padStart(2, '0')} • Vence {String(numericDueDay).padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            7.5. COMPARTILHAMENTO / CARTÃO CONJUNTO (PADRÃO PIERRE)
           ───────────────────────────────────────────────────────────── */}
        <div
          style={{
            backgroundColor: '#12161B',
            borderRadius: '20px',
            padding: '18px',
            border: isShared 
              ? '1px solid rgba(74, 222, 128, 0.25)' 
              : '1px solid rgba(255, 255, 255, 0.07)',
            transition: 'all 0.2s ease',
          }}
        >
          {/* Header do Card com Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  backgroundColor: isShared ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                  border: isShared ? '1px solid rgba(74, 222, 128, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isShared ? '#4ADE80' : '#9CA3AF',
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                }}
              >
                <Users size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                  Cartão Conjunto / Compartilhado
                </div>
                <div style={{ fontSize: '0.74rem', color: '#9CA3AF', marginTop: '2px', lineHeight: 1.35 }}>
                  Sincronize gastos em tempo real entre dois celulares
                </div>
              </div>
            </div>

            {/* Switch Toggle Pierre */}
            <button
              type="button"
              onClick={() => handleToggleShared(!isShared)}
              style={{
                width: '46px',
                height: '26px',
                borderRadius: '100px',
                backgroundColor: isShared ? '#22C55E' : 'rgba(255, 255, 255, 0.12)',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF',
                  position: 'absolute',
                  top: '3px',
                  left: isShared ? '23px' : '3px',
                  transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.35)',
                }}
              />
            </button>
          </div>

          {/* Conteúdo Expandido quando o Cartão Compartilhado está Ativado */}
          {isShared && (
            <div
              style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.07)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                animation: 'fadeIn 0.2s ease',
              }}
            >
              {/* 1. Bloco do Código de Convite (Limpo & Refinado) */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.66rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block' }}>
                    Código de Convite
                  </span>
                  <div style={{ fontSize: '1.18rem', fontWeight: 900, color: '#4ADE80', letterSpacing: '0.06em', fontFamily: 'monospace', marginTop: '2px' }}>
                    {inviteCode || 'GERANDO...'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    title="Copiar código"
                    style={{
                      height: '34px',
                      padding: '0 12px',
                      borderRadius: '9px',
                      backgroundColor: copiedInvite ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                      border: copiedInvite ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                      color: copiedInvite ? '#4ADE80' : '#FFFFFF',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {copiedInvite ? <CheckCheck size={13} /> : <Copy size={13} />}
                    <span>{copiedInvite ? 'Copiado' : 'Copiar'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareWhatsapp}
                    title="Compartilhar no WhatsApp"
                    style={{
                      height: '34px',
                      padding: '0 12px',
                      borderRadius: '9px',
                      backgroundColor: 'rgba(34, 197, 94, 0.12)',
                      border: '1px solid rgba(34, 197, 94, 0.25)',
                      color: '#4ADE80',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.2)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.12)')}
                  >
                    <Share2 size={13} />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* 2. NOVA SEÇÃO PIERRE: Divisão no Fluxo de Caixa / Sobra */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                    Divisão no Fluxo de Caixa
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#4ADE80', fontWeight: 600 }}>
                    {splitMode === 'half' ? '50% para cada' : splitMode === 'none' ? '0% (Apenas ver)' : '100% integral'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {/* Opção 1: Metade (50%) */}
                  <button
                    type="button"
                    onClick={() => setSplitMode('half')}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '12px',
                      border: splitMode === 'half' 
                        ? '1px solid rgba(74, 222, 128, 0.45)' 
                        : '1px solid rgba(255, 255, 255, 0.06)',
                      backgroundColor: splitMode === 'half' 
                        ? 'rgba(74, 222, 128, 0.1)' 
                        : 'rgba(255, 255, 255, 0.03)',
                      color: splitMode === 'half' ? '#4ADE80' : '#9CA3AF',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: splitMode === 'half' ? '#FFFFFF' : '#D1D5DB' }}>
                      Metade (50%)
                    </div>
                    <div style={{ fontSize: '0.65rem', color: splitMode === 'half' ? '#4ADE80' : '#6B7280', fontWeight: 500 }}>
                      Parceiro(a) divide
                    </div>
                  </button>

                  {/* Opção 2: Integral (100%) */}
                  <button
                    type="button"
                    onClick={() => setSplitMode('full')}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '12px',
                      border: splitMode === 'full' 
                        ? '1px solid rgba(74, 222, 128, 0.45)' 
                        : '1px solid rgba(255, 255, 255, 0.06)',
                      backgroundColor: splitMode === 'full' 
                        ? 'rgba(74, 222, 128, 0.1)' 
                        : 'rgba(255, 255, 255, 0.03)',
                      color: splitMode === 'full' ? '#4ADE80' : '#9CA3AF',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: splitMode === 'full' ? '#FFFFFF' : '#D1D5DB' }}>
                      Integral (100%)
                    </div>
                    <div style={{ fontSize: '0.65rem', color: splitMode === 'full' ? '#4ADE80' : '#6B7280', fontWeight: 500 }}>
                      Eu pago tudo
                    </div>
                  </button>

                  {/* Opção 3: Apenas Acompanhar (0%) */}
                  <button
                    type="button"
                    onClick={() => setSplitMode('none')}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '12px',
                      border: splitMode === 'none' 
                        ? '1px solid rgba(74, 222, 128, 0.45)' 
                        : '1px solid rgba(255, 255, 255, 0.06)',
                      backgroundColor: splitMode === 'none' 
                        ? 'rgba(74, 222, 128, 0.1)' 
                        : 'rgba(255, 255, 255, 0.03)',
                      color: splitMode === 'none' ? '#4ADE80' : '#9CA3AF',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: splitMode === 'none' ? '#FFFFFF' : '#D1D5DB' }}>
                      Apenas Ver (0%)
                    </div>
                    <div style={{ fontSize: '0.65rem', color: splitMode === 'none' ? '#4ADE80' : '#6B7280', fontWeight: 500 }}>
                      Parceiro(a) paga
                    </div>
                  </button>
                </div>

                {/* Nota de esclarecimento Pierre (Reduz ansiedade) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.025)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <Info size={14} color="#6B7280" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '0.71rem', color: '#9CA3AF', lineHeight: 1.4 }}>
                    A fatura completa continuará exibindo 100% dos lançamentos para você conferir com o app do banco. Mas na sua Sobra e no Fluxo de Caixa, consideraremos apenas{' '}
                    <strong style={{ color: '#E2E8F0' }}>
                      {splitMode === 'half' ? '50% (sua metade)' : splitMode === 'none' ? '0% (sem impacto na sua sobra)' : '100%'}
                    </strong>.
                  </span>
                </div>
              </div>

              {/* 3. Pessoas Vinculadas a este Cartão */}
              <div>
                <span style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                  Pessoas com acesso:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      fontSize: '0.78rem',
                      color: '#E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: '#4ADE80',
                          color: '#0A150D',
                          fontWeight: 800,
                          fontSize: '0.7rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {(accountToEdit?.ownerName || user?.displayName || 'V')[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{accountToEdit?.ownerName || user?.displayName || 'Você'}</span>
                    </div>
                    <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(74, 222, 128, 0.15)', color: '#4ADE80', fontWeight: 600 }}>
                      Titular
                    </span>
                  </div>

                  {sharedMembers.filter(m => m.role !== 'owner').map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        fontSize: '0.78rem',
                        color: '#E2E8F0',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: '#38BDF8',
                            color: '#0A150D',
                            fontWeight: 800,
                            fontSize: '0.7rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {(m.displayName || 'P')[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{m.displayName}</span>
                      </div>
                      <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', fontWeight: 600 }}>
                        Vinculado(a)
                      </span>
                    </div>
                  ))}

                  {sharedMembers.filter(m => m.role !== 'owner').length === 0 && (
                    <div style={{ fontSize: '0.72rem', color: '#64748B', fontStyle: 'italic', padding: '4px 6px' }}>
                      Aguardando o parceiro(a) ingressar com o código acima...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
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
              : pendingNotificationToLink
                ? 'Salvar Cartão & Lançar Compra'
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

      {/* Confirmação de Exclusão de Conta / Cartão */}
      {showDeleteConfirm && accountToEdit && (
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={async () => {
            await deleteAccount(accountToEdit.id);
            setShowDeleteConfirm(false);
            onBack();
          }}
          title={isCreditCard ? 'Excluir cartão' : 'Excluir conta'}
          description={
            isCreditCard
              ? 'Todas as faturas, compras e histórico deste cartão serão removidos permanentemente.'
              : 'O histórico e movimentações vinculadas a esta conta serão removidos.'
          }
          confirmText={isCreditCard ? 'Excluir cartão' : 'Excluir conta'}
          cancelText="Cancelar"
          variant="danger"
          itemDetails={{
            title: accountToEdit.name,
            subtitle: isCreditCard
              ? (accountToEdit.lastDigits ? `Final •••• ${accountToEdit.lastDigits}` : 'Cartão de crédito')
              : 'Conta bancária',
            bankId: accountToEdit.bankId,
            amount: isCreditCard && accountToEdit.creditLimit ? formatBrlCurrency(accountToEdit.creditLimit) : undefined,
            amountLabel: isCreditCard && accountToEdit.creditLimit ? 'Limite' : undefined,
            isAmountDestructive: false,
          }}
        />
      )}
      </div>
    </SwipeBackView>
  );
};
