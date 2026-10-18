import React, { useState, useMemo, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { SubscriptionDeleteScopeModal } from '../components/modals/SubscriptionDeleteScopeModal';
import { InstallmentDeleteScopeModal } from '../components/modals/InstallmentDeleteScopeModal';
import { Button } from '../components/common/Button';
import { IconRenderer } from '../components/common/IconRenderer';
import { BankLogo } from '../components/common/BankLogo';
import { BrandLogo } from '../components/common/BrandLogo';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { SwipeBackView } from '../components/common/SwipeBackView';
import { TransactionQuickActionModal } from '../components/modals/TransactionQuickActionModal';
import { useLongPress } from '../hooks/useLongPress';
import { 
  ArrowLeft,
  Plus, 
  Search, 
  SlidersHorizontal,
  Eye,
  EyeOff,
  X,
  ArrowLeftRight,
  Layers,
  Users,
  Coffee,
  CalendarClock,
  Repeat,
  Briefcase
} from 'lucide-react';
import { MONTH_NAMES_SHORT_PT } from '../core/salary/salaryCycleHelper';
import { extractInstallmentFromDescription } from '../core/parsers/csvParser';
import { Transaction, Account, Category } from '../core/types';
import { resolveTransactionAuthorBadge } from '../core/cards/cardSelectionHelper';
import { MicroExpensesRadarCard } from '../components/dashboard/MicroExpensesRadarCard';
import { 
  analyzeMicroExpenses, 
  isMicroExpense, 
  classifyMicroExpense, 
  MicroExpenseGroupId 
} from '../core/microExpenses/microExpensesHelper';

import { formatTitleCase } from '../core/categorization/merchantCleaner';

interface TransactionsScreenProps {
  onBack?: () => void;
  onOpenNewTransaction: (type?: 'expense' | 'income') => void;
  onEditTransaction: (tx: Transaction) => void;
}

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  onBack,
  onOpenNewTransaction,
  onEditTransaction,
}) => {
  const { 
    transactions, 
    accounts, 
    categories, 
    subscriptions,
    goals,
    deleteTransaction, 
    deleteSubscription,
    saveSubscription,
    deleteInstallmentGroup,
    deleteInstallmentScoped, 
    isPrivacyMode,
    togglePrivacyMode,
    partnershipSpace,
  } = useFinance();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income' | 'installments' | 'transfer'>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [showFutureInstallments, setShowFutureInstallments] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [installmentTxToDelete, setInstallmentTxToDelete] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [quickActionState, setQuickActionState] = useState<{ tx: Transaction; rect?: DOMRect } | null>(null);

  const { bind: bindLongPress } = useLongPress<Transaction>({
    onLongPress: (tx, rect) => {
      setQuickActionState({ tx, rect });
    },
    onClick: (tx) => {
      onEditTransaction(tx);
    },
  });

  // Estados do Radar de Microgastos (Efeito Cafezinho)
  const [microThreshold, setMicroThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sobra_micro_threshold_v1');
      return saved ? Number(saved) : 30;
    } catch {
      return 30;
    }
  });

  const [ignoredMicroTxIds, setIgnoredMicroTxIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sobra_micro_ignored_txs_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const ignoredSet = useMemo(() => new Set(ignoredMicroTxIds), [ignoredMicroTxIds]);

  const toggleIgnoreMicroTx = (txId: string) => {
    setIgnoredMicroTxIds(prev => {
      const next = prev.includes(txId) ? prev.filter(id => id !== txId) : [...prev, txId];
      try {
        localStorage.setItem('sobra_micro_ignored_txs_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const currentMonthYearKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [isMicroDismissed, setIsMicroDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`sobra_micro_dismissed_${currentMonthYearKey}`) === 'true';
    } catch {
      return false;
    }
  });

  const [isChallengeActive, setIsChallengeActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`sobra_micro_challenge_${currentMonthYearKey}`) === 'true';
    } catch {
      return false;
    }
  });

  const [selectedMicroGroup, setSelectedMicroGroup] = useState<MicroExpenseGroupId | 'all' | null>(null);

  const accountMap = new Map<string, Account>(accounts.map((a: Account) => [a.id, a]));
  const categoryMap = new Map<string, Category>(categories.map((c: Category) => [c.id, c]));

  const activeGoal = useMemo(() => {
    return goals?.find(g => !g.isCompleted && g.targetAmount > 0) || null;
  }, [goals]);

  // Análise em tempo real dos microgastos do mês atual
  const microAnalysis = useMemo(() => {
    return analyzeMicroExpenses(transactions, categories, new Date(), { 
      maxAmount: microThreshold,
      activeGoal,
      ignoredTxIds: ignoredMicroTxIds,
      excludeWorkCommute: true,
    });
  }, [transactions, categories, microThreshold, activeGoal, ignoredMicroTxIds]);

  const handleThresholdChange = (newVal: number) => {
    setMicroThreshold(newVal);
    try {
      localStorage.setItem('sobra_micro_threshold_v1', String(newVal));
    } catch {}
  };

  const handleDismissMicro = () => {
    setIsMicroDismissed(true);
    try {
      localStorage.setItem(`sobra_micro_dismissed_${currentMonthYearKey}`, 'true');
    } catch {}
  };

  const handleAcceptChallenge = (savedCount: number, savedAmount: number) => {
    setIsChallengeActive(true);
    try {
      localStorage.setItem(`sobra_micro_challenge_${currentMonthYearKey}`, 'true');
      localStorage.setItem(
        `sobra_micro_challenge_data_${currentMonthYearKey}`,
        JSON.stringify({ savedCount, savedAmount, acceptedAt: new Date().toISOString() })
      );
    } catch {}
  };

  const handleViewMicroTransactions = (groupId?: MicroExpenseGroupId) => {
    setSelectedType('all');
    setSelectedMicroGroup(groupId || 'all');
  };

  // Garante que ao entrar na tela sempre inicie no topo do feed
  useEffect(() => {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, []);

  // Quantidade de filtros avançados ativos para badge no botão [Filtros]
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedAccountId !== 'all') count++;
    if (selectedCategoryId !== 'all') count++;
    if (showFutureInstallments) count++;
    if (selectedMicroGroup !== null) count++;
    return count;
  }, [selectedAccountId, selectedCategoryId, showFutureInstallments, selectedMicroGroup]);

  // Filtragem de transações
  const filtered = useMemo(() => {
    return transactions
      .filter((t: Transaction) => {
        // Filtro específico do Radar de Microgastos quando ativo
        if (selectedMicroGroup !== null) {
          if (!isMicroExpense(t, categoryMap, microThreshold, { ignoredTxIds: ignoredSet })) return false;
          if (microAnalysis.commuteTransactions.some(ct => ct.id === t.id)) return false;
          if (selectedMicroGroup !== 'all' && classifyMicroExpense(t) !== selectedMicroGroup) return false;
        }

        if (selectedType === 'installments') {
          if (!t.isInstallment) return false;
        } else {
          if (!showFutureInstallments) {
            const txDateOnly = t.date.substring(0, 10);
            const todayOnly = new Date().toISOString().substring(0, 10);
            if (txDateOnly > todayOnly) {
              // Esconde qualquer transação futura que seja parcela
              // (por isInstallment, por ter groupId, ou pelo padrão "(N/M)" na descrição)
              const looksLikeInstallment = 
                t.isInstallment || 
                !!t.installmentGroupId || 
                /\(\d+\/\d+\)/.test(t.description);
              if (looksLikeInstallment) return false;

              // Esconde qualquer lançamento futuro de assinatura que ainda não foi cobrado/confirmado
              const isFutureSubscription = 
                (Boolean(t.subscriptionId) || Boolean(t.isRecurring) || t.id.startsWith('tx-sub-') || t.id.startsWith('proj-sub-')) &&
                !t.rawNotificationPayload;
              if (isFutureSubscription) return false;
            }
          }
          if (selectedType !== 'all' && t.type !== selectedType) return false;
        }
        if (selectedAccountId !== 'all' && t.accountId !== selectedAccountId) return false;
        if (selectedCategoryId !== 'all' && t.categoryId !== selectedCategoryId) return false;
        if (searchTerm.trim()) {
          const lower = searchTerm.toLowerCase();
          const descMatch = t.description.toLowerCase().includes(lower);
          const catMatch = (categoryMap.get(t.categoryId)?.name || '').toLowerCase().includes(lower);
          const accMatch = (accountMap.get(t.accountId)?.name || '').toLowerCase().includes(lower);
          if (!descMatch && !catMatch && !accMatch) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    transactions, 
    selectedType, 
    selectedAccountId, 
    selectedCategoryId, 
    showFutureInstallments, 
    searchTerm, 
    categoryMap, 
    accountMap,
    selectedMicroGroup,
    microThreshold
  ]);

  // Formatação de cabeçalho de grupo de data estilo Pierre (ex: "Hoje", "Ontem", "Quinta-feira", "10 de set.")
  const formatGroupHeader = (dateStr: string): string => {
    const d = new Date(dateStr);
    const now = new Date();
    
    const txDateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = todayOnly.getTime() - txDateOnly.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    
    // Se for nos últimos 6 dias, dia da semana em português (ex: Quinta-feira)
    if (diffDays > 1 && diffDays <= 6) {
      const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
      return weekday.charAt(0).toUpperCase() + weekday.slice(1);
    }
    
    // Se for no ano corrente, dia e mês abreviado (ex: 10 de set.)
    const day = d.getDate();
    const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    
    if (d.getFullYear() === now.getFullYear()) {
      return `${day} de ${month}.`;
    }
    return `${day} de ${month}. de ${d.getFullYear()}`;
  };

  // Agrupamento cronológico por dia
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: { label: string; txs: Transaction[] } } = {};
    
    filtered.forEach(tx => {
      const dateKey = tx.date.substring(0, 10);
      if (!groups[dateKey]) {
        groups[dateKey] = {
          label: formatGroupHeader(tx.date),
          txs: [],
        };
      }
      groups[dateKey].txs.push(tx);
    });
    
    return Object.entries(groups)
      .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
      .map(([dateKey, group]) => ({
        dateKey,
        label: group.label,
        transactions: group.txs,
      }));
  }, [filtered]);

  const maskValue = (formatted: string) => (isPrivacyMode ? '••••••' : formatted);

  return (
    <SwipeBackView onBack={onBack} enabled={!!onBack}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      {/* Top Header Row: Botão de Voltar, CSV na esquerda | Olho e Botão (+) na direita (padronizado) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Botão de Voltar (como nas outras telas) */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              title="Voltar"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.07)',
                border: 'none',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
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
          )}
        </div>

        {/* Ações da Direita: Olho de privacidade */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Botão de Privacidade */}
          <button
            type="button"
            onClick={togglePrivacyMode}
            title={isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores'}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.07)',
              border: 'none',
              color: isPrivacyMode ? '#4ADE80' : '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)')}
          >
            {isPrivacyMode ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
      </div>

      {/* Título Principal da Tela: "Atividades" */}
      <div>
        <h1
          style={{
            fontSize: '2.05rem',
            fontWeight: 800,
            color: '#FFFFFF',
            margin: 0,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
          }}
        >
          Atividades
        </h1>
      </div>

      {/* Barra de Busca Minimalista */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          borderRadius: '24px',
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Search
          size={18}
          color="#8E8E93"
          style={{ position: 'absolute', left: '16px', pointerEvents: 'none' }}
        />
        <input
          type="text"
          placeholder="Buscar"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 42px 12px 46px',
            borderRadius: '24px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#FFFFFF',
            fontSize: '0.94rem',
            outline: 'none',
          }}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            style={{
              position: 'absolute',
              right: '12px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Barra de Filtros com [Filtros] OBRIGATORIAMENTE COMO PRIMEIRA OPÇÃO */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '2px',
          scrollbarWidth: 'none',
          alignItems: 'center',
        }}
      >
        {/* 1. Botão [Filtros] (Primeira opção!) */}
        <button
          type="button"
          onClick={() => setIsFilterModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '24px',
            fontSize: '0.84rem',
            fontWeight: 600,
            backgroundColor: activeFiltersCount > 0 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.06)',
            color: activeFiltersCount > 0 ? '#000000' : '#FFFFFF',
            border: `1px solid ${activeFiltersCount > 0 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.12)'}`,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <SlidersHorizontal size={14} color={activeFiltersCount > 0 ? '#000000' : '#FFFFFF'} />
          <span>Filtros</span>
          {activeFiltersCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '18px',
                height: '18px',
                padding: '0 4px',
                borderRadius: '9px',
                backgroundColor: '#000000',
                color: '#FFFFFF',
                fontSize: '0.7rem',
                fontWeight: 800,
              }}
            >
              {activeFiltersCount}
            </span>
          )}
        </button>

        {/* 2. Filtro: Entradas */}
        <button
          type="button"
          onClick={() => setSelectedType(prev => prev === 'income' ? 'all' : 'income')}
          style={{
            padding: '8px 16px',
            borderRadius: '24px',
            fontSize: '0.84rem',
            fontWeight: 600,
            backgroundColor: selectedType === 'income' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            color: selectedType === 'income' ? '#4ADE80' : '#FFFFFF',
            border: `1px solid ${selectedType === 'income' ? '#4ADE80' : 'rgba(255, 255, 255, 0.12)'}`,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          Entradas
        </button>

        {/* 3. Filtro: Saídas */}
        <button
          type="button"
          onClick={() => setSelectedType(prev => prev === 'expense' ? 'all' : 'expense')}
          style={{
            padding: '8px 16px',
            borderRadius: '24px',
            fontSize: '0.84rem',
            fontWeight: 600,
            backgroundColor: selectedType === 'expense' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            color: selectedType === 'expense' ? '#FB7185' : '#FFFFFF',
            border: `1px solid ${selectedType === 'expense' ? '#FB7185' : 'rgba(255, 255, 255, 0.12)'}`,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          Saídas
        </button>

        {/* 4. Filtro: Parceladas */}
        <button
          type="button"
          onClick={() => setSelectedType(prev => prev === 'installments' ? 'all' : 'installments')}
          style={{
            padding: '8px 16px',
            borderRadius: '24px',
            fontSize: '0.84rem',
            fontWeight: 600,
            backgroundColor: selectedType === 'installments' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            color: selectedType === 'installments' ? '#38BDF8' : '#FFFFFF',
            border: `1px solid ${selectedType === 'installments' ? '#38BDF8' : 'rgba(255, 255, 255, 0.12)'}`,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          Parceladas
        </button>

        {/* 5. Filtro: Transferências */}
        <button
          type="button"
          onClick={() => setSelectedType(prev => prev === 'transfer' ? 'all' : 'transfer')}
          style={{
            padding: '8px 16px',
            borderRadius: '24px',
            fontSize: '0.84rem',
            fontWeight: 600,
            backgroundColor: selectedType === 'transfer' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            color: selectedType === 'transfer' ? '#C084FC' : '#FFFFFF',
            border: `1px solid ${selectedType === 'transfer' ? '#C084FC' : 'rgba(255, 255, 255, 0.12)'}`,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          Transferências
        </button>

        {/* 6. Filtro: Microgastos (Radar Cafezinho) */}
        {microAnalysis.eligible && (
          <button
            type="button"
            onClick={() => {
              if (selectedMicroGroup !== null) {
                setSelectedMicroGroup(null);
              } else {
                setSelectedType('all');
                setSelectedMicroGroup('all');
              }
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '24px',
              fontSize: '0.84rem',
              fontWeight: 600,
              backgroundColor: selectedMicroGroup !== null ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              color: selectedMicroGroup !== null ? '#FBBF24' : '#FFFFFF',
              border: `1px solid ${selectedMicroGroup !== null ? '#FBBF24' : 'rgba(255, 255, 255, 0.12)'}`,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>☕ Microgastos</span>
            {microAnalysis.totalCount > 0 && (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: selectedMicroGroup !== null ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.12)',
                  color: selectedMicroGroup !== null ? '#FDE68A' : '#E2E8F0',
                  fontWeight: 700,
                }}
              >
                {microAnalysis.totalCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Card Radar de Microgastos: só exibe quando o usuário entrar na opção */}
      {selectedMicroGroup !== null && (
        <div style={{ marginBottom: '14px' }}>
          <MicroExpensesRadarCard
            analysis={microAnalysis}
            onViewTransactions={(groupId) => setSelectedMicroGroup(groupId || 'all')}
            onDismiss={() => setSelectedMicroGroup(null)}
            onThresholdChange={handleThresholdChange}
            onAcceptChallenge={handleAcceptChallenge}
            isChallengeActive={isChallengeActive}
            selectedGroupId={selectedMicroGroup}
          />
        </div>
      )}

      {/* Feed Cronológico Agrupado por Data */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 20px',
            color: '#8E8E93',
            fontSize: '0.9rem',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '16px',
            border: '1px dashed rgba(255, 255, 255, 0.08)',
            marginTop: '12px',
          }}
        >
          Nenhuma movimentação encontrada com os filtros selecionados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {groupedTransactions.map(group => (
            <div key={group.dateKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* Título do dia estilo Pierre (ex: "Quinta-feira", "10 de set.") */}
              <h3
                style={{
                  fontSize: '1.08rem',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  margin: '18px 0 6px 4px',
                  letterSpacing: '-0.02em',
                }}
              >
                {group.label}
              </h3>

              {/* Transações deste dia */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {group.transactions.map(tx => {
                  const cat = categoryMap.get(tx.categoryId);
                  const acc = accountMap.get(tx.accountId);
                  const destAcc = tx.destinationAccountId ? accountMap.get(tx.destinationAccountId) : undefined;
                  const isExpense = tx.type === 'expense';
                  const isIncome = tx.type === 'income';
                  const isTransfer = tx.type === 'transfer';

                  // Cores do avatar circular do Pierre
                  const avatarBg = isExpense
                    ? 'rgba(244, 63, 94, 0.14)'
                    : isIncome
                    ? 'rgba(34, 197, 94, 0.14)'
                    : 'rgba(168, 85, 247, 0.14)';

                  const avatarColor = isExpense
                    ? '#FB7185'
                    : isIncome
                    ? '#4ADE80'
                    : '#C084FC';

                  // Processamento da data e hora da transação
                  const txDateObj = new Date(tx.date);
                  const dateSubStr = !isNaN(txDateObj.getTime())
                    ? txDateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
                    : '';
                  
                  // Transações manuais sem hora definida salvavam com 12:00:00Z ou 00:00:00Z (que vira 09:00 no Brasil)
                  const isDummyTime = 
                    !tx.date.includes('T') ||
                    tx.date.includes('T12:00:00') || 
                    tx.date.includes('T00:00:00') || 
                    tx.date.includes('T03:00:00');

                  const hasSpecificTime = !isDummyTime && !isNaN(txDateObj.getTime());
                  const timeStr = hasSpecificTime
                    ? txDateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : '';
                  const dateTimeLabel = timeStr ? `${dateSubStr} • ${timeStr}` : dateSubStr;

                  const extracted = extractInstallmentFromDescription(tx.description);
                  const cleanTitle = extracted.cleanDescription || tx.description;
                  const installmentNumber = tx.installmentNumber || extracted.installmentNumber;
                  const installmentTotal = tx.installmentTotal || extracted.installmentTotal;

                  // Subtítulo da categoria ou fluxo de transferência
                  const categoryLabel = isTransfer
                    ? `${acc?.name || 'Origem'} → ${destAcc?.name || 'Destino'}`
                    : (cat?.name || 'Geral');

                  const authorBadge = resolveTransactionAuthorBadge({
                    tx,
                    account: acc,
                    currentUser: user,
                    partnershipSpace,
                  });

                  return (
                    <div
                      key={tx.id}
                      {...bindLongPress(tx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 8px',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                        WebkitTouchCallout: 'none',
                        userSelect: 'none',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Lado Esquerdo: Avatar Circular com Badge do Banco ou Autor Sobreposto */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                        {isTransfer ? (
                          <div style={{ position: 'relative', width: '44px', height: '44px', flexShrink: 0 }}>
                            <div
                              style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '50%',
                                backgroundColor: avatarBg,
                                color: avatarColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <ArrowLeftRight size={19} color="#C084FC" />
                            </div>

                            {/* Logo do Banco ou Badge de Autor Sobreposto */}
                            {authorBadge && authorBadge.type !== 'bank' ? (
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: '-2px',
                                  right: '-2px',
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  backgroundColor: authorBadge.isJoint ? '#0F172A' : (authorBadge.badgeBg || '#1E293B'),
                                  border: '1.5px solid #000000',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                  zIndex: 2,
                                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.6)',
                                }}
                                title={authorBadge.isJoint ? 'Conjunto' : (authorBadge.name ? `Por ${authorBadge.name}` : undefined)}
                              >
                                {authorBadge.isJoint ? (
                                  <Users size={10} color="#38BDF8" />
                                ) : authorBadge.avatarUrl ? (
                                  <img src={authorBadge.avatarUrl} alt="Autor" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>{authorBadge.initial}</span>
                                )}
                              </div>
                            ) : acc ? (
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: '-2px',
                                  right: '-2px',
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  backgroundColor: '#121316',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                }}
                              >
                                <BankLogo bankId={acc.bankId || acc.name} size={14} style={{ boxShadow: 'none' }} />
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <BrandLogo
                            name={cleanTitle}
                            category={cat}
                            bankId={acc ? (acc.bankId || acc.name) : undefined}
                            authorBadge={authorBadge}
                            size={44}
                            fallbackIcon={isExpense ? 'ShoppingBag' : 'TrendingUp'}
                          />
                        )}

                        {/* Textos Centrais */}
                        <div style={{ minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                          <div
                            style={{
                              fontSize: '0.94rem',
                              fontWeight: 600,
                              color: '#FFFFFF',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatTitleCase(cleanTitle)}
                          </div>

                          <div
                            style={{
                              fontSize: '0.76rem',
                              color: '#8E8E93',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {categoryLabel}
                            </span>
                            {Boolean(tx.subscriptionId || tx.id?.startsWith('tx-sub-') || tx.isRecurring) && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  color: '#94A3B8',
                                  fontSize: '0.72rem',
                                  fontWeight: 500,
                                  flexShrink: 0,
                                }}
                              >
                                <span style={{ color: '#475569', fontSize: '0.65rem' }}>•</span>
                                <Repeat size={10} strokeWidth={2.4} style={{ color: '#94A3B8', opacity: 0.9 }} />
                                <span>{tx.recurringCadence === 'yearly' || subscriptions?.find(s => s.id === tx.subscriptionId)?.cadence === 'yearly' ? 'Anual' : 'Mensal'}</span>
                              </span>
                            )}
                          </div>

                          {/* Badge discreto de Salário Adiantado / Competência */}
                          {tx.isSalaryAdvance && tx.competenceMonth && (
                            <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(74, 222, 128, 0.12)',
                                  color: '#4ADE80',
                                  border: '1px solid rgba(74, 222, 128, 0.25)',
                                }}
                              >
                                <CalendarClock size={10} />
                                <span>Renda de {MONTH_NAMES_SHORT_PT[tx.competenceMonth - 1]}</span>
                              </span>
                            </div>
                          )}

                          {/* Botão de 1 toque: É Trabalho / Ignorar no Radar de Microgastos */}
                          {selectedMicroGroup !== null && (
                            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleIgnoreMicroTx(tx.id);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  backgroundColor: ignoredSet.has(tx.id) ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                                  color: ignoredSet.has(tx.id) ? '#4ADE80' : '#94A3B8',
                                  border: ignoredSet.has(tx.id) ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(255, 255, 255, 0.1)',
                                  cursor: 'pointer',
                                }}
                                title="Marcar como transporte de trabalho ou ignorar do radar de microgastos"
                              >
                                <Briefcase size={10} />
                                <span>{ignoredSet.has(tx.id) ? 'Trabalho / Ignorado' : 'É Trabalho / Ignorar'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Lado Direito: Valor Proeminente no Topo + Horário/Parcela Discretos Abaixo */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          gap: '3px',
                          flexShrink: 0,
                          marginLeft: '12px',
                          textAlign: 'right',
                        }}
                      >
                        {/* Valor Formatado com Destaque */}
                        <span
                          style={{
                            fontSize: '0.98rem',
                            fontWeight: 700,
                            fontFamily: "'Outfit', 'Inter', sans-serif",
                            color: isIncome ? '#4ADE80' : isExpense ? '#FB7185' : '#FFFFFF',
                            letterSpacing: '-0.01em',
                            lineHeight: 1.2,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isExpense ? '- ' : isIncome ? '+ ' : ''}
                          {maskValue(formatBrlCurrency(tx.amount))}
                        </span>

                        {/* Horário e Parcela (sem repetir a data do cabeçalho) */}
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: '#8E8E93',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {timeStr || ''}
                          {timeStr && installmentTotal && installmentTotal > 1 ? ' • ' : ''}
                          {installmentTotal && installmentTotal > 1 ? `${installmentNumber}/${installmentTotal}` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Moderno de Filtros Avançados (Acionado pelo primeiro botão [Filtros]) */}
      <Modal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Filtros"
        subtitle="Refine suas movimentações por conta ou categoria"
        maxWidth="440px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Filtro de Conta Bancária */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#E2E8F0', marginBottom: '8px' }}>
              Conta Bancária / Cartão
            </label>
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: '#1C1C1E',
                color: '#FFFFFF',
                fontSize: '0.92rem',
              }}
            >
              <option value="all">Todas as Contas</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro de Categoria */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#E2E8F0', marginBottom: '8px' }}>
              Categoria
            </label>
            <select
              value={selectedCategoryId}
              onChange={e => setSelectedCategoryId(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: '#1C1C1E',
                color: '#FFFFFF',
                fontSize: '0.92rem',
              }}
            >
              <option value="all">Todas as Categorias</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Alternar exibição de parcelas futuras */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => setShowFutureInstallments(prev => !prev)}
          >
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#FFFFFF' }}>
                Exibir parcelas futuras
              </div>
              <div style={{ fontSize: '0.74rem', color: '#8E8E93', marginTop: '2px' }}>
                {showFutureInstallments ? 'Mostrando próximas parcelas na lista' : 'Ocultando parcelas com data futura'}
              </div>
            </div>
            <input
              type="checkbox"
              checked={showFutureInstallments}
              onChange={e => setShowFutureInstallments(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#4ADE80', cursor: 'pointer' }}
              onClick={e => e.stopPropagation()}
            />
          </div>

          {/* Botões do Rodapé do Modal de Filtros */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setSelectedAccountId('all');
                setSelectedCategoryId('all');
                setShowFutureInstallments(false);
                setSelectedType('all');
              }}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: 'transparent',
                color: '#94A3B8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Limpar Filtros
            </button>

            <button
              type="button"
              onClick={() => setIsFilterModalOpen(false)}
              style={{
                padding: '10px 22px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: colors.primary || '#4ADE80',
                color: '#000000',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Aplicar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Escolha de Exclusão de Compra Parcelada */}
      {installmentTxToDelete && (
        <InstallmentDeleteScopeModal
          isOpen={!!installmentTxToDelete}
          onClose={() => setInstallmentTxToDelete(null)}
          onConfirm={async (scope) => {
            await deleteInstallmentScoped(installmentTxToDelete, scope);
            setInstallmentTxToDelete(null);
          }}
          transaction={installmentTxToDelete}
          zIndex={10000}
        />
      )}

      {/* Modal Moderno de Confirmação de Exclusão de Transação */}
      {txToDelete && (() => {
        const isSub = Boolean(
          txToDelete.subscriptionId || 
          txToDelete.id?.startsWith('tx-sub-') || 
          txToDelete.id?.startsWith('proj-sub-') || 
          txToDelete.isRecurring
        );
        const linkedSub = isSub 
          ? (txToDelete.subscriptionId 
              ? subscriptions.find(s => s.id === txToDelete.subscriptionId)
              : subscriptions.find(s => 
                  txToDelete.id?.startsWith(`tx-sub-${s.id}-`) ||
                  txToDelete.id?.startsWith(`proj-sub-${s.id}-`)
                ))
          : undefined;

        if (isSub && (linkedSub || txToDelete.subscriptionId || txToDelete.id?.startsWith('tx-sub-') || txToDelete.id?.startsWith('proj-sub-'))) {
          return (
            <SubscriptionDeleteScopeModal
              isOpen={!!txToDelete}
              onClose={() => setTxToDelete(null)}
              onConfirm={async (scope) => {
                if (scope === 'all' && linkedSub) {
                  await deleteSubscription(linkedSub.id);
                }
                await deleteTransaction(txToDelete.id);
                setTxToDelete(null);
              }}
              subscriptionName={linkedSub?.name || txToDelete.description}
              transactionTitle={txToDelete.description}
              amount={txToDelete.amount}
              cadence={linkedSub?.cadence || (txToDelete.recurringCadence === 'yearly' ? 'yearly' : 'monthly')}
              bankId={accounts.find(a => a.id === txToDelete.accountId)?.bankId}
              zIndex={10000}
            />
          );
        }

        const isInst = Boolean(
          txToDelete.isInstallment ||
          txToDelete.installmentGroupId ||
          (txToDelete.installmentTotal && txToDelete.installmentTotal > 1) ||
          (txToDelete.installmentNumber && txToDelete.installmentNumber > 0) ||
          extractInstallmentFromDescription(txToDelete.description || '').isInstallment
        );

        if (isInst) {
          return (
            <InstallmentDeleteScopeModal
              isOpen={!!txToDelete}
              onClose={() => setTxToDelete(null)}
              onConfirm={async (scope) => {
                await deleteInstallmentScoped(txToDelete, scope);
                setTxToDelete(null);
              }}
              transaction={txToDelete}
              zIndex={10000}
            />
          );
        }

        return (
          <ConfirmModal
            isOpen={!!txToDelete}
            onClose={() => setTxToDelete(null)}
            onConfirm={async () => {
              await deleteTransaction(txToDelete.id);
              setTxToDelete(null);
            }}
            title="Excluir Transação"
            description="Deseja realmente remover esta transação do seu extrato? O saldo e os relatórios serão recalculados."
            confirmText="Sim, Excluir"
            cancelText="Cancelar"
            variant="danger"
            itemDetails={{
              title: txToDelete.description,
              amount: `${txToDelete.type === 'income' ? '+' : '-'} R$ ${txToDelete.amount.toFixed(2).replace('.', ',')}`,
              subtitle: `${categoryMap.get(txToDelete.categoryId)?.name || 'Geral'} • ${accountMap.get(txToDelete.accountId)?.name || 'Conta'}`,
            }}
          />
        );
      })()}

      {/* Menu Contextual Ancorado (Balão Tátil) ao Segurar a Despesa */}
      <TransactionQuickActionModal
        isOpen={!!quickActionState}
        onClose={() => setQuickActionState(null)}
        transaction={quickActionState?.tx || null}
        targetRect={quickActionState?.rect}
        onEdit={(tx) => {
          onEditTransaction(tx);
        }}
        onDelete={(tx) => {
          setTxToDelete(tx);
        }}
        account={quickActionState?.tx ? accountMap.get(quickActionState.tx.accountId) : undefined}
        category={quickActionState?.tx ? categoryMap.get(quickActionState.tx.categoryId) : undefined}
      />
      </div>
    </SwipeBackView>
  );
};
