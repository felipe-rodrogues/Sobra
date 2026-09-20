import React, { useState, useMemo, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { Button } from '../components/common/Button';
import { IconRenderer } from '../components/common/IconRenderer';
import { BankLogo } from '../components/common/BankLogo';
import { formatBrlCurrency } from '../core/parsers/currencyHelper';
import { SwipeBackView } from '../components/common/SwipeBackView';
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
  Users
} from 'lucide-react';
import { Transaction, Account, Category } from '../core/types';

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
    deleteTransaction, 
    deleteInstallmentGroup, 
    isPrivacyMode,
    togglePrivacyMode 
  } = useFinance();
  const { colors } = useTheme();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income' | 'installments' | 'transfer'>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [showFutureInstallments, setShowFutureInstallments] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [installmentTxToDelete, setInstallmentTxToDelete] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  const accountMap = new Map<string, Account>(accounts.map((a: Account) => [a.id, a]));
  const categoryMap = new Map<string, Category>(categories.map((c: Category) => [c.id, c]));

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
    return count;
  }, [selectedAccountId, selectedCategoryId, showFutureInstallments]);

  // Filtragem de transações
  const filtered = useMemo(() => {
    return transactions
      .filter((t: Transaction) => {
        if (selectedType === 'installments') {
          if (!t.isInstallment) return false;
        } else {
          if (!showFutureInstallments && t.isInstallment && t.installmentNumber && t.installmentNumber > 1) {
            return false;
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
  }, [transactions, selectedType, selectedAccountId, selectedCategoryId, showFutureInstallments, searchTerm, categoryMap, accountMap]);

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
                border: '1px solid rgba(255, 255, 255, 0.08)',
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

        {/* Ações da Direita: Olho de privacidade + Botão Novo (+) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Botão de Privacidade (agora na direita ao lado do botão de adicionar) */}
          <button
            type="button"
            onClick={togglePrivacyMode}
            title={isPrivacyMode ? 'Mostrar valores' : 'Ocultar valores'}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.07)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
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

          {/* Botão Novo (+) */}
          <button
            type="button"
            onClick={() => onOpenNewTransaction(selectedType === 'income' ? 'income' : 'expense')}
            title="Nova transação"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: colors.primary || '#4ADE80', // Cor da marca Sobra
              border: 'none',
              color: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(74, 222, 128, 0.35)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <Plus size={24} strokeWidth={2.6} />
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
      </div>

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

                  // Subtítulo da categoria ou fluxo de transferência
                  const categoryLabel = isTransfer
                    ? `${acc?.name || 'Origem'} → ${destAcc?.name || 'Destino'}`
                    : (cat?.name || 'Geral');

                  return (
                    <div
                      key={tx.id}
                      onClick={() => onEditTransaction(tx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 8px',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Lado Esquerdo: Avatar Circular com Badge do Banco Sobreposto */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
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
                            {isTransfer ? (
                              <ArrowLeftRight size={19} color="#C084FC" />
                            ) : (
                              <IconRenderer name={cat?.icon || (isExpense ? 'ShoppingBag' : 'TrendingUp')} size={19} />
                            )}
                          </div>

                          {/* Logo do Banco Sobreposto no Canto Inferior Direito */}
                          {acc && (
                            <div
                              style={{
                                position: 'absolute',
                                bottom: '-2px',
                                right: '-2px',
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: '#121316',
                                boxShadow: '0 0 0 2px #121316',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                              }}
                            >
                              <BankLogo bankId={acc.bankId || acc.name} size={14} />
                            </div>
                          )}
                        </div>

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
                            {tx.description}
                          </div>

                          <div
                            style={{
                              fontSize: '0.76rem',
                              color: '#8E8E93',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {categoryLabel}
                          </div>

                          {/* Badge discreto de Lançamento Compartilhado (quando aplicável) */}
                          {(tx.createdByName || acc?.isShared) && (
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
                                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                  color: '#38BDF8',
                                  border: '1px solid rgba(56, 189, 248, 0.2)',
                                }}
                              >
                                <Users size={10} />
                                <span>{tx.createdByName ? `Por ${tx.createdByName.split(' ')[0]}` : 'Conjunto'}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Lado Direito: Data/Hora acima do Valor */}
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
                        {/* Data e Hora capturada */}
                        <span
                          style={{
                            fontSize: '0.73rem',
                            color: '#8E8E93',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {dateTimeLabel}
                        </span>

                        {/* Valor Formatado */}
                        <span
                          style={{
                            fontSize: '0.98rem',
                            fontWeight: 700,
                            color: isIncome ? '#4ADE80' : isExpense ? '#FB7185' : '#FFFFFF',
                            lineHeight: 1.2,
                          }}
                        >
                          {isExpense ? '-R$ ' : isIncome ? '+R$ ' : 'R$ '}
                          {maskValue(formatBrlCurrency(tx.amount).replace('R$', '').trim())}
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
                Exibir parcelas futuras (&gt; 1)
              </div>
              <div style={{ fontSize: '0.74rem', color: '#8E8E93', marginTop: '2px' }}>
                {showFutureInstallments ? 'Mostrando parcelas dos próximos meses' : 'Ocultando parcelas futuras para manter a lista limpa'}
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
        <Modal
          isOpen={!!installmentTxToDelete}
          onClose={() => setInstallmentTxToDelete(null)}
          title="Excluir Compra Parcelada"
          subtitle={installmentTxToDelete.description}
          maxWidth="460px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.88rem', color: colors.textSecondary, margin: 0, lineHeight: 1.4 }}>
              Esta transação faz parte de uma compra parcelada em <strong>{installmentTxToDelete.installmentTotal}x</strong>. Como você deseja proceder com a exclusão?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Button
                variant="outline"
                onClick={async () => {
                  await deleteTransaction(installmentTxToDelete.id);
                  setInstallmentTxToDelete(null);
                }}
                style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 14px' }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                    Excluir apenas esta parcela ({installmentTxToDelete.installmentNumber}/{installmentTxToDelete.installmentTotal})
                  </div>
                  <div style={{ fontSize: '0.72rem', color: colors.textMuted, marginTop: '2px' }}>
                    Mantém as demais parcelas nas faturas dos outros meses
                  </div>
                </div>
              </Button>

              <Button
                variant="danger"
                onClick={async () => {
                  if (installmentTxToDelete.installmentGroupId) {
                    await deleteInstallmentGroup(installmentTxToDelete.installmentGroupId);
                  }
                  setInstallmentTxToDelete(null);
                }}
                style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 14px' }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                    Excluir todas as {installmentTxToDelete.installmentTotal} parcelas deste parcelamento
                  </div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '2px' }}>
                    Cancela o parcelamento completo e libera o limite do cartão
                  </div>
                </div>
              </Button>

              <Button
                variant="secondary"
                onClick={() => setInstallmentTxToDelete(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Moderno de Confirmação de Exclusão de Transação */}
      {txToDelete && (
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
      )}
      </div>
    </SwipeBackView>
  );
};
